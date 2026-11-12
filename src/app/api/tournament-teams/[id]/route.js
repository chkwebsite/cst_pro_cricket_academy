import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";

/*
|--------------------------------------------------------------------------
| GET SINGLE TOURNAMENT TEAM
|--------------------------------------------------------------------------
*/

export async function GET(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        if (
            !id ||
            !Number.isInteger(Number(id)) ||
            Number(id) <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid registration ID is required"
                },
                { status: 400 }
            );
        }

        const [rows] = await connection.query(
            `
            SELECT
                tt.id,
                tt.tournament_id,
                t.tournament_name,
                t.tournament_code,
                t.academy_id,
                a.academy_name,
                t.branch_id,
                b.branch_name,

                tt.team_id,
                tm.team_name,
                tm.team_code,
                tm.team_type,
                tm.category,
                tm.age_group,

                tt.registration_no,
                tt.registered_date,
                tt.team_fee,
                tt.payment_status,
                tt.status,
                tt.created_by,
                CONCAT_WS(
                    ' ',
                    u.first_name,
                    u.last_name
                ) AS created_by_name,
                tt.created_at

            FROM cst_tournament_teams tt

            INNER JOIN cst_tournaments t
                ON t.id = tt.tournament_id

            INNER JOIN cst_teams tm
                ON tm.id = tt.team_id

            LEFT JOIN cst_academy a
                ON a.id = t.academy_id

            LEFT JOIN cst_branch b
                ON b.id = t.branch_id

            LEFT JOIN cst_users u
                ON u.id = tt.created_by

            WHERE tt.id = ?
            AND tt.is_deleted = 0

            LIMIT 1
            `,
            [Number(id)]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Tournament team registration not found"
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Tournament team fetched successfully",
            data: rows[0]
        });

    } catch (error) {
        console.error("GET TOURNAMENT TEAM ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch tournament team",
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}


/*
|--------------------------------------------------------------------------
| UPDATE TOURNAMENT TEAM
|--------------------------------------------------------------------------
*/

export async function PUT(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        if (
            !id ||
            !Number.isInteger(Number(id)) ||
            Number(id) <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid registration ID is required"
                },
                { status: 400 }
            );
        }

        const registrationId = Number(id);

        const [existingRows] = await connection.query(
            `
            SELECT *
            FROM cst_tournament_teams
            WHERE id = ?
            AND is_deleted = 0
            LIMIT 1
            `,
            [registrationId]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Tournament team registration not found"
                },
                { status: 404 }
            );
        }

        const existing = existingRows[0];

        const body = await request.json();

        const {
            tournament_id,
            team_id,
            registration_no,
            registered_date,
            team_fee,
            payment_status,
            status,
            created_by
        } = body;

        const tournamentId =
            tournament_id !== undefined &&
                tournament_id !== null &&
                tournament_id !== ""
                ? Number(tournament_id)
                : existing.tournament_id;

        const teamId =
            team_id !== undefined &&
                team_id !== null &&
                team_id !== ""
                ? Number(team_id)
                : existing.team_id;

        if (
            !Number.isInteger(tournamentId) ||
            tournamentId <= 0 ||
            !Number.isInteger(teamId) ||
            teamId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid tournament_id and team_id are required"
                },
                { status: 400 }
            );
        }

        /*
        |--------------------------------------------------------------------------
        | VALIDATE TOURNAMENT
        |--------------------------------------------------------------------------
        */

        const [tournamentRows] = await connection.query(
            `
            SELECT id, academy_id, branch_id, team_fee, status
            FROM cst_tournaments
            WHERE id = ?
            AND is_deleted = 0
            LIMIT 1
            `,
            [tournamentId]
        );

        if (tournamentRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Tournament not found"
                },
                { status: 404 }
            );
        }

        const tournament = tournamentRows[0];

        /*
        |--------------------------------------------------------------------------
        | VALIDATE TEAM
        |--------------------------------------------------------------------------
        */

        const [teamRows] = await connection.query(
            `
            SELECT id, academy_id, status
            FROM cst_teams
            WHERE id = ?
            AND is_deleted = 0
            LIMIT 1
            `,
            [teamId]
        );

        if (teamRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Team not found"
                },
                { status: 404 }
            );
        }

        const team = teamRows[0];

        if (
            tournament.academy_id !== null &&
            team.academy_id !== null &&
            Number(tournament.academy_id) !== Number(team.academy_id)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Selected team does not belong to tournament academy"
                },
                { status: 400 }
            );
        }

        /*
        |--------------------------------------------------------------------------
        | DUPLICATE TEAM REGISTRATION
        |--------------------------------------------------------------------------
        */

        const [duplicateTeamRows] = await connection.query(
            `
            SELECT id
            FROM cst_tournament_teams
            WHERE tournament_id = ?
            AND team_id = ?
            AND id != ?
            AND is_deleted = 0
            LIMIT 1
            `,
            [
                tournamentId,
                teamId,
                registrationId
            ]
        );

        if (duplicateTeamRows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "This team is already registered in this tournament"
                },
                { status: 409 }
            );
        }

        /*
        |--------------------------------------------------------------------------
        | REGISTRATION NUMBER
        |--------------------------------------------------------------------------
        */

        const finalRegistrationNo =
            registration_no !== undefined &&
                registration_no !== null
                ? (
                    registration_no.toString().trim() || null
                )
                : existing.registration_no;

        if (finalRegistrationNo) {
            const [duplicateRegistrationRows] =
                await connection.query(
                    `
                    SELECT id
                    FROM cst_tournament_teams
                    WHERE tournament_id = ?
                    AND registration_no = ?
                    AND id != ?
                    LIMIT 1
                    `,
                    [
                        tournamentId,
                        finalRegistrationNo,
                        registrationId
                    ]
                );

            if (duplicateRegistrationRows.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Registration number already exists in this tournament"
                    },
                    { status: 409 }
                );
            }
        }

        /*
        |--------------------------------------------------------------------------
        | TEAM FEE
        |--------------------------------------------------------------------------
        */

        const finalTeamFee =
            team_fee !== undefined &&
                team_fee !== null &&
                team_fee !== ""
                ? Number(team_fee)
                : Number(existing.team_fee);

        if (
            !Number.isFinite(finalTeamFee) ||
            finalTeamFee < 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid team fee"
                },
                { status: 400 }
            );
        }

        /*
        |--------------------------------------------------------------------------
        | PAYMENT STATUS
        |--------------------------------------------------------------------------
        */

        const allowedPaymentStatuses = [
            "Pending",
            "Partial",
            "Paid",
            "Cancelled"
        ];

        const finalPaymentStatus =
            payment_status || existing.payment_status;

        if (
            !allowedPaymentStatuses.includes(finalPaymentStatus)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid payment status"
                },
                { status: 400 }
            );
        }

        /*
        |--------------------------------------------------------------------------
        | REGISTRATION STATUS
        |--------------------------------------------------------------------------
        */

        const allowedStatuses = [
            "Registered",
            "Confirmed",
            "Withdrawn",
            "Disqualified",
            "Completed"
        ];

        const finalStatus = status || existing.status;

        if (!allowedStatuses.includes(finalStatus)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid registration status"
                },
                { status: 400 }
            );
        }

        /*
        |--------------------------------------------------------------------------
        | CREATED BY
        |--------------------------------------------------------------------------
        */

        const finalCreatedBy =
            created_by !== undefined
                ? (
                    created_by === null || created_by === ""
                        ? null
                        : Number(created_by)
                )
                : existing.created_by;

        if (finalCreatedBy !== null) {
            if (
                !Number.isInteger(finalCreatedBy) ||
                finalCreatedBy <= 0
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid created_by"
                    },
                    { status: 400 }
                );
            }

            const [userRows] = await connection.query(
                `
                SELECT id
                FROM cst_users
                WHERE id = ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [finalCreatedBy]
            );

            if (userRows.length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Created by user not found"
                    },
                    { status: 404 }
                );
            }
        }

        /*
        |--------------------------------------------------------------------------
        | UPDATE
        |--------------------------------------------------------------------------
        */

        await connection.query(
            `
            UPDATE cst_tournament_teams
            SET
                tournament_id = ?,
                team_id = ?,
                registration_no = ?,
                registered_date = ?,
                team_fee = ?,
                payment_status = ?,
                status = ?,
                created_by = ?
            WHERE id = ?
            `,
            [
                tournamentId,
                teamId,
                finalRegistrationNo,
                registered_date !== undefined
                    ? (registered_date || null)
                    : existing.registered_date,
                finalTeamFee,
                finalPaymentStatus,
                finalStatus,
                finalCreatedBy,
                registrationId
            ]
        );

        return NextResponse.json({
            success: true,
            message: "Tournament team updated successfully",
            data: {
                id: registrationId
            }
        });

    } catch (error) {
        console.error("UPDATE TOURNAMENT TEAM ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update tournament team",
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}


/*
|--------------------------------------------------------------------------
| DELETE TOURNAMENT TEAM - SOFT DELETE
|--------------------------------------------------------------------------
*/

export async function DELETE(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        if (
            !id ||
            !Number.isInteger(Number(id)) ||
            Number(id) <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid registration ID is required"
                },
                { status: 400 }
            );
        }

        const registrationId = Number(id);

        const [rows] = await connection.query(
            `
            SELECT id
            FROM cst_tournament_teams
            WHERE id = ?
            AND is_deleted = 0
            LIMIT 1
            `,
            [registrationId]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Tournament team registration not found"
                },
                { status: 404 }
            );
        }

        await connection.query(
            `
            UPDATE cst_tournament_teams
            SET
                is_deleted = 1,
                status = 'Withdrawn'
            WHERE id = ?
            `,
            [registrationId]
        );

        return NextResponse.json({
            success: true,
            message: "Tournament team registration removed successfully"
        });

    } catch (error) {
        console.error("DELETE TOURNAMENT TEAM ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to remove tournament team",
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}