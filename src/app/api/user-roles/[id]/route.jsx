import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


// GET - Single user role
export async function GET(request, { params }) {
    let connection;

    try {
        connection = await pool.getConnection();

        const { id } = await params;

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
                u.phone,

                r.role_name

            FROM cst_user_roles ur

            LEFT JOIN cst_users u
                ON u.id = ur.user_id

            LEFT JOIN cst_roles r
                ON r.id = ur.role_id

            WHERE ur.id = ?

            LIMIT 1
            `,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User role not found",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });

    } catch (error) {
        console.error("GET single user role error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch user role",
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


// PUT - Update user role
export async function PUT(request, { params }) {
    let connection;

    try {
        connection = await pool.getConnection();

        const { id } = await params;

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

        // Check existing record
        const [existingRows] = await connection.query(
            `
            SELECT id
            FROM cst_user_roles
            WHERE id = ?
            LIMIT 1
            `,
            [id]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User role not found",
                },
                { status: 404 }
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
              AND id != ?
            LIMIT 1
            `,
            [
                user_id,
                role_id,
                id,
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

        await connection.query(
            `
            UPDATE cst_user_roles
            SET
                user_id = ?,
                role_id = ?
            WHERE id = ?
            `,
            [
                user_id,
                role_id,
                id,
            ]
        );

        // Keep user_type in cst_users aligned with updated role
        try {
            if (roleRows[0]?.role_name) {
                await connection.query(
                    "UPDATE cst_users SET user_type = ? WHERE id = ?",
                    [roleRows[0].role_name, user_id]
                );
            }
        } catch (_) {}

        return NextResponse.json({
            success: true,
            message: "User role updated successfully",
        });

    } catch (error) {
        console.error("PUT user role error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update user role",
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


// DELETE - Delete user role
export async function DELETE(request, { params }) {
    let connection;

    try {
        connection = await pool.getConnection();

        const { id } = await params;

        const [result] = await connection.query(
            `
            DELETE FROM cst_user_roles
            WHERE id = ?
            `,
            [id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User role not found",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "User role deleted successfully",
        });

    } catch (error) {
        console.error("DELETE user role error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete user role",
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