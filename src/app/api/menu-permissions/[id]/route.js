import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


// GET - Single menu permission
export async function GET(request, { params }) {
    let connection;

    try {
        connection = await pool.getConnection();

        const { id } = await params;

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

            WHERE mp.id = ?

            LIMIT 1
            `,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Menu permission not found",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });

    } catch (error) {
        console.error(
            "GET single menu permission error:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Failed to fetch menu permission",
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


// PUT - Update menu permission
export async function PUT(request, { params }) {
    let connection;

    try {
        connection = await pool.getConnection();

        const { id } = await params;

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

        // Check existing record
        const [existingRows] =
            await connection.query(
                `
                SELECT id
                FROM cst_menu_permissions
                WHERE id = ?
                LIMIT 1
                `,
                [id]
            );

        if (existingRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Menu permission not found",
                },
                { status: 404 }
            );
        }

        // Check menu
        const [menuRows] =
            await connection.query(
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
                  AND id != ?
                LIMIT 1
                `,
                [
                    menu_id,
                    permission_id,
                    id,
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

        await connection.query(
            `
            UPDATE cst_menu_permissions
            SET
                menu_id = ?,
                permission_id = ?
            WHERE id = ?
            `,
            [
                menu_id,
                permission_id,
                id,
            ]
        );

        return NextResponse.json({
            success: true,
            message:
                "Menu permission updated successfully",
        });

    } catch (error) {
        console.error(
            "PUT menu permission error:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Failed to update menu permission",
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


// DELETE - Delete menu permission
export async function DELETE(request, { params }) {
    let connection;

    try {
        connection = await pool.getConnection();

        const { id } = await params;

        const [result] = await connection.query(
            `
            DELETE FROM cst_menu_permissions
            WHERE id = ?
            `,
            [id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Menu permission not found",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message:
                "Menu permission deleted successfully",
        });

    } catch (error) {
        console.error(
            "DELETE menu permission error:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Failed to delete menu permission",
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