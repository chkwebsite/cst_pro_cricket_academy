import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation";

// ==========================================
// GET ALL ROLE PERMISSIONS
// ==========================================
export async function GET(request) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    const connection = await pool.getConnection();

    try {
        let sql = `
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

            WHERE 1 = 1
        `;
        const params = [];

        if (!authUser.isSuperAdmin) {
            sql += ` AND (r.academy_id = ? OR r.academy_id IS NULL)`;
            params.push(authUser.academy_id);
        }

        sql += ` ORDER BY rp.id DESC`;

        const [rows] = await connection.query(sql, params);

        return NextResponse.json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error("GET ROLE PERMISSIONS ERROR:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to fetch role permissions"
        }, { status: 500 });

    } finally {
        connection.release();
    }
}


// ==========================================
// CREATE ROLE PERMISSION
// ==========================================
export async function POST(request) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (!authUser.isSuperAdmin) {
        return NextResponse.json(
            { success: false, message: "Forbidden: Only Super Admin can assign permissions to roles" },
            { status: 403 }
        );
    }

    const connection = await pool.getConnection();

    try {
        const body = await request.json();

        const {
            role_id,
            permission_id
        } = body;

        // VALIDATION
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
        const [existing] = await connection.query(
            `
            SELECT id
            FROM cst_role_permissions
            WHERE role_id = ?
            AND permission_id = ?
            LIMIT 1
            `,
            [role_id, permission_id]
        );

        if (existing.length > 0) {
            return NextResponse.json({
                success: false,
                message: "This permission is already assigned to this role"
            }, { status: 409 });
        }


        // INSERT
        const [result] = await connection.query(
            `
            INSERT INTO cst_role_permissions
            (
                role_id,
                permission_id
            )
            VALUES (?, ?)
            `,
            [
                role_id,
                permission_id
            ]
        );


        // GET CREATED RECORD
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
            `,
            [result.insertId]
        );


        return NextResponse.json({
            success: true,
            message: "Permission assigned to role successfully",
            data: rows[0]
        }, { status: 201 });

    } catch (error) {
        console.error("CREATE ROLE PERMISSION ERROR:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to assign permission"
        }, { status: 500 });

    } finally {
        connection.release();
    }
}