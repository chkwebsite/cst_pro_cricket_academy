import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";

let schemaEnsured = false;
async function ensureTeamsSchema(connection) {
    if (schemaEnsured) return;
    try {
        const [academyCols] = await connection.query(
            "SHOW COLUMNS FROM cst_teams LIKE 'academy_id'"
        );
        if (academyCols.length === 0) {
            await connection.query(
                "ALTER TABLE cst_teams ADD COLUMN academy_id INT NULL AFTER id"
            );
        }

        const [branchCols] = await connection.query(
            "SHOW COLUMNS FROM cst_teams LIKE 'branch_id'"
        );
        if (branchCols.length === 0) {
            await connection.query(
                "ALTER TABLE cst_teams ADD COLUMN branch_id INT NULL AFTER academy_id"
            );
        }

        await connection.query(`
            UPDATE cst_teams
            SET
                academy_id = COALESCE(NULLIF(academy_id, 0), 1),
                branch_id = COALESCE(NULLIF(branch_id, 0), 1)
            WHERE academy_id IS NULL OR academy_id = 0 OR branch_id IS NULL OR branch_id = 0
        `);

        schemaEnsured = true;
    } catch (err) {
        console.error("ensureTeamsSchema error:", err.message);
    }
}

/*
|--------------------------------------------------------------------------
| GET ALL TEAMS (Tenant Isolated)
|--------------------------------------------------------------------------
*/

