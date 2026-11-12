import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import pool from "@/app/components/lib/db";
import { syncTournamentStatuses } from "./syncStatuses";
import { getAuthUser } from "@/app/components/lib/rbac";

// =====================================================
// GET - ALL TOURNAMENTS
// =====================================================
export async function GET(request) {
    const connection = await pool.getConnection();

    try {
        await syncTournamentStatuses(connection);

        const { searchParams } = new URL(request.url);

        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");

        const tournament_name = searchParams.get("tournament_name");
        const tournament_code = searchParams.get("tournament_code");

        const tournament_type = searchParams.get("tournament_type");
        const category = searchParams.get("category");
        const age_group = searchParams.get("age_group");

        const status = searchParams.get("status");

        const start_date = searchParams.get("start_date");
        const end_date = searchParams.get("end_date");

        const registration_start = searchParams.get("registration_start");
        const registration_end = searchParams.get("registration_end");

        let where = `
            WHERE t.is_deleted = 0
        `;

        const params = [];

        // ==========================================
        // ACADEMY FILTER
        // ==========================================

        const authUser = await getAuthUser(request);
        if (authUser) {
            if (authUser.isBranchAdmin && authUser.branch_id) {
                where += ` AND t.branch_id = ? AND t.academy_id = ?`;
                params.push(authUser.branch_id, authUser.academy_id);
            } else if (authUser.isAcademyAdmin && authUser.academy_id) {
                where += ` AND t.academy_id = ?`;
                params.push(authUser.academy_id);
                if (branch_id) {
                    where += ` AND t.branch_id = ?`;
                    params.push(branch_id);
                }
            } else if (!authUser.isSuperAdmin && authUser.academy_id) {
                where += ` AND t.academy_id = ?`;
                params.push(authUser.academy_id);
            } else {
                if (academy_id) { where += ` AND t.academy_id = ?`; params.push(academy_id); }
                if (branch_id) { where += ` AND t.branch_id = ?`; params.push(branch_id); }
            }
        } else {
            if (academy_id) { where += ` AND t.academy_id = ?`; params.push(academy_id); }
            if (branch_id) { where += ` AND t.branch_id = ?`; params.push(branch_id); }
        }

        // ==========================================
        // TOURNAMENT NAME
        // ==========================================

        if (tournament_name) {
            where += ` AND t.tournament_name LIKE ?`;
            params.push(`%${tournament_name}%`);
        }

        // ==========================================
        // TOURNAMENT CODE
        // ==========================================

        if (tournament_code) {
            where += ` AND t.tournament_code LIKE ?`;
            params.push(`%${tournament_code}%`);
        }

        // ==========================================
        // TOURNAMENT TYPE
        // ==========================================

        if (tournament_type) {
            where += ` AND t.tournament_type = ?`;
            params.push(tournament_type);
        }

        // ==========================================
        // CATEGORY
        // ==========================================

        if (category) {
            where += ` AND t.category = ?`;
            params.push(category);
        }

        // ==========================================
        // AGE GROUP
        // ==========================================

        if (age_group) {
            where += ` AND t.age_group = ?`;
            params.push(age_group);
        }

        // ==========================================
        // STATUS
        // ==========================================

        if (status) {
            where += ` AND t.status = ?`;
            params.push(status);
        }

        // ==========================================
        // START DATE
        // ==========================================

        if (start_date) {
            where += ` AND t.start_date >= ?`;
            params.push(start_date);
        }

        // ==========================================
        // END DATE
        // ==========================================

        if (end_date) {
            where += ` AND t.end_date <= ?`;
            params.push(end_date);
        }

        // ==========================================
        // REGISTRATION START
        // ==========================================

        if (registration_start) {
            where += ` AND t.registration_start >= ?`;
            params.push(registration_start);
        }

        // ==========================================
        // REGISTRATION END
        // ==========================================

        if (registration_end) {
            where += ` AND t.registration_end <= ?`;
            params.push(registration_end);
        }

        // ==========================================
        // GET DATA
        // ==========================================

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

            ORDER BY t.id DESC
            `,
            params
        );

        return NextResponse.json({
            success: true,
            message: "Tournaments fetched successfully",
            data: rows
        });

    } catch (error) {

        console.error("GET TOURNAMENTS ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch tournaments",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        connection.release();
    }
}


// =====================================================
// POST - CREATE TOURNAMENT
// =====================================================
export async function POST(request) {
    const connection = await pool.getConnection();

    try {
        const token = (await cookies()).get("auth_token")?.value;
        if (!token) {
            return NextResponse.json(
                { success: false, message: "Authentication required" },
                { status: 401 }
            );
        }

        if (!process.env.JWT_SECRET) {
            return NextResponse.json(
                { success: false, message: "Server authentication is not configured" },
                { status: 500 }
            );
        }

        let authenticatedUser;
        try {
            authenticatedUser = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            return NextResponse.json(
                { success: false, message: "Invalid or expired authentication" },
                { status: 401 }
            );
        }

        const userRole = String(authenticatedUser.user_type || "")
            .trim()
            .toLowerCase()
            .replace(/[_-]+/g, " ");
        if (!["academy admin", "super admin", "superadmin", "admin"].includes(userRole)) {
            return NextResponse.json(
                { success: false, message: "Only Academy Admins and Super Admins can create tournaments" },
                { status: 403 }
            );
        }

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

            status = "Draft"
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

        // ==========================================
        // CLEAN DATA
        // ==========================================

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

        // ==========================================
        // GET ACTUAL ACADEMY ID FROM BRANCH
        // ==========================================

        const actualAcademyId =
            academy_id !== null && academy_id !== ""
                ? Number(academy_id)
                : branchRows[0].academy_id;

        // ==========================================
        // CHECK DUPLICATE TOURNAMENT CODE
        // ==========================================

        const [codeRows] = await connection.query(
            `
            SELECT id
            FROM cst_tournaments
            WHERE academy_id = ?
            AND tournament_code = ?
            LIMIT 1
            `,
            [
                actualAcademyId,
                tournamentCode
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
        // INSERT
        // ==========================================

        const [result] = await connection.query(
            `
            INSERT INTO cst_tournaments
            (
                academy_id,
                branch_id,

                tournament_name,
                tournament_code,
                tournament_type,

                category,
                age_group,

                start_date,
                end_date,

                registration_start,
                registration_end,

                team_fee,

                max_teams,
                max_players_per_team,

                description,

                status,

                created_by
            )
            VALUES
            (
                ?,
                ?,

                ?,
                ?,
                ?,

                ?,
                ?,

                ?,
                ?,

                ?,
                ?,

                ?,

                ?,
                ?,

                ?,

                ?,

                ?
            )
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

                authenticatedUser.id
            ]
        );

        return NextResponse.json(
            {
                success: true,
                message: "Tournament created successfully",
                data: {
                    id: result.insertId,
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
                    created_by: authenticatedUser.id
                }
            },
            { status: 201 }
        );

    } catch (error) {

        console.error("POST TOURNAMENT ERROR:", error);

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
                message: "Failed to create tournament",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        connection.release();
    }
}