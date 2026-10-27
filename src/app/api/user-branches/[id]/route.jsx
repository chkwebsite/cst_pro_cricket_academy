import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


// GET - Single user branch
export async function GET(request, { params }) {
    let connection;

    try {
        connection = await pool.getConnection();

        const { id } = await params;

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
                u.phone,

                b.branch_name

            FROM cst_user_branches ub

            LEFT JOIN cst_users u
                ON u.id = ub.user_id

            LEFT JOIN cst_branch b
                ON b.id = ub.branch_id

            WHERE ub.id = ?

            LIMIT 1
            `,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User branch not found",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });

    } catch (error) {
        console.error("GET single user branch error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch user branch",
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


// PUT - Update user branch
export async function PUT(request, { params }) {
    let connection;

    try {
        connection = await pool.getConnection();

        const { id } = await params;

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

        // Check existing record
        const [existingRows] = await connection.query(
            `
            SELECT id
            FROM cst_user_branches
            WHERE id = ?
            LIMIT 1
            `,
            [id]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User branch not found",
                },
                { status: 404 }
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
              AND id != ?
            LIMIT 1
            `,
            [
                user_id || null,
                branch_id,
                id,
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

        await connection.query(
            `
            UPDATE cst_user_branches
            SET
                user_id = ?,
                branch_id = ?,
                is_primary = ?,
                status = ?
            WHERE id = ?
            `,
            [
                user_id || null,
                branch_id,
                is_primary ? 1 : 0,
                status ? 1 : 0,
                id,
            ]
        );

        return NextResponse.json({
            success: true,
            message: "User branch updated successfully",
        });

    } catch (error) {
        console.error("PUT user branch error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update user branch",
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


// DELETE - Delete user branch
export async function DELETE(request, { params }) {
    let connection;

    try {
        connection = await pool.getConnection();

        const { id } = await params;

        const [result] = await connection.query(
            `
            DELETE FROM cst_user_branches
            WHERE id = ?
            `,
            [id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User branch not found",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "User branch deleted successfully",
        });

    } catch (error) {
        console.error("DELETE user branch error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete user branch",
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


