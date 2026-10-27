import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


// ==========================================
// GET SINGLE ROLE PERMISSION
// ==========================================
export async function GET(req, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json({
                success: false,
                message: "ID is required"
            }, { status: 400 });
        }


        const [rows] = await connection.query(
            `
            SELECT
                rp.id,
                rp.role_id,
                r.role_name,
                rp.permission_id,
                p.module_name,
                p.permission_name,
                rp.created_at
            FROM cst_role_permissions rp

            INNER JOIN cst_roles r
                ON r.id = rp.role_id

            INNER JOIN cst_permissions p
                ON p.id = rp.permission_id

            WHERE rp.id = ?
            LIMIT 1
            `,
            [id]
        );


        if (rows.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Role permission not found"
            }, { status: 404 });
        }


        return NextResponse.json({
            success: true,
            data: rows[0]
        });

    } catch (error) {
        console.error("GET SINGLE ROLE PERMISSION ERROR:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to fetch role permission"
        }, { status: 500 });

    } finally {
        connection.release();
    }
}



// ==========================================
// UPDATE ROLE PERMISSION
// ==========================================
export async function PUT(req, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;

        const body = await req.json();

        const {
            role_id,
            permission_id
        } = body;


        if (!id) {
            return NextResponse.json({
                success: false,
                message: "ID is required"
            }, { status: 400 });
        }


        if (!role_id) {
            return NextResponse.json({
                success: false,
                message: "Role ID is required"
            }, { status: 400 });
        }


        if (!permission_id) {
            return NextResponse.json({
                success: false,
                message: "Permission ID is required"
            }, { status: 400 });
        }


        // CHECK EXISTING RECORD
        const [existingRecord] = await connection.query(
            `
            SELECT id
            FROM cst_role_permissions
            WHERE id = ?
            LIMIT 1
            `,
            [id]
        );


        if (existingRecord.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Role permission not found"
            }, { status: 404 });
        }


        // CHECK ROLE
        const [role] = await connection.query(
            `
            SELECT id
            FROM cst_roles
            WHERE id = ?
            LIMIT 1
            `,
            [role_id]
        );


        if (role.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Role not found"
            }, { status: 404 });
        }


        // CHECK PERMISSION
        const [permission] = await connection.query(
            `
            SELECT id
            FROM cst_permissions
            WHERE id = ?
            LIMIT 1
            `,
            [permission_id]
        );


        if (permission.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Permission not found"
            }, { status: 404 });
        }


        // CHECK DUPLICATE
        const [duplicate] = await connection.query(
            `
            SELECT id
            FROM cst_role_permissions
            WHERE role_id = ?
            AND permission_id = ?
            AND id != ?
            LIMIT 1
            `,
            [
                role_id,
                permission_id,
                id
            ]
        );


        if (duplicate.length > 0) {
            return NextResponse.json({
                success: false,
                message: "This permission is already assigned to this role"
            }, { status: 409 });
        }


        // UPDATE
        await connection.query(
            `
            UPDATE cst_role_permissions
            SET
                role_id = ?,
                permission_id = ?
            WHERE id = ?
            `,
            [
                role_id,
                permission_id,
                id
            ]
        );


        // GET UPDATED DATA
        const [rows] = await connection.query(
            `
            SELECT
                rp.id,
                rp.role_id,
                r.role_name,
                rp.permission_id,
                p.module_name,
                p.permission_name,
                rp.created_at
            FROM cst_role_permissions rp

            INNER JOIN cst_roles r
                ON r.id = rp.role_id

            INNER JOIN cst_permissions p
                ON p.id = rp.permission_id

            WHERE rp.id = ?
            LIMIT 1
            `,
            [id]
        );


        return NextResponse.json({
            success: true,
            message: "Role permission updated successfully",
            data: rows[0]
        });

    } catch (error) {
        console.error("UPDATE ROLE PERMISSION ERROR:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to update role permission"
        }, { status: 500 });

    } finally {
        connection.release();
    }
}



// ==========================================
// DELETE ROLE PERMISSION
// ==========================================
export async function DELETE(req, { params }) {
    const connection = await pool.getConnection();

    try {
        const { id } = await params;


        if (!id) {
            return NextResponse.json({
                success: false,
                message: "ID is required"
            }, { status: 400 });
        }


        // CHECK RECORD
        const [existing] = await connection.query(
            `
            SELECT id
            FROM cst_role_permissions
            WHERE id = ?
            LIMIT 1
            `,
            [id]
        );


        if (existing.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Role permission not found"
            }, { status: 404 });
        }


        // DELETE
        await connection.query(
            `
            DELETE FROM cst_role_permissions
            WHERE id = ?
            `,
            [id]
        );


        return NextResponse.json({
            success: true,
            message: "Role permission deleted successfully"
        });


    } catch (error) {
        console.error("DELETE ROLE PERMISSION ERROR:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to delete role permission"
        }, { status: 500 });

    } finally {
        connection.release();
    }
}
