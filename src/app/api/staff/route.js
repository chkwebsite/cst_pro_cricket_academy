import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/app/components/lib/db";

async function generateAppointmentNo(connection) {
    const year = new Date().getFullYear();
    const prefix = `STF-${year}-`;

    const [rows] = await connection.query(
        `SELECT appointment_no FROM cst_staff
         WHERE appointment_no LIKE ?
         ORDER BY id DESC
         LIMIT 1
         FOR UPDATE`,
        [`${prefix}%`]
    );

    let nextSeq = 1;
    if (rows.length > 0) {
        const lastSeq = Number(rows[0].appointment_no.split("-").pop());
        if (Number.isInteger(lastSeq)) nextSeq = lastSeq + 1;
    }

    return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

// =====================================================
// GET - STAFF LIST
// =====================================================
export async function GET(request) {
    const connection = await pool.getConnection();
    try {
        const { searchParams } = new URL(request.url);
        const search = (searchParams.get("search") || "").trim();
        const academyId = searchParams.get("academy_id");
        const branchId = searchParams.get("branch_id");
        const roleId = searchParams.get("role_id");
        const statusParam = searchParams.get("status");
        const pageRaw = Number(searchParams.get("page") || 1);
        const limitRaw = Number(searchParams.get("limit") || 20);
        const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
        const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 20;
        const offset = (page - 1) * limit;

        const where = ["s.is_deleted = 0"];
        const params = [];

        if (search) {
            where.push(`(s.appointment_no LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ? OR s.speciality LIKE ?)`);
            const q = `%${search}%`;
            params.push(q, q, q, q);
        }
        if (academyId) { where.push("s.academy_id = ?"); params.push(Number(academyId)); }
        if (branchId) { where.push("s.branch_id = ?"); params.push(Number(branchId)); }
        if (roleId) { where.push("s.role_id = ?"); params.push(Number(roleId)); }
        if (statusParam !== null && statusParam !== "") {
            const status = Number(statusParam);
            if (!Number.isInteger(status)) {
                return NextResponse.json({ success: false, message: "Invalid status filter" }, { status: 400 });
            }
            where.push("s.status = ?");
            params.push(status);
        }

        const whereSql = `WHERE ${where.join(" AND ")}`;

        const [countRows] = await connection.query(
            `SELECT COUNT(*) AS total FROM cst_staff s ${whereSql}`,
            params
        );

        const [rows] = await connection.query(
            `SELECT
                s.id, s.appointment_no, s.user_id, s.role_id, r.role_name,
                s.academy_id, ac.academy_name, s.branch_id, b.branch_name,
                s.first_name, s.last_name, s.speciality, s.experience,
                s.current_salary, s.status, s.created_at
             FROM cst_staff s
             LEFT JOIN cst_roles r ON s.role_id = r.id
             LEFT JOIN cst_academy ac ON s.academy_id = ac.id
             LEFT JOIN cst_branch b ON s.branch_id = b.id
             ${whereSql}
             ORDER BY s.id DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        const total = Number(countRows[0]?.total || 0);
        return NextResponse.json({
            success: true,
            data: rows,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error("STAFF GET ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch staff", error: error.message },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}

// =====================================================
// POST - CREATE STAFF
// =====================================================
export async function POST(request) {
    const connection = await pool.getConnection();
    try {
        const body = await request.json();
        const {
            user_id,
            role_id,
            academy_id,
            branch_id,
            first_name,
            last_name,
            father_name,
            mother_name,
            gender,
            speciality,
            experience,
            previous_academy,
            previous_academy_duration,
            qualification,
            achievement,
            last_salary,
            current_salary,
            dob,
            date_of_joining,
            date_of_appointment,
            status,
        } = body;

        // ---------------- VALIDATION ----------------
        if (!first_name || !String(first_name).trim()) {
            return NextResponse.json({ success: false, message: "First name is required" }, { status: 400 });
        }
        if (!academy_id) {
            return NextResponse.json({ success: false, message: "Academy is required" }, { status: 400 });
        }
        if (!branch_id) {
            return NextResponse.json({ success: false, message: "Branch is required" }, { status: 400 });
        }
        if (!role_id) {
            return NextResponse.json({ success: false, message: "Role is required" }, { status: 400 });
        }

        await connection.beginTransaction();

        const [branchRows] = await connection.query(
            `SELECT id FROM cst_branch WHERE id = ? AND academy_id = ? LIMIT 1`,
            [branch_id, academy_id]
        );
        if (branchRows.length === 0) {
            await connection.rollback();
            return NextResponse.json(
                { success: false, message: "Selected branch does not belong to the selected academy" },
                { status: 400 }
            );
        }

        const [roleRows] = await connection.query(`SELECT id FROM cst_roles WHERE id = ? LIMIT 1`, [role_id]);
        if (roleRows.length === 0) {
            await connection.rollback();
            return NextResponse.json({ success: false, message: "Selected role does not exist" }, { status: 400 });
        }

        if (user_id) {
            const [userRows] = await connection.query(
                `SELECT id FROM cst_users WHERE id = ? AND is_deleted = 0 LIMIT 1`,
                [user_id]
            );
            if (userRows.length === 0) {
                await connection.rollback();
                return NextResponse.json({ success: false, message: "Linked user not found" }, { status: 400 });
            }
        }
        const appointment_no = await generateAppointmentNo(connection);

        const toNumberOrNull = (v) => (v === undefined || v === null || v === "" ? null : Number(v));
        const toNumberOrZero = (v) => (v === undefined || v === null || v === "" ? 0 : Number(v));

        const [result] = await connection.query(
            `INSERT INTO cst_staff (
                user_id, appointment_no, role_id, academy_id, branch_id,
                first_name, last_name, father_name, mother_name, gender,
                speciality, experience, previous_academy, previous_academy_duration,
                qualification, achievement, last_salary, current_salary,
                dob, date_of_joining, date_of_appointment, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                user_id || null,
                appointment_no,
                role_id,
                academy_id,
                branch_id,
                first_name,
                last_name || null,
                father_name || null,
                mother_name || null,
                gender || null,
                speciality || null,
                toNumberOrNull(experience),
                previous_academy || null,
                toNumberOrNull(previous_academy_duration),
                qualification || null,
                achievement || null,
                toNumberOrZero(last_salary),
                toNumberOrZero(current_salary),
                dob || null,
                date_of_joining || null,
                date_of_appointment || null,
                status !== undefined && status !== null && status !== "" ? Number(status) : 1,
            ]
        );

        await connection.query(`
                INSERT INTO cst_user_branches(
                branch_id,
                appointment_no
                )VALUES(?,?)
                `, [Number(branch_id), appointment_no]);

        // When role_id is 5 (Coach), automatically create/link a coach record in cst_coaches
        if (Number(role_id) === 5) {
            let coachUserId = user_id || null;

            if (!coachUserId) {
                const [existingUsers] = await connection.query(
                    `SELECT id FROM cst_users WHERE appointment_no = ? LIMIT 1`,
                    [appointment_no]
                );

                if (existingUsers.length > 0) {
                    coachUserId = existingUsers[0].id;
                } else {
                    const defaultPasswordHash = await bcrypt.hash("Coach@123", 10);
                    const [newUserResult] = await connection.query(
                        `INSERT INTO cst_users (
                            appointment_no, academy_id, branch_id, first_name, last_name, password, user_type, status
                        ) VALUES (?, ?, ?, ?, ?, ?, 'Coach', 1)`,
                        [
                            appointment_no,
                            academy_id,
                            branch_id,
                            first_name,
                            last_name || null,
                            defaultPasswordHash,
                        ]
                    );
                    coachUserId = newUserResult.insertId;

                    await connection.query(
                        `UPDATE cst_staff SET user_id = ? WHERE id = ?`,
                        [coachUserId, result.insertId]
                    );
                }
            }

            if (coachUserId) {
                await connection.query(
                    `UPDATE cst_user_branches SET user_id = ? WHERE appointment_no = ?`,
                    [coachUserId, appointment_no]
                );
            }

            // Normalize specialization set
            const validSpecs = [
                "Batting",
                "Bowling",
                "Fielding",
                "Wicket Keeping",
                "Fitness",
                "All Rounder",
            ];
            let matchedSpecs = [];
            if (speciality) {
                const raw = String(speciality).toLowerCase();
                if (raw.includes("batting")) matchedSpecs.push("Batting");
                if (raw.includes("bowling")) matchedSpecs.push("Bowling");
                if (raw.includes("fielding")) matchedSpecs.push("Fielding");
                if (raw.includes("wicket") || raw.includes("keeping")) matchedSpecs.push("Wicket Keeping");
                if (raw.includes("fitness")) matchedSpecs.push("Fitness");
                if (raw.includes("all rounder") || raw.includes("all-rounder")) matchedSpecs.push("All Rounder");
            }
            if (matchedSpecs.length === 0) matchedSpecs = ["All Rounder"];

            // Normalize gender enum
            let coachGender = null;
            if (gender) {
                const g = String(gender).toLowerCase();
                if (g === "male") coachGender = "Male";
                else if (g === "female") coachGender = "Female";
                else if (g === "other") coachGender = "Other";
            }

            await connection.query(
                `INSERT INTO cst_coaches (
                    user_id, academy_id, branch_id, coach_code,
                    date_of_birth, gender, qualification, specialization,
                    experience_years, previous_academy, employment_type,
                    joining_date, salary, bio, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Full Time', ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    academy_id = VALUES(academy_id),
                    branch_id = VALUES(branch_id),
                    date_of_birth = VALUES(date_of_birth),
                    gender = VALUES(gender),
                    qualification = VALUES(qualification),
                    specialization = VALUES(specialization),
                    experience_years = VALUES(experience_years),
                    previous_academy = VALUES(previous_academy),
                    joining_date = VALUES(joining_date),
                    salary = VALUES(salary),
                    bio = VALUES(bio),
                    status = VALUES(status)`,
                [
                    coachUserId,
                    academy_id,
                    branch_id,
                    appointment_no,
                    dob || null,
                    coachGender,
                    qualification || null,
                    matchedSpecs.join(","),
                    toNumberOrZero(experience),
                    previous_academy || null,
                    date_of_joining || null,
                    toNumberOrNull(current_salary),
                    achievement || null,
                    status !== undefined && status !== null && status !== "" ? Number(status) : 1,
                ]
            );
        }

        await connection.commit();

        return NextResponse.json(
            {
                success: true,
                message: "Staff created successfully",
                data: { id: result.insertId, appointment_no, first_name, last_name: last_name || null },
            },
            { status: 201 }
        );
    } catch (error) {
        await connection.rollback();

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                { success: false, message: "This user is already linked to another staff record" },
                { status: 409 }
            );
        }

        console.error("STAFF POST ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Failed to create staff", error: error.message },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}