import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthUser } from "@/app/components/lib/rbac";

const ALLOWED_STATUSES = [
    "Present",
    "Absent",
    "Late",
    "Half Day",
    "Leave",
    "Week off"
];

// GET SINGLE ATTENDANCE
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
                a.*,
                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                u.user_type,
                b.branch_name,
                ac.academy_name
            FROM cst_attendance a
            LEFT JOIN cst_users u
                ON u.id = a.user_id
            LEFT JOIN cst_branch b
                ON b.id = a.branch_id
            LEFT JOIN cst_academy ac
                ON ac.id = a.academy_id
            WHERE a.id = ?
        `;
        const queryParams = [id];

        // Multi-Tenant Isolation
        if (!authUser.isSuperAdmin && !authUser.isAcademyAdmin && !authUser.isBranchAdmin) {
            sql += ` AND a.user_id = ?`;
            queryParams.push(authUser.id);
        } else if (authUser.isBranchAdmin && authUser.branch_id) {
            sql += ` AND a.branch_id = ? AND a.academy_id = ?`;
            queryParams.push(authUser.branch_id, authUser.academy_id);
        } else if (authUser.isAcademyAdmin && authUser.academy_id) {
            sql += ` AND a.academy_id = ?`;
            queryParams.push(authUser.academy_id);
        }

        const [rows] = await connection.execute(sql, queryParams);

        if (rows.length === 0) {
            return NextResponse.json({
                success: false,
                message: "Attendance not found"
            }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: "Attendance fetched successfully",
            data: rows[0]
        });

    } catch (error) {
        console.error("GET Single Attendance Error:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to fetch attendance",
            error: error.message
        }, { status: 500 });

    } finally {
        if (connection) connection.release();
    }
}


// PUT UPDATE ATTENDANCE
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

        const isMasterAdmin = authUser.isSuperAdmin || authUser.isAcademyAdmin || authUser.isBranchAdmin;

        const { id } = await params;
        const body = await request.json();

        const allowedFields = [
            "attendance_status",
            "attendance_date",
            "check_in",
            "check_out",
            "late_minutes",
            "remarks"
        ];

        const fields = [];
        const values = [];

        for (const key of allowedFields) {
            if (body[key] !== undefined) {
                fields.push(`${key} = ?`);
                values.push(body[key]);
            }
        }

        if (fields.length === 0) {
            return NextResponse.json({
                success: false,
                message: "No fields provided for update"
            }, { status: 400 });
        }

        if (body.attendance_status && !ALLOWED_STATUSES.includes(body.attendance_status)) {
            return NextResponse.json({
                success: false,
                message: `Invalid attendance status. Allowed: ${ALLOWED_STATUSES.join(", ")}`
            }, { status: 400 });
        }

        connection = await pool.getConnection();

        // Multi-Tenant Isolation & Date Window Check for non-admins
        if (!isMasterAdmin) {
            const [existing] = await connection.execute(
                `SELECT attendance_date FROM cst_attendance WHERE id = ? AND user_id = ?`,
                [id, authUser.id]
            );
            if (existing.length === 0) {
                return NextResponse.json({
                    success: false,
                    message: "Attendance not found or unauthorized to update"
                }, { status: 404 });
            }
            const targetDateStr = body.attendance_date || existing[0].attendance_date;
            if (targetDateStr) {
                const todayObj = new Date();
                const todayMidnight = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate()).getTime();
                const dateParts = String(targetDateStr).slice(0, 10).split("-").map(Number);
                if (dateParts.length === 3 && !isNaN(dateParts[0]) && !isNaN(dateParts[1]) && !isNaN(dateParts[2])) {
                    const attDateMidnight = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).getTime();
                    const diffDays = Math.round((todayMidnight - attDateMidnight) / (1000 * 60 * 60 * 24));
                    if (diffDays < 0 || diffDays > 7) {
                        return NextResponse.json(
                            {
                                success: false,
                                message: "Forbidden. Attendance can only be updated for the current date and up to 7 days in the past."
                            },
                            { status: 403 }
                        );
                    }
                }
            }
        }

        let sql = `UPDATE cst_attendance SET ${fields.join(", ")}, marked_by = ? WHERE id = ?`;
        values.push(authUser.id, id);

        // Multi-Tenant Isolation
        if (!isMasterAdmin) {
            sql += ` AND user_id = ?`;
            values.push(authUser.id);
        } else if (authUser.isBranchAdmin && authUser.branch_id) {
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
                message: "Attendance not found or unauthorized to update"
            }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: "Attendance updated successfully"
        });

    } catch (error) {
        console.error("PUT Attendance Error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json({
                success: false,
                message: "Attendance already exists for this date"
            }, { status: 409 });
        }

        return NextResponse.json({
            success: false,
            message: "Failed to update attendance",
            error: error.message
        }, { status: 500 });

    } finally {
        if (connection) connection.release();
    }
}


// DELETE ATTENDANCE
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
                { success: false, message: "Forbidden. Insufficient permissions to delete attendance." },
                { status: 403 }
            );
        }

        const { id } = await params;

        connection = await pool.getConnection();

        let sql = `DELETE FROM cst_attendance WHERE id = ?`;
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
                message: "Attendance not found or unauthorized to delete"
            }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: "Attendance deleted successfully"
        });

    } catch (error) {
        console.error("DELETE Attendance Error:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to delete attendance",
            error: error.message
        }, { status: 500 });

    } finally {
        if (connection) connection.release();
    }
}
