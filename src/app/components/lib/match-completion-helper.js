import pool from "./db.js";

/**
 * Checks and automatically updates:
 * 1. An innings status to 'Completed' if:
 *    - 10 players dismissed (effective dismissals / wickets >= 10)
 *    - OR over limit reached (effective balls >= matchOvers * 6 or total_overs >= matchOvers)
 *    - OR target chased down in 2nd innings (target_runs > 0 and total_runs >= target_runs)
 * 2. When both innings are 'Completed':
 *    - Calculates the winning team and margin (or match tied)
 *    - Updates cst_matches status to 'Completed' and remarks to the match result.
 *
 * @param {Object} connection - Optional mysql connection or transaction (defaults to pool)
 * @param {number|string} matchId - The ID of the match
 * @param {number|string|null} inningsId - Optional specific innings ID
 * @returns {Promise<Object|null>} Summary of completion checks and updates
 */
export async function checkAndUpdateInningsAndMatchCompletion(connection, matchId, inningsId = null) {
    if (!matchId) return null;
    const conn = connection || pool;

    try {
        // 1. Fetch match info
        const [matchRows] = await conn.execute(
            `SELECT m.id, m.match_no, m.match_type, m.overs, m.status, m.remarks, m.team_a_id, m.team_b_id,
                    ta.team_name AS team_a_name, tb.team_name AS team_b_name
             FROM cst_matches m
             LEFT JOIN cst_teams ta ON ta.id = m.team_a_id
             LEFT JOIN cst_teams tb ON tb.id = m.team_b_id
             WHERE m.id = ? LIMIT 1`,
            [matchId]
        );

        if (matchRows.length === 0) return null;
        const match = matchRows[0];
        if (String(match.status || "").toLowerCase() === "cancelled") {
            return { cancelled: true };
        }

        const matchOvers = match.overs ? Number(match.overs) : 20;
        const matchMaxBalls = matchOvers * 6;

        // 2. Fetch all innings for this match
        const [allInnings] = await conn.execute(
            `SELECT mi.*, bt.team_name AS batting_team_name, bw.team_name AS bowling_team_name
             FROM cst_match_innings mi
             LEFT JOIN cst_teams bt ON bt.id = mi.batting_team_id
             LEFT JOIN cst_teams bw ON bw.id = mi.bowling_team_id
             WHERE mi.match_id = ?
             ORDER BY mi.innings_no ASC`,
            [matchId]
        );

        let anyInningsUpdated = false;

        // 3. For each innings, inspect wickets and overs
        for (const inn of allInnings) {
            // Count dismissals in cst_match_scorecard
            const [batRows] = await conn.execute(
                `SELECT 
                    COUNT(*) AS total_batters,
                    COUNT(CASE WHEN dismissal_type NOT IN ('Not Out', 'Retired Hurt') THEN 1 END) AS dismissals_count,
                    COALESCE(SUM(runs), 0) AS total_bat_runs
                 FROM cst_match_scorecard
                 WHERE innings_id = ?`,
                [inn.id]
            );

            // Sum balls bowled in cst_match_bowling_scorecard
            const [bowlRows] = await conn.execute(
                `SELECT 
                    COALESCE(SUM(balls_bowled), 0) AS total_balls_bowled,
                    COALESCE(SUM(wickets), 0) AS total_bowl_wickets
                 FROM cst_match_bowling_scorecard
                 WHERE innings_id = ?`,
                [inn.id]
            );

            const dismissalsCount = Number(batRows[0]?.dismissals_count) || 0;
            const reportedWickets = Number(inn.total_wickets) || 0;
            const effectiveWickets = Math.max(reportedWickets, dismissalsCount);

            const ballsBowled = Number(bowlRows[0]?.total_balls_bowled) || 0;
            const reportedBalls = Number(inn.total_balls) || 0;
            const effectiveBalls = Math.max(reportedBalls, ballsBowled);

            const reportedOvers = Number(inn.total_overs) || 0;

            // Conditions for innings completion
            const is10Dismissals = effectiveWickets >= 10;
            const isOverLimit = effectiveBalls >= matchMaxBalls || (reportedOvers >= matchOvers && matchOvers > 0);
            const isTargetChased =
                inn.target_runs !== null &&
                inn.target_runs !== undefined &&
                Number(inn.target_runs) > 0 &&
                Number(inn.total_runs) >= Number(inn.target_runs);

            const shouldBeCompleted = is10Dismissals || isOverLimit || isTargetChased;

            if (shouldBeCompleted && inn.innings_status !== "Completed") {
                await conn.execute(
                    `UPDATE cst_match_innings
                     SET innings_status = 'Completed',
                         total_wickets = GREATEST(COALESCE(total_wickets, 0), ?),
                         updated_at = NOW()
                     WHERE id = ?`,
                    [effectiveWickets, inn.id]
                );
                inn.innings_status = "Completed";
                inn.total_wickets = effectiveWickets;
                anyInningsUpdated = true;
            }
        }

        // 4. Check if both innings are completed
        const completedInnings = allInnings.filter((i) => i.innings_status === "Completed");
        let matchResultText = null;
        let winnerTeamId = null;
        let matchCompleted = false;

        if (allInnings.length >= 2 && completedInnings.length >= 2) {
            const inn1 = allInnings.find((i) => Number(i.innings_no) === 1) || allInnings[0];
            const inn2 = allInnings.find((i) => Number(i.innings_no) === 2) || allInnings[1];

            const r1 = Number(inn1.total_runs) || 0;
            const w1 = Number(inn1.total_wickets) || 0;
            const r2 = Number(inn2.total_runs) || 0;
            const w2 = Number(inn2.total_wickets) || 0;

            const team1Name = inn1.batting_team_name || match.team_a_name || "Team 1";
            const team2Name = inn2.batting_team_name || match.team_b_name || "Team 2";

            if (r2 > r1) {
                const wRemaining = Math.max(1, 10 - w2);
                matchResultText = `${team2Name} won by ${wRemaining} ${wRemaining === 1 ? "wicket" : "wickets"}`;
                winnerTeamId = inn2.batting_team_id;
            } else if (r1 > r2) {
                const runDiff = r1 - r2;
                matchResultText = `${team1Name} won by ${runDiff} ${runDiff === 1 ? "run" : "runs"}`;
                winnerTeamId = inn1.batting_team_id;
            } else {
                matchResultText = "Match Tied";
                winnerTeamId = null;
            }

            // Update cst_matches status to Completed and remarks to matchResultText
            await conn.execute(
                `UPDATE cst_matches
                 SET status = 'Completed',
                     remarks = COALESCE(?, remarks),
                     updated_at = NOW()
                 WHERE id = ? AND status != 'Cancelled'`,
                [matchResultText, matchId]
            );
            matchCompleted = true;
        }

        return {
            matchId,
            anyInningsUpdated,
            matchCompleted,
            matchResultText,
            winnerTeamId,
            allInningsCompleted: allInnings.length >= 2 && completedInnings.length >= 2,
            innings: allInnings,
        };
    } catch (err) {
        console.error("checkAndUpdateInningsAndMatchCompletion Error:", err);
        return null;
    }
}
