import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthUser } from "@/app/components/lib/rbac";


// ============================================
// GET: Attendance List with Filters
// ============================================
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);

        const id = searchParams.get("id");
        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");
        const program_id = searchParams.get("program_id");
        const admission_players_id = searchParams.get("admission_players_id");
        const user_program_id = searchParams.get("user_program_id");
        const attendance_date = searchParams.get("attendance_date");
        const month = searchParams.get("month");
        const attendance_status = searchParams.get("attendance_status");
        const search = searchParams.get("search");

        connection = await pool.getConnection();

        let sql = `
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
                CONCAT(
                    ap.first_name,
                    ' ',
                    COALESCE(ap.last_name, '')
                ) AS player_name,

                p.program_name,
                up.appointment_no,

                CONCAT(
                    COALESCE(marker.first_name, ''),
                    ' ',
                    COALESCE(marker.last_name, '')
                ) AS marked_by_name

            FROM cst_player_attendance a

            INNER JOIN cst_user_programs up
                ON up.id = a.user_program_id

            INNER JOIN cst_admission_players ap
                ON ap.id = a.admission_players_id

            INNER JOIN cst_programs p
                ON p.id = a.program_id

            LEFT JOIN cst_users marker
                ON marker.id = a.marked_by

            WHERE up.is_deleted = 0
              AND ap.is_deleted = 0
              AND p.is_deleted = 0
        `;

        const values = [];

        if (id) {
            sql += ` AND a.id = ?`;
            values.push(id);
        }

        const authUser = await getAuthUser(request);
        if (authUser) {
            if (authUser.isCoach) {
                // Coach only sees attendance for players in their assigned batches
                sql += ` AND a.admission_players_id IN (
                    SELECT up.admission_players_id
                    FROM cst_user_programs up
                    JOIN cst_batch_players bp ON bp.user_program_id = up.id
                    JOIN cst_batch_coaches bc ON bc.batch_id = bp.batch_id
                    WHERE bc.coach_user_id = ? AND bc.status = 1 AND bc.is_deleted = 0
                )`;
                values.push(authUser.id);
            } else if (authUser.isBranchAdmin && authUser.branch_id) {
                sql += " AND a.branch_id = ? AND a.academy_id = ?";
                values.push(authUser.branch_id, authUser.academy_id);
            } else if (authUser.isAcademyAdmin && authUser.academy_id) {
                sql += " AND a.academy_id = ?";
                values.push(authUser.academy_id);
                if (branch_id) {
                    sql += " AND a.branch_id = ?";
                    values.push(branch_id);
                }
            } else if (!authUser.isSuperAdmin && authUser.academy_id) {
                sql += " AND a.academy_id = ?";
                values.push(authUser.academy_id);
            } else {
                if (academy_id) {
                    sql += ` AND a.academy_id = ?`;
                    values.push(academy_id);
                }
                if (branch_id) {
                    sql += ` AND a.branch_id = ?`;
                    values.push(branch_id);
                }
            }
        } else {
            if (academy_id) {
                sql += ` AND a.academy_id = ?`;
                values.push(academy_id);
            }
            if (branch_id) {
                sql += ` AND a.branch_id = ?`;
                values.push(branch_id);
            }
        }

        if (program_id) {
            sql += ` AND a.program_id = ?`;
            values.push(program_id);
        }

        if (admission_players_id) {
            sql += ` AND a.admission_players_id = ?`;
            values.push(admission_players_id);
        }

        if (user_program_id) {
            sql += ` AND a.user_program_id = ?`;
            values.push(user_program_id);
        }

        if (attendance_date) {
            sql += ` AND a.attendance_date = ?`;
            values.push(attendance_date);
        }

        // Example: month=2026-10
        if (month) {
            if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid month format. Use YYYY-MM."
                    },
                    { status: 400 }
                );
            }

            sql += ` AND a.attendance_date >= ?
                     AND a.attendance_date < ?`;

            values.push(`${month}-01`);

            const [year, monthNumber] = month.split("-").map(Number);

            const nextMonth = new Date(
                Date.UTC(year, monthNumber, 1)
            );

            values.push(
                `${nextMonth.getUTCFullYear()}-${String(
                    nextMonth.getUTCMonth() + 1
                ).padStart(2, "0")}-01`
            );
        }

        if (attendance_status) {
            const allowedStatuses = [
                "Present",
                "Absent",
                "Late",
                "Leave"
            ];

            if (!allowedStatuses.includes(attendance_status)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid attendance status."
                    },
                    { status: 400 }
                );
            }

            sql += ` AND a.attendance_status = ?`;
            values.push(attendance_status);
        }

        if (search) {
            sql += `
                AND (
                    ap.admission_no LIKE ?
                    OR ap.first_name LIKE ?
                    OR ap.last_name LIKE ?
                    OR p.program_name LIKE ?
                )
            `;

            const searchValue = `%${search}%`;

            values.push(
                searchValue,
                searchValue,
                searchValue,
                searchValue
            );
        }

        sql += ` ORDER BY a.attendance_date DESC, a.id DESC`;

        const [rows] = await connection.query(sql, values);

        return NextResponse.json({
            success: true,
            message: "Attendance fetched successfully.",
            total: rows.length,
            data: rows
        });

    } catch (error) {
        console.error("GET Attendance Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch attendance.",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }
}


