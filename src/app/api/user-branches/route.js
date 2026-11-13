import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation";


// GET - List user branches
export async function GET(request) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    let connection;

    try {
        connection = await pool.getConnection();

        const { searchParams } = new URL(request.url);

        const user_id = searchParams.get("user_id");
        const branch_id = searchParams.get("branch_id");
        const is_primary = searchParams.get("is_primary");
        const status = searchParams.get("status");
        const search = searchParams.get("search");

        const page = Math.max(
            Number(searchParams.get("page") || 1),
            1
        );

        const limit = Math.min(
            Math.max(
                Number(searchParams.get("limit") || 10),
                1
            ),
            100
        );

        const offset = (page - 1) * limit;

        const where = [];
        const values = [];

        where.push("ub.status >= 0");

        // Tenant Scoping
        if (authUser.isBranchAdmin) {
            where.push("b.academy_id = ?");
            values.push(authUser.academy_id);
            where.push("ub.branch_id = ?");
            values.push(authUser.branch_id);
        } else if (authUser.isAcademyAdmin) {
            where.push("b.academy_id = ?");
            values.push(authUser.academy_id);
            if (branch_id) {
                where.push("ub.branch_id = ?");
                values.push(branch_id);
            }
        } else if (authUser.isPlayer) {
            where.push("ub.user_id = ?");
            values.push(authUser.id);
        } else if (!authUser.isSuperAdmin) {
            where.push("b.academy_id = ?");
            values.push(authUser.academy_id);
            const allowedBranches = authUser.assignedBranchIds || (authUser.branch_id ? [authUser.branch_id] : []);
            if (allowedBranches.length > 0) {
                where.push("ub.branch_id IN (?)");
                values.push(allowedBranches);
            } else {
                where.push("1 = 0");
            }
        } else {
            // Super Admin can filter
            if (branch_id) {
                where.push("ub.branch_id = ?");
                values.push(branch_id);
            }
        }

        if (user_id && !authUser.isPlayer) {
            where.push("ub.user_id = ?");
            values.push(user_id);
        }

        if (is_primary !== null && is_primary !== "") {
            where.push("ub.is_primary = ?");
            values.push(is_primary);
        }

        if (status !== null && status !== "") {
            where.push("ub.status = ?");
            values.push(status);
        }

        if (search) {
            where.push(`
                (
                    CAST(ub.user_id AS CHAR) LIKE ?
                    OR CAST(ub.branch_id AS CHAR) LIKE ?
                    OR u.first_name LIKE ?
                    OR u.last_name LIKE ?
                    OR b.branch_name LIKE ?
                )
            `);

            const searchValue = `%${search}%`;

            values.push(
                searchValue,
                searchValue,
                searchValue,
                searchValue,
                searchValue
            );
        }

        const whereSql = where.length
            ? `WHERE ${where.join(" AND ")}`
            : "";

        // Count
        const [countRows] = await connection.query(
            `
            SELECT COUNT(*) AS total
            FROM cst_user_branches ub
            LEFT JOIN cst_users u
                ON u.id = ub.user_id
            LEFT JOIN cst_branch b
                ON b.id = ub.branch_id
            ${whereSql}
            `,
            values
        );

        const total = Number(countRows[0]?.total || 0);

        // List
        const [rows] = await connection.query(
            `
            SELECT
                ub.id,
                ub.user_id,
                ub.branch_id,
                ub.is_primary,
                ub.status,
                ub.created_at,
                ub.updated_at,

                u.first_name,
                u.last_name,
                u.email,

                b.branch_name

            FROM cst_user_branches ub

            LEFT JOIN cst_users u
                ON u.id = ub.user_id

            LEFT JOIN cst_branch b
                ON b.id = ub.branch_id

            ${whereSql}

            ORDER BY ub.id DESC

            LIMIT ? OFFSET ?
            `,
            [
                ...values,
                limit,
                offset,
            ]
        );

        return NextResponse.json({
            success: true,
            data: rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });

    } catch (error) {
        console.error("GET user branches error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch user branches",
                error: error.message,
            },
            { status: 500 }
        );

    } finally {
        if (connection) {
            connection.release();
        }
    }
}


// POST - Create user branch
export async function POST(request) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (authUser.isPlayer || (!authUser.isSuperAdmin && !authUser.isAcademyAdmin && !authUser.isBranchAdmin)) {
        return NextResponse.json(
            { success: false, message: "Forbidden: You are not authorized to assign branches" },
            { status: 403 }
        );
    }

    let connection;

    try {
        connection = await pool.getConnection();

        const body = await request.json();

        let {
            user_id,
            branch_id,
            is_primary = 0,
            status = 1,
        } = body;

        // Force branch_id for Branch Admin
        if (authUser.isBranchAdmin) {
            branch_id = authUser.branch_id;
        }

        if (!branch_id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "branch_id is required",
                },
                { status: 400 }
            );
        }

        // Check user belongs to authorized academy
        let userAppointmentNo = body.appointment_no || null;
        if (user_id) {
            let userSql = `SELECT id, appointment_no, academy_id FROM cst_users WHERE id = ?`;
            const userParams = [user_id];
            if (!authUser.isSuperAdmin) {
                userSql += ` AND academy_id = ?`;
                userParams.push(authUser.academy_id);
            }
            userSql += ` LIMIT 1`;

            const [userRows] = await connection.query(userSql, userParams);

            if (userRows.length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "User not found or belongs to another academy",
                    },
                    { status: 404 }
                );
            }
            if (!userAppointmentNo) {
                userAppointmentNo = userRows[0].appointment_no;
            }
        }

        if (!userAppointmentNo) {
            userAppointmentNo = `UB-${user_id || "0"}-${branch_id}`;
        }

        // Check branch belongs to authorized academy
        let branchSql = `SELECT id, academy_id FROM cst_branch WHERE id = ?`;
        const branchParams = [branch_id];
        if (!authUser.isSuperAdmin) {
            branchSql += ` AND academy_id = ?`;
            branchParams.push(authUser.academy_id);
        }
        branchSql += ` LIMIT 1`;

        const [branchRows] = await connection.query(branchSql, branchParams);

        if (branchRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Branch not found or belongs to another academy",
                },
                { status: 404 }
            );
        }

        // Check duplicate
        const [duplicateRows] = await connection.query(
            `
            SELECT id
            FROM cst_user_branches
            WHERE user_id = ?
              AND branch_id = ?
            LIMIT 1
            `,
            [
                user_id || null,
                branch_id,
            ]
        );

        if (duplicateRows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User is already assigned to this branch",
                },
                { status: 409 }
            );
        }

        const [result] = await connection.query(
            `
            INSERT INTO cst_user_branches
            (
                user_id,
                branch_id,
                appointment_no,
                is_primary,
                status
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                user_id || null,
                branch_id,
                userAppointmentNo,
                is_primary ? 1 : 0,
                status ? 1 : 0,
            ]
        );

        return NextResponse.json(
            {
                success: true,
                message: "User branch created successfully",
                data: {
                    id: result.insertId,
                },
            },
            { status: 201 }
        );

    } catch (error) {
        console.error("POST user branch error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to create user branch",
                error: error.message,
            },
            { status: 500 }
        );

    } finally {
        if (connection) {
            connection.release();
        }
    }
}