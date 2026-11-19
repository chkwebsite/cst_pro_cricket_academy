import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";

/*
|--------------------------------------------------------------------------
| POST /api/matches/[id]/sync-tournament-squad
| Syncs registered players from cst_tournament_team_players into cst_match_players
| for both Team A and Team B of a tournament match.
|--------------------------------------------------------------------------
*/

export async function POST(request, { params }) {
    let connection;

    try {
        const { id } = await params;
        const matchId = Number(id);

        if (!Number.isInteger(matchId) || matchId <= 0) {
            return NextResponse.json(
                { success: false, message: "Invalid match ID" },
                { status: 400 }
            );
        }

        const { user: authUser } = await getAuthenticatedUser(request);
        connection = await pool.getConnection();

        // 1. Fetch match
        const [mRows] = await connection.query(
            `SELECT id, tournament_id, team_a_id, team_b_id, academy_id FROM cst_matches WHERE id = ? LIMIT 1`,
            [matchId]
        );

        if (!mRows.length) {
            return NextResponse.json(
                { success: false, message: "Match not found" },
                { status: 404 }
            );
        }

        const m = mRows[0];

        if (!m.tournament_id) {
            return NextResponse.json(
                { success: false, message: "This match is not associated with a tournament" },
                { status: 400 }
            );
        }

        // 2. Fetch tournament squad players for both teams
        const [tournamentPlayers] = await connection.query(
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
            [Number(m.team_a_id), Number(m.team_b_id), m.tournament_id, m.tournament_id]
        );

        let count = 0;
        for (const p of tournamentPlayers) {
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
                count++;
            }
        }

        return NextResponse.json({
            success: true,
            message: count > 0 ? `Successfully imported ${count} tournament player(s) into match squad.` : "All tournament squad players are already added to this match.",
            imported_count: count,
        });
    } catch (error) {
        console.error("SYNC TOURNAMENT SQUAD ERROR:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to sync tournament squad",
                error: error.message,
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
