import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { syncTournamentStatuses } from "../syncStatuses";

// =====================================================
// GET - SINGLE TOURNAMENT
// =====================================================
export async function GET(request, { params }) {
    const connection = await pool.getConnection();

    try {
        await syncTournamentStatuses(connection);

        const { id } = await params;

        const { searchParams } = new URL(request.url);

        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");

        let where = `
            WHERE t.id = ?
            AND t.is_deleted = 0
        `;

        const queryParams = [id];

        // ==========================================
        // ACADEMY FILTER
        // ==========================================

        if (academy_id) {
            where += ` AND t.academy_id = ?`;
            queryParams.push(academy_id);
        }

        // ==========================================
        // BRANCH FILTER
        // ==========================================

        if (branch_id) {
            where += ` AND t.branch_id = ?`;
            queryParams.push(branch_id);
        }

        const [rows] = await connection.query(
            `
            SELECT
                t.id,

                t.academy_id,
                a.academy_name,

                t.branch_id,
                b.branch_name,

                t.tournament_name,
                t.tournament_code,
                t.tournament_type,

                t.category,
                t.age_group,

                t.start_date,
                t.end_date,

                t.registration_start,
                t.registration_end,

                t.team_fee,

                t.max_teams,
                t.max_players_per_team,

                t.description,

                t.status,
                t.is_deleted,

                t.created_by,
                u.first_name AS created_by_name,

                t.created_at,
                t.updated_at

            FROM cst_tournaments t

            LEFT JOIN cst_academy a
                ON a.id = t.academy_id

            INNER JOIN cst_branch b
                ON b.id = t.branch_id

            LEFT JOIN cst_users u
                ON u.id = t.created_by

            ${where}

            LIMIT 1
            `,
            queryParams
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Tournament not found"
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Tournament fetched successfully",
            data: rows[0]
        });

    } catch (error) {

        console.error("GET SINGLE TOURNAMENT ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch tournament",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        connection.release();
    }
}


