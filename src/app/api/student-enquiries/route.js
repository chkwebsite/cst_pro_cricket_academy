import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


// GET: All student enquiries
// Filters: ?search=Rahul&enquiry_status=New&academy_id=1&branch_id=2&program_id=3
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);

        const search = searchParams.get("search");
        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");
        const program_id = searchParams.get("program_id");
        const enquiry_status = searchParams.get("enquiry_status");
        const enquiry_source = searchParams.get("enquiry_source");

        let sql = `
SELECT
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
            WHERE e.is_deleted = 0
    `;

        const values = [];

        if (search) {
            sql += ` AND(
        e.student_name LIKE ?
        OR e.phone LIKE ?
        OR e.email LIKE ?
            )`;

            const searchValue = `%${search}%`;
            values.push(searchValue, searchValue, searchValue);
        }

        if (academy_id) {
            sql += " AND e.academy_id = ?";
            values.push(academy_id);
        }

        if (branch_id) {
            sql += " AND e.branch_id = ?";
            values.push(branch_id);
        }

        if (program_id) {
            sql += " AND e.program_id = ?";
            values.push(program_id);
        }

        if (enquiry_status) {
            sql += " AND e.enquiry_status = ?";
            values.push(enquiry_status);
        }

        if (enquiry_source) {
            sql += " AND e.enquiry_source = ?";
            values.push(enquiry_source);
        }

        sql += " ORDER BY e.id DESC";

        connection = await pool.getConnection();

        const [rows] = await connection.execute(sql, values);

        return NextResponse.json({
            success: true,
            data: rows,
        });
    } catch (error) {
        console.error("GET Student Enquiries Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch student enquiries",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// POST: Create new student enquiry
export async function POST(request) {
    let connection;

    try {
        const body = await request.json();

        const {
            academy_id = null,
            branch_id = null,
            student_name,
            age = null,
            phone,
            email = null,
            program_id = null,
            message = null,
            enquiry_source = "Website",
            enquiry_status = "New",
            assigned_to = null,
        } = body;

        // Required fields
        if (
            !student_name?.trim() ||
            !phone?.trim()
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Student name and phone are required",
                },
                { status: 400 }
            );
        }

        // Validate age
        if (
            age !== null &&
            (age === "" ||
                !Number.isInteger(Number(age)) ||
                Number(age) < 0 ||
                Number(age) > 255)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Age must be an integer between 0 and 255",
                },
                { status: 400 }
            );
        }

        // Validate enums
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

        if (!validSources.includes(enquiry_source)) {
            return NextResponse.json(
                { success: false, message: "Invalid enquiry_source" },
                { status: 400 }
            );
        }

        // New enquiries should normally start with New status.
        // Other statuses are allowed for authorized staff workflows.
        if (!validStatuses.includes(enquiry_status)) {
            return NextResponse.json(
                { success: false, message: "Invalid enquiry_status" },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        // Validate academy, branch and program references
        if (academy_id !== null) {
            const [academies] = await connection.execute(
                "SELECT id FROM cst_academy WHERE id = ?",
                [academy_id]
            );

            if (academies.length === 0) {
                return NextResponse.json(
                    { success: false, message: "Academy not found" },
                    { status: 400 }
                );
            }
        }

        if (branch_id !== null) {
            const [branches] = await connection.execute(
                `SELECT id, academy_id
                 FROM cst_branch
                 WHERE id = ? `,
                [branch_id]
            );

            if (branches.length === 0) {
                return NextResponse.json(
                    { success: false, message: "Branch not found" },
                    { status: 400 }
                );
            }

            if (
                academy_id !== null &&
                Number(branches[0].academy_id) !== Number(academy_id)
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Branch does not belong to the selected academy",
                    },
                    { status: 400 }
                );
            }
        }

        if (program_id !== null) {
            const [programs] = await connection.execute(
                "SELECT id FROM cst_programs WHERE id = ?",
                [program_id]
            );

            if (programs.length === 0) {
                return NextResponse.json(
                    { success: false, message: "Program not found" },
                    { status: 400 }
                );
            }
        }

        if (assigned_to !== null) {
            const [users] = await connection.execute(
                "SELECT id FROM cst_users WHERE id = ?",
                [assigned_to]
            );

            if (users.length === 0) {
                return NextResponse.json(
                    { success: false, message: "Assigned user not found" },
                    { status: 400 }
                );
            }
        }

        const [result] = await connection.execute(
            `INSERT INTO cst_student_enquiries(
            academy_id,
            branch_id,
            student_name,
            age,
            phone,
            email,
            program_id,
            message,
            enquiry_source,
            enquiry_status,
            assigned_to
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                academy_id,
                branch_id,
                student_name.trim(),
                age === "" ? null : age,
                phone.trim(),
                email?.trim() || null,
                program_id,
                message?.trim() || null,
                enquiry_source,
                enquiry_status,
                assigned_to,
            ]
        );

        return NextResponse.json(
            {
                success: true,
                message: "Student enquiry created successfully",
                id: result.insertId,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST Student Enquiry Error:", error);

        if (error.code === "ER_NO_REFERENCED_ROW_2") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid academy, branch, program or user reference",
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: "Failed to create student enquiry",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}