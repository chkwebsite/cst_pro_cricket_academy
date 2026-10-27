import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";

const validRoles = [
    "Player",
    "Captain",
    "Vice Captain",
    "Wicket Keeper",
    "All Rounder",
    "Bowler",
    "Batter",
];

const validPaymentStatuses = [
    "Pending",
    "Partial",
    "Paid",
];

// GET: Single tournament team player
export async function GET(request, { params }) {
    let connection;


    try {
        const { id } = await params;
        const playerId = Number(id);

        if (!Number.isInteger(playerId) || playerId <= 0) {
            return NextResponse.json(
                { success: false, message: "Invalid player ID" },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            `
    SELECT
    ttp.*,
        fee.paid_amount AS paid_amount,
        COALESCE(ttp.tournament_id, tt.tournament_id) AS resolved_tournament_id,
        tt.registration_no,
        t.tournament_name,
        t.academy_id,
        t.branch_id,
        tm.team_name,
        tm.team_code,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.profile_image,
        op.player_name AS outside_player_name,
            op.phone AS outside_player_phone,
                op.email AS outside_player_email,
                    op.profile_image AS outside_player_image
        FROM cst_tournament_team_players ttp
        INNER JOIN cst_tournament_teams tt
            ON tt.id = ttp.tournament_team_id
        INNER JOIN cst_tournaments t
            ON t.id = tt.tournament_id
        INNER JOIN cst_teams tm
            ON tm.id = ttp.team_id
        LEFT JOIN cst_users u
            ON u.id = ttp.user_id
        LEFT JOIN cst_outside_players op
            ON op.id = ttp.outside_player_id
        LEFT JOIN cst_fee_status fee
            ON fee.tournament_team_player_id = ttp.id
        WHERE ttp.id = ?
        AND ttp.is_deleted = 0
        LIMIT 1
        `,
            [playerId]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Tournament team player not found",
                },
                { status: 404 }
            );
        }

        const { resolved_tournament_id, ...player } = rows[0];

        return NextResponse.json({
            success: true,
            data: {
                ...player,
                tournament_id: player.tournament_id ?? resolved_tournament_id,
            },
        });

    } catch (error) {
        console.error("GET Tournament Team Player Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch tournament team player",
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }


}

