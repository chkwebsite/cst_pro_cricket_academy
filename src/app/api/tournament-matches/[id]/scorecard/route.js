import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";
import { validateMatchDateForScoring } from "@/app/components/lib/match-date-validator";

/*
|--------------------------------------------------------------------------
| POST /api/tournament-matches/[id]/scorecard
| Initialize or open full player scorecard center for a tournament match.
| Auto-creates linked cst_matches row, imports registered tournament players
| into cst_match_players, and initializes Innings 1 & 2.
|--------------------------------------------------------------------------
*/

export async function POST(request, { params }) {
    let connection;

    try {
        const { id } = await params;
        const tournamentMatchId = Number(id);

        if (!Number.isInteger(tournamentMatchId) || tournamentMatchId <= 0) {
            return NextResponse.json(
                { success: false, message: "Invalid tournament match ID" },
                { status: 400 }
            );
        }

        const { user: authUser } = await getAuthenticatedUser(request);
        connection = await pool.getConnection();

        // 1. Fetch tournament match
        const [tmRows] = await connection.query(
            `SELECT 
                tm.*,
                t.tournament_name,
                t.academy_id,
                t.branch_id,
                ta.team_name AS team_a_name,
                tb.team_name AS team_b_name
             FROM cst_tournament_matches tm
             INNER JOIN cst_tournaments t ON t.id = tm.tournament_id
             LEFT JOIN cst_teams ta ON ta.id = tm.team_a_id
             LEFT JOIN cst_teams tb ON tb.id = tm.team_b_id
             WHERE tm.id = ?
             LIMIT 1`,
            [tournamentMatchId]
        );

        if (!tmRows.length) {
            return NextResponse.json(
                { success: false, message: "Tournament match fixture not found" },
                { status: 404 }
            );
        }

        const tm = tmRows[0];

        if (!tm.team_a_id || !tm.team_b_id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Please assign both Team A and Team B to this fixture before recording player scorecards.",
                },
                { status: 400 }
            );
        }

        // Rule: Match scorecard and innings cannot be created before match date
        const dateCheck = validateMatchDateForScoring(tm.scheduled_date, "Tournament scorecard and innings");
        if (!dateCheck.allowed) {
            return NextResponse.json(
                {
                    success: false,
                    message: dateCheck.message,
                },
                { status: 400 }
            );
        }

        // Authorization check
        if (authUser && !authUser.isSuperAdmin) {
            if (authUser.academy_id && Number(tm.academy_id) !== Number(authUser.academy_id)) {
                return NextResponse.json(
                    { success: false, message: "Tournament belongs to another academy" },
                    { status: 403 }
                );
            }
        }

        let matchId = tm.match_id ? Number(tm.match_id) : null;

        // 2. Check if linked match already exists in cst_matches
        if (matchId) {
            const [mCheck] = await connection.query(
                `SELECT id FROM cst_matches WHERE id = ? LIMIT 1`,
                [matchId]
            );
            if (!mCheck.length) {
                matchId = null; // Re-create if orphaned
            }
        }

        // 3. Create match in cst_matches if not linked
        if (!matchId) {
            const todayStr = new Date().toISOString().slice(0, 10);
            const mDate = tm.scheduled_date ? String(tm.scheduled_date).slice(0, 10) : todayStr;
            const mTime = tm.scheduled_time ? String(tm.scheduled_time).slice(0, 8) : null;
            const matchOvers = tm.overs && Number(tm.overs) > 0 ? Number(tm.overs) : 20;
            const matchNo = `TM-${tm.tournament_id}-${tm.match_no}`;

            const [mResult] = await connection.query(
                `INSERT INTO cst_matches (
                    academy_id,
                    branch_id,
                    tournament_id,
                    team_a_id,
                    team_b_id,
                    match_no,
                    match_type,
                    overs,
                    match_fee,
                    match_date,
                    match_time,
                    ground_id,
                    booking_id,
                    status,
                    remarks,
                    created_by
                ) VALUES (?, ?, ?, ?, ?, ?, 'Tournament', ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    tm.academy_id || null,
                    tm.branch_id || null,
                    tm.tournament_id,
                    Number(tm.team_a_id),
                    Number(tm.team_b_id),
                    matchNo,
                    matchOvers,
                    mDate,
                    mTime,
                    tm.ground_id ? Number(tm.ground_id) : null,
                    tm.booking_id ? Number(tm.booking_id) : null,
                    tm.status === "Completed" ? "Completed" : "Live",
                    `Tournament Fixture Match ${tm.match_no}`,
                    authUser?.id || null,
                ]
            );

            matchId = mResult.insertId;

            // Link tournament match to this cst_matches entry
            await connection.query(
                `UPDATE cst_tournament_matches SET match_id = ? WHERE id = ?`,
                [matchId, tournamentMatchId]
            );
        }

        // 4. Import / Sync tournament team players into cst_match_players
        const [registeredPlayers] = await connection.query(
            `SELECT 
                ttp.id AS tournament_team_player_id,
                ttp.tournament_team_id,
                ttp.team_id,
                ttp.user_id,
                ttp.outside_player_id,
                ttp.jersey_no,
                ttp.player_role
             FROM cst_tournament_team_players ttp
             WHERE ttp.team_id IN (?, ?)
               AND (ttp.tournament_id = ? OR ttp.tournament_team_id IN (
                   SELECT id FROM cst_tournament_teams WHERE tournament_id = ?
               ))
               AND ttp.is_deleted = 0`,
            [Number(tm.team_a_id), Number(tm.team_b_id), tm.tournament_id, tm.tournament_id]
        );

        let importedPlayersCount = 0;
        for (const p of registeredPlayers) {
            // Check if already in match squad
            const [exists] = await connection.query(
                `SELECT id FROM cst_match_players 
                 WHERE match_id = ? 
                   AND (
                       (? IS NOT NULL AND user_id = ?)
                       OR (? IS NOT NULL AND outside_player_id = ?)
                       OR tournament_team_player_id = ?
                   )
                 LIMIT 1`,
                [
                    matchId,
                    p.user_id || null,
                    p.user_id || null,
                    p.outside_player_id || null,
                    p.outside_player_id || null,
                    p.tournament_team_player_id,
                ]
            );

            if (!exists.length) {
                const isCaptain = String(p.player_role || "").toLowerCase().includes("captain") &&
                    !String(p.player_role || "").toLowerCase().includes("vice");
                const isViceCaptain = String(p.player_role || "").toLowerCase().includes("vice");
                const isKeeper = String(p.player_role || "").toLowerCase().includes("keeper");

                await connection.query(
                    `INSERT INTO cst_match_players (
                        match_id,
                        team_id,
                        user_id,
                        outside_player_id,
                        tournament_team_player_id,
                        jersey_no,
                        playing_11,
                        substitute,
                        captain,
                        vice_captain,
                        wicket_keeper,
                        status,
                        player_fee,
                        paid_amount,
                        payment_status
                    ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, 1, 0, 0, 'Paid')`,
                    [
                        matchId,
                        Number(p.team_id),
                        p.user_id ? Number(p.user_id) : null,
                        p.outside_player_id ? Number(p.outside_player_id) : null,
                        p.tournament_team_player_id,
                        p.jersey_no || null,
                        isCaptain ? 1 : 0,
                        isViceCaptain ? 1 : 0,
                        isKeeper ? 1 : 0,
                    ]
                );
                importedPlayersCount++;
            }
        }

        // 5. Ensure Innings 1 and Innings 2 exist in cst_match_innings
        const [existingInnings] = await connection.query(
            `SELECT id, innings_no FROM cst_match_innings WHERE match_id = ? ORDER BY innings_no ASC`,
            [matchId]
        );

        if (existingInnings.length === 0) {
            // Create Innings 1: Team A batting, Team B bowling
            await connection.query(
                `INSERT INTO cst_match_innings (
                    match_id,
                    innings_no,
                    batting_team_id,
                    bowling_team_id,
                    total_runs,
                    total_wickets,
                    total_overs,
                    total_balls,
                    extras,
                    wides,
                    no_balls,
                    byes,
                    leg_byes,
                    penalty_runs,
                    target_runs,
                    innings_status
                ) VALUES (?, 1, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, NULL, ?)`,
                [
                    matchId,
                    Number(tm.team_a_id),
                    Number(tm.team_b_id),
                    tm.team_a_runs ? Number(tm.team_a_runs) : 0,
                    tm.team_a_wickets ? Number(tm.team_a_wickets) : 0,
                    tm.team_a_overs ? String(tm.team_a_overs) : "0.0",
                    tm.status === "Completed" ? "completed" : "in_progress",
                ]
            );

            // Create Innings 2: Team B batting, Team A bowling
            await connection.query(
                `INSERT INTO cst_match_innings (
                    match_id,
                    innings_no,
                    batting_team_id,
                    bowling_team_id,
                    total_runs,
                    total_wickets,
                    total_overs,
                    total_balls,
                    extras,
                    wides,
                    no_balls,
                    byes,
                    leg_byes,
                    penalty_runs,
                    target_runs,
                    innings_status
                ) VALUES (?, 2, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, NULL, ?)`,
                [
                    matchId,
                    Number(tm.team_b_id),
                    Number(tm.team_a_id),
                    tm.team_b_runs ? Number(tm.team_b_runs) : 0,
                    tm.team_b_wickets ? Number(tm.team_b_wickets) : 0,
                    tm.team_b_overs ? String(tm.team_b_overs) : "0.0",
                    tm.status === "Completed" ? "completed" : "scheduled",
                ]
            );
        }

        return NextResponse.json({
            success: true,
            message: "Tournament scorecard initialized successfully with squad players and innings.",
            match_id: matchId,
            imported_players: importedPlayersCount,
            redirect_url: `/next_panel/match-scorecard/center?match_id=${matchId}`,
        });
    } catch (error) {
        console.error("POST TOURNAMENT MATCH SCORECARD ERROR:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to initialize tournament scorecard",
                error: error.message,
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
