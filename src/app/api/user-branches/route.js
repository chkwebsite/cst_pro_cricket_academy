import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


// GET - List user branches
export async function GET(request) {
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

        if (user_id) {
            where.push("ub.user_id = ?");
            values.push(user_id);
        }

        if (branch_id) {
            where.push("ub.branch_id = ?");
            values.push(branch_id);
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
    let connection;

    try {
        connection = await pool.getConnection();

        const body = await request.json();

        const {
            user_id,
            branch_id,
            is_primary = 0,
            status = 1,
        } = body;

        if (!branch_id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "branch_id is required",
                },
                { status: 400 }
            );
        }

        // Check user
        if (user_id) {
            const [userRows] = await connection.query(
                `
                SELECT id
                FROM cst_users
                WHERE id = ?
                LIMIT 1
                `,
                [user_id]
            );

            if (userRows.length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "User not found",
                    },
                    { status: 404 }
                );
            }
        }

        // Check branch
        const [branchRows] = await connection.query(
            `
            SELECT id
            FROM cst_branch
            WHERE id = ?
            LIMIT 1
            `,
            [branch_id]
        );

        if (branchRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Branch not found",
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
                is_primary,
                status
            )
            VALUES (?, ?, ?, ?)
            `,
            [
                user_id || null,
                branch_id,
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