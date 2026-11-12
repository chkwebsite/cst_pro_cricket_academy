import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthUser } from "@/app/components/lib/rbac";
import { ROLES } from "@/app/components/lib/rbac-rules";

export async function GET(request) {
    let connection;

    try {
        const authUser = await getAuthUser(request);

        if (!authUser) {
            return NextResponse.json(
                { success: false, message: "Unauthorized. Please log in." },
                { status: 401 }
            );
        }

        const allowedRoles = [ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN, ROLES.BRANCH_ADMIN];
        if (!allowedRoles.includes(authUser.role)) {
            return NextResponse.json(
                { success: false, message: "Access denied. Only Academy and Branch Admins can view reset codes." },
                { status: 403 }
            );
        }

        connection = await pool.getConnection();

        // 1. Hard delete all expired reset records (> 10 minutes)
        await connection.query(`DELETE FROM cst_password_resets WHERE expires_at < NOW()`);

        // 2. Build scoped query based on admin role
        let query = `
            SELECT 
                r.id,
                r.user_id,
                r.identifier,
                r.identifier_type,
                r.otp_code,
                r.academy_id,
                r.branch_id,
                r.status,
                r.expires_at,
                DATE_FORMAT(r.expires_at, '%Y-%m-%dT%H:%i:%sZ') AS expires_at_iso,
                r.created_at,
                GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), r.expires_at)) AS seconds_remaining,
                u.first_name,
                u.last_name,
                u.appointment_no,
                u.email,
                u.phone,
                u.user_type,
                a.academy_name,
                b.branch_name
            FROM cst_password_resets r
            INNER JOIN cst_users u ON u.id = r.user_id
            LEFT JOIN cst_academy a ON a.id = COALESCE(r.academy_id, u.academy_id)
            LEFT JOIN cst_branch b ON b.id = COALESCE(r.branch_id, u.branch_id)
            WHERE r.expires_at >= NOW()
        `;

        const params = [];

        if (authUser.role === ROLES.BRANCH_ADMIN) {
            query += ` AND (COALESCE(r.branch_id, u.branch_id) = ? OR (r.academy_id = ? AND r.branch_id IS NULL))`;
            params.push(authUser.branch_id, authUser.academy_id);
        } else if (authUser.role === ROLES.ACADEMY_ADMIN) {
            query += ` AND (COALESCE(r.academy_id, u.academy_id) = ?)`;
            params.push(authUser.academy_id);
        }

        query += ` ORDER BY r.created_at DESC`;

        const [rows] = await connection.query(query, params);

        return NextResponse.json({
            success: true,
            data: rows || [],
            admin_role: authUser.role,
            admin_academy_id: authUser.academy_id,
            admin_branch_id: authUser.branch_id,
        });
    } catch (error) {
        console.error("Error in GET /api/password-resets:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch password reset codes." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

export async function DELETE(request) {
    let connection;

    try {
        const authUser = await getAuthUser(request);

        if (!authUser) {
            return NextResponse.json(
                { success: false, message: "Unauthorized. Please log in." },
                { status: 401 }
            );
        }

        const allowedRoles = [ROLES.SUPER_ADMIN, ROLES.ACADEMY_ADMIN, ROLES.BRANCH_ADMIN];
        if (!allowedRoles.includes(authUser.role)) {
            return NextResponse.json(
                { success: false, message: "Access denied." },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Reset record ID is required." },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        // Scope check before deletion
        if (authUser.role === ROLES.BRANCH_ADMIN) {
            await connection.query(
                `DELETE r FROM cst_password_resets r
                 INNER JOIN cst_users u ON u.id = r.user_id
                 WHERE r.id = ? AND (COALESCE(r.branch_id, u.branch_id) = ?)`,
                [id, authUser.branch_id]
            );
        } else if (authUser.role === ROLES.ACADEMY_ADMIN) {
            await connection.query(
                `DELETE r FROM cst_password_resets r
                 INNER JOIN cst_users u ON u.id = r.user_id
                 WHERE r.id = ? AND (COALESCE(r.academy_id, u.academy_id) = ?)`,
                [id, authUser.academy_id]
            );
        } else {
            await connection.query(`DELETE FROM cst_password_resets WHERE id = ?`, [id]);
        }

        return NextResponse.json({
            success: true,
            message: "Reset code deleted/revoked successfully.",
        });
    } catch (error) {
        console.error("Error in DELETE /api/password-resets:", error);
        return NextResponse.json(
            { success: false, message: "Failed to delete reset code." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
