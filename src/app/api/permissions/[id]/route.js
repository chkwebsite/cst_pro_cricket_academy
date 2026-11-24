import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation";

// GET SINGLE PERMISSION
export async function GET(req, { params }) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(req);
    if (errorResponse) return errorResponse;

    let connection = null;

    try {
        const { id } = await params;
        connection = await pool.getConnection();

        const [rows] = await connection.query(
            `SELECT p.id, p.module_name, p.permission_name, p.status FROM cst_permissions p WHERE p.id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Permission not found",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("GET permission error:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch Permission",
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

// UPDATE PERMISSION
export async function PUT(request, { params }) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (!authUser.isSuperAdmin) {
        return NextResponse.json({ success: false, message: "Forbidden: Only Super Admin can modify permissions" }, { status: 403 });
    }

    let connection = null;

    try {
        const body = await request.json();
        const { id } = await params;
        const { module_name, permission_name, status } = body;

        connection = await pool.getConnection();

        // CHECK PERMISSION
        const [checkPermission] = await connection.query(
            `SELECT id FROM cst_permissions WHERE id = ?`,
            [id]
        );

        if (checkPermission.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Permission not found",
                },
                { status: 404 }
            );
        }

        // VALIDATION
        const trimmedModule = typeof module_name === "string" ? module_name.trim() : "";
        const trimmedPermission = typeof permission_name === "string" ? permission_name.trim() : "";

        const errors = {};
        if (!trimmedModule) errors.module_name = "Module name is required.";
        if (!trimmedPermission) errors.permission_name = "Permission name is required.";
        if (status !== 0 && status !== 1 && status !== "0" && status !== "1") {
            errors.status = "Status must be Active or Inactive.";
        }

        if (Object.keys(errors).length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: Object.values(errors)[0],
                    errors,
                },
                { status: 400 }
            );
        }

        // DUPLICATE CHECK (permission_name uniqueness across other records)
        const [existingPermission_name] = await connection.query(
            `SELECT id FROM cst_permissions WHERE permission_name = ? AND id != ? LIMIT 1`,
            [trimmedPermission, id]
        );

        if (existingPermission_name.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Permission name already exists",
                    errors: {
                        permission_name: "Permission name already exists",
                    },
                },
                { status: 409 }
            );
        }

        await connection.query(
            `UPDATE cst_permissions SET module_name = ?, permission_name = ?, status = ? WHERE id = ?`,
            [trimmedModule, trimmedPermission, status, id]
        );

        return NextResponse.json(
            {
                success: true,
                message: "Permission updated successfully",
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("PUT permission error:", error);
        return NextResponse.json(
            {
                success: false,
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

// DELETE PERMISSION
export async function DELETE(request, { params }) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (!authUser.isSuperAdmin) {
        return NextResponse.json({ success: false, message: "Forbidden: Only Super Admin can delete permissions" }, { status: 403 });
    }

    let connection = null;

    try {
        const { id } = await params;
        connection = await pool.getConnection();

        // Check if permission exists
        const [checkPermission] = await connection.query(
            `SELECT id, permission_name FROM cst_permissions WHERE id = ? LIMIT 1`,
            [id]
        );

        if (checkPermission.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Permission not found",
                },
                { status: 404 }
            );
        }

        const [result] = await connection.query(
            `DELETE FROM cst_permissions WHERE id = ?`,
            [id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Failed to delete permission",
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                message: "Permission deleted successfully",
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("DELETE permission error:", error);

        if (error.code === "ER_ROW_IS_REFERENCED_2" || error.errno === 1451) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Cannot delete permission because it is assigned to roles or menus.",
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete permission",
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
