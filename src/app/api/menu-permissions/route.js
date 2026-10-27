import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


// GET - List menu permissions
export async function GET(request) {
    let connection;

    try {
        connection = await pool.getConnection();

        const { searchParams } = new URL(request.url);

        const menu_id = searchParams.get("menu_id");
        const permission_id = searchParams.get("permission_id");
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

        if (menu_id) {
            where.push("mp.menu_id = ?");
            values.push(menu_id);
        }

        if (permission_id) {
            where.push("mp.permission_id = ?");
            values.push(permission_id);
        }

        if (search) {
            where.push(`
                (
                    CAST(mp.menu_id AS CHAR) LIKE ?
                    OR CAST(mp.permission_id AS CHAR) LIKE ?
                    OR m.menu_key LIKE ?
                    OR m.menu_name LIKE ?
                    OR m.menu_title LIKE ?
                    OR p.module_name LIKE ?
                    OR p.permission_name LIKE ?
                )
            `);

            const searchValue = `%${search}%`;

            values.push(
                searchValue,
                searchValue,
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

            FROM cst_menu_permissions mp

            LEFT JOIN cst_menu m
                ON m.id = mp.menu_id

            LEFT JOIN cst_permissions p
                ON p.id = mp.permission_id

            ${whereSql}
            `,
            values
        );

        const total = Number(
            countRows[0]?.total || 0
        );

        // List
        const [rows] = await connection.query(
            `
            SELECT
                mp.id,
                mp.menu_id,
                mp.permission_id,
                mp.created_at,

                m.menu_key,
                m.menu_name,
                m.menu_title,
                m.menu_icon,
                m.menu_url,

                p.module_name,
                p.permission_name

            FROM cst_menu_permissions mp

            LEFT JOIN cst_menu m
                ON m.id = mp.menu_id

            LEFT JOIN cst_permissions p
                ON p.id = mp.permission_id

            ${whereSql}

            ORDER BY mp.id DESC

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
                totalPages: Math.ceil(
                    total / limit
                ),
            },
        });

    } catch (error) {
        console.error(
            "GET menu permissions error:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Failed to fetch menu permissions",
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


// POST - Create menu permission
export async function POST(request) {
    let connection;

    try {
        connection = await pool.getConnection();

        const body = await request.json();

        const {
            menu_id,
            permission_id,
        } = body;

        if (!menu_id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "menu_id is required",
                },
                { status: 400 }
            );
        }

        if (!permission_id) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "permission_id is required",
                },
                { status: 400 }
            );
        }

        // Check menu
        const [menuRows] = await connection.query(
            `
            SELECT id
            FROM cst_menu
            WHERE id = ?
            LIMIT 1
            `,
            [menu_id]
        );

        if (menuRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Menu not found",
                },
                { status: 404 }
            );
        }

        // Check permission
        const [permissionRows] =
            await connection.query(
                `
                SELECT id
                FROM cst_permissions
                WHERE id = ?
                LIMIT 1
                `,
                [permission_id]
            );

        if (permissionRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Permission not found",
                },
                { status: 404 }
            );
        }

        // Check duplicate
        const [duplicateRows] =
            await connection.query(
                `
                SELECT id
                FROM cst_menu_permissions
                WHERE menu_id = ?
                  AND permission_id = ?
                LIMIT 1
                `,
                [
                    menu_id,
                    permission_id,
                ]
            );

        if (duplicateRows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "This permission is already assigned to this menu",
                },
                { status: 409 }
            );
        }

        const [result] =
            await connection.query(
                `
                INSERT INTO cst_menu_permissions
                (
                    menu_id,
                    permission_id
                )
                VALUES (?, ?)
                `,
                [
                    menu_id,
                    permission_id,
                ]
            );

        return NextResponse.json(
            {
                success: true,
                message:
                    "Menu permission created successfully",
                data: {
                    id: result.insertId,
                },
            },
            { status: 201 }
        );

    } catch (error) {
        console.error(
            "POST menu permission error:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Failed to create menu permission",
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