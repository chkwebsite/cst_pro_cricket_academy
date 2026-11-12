import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


// GET - Single menu
export async function GET(request, { params }) {
    let connection;

    try {
        connection = await pool.getConnection();

        const { id } = await params;

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

            WHERE m.id = ?

            LIMIT 1
            `,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Menu not found",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });

    } catch (error) {
        console.error("GET single menu error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch menu",
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


// PUT - Update menu
export async function PUT(request, { params }) {
    let connection;

    try {
        connection = await pool.getConnection();

        const { id } = await params;

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
            is_deleted = 0,
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

        // Check existing menu
        const [existingRows] = await connection.query(
            `
            SELECT id
            FROM cst_menu
            WHERE id = ?
            LIMIT 1
            `,
            [id]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Menu not found",
                },
                { status: 404 }
            );
        }

        // Prevent menu from being its own parent
        if (
            parent_id !== null &&
            parent_id !== "" &&
            Number(parent_id) === Number(id)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Menu cannot be its own parent",
                },
                { status: 400 }
            );
        }

        // Check parent
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

        // Check duplicate menu_key
        const [duplicateRows] = await connection.query(
            `
            SELECT id
            FROM cst_menu
            WHERE menu_key = ?
              AND id != ?
            LIMIT 1
            `,
            [
                menu_key,
                id,
            ]
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

        await connection.query(
            `
            UPDATE cst_menu
            SET
                parent_id = ?,
                menu_key = ?,
                menu_name = ?,
                menu_title = ?,
                menu_icon = ?,
                menu_url = ?,
                menu_type = ?,
                menu_order = ?,
                is_sidebar = ?,
                is_active = ?,
                status = ?,
                is_deleted = ?
            WHERE id = ?
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
                Number(is_deleted) ? 1 : 0,
                id,
            ]
        );

        return NextResponse.json({
            success: true,
            message: "Menu updated successfully",
        });

    } catch (error) {
        console.error("PUT menu error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update menu",
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


// DELETE - Soft delete menu
export async function DELETE(request, { params }) {
    let connection;

    try {
        connection = await pool.getConnection();

        const { id } = await params;

        const [existingRows] = await connection.query(
            `
            SELECT id
            FROM cst_menu
            WHERE id = ?
            LIMIT 1
            `,
            [id]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Menu not found",
                },
                { status: 404 }
            );
        }

        await connection.query(
            `
            UPDATE cst_menu
            SET
                is_deleted = 1,
                is_active = 0,
                status = 0
            WHERE id = ?
            `,
            [id]
        );

        return NextResponse.json({
            success: true,
            message: "Menu deleted successfully",
        });

    } catch (error) {
        console.error("DELETE menu error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete menu",
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