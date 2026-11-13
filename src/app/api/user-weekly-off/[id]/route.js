import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthUser } from "@/app/components/lib/rbac";

const VALID_DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
];

// GET SINGLE RECORD
export async function GET(request, { params }) {
    let connection;

    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json(
                { success: false, message: "Unauthorized. Authentication required." },
                { status: 401 }
            );
        }

        const { id } = await params;
        connection = await pool.getConnection();

        let sql = `
            SELECT 
                w.*,
                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                u.user_type,
                b.branch_name,
                a.academy_name
            FROM cst_user_weekly_off w
            INNER JOIN cst_users u ON u.id = w.user_id
            LEFT JOIN cst_branch b ON b.id = w.branch_id
            LEFT JOIN cst_academy a ON a.id = w.academy_id
            WHERE w.id = ?
        `;
        const values = [id];

        // Multi-Tenant Isolation
        if (authUser.isBranchAdmin && authUser.branch_id) {
            sql += ` AND w.branch_id = ? AND w.academy_id = ?`;
            values.push(authUser.branch_id, authUser.academy_id);
        } else if (authUser.isAcademyAdmin && authUser.academy_id) {
            sql += ` AND w.academy_id = ?`;
            values.push(authUser.academy_id);
        } else if (!authUser.isSuperAdmin) {
            sql += ` AND w.user_id = ?`;
            values.push(authUser.id);
        }

        const [rows] = await connection.execute(sql, values);

        if (rows.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Record not found"
            }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: rows[0]
        });

    } catch (error) {
        console.error("GET Weekly Off Single Error:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to fetch record",
            error: error.message
        }, { status: 500 });

    } finally {
        if (connection) connection.release();
    }
}


// PUT UPDATE RECORD
export async function PUT(request, { params }) {
    let connection;

    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json(
                { success: false, message: "Unauthorized. Authentication required." },
                { status: 401 }
            );
        }

        if (!authUser.isSuperAdmin && !authUser.isAcademyAdmin && !authUser.isBranchAdmin) {
            return NextResponse.json(
                { success: false, message: "Forbidden. Insufficient permissions." },
                { status: 403 }
            );
        }

        const { id } = await params;
        const body = await request.json();

        const { day_of_week, status, remarks } = body;

        if (day_of_week && !VALID_DAYS.includes(day_of_week)) {
            return NextResponse.json({
                success: false,
                message: `Invalid day_of_week. Allowed: ${VALID_DAYS.join(", ")}`
            }, { status: 400 });
        }

        connection = await pool.getConnection();

        const fields = [];
        const values = [];

        if (day_of_week !== undefined) {
            fields.push("day_of_week = ?");
            values.push(day_of_week);
        }
        if (status !== undefined) {
            fields.push("status = ?");
            values.push(Number(status));
        }
        if (remarks !== undefined) {
            fields.push("remarks = ?");
            values.push(remarks);
        }

        if (fields.length === 0) {
            return NextResponse.json({
                success: false,
                message: "No fields provided for update"
            }, { status: 400 });
        }

        let sql = `UPDATE cst_user_weekly_off SET ${fields.join(", ")} WHERE id = ?`;
        values.push(id);

        // Multi-Tenant Isolation
        if (authUser.isBranchAdmin && authUser.branch_id) {
            sql += ` AND branch_id = ? AND academy_id = ?`;
            values.push(authUser.branch_id, authUser.academy_id);
        } else if (authUser.isAcademyAdmin && authUser.academy_id) {
            sql += ` AND academy_id = ?`;
            values.push(authUser.academy_id);
        }

        const [result] = await connection.execute(sql, values);

        if (result.affectedRows === 0) {
            return NextResponse.json({
                success: false,
                message: "Record not found or unauthorized to update"
            }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: "Weekly off updated successfully"
        });

    } catch (error) {
        console.error("PUT Weekly Off Error:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to update record",
            error: error.message
        }, { status: 500 });

    } finally {
        if (connection) connection.release();
    }
}


// DELETE RECORD
export async function DELETE(request, { params }) {
    let connection;

    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json(
                { success: false, message: "Unauthorized. Authentication required." },
                { status: 401 }
            );
        }

        if (!authUser.isSuperAdmin && !authUser.isAcademyAdmin && !authUser.isBranchAdmin) {
            return NextResponse.json(
                { success: false, message: "Forbidden. Insufficient permissions." },
                { status: 403 }
            );
        }

        const { id } = await params;

        connection = await pool.getConnection();

        let sql = `DELETE FROM cst_user_weekly_off WHERE id = ?`;
        const values = [id];

        // Multi-Tenant Isolation
        if (authUser.isBranchAdmin && authUser.branch_id) {
            sql += ` AND branch_id = ? AND academy_id = ?`;
            values.push(authUser.branch_id, authUser.academy_id);
        } else if (authUser.isAcademyAdmin && authUser.academy_id) {
            sql += ` AND academy_id = ?`;
            values.push(authUser.academy_id);
        }

        const [result] = await connection.execute(sql, values);

        if (result.affectedRows === 0) {
            return NextResponse.json({
                success: false,
                message: "Record not found or unauthorized to delete"
            }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: "Weekly off removed successfully"
        });

    } catch (error) {
        console.error("DELETE Weekly Off Error:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to delete record",
            error: error.message
        }, { status: 500 });

    } finally {
        if (connection) connection.release();
    }
}