// PUT: Update tournament team player and fee ledger
export async function PUT(request, { params }) {
    let connection;
    let transactionStarted = false;


    try {
        const { id } = await params;
        const playerId = Number(id);

        if (!Number.isInteger(playerId) || playerId <= 0) {
            return NextResponse.json(
                { success: false, message: "Invalid player ID" },
                { status: 400 }
            );
        }

        const body = await request.json();

        connection = await pool.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        // Lock existing player
        const [existingRows] = await connection.execute(
            `
    SELECT *
        FROM cst_tournament_team_players
        WHERE id = ?
        AND is_deleted = 0
        FOR UPDATE
        `,
            [playerId]
        );

        if (existingRows.length === 0) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                {
                    success: false,
                    message: "Tournament team player not found",
                },
                { status: 404 }
            );
        }

        const existing = existingRows[0];

        const tournamentTeamId = body.tournament_team_id !== undefined
            ? Number(body.tournament_team_id)
            : Number(existing.tournament_team_id);

        const teamId = body.team_id !== undefined
            ? Number(body.team_id)
            : Number(existing.team_id);

        const userId = body.user_id !== undefined
            ? (
                body.user_id === null || body.user_id === ""
                    ? null
                    : Number(body.user_id)
            )
            : existing.user_id;

        const outsidePlayerId = body.outside_player_id !== undefined
            ? (
                body.outside_player_id === null || body.outside_player_id === ""
                    ? null
                    : Number(body.outside_player_id)
            )
            : existing.outside_player_id;

        const jerseyNo = body.jersey_no !== undefined
            ? (body.jersey_no === "" ? null : body.jersey_no)
            : existing.jersey_no;

        const playerRole = body.player_role ?? existing.player_role;

        const playerFee = body.player_fee !== undefined
            ? Number(body.player_fee)
            : Number(existing.player_fee);

        const requestedPaidAmount = body.paid_amount !== undefined
            ? Number(body.paid_amount)
            : null;

        const paymentStatus = body.payment_status ?? existing.payment_status;

        const playerStatus = body.status !== undefined
            ? Number(body.status)
            : Number(existing.status);

        if (
            !Number.isInteger(tournamentTeamId) ||
            tournamentTeamId <= 0 ||
            !Number.isInteger(teamId) ||
            teamId <= 0
        ) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid tournament_team_id or team_id",
                },
                { status: 400 }
            );
        }

        // Exactly one player source must exist
        if ((userId === null) === (outsidePlayerId === null)) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                {
                    success: false,
                    message: "Provide either user_id or outside_player_id, not both",
                },
                { status: 400 }
            );
        }

        if (
            (userId !== null &&
                (!Number.isInteger(userId) || userId <= 0)) ||
            (outsidePlayerId !== null &&
                (!Number.isInteger(outsidePlayerId) || outsidePlayerId <= 0))
        ) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                { success: false, message: "Invalid player ID" },
                { status: 400 }
            );
        }

        if (!Number.isFinite(playerFee) || playerFee < 0) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                {
                    success: false,
                    message: "player_fee must be zero or greater",
                },
                { status: 400 }
            );
        }

        if (!validRoles.includes(playerRole)) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                { success: false, message: "Invalid player_role" },
                { status: 400 }
            );
        }

        if (!validPaymentStatuses.includes(paymentStatus)) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                { success: false, message: "Invalid payment_status" },
                { status: 400 }
            );
        }

        if (![0, 1].includes(playerStatus)) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                { success: false, message: "status must be 0 or 1" },
                { status: 400 }
            );
        }

        // Validate tournament team and team relationship
        const [registrationRows] = await connection.execute(
            `
    SELECT
    tt.id,
        tt.tournament_id,
        tt.team_id,
        tt.status AS registration_status,
            tt.is_deleted AS registration_deleted,
                t.academy_id,
                t.branch_id,
                t.is_deleted AS tournament_deleted,
                    tm.is_deleted AS team_deleted
        FROM cst_tournament_teams tt
        INNER JOIN cst_tournaments t
            ON t.id = tt.tournament_id
        INNER JOIN cst_teams tm
            ON tm.id = tt.team_id
        WHERE tt.id = ?
        FOR UPDATE
            `,
            [tournamentTeamId]
        );

        if (registrationRows.length === 0) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                { success: false, message: "Tournament team not found" },
                { status: 404 }
            );
        }

        const registration = registrationRows[0];

        const tournamentId = Number(body.tournament_id ?? registration.tournament_id);

        if (
            !Number.isInteger(tournamentId) ||
            tournamentId !== Number(registration.tournament_id)
        ) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                {
                    success: false,
                    message: "tournament_id does not match the tournament team registration",
                },
                { status: 400 }
            );
        }

        if (
            Number(registration.team_id) !== teamId ||
            Number(registration.registration_deleted) === 1 ||
            Number(registration.tournament_deleted) === 1 ||
            Number(registration.team_deleted) === 1 ||
            ["Withdrawn", "Disqualified"].includes(
                registration.registration_status
            )
        ) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid or inactive tournament team registration",
                },
                { status: 400 }
            );
        }

        // Validate player reference
        if (userId !== null) {
            const [users] = await connection.execute(
                `
            SELECT id
            FROM cst_users
            WHERE id = ?
        AND is_deleted = 0
            LIMIT 1
        `,
                [userId]
            );

            if (users.length === 0) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    { success: false, message: "Active user not found" },
                    { status: 404 }
                );
            }
        }

        if (outsidePlayerId !== null) {
            const [players] = await connection.execute(
                `
            SELECT id
            FROM cst_outside_players
            WHERE id = ?
        AND is_deleted = 0
            LIMIT 1
        `,
                [outsidePlayerId]
            );

            if (players.length === 0) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    { success: false, message: "Active outside player not found" },
                    { status: 404 }
                );
            }
        }

        // Prevent duplicate player registration
        const [duplicates] = await connection.execute(
            `
        SELECT id
        FROM cst_tournament_team_players
        WHERE tournament_team_id = ?
        AND id <> ?
            AND is_deleted = 0
    AND(
        (? IS NOT NULL AND user_id = ?)
    OR
        (? IS NOT NULL AND outside_player_id = ?)
          )
        LIMIT 1
        `,
            [
                tournamentTeamId,
                playerId,
                userId,
                userId,
                outsidePlayerId,
                outsidePlayerId,
            ]
        );

        if (duplicates.length > 0) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                {
                    success: false,
                    message: "Player is already registered in this tournament team",
                },
                { status: 409 }
            );
        }

        // Prevent duplicate jersey number
        if (jerseyNo !== null && jerseyNo !== "") {
            const [jerseyRows] = await connection.execute(
                `
            SELECT id
            FROM cst_tournament_team_players
            WHERE tournament_team_id = ?
        AND jersey_no = ?
            AND id <> ?
                AND is_deleted = 0
            LIMIT 1
        `,
                [tournamentTeamId, String(jerseyNo), playerId]
            );

            if (jerseyRows.length > 0) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    {
                        success: false,
                        message: "Jersey number already exists in this tournament team",
                    },
                    { status: 409 }
                );
            }
        }

        // Find existing fee ledger record
        const [feeRows] = await connection.execute(
            `
        SELECT id, paid_amount, status
        FROM cst_fee_status
        WHERE tournament_team_player_id = ?
        LIMIT 1
        FOR UPDATE
        `,
            [playerId]
        );

        const paidAmount = requestedPaidAmount ?? (
            feeRows.length > 0 ? Number(feeRows[0].paid_amount) : 0
        );

        if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > playerFee) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                {
                    success: false,
                    message: "paid_amount must be between zero and player_fee",
                },
                { status: 400 }
            );
        }

        if (feeRows.length > 0) {
            const fee = feeRows[0];

            if (
                fee.status === "Cancelled" &&
                playerStatus === 1
            ) {
                await connection.rollback();
                transactionStarted = false;

                return NextResponse.json(
                    {
                        success: false,
                        message: "This player's fee record is cancelled. A new fee record must be created before reactivation.",
                    },
                    { status: 409 }
                );
            }

        }

        // Update player
        await connection.execute(
            `
        UPDATE cst_tournament_team_players
    SET
    tournament_team_id = ?,
        tournament_id = ?,
        team_id = ?,
        user_id = ?,
        outside_player_id = ?,
        jersey_no = ?,
        player_role = ?,
        player_fee = ?,
        payment_status = ?,
        status = ?
            WHERE id = ?
                `,
            [
                tournamentTeamId,
                tournamentId,
                teamId,
                userId,
                outsidePlayerId,
                jerseyNo || null,
                playerRole,
                playerFee,
                paymentStatus,
                playerStatus,
                playerId,
            ]
        );

        // Synchronize fee record with player
        if (feeRows.length > 0) {
            const fee = feeRows[0];

            let feeStatus;

            if (playerFee === 0 || paidAmount >= playerFee) {
                feeStatus = "Paid";
            } else if (paidAmount === 0) {
                feeStatus = "Pending";
            } else {
                feeStatus = "Partial";
            }

            if (playerStatus === 0) {
                feeStatus = "Cancelled";
            }

            await connection.execute(
                `
            UPDATE cst_fee_status
    SET
    academy_id = ?,
        branch_id = ?,
        fee_type = 'Tournament Player',
        tournament_id = ?,
        tournament_team_id = ?,
        user_id = ?,
        outside_player_id = ?,
        fee_amount = ?,
        paid_amount = ?,
        status = ?
            WHERE id = ?
                `,
                [
                    registration.academy_id,
                    registration.branch_id,
                    registration.tournament_id,
                    tournamentTeamId,
                    userId,
                    outsidePlayerId,
                    playerFee,
                    paidAmount,
                    feeStatus,
                    fee.id,
                ]
            );

        } else {
            // Create fee record if it does not exist
            const feeStatus = playerStatus === 0
                ? "Cancelled"
                : playerFee === 0 || paidAmount >= playerFee
                    ? "Paid"
                    : paidAmount > 0
                        ? "Partial"
                        : "Pending";

            await connection.execute(
                `
            INSERT INTO cst_fee_status
        (
            academy_id,
            branch_id,
            fee_type,
            tournament_id,
            tournament_team_id,
            tournament_team_player_id,
            user_id,
            outside_player_id,
            fee_amount,
            paid_amount,
            status,
            remarks
        )
    VALUES(?, ?, 'Tournament Player', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
                [
                    registration.academy_id,
                    registration.branch_id,
                    registration.tournament_id,
                    tournamentTeamId,
                    playerId,
                    userId,
                    outsidePlayerId,
                    playerFee,
                    paidAmount,
                    feeStatus,
                    "Tournament player registration fee",
                ]
            );
        }

        const [updatedRows] = await connection.execute(
            `
    SELECT *
        FROM cst_tournament_team_players
        WHERE id = ?
        `,
            [playerId]
        );

        await connection.commit();
        transactionStarted = false;

        return NextResponse.json({
            success: true,
            message: "Tournament player and fee record updated successfully",
            data: updatedRows[0],
        });

    } catch (error) {
        if (connection && transactionStarted) {
            await connection.rollback();
        }

        console.error("PUT Tournament Team Player Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update tournament player. Changes have been rolled back.",
                error: error.message,
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }


}

// DELETE: Soft delete player and cancel fee record
export async function DELETE(request, { params }) {
    let connection;
    let transactionStarted = false;


    try {
        const { id } = await params;
        const playerId = Number(id);

        if (!Number.isInteger(playerId) || playerId <= 0) {
            return NextResponse.json(
                { success: false, message: "Invalid player ID" },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        const [rows] = await connection.execute(
            `
        SELECT id
        FROM cst_tournament_team_players
        WHERE id = ?
        AND is_deleted = 0
        FOR UPDATE
        `,
            [playerId]
        );

        if (rows.length === 0) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                {
                    success: false,
                    message: "Tournament team player not found",
                },
                { status: 404 }
            );
        }

        // Soft delete the player
        await connection.execute(
            `
        UPDATE cst_tournament_team_players
        SET is_deleted = 1, status = 0
        WHERE id = ?
        `,
            [playerId]
        );

        // Cancel associated fee record, preserve payment history
        await connection.execute(
            `
        UPDATE cst_fee_status
        SET status = 'Cancelled'
        WHERE tournament_team_player_id = ?
        AND status <> 'Cancelled'
            `,
            [playerId]
        );

        await connection.commit();
        transactionStarted = false;

        return NextResponse.json({
            success: true,
            message: "Tournament player deleted and associated fee record cancelled successfully",
        });

    } catch (error) {
        if (connection && transactionStarted) {
            await connection.rollback();
        }

        console.error("DELETE Tournament Team Player Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete tournament player",
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }


}
