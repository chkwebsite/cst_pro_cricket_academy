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
const validPaymentModes = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque"];

// GET: List tournament team players
export async function GET(request) {
    let connection;


    try {
        connection = await pool.getConnection();

        const { searchParams } = new URL(request.url);

        const filters = {
            id: searchParams.get("id"),
            tournament_id: searchParams.get("tournament_id"),
            tournament_team_id: searchParams.get("tournament_team_id"),
            team_id: searchParams.get("team_id"),
            user_id: searchParams.get("user_id"),
            outside_player_id: searchParams.get("outside_player_id"),
            jersey_no: searchParams.get("jersey_no"),
            player_role: searchParams.get("player_role"),
            payment_status: searchParams.get("payment_status"),
            status: searchParams.get("status"),
            academy_id: searchParams.get("academy_id"),
            branch_id: searchParams.get("branch_id"),
        };

        let sql = `
    SELECT
    ttp.id,
        ttp.tournament_team_id,
        ttp.team_id,
        ttp.user_id,
        ttp.outside_player_id,
        ttp.jersey_no,
        ttp.player_role,
        ttp.player_fee,
        ttp.payment_status,
        ttp.status,
        ttp.is_deleted,
        ttp.created_at,
        ttp.updated_at,

        COALESCE(ttp.tournament_id, tt.tournament_id) AS tournament_id,
        COALESCE(fee.paid_amount, 0) AS paid_amount,
        GREATEST(COALESCE(ttp.player_fee, 0) - COALESCE(fee.paid_amount, 0), 0) AS balance_amount,
        t.tournament_name,
        tt.registration_no,

        tm.team_name,
        tm.team_code,

        t.academy_id,
        t.branch_id,

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

        LEFT JOIN (
            SELECT
                tournament_team_player_id,
                SUM(paid_amount) AS paid_amount
            FROM cst_fee_status
            WHERE fee_type = 'Tournament Player'
            GROUP BY tournament_team_player_id
        ) fee
            ON fee.tournament_team_player_id = ttp.id

        WHERE ttp.is_deleted = 0
          AND tt.is_deleted = 0
          AND t.is_deleted = 0
          AND tm.is_deleted = 0
        `;

        const values = [];

        if (filters.id) {
            sql += " AND ttp.id = ?";
            values.push(filters.id);
        }

        if (filters.tournament_team_id) {
            sql += " AND ttp.tournament_team_id = ?";
            values.push(filters.tournament_team_id);
        }

        if (filters.tournament_id) {
            sql += " AND COALESCE(ttp.tournament_id, tt.tournament_id) = ?";
            values.push(filters.tournament_id);
        }

        if (filters.team_id) {
            sql += " AND ttp.team_id = ?";
            values.push(filters.team_id);
        }

        if (filters.user_id) {
            sql += " AND ttp.user_id = ?";
            values.push(filters.user_id);
        }

        if (filters.outside_player_id) {
            sql += " AND ttp.outside_player_id = ?";
            values.push(filters.outside_player_id);
        }

        if (filters.jersey_no) {
            sql += " AND ttp.jersey_no = ?";
            values.push(filters.jersey_no);
        }

        if (filters.player_role) {
            sql += " AND ttp.player_role = ?";
            values.push(filters.player_role);
        }

        if (filters.payment_status) {
            sql += " AND ttp.payment_status = ?";
            values.push(filters.payment_status);
        }

        if (filters.status !== null && filters.status !== "") {
            sql += " AND ttp.status = ?";
            values.push(filters.status);
        }

        if (filters.academy_id) {
            sql += " AND t.academy_id = ?";
            values.push(filters.academy_id);
        }

        if (filters.branch_id) {
            sql += " AND t.branch_id = ?";
            values.push(filters.branch_id);
        }

        sql += " ORDER BY ttp.id DESC";

        const [rows] = await connection.execute(sql, values);

        return NextResponse.json({
            success: true,
            message: "Tournament team players fetched successfully",
            total: rows.length,
            data: rows,
        });

    } catch (error) {
        console.error("GET Tournament Team Players Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch tournament team players",
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }


}

// POST: Add player to tournament team and create fee record
export async function POST(request) {
    let connection;
    let transactionStarted = false;


    try {
        const body = await request.json();

        const {
            tournament_team_id,
            tournament_id,
            team_id,
            user_id,
            outside_player_id,
            jersey_no,
            player_role = "Player",
            player_fee = 0,
            paid_amount = 0,
            payment_status = "Pending",
            payment_mode = "Cash",
            transaction_no = null,
            created_by = null,
            status = 1,
        } = body;

        // Required fields
        const tournamentTeamId = Number(tournament_team_id);
        const teamId = Number(team_id);
        const playerFee = Number(player_fee);
        const paidAmount = Number(paid_amount);

        if (
            !Number.isInteger(tournamentTeamId) ||
            tournamentTeamId <= 0 ||
            !Number.isInteger(teamId) ||
            teamId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid tournament_team_id and team_id are required",
                },
                { status: 400 }
            );
        }

        // Exactly one player source must be provided
        const hasUser = user_id !== undefined &&
            user_id !== null &&
            user_id !== "";

        const hasOutsidePlayer = outside_player_id !== undefined &&
            outside_player_id !== null &&
            outside_player_id !== "";

        if (hasUser === hasOutsidePlayer) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Provide either user_id or outside_player_id, not both",
                },
                { status: 400 }
            );
        }

        const userId = hasUser ? Number(user_id) : null;
        const outsidePlayerId = hasOutsidePlayer
            ? Number(outside_player_id)
            : null;

        if (
            hasUser &&
            (!Number.isInteger(userId) || userId <= 0)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid user_id",
                },
                { status: 400 }
            );
        }

        if (
            hasOutsidePlayer &&
            (!Number.isInteger(outsidePlayerId) || outsidePlayerId <= 0)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid outside_player_id",
                },
                { status: 400 }
            );
        }

        if (!Number.isFinite(playerFee) || playerFee < 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "player_fee must be zero or greater",
                },
                { status: 400 }
            );
        }

        if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > playerFee) {
            return NextResponse.json(
                {
                    success: false,
                    message: "paid_amount must be between zero and player_fee",
                },
                { status: 400 }
            );
        }

        const paymentMode = payment_mode || "Cash";
        const createdBy = created_by === null || created_by === "" ? null : Number(created_by);

        if (paidAmount > 0 && !validPaymentModes.includes(paymentMode)) {
            return NextResponse.json(
                { success: false, message: "Invalid payment_mode" },
                { status: 400 }
            );
        }

        if (createdBy !== null && (!Number.isInteger(createdBy) || createdBy <= 0)) {
            return NextResponse.json(
                { success: false, message: "created_by must be a positive integer or null" },
                { status: 400 }
            );
        }

        if (!validRoles.includes(player_role)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid player_role",
                },
                { status: 400 }
            );
        }

        if (!validPaymentStatuses.includes(payment_status)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid payment_status",
                },
                { status: 400 }
            );
        }

        if (![0, 1].includes(Number(status))) {
            return NextResponse.json(
                {
                    success: false,
                    message: "status must be 0 or 1",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        // Lock tournament team and get tournament information
        const [tournamentTeams] = await connection.execute(
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

        if (tournamentTeams.length === 0) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                {
                    success: false,
                    message: "Tournament team not found",
                },
                { status: 404 }
            );
        }

        const registration = tournamentTeams[0];

        if (
            tournament_id !== undefined &&
            tournament_id !== null &&
            tournament_id !== "" &&
            (!Number.isInteger(Number(tournament_id)) || Number(tournament_id) !== Number(registration.tournament_id))
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
                    message: "Tournament registration or team is inactive",
                },
                { status: 400 }
            );
        }

        // team_id must match the registered tournament team
        if (Number(registration.team_id) !== teamId) {
            await connection.rollback();
            transactionStarted = false;

            return NextResponse.json(
                {
                    success: false,
                    message: "team_id does not match the tournament registration",
                },
                { status: 400 }
            );
        }

        // Validate registered player
        if (hasUser) {
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
                    {
                        success: false,
                        message: "Active user not found",
                    },
                    { status: 404 }
                );
            }
        }

        // Validate outside player
        if (hasOutsidePlayer) {
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
                    {
                        success: false,
                        message: "Active outside player not found",
                    },
                    { status: 404 }
                );
            }
        }

        // Prevent registering the same player twice in this tournament team
        const [duplicates] = await connection.execute(
            `
        SELECT id
        FROM cst_tournament_team_players
        WHERE tournament_team_id = ?
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

        // Prevent duplicate jersey numbers within the same team registration
        if (jersey_no !== undefined && jersey_no !== null && jersey_no !== "") {
            const [jerseyRows] = await connection.execute(
                `
            SELECT id
            FROM cst_tournament_team_players
            WHERE tournament_team_id = ?
        AND jersey_no = ?
            AND is_deleted = 0
            LIMIT 1
        `,
                [tournamentTeamId, String(jersey_no)]
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

        // Insert tournament team player
        const [playerResult] = await connection.execute(
            `
        INSERT INTO cst_tournament_team_players
        (
            tournament_team_id,
            tournament_id,
            team_id,
            user_id,
            outside_player_id,
            jersey_no,
            player_role,
            player_fee,
            payment_status,
            status,
            is_deleted
        )
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `,
            [
                tournamentTeamId,
                registration.tournament_id,
                teamId,
                userId,
                outsidePlayerId,
                jersey_no || null,
                player_role,
                playerFee,
                payment_status,
                Number(status),
            ]
        );

        const tournamentTeamPlayerId = playerResult.insertId;

        // Map player payment status to fee status
        const feeStatus = playerFee === 0 || paidAmount >= playerFee
            ? "Paid"
            : paidAmount > 0
                ? "Partial"
                : "Pending";

        // Insert generic fee ledger record
        const [feeStatusResult] = await connection.execute(
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
                tournamentTeamPlayerId,
                userId,
                outsidePlayerId,
                playerFee,
                paidAmount,
                feeStatus,
                "Tournament player registration fee",
            ]
        );

        if (paidAmount > 0) {
            await connection.execute(
                `
                INSERT INTO cst_fee_payments (
                    fee_status_id,
                    amount,
                    payment_mode,
                    transaction_no,
                    payment_date,
                    status,
                    remarks,
                    created_by
                ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'Paid', ?, ?)
                `,
                [
                    feeStatusResult.insertId,
                    paidAmount,
                    paymentMode,
                    transaction_no ? String(transaction_no).trim() : null,
                    "Initial tournament player registration payment",
                    createdBy,
                ]
            );
        }

        // Get inserted player
        const [newPlayer] = await connection.execute(
            `
    SELECT *
        FROM cst_tournament_team_players
        WHERE id = ?
        `,
            [tournamentTeamPlayerId]
        );

        await connection.commit();
        transactionStarted = false;

        return NextResponse.json(
            {
                success: true,
                message: "Tournament player and fee record added successfully",
                data: newPlayer[0],
            },
            { status: 201 }
        );

    } catch (error) {
        if (connection && transactionStarted) {
            await connection.rollback();
        }

        console.error("POST Tournament Team Player Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to register tournament player. All changes have been rolled back.",
                error: error.message,
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }


}
