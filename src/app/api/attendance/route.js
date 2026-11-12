import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthUser } from "@/app/components/lib/rbac";

// Allowed attendance status list
const ALLOWED_STATUSES = [
    "Present",
    "Absent",
    "Late",
    "Half Day",
    "Leave",
    "Week off"
];

// =====================================================
// GET ALL ATTENDANCE (WITH MULTI-TENANT ISOLATION)
// =====================================================
export async function GET(request) {
    let connection;

    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json(
                { success: false, message: "Unauthorized. Authentication required." },
                { status: 401 }
            );
        }

        connection = await pool.getConnection();

        const { searchParams } = new URL(request.url);

        let academy_id = searchParams.get("academy_id");
        let branch_id = searchParams.get("branch_id");
        let user_id = searchParams.get("user_id");
        const attendance_type = searchParams.get("attendance_type");
        const attendance_status = searchParams.get("attendance_status");
        const attendance_date = searchParams.get("attendance_date");
        const month = searchParams.get("month");
        const year = searchParams.get("year");

        // Role-Based Boundary Enforcement:
        // 1. Super Admin: full scope across all academies/branches.
        // 2. Academy Admin: strictly locked to own academy.
        // 3. Branch Admin: strictly locked to own branch & academy.
        // 4. All Other Roles (Coach, Player, Staff, Accountant, Management, Ground Staff):
        //    Can ONLY view their OWN attendance records! (Strict Self-Attendance Isolation)
        if (authUser.isSuperAdmin) {
            // Unrestricted
        } else if (authUser.isAcademyAdmin) {
            if (academy_id && String(academy_id) !== String(authUser.academy_id)) {
                return NextResponse.json(
                    { success: false, message: "Forbidden. Academy Admin cannot access another academy's records." },
                    { status: 403 }
                );
            }
            academy_id = authUser.academy_id;
        } else if (authUser.isBranchAdmin) {
            if (branch_id && String(branch_id) !== String(authUser.branch_id)) {
                return NextResponse.json(
                    { success: false, message: "Forbidden. Branch Admin cannot access another branch's records." },
                    { status: 403 }
                );
            }
            branch_id = authUser.branch_id;
            academy_id = authUser.academy_id;
        } else {
            // Regular user: strictly enforce self-attendance isolation
            user_id = String(authUser.id);
            if (authUser.academy_id) academy_id = authUser.academy_id;
            if (authUser.branch_id) branch_id = authUser.branch_id;
        }

        let sql = `
            SELECT
                a.*,
                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                u.user_type,
                u.appointment_no,
                b.branch_name,
                ac.academy_name
            FROM cst_attendance a
            LEFT JOIN cst_users u
                ON u.id = a.user_id
            LEFT JOIN cst_branch b
                ON b.id = a.branch_id
            LEFT JOIN cst_academy ac
                ON ac.id = a.academy_id
            WHERE 1=1
        `;

        const params = [];

        if (academy_id) {
            sql += ` AND a.academy_id = ?`;
            params.push(academy_id);
        }

        if (branch_id) {
            sql += ` AND a.branch_id = ?`;
            params.push(branch_id);
        }

        if (user_id) {
            sql += ` AND a.user_id = ?`;
            params.push(user_id);
        }

        if (attendance_type) {
            sql += ` AND a.attendance_type = ?`;
            params.push(attendance_type);
        }

        if (attendance_status) {
            sql += ` AND a.attendance_status = ?`;
            params.push(attendance_status);
        }

        if (attendance_date) {
            sql += ` AND a.attendance_date = ?`;
            params.push(attendance_date);
        }

        if (month && year) {
            sql += `
                AND MONTH(a.attendance_date) = ?
                AND YEAR(a.attendance_date) = ?
            `;
            params.push(Number(month), Number(year));
        }

        sql += ` ORDER BY a.attendance_date DESC, a.id DESC`;

        const [rows] = await connection.execute(sql, params);

        return NextResponse.json({
            success: true,
            message: "Attendance fetched successfully",
            total: rows.length,
            data: rows
        });

    } catch (error) {
        console.error("GET Attendance Error:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to fetch attendance",
            error: error.message
        }, { status: 500 });

    } finally {
        if (connection) connection.release();
    }
}


