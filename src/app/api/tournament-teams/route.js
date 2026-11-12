import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


/*
|--------------------------------------------------------------------------
| GET ALL TOURNAMENT TEAMS
|--------------------------------------------------------------------------
| GET /api/tournament-teams
| GET /api/tournament-teams?tournament_id=1
| GET /api/tournament-teams&team_id=2
| GET /api/tournament-teams?tournament_id=1&status=Registered
| GET /api/tournament-teams?academy_id=1&branch_id=2
|--------------------------------------------------------------------------
*/

export async function GET(request) {
    const connection = await pool.getConnection();

    try {
        const { searchParams } = new URL(request.url);

        const tournament_id = searchParams.get("tournament_id");
        const team_id = searchParams.get("team_id");
        const registration_no = searchParams.get("registration_no");
        const payment_status = searchParams.get("payment_status");
        const status = searchParams.get("status");
        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");

        let sql = `
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

            WHERE tt.is_deleted = 0
            AND t.is_deleted = 0
            AND tm.is_deleted = 0
        `;

        const params = [];

        if (tournament_id) {
            sql += ` AND tt.tournament_id = ?`;
            params.push(Number(tournament_id));
        }

        if (team_id) {
            sql += ` AND tt.team_id = ?`;
            params.push(Number(team_id));
        }

        if (registration_no) {
            sql += ` AND tt.registration_no LIKE ?`;
            params.push(`%${registration_no}%`);
        }

        if (payment_status) {
            sql += ` AND tt.payment_status = ?`;
            params.push(payment_status);
        }

        if (status) {
            sql += ` AND tt.status = ?`;
            params.push(status);
        }

        if (academy_id) {
            sql += ` AND t.academy_id = ?`;
            params.push(Number(academy_id));
        }

        if (branch_id) {
            sql += ` AND t.branch_id = ?`;
            params.push(Number(branch_id));
        }

        sql += ` ORDER BY tt.id DESC`;

        const [rows] = await connection.query(sql, params);

        return NextResponse.json({
            success: true,
            message: "Tournament teams fetched successfully",
            total: rows.length,
            data: rows
        });

    } catch (error) {
        console.error("GET TOURNAMENT TEAMS ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch tournament teams",
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
| REGISTER TEAM IN TOURNAMENT
|--------------------------------------------------------------------------
*/

export async function POST(request) {
    const connection = await pool.getConnection();
    let transactionStarted = false;

    try {
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

        /*
        |--------------------------------------------------------------------------
        | VALIDATION
        |--------------------------------------------------------------------------
        */

        if (
            tournament_id === undefined ||
            tournament_id === null ||
            tournament_id === "" ||
            !Number.isInteger(Number(tournament_id)) ||
            Number(tournament_id) <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid tournament_id is required"
                },
                { status: 400 }
            );
        }

        if (
            team_id === undefined ||
            team_id === null ||
            team_id === "" ||
            !Number.isInteger(Number(team_id)) ||
            Number(team_id) <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid team_id is required"
                },
                { status: 400 }
            );
        }

        const tournamentId = Number(tournament_id);
        const teamId = Number(team_id);

        /*
        |--------------------------------------------------------------------------
        | VALIDATE TOURNAMENT
        |--------------------------------------------------------------------------
        */

        const [tournamentRows] = await connection.query(
            `
            SELECT
                id,
                academy_id,
                branch_id,
                tournament_name,
                tournament_code,
                team_fee,
                max_teams,
                status
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

        if (
            tournament.status !== "Registration Open"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Team registration is allowed only when tournament status is Registration Open"
                },
                { status: 400 }
            );
        }

        /*
        |--------------------------------------------------------------------------
        | VALIDATE TEAM
        |--------------------------------------------------------------------------
        */

        const [teamRows] = await connection.query(
            `
            SELECT
                id,
                academy_id,
                branch_id,
                team_name,
                team_code,
                status
            FROM cst_teams
            WHERE id = ?
            AND is_deleted = 0
            AND status = 1
            LIMIT 1
            `,
            [teamId]
        );

        if (teamRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Active team not found"
                },
                { status: 404 }
            );
        }

        const team = teamRows[0];

        /*
        |--------------------------------------------------------------------------
        | DUPLICATE REGISTRATION CHECK
        |--------------------------------------------------------------------------
        */

        const [existingRows] = await connection.query(
            `
            SELECT id
            FROM cst_tournament_teams
            WHERE tournament_id = ?
            AND team_id = ?
            AND is_deleted = 0
            LIMIT 1
            `,
            [tournamentId, teamId]
        );

        if (existingRows.length > 0) {
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
        | MAX TEAMS VALIDATION
        |--------------------------------------------------------------------------
        */

        if (
            tournament.max_teams !== null &&
            Number(tournament.max_teams) > 0
        ) {
            const [countRows] = await connection.query(
                `
                SELECT COUNT(*) AS total
                FROM cst_tournament_teams
                WHERE tournament_id = ?
                AND is_deleted = 0
                AND status NOT IN (
                    'Withdrawn',
                    'Disqualified'
                )
                `,
                [tournamentId]
            );

            if (
                Number(countRows[0].total) >=
                Number(tournament.max_teams)
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Maximum team registration limit reached"
                    },
                    { status: 400 }
                );
            }
        }

        /*
        |--------------------------------------------------------------------------
        | TEAM FEE
        |--------------------------------------------------------------------------
        | Agar request me team_fee nahi aaya, tournament ki
        | default team_fee use hogi.
        |--------------------------------------------------------------------------
        */

        const finalTeamFee =
            team_fee !== undefined &&
                team_fee !== null &&
                team_fee !== ""
                ? Number(team_fee)
                : Number(tournament.team_fee || 0);

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
            payment_status || "Pending";

        if (
            !allowedPaymentStatuses.includes(
                finalPaymentStatus
            )
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

        const finalStatus = status || "Registered";

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
        | CREATED BY VALIDATION
        |--------------------------------------------------------------------------
        */

        if (
            created_by !== undefined &&
            created_by !== null &&
            created_by !== ""
        ) {
            if (
                !Number.isInteger(Number(created_by)) ||
                Number(created_by) <= 0
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
                [Number(created_by)]
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
        | GENERATE REGISTRATION NUMBER
        |--------------------------------------------------------------------------
        */

        let finalRegistrationNo =
            registration_no &&
                registration_no.toString().trim()
                ? registration_no.toString().trim()
                : `TR-${tournamentId}-${Date.now()}`;

        /*
        |--------------------------------------------------------------------------
        | CHECK DUPLICATE REGISTRATION NUMBER
        |--------------------------------------------------------------------------
        */

        const [registrationRows] = await connection.query(
            `
            SELECT id
            FROM cst_tournament_teams
            WHERE tournament_id = ?
            AND registration_no = ?
            LIMIT 1
            `,
            [tournamentId, finalRegistrationNo]
        );

        if (registrationRows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Registration number already exists in this tournament"
                },
                { status: 409 }
            );
        }

        /*
        |--------------------------------------------------------------------------
        | REGISTER TEAM
        |--------------------------------------------------------------------------
        */

        // Both inserts must succeed, otherwise rollback both.
        await connection.beginTransaction();
        transactionStarted = true;

        const [result] = await connection.query(
            `
            INSERT INTO cst_tournament_teams (
                tournament_id,
                team_id,
                registration_no,
                registered_date,
                team_fee,
                payment_status,
                status,
                created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                tournamentId,
                teamId,
                finalRegistrationNo,
                registered_date || null,
                finalTeamFee,
                finalPaymentStatus,
                finalStatus,
                created_by !== undefined &&
                    created_by !== null &&
                    created_by !== ""
                    ? Number(created_by)
                    : null
            ]
        );

        // Create the fee ledger entry in the same transaction.
        await connection.query(
            `
            INSERT INTO cst_fee_status (
                academy_id,
                branch_id,
                fee_type,
                tournament_id,
                tournament_team_id,
                fee_amount,
                paid_amount,
                status,
                remarks,
                created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                tournament.academy_id,
                tournament.branch_id,
                "Tournament Team",
                tournamentId,
                result.insertId,
                finalTeamFee,
                0,
                finalTeamFee > 0 ? "Pending" : "Paid",
                `Team registration fee for ${team.team_name} (${finalRegistrationNo})`,
                created_by !== undefined && created_by !== null && created_by !== ""
                    ? Number(created_by)
                    : null
            ]
        );

        await connection.commit();
        transactionStarted = false;

        return NextResponse.json(
            {
                success: true,
                message: "Team registered and fee status created successfully",
                data: {
                    id: result.insertId,
                    tournament_id: tournamentId,
                    tournament_name: tournament.tournament_name,
                    team_id: teamId,
                    team_name: team.team_name,
                    registration_no: finalRegistrationNo,
                    team_fee: finalTeamFee,
                    payment_status: finalPaymentStatus,
                    status: finalStatus
                }
            },
            { status: 201 }
        );

    } catch (error) {
        if (transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error("TOURNAMENT TEAM ROLLBACK ERROR:", rollbackError);
            }
        }

        console.error("REGISTER TOURNAMENT TEAM ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to register team",
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}