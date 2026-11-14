import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";

/*
|--------------------------------------------------------------------------
| GET ALL TOURNAMENT TEAMS
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

        // Check authentication
        const { user: authUser } = await getAuthenticatedUser(request);
        if (authUser) {
            if (authUser.isPlayer) {
                sql += ` AND t.academy_id = ? AND (t.branch_id = ? OR t.branch_id IS NULL)`;
                params.push(authUser.academy_id, authUser.branch_id);
            } else if (authUser.isBranchAdmin && authUser.branch_id) {
                sql += ` AND t.academy_id = ? AND t.branch_id = ?`;
                params.push(authUser.academy_id, authUser.branch_id);
            } else if (authUser.isAcademyAdmin && authUser.academy_id) {
                sql += ` AND t.academy_id = ?`;
                params.push(authUser.academy_id);
                if (branch_id) {
                    sql += ` AND t.branch_id = ?`;
                    params.push(Number(branch_id));
                }
            } else if (!authUser.isSuperAdmin && authUser.academy_id) {
                const allowed = (authUser.assignedBranchIds || [authUser.branch_id]).map(Number);
                sql += ` AND t.academy_id = ? AND t.branch_id IN (${allowed.map(() => "?").join(",")})`;
                params.push(authUser.academy_id, ...allowed);
            } else {
                if (academy_id) { sql += ` AND t.academy_id = ?`; params.push(Number(academy_id)); }
                if (branch_id) { sql += ` AND t.branch_id = ?`; params.push(Number(branch_id)); }
            }
        } else {
            if (academy_id) { sql += ` AND t.academy_id = ?`; params.push(Number(academy_id)); }
            if (branch_id) { sql += ` AND t.branch_id = ?`; params.push(Number(branch_id)); }
        }

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
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (authUser.isPlayer) {
        return NextResponse.json(
            { success: false, message: "Forbidden. Players cannot register tournament teams." },
            { status: 403 }
        );
    }

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
            status
        } = body;

        if (
            tournament_id === undefined ||
            tournament_id === null ||
            tournament_id === "" ||
            !Number.isInteger(Number(tournament_id)) ||
            Number(tournament_id) <= 0
        ) {
            return NextResponse.json(
                { success: false, message: "Valid tournament_id is required" },
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
                { success: false, message: "Valid team_id is required" },
                { status: 400 }
            );
        }

        const tournamentId = Number(tournament_id);
        const teamId = Number(team_id);

        // Validate tournament & tenant authorization
        const [tournamentRows] = await connection.query(
            `
            SELECT id, academy_id, branch_id, tournament_name, tournament_code, team_fee, max_teams, status
            FROM cst_tournaments
            WHERE id = ? AND is_deleted = 0
            LIMIT 1
            `,
            [tournamentId]
        );

        if (tournamentRows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Tournament not found" },
                { status: 404 }
            );
        }

        const tournament = tournamentRows[0];
        if (!authUser.isSuperAdmin) {
            if (Number(tournament.academy_id) !== Number(authUser.academy_id)) {
                return NextResponse.json(
                    { success: false, message: "Tournament belongs to another academy" },
                    { status: 403 }
                );
            }
            if (authUser.isBranchAdmin && Number(tournament.branch_id) !== Number(authUser.branch_id)) {
                return NextResponse.json(
                    { success: false, message: "Tournament belongs to another branch" },
                    { status: 403 }
                );
            }
        }

        // Validate target team
        const [teamRows] = await connection.query(
            `SELECT id, academy_id, branch_id FROM cst_teams WHERE id = ? AND is_deleted = 0 LIMIT 1`,
            [teamId]
        );

        if (teamRows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Team not found" },
                { status: 404 }
            );
        }

        if (!authUser.isSuperAdmin) {
            if (teamRows[0].academy_id && Number(teamRows[0].academy_id) !== Number(authUser.academy_id)) {
                return NextResponse.json(
                    { success: false, message: "Team belongs to another academy" },
                    { status: 403 }
                );
            }
        }

        // Check duplicate registration
        const [duplicateRows] = await connection.query(
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

        if (duplicateRows.length > 0) {
            return NextResponse.json(
                { success: false, message: "Team is already registered in this tournament" },
                { status: 409 }
            );
        }

        // Max teams check
        if (tournament.max_teams !== null && Number(tournament.max_teams) > 0) {
            const [countRows] = await connection.query(
                `
                SELECT COUNT(id) AS total_teams
                FROM cst_tournament_teams
                WHERE tournament_id = ?
                AND is_deleted = 0
                `,
                [tournamentId]
            );

            if (Number(countRows[0].total_teams) >= Number(tournament.max_teams)) {
                return NextResponse.json(
                    { success: false, message: "Tournament has reached maximum team capacity" },
                    { status: 400 }
                );
            }
        }

        const finalTeamFee = team_fee !== undefined && team_fee !== null && String(team_fee).trim() !== ""
            ? Number(team_fee)
            : Number(tournament.team_fee || 0);

        if (!Number.isFinite(finalTeamFee) || finalTeamFee < 0) {
            return NextResponse.json(
                { success: false, message: "Team fee cannot be negative" },
                { status: 400 }
            );
        }

        const finalRegNo = registration_no && registration_no.trim()
            ? registration_no.trim().toUpperCase()
            : `TRN-${tournamentId}-TM-${teamId}`;

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
                finalRegNo,
                registered_date || new Date().toISOString().slice(0, 10),
                finalTeamFee,
                payment_status || "Pending",
                status || "Registered",
                authUser.id
            ]
        );

        await connection.commit();
        transactionStarted = false;

        return NextResponse.json(
            {
                success: true,
                message: "Team registered in tournament successfully",
                data: { id: result.insertId }
            },
            { status: 201 }
        );

    } catch (error) {
        if (transactionStarted) await connection.rollback();
        console.error("REGISTER TOURNAMENT TEAM ERROR:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to register tournament team",
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}
