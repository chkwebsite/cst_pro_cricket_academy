import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";

// ============================================
// GET: Single Attendance Record
// ============================================
export async function GET(request, context) {
    let connection;

    try {
        const params = await context?.params;
        const { searchParams } = new URL(request.url);
        const id = params?.id || searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Attendance id is required." },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [rows] = await connection.query(
            `
            SELECT
                a.id,
                a.academy_id,
                a.branch_id,
                a.user_program_id,
                a.admission_players_id,
                a.program_id,
                a.attendance_date,
                a.attendance_status,
                a.remarks,
                a.marked_by,
                a.created_at,
                a.updated_at,
                ap.admission_no,
                CONCAT_WS(' ', ap.first_name, ap.last_name) AS player_name,
                p.program_name,
                up.appointment_no,
                CONCAT_WS(' ', marker.first_name, marker.last_name) AS marked_by_name
            FROM cst_player_attendance a
            INNER JOIN cst_user_programs up ON up.id = a.user_program_id
            INNER JOIN cst_admission_players ap ON ap.id = a.admission_players_id
            INNER JOIN cst_programs p ON p.id = a.program_id
            LEFT JOIN cst_users marker ON marker.id = a.marked_by
            WHERE a.id = ?
            LIMIT 1
            `,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Attendance record not found." },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("GET Attendance Record Error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch attendance.", error: error.message },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// ============================================
// PUT: Update Attendance
// ============================================
export async function PUT(request, context) {
    let connection;

    try {
        const params = await context?.params;
        const body = await request.json();

        const id = body.id || params?.id;
        const {
            attendance_date,
            attendance_status,
            remarks
        } = body;

        if (!id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Attendance id is required."
                },
                { status: 400 }
            );
        }

        if (
            attendance_date === undefined &&
            attendance_status === undefined &&
            remarks === undefined
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "At least one field is required to update."
                },
                { status: 400 }
            );
        }

        if (
            attendance_date !== undefined &&
            (
                typeof attendance_date !== "string" ||
                !/^\d{4}-\d{2}-\d{2}$/.test(attendance_date)
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid attendance_date. Use YYYY-MM-DD."
                },
                { status: 400 }
            );
        }

        const allowedStatuses = [
            "Present",
            "Absent",
            "Late",
            "Leave"
        ];

        if (
            attendance_status !== undefined &&
            !allowedStatuses.includes(attendance_status)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid attendance_status."
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        await connection.beginTransaction();

        const [attendanceRows] = await connection.query(
            `
            SELECT
                a.id,
                a.user_program_id,
                a.attendance_date,
                up.start_date,
                up.end_date
            FROM cst_player_attendance a
            INNER JOIN cst_user_programs up
                ON up.id = a.user_program_id
            WHERE a.id = ?
            FOR UPDATE
            `,
            [id]
        );

        if (attendanceRows.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Attendance record not found."
                },
                { status: 404 }
            );
        }

        const current = attendanceRows[0];

        const newDate = attendance_date ?? current.attendance_date;

        if (
            current.start_date &&
            newDate < current.start_date
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Attendance date is before enrollment start date."
                },
                { status: 400 }
            );
        }

        if (
            current.end_date &&
            newDate > current.end_date
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Attendance date is after enrollment end date."
                },
                { status: 400 }
            );
        }

        // Prevent duplicate attendance if date is changed.
        if (attendance_date !== undefined) {
            const [duplicates] = await connection.query(
                `
                SELECT id
                FROM cst_player_attendance
                WHERE user_program_id = ?
                  AND attendance_date = ?
                  AND id <> ?
                LIMIT 1
                `,
                [current.user_program_id, newDate, id]
            );

            if (duplicates.length > 0) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message: "Attendance already exists for this date."
                    },
                    { status: 409 }
                );
            }
        }

        const updates = [];
        const values = [];

        if (attendance_date !== undefined) {
            updates.push("attendance_date = ?");
            values.push(attendance_date);
        }

        if (attendance_status !== undefined) {
            updates.push("attendance_status = ?");
            values.push(attendance_status);
        }

        if (remarks !== undefined) {
            updates.push("remarks = ?");
            values.push(remarks || null);
        }

        values.push(id);

        await connection.query(
            `
            UPDATE cst_player_attendance
            SET ${updates.join(", ")}
            WHERE id = ?
            `,
            values
        );

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Attendance updated successfully."
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("PUT Attendance Error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Attendance already exists for this date."
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update attendance.",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }
}

// ============================================
// DELETE: Delete Attendance
// ============================================
export async function DELETE(request, context) {
    let connection;

    try {
        const params = await context?.params;
        const { searchParams } = new URL(request.url);

        const id = searchParams.get("id") || params?.id;

        if (!id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Attendance id is required."
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [result] = await connection.query(
            `
            DELETE FROM cst_player_attendance
            WHERE id = ?
            `,
            [id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Attendance record not found."
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Attendance deleted successfully."
        });

    } catch (error) {
        console.error("DELETE Attendance Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete attendance.",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }
}