export async function GET(request) {
    const connection = await pool.getConnection();

    try {
        await ensureTeamsSchema(connection);

        const { user: authUser } = await getAuthenticatedUser(request);

        const { searchParams } = new URL(request.url);

        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");
        const team_name = searchParams.get("team_name") || "";
        const team_code = searchParams.get("team_code") || "";
        const team_type = searchParams.get("team_type") || "";
        const category = searchParams.get("category") || "";
        const age_group = searchParams.get("age_group") || "";
        const status = searchParams.get("status");

        let sql = `
            SELECT
                t.id,
                t.academy_id,
                a.academy_name,

                t.branch_id,
                b.branch_name,

                t.team_name,
                t.team_code,
                t.team_type,
                t.category,
                t.age_group,

                t.status,
                t.is_deleted,

                t.created_by,
                u.first_name AS created_by_name,

                t.created_at,
                t.updated_at

            FROM cst_teams t

            LEFT JOIN cst_academy a
                ON a.id = t.academy_id

            LEFT JOIN cst_branch b
                ON b.id = t.branch_id

            LEFT JOIN cst_users u
                ON u.id = t.created_by

            WHERE t.is_deleted = 0
        `;

        const params = [];

        // Tenant Isolation
        if (authUser) {
            if (authUser.isPlayer) {
                sql += ` AND (
                    (t.academy_id = ? AND (t.branch_id = ? OR t.branch_id IS NULL))
                    OR t.id IN (SELECT team_id FROM cst_team_players WHERE user_id = ? AND is_deleted = 0)
                )`;
                params.push(Number(authUser.academy_id), Number(authUser.branch_id), Number(authUser.id));
            } else if (authUser.isBranchAdmin) {
                sql += ` AND t.academy_id = ? AND t.branch_id = ?`;
                params.push(Number(authUser.academy_id), Number(authUser.branch_id));
            } else if (authUser.isAcademyAdmin) {
                sql += ` AND t.academy_id = ?`;
                params.push(Number(authUser.academy_id));
                if (branch_id) {
                    sql += ` AND t.branch_id = ?`;
                    params.push(Number(branch_id));
                }
            } else if (!authUser.isSuperAdmin && authUser.academy_id) {
                sql += ` AND t.academy_id = ?`;
                params.push(Number(authUser.academy_id));
                if (Array.isArray(authUser.assignedBranchIds) && authUser.assignedBranchIds.length > 0) {
                    const placeholders = authUser.assignedBranchIds.map(() => "?").join(",");
                    sql += ` AND t.branch_id IN (${placeholders})`;
                    params.push(...authUser.assignedBranchIds.map(Number));
                } else if (authUser.branch_id) {
                    sql += ` AND t.branch_id = ?`;
                    params.push(Number(authUser.branch_id));
                }
            } else {
                // Super Admin
                if (academy_id !== null && academy_id !== "") {
                    sql += ` AND t.academy_id = ?`;
                    params.push(Number(academy_id));
                }
                if (branch_id !== null && branch_id !== "") {
                    sql += ` AND t.branch_id = ?`;
                    params.push(Number(branch_id));
                }
            }
        } else {
            // Unauthenticated (public website lookup)
            if (academy_id !== null && academy_id !== "") {
                sql += ` AND t.academy_id = ?`;
                params.push(Number(academy_id));
            }
            if (branch_id !== null && branch_id !== "") {
                sql += ` AND t.branch_id = ?`;
                params.push(Number(branch_id));
            }
        }

        if (team_name) {
            sql += ` AND t.team_name LIKE ?`;
            params.push(`%${team_name}%`);
        }

        if (team_code) {
            sql += ` AND t.team_code LIKE ?`;
            params.push(`%${team_code}%`);
        }

        if (team_type) {
            sql += ` AND t.team_type = ?`;
            params.push(team_type);
        }

        if (category) {
            sql += ` AND t.category LIKE ?`;
            params.push(`%${category}%`);
        }

        if (age_group) {
            sql += ` AND t.age_group LIKE ?`;
            params.push(`%${age_group}%`);
        }

        if (status !== null && status !== "" && status !== undefined) {
            sql += ` AND t.status = ?`;
            params.push(Number(status));
        }

        sql += ` ORDER BY t.id DESC`;

        const [rows] = await connection.query(sql, params);

        return NextResponse.json({
            success: true,
            message: "Teams fetched successfully",
            total: rows.length,
            data: rows
        });

    } catch (error) {
        console.error("GET TEAMS ERROR:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch teams",
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
| CREATE TEAM
|--------------------------------------------------------------------------
*/

export async function POST(request) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (authUser.isPlayer) {
        return NextResponse.json(
            { success: false, message: "Forbidden. Players cannot create teams." },
            { status: 403 }
        );
    }

    const connection = await pool.getConnection();

    try {
        await ensureTeamsSchema(connection);

        const body = await request.json();

        const {
            academy_id,
            branch_id,
            team_name,
            team_code,
            team_type,
            category,
            age_group,
            status
        } = body;

        if (!team_name || !team_name.toString().trim()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Team name is required"
                },
                { status: 400 }
            );
        }

        const allowedTeamTypes = [
            "Academy",
            "External",
            "Club",
            "School",
            "Corporate",
            "Other"
        ];

        const finalTeamType =
            team_type && team_type.toString().trim()
                ? team_type.toString().trim()
                : "Academy";

        if (!allowedTeamTypes.includes(finalTeamType)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid team type"
                },
                { status: 400 }
            );
        }

        // Enforce tenant boundary
        let finalAcademyId = null;
        let finalBranchId = null;

        if (authUser.isSuperAdmin) {
            finalAcademyId = academy_id ? Number(academy_id) : 1;
            finalBranchId = branch_id ? Number(branch_id) : null;
        } else if (authUser.isAcademyAdmin) {
            finalAcademyId = Number(authUser.academy_id);
            finalBranchId = branch_id ? Number(branch_id) : (authUser.branch_id ? Number(authUser.branch_id) : null);
        } else if (authUser.isBranchAdmin) {
            finalAcademyId = Number(authUser.academy_id);
            finalBranchId = Number(authUser.branch_id);
        } else {
            // Staff / Coach
            finalAcademyId = Number(authUser.academy_id);
            finalBranchId = authUser.branch_id ? Number(authUser.branch_id) : (branch_id ? Number(branch_id) : null);
            const allowed = (authUser.assignedBranchIds || [authUser.branch_id]).map(Number);
            if (finalBranchId && !allowed.includes(finalBranchId)) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized branch selection" },
                    { status: 403 }
                );
            }
        }

        if (!finalAcademyId) {
            return NextResponse.json(
                { success: false, message: "Academy is required to create a team" },
                { status: 400 }
            );
        }

        // Verify branch belongs to academy if provided
        if (finalBranchId) {
            const [bRows] = await connection.query(
                `SELECT id FROM cst_branch WHERE id = ? AND academy_id = ? AND is_deleted = 0 LIMIT 1`,
                [finalBranchId, finalAcademyId]
            );
            if (bRows.length === 0) {
                return NextResponse.json(
                    { success: false, message: "Branch does not belong to authorized academy" },
                    { status: 400 }
                );
            }
        }

        // Check duplicate code within academy
        const finalTeamCode =
            team_code && team_code.toString().trim()
                ? team_code.toString().trim().toUpperCase()
                : null;

        if (finalTeamCode) {
            const [duplicateRows] = await connection.query(
                `
                SELECT id
                FROM cst_teams
                WHERE team_code = ?
                AND academy_id = ?
                AND is_deleted = 0
                LIMIT 1
                `,
                [finalTeamCode, finalAcademyId]
            );

            if (duplicateRows.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Team code already exists in this academy"
                    },
                    { status: 409 }
                );
            }
        }

        const [result] = await connection.query(
            `
            INSERT INTO cst_teams (
                academy_id,
                branch_id,
                team_name,
                team_code,
                team_type,
                category,
                age_group,
                status,
                created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                finalAcademyId,
                finalBranchId || null,
                team_name.toString().trim(),
                finalTeamCode,
                finalTeamType,
                category ? category.toString().trim() : null,
                age_group ? age_group.toString().trim() : null,
                status !== null && status !== undefined && status !== "" ? Number(status) : 1,
                authUser.id
            ]
        );

        return NextResponse.json(
            {
                success: true,
                message: "Team created successfully",
                data: {
                    id: result.insertId,
                    academy_id: finalAcademyId,
                    branch_id: finalBranchId
                }
            },
            { status: 201 }
        );

    } catch (error) {
        console.error("CREATE TEAM ERROR:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to create team",
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}
