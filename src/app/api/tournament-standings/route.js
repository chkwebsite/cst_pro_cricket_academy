import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";

// Helper: convert overs string / number (e.g. 19.4) to decimal overs (19 + 4/6)
function oversToDecimalOvers(overs, balls) {
    if (balls && Number(balls) > 0) {
        return Number(balls) / 6;
    }
    const oStr = String(overs || "0");
    if (!oStr.includes(".")) {
        return Number(oStr) || 0;
    }
    const [fullOvers, remainingBalls] = oStr.split(".").map(Number);
    return (fullOvers || 0) + (remainingBalls || 0) / 6;
}

export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);
        const tournamentIdParam = searchParams.get("tournament_id");
        const groupFilter = searchParams.get("group_name");

        if (!tournamentIdParam || isNaN(Number(tournamentIdParam))) {
            return NextResponse.json(
                { success: false, message: "Valid tournament_id parameter is required" },
                { status: 400 }
            );
        }

        const tournamentId = Number(tournamentIdParam);
        connection = await pool.getConnection();

        // 1. Fetch tournament details
        const [tournRows] = await connection.query(
            `SELECT t.id, t.tournament_name, t.tournament_code, t.tournament_type, t.overs,
                    t.status, t.category, t.age_group, t.start_date, t.end_date,
                    t.academy_id, a.academy_name, t.branch_id, b.branch_name
             FROM cst_tournaments t
             LEFT JOIN cst_academy a ON a.id = t.academy_id
             LEFT JOIN cst_branch b ON b.id = t.branch_id
             WHERE t.id = ? AND t.is_deleted = 0
             LIMIT 1`,
            [tournamentId]
        );

        if (!tournRows.length) {
            return NextResponse.json(
                { success: false, message: "Tournament not found" },
                { status: 404 }
            );
        }

        const tournament = tournRows[0];
        const matchMaxOvers = Number(tournament.overs) || 20;

        // 2. Fetch all registered teams in this tournament
        const [registeredTeams] = await connection.query(
            `SELECT tt.id AS registration_id, tt.tournament_id, tt.team_id,
                    COALESCE(NULLIF(TRIM(tt.group_name), ''), 'Group A') AS group_name,
                    tt.status AS registration_status,
                    tm.team_name, tm.team_code, tm.team_type, tm.category
             FROM cst_tournament_teams tt
             INNER JOIN cst_teams tm ON tm.id = tt.team_id
             WHERE tt.tournament_id = ? AND tt.is_deleted = 0 AND tm.is_deleted = 0
             ORDER BY tt.group_name ASC, tm.team_name ASC`,
            [tournamentId]
        );

        // 3. Fetch all matches of this tournament
        const [matches] = await connection.query(
            `SELECT tm.*,
                    ta.team_name AS team_a_name, tb.team_name AS team_b_name,
                    tw.team_name AS winner_team_name
             FROM cst_tournament_matches tm
             LEFT JOIN cst_teams ta ON ta.id = tm.team_a_id
             LEFT JOIN cst_teams tb ON tb.id = tm.team_b_id
             LEFT JOIN cst_teams tw ON tw.id = tm.winner_team_id
             WHERE tm.tournament_id = ?
             ORDER BY tm.match_no ASC`,
            [tournamentId]
        );

        // 4. Fetch innings for matches linked to cst_matches
        const linkedMatchIds = [...new Set(matches.map((m) => m.match_id).filter(Boolean))];
        let inningsMap = {};
        if (linkedMatchIds.length > 0) {
            const placeholders = linkedMatchIds.map(() => "?").join(",");
            const [inningsRows] = await connection.query(
                `SELECT mi.id, mi.match_id, mi.innings_no, mi.batting_team_id, mi.bowling_team_id,
                        mi.total_runs, mi.total_wickets, mi.total_overs, mi.total_balls, mi.innings_status
                 FROM cst_match_innings mi
                 WHERE mi.match_id IN (${placeholders})
                 ORDER BY mi.match_id ASC, mi.innings_no ASC`,
                linkedMatchIds
            );
            inningsRows.forEach((inn) => {
                if (!inningsMap[inn.match_id]) inningsMap[inn.match_id] = [];
                inningsMap[inn.match_id].push(inn);
            });
        }

        // 5. Initialize stats map for each team
        const statsMap = {};
        registeredTeams.forEach((rt) => {
            statsMap[rt.team_id] = {
                team_id: rt.team_id,
                team_name: rt.team_name,
                team_code: rt.team_code,
                group_name: rt.group_name || "Group A",
                played: 0,
                won: 0,
                lost: 0,
                tied: 0,
                no_result: 0,
                points: 0,
                runs_scored: 0,
                balls_faced: 0,
                runs_conceded: 0,
                balls_bowled: 0,
                form: [], // e.g. ['W', 'L', 'W']
            };
        });

        // 6. Process completed matches to calculate stats
        matches.forEach((m) => {
            const isCompleted = String(m.status).toLowerCase() === "completed";
            if (!isCompleted) return;

            const tA = m.team_a_id;
            const tB = m.team_b_id;
            if (!tA || !tB) return;

            // Ensure teams exist in stats map (even if registered later)
            if (!statsMap[tA]) {
                statsMap[tA] = {
                    team_id: tA,
                    team_name: m.team_a_name || `Team #${tA}`,
                    team_code: null,
                    group_name: m.group_name || "Group A",
                    played: 0, won: 0, lost: 0, tied: 0, no_result: 0, points: 0,
                    runs_scored: 0, balls_faced: 0, runs_conceded: 0, balls_bowled: 0, form: []
                };
            }
            if (!statsMap[tB]) {
                statsMap[tB] = {
                    team_id: tB,
                    team_name: m.team_b_name || `Team #${tB}`,
                    team_code: null,
                    group_name: m.group_name || "Group A",
                    played: 0, won: 0, lost: 0, tied: 0, no_result: 0, points: 0,
                    runs_scored: 0, balls_faced: 0, runs_conceded: 0, balls_bowled: 0, form: []
                };
            }

            statsMap[tA].played += 1;
            statsMap[tB].played += 1;

            const winnerId = m.winner_team_id ? Number(m.winner_team_id) : null;
            const resultSummary = String(m.result_summary || "").toLowerCase();
            const isTied = resultSummary.includes("tied") || (!winnerId && resultSummary.includes("tie"));
            const isNR = resultSummary.includes("no result") || resultSummary.includes("abandoned");

            if (isTied) {
                statsMap[tA].tied += 1;
                statsMap[tA].points += 1;
                statsMap[tA].form.push("T");

                statsMap[tB].tied += 1;
                statsMap[tB].points += 1;
                statsMap[tB].form.push("T");
            } else if (isNR) {
                statsMap[tA].no_result += 1;
                statsMap[tA].points += 1;
                statsMap[tA].form.push("NR");

                statsMap[tB].no_result += 1;
                statsMap[tB].points += 1;
                statsMap[tB].form.push("NR");
            } else if (winnerId) {
                if (winnerId === Number(tA)) {
                    statsMap[tA].won += 1;
                    statsMap[tA].points += 2;
                    statsMap[tA].form.push("W");

                    statsMap[tB].lost += 1;
                    statsMap[tB].form.push("L");
                } else if (winnerId === Number(tB)) {
                    statsMap[tB].won += 1;
                    statsMap[tB].points += 2;
                    statsMap[tB].form.push("W");

                    statsMap[tA].lost += 1;
                    statsMap[tA].form.push("L");
                }
            }

            // Runs and overs calculation for NRR (via linked innings or direct tournament match score)
            const matchInns = m.match_id ? (inningsMap[m.match_id] || []) : [];
            const innA = matchInns.find((i) => Number(i.batting_team_id) === Number(tA));
            const innB = matchInns.find((i) => Number(i.batting_team_id) === Number(tB));

            const matchOversLimit = Number(m.overs) || matchMaxOvers;
            const fullQuotaBalls = matchOversLimit * 6;

            const hasScoreA = innA || m.team_a_runs !== null;
            const hasScoreB = innB || m.team_b_runs !== null;

            if (hasScoreA) {
                const runsA = innA ? (Number(innA.total_runs) || 0) : (Number(m.team_a_runs) || 0);
                const wktsA = innA ? (Number(innA.total_wickets) || 0) : (Number(m.team_a_wickets) || 0);
                const ballsA = innA
                    ? (Number(innA.total_balls) || Math.round(oversToDecimalOvers(innA.total_overs) * 6))
                    : (m.team_a_overs ? Math.round(oversToDecimalOvers(m.team_a_overs) * 6) : fullQuotaBalls);

                // In cricket NRR: if all out (10 wickets), count full overs quota
                const effectiveBallsA = wktsA >= 10 ? fullQuotaBalls : Math.min(ballsA, fullQuotaBalls);

                statsMap[tA].runs_scored += runsA;
                statsMap[tA].balls_faced += effectiveBallsA;

                statsMap[tB].runs_conceded += runsA;
                statsMap[tB].balls_bowled += effectiveBallsA;
            }

            if (hasScoreB) {
                const runsB = innB ? (Number(innB.total_runs) || 0) : (Number(m.team_b_runs) || 0);
                const wktsB = innB ? (Number(innB.total_wickets) || 0) : (Number(m.team_b_wickets) || 0);
                const ballsB = innB
                    ? (Number(innB.total_balls) || Math.round(oversToDecimalOvers(innB.total_overs) * 6))
                    : (m.team_b_overs ? Math.round(oversToDecimalOvers(m.team_b_overs) * 6) : fullQuotaBalls);

                const effectiveBallsB = wktsB >= 10 ? fullQuotaBalls : Math.min(ballsB, fullQuotaBalls);

                statsMap[tB].runs_scored += runsB;
                statsMap[tB].balls_faced += effectiveBallsB;

                statsMap[tA].runs_conceded += runsB;
                statsMap[tA].balls_bowled += effectiveBallsB;
            }
        });

        // 7. Calculate NRR and format fields
        const standingsList = Object.values(statsMap).map((item) => {
            const oversFacedDec = item.balls_faced / 6;
            const oversBowledDec = item.balls_bowled / 6;

            const runRateFor = oversFacedDec > 0 ? item.runs_scored / oversFacedDec : 0;
            const runRateAgainst = oversBowledDec > 0 ? item.runs_conceded / oversBowledDec : 0;
            const nrrVal = runRateFor - runRateAgainst;

            const nrrFormatted = nrrVal >= 0 ? `+${nrrVal.toFixed(3)}` : nrrVal.toFixed(3);

            const oversForFormatted = `${Math.floor(item.balls_faced / 6)}.${item.balls_faced % 6}`;
            const oversAgainstFormatted = `${Math.floor(item.balls_bowled / 6)}.${item.balls_bowled % 6}`;

            return {
                ...item,
                net_run_rate: Number(nrrVal.toFixed(3)),
                net_run_rate_formatted: nrrFormatted,
                runs_for: item.runs_scored,
                overs_for: oversForFormatted,
                runs_against: item.runs_conceded,
                overs_against: oversAgainstFormatted,
                recent_form: item.form.slice(-5), // last 5
            };
        });

        // 8. Upsert into cst_tournament_standings table for persistence
        for (const s of standingsList) {
            try {
                await connection.query(
                    `INSERT INTO cst_tournament_standings (
                        tournament_id, team_id, group_name, played, won, lost, tied, no_result,
                        points, net_run_rate, runs_for, overs_for, runs_against, overs_against
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        group_name = VALUES(group_name),
                        played = VALUES(played),
                        won = VALUES(won),
                        lost = VALUES(lost),
                        tied = VALUES(tied),
                        no_result = VALUES(no_result),
                        points = VALUES(points),
                        net_run_rate = VALUES(net_run_rate),
                        runs_for = VALUES(runs_for),
                        overs_for = VALUES(overs_for),
                        runs_against = VALUES(runs_against),
                        overs_against = VALUES(overs_against),
                        updated_at = NOW()`,
                    [
                        tournamentId,
                        s.team_id,
                        s.group_name,
                        s.played,
                        s.won,
                        s.lost,
                        s.tied,
                        s.no_result,
                        s.points,
                        s.net_run_rate,
                        s.runs_for,
                        parseFloat(s.overs_for) || 0,
                        s.runs_against,
                        parseFloat(s.overs_against) || 0,
                    ]
                );
            } catch (errUpsert) {
                // Ignore upsert errors in read call
            }
        }

        // 9. Group standings by group_name
        const groups = {};
        standingsList.forEach((team) => {
            const grp = team.group_name || "Group A";
            if (!groups[grp]) groups[grp] = [];
            groups[grp].push(team);
        });

        // Sort within each group: Points DESC, NRR DESC, Won DESC, Team Name ASC
        const sortComparator = (a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.net_run_rate !== a.net_run_rate) return b.net_run_rate - a.net_run_rate;
            if (b.won !== a.won) return b.won - a.won;
            return a.team_name.localeCompare(b.team_name);
        };

        Object.keys(groups).forEach((grp) => {
            groups[grp].sort(sortComparator);
            groups[grp].forEach((t, idx) => {
                t.group_rank = idx + 1;
            });
        });

        // Overall sorted list
        const overallStandings = [...standingsList].sort(sortComparator);
        overallStandings.forEach((t, idx) => {
            t.rank = idx + 1;
        });

        // If filter applied
        let filteredStandings = overallStandings;
        if (groupFilter) {
            filteredStandings = overallStandings.filter((t) => t.group_name === groupFilter);
        }

        return NextResponse.json({
            success: true,
            tournament: {
                id: tournament.id,
                name: tournament.tournament_name,
                code: tournament.tournament_code,
                type: tournament.tournament_type,
                overs: tournament.overs,
                status: tournament.status,
                academy_name: tournament.academy_name,
                branch_name: tournament.branch_name,
            },
            total_teams: standingsList.length,
            groups,
            group_names: Object.keys(groups).sort(),
            standings: filteredStandings,
            overall_standings: overallStandings,
        });
    } catch (error) {
        console.error("GET TOURNAMENT STANDINGS ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch tournament standings", error: error.message },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
