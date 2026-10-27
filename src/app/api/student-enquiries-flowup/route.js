import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


// GET: All follow-ups
// Filters: ?enquiry_id=1&enquiry_status=Interested
export async function GET(request) {
    let connection;

    try {
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
    p.program_name,
    CONCAT_WS(' ', u.first_name, u.last_name) AS created_by_name
            FROM cst_student_enquiries_flowup f
            INNER JOIN cst_student_enquiries e
                ON e.id = f.enquiry_id
            LEFT JOIN cst_programs p
                ON p.id = e.program_id
            LEFT JOIN cst_users u
                ON u.id = f.created_by
            WHERE e.is_deleted = 0
    `;

        const values = [];

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
            {
                success: false,
                message: "Failed to fetch enquiry follow-ups",
            },
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
        const body = await request.json();

        const {
            enquiry_id,
            follow_up_date,
            enquiry_status,
            remarks = null,
            next_follow_up_date = null,
            created_by = null,
        } = body;

        if (!enquiry_id || !enquiry_status) {
            return NextResponse.json(
                {
                    success: false,
                    message: "enquiry_id and enquiry_status are required",
                },
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
                {
                    success: false,
                    message: "Invalid enquiry_status",
                },
                { status: 400 }
            );
        }

        if (
            follow_up_date &&
            Number.isNaN(Date.parse(follow_up_date))
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid follow_up_date",
                },
                { status: 400 }
            );
        }

        if (
            next_follow_up_date &&
            Number.isNaN(Date.parse(next_follow_up_date))
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid next_follow_up_date",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        await connection.beginTransaction();

        // Lock enquiry row to prevent simultaneous requests
        const [enquiries] = await connection.execute(
            `SELECT id, enquiry_status, total_followups
             FROM cst_student_enquiries
             WHERE id = ?
    AND is_deleted = 0
             FOR UPDATE`,
            [enquiry_id]
        );

        if (enquiries.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Student enquiry not found",
                },
                { status: 404 }
            );
        }

        const enquiry = enquiries[0];

        if (
            ["Converted", "Not Interested", "Closed"].includes(
                enquiry.enquiry_status
            )
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: `Cannot add follow - up because enquiry status is ${enquiry.enquiry_status} `,
                },
                { status: 400 }
            );
        }

        // Count actual records instead of trusting the cached counter
        const [countRows] = await connection.execute(
            `SELECT COUNT(*) AS total
             FROM cst_student_enquiries_flowup
             WHERE enquiry_id = ? `,
            [enquiry_id]
        );

        const total = Number(countRows[0].total);

        if (total >= 5) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Maximum 5 follow-ups are allowed for this enquiry",
                },
                { status: 400 }
            );
        }

        const follow_up_no = total + 1;

        // Check staff reference when provided
        if (created_by !== null) {
            const [users] = await connection.execute(
                "SELECT id FROM cst_users WHERE id = ?",
                [created_by]
            );

            if (users.length === 0) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message: "created_by user not found",
                    },
                    { status: 400 }
                );
            }
        }

        const actualFollowUpDate =
            follow_up_date || new Date().toISOString().slice(0, 19).replace("T", " ");

        const [result] = await connection.execute(
            `INSERT INTO cst_student_enquiries_flowup(
        enquiry_id,
        follow_up_no,
        follow_up_date,
        enquiry_status,
        remarks,
        next_follow_up_date,
        created_by
    ) VALUES(?, ?, ?, ?, ?, ?, ?)`,
            [
                enquiry_id,
                follow_up_no,
                actualFollowUpDate,
                enquiry_status,
                remarks,
                next_follow_up_date || null,
                created_by,
            ]
        );

        // Keep main enquiry's current status and counters synchronized
        await connection.execute(
            `UPDATE cst_student_enquiries
SET
enquiry_status = ?,
    total_followups = ?,
    last_follow_up_date = ?,
    next_follow_up_date = ?
        WHERE id = ? `,
            [
                enquiry_status,
                follow_up_no,
                actualFollowUpDate,
                next_follow_up_date || null,
                enquiry_id,
            ]
        );

        await connection.commit();

        return NextResponse.json(
            {
                success: true,
                message: "Follow-up created successfully",
                id: result.insertId,
                enquiry_id: Number(enquiry_id),
                follow_up_no,
                total_followups: follow_up_no,
                remaining_followups: 5 - follow_up_no,
            },
            { status: 201 }
        );
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("POST Enquiry Follow-up Error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                {
                    success: false,
                    message: "This follow-up number already exists for the enquiry",
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: "Failed to create enquiry follow-up",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}