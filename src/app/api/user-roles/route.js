import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { ensurePlayerAccess } from "@/app/components/lib/playerAccessInit.js";

// GET - List user roles
export async function GET(request) {
    let connection;

    try {
        connection = await pool.getConnection();
        await ensurePlayerAccess(connection);

        const { searchParams } = new URL(request.url);

        const user_id = searchParams.get("user_id");
        const role_id = searchParams.get("role_id");
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
            1000
        );

        const offset = (page - 1) * limit;

        const where = [];
        const values = [];

        where.push("1 = 1");

        if (user_id) {
            where.push("ur.user_id = ?");
            values.push(user_id);
        }

        if (role_id) {
            where.push("ur.role_id = ?");
            values.push(role_id);
        }

        if (search) {
            where.push(`
                (
                    CAST(ur.user_id AS CHAR) LIKE ?
                    OR CAST(ur.role_id AS CHAR) LIKE ?
                    OR u.first_name LIKE ?
                    OR u.last_name LIKE ?
                    OR r.role_name LIKE ?
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

        const whereSql = `WHERE ${where.join(" AND ")}`;

        // Count
        const [countRows] = await connection.query(
            `
            SELECT COUNT(*) AS total
            FROM cst_user_roles ur

            LEFT JOIN cst_users u
                ON u.id = ur.user_id

            LEFT JOIN cst_roles r
                ON r.id = ur.role_id

            ${whereSql}
            `,
            values
        );

        const total = Number(countRows[0]?.total || 0);

        // List
        const [rows] = await connection.query(
            `
            SELECT
                ur.id,
                ur.user_id,
                ur.role_id,
                ur.created_at,

                u.first_name,
                u.last_name,
                u.email,

                r.role_name

            FROM cst_user_roles ur

            LEFT JOIN cst_users u
                ON u.id = ur.user_id

            LEFT JOIN cst_roles r
                ON r.id = ur.role_id

            ${whereSql}

            ORDER BY ur.id DESC

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
        console.error("GET user roles error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch user roles",
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


// POST - Create user role
export async function POST(request) {
    let connection;

    try {
        connection = await pool.getConnection();

        const body = await request.json();

        const {
            user_id,
            role_id,
        } = body;

        if (!user_id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "user_id is required",
                },
                { status: 400 }
            );
        }

        if (!role_id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "role_id is required",
                },
                { status: 400 }
            );
        }

        // Check user
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

        // Check role
        const [roleRows] = await connection.query(
            `
            SELECT id
            FROM cst_roles
            WHERE id = ?
            LIMIT 1
            `,
            [role_id]
        );

        if (roleRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Role not found",
                },
                { status: 404 }
            );
        }

        // Check duplicate
        const [duplicateRows] = await connection.query(
            `
            SELECT id
            FROM cst_user_roles
            WHERE user_id = ?
              AND role_id = ?
            LIMIT 1
            `,
            [
                user_id,
                role_id,
            ]
        );

        if (duplicateRows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "This role is already assigned to the user",
                },
                { status: 409 }
            );
        }

        const [result] = await connection.query(
            `
            INSERT INTO cst_user_roles
            (
                user_id,
                role_id
            )
            VALUES (?, ?)
            `,
            [
                user_id,
                role_id,
            ]
        );

        // Keep user_type in cst_users aligned with assigned role
        try {
            if (roleRows[0]?.role_name) {
                await connection.query(
                    "UPDATE cst_users SET user_type = ? WHERE id = ?",
                    [roleRows[0].role_name, user_id]
                );
            }
        } catch (_) {}

        return NextResponse.json(
            {
                success: true,
                message: "User role created successfully",
                data: {
                    id: result.insertId,
                },
            },
            { status: 201 }
        );

    } catch (error) {
        console.error("POST user role error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to create user role",
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