// =====================================================
// POST ATTENDANCE (WITH UPSERT & MULTI-TENANT ISOLATION)
// =====================================================
export async function POST(request) {
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

        const body = await request.json();

        // Check if batch insert/update is requested
        const items = Array.isArray(body?.items) ? body.items : [body];

        if (items.length === 0) {
            return NextResponse.json({
                success: false,
                message: "No attendance data provided"
            }, { status: 400 });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const results = [];

        for (const item of items) {
            let {
                academy_id = item.academy_id || authUser.academy_id,
                branch_id = item.branch_id || authUser.branch_id,
                user_id = item.user_id,
                attendance_type = item.attendance_type || "Player",
                attendance_date = item.attendance_date,
                attendance_status = item.attendance_status || "Present",
                check_in = item.check_in || null,
                check_out = item.check_out || null,
                late_minutes = Number(item.late_minutes) || 0,
                remarks = item.remarks || null,
                marked_by = authUser.id
            } = item;

            // Strict Role-Based Boundary Enforcement
            if (!isMasterAdmin) {
                // Non-admin roles (Coach, Player, Staff, Accountant, Management, Ground Staff)
                // can STRICTLY ONLY mark their own attendance!
                if (user_id && String(user_id) !== String(authUser.id)) {
                    await connection.rollback();
                    return NextResponse.json(
                        { success: false, message: "Forbidden. You can only mark your own attendance." },
                        { status: 403 }
                    );
                }
                user_id = authUser.id;
                academy_id = authUser.academy_id || academy_id;
                branch_id = authUser.branch_id || branch_id;

                // Attendance date window restriction: Only current date and up to 7 days in the past
                if (attendance_date) {
                    const todayObj = new Date();
                    const todayMidnight = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate()).getTime();
                    const dateParts = String(attendance_date).slice(0, 10).split("-").map(Number);
                    if (dateParts.length === 3 && !isNaN(dateParts[0]) && !isNaN(dateParts[1]) && !isNaN(dateParts[2])) {
                        const attDateMidnight = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).getTime();
                        const diffDays = Math.round((todayMidnight - attDateMidnight) / (1000 * 60 * 60 * 24));
                        if (diffDays < 0 || diffDays > 7) {
                            await connection.rollback();
                            return NextResponse.json(
                                {
                                    success: false,
                                    message: "Forbidden. Attendance can only be recorded for the current date and up to 7 days in the past."
                                },
                                { status: 403 }
                            );
                        }
                    }
                }
            } else if (authUser.isBranchAdmin) {
                branch_id = authUser.branch_id;
                academy_id = authUser.academy_id;
            } else if (authUser.isAcademyAdmin) {
                academy_id = authUser.academy_id;
            }

            // REQUIRED VALIDATION
            if (!academy_id || !branch_id || !user_id || !attendance_date) {
                await connection.rollback();
                return NextResponse.json({
                    success: false,
                    message: "Required fields are missing: academy_id, branch_id, user_id, attendance_date"
                }, { status: 400 });
            }

            // TYPE VALIDATION
            if (!["Staff", "Player"].includes(attendance_type)) {
                // Infer attendance_type from user if not explicitly valid
                attendance_type = "Player";
            }

            // STATUS VALIDATION
            if (!ALLOWED_STATUSES.includes(attendance_status)) {
                await connection.rollback();
                return NextResponse.json({
                    success: false,
                    message: `Invalid attendance status '${attendance_status}'. Allowed: ${ALLOWED_STATUSES.join(", ")}`
                }, { status: 400 });
            }

            // DATE OF JOINING VALIDATION: Attendance cannot be marked prior to joining date
            const [userDojRows] = await connection.execute(
                `SELECT
                    u.first_name,
                    u.last_name,
                    COALESCE(
                        st.date_of_joining,
                        (SELECT MIN(up.start_date) FROM cst_user_programs up WHERE up.user_id = u.id AND up.is_deleted = 0 AND up.status = 1 AND up.start_date IS NOT NULL),
                        (SELECT MIN(DATE(ap.created_at)) FROM cst_admission_players ap WHERE ap.user_id = u.id AND ap.is_deleted = 0),
                        DATE(u.created_at)
                    ) AS date_of_joining
                 FROM cst_users u
                 LEFT JOIN cst_staff st ON st.user_id = u.id AND st.is_deleted = 0
                 WHERE u.id = ? AND u.is_deleted = 0
                 LIMIT 1`,
                [user_id]
            );

            if (userDojRows.length > 0 && userDojRows[0].date_of_joining) {
                const dojStr = String(userDojRows[0].date_of_joining).slice(0, 10);
                const attDateStr = String(attendance_date).slice(0, 10);
                if (attDateStr < dojStr) {
                    if (items.length > 1) {
                        // In bulk actions (e.g. Mark All Today Present), safely skip users whose joining date is in the future
                        continue;
                    }
                    await connection.rollback();
                    return NextResponse.json({
                        success: false,
                        message: `Attendance cannot be marked before ${userDojRows[0].first_name || 'user'}'s joining date (${dojStr}).`
                    }, { status: 400 });
                }
            }

            // UPSERT ATTENDANCE (Insert or update if already marked on that date)
            const [res] = await connection.execute(
                `INSERT INTO cst_attendance (
                    academy_id,
                    branch_id,
                    user_id,
                    attendance_type,
                    attendance_date,
                    attendance_status,
                    check_in,
                    check_out,
                    late_minutes,
                    remarks,
                    marked_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    attendance_status = VALUES(attendance_status),
                    check_in = COALESCE(VALUES(check_in), check_in),
                    check_out = COALESCE(VALUES(check_out), check_out),
                    late_minutes = VALUES(late_minutes),
                    remarks = COALESCE(VALUES(remarks), remarks),
                    marked_by = VALUES(marked_by),
                    updated_at = NOW()`,
                [
                    academy_id,
                    branch_id,
                    user_id,
                    attendance_type,
                    attendance_date,
                    attendance_status,
                    check_in,
                    check_out,
                    late_minutes,
                    remarks,
                    marked_by
                ]
            );

            results.push({
                user_id,
                attendance_date,
                attendance_status,
                id: res.insertId || null
            });
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: items.length === 1 ? "Attendance recorded successfully" : `${items.length} attendance records saved`,
            data: items.length === 1 ? results[0] : results
        }, { status: 201 });

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (_) {}
        }
        console.error("POST Attendance Error:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to record attendance",
            error: error.message
        }, { status: 500 });

    } finally {
        if (connection) connection.release();
    }
}
