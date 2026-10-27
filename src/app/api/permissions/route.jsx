import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";

export async function GET(request) {
    const connection = await pool.getConnection();
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search")?.trim() || "";
        const module_name = searchParams.get("module_name")?.trim() || "";
        const status = searchParams.get("status");

        let sql = `SELECT p.id, p.module_name, p.permission_name, p.status FROM cst_permissions p WHERE 1 = 1`;
        const params = [];

        if (search) {
            sql += ` AND (p.module_name LIKE ? OR p.permission_name LIKE ?)`;
            const searchValue = `%${search}%`;
            params.push(searchValue, searchValue);
        }
        if (module_name) {
            sql += ` AND p.module_name = ?`;
            params.push(module_name);
        }
        if (status !== null && status !== "") {
            sql += ` AND p.status = ?`;
            params.push(status);
        }

        const [rows] = await connection.query(sql, params);

        return NextResponse.json({
            success: true,
            count: rows.length,
            data: rows,
        }, { status: 200 });

    } catch (error) {
        console.error("Fetch permissions error:", error);
        return NextResponse.json({
            success: false,
            message: "Failed to fetch permissions",
        }, { status: 500 });
    } finally {
        connection.release();
    }
}

// POST

export async function POST(request) {
    const connection = await pool.getConnection();
    try {
        const body = await request.json();
        const { module_name, permission_name, status } = body;

        const trimmedModule = typeof module_name === "string" ? module_name.trim() : "";
        const trimmedPermission = typeof permission_name === "string" ? permission_name.trim() : "";

        // VALIDATION
        if (!trimmedModule) {
            return NextResponse.json({
                success: false,
                message: "Module name is required"
            }, { status: 400 });
        }
        if (!trimmedPermission) {
            return NextResponse.json({
                success: false,
                message: "Permission name is required"
            }, { status: 400 });
        }
        if (status !== 0 && status !== 1) {
            return NextResponse.json({
                success: false,
                message: "Status must be 0 or 1"
            }, { status: 400 });
        }

        // DUPLICATE CHECK (single query for both fields)
        const [existing] = await connection.query(
            `SELECT id, module_name, permission_name FROM cst_permissions WHERE module_name = ? OR permission_name = ? LIMIT 1`,
            [trimmedModule, trimmedPermission]
        );

        if (existing.length > 0) {
            // if (existing[0].module_name === trimmedModule) {
            //     return NextResponse.json({
            //         success: false,
            //         message: "Module name already exists XXX"
            //     }, { status: 409 });
            // }
            if (existing[0].permission_name === trimmedPermission) {
                return NextResponse.json({
                    success: false,
                    message: "Permission name already exists"
                }, { status: 409 });
            }
        }

        // INSERT
        await connection.query(
            `INSERT INTO cst_permissions (module_name, permission_name, status) VALUES (?, ?, ?)`,
            [trimmedModule, trimmedPermission, status]
        );

        return NextResponse.json({
            success: true,
            message: "Permission created successfully"
        }, { status: 201 });

    } catch (error) {
        console.error("Create permission error:", error);

        // Handles race condition if a UNIQUE constraint exists on module_name/permission_name
        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json({
                success: false,
                message: "Module name or Permission name already exists"
            }, { status: 409 });
        }

        return NextResponse.json({
            success: false,
            message: "Failed to create Permission"
        }, { status: 500 });

    } finally {
        connection.release();
    }
}