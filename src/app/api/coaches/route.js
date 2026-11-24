import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";

// GET: All coaches
// Example: /api/coaches?search=Rahul&academy_id=1&branch_id=2&status=1
export async function GET(request) {
    let connection;

    try {
        const { user: authUser } = await getAuthenticatedUser(request);

        const { searchParams } = new URL(request.url);

        const search = searchParams.get("search");
        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");
        const status = searchParams.get("status");
        const employment_type = searchParams.get("employment_type");

        let sql = `
            SELECT
                c.*,
                CONCAT_WS(' ', u.first_name, u.last_name) AS coach_name,
                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                u.profile_image,
                u.user_type,
                a.academy_name,
                b.branch_name
            FROM cst_coaches c
            LEFT JOIN cst_users u
                ON u.id = c.user_id
            LEFT JOIN cst_academy a
                ON a.id = c.academy_id
            LEFT JOIN cst_branch b
                ON b.id = c.branch_id
            WHERE c.is_deleted = 0
              AND (u.is_deleted = 0 OR u.is_deleted IS NULL)
        `;

        const values = [];

        if (search) {
            sql += ` AND (
                CONCAT_WS(' ', u.first_name, u.last_name) LIKE ?
                OR u.email LIKE ?
                OR u.phone LIKE ?
                OR c.coach_code LIKE ?
                OR c.qualification LIKE ?
                OR c.specialization LIKE ?
            )`;

            const searchValue = `%${search}%`;

            values.push(
                searchValue,
                searchValue,
                searchValue,
                searchValue,
                searchValue,
                searchValue
            );
        }

        // Role-based Tenant Scoping
        if (authUser) {
            if (authUser.isBranchAdmin && authUser.branch_id) {
                sql += " AND c.branch_id = ? AND c.academy_id = ?";
                values.push(authUser.branch_id, authUser.academy_id);
            } else if (authUser.isAcademyAdmin && authUser.academy_id) {
                sql += " AND c.academy_id = ?";
                values.push(authUser.academy_id);
                if (branch_id) {
                    sql += " AND c.branch_id = ?";
                    values.push(branch_id);
                }
            } else if (!authUser.isSuperAdmin && authUser.academy_id) {
                sql += " AND c.academy_id = ?";
                values.push(authUser.academy_id);
                const allowed = authUser.assignedBranchIds && authUser.assignedBranchIds.length > 0
                    ? authUser.assignedBranchIds
                    : (authUser.branch_id ? [authUser.branch_id] : [-1]);
                if (branch_id) {
                    if (allowed.includes(Number(branch_id))) {
                        sql += " AND c.branch_id = ?";
                        values.push(branch_id);
                    } else {
                        sql += " AND c.branch_id = -1";
                    }
                } else {
                    sql += ` AND c.branch_id IN (${allowed.map(() => "?").join(",")})`;
                    values.push(...allowed);
                }
            } else {
                if (academy_id) {
                    sql += " AND c.academy_id = ?";
                    values.push(academy_id);
                }
                if (branch_id) {
                    sql += " AND c.branch_id = ?";
                    values.push(branch_id);
                }
            }
        } else {
            // Public website access: only active coaches across academies
            sql += " AND c.status = 1";
            if (academy_id) {
                sql += " AND c.academy_id = ?";
                values.push(academy_id);
            }
            if (branch_id) {
                sql += " AND c.branch_id = ?";
                values.push(branch_id);
            }
        }

        if (status !== null && status !== "" && status !== undefined) {
            sql += " AND c.status = ?";
            values.push(status);
        }

        if (employment_type) {
            sql += " AND c.employment_type = ?";
            values.push(employment_type);
        }

        sql += " ORDER BY c.id DESC";

        connection = await pool.getConnection();

        const [rows] = await connection.execute(sql, values);

        return NextResponse.json({
            success: true,
            data: rows,
        });
    } catch (error) {
        console.error("GET Coaches Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch coaches",
                error: process.env.NODE_ENV === "development" ? error.message : undefined,
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// POST: Create coach profile
export async function POST(request) {
    let connection;

    try {
        const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
        if (errorResponse) return errorResponse;

        if (!authUser.isSuperAdmin && !authUser.isAcademyAdmin && !authUser.isBranchAdmin) {
            return NextResponse.json(
                { success: false, message: "Forbidden: Insufficient permissions to create coach profile." },
                { status: 403 }
            );
        }

        const body = await request.json();

        let {
            user_id = null,
            academy_id = null,
            branch_id = null,
            coach_code = null,
            date_of_birth = null,
            gender = null,
            qualification = null,
            specialization = null,
            experience_years = 0,
            certifications = null,
            previous_academy = null,
            employment_type = "Full Time",
            joining_date = null,
            salary = null,
            emergency_contact_name = null,
            emergency_contact_phone = null,
            bio = null,
            status = 1,
        } = body;

        // Force tenant isolation
        if (authUser.isBranchAdmin) {
            academy_id = authUser.academy_id;
            branch_id = authUser.branch_id;
        } else if (authUser.isAcademyAdmin) {
            academy_id = authUser.academy_id;
        }

        const errors = {};

        if (!user_id) {
            errors.user_id = "Please select a user account for this coach profile.";
        }

        if (!academy_id) {
            errors.academy_id = "Please select an academy.";
        }

        if (!branch_id) {
            errors.branch_id = "Please select a branch.";
        }

        if (!coach_code || !String(coach_code).trim()) {
            errors.coach_code = "Coach code is required.";
        }

        const validGenders = ["Male", "Female", "Other"];
        const validEmploymentTypes = [
            "Full Time",
            "Part Time",
            "Visiting",
            "Contract",
        ];

        const validSpecializations = [
            "Batting",
            "Bowling",
            "Fielding",
            "Wicket Keeping",
            "Fitness",
            "All Rounder",
        ];

        if (!gender || !validGenders.includes(gender)) {
            errors.gender = "Please select a valid gender (Male, Female, Other).";
        }

        if (employment_type && !validEmploymentTypes.includes(employment_type)) {
            errors.employment_type = "Invalid employment type.";
        }

        // Normalize specialization
        let selectedSpecializations = null;
        if (!specialization || (Array.isArray(specialization) && specialization.length === 0)) {
            errors.specialization = "Please select at least one specialization.";
        } else {
            const specs = Array.isArray(specialization)
                ? specialization
                : String(specialization).split(",").map((s) => s.trim()).filter(Boolean);

            if (specs.some((item) => !validSpecializations.includes(item))) {
                errors.specialization = "Invalid specialization selected. Allowed: " + validSpecializations.join(", ");
            } else {
                selectedSpecializations = specs;
            }
        }

        const experience = Number(experience_years || 0);
        if (!Number.isFinite(experience) || experience < 0 || experience > 999.9) {
            errors.experience_years = "Experience years must be a valid number between 0 and 999.";
        }

        if (
            salary !== null &&
            salary !== "" &&
            (!Number.isFinite(Number(salary)) || Number(salary) < 0)
        ) {
            errors.salary = "Salary must be a valid non-negative number.";
        }

        if (emergency_contact_phone && String(emergency_contact_phone).trim()) {
            const digits = String(emergency_contact_phone).replace(/\D/g, "");
            if (digits.length < 10 || digits.length > 15) {
                errors.emergency_contact_phone = "Emergency contact phone must be between 10 and 15 digits.";
            }
        }

        if (Object.keys(errors).length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: Object.values(errors)[0],
                    errors,
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        // Validate user if provided
        if (user_id) {
            const [users] = await connection.execute(
                `SELECT id, user_type
                 FROM cst_users
                 WHERE id = ? AND is_deleted = 0`,
                [user_id]
            );

            if (users.length === 0) {
                return NextResponse.json(
                    { success: false, message: "User not found" },
                    { status: 404 }
                );
            }

            // Check whether a coach profile already exists for this user
            const [existingCoach] = await connection.execute(
                "SELECT id FROM cst_coaches WHERE user_id = ? AND is_deleted = 0",
                [user_id]
            );

            if (existingCoach.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Coach profile already exists for this user",
                        errors: { user_id: "A coach profile already exists for this user account." },
                    },
                    { status: 409 }
                );
            }
        }

        // Validate coach_code uniqueness per academy
        if (coach_code && coach_code.trim()) {
            const [existingCode] = await connection.execute(
                `SELECT id FROM cst_coaches WHERE academy_id = ? AND coach_code = ? AND is_deleted = 0 LIMIT 1`,
                [academy_id, coach_code.trim()]
            );

            if (existingCode.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Coach code already exists in this academy",
                        errors: { coach_code: "A coach with this code already exists in this academy." },
                    },
                    { status: 409 }
                );
            }
        }

        // Validate academy
        if (academy_id !== null && academy_id !== "") {
            const [academies] = await connection.execute(
                "SELECT id FROM cst_academy WHERE id = ? AND is_deleted = 0 AND status = 1",
                [academy_id]
            );

            if (academies.length === 0) {
                return NextResponse.json(
                    { success: false, message: "Academy not found or inactive", errors: { academy_id: "Selected academy not found or inactive." } },
                    { status: 400 }
                );
            }
        }

        // Validate branch and academy relationship
        if (branch_id !== null && branch_id !== "") {
            const [branches] = await connection.execute(
                `SELECT id, academy_id
                 FROM cst_branch
                 WHERE id = ? AND is_deleted = 0 AND status = 1`,
                [branch_id]
            );

            if (branches.length === 0) {
                return NextResponse.json(
                    { success: false, message: "Branch not found or inactive", errors: { branch_id: "Selected branch not found or inactive." } },
                    { status: 400 }
                );
            }

            if (
                academy_id !== null &&
                academy_id !== "" &&
                Number(branches[0].academy_id) !== Number(academy_id)
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Branch does not belong to selected academy",
                        errors: { branch_id: "Selected branch does not belong to the chosen academy." },
                    },
                    { status: 400 }
                );
            }
        }

        const [result] = await connection.execute(
            `INSERT INTO cst_coaches (
                user_id,
                academy_id,
                branch_id,
                coach_code,
                date_of_birth,
                gender,
                qualification,
                specialization,
                experience_years,
                certifications,
                previous_academy,
                employment_type,
                joining_date,
                salary,
                emergency_contact_name,
                emergency_contact_phone,
                bio,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                user_id || null,
                academy_id || null,
                branch_id || null,
                coach_code || null,
                date_of_birth || null,
                gender || null,
                qualification || null,
                selectedSpecializations ? selectedSpecializations.join(",") : null,
                experience,
                certifications || null,
                previous_academy || null,
                employment_type || "Full Time",
                joining_date || null,
                salary === "" || salary === null ? null : Number(salary),
                emergency_contact_name || null,
                emergency_contact_phone || null,
                bio || null,
                status !== undefined && status !== null && status !== "" ? Number(status) : 1,
            ]
        );

        return NextResponse.json(
            {
                success: true,
                message: "Coach profile created successfully",
                id: result.insertId,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST Coach Error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                {
                    success: false,
                    message: "user_id or coach_code already exists",
                },
                { status: 409 }
            );
        }

        if (error.code === "ER_NO_REFERENCED_ROW_2") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid user, academy or branch reference",
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: "Failed to create coach profile",
                error: process.env.NODE_ENV === "development" ? error.message : undefined,
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