// ============================================
// POST: Mark Attendance
// ============================================
export async function POST(request) {
    let connection;

    try {
        const body = await request.json();

        const {
            user_program_id,
            attendance_date,
            attendance_status = "Present",
            remarks,
            marked_by
        } = body;

        if (!user_program_id || !attendance_date) {
            return NextResponse.json(
                {
                    success: false,
                    message: "user_program_id and attendance_date are required."
                },
                { status: 400 }
            );
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(attendance_date)) {
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

        if (!allowedStatuses.includes(attendance_status)) {
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

        // Verify enrollment and derive academy, branch, player and program.
        const [enrollments] = await connection.query(
            `
            SELECT
                up.id AS user_program_id,
                up.branch_id,
                up.admission_players_id,
                up.program_id,
                p.academy_id

            FROM cst_user_programs up

            INNER JOIN cst_programs p
                ON p.id = up.program_id

            INNER JOIN cst_admission_players ap
                ON ap.id = up.admission_players_id

            WHERE up.id = ?
              AND up.status = 1
              AND up.is_deleted = 0
              AND p.status = 1
              AND p.is_deleted = 0
              AND ap.status = 1
              AND ap.is_deleted = 0
            FOR UPDATE
            `,
            [user_program_id]
        );

        if (enrollments.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Active player enrollment not found."
                },
                { status: 404 }
            );
        }

        const enrollment = enrollments[0];

        // Prevent duplicate attendance for the same enrollment and date.
        const [existing] = await connection.query(
            `
            SELECT id
            FROM cst_player_attendance
            WHERE user_program_id = ?
              AND attendance_date = ?
            LIMIT 1
            `,
            [user_program_id, attendance_date]
        );

        if (existing.length > 0) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Attendance already exists for this date.",
                    attendance_id: existing[0].id
                },
                { status: 409 }
            );
        }

        // Validate enrollment date range.
        if (
            enrollment.start_date &&
            attendance_date < enrollment.start_date
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
            enrollment.end_date &&
            attendance_date > enrollment.end_date
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

        const [result] = await connection.query(
            `
            INSERT INTO cst_player_attendance (
                academy_id,
                branch_id,
                user_program_id,
                admission_players_id,
                program_id,
                attendance_date,
                attendance_status,
                remarks,
                marked_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                enrollment.academy_id,
                enrollment.branch_id,
                enrollment.user_program_id,
                enrollment.admission_players_id,
                enrollment.program_id,
                attendance_date,
                attendance_status,
                remarks || null,
                marked_by || null
            ]
        );

        await connection.commit();

        return NextResponse.json(
            {
                success: true,
                message: "Attendance marked successfully.",
                data: {
                    id: result.insertId,
                    academy_id: enrollment.academy_id,
                    branch_id: enrollment.branch_id,
                    user_program_id: enrollment.user_program_id,
                    admission_players_id: enrollment.admission_players_id,
                    program_id: enrollment.program_id,
                    attendance_date,
                    attendance_status,
                    remarks: remarks || null,
                    marked_by: marked_by || null
                }
            },
            { status: 201 }
        );

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("POST Attendance Error:", error);

        // Unique key duplicate protection.
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
                message: "Failed to mark attendance.",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }
}


