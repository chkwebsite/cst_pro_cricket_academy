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

// =====================================================
// GET USER WEEKLY OFF (WITH MULTI-TENANT ISOLATION)
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
        const day_of_week = searchParams.get("day_of_week");

        // Multi-Tenant Isolation:
        // Super Admin: full scope
        // Academy Admin: own academy
        // Branch Admin: own branch & academy
        // Regular Users: strictly self-weekly-off isolation
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
            // Non-admin roles (Coach, Player, Staff, etc.): can only view their own schedule
            user_id = String(authUser.id);
            if (authUser.academy_id) academy_id = authUser.academy_id;
            if (authUser.branch_id) branch_id = authUser.branch_id;
        }

        let sql = `
            SELECT 
                w.id,
                w.academy_id,
                w.branch_id,
                w.user_id,
                w.day_of_week,
                w.status,
                w.remarks,
                w.created_at,
                w.updated_at,
                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                u.user_type,
                u.appointment_no,
                b.branch_name,
                a.academy_name
            FROM cst_user_weekly_off w
            INNER JOIN cst_users u ON u.id = w.user_id
            LEFT JOIN cst_branch b ON b.id = w.branch_id
            LEFT JOIN cst_academy a ON a.id = w.academy_id
            WHERE u.is_deleted = 0 AND w.status = 1
        `;

        const params = [];

        if (academy_id) {
            sql += ` AND w.academy_id = ?`;
            params.push(academy_id);
        }

        if (branch_id) {
            sql += ` AND w.branch_id = ?`;
            params.push(branch_id);
        }

        if (user_id) {
            sql += ` AND w.user_id = ?`;
            params.push(user_id);
        }

        if (day_of_week) {
            sql += ` AND w.day_of_week = ?`;
            params.push(day_of_week);
        }

        sql += ` ORDER BY u.first_name ASC, FIELD(w.day_of_week, 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')`;

        const [rows] = await connection.execute(sql, params);

        // Also compile a convenient user-grouped dictionary: { [user_id]: ['Sunday', 'Monday'] }
        const userDaysMap = {};
        rows.forEach((r) => {
            if (!userDaysMap[r.user_id]) {
                userDaysMap[r.user_id] = [];
            }
            if (!userDaysMap[r.user_id].includes(r.day_of_week)) {
                userDaysMap[r.user_id].push(r.day_of_week);
            }
        });

        return NextResponse.json({
            success: true,
            message: "User weekly off fetched successfully",
            total: rows.length,
            data: rows,
            userDaysMap
        });

    } catch (error) {
        console.error("GET User Weekly Off Error:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to fetch user weekly off records",
            error: error.message
        }, { status: 500 });

    } finally {
        if (connection) connection.release();
    }
}


// =====================================================
// POST USER WEEKLY OFF (SINGLE OR SYNC ARRAY OF DAYS)
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

        if (!authUser.isSuperAdmin && !authUser.isAcademyAdmin && !authUser.isBranchAdmin) {
            return NextResponse.json(
                { success: false, message: "Forbidden. Insufficient permissions." },
                { status: 403 }
            );
        }

        const body = await request.json();

        let {
            academy_id = body.academy_id || authUser.academy_id,
            branch_id = body.branch_id || authUser.branch_id,
            user_id = body.user_id,
            day_of_week = body.day_of_week,
            days = body.days, // Optional array: ['Monday', 'Tuesday'...]
            remarks = body.remarks || null
        } = body;

        // Role-Based Boundary Enforcement
        if (authUser.isBranchAdmin) {
            if (body.branch_id && String(body.branch_id) !== String(authUser.branch_id)) {
                return NextResponse.json(
                    { success: false, message: "Forbidden. Branch Admin cannot modify another branch's records." },
                    { status: 403 }
                );
            }
            branch_id = authUser.branch_id;
            academy_id = authUser.academy_id;
        } else if (authUser.isAcademyAdmin) {
            if (body.academy_id && String(body.academy_id) !== String(authUser.academy_id)) {
                return NextResponse.json(
                    { success: false, message: "Forbidden. Academy Admin cannot modify another academy's records." },
                    { status: 403 }
                );
            }
            academy_id = authUser.academy_id;
        }

        if (!academy_id || !branch_id || !user_id) {
            return NextResponse.json({
                success: false,
                message: "Missing required fields: academy_id, branch_id, user_id"
            }, { status: 400 });
        }

        connection = await pool.getConnection();

        // 1. If 'days' array is supplied, replace all weekly off days for this user
        if (Array.isArray(days)) {
            await connection.beginTransaction();

            // Delete previous weekly off assignments for this user
            await connection.execute(
                `DELETE FROM cst_user_weekly_off WHERE user_id = ?`,
                [user_id]
            );

            // Filter valid days
            const validSelectedDays = days.filter((d) => VALID_DAYS.includes(d));

            for (const d of validSelectedDays) {
                await connection.execute(
                    `INSERT INTO cst_user_weekly_off (academy_id, branch_id, user_id, day_of_week, status, remarks)
                     VALUES (?, ?, ?, ?, 1, ?)`,
                    [academy_id, branch_id, user_id, d, remarks]
                );
            }

            await connection.commit();

            return NextResponse.json({
                success: true,
                message: `Weekly off schedule updated successfully (${validSelectedDays.length} days assigned)`,
                data: {
                    user_id,
                    days: validSelectedDays
                }
            }, { status: 201 });
        }

        // 2. Single day assignment
        if (!day_of_week || !VALID_DAYS.includes(day_of_week)) {
            return NextResponse.json({
                success: false,
                message: `Invalid day_of_week. Allowed: ${VALID_DAYS.join(", ")}`
            }, { status: 400 });
        }

        const [res] = await connection.execute(
            `INSERT INTO cst_user_weekly_off (academy_id, branch_id, user_id, day_of_week, status, remarks)
             VALUES (?, ?, ?, ?, 1, ?)
             ON DUPLICATE KEY UPDATE status = 1, remarks = COALESCE(VALUES(remarks), remarks), updated_at = NOW()`,
            [academy_id, branch_id, user_id, day_of_week, remarks]
        );

        return NextResponse.json({
            success: true,
            message: "Weekly off day assigned successfully",
            data: {
                id: res.insertId,
                user_id,
                day_of_week
            }
        }, { status: 201 });

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (_) {}
        }
        console.error("POST User Weekly Off Error:", error);

        return NextResponse.json({
            success: false,
            message: "Failed to save user weekly off",
            error: error.message
        }, { status: 500 });

    } finally {
        if (connection) connection.release();
    }
}
