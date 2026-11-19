import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";

export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);
        const tournamentId = searchParams.get("tournament_id");
        const roundType = searchParams.get("round_type");
        const groupName = searchParams.get("group_name");
        const winnerTeamId = searchParams.get("winner_team_id");
        const status = searchParams.get("status");

        if (!tournamentId || isNaN(Number(tournamentId))) {
            return NextResponse.json(
                { success: false, message: "Valid tournament_id parameter is required" },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        // 1. Fetch tournament details
        const [tournRows] = await connection.query(
            `SELECT t.id, t.tournament_name, t.tournament_code, t.tournament_type, t.overs,
                    t.status, t.academy_id, a.academy_name, t.branch_id, b.branch_name
             FROM cst_tournaments t
             LEFT JOIN cst_academy a ON a.id = t.academy_id
             LEFT JOIN cst_branch b ON b.id = t.branch_id
             WHERE t.id = ? AND t.is_deleted = 0
             LIMIT 1`,
            [Number(tournamentId)]
        );

        if (!tournRows.length) {
            return NextResponse.json(
                { success: false, message: "Tournament not found" },
                { status: 404 }
            );
        }

        const tournament = tournRows[0];

        // 2. Build matches query
        const conditions = ["tm.tournament_id = ?"];
        const params = [Number(tournamentId)];

        if (roundType) {
            conditions.push("tm.round_type = ?");
            params.push(roundType);
        }
        if (groupName) {
            conditions.push("tm.group_name = ?");
            params.push(groupName);
        }
        if (winnerTeamId) {
            conditions.push("tm.winner_team_id = ?");
            params.push(Number(winnerTeamId));
        }
        if (status) {
            conditions.push("tm.status = ?");
            params.push(status);
        }

        const [matches] = await connection.query(
            `SELECT tm.*,
                    ta.team_name AS team_a_name, ta.team_code AS team_a_code,
                    tb.team_name AS team_b_name, tb.team_code AS team_b_code,
                    tw.team_name AS winner_team_name, tw.team_code AS winner_team_code,
                    g.ground_name, g.ground_code,
                    CONCAT_WS(' ', motm.first_name, motm.last_name) AS man_of_the_match_name,
                    ma.remarks AS match_remarks
             FROM cst_tournament_matches tm
             LEFT JOIN cst_teams ta ON ta.id = tm.team_a_id
             LEFT JOIN cst_teams tb ON tb.id = tm.team_b_id
             LEFT JOIN cst_teams tw ON tw.id = tm.winner_team_id
             LEFT JOIN cst_ground g ON g.id = tm.ground_id
             LEFT JOIN cst_users motm ON motm.id = tm.man_of_the_match_id
             LEFT JOIN cst_matches ma ON ma.id = tm.match_id
             WHERE ${conditions.join(" AND ")}
             ORDER BY
                 tm.scheduled_date DESC,
                 tm.match_no DESC`,
            params
        );

        // 3. Fetch innings for linked matches
        const linkedMatchIds = [...new Set(matches.map((m) => m.match_id).filter(Boolean))];
        let inningsMap = {};
        if (linkedMatchIds.length > 0) {
            const placeholders = linkedMatchIds.map(() => "?").join(",");
            const [inningsRows] = await connection.query(
                `SELECT mi.id, mi.match_id, mi.innings_no, mi.batting_team_id, mi.bowling_team_id,
                        mi.total_runs, mi.total_wickets, mi.total_overs, mi.innings_status,
                        bt.team_name AS batting_team_name
                 FROM cst_match_innings mi
                 LEFT JOIN cst_teams bt ON bt.id = mi.batting_team_id
                 WHERE mi.match_id IN (${placeholders})
                 ORDER BY mi.match_id ASC, mi.innings_no ASC`,
                linkedMatchIds
            );
            inningsRows.forEach((inn) => {
                if (!inningsMap[inn.match_id]) inningsMap[inn.match_id] = [];
                inningsMap[inn.match_id].push(inn);
            });
        }

        // 4. Calculate win stats & enrich each match
        const winTally = {};
        let totalCompleted = 0;
        let totalScheduled = 0;
        let totalLive = 0;

        const enrichedMatches = matches.map((m) => {
            const isCompleted = String(m.status).toLowerCase() === "completed";
            const isLive = String(m.status).toLowerCase() === "live";
            if (isCompleted) totalCompleted++;
            else if (isLive) totalLive++;
            else totalScheduled++;

            const matchInns = m.match_id ? (inningsMap[m.match_id] || []) : [];
            const innA = matchInns.find((i) => Number(i.batting_team_id) === Number(m.team_a_id));
            const innB = matchInns.find((i) => Number(i.batting_team_id) === Number(m.team_b_id));

            // Win count tracking
            if (isCompleted && m.winner_team_id && m.winner_team_name) {
                if (!winTally[m.winner_team_id]) {
                    winTally[m.winner_team_id] = {
                        team_id: m.winner_team_id,
                        team_name: m.winner_team_name,
                        team_code: m.winner_team_code,
                        wins: 0,
                    };
                }
                winTally[m.winner_team_id].wins += 1;
            }

            // Clean winning outcome message
            let outcomeText = m.result_summary || m.match_remarks || null;
            if (!outcomeText && isCompleted && m.winner_team_name) {
                outcomeText = m.win_margin ? `${m.winner_team_name} won ${m.win_margin}` : `${m.winner_team_name} won`;
            }

            return {
                ...m,
                innings: matchInns,
                team_a_score: innA ? `${innA.total_runs}/${innA.total_wickets} (${innA.total_overs} ov)` : null,
                team_b_score: innB ? `${innB.total_runs}/${innB.total_wickets} (${innB.total_overs} ov)` : null,
                outcome_text: outcomeText,
            };
        });

        // Top winning teams
        const topWinners = Object.values(winTally).sort((a, b) => b.wins - a.wins);

        return NextResponse.json({
            success: true,
            tournament: {
                id: tournament.id,
                name: tournament.tournament_name,
                code: tournament.tournament_code,
                type: tournament.tournament_type,
                status: tournament.status,
            },
            summary: {
                total_matches: matches.length,
                completed_matches: totalCompleted,
                live_matches: totalLive,
                scheduled_matches: totalScheduled,
                top_winning_team: topWinners[0] || null,
            },
            win_leaderboard: topWinners,
            matches: enrichedMatches,
        });
    } catch (error) {
        console.error("GET TOURNAMENT RESULTS ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch tournament results", error: error.message },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
