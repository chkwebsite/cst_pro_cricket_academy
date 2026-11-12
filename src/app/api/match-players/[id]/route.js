import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


const isPositiveInt = (value) => {
    return Number.isInteger(Number(value)) && Number(value) > 0;
};

const toBoolean = (value) => {
    return value === true || value === 1 || value === "1";
};

async function getParams(context) {
    return await context.params;
}

// GET /api/match-players/10
export async function GET(request, context) {
    let connection;

    try {
        const { id } = await getParams(context);

        if (!isPositiveInt(id)) {
            return NextResponse.json(
                { success: false, message: "Invalid player record ID." },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            `SELECT
                mp.*,
                m.match_no,
                m.match_type,
                m.match_date,
                m.tournament_id,
                t.team_name,
                t.team_code,
                COALESCE(u.first_name, ttpu.first_name) AS first_name,
                COALESCE(u.last_name, ttpu.last_name) AS last_name,
                COALESCE(op.player_name, ttpop.player_name) AS outside_player_name
             FROM cst_match_players mp
             INNER JOIN cst_matches m ON m.id = mp.match_id
             INNER JOIN cst_teams t ON t.id = mp.team_id
             LEFT JOIN cst_users u ON u.id = mp.user_id
             LEFT JOIN cst_outside_players op ON op.id = mp.outside_player_id
             LEFT JOIN cst_tournament_team_players ttp ON ttp.id = mp.tournament_team_player_id
             LEFT JOIN cst_users ttpu ON ttpu.id = ttp.user_id
             LEFT JOIN cst_outside_players ttpop ON ttpop.id = ttp.outside_player_id
             WHERE mp.id = ?
             LIMIT 1`,
            [Number(id)]
        );

        if (!rows.length) {
            return NextResponse.json(
                { success: false, message: "Match player not found." },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("GET single match player error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch match player." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// PUT /api/match-players/10
export async function PUT(request, context) {
    let connection;

    try {
        const { id } = await getParams(context);

        if (!isPositiveInt(id)) {
            return NextResponse.json(
                { success: false, message: "Invalid player record ID." },
                { status: 400 }
            );
        }

        const body = await request.json();

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [existingRows] = await connection.execute(
            `SELECT *
             FROM cst_match_players
             WHERE id = ?
             FOR UPDATE`,
            [Number(id)]
        );

        if (!existingRows.length) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Match player not found." },
                { status: 404 }
            );
        }

        const old = existingRows[0];
        const playerFee = body.player_fee === undefined
            ? Number(old.player_fee || 0)
            : Number(body.player_fee);

        if (!Number.isFinite(playerFee) || playerFee < 0) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "player_fee must be zero or greater." },
                { status: 400 }
            );
        }

        const matchId =
            body.match_id === undefined
                ? Number(old.match_id)
                : Number(body.match_id);

        const teamId =
            body.team_id === undefined
                ? Number(old.team_id)
                : Number(body.team_id);

        if (!isPositiveInt(matchId) || !isPositiveInt(teamId)) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Valid match_id and team_id are required.",
                },
                { status: 400 }
            );
        }

        const playerFields = [
            "user_id",
            "outside_player_id",
            "tournament_team_player_id",
        ];

        const suppliedPlayerFields = playerFields.filter(
            (field) => Object.prototype.hasOwnProperty.call(body, field)
        );

        let player = {
            user_id: old.user_id === null ? null : Number(old.user_id),
            outside_player_id:
                old.outside_player_id === null
                    ? null
                    : Number(old.outside_player_id),
            tournament_team_player_id:
                old.tournament_team_player_id === null
                    ? null
                    : Number(old.tournament_team_player_id),
        };

        if (suppliedPlayerFields.length > 0) {
            const candidate = {
                user_id: body.user_id,
                outside_player_id: body.outside_player_id,
                tournament_team_player_id: body.tournament_team_player_id,
            };

            for (const field of playerFields) {
                if (!Object.prototype.hasOwnProperty.call(body, field)) {
                    candidate[field] = null;
                }
            }

            const reference = [
                candidate.user_id,
                candidate.outside_player_id,
                candidate.tournament_team_player_id,
            ].filter(
                (value) =>
                    value !== undefined &&
                    value !== null &&
                    value !== ""
            );

            if (reference.length !== 1) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Provide exactly one player reference when changing the player.",
                    },
                    { status: 400 }
                );
            }

            const value = Number(reference[0]);

            if (!isPositiveInt(value)) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message: "Player ID must be a positive integer.",
                    },
                    { status: 400 }
                );
            }

            player = {
                user_id:
                    candidate.user_id !== undefined &&
                        candidate.user_id !== null &&
                        candidate.user_id !== ""
                        ? Number(candidate.user_id)
                        : null,
                outside_player_id:
                    candidate.outside_player_id !== undefined &&
                        candidate.outside_player_id !== null &&
                        candidate.outside_player_id !== ""
                        ? Number(candidate.outside_player_id)
                        : null,
                tournament_team_player_id:
                    candidate.tournament_team_player_id !== undefined &&
                        candidate.tournament_team_player_id !== null &&
                        candidate.tournament_team_player_id !== ""
                        ? Number(candidate.tournament_team_player_id)
                        : null,
            };
        }

        const match = await connection.execute(
            `SELECT id, team_a_id, team_b_id, tournament_id, academy_id, branch_id
             FROM cst_matches
             WHERE id = ?
             LIMIT 1`,
            [matchId]
        );

        if (!match[0].length) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Match not found." },
                { status: 404 }
            );
        }

        if (
            Number(match[0][0].team_a_id) !== teamId &&
            Number(match[0][0].team_b_id) !== teamId
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Selected team does not belong to this match.",
                },
                { status: 400 }
            );
        }

        const selection = {
            playing_11:
                body.playing_11 === undefined
                    ? Number(old.playing_11)
                    : toBoolean(body.playing_11)
                        ? 1
                        : 0,
            substitute:
                body.substitute === undefined
                    ? Number(old.substitute)
                    : toBoolean(body.substitute)
                        ? 1
                        : 0,
            captain:
                body.captain === undefined
                    ? Number(old.captain)
                    : toBoolean(body.captain)
                        ? 1
                        : 0,
            vice_captain:
                body.vice_captain === undefined
                    ? Number(old.vice_captain)
                    : toBoolean(body.vice_captain)
                        ? 1
                        : 0,
            wicket_keeper:
                body.wicket_keeper === undefined
                    ? Number(old.wicket_keeper)
                    : toBoolean(body.wicket_keeper)
                        ? 1
                        : 0,
            jersey_no:
                body.jersey_no === undefined
                    ? old.jersey_no
                    : body.jersey_no
                        ? String(body.jersey_no).trim()
                        : null,
            status:
                body.status === undefined
                    ? Number(old.status)
                    : Number(body.status),
        };

        if (![0, 1].includes(selection.status)) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "status must be 0 or 1." },
                { status: 400 }
            );
        }

        if (
            selection.captain &&
            selection.vice_captain
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "A player cannot be both captain and vice-captain.",
                },
                { status: 400 }
            );
        }

        if (
            (selection.captain ||
                selection.vice_captain ||
                selection.wicket_keeper) &&
            !selection.playing_11
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Captain, vice-captain and wicket-keeper must be in playing_11.",
                },
                { status: 400 }
            );
        }

        if (selection.playing_11 && selection.substitute) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "A player cannot be in playing_11 and substitute at the same time.",
                },
                { status: 400 }
            );
        }

        // Validate the new player reference.
        if (
            player.user_id !== null &&
            player.outside_player_id !== null ||
            player.user_id !== null &&
            player.tournament_team_player_id !== null ||
            player.outside_player_id !== null &&
            player.tournament_team_player_id !== null
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Only one player reference is allowed.",
                },
                { status: 400 }
            );
        }

        if (player.user_id !== null) {
            const [users] = await connection.execute(
                "SELECT id FROM cst_users WHERE id = ? LIMIT 1",
                [player.user_id]
            );

            if (!users.length) {
                await connection.rollback();

                return NextResponse.json(
                    { success: false, message: "Registered user not found." },
                    { status: 404 }
                );
            }
        }

        if (player.outside_player_id !== null) {
            const [outsidePlayers] = await connection.execute(
                "SELECT id FROM cst_outside_players WHERE id = ? LIMIT 1",
                [player.outside_player_id]
            );

            if (!outsidePlayers.length) {
                await connection.rollback();

                return NextResponse.json(
                    { success: false, message: "Outside player not found." },
                    { status: 404 }
                );
            }
        }

        if (player.tournament_team_player_id !== null) {
            const [tournamentPlayers] = await connection.execute(
                `SELECT id, team_id
                 FROM cst_tournament_team_players
                 WHERE id = ?
                 LIMIT 1`,
                [player.tournament_team_player_id]
            );

            if (
                !tournamentPlayers.length ||
                Number(tournamentPlayers[0].team_id) !== teamId
            ) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Tournament player not found for the selected team.",
                    },
                    { status: 400 }
                );
            }

            if (!match[0][0].tournament_id) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Tournament player can only be selected for a tournament match.",
                    },
                    { status: 400 }
                );
            }

            const [tournamentTeams] = await connection.execute(
                `SELECT id
                 FROM cst_tournament_teams
                 WHERE tournament_id = ?
                   AND team_id = ?
                 LIMIT 1`,
                [match[0][0].tournament_id, teamId]
            );

            if (!tournamentTeams.length) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Selected team is not registered in this tournament.",
                    },
                    { status: 400 }
                );
            }
        }

        // Prevent duplicate selection, excluding this record.
        let resolvedUserId = player.user_id;
        let resolvedOutsideId = player.outside_player_id;
        if (player.tournament_team_player_id !== null) {
            const [ttpRows] = await connection.execute(
                `SELECT user_id, outside_player_id FROM cst_tournament_team_players WHERE id = ? LIMIT 1`,
                [player.tournament_team_player_id]
            );
            if (ttpRows.length) {
                if (!resolvedUserId) resolvedUserId = ttpRows[0].user_id || null;
                if (!resolvedOutsideId) resolvedOutsideId = ttpRows[0].outside_player_id || null;
            }
        }

        const [duplicate] = await connection.execute(
            `SELECT 
                mp.id, 
                mp.team_id, 
                t.team_name
             FROM cst_match_players mp
             LEFT JOIN cst_teams t ON t.id = mp.team_id
             LEFT JOIN cst_tournament_team_players ttp ON ttp.id = mp.tournament_team_player_id
             WHERE mp.match_id = ?
               AND mp.id <> ?
               AND (
                   (? IS NOT NULL AND (mp.user_id = ? OR ttp.user_id = ?))
                   OR
                   (? IS NOT NULL AND (mp.outside_player_id = ? OR ttp.outside_player_id = ?))
                   OR
                   (? IS NOT NULL AND mp.tournament_team_player_id = ?)
               )
             LIMIT 1`,
            [
                matchId,
                Number(id),
                resolvedUserId, resolvedUserId, resolvedUserId,
                resolvedOutsideId, resolvedOutsideId, resolvedOutsideId,
                player.tournament_team_player_id, player.tournament_team_player_id,
            ]
        );

        if (duplicate.length) {
            await connection.rollback();
            const existingTeam = duplicate[0].team_name || "another team";

            return NextResponse.json(
                {
                    success: false,
                    message: `all ready play this match (Player is already playing this match under team "${existingTeam}")`,
                },
                { status: 409 }
            );
        }

        const [feeRows] = await connection.execute(
            `SELECT id, paid_amount, status
             FROM cst_fee_status
             WHERE match_player_id = ?
             LIMIT 1
             FOR UPDATE`,
            [Number(id)]
        );
        const paidAmount = feeRows.length
            ? Number(feeRows[0].paid_amount)
            : Number(old.paid_amount || 0);

        if (playerFee < paidAmount) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "player_fee cannot be less than the amount already paid." },
                { status: 400 }
            );
        }

        if (selection.playing_11 && selection.status === 1) {
            const [countRows] = await connection.execute(
                `SELECT COUNT(*) AS total
                 FROM cst_match_players
                 WHERE match_id = ?
                   AND team_id = ?
                   AND playing_11 = 1
                   AND status = 1
                   AND id <> ?`,
                [matchId, teamId, Number(id)]
            );

            if (Number(countRows[0].total) >= 11) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "This team already has 11 players in the playing eleven.",
                    },
                    { status: 400 }
                );
            }
        }

        for (const role of ["captain", "vice_captain"]) {
            if (selection[role] && selection.status === 1) {
                const [existing] = await connection.execute(
                    `SELECT id
                     FROM cst_match_players
                     WHERE match_id = ?
                       AND team_id = ?
                       AND ${role} = 1
                       AND status = 1
                       AND id <> ?
                     LIMIT 1`,
                    [matchId, teamId, Number(id)]
                );

                if (existing.length) {
                    await connection.rollback();

                    return NextResponse.json(
                        {
                            success: false,
                            message: `This team already has a ${role.replace("_", " ")}.`,
                        },
                        { status: 409 }
                    );
                }
            }
        }

        await connection.execute(
            `UPDATE cst_match_players
             SET match_id = ?,
                 team_id = ?,
                 user_id = ?,
                 outside_player_id = ?,
                 tournament_team_player_id = ?,
                 jersey_no = ?,
                 player_fee = ?,
                 paid_amount = ?,
                 payment_status = ?,
                 playing_11 = ?,
                 substitute = ?,
                 captain = ?,
                 vice_captain = ?,
                 wicket_keeper = ?,
                 status = ?
             WHERE id = ?`,
            [
                matchId,
                teamId,
                player.user_id,
                player.outside_player_id,
                player.tournament_team_player_id,
                selection.jersey_no,
                playerFee,
                paidAmount,
                playerFee <= 0
                    ? "Not Generated"
                    : paidAmount <= 0
                        ? "Pending"
                        : paidAmount >= playerFee
                            ? "Paid"
                            : "Partial",
                selection.playing_11,
                selection.substitute,
                selection.captain,
                selection.vice_captain,
                selection.wicket_keeper,
                selection.status,
                Number(id),
            ]
        );

        const feeStatus = playerFee === 0 || paidAmount >= playerFee
            ? "Paid"
            : paidAmount > 0
                ? "Partial"
                : "Pending";
        if (feeRows.length) {
            await connection.execute(
                `UPDATE cst_fee_status
                 SET academy_id = ?,
                     branch_id = ?,
                     fee_type = 'Match Player',
                     tournament_id = ?,
                     match_id = ?,
                     match_player_id = ?,
                     user_id = ?,
                     outside_player_id = ?,
                     fee_amount = ?,
                     status = ?
                 WHERE id = ?`,
                [
                    match[0][0].academy_id,
                    match[0][0].branch_id,
                    match[0][0].tournament_id,
                    matchId,
                    Number(id),
                    player.user_id,
                    player.outside_player_id,
                    playerFee,
                    selection.status === 0 || feeRows[0].status === "Cancelled" ? "Cancelled" : feeStatus,
                    feeRows[0].id,
                ]
            );
        } else {
            await connection.execute(
                `INSERT INTO cst_fee_status (
                    academy_id,
                    branch_id,
                    fee_type,
                    tournament_id,
                    match_id,
                    match_player_id,
                    user_id,
                    outside_player_id,
                    fee_amount,
                    paid_amount,
                    status,
                    remarks
                 ) VALUES (?, ?, 'Match Player', ?, ?, ?, ?, ?, ?, 0, ?, 'Match player fee')`,
                [
                    match[0][0].academy_id,
                    match[0][0].branch_id,
                    match[0][0].tournament_id,
                    matchId,
                    Number(id),
                    player.user_id,
                    player.outside_player_id,
                    playerFee,
                    selection.status === 0 ? "Cancelled" : feeStatus,
                ]
            );
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Match player updated successfully.",
        });
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("PUT match player error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update match player.",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// DELETE /api/match-players/10
export async function DELETE(request, context) {
    let connection;

    try {
        const { id } = await getParams(context);

        if (!isPositiveInt(id)) {
            return NextResponse.json(
                { success: false, message: "Invalid player record ID." },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            "SELECT id FROM cst_match_players WHERE id = ? LIMIT 1",
            [Number(id)]
        );

        if (!rows.length) {
            return NextResponse.json(
                { success: false, message: "Match player not found." },
                { status: 404 }
            );
        }

        await connection.execute(
            "DELETE FROM cst_match_players WHERE id = ?",
            [Number(id)]
        );

        return NextResponse.json({
            success: true,
            message: "Match player removed successfully.",
        });
    } catch (error) {
        console.error("DELETE match player error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete match player.",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}