// =====================================================
// PUT - UPDATE TOURNAMENT
// =====================================================
export async function PUT(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        const body = await request.json();

        const {
            academy_id = null,
            branch_id,

            tournament_name,
            tournament_code,

            tournament_type = "Round Robin",

            category = null,
            age_group = null,

            start_date,
            end_date = null,

            registration_start = null,
            registration_end = null,

            team_fee = 0,

            max_teams = null,
            max_players_per_team = null,

            description = null,

            status = "Draft",

            created_by = null
        } = body;

        // ==========================================
        // VALIDATION
        // ==========================================

        if (!branch_id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Branch ID is required"
                },
                { status: 400 }
            );
        }

        if (!tournament_name || !tournament_name.trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Tournament name is required"
                },
                { status: 400 }
            );
        }

        if (!tournament_code || !tournament_code.trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Tournament code is required"
                },
                { status: 400 }
            );
        }

        if (!start_date) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Start date is required"
                },
                { status: 400 }
            );
        }

        const tournamentName = tournament_name.trim();
        const tournamentCode = tournament_code.trim().toUpperCase();

        const teamFee = Number(team_fee);

        if (teamFee < 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Team fee cannot be negative"
                },
                { status: 400 }
            );
        }

        // ==========================================
        // CHECK EXISTING TOURNAMENT
        // ==========================================

        const [existingRows] = await connection.query(
            `
            SELECT id
            FROM cst_tournaments
            WHERE id = ?
            AND is_deleted = 0
            LIMIT 1
            `,
            [id]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Tournament not found"
                },
                { status: 404 }
            );
        }

        // ==========================================
        // CHECK BRANCH
        // ==========================================

        let branchQuery = `
            SELECT
                id,
                academy_id
            FROM cst_branch
            WHERE id = ?
        `;

        const branchParams = [branch_id];

        if (academy_id !== null && academy_id !== "") {
            branchQuery += ` AND academy_id = ?`;
            branchParams.push(academy_id);
        }

        branchQuery += ` LIMIT 1`;

        const [branchRows] = await connection.query(
            branchQuery,
            branchParams
        );

        if (branchRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid branch or branch does not belong to selected academy"
                },
                { status: 400 }
            );
        }

        const actualAcademyId =
            academy_id !== null && academy_id !== ""
                ? Number(academy_id)
                : branchRows[0].academy_id;

        // ==========================================
        // CHECK DUPLICATE CODE
        // ==========================================

        const [codeRows] = await connection.query(
            `
            SELECT id
            FROM cst_tournaments
            WHERE academy_id = ?
            AND tournament_code = ?
            AND id != ?
            LIMIT 1
            `,
            [
                actualAcademyId,
                tournamentCode,
                id
            ]
        );

        if (codeRows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Tournament code already exists"
                },
                { status: 409 }
            );
        }

        // ==========================================
        // DATE VALIDATION
        // ==========================================

        if (end_date && end_date < start_date) {
            return NextResponse.json(
                {
                    success: false,
                    message: "End date cannot be before start date"
                },
                { status: 400 }
            );
        }

        if (
            registration_start &&
            registration_end &&
            registration_end < registration_start
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Registration end date cannot be before registration start date"
                },
                { status: 400 }
            );
        }

        // ==========================================
        // UPDATE
        // ==========================================

        await connection.query(
            `
            UPDATE cst_tournaments

            SET
                academy_id = ?,
                branch_id = ?,

                tournament_name = ?,
                tournament_code = ?,
                tournament_type = ?,

                category = ?,
                age_group = ?,

                start_date = ?,
                end_date = ?,

                registration_start = ?,
                registration_end = ?,

                team_fee = ?,

                max_teams = ?,
                max_players_per_team = ?,

                description = ?,

                status = ?,

                created_by = ?

            WHERE id = ?
            `,
            [
                actualAcademyId,
                branch_id,

                tournamentName,
                tournamentCode,
                tournament_type,

                category,
                age_group,

                start_date,
                end_date,

                registration_start,
                registration_end,

                teamFee,

                max_teams,
                max_players_per_team,

                description,

                status,

                created_by,

                id
            ]
        );

        return NextResponse.json({
            success: true,
            message: "Tournament updated successfully",
            data: {
                id: Number(id),
                academy_id: actualAcademyId,
                branch_id: Number(branch_id),

                tournament_name: tournamentName,
                tournament_code: tournamentCode,
                tournament_type,

                category,
                age_group,

                start_date,
                end_date,

                registration_start,
                registration_end,

                team_fee: teamFee,

                max_teams,
                max_players_per_team,

                description,

                status,
                created_by
            }
        });

    } catch (error) {

        console.error("PUT TOURNAMENT ERROR:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Tournament code already exists"
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update tournament",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        connection.release();
    }
}


// =====================================================
// DELETE - SOFT DELETE
// =====================================================
export async function DELETE(request, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        const { searchParams } = new URL(request.url);

        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");

        let where = `
            WHERE id = ?
            AND is_deleted = 0
        `;

        const queryParams = [id];

        if (academy_id) {
            where += ` AND academy_id = ?`;
            queryParams.push(academy_id);
        }

        if (branch_id) {
            where += ` AND branch_id = ?`;
            queryParams.push(branch_id);
        }

        // ==========================================
        // CHECK TOURNAMENT
        // ==========================================

        const [rows] = await connection.query(
            `
            SELECT id
            FROM cst_tournaments
            ${where}
            LIMIT 1
            `,
            queryParams
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Tournament not found"
                },
                { status: 404 }
            );
        }

        // ==========================================
        // SOFT DELETE
        // ==========================================

        await connection.query(
            `
            UPDATE cst_tournaments
            SET
                is_deleted = 1,
                status = 'Cancelled'
            WHERE id = ?
            `,
            [id]
        );

        return NextResponse.json({
            success: true,
            message: "Tournament deleted successfully"
        });

    } catch (error) {

        console.error("DELETE TOURNAMENT ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete tournament",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        connection.release();
    }
}