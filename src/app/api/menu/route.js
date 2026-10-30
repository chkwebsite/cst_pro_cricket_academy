import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { ensureEcommerceTables } from "@/app/components/lib/ecommerce-init";


// GET - List menus
export async function GET(request) {
    let connection;

    try {
        if (!globalThis._ecommerceInitialized) {
            ensureEcommerceTables().catch((e) => console.warn("Ecommerce init error:", e));
        }
        connection = await pool.getConnection();

        // Auto-ensure "Public Users" menu under Appointments & Users
        try {
            const [existingMenu] = await connection.query(
                "SELECT id FROM cst_menu WHERE menu_url = '/next_panel/public-users' LIMIT 1"
            );
            if (!existingMenu || existingMenu.length === 0) {
                const [parentRows] = await connection.query(
                    `SELECT id FROM cst_menu
                     WHERE (id = 17 OR menu_key = 'appointments-users' OR LOWER(menu_title) LIKE '%appointment%')
                       AND is_deleted = 0
                     LIMIT 1`
                );
                const parentId = parentRows && parentRows.length > 0 ? parentRows[0].id : 17;
                const [ins] = await connection.query(
                    `INSERT INTO cst_menu (
                        parent_id, menu_key, menu_name, menu_title, menu_icon, menu_url,
                        menu_type, menu_order, is_sidebar, is_active, status, is_deleted
                    ) VALUES (?, 'public-users', 'Public users', 'Public Users', 'users', '/next_panel/public-users', 'link', 6, 1, 1, 1, 0)`,
                    [parentId]
                );
                if (ins?.insertId) {
                    await connection.query(
                        `INSERT IGNORE INTO cst_menu_permissions (menu_id, permission_id)
                         SELECT ?, id FROM cst_permissions WHERE status = 1`,
                        [ins.insertId]
                    );
                }
            }
        } catch (_) {}

        const { searchParams } = new URL(request.url);

        const parent_id = searchParams.get("parent_id");
        const menu_type = searchParams.get("menu_type");
        const is_sidebar = searchParams.get("is_sidebar");
        const is_active = searchParams.get("is_active");
        const status = searchParams.get("status");
        const is_deleted = searchParams.get("is_deleted");
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

        if (parent_id !== null && parent_id !== "") {
            if (parent_id === "0" || parent_id === "null") {
                where.push("m.parent_id IS NULL");
            } else {
                where.push("m.parent_id = ?");
                values.push(parent_id);
            }
        }

        if (menu_type) {
            where.push("m.menu_type = ?");
            values.push(menu_type);
        }

        if (is_sidebar !== null && is_sidebar !== "") {
            where.push("m.is_sidebar = ?");
            values.push(is_sidebar);
        }

        if (is_active !== null && is_active !== "") {
            where.push("m.is_active = ?");
            values.push(is_active);
        }

        if (status !== null && status !== "") {
            where.push("m.status = ?");
            values.push(status);
        }

        if (is_deleted !== null && is_deleted !== "") {
            where.push("m.is_deleted = ?");
            values.push(is_deleted);
        } else {
            where.push("m.is_deleted = 0");
        }

        if (search) {
            where.push(`
                (
                    m.menu_key LIKE ?
                    OR m.menu_name LIKE ?
                    OR m.menu_title LIKE ?
                    OR m.menu_url LIKE ?
                    OR pm.menu_name LIKE ?
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

            FROM cst_menu m

            LEFT JOIN cst_menu pm
                ON pm.id = m.parent_id

            ${whereSql}
            `,
            values
        );

        const total = Number(countRows[0]?.total || 0);

        // List
        const [rows] = await connection.query(
            `
            SELECT
                m.id,
                m.parent_id,
                m.menu_key,
                m.menu_name,
                m.menu_title,
                m.menu_icon,
                m.menu_url,
                m.menu_type,
                m.menu_order,
                m.is_sidebar,
                m.is_active,
                m.status,
                m.is_deleted,
                m.created_at,
                m.updated_at,

                pm.menu_name AS parent_menu_name,
                pm.menu_title AS parent_menu_title

            FROM cst_menu m

            LEFT JOIN cst_menu pm
                ON pm.id = m.parent_id

            ${whereSql}

            ORDER BY
                m.menu_order ASC,
                m.id ASC

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
        console.error("GET menu error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch menus",
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


// POST - Create menu
export async function POST(request) {
    let connection;

    try {
        connection = await pool.getConnection();

        const body = await request.json();

        const {
            parent_id = null,
            menu_key,
            menu_name,
            menu_title,
            menu_icon = null,
            menu_url = null,
            menu_type = "module",
            menu_order = 0,
            is_sidebar = 1,
            is_active = 1,
            status = 1,
        } = body;

        // Required validation
        if (!menu_key) {
            return NextResponse.json(
                {
                    success: false,
                    message: "menu_key is required",
                },
                { status: 400 }
            );
        }

        if (!menu_name) {
            return NextResponse.json(
                {
                    success: false,
                    message: "menu_name is required",
                },
                { status: 400 }
            );
        }

        if (!menu_title) {
            return NextResponse.json(
                {
                    success: false,
                    message: "menu_title is required",
                },
                { status: 400 }
            );
        }

        // Validate menu type
        const allowedMenuTypes = [
            "module",
            "link",
            "heading",
        ];

        if (!allowedMenuTypes.includes(menu_type)) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "menu_type must be module, link, or heading",
                },
                { status: 400 }
            );
        }

        // Check duplicate menu_key
        const [duplicateRows] = await connection.query(
            `
            SELECT id
            FROM cst_menu
            WHERE menu_key = ?
            LIMIT 1
            `,
            [menu_key]
        );

        if (duplicateRows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "menu_key already exists",
                },
                { status: 409 }
            );
        }

        // Check parent menu
        if (parent_id !== null && parent_id !== "") {
            const [parentRows] = await connection.query(
                `
                SELECT id
                FROM cst_menu
                WHERE id = ?
                  AND is_deleted = 0
                LIMIT 1
                `,
                [parent_id]
            );

            if (parentRows.length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Parent menu not found",
                    },
                    { status: 404 }
                );
            }
        }

        const [result] = await connection.query(
            `
            INSERT INTO cst_menu
            (
                parent_id,
                menu_key,
                menu_name,
                menu_title,
                menu_icon,
                menu_url,
                menu_type,
                menu_order,
                is_sidebar,
                is_active,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                parent_id || null,
                menu_key,
                menu_name,
                menu_title,
                menu_icon || null,
                menu_url || null,
                menu_type,
                Number(menu_order),
                Number(is_sidebar) ? 1 : 0,
                Number(is_active) ? 1 : 0,
                Number(status) ? 1 : 0,
            ]
        );

        return NextResponse.json(
            {
                success: true,
                message: "Menu created successfully",
                data: {
                    id: result.insertId,
                },
            },
            { status: 201 }
        );

    } catch (error) {
        console.error("POST menu error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to create menu",
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