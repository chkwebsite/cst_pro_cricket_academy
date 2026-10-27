import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


// GET: Single enquiry
export async function GET(request, { params }) {
    let connection;

    try {
        const { id } = await params;

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            `SELECT
e.*,
    a.academy_name,
        b.branch_name,
        p.program_name,
        CONCAT_WS(' ', u.first_name, u.last_name) AS assigned_to_name
             FROM cst_student_enquiries e
             LEFT JOIN cst_academy a
                ON a.id = e.academy_id
             LEFT JOIN cst_branch b
                ON b.id = e.branch_id
             LEFT JOIN cst_programs p
                ON p.id = e.program_id
             LEFT JOIN cst_users u
                ON u.id = e.assigned_to
             WHERE e.id = ?
    AND e.is_deleted = 0
             LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Student enquiry not found",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("GET Single Student Enquiry Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch student enquiry",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// PUT: Update enquiry details
export async function PUT(request, { params }) {
    let connection;

    try {
        const { id } = await params;
        const body = await request.json();

        const allowedFields = [
            "academy_id",
            "branch_id",
            "student_name",
            "age",
            "phone",
            "email",
            "program_id",
            "message",
            "enquiry_source",
            "enquiry_status",
            "assigned_to",
            "converted_user_id",
            "converted_admission_id",
        ];

        const updates = [];
        const values = [];

        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(body, field)) {
                updates.push(`${field} = ?`);
                values.push(
                    typeof body[field] === "string"
                        ? body[field].trim() || null
                        : body[field]
                );
            }
        }

        if (updates.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "No valid fields provided for update",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [existingRows] = await connection.execute(
            `SELECT id
             FROM cst_student_enquiries
             WHERE id = ? AND is_deleted = 0`,
            [id]
        );

        if (existingRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Student enquiry not found",
                },
                { status: 404 }
            );
        }

        if (
            body.student_name !== undefined &&
            !String(body.student_name).trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Student name cannot be empty",
                },
                { status: 400 }
            );
        }

        if (
            body.phone !== undefined &&
            !String(body.phone).trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Phone cannot be empty",
                },
                { status: 400 }
            );
        }

        if (
            body.age !== undefined &&
            body.age !== null &&
            (body.age === "" ||
                !Number.isInteger(Number(body.age)) ||
                Number(body.age) < 0 ||
                Number(body.age) > 255)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Age must be an integer between 0 and 255",
                },
                { status: 400 }
            );
        }

        const validSources = [
            "Website",
            "Phone",
            "Walk-in",
            "Referral",
            "Other",
        ];

        const validStatuses = [
            "New",
            "Contacted",
            "Follow-up",
            "Interested",
            "Converted",
            "Not Interested",
            "Closed",
        ];

        if (
            body.enquiry_source !== undefined &&
            !validSources.includes(body.enquiry_source)
        ) {
            return NextResponse.json(
                { success: false, message: "Invalid enquiry_source" },
                { status: 400 }
            );
        }

        if (
            body.enquiry_status !== undefined &&
            !validStatuses.includes(body.enquiry_status)
        ) {
            return NextResponse.json(
                { success: false, message: "Invalid enquiry_status" },
                { status: 400 }
            );
        }

        // Validate references if supplied
        const references = [
            ["academy_id", "cst_academy"],
            ["branch_id", "cst_branch"],
            ["program_id", "cst_programs"],
            ["assigned_to", "cst_users"],
            ["converted_user_id", "cst_users"],
            ["converted_admission_id", "cst_admission_players"],
        ];

        for (const [field, table] of references) {
            if (
                Object.prototype.hasOwnProperty.call(body, field) &&
                body[field] !== null &&
                body[field] !== ""
            ) {
                const [rows] = await connection.execute(
                    `SELECT id FROM ${table} WHERE id = ? `,
                    [body[field]]
                );

                if (rows.length === 0) {
                    return NextResponse.json(
                        {
                            success: false,
                            message: `${field} reference not found`,
                        },
                        { status: 400 }
                    );
                }
            }
        }

        values.push(id);

        await connection.execute(
            `UPDATE cst_student_enquiries
             SET ${updates.join(", ")}
             WHERE id = ? AND is_deleted = 0`,
            values
        );

        return NextResponse.json({
            success: true,
            message: "Student enquiry updated successfully",
        });
    } catch (error) {
        console.error("PUT Student Enquiry Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update student enquiry",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// DELETE: Soft delete enquiry
export async function DELETE(request, { params }) {
    let connection;

    try {
        const { id } = await params;

        connection = await pool.getConnection();

        const [result] = await connection.execute(
            `UPDATE cst_student_enquiries
             SET is_deleted = 1
             WHERE id = ?
    AND is_deleted = 0`,
            [id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Student enquiry not found",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Student enquiry deleted successfully",
        });
    } catch (error) {
        console.error("DELETE Student Enquiry Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete student enquiry",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}