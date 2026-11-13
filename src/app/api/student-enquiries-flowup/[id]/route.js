import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";

function checkEnquiryAccess(user, record) {
    if (user.isSuperAdmin) return true;
    if (Number(record.academy_id) !== Number(user.academy_id)) return false;
    if (user.isAcademyAdmin) return true;
    if (user.isBranchAdmin) {
        return Number(record.branch_id) === Number(user.branch_id);
    }
    const allowed = user.assignedBranchIds || (user.branch_id ? [Number(user.branch_id)] : []);
    return allowed.includes(Number(record.branch_id));
}

// GET: Single follow-up record
export async function GET(request, { params }) {
    let connection;

    try {
        const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
        if (errorResponse) return errorResponse;

        if (authUser.isPlayer) {
            return NextResponse.json(
                { success: false, message: "Forbidden: Players cannot view enquiry follow-ups" },
                { status: 403 }
            );
        }

        const { id } = await params;
        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            `SELECT
                f.*,
                e.student_name,
                e.phone,
                e.email,
                e.academy_id,
                e.branch_id,
                e.enquiry_status AS current_enquiry_status,
                p.program_name,
                CONCAT_WS(' ', u.first_name, u.last_name) AS created_by_name
             FROM cst_student_enquiries_flowup f
             INNER JOIN cst_student_enquiries e ON e.id = f.enquiry_id
             LEFT JOIN cst_programs p ON p.id = e.program_id
             LEFT JOIN cst_users u ON u.id = f.created_by
             WHERE f.id = ? AND e.is_deleted = 0
             LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Follow-up record not found" },
                { status: 404 }
            );
        }

        const record = rows[0];
        if (!checkEnquiryAccess(authUser, record)) {
            return NextResponse.json(
                { success: false, message: "Forbidden: Access denied to records outside your scope" },
                { status: 403 }
            );
        }

        return NextResponse.json({
            success: true,
            data: record,
        });
    } catch (error) {
        console.error("GET Single Follow-up Error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch follow-up", error: error.message },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// PUT: Update follow-up details
export async function PUT(request, { params }) {
    let connection;

    try {
        const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
        if (errorResponse) return errorResponse;

        if (authUser.isPlayer) {
            return NextResponse.json(
                { success: false, message: "Forbidden: Players cannot update enquiry follow-ups" },
                { status: 403 }
            );
        }

        const { id } = await params;
        const body = await request.json();

        const allowedFields = [
            "follow_up_date",
            "enquiry_status",
            "remarks",
            "next_follow_up_date",
        ];

        const updates = [];
        const values = [];

        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(body, field)) {
                updates.push(`${field} = ?`);
                values.push(body[field] || null);
            }
        }

        if (updates.length === 0) {
            return NextResponse.json(
                { success: false, message: "No valid fields provided for update" },
                { status: 400 }
            );
        }

        if (
            body.enquiry_status !== undefined &&
            ![
                "Contacted",
                "Follow-up",
                "Interested",
                "Converted",
                "Not Interested",
                "Closed",
            ].includes(body.enquiry_status)
        ) {
            return NextResponse.json(
                { success: false, message: "Invalid enquiry_status" },
                { status: 400 }
            );
        }

        for (const field of ["follow_up_date", "next_follow_up_date"]) {
            if (body[field] && Number.isNaN(Date.parse(body[field]))) {
                return NextResponse.json(
                    { success: false, message: `Invalid ${field}` },
                    { status: 400 }
                );
            }
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [existingRows] = await connection.execute(
            `SELECT f.*, e.id AS main_enquiry_id, e.academy_id, e.branch_id
             FROM cst_student_enquiries_flowup f
             INNER JOIN cst_student_enquiries e ON e.id = f.enquiry_id
             WHERE f.id = ? AND e.is_deleted = 0
             FOR UPDATE`,
            [id]
        );

        if (existingRows.length === 0) {
            await connection.rollback();
            return NextResponse.json({ success: false, message: "Follow-up record not found" }, { status: 404 });
        }

        const followup = existingRows[0];
        if (!checkEnquiryAccess(authUser, followup)) {
            await connection.rollback();
            return NextResponse.json(
                { success: false, message: "Forbidden: You are not authorized to update this follow-up" },
                { status: 403 }
            );
        }

        values.push(id);

        await connection.execute(
            `UPDATE cst_student_enquiries_flowup
             SET ${updates.join(", ")}
             WHERE id = ?`,
            values
        );

        // Update latest status on main enquiry if needed
        if (body.enquiry_status) {
            await connection.execute(
                `UPDATE cst_student_enquiries
                 SET enquiry_status = ?, updated_at = NOW()
                 WHERE id = ?`,
                [body.enquiry_status, followup.main_enquiry_id]
            );
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Follow-up updated successfully",
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("PUT Follow-up Error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to update follow-up", error: error.message },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// DELETE: Remove follow-up and recalculate sequence
export async function DELETE(request, { params }) {
    let connection;

    try {
        const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
        if (errorResponse) return errorResponse;

        if (authUser.isPlayer) {
            return NextResponse.json(
                { success: false, message: "Forbidden: Players cannot delete enquiry follow-ups" },
                { status: 403 }
            );
        }

        const { id } = await params;
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [existingRows] = await connection.execute(
            `SELECT f.*, e.id AS main_enquiry_id, e.academy_id, e.branch_id
             FROM cst_student_enquiries_flowup f
             INNER JOIN cst_student_enquiries e ON e.id = f.enquiry_id
             WHERE f.id = ? AND e.is_deleted = 0
             FOR UPDATE`,
            [id]
        );

        if (existingRows.length === 0) {
            await connection.rollback();
            return NextResponse.json({ success: false, message: "Follow-up record not found" }, { status: 404 });
        }

        const followup = existingRows[0];
        if (!checkEnquiryAccess(authUser, followup)) {
            await connection.rollback();
            return NextResponse.json(
                { success: false, message: "Forbidden: You are not authorized to delete this follow-up" },
                { status: 403 }
            );
        }

        await connection.execute(`DELETE FROM cst_student_enquiries_flowup WHERE id = ?`, [id]);

        // Get remaining follow-ups ordered by id descending
        const [remainingRows] = await connection.execute(
            `SELECT id, follow_up_no
             FROM cst_student_enquiries_flowup
             WHERE enquiry_id = ?
             ORDER BY id DESC`,
            [followup.enquiry_id]
        );

        for (let index = 0; index < remainingRows.length; index++) {
            const row = remainingRows[index];
            const newNo = remainingRows.length - index;
            await connection.execute(
                `UPDATE cst_student_enquiries_flowup SET follow_up_no = ? WHERE id = ?`,
                [100 + newNo, row.id]
            );
        }

        for (let index = 0; index < remainingRows.length; index++) {
            const row = remainingRows[index];
            const newNo = remainingRows.length - index;
            await connection.execute(
                `UPDATE cst_student_enquiries_flowup SET follow_up_no = ? WHERE id = ?`,
                [newNo, row.id]
            );
        }

        const [latestRows] = await connection.execute(
            `SELECT * FROM cst_student_enquiries_flowup WHERE enquiry_id = ? ORDER BY follow_up_no DESC LIMIT 1`,
            [followup.enquiry_id]
        );

        if (latestRows.length > 0) {
            await connection.execute(
                `UPDATE cst_student_enquiries
                 SET total_followups = ?, enquiry_status = ?, last_follow_up_date = ?, next_follow_up_date = ?
                 WHERE id = ?`,
                [
                    latestRows[0].follow_up_no,
                    latestRows[0].enquiry_status,
                    latestRows[0].follow_up_date,
                    latestRows[0].next_follow_up_date,
                    followup.enquiry_id,
                ]
            );
        } else {
            await connection.execute(
                `UPDATE cst_student_enquiries
                 SET total_followups = 0, enquiry_status = 'New', last_follow_up_date = NULL, next_follow_up_date = NULL
                 WHERE id = ?`,
                [followup.enquiry_id]
            );
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Follow-up deleted successfully",
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("DELETE Follow-up Error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to delete follow-up", error: error.message },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
