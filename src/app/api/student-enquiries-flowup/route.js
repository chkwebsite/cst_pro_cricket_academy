import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";

// Helper to check enquiry access
function checkEnquiryAccess(user, enquiry) {
    if (user.isSuperAdmin) return true;
    if (Number(enquiry.academy_id) !== Number(user.academy_id)) return false;
    if (user.isAcademyAdmin) return true;
    if (user.isBranchAdmin) {
        return Number(enquiry.branch_id) === Number(user.branch_id);
    }
    const allowed = user.assignedBranchIds || (user.branch_id ? [Number(user.branch_id)] : []);
    return allowed.includes(Number(enquiry.branch_id));
}

// GET: All follow-ups
export async function GET(request) {
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

        const { searchParams } = new URL(request.url);

        const enquiry_id = searchParams.get("enquiry_id");
        const enquiry_status = searchParams.get("enquiry_status");

        let sql = `
            SELECT
                f.*,
                e.student_name,
                e.phone,
                e.email,
                e.program_id,
                e.academy_id,
                e.branch_id,
                p.program_name,
                CONCAT_WS(' ', u.first_name, u.last_name) AS created_by_name
            FROM cst_student_enquiries_flowup f
            INNER JOIN cst_student_enquiries e ON e.id = f.enquiry_id
            LEFT JOIN cst_programs p ON p.id = e.program_id
            LEFT JOIN cst_users u ON u.id = f.created_by
            WHERE e.is_deleted = 0
        `;

        const values = [];

        // Role-based Tenant Scoping
        if (authUser.isBranchAdmin && authUser.branch_id) {
            sql += " AND e.branch_id = ? AND e.academy_id = ?";
            values.push(authUser.branch_id, authUser.academy_id);
        } else if (authUser.isAcademyAdmin && authUser.academy_id) {
            sql += " AND e.academy_id = ?";
            values.push(authUser.academy_id);
        } else if (!authUser.isSuperAdmin && authUser.academy_id) {
            sql += " AND e.academy_id = ?";
            values.push(authUser.academy_id);
            const allowed = authUser.assignedBranchIds && authUser.assignedBranchIds.length > 0
                ? authUser.assignedBranchIds
                : (authUser.branch_id ? [authUser.branch_id] : [-1]);
            sql += ` AND e.branch_id IN (${allowed.map(() => "?").join(",")})`;
            values.push(...allowed);
        }

        if (enquiry_id) {
            sql += " AND f.enquiry_id = ?";
            values.push(enquiry_id);
        }

        if (enquiry_status) {
            sql += " AND f.enquiry_status = ?";
            values.push(enquiry_status);
        }

        sql += " ORDER BY f.enquiry_id DESC, f.follow_up_no DESC";

        connection = await pool.getConnection();

        const [rows] = await connection.execute(sql, values);

        return NextResponse.json({
            success: true,
            data: rows,
        });
    } catch (error) {
        console.error("GET Enquiry Follow-ups Error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch enquiry follow-ups", error: error.message },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// POST: Create follow-up
export async function POST(request) {
    let connection;

    try {
        const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
        if (errorResponse) return errorResponse;

        if (authUser.isPlayer) {
            return NextResponse.json(
                { success: false, message: "Forbidden: Players cannot create follow-ups" },
                { status: 403 }
            );
        }

        const body = await request.json();

        const {
            enquiry_id,
            follow_up_date,
            enquiry_status,
            remarks = null,
            next_follow_up_date = null,
        } = body;

        if (!enquiry_id || !enquiry_status) {
            return NextResponse.json(
                { success: false, message: "enquiry_id and enquiry_status are required" },
                { status: 400 }
            );
        }

        const validStatuses = [
            "Contacted",
            "Follow-up",
            "Interested",
            "Converted",
            "Not Interested",
            "Closed",
        ];

        if (!validStatuses.includes(enquiry_status)) {
            return NextResponse.json(
                { success: false, message: "Invalid enquiry_status" },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Verify parent enquiry exists and caller has tenant access
        const [enquiryRows] = await connection.execute(
            `SELECT id, academy_id, branch_id FROM cst_student_enquiries WHERE id = ? AND is_deleted = 0 LIMIT 1`,
            [enquiry_id]
        );

        if (enquiryRows.length === 0) {
            await connection.rollback();
            return NextResponse.json({ success: false, message: "Student enquiry not found" }, { status: 404 });
        }

        const enquiry = enquiryRows[0];
        if (!checkEnquiryAccess(authUser, enquiry)) {
            await connection.rollback();
            return NextResponse.json(
                { success: false, message: "Forbidden: Enquiry belongs to an unauthorized academy or branch" },
                { status: 403 }
            );
        }

        // Auto increment follow_up_no for this enquiry
        const [lastFollowUp] = await connection.execute(
            `SELECT COALESCE(MAX(follow_up_no), 0) + 1 AS next_no
             FROM cst_student_enquiries_flowup
             WHERE enquiry_id = ?`,
            [enquiry_id]
        );

        const follow_up_no = lastFollowUp[0].next_no;

        const [result] = await connection.execute(
            `INSERT INTO cst_student_enquiries_flowup (
                enquiry_id,
                follow_up_no,
                follow_up_date,
                enquiry_status,
                remarks,
                next_follow_up_date,
                created_by
            ) VALUES (?, ?, COALESCE(?, NOW()), ?, ?, ?, ?)`,
            [
                enquiry_id,
                follow_up_no,
                follow_up_date || null,
                enquiry_status,
                remarks,
                next_follow_up_date,
                authUser.id,
            ]
        );

        // Update the main enquiry table status to match the latest follow up status
        await connection.execute(
            `UPDATE cst_student_enquiries
             SET enquiry_status = ?, updated_at = NOW()
             WHERE id = ?`,
            [enquiry_status, enquiry_id]
        );

        await connection.commit();

        return NextResponse.json(
            {
                success: true,
                message: "Follow-up created successfully",
                id: result.insertId,
                follow_up_no,
            },
            { status: 201 }
        );
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("POST Enquiry Follow-up Error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to create follow-up", error: error.message },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
