import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthUser } from "@/app/components/lib/rbac";

// GET: Single coach
export async function GET(request, { params }) {
    let connection;

    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json(
                { success: false, message: "Unauthorized. Authentication required." },
                { status: 401 }
            );
        }

        const { id } = await params;

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            `SELECT
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
             WHERE c.id = ?
               AND c.is_deleted = 0
             LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Coach not found" },
                { status: 404 }
            );
        }

        const coach = rows[0];

        // Multi-Tenant Isolation
        if (authUser.isBranchAdmin && (Number(coach.branch_id) !== Number(authUser.branch_id) || (authUser.academy_id && Number(coach.academy_id) !== Number(authUser.academy_id)))) {
            return NextResponse.json(
                { success: false, message: "Forbidden. You cannot view coaches from another branch." },
                { status: 403 }
            );
        }
        if (authUser.isAcademyAdmin && authUser.academy_id && Number(coach.academy_id) !== Number(authUser.academy_id)) {
            return NextResponse.json(
                { success: false, message: "Forbidden. You cannot view coaches from another academy." },
                { status: 403 }
            );
        }

        return NextResponse.json({
            success: true,
            data: coach,
        });
    } catch (error) {
        console.error("GET Single Coach Error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch coach", error: error.message },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// PUT: Update coach profile
export async function PUT(request, { params }) {
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
                { success: false, message: "Forbidden. Insufficient permissions to update coach." },
                { status: 403 }
            );
        }

        const { id } = await params;
        const body = await request.json();

        const allowedFields = [
            "academy_id",
            "branch_id",
            "coach_code",
            "date_of_birth",
            "gender",
            "qualification",
            "specialization",
            "experience_years",
            "certifications",
            "previous_academy",
            "employment_type",
            "joining_date",
            "salary",
            "emergency_contact_name",
            "emergency_contact_phone",
            "bio",
            "status",
        ];

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

        if (
            body.gender !== undefined &&
            body.gender !== null &&
            body.gender !== "" &&
            !validGenders.includes(body.gender)
        ) {
            return NextResponse.json(
                { success: false, message: "Invalid gender. Allowed: Male, Female, Other" },
                { status: 400 }
            );
        }

        if (
            body.employment_type !== undefined &&
            body.employment_type !== null &&
            !validEmploymentTypes.includes(body.employment_type)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid employment_type",
                },
                { status: 400 }
            );
        }

        if (body.specialization !== undefined && body.specialization !== null && body.specialization !== "") {
            const specializations = Array.isArray(body.specialization)
                ? body.specialization
                : String(body.specialization).split(",").map((s) => s.trim()).filter(Boolean);

            if (
                specializations.some(
                    (item) => !validSpecializations.includes(item)
                )
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid specialization. Allowed: " + validSpecializations.join(", "),
                    },
                    { status: 400 }
                );
            }
        }

        if (body.experience_years !== undefined && body.experience_years !== null && body.experience_years !== "") {
            const experience = Number(body.experience_years);

            if (
                !Number.isFinite(experience) ||
                experience < 0 ||
                experience > 999.9
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid experience_years",
                    },
                    { status: 400 }
                );
            }
        }

        if (
            body.salary !== undefined &&
            body.salary !== null &&
            body.salary !== "" &&
            (!Number.isFinite(Number(body.salary)) || Number(body.salary) < 0)
        ) {
            return NextResponse.json(
                { success: false, message: "Invalid salary" },
                { status: 400 }
            );
        }

        const updates = [];
        const values = [];

        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(body, field)) {
                let value = body[field];

                if (field === "specialization") {
                    if (value === "" || value === null) {
                        value = null;
                    } else if (Array.isArray(value)) {
                        value = value.join(",");
                    }
                } else if (typeof value === "string") {
                    value = value.trim() || null;
                }

                updates.push(`${field} = ?`);
                values.push(value);
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

        const [existing] = await connection.execute(
            `SELECT id, academy_id, branch_id
             FROM cst_coaches
             WHERE id = ? AND is_deleted = 0`,
            [id]
        );

        if (existing.length === 0) {
            return NextResponse.json(
                { success: false, message: "Coach not found" },
                { status: 404 }
            );
        }

        // Multi-Tenant Isolation
        if (authUser.isBranchAdmin && (Number(existing[0].branch_id) !== Number(authUser.branch_id) || (authUser.academy_id && Number(existing[0].academy_id) !== Number(authUser.academy_id)))) {
            return NextResponse.json(
                { success: false, message: "Forbidden. You cannot update a coach from another branch." },
                { status: 403 }
            );
        }
        if (authUser.isAcademyAdmin && authUser.academy_id && Number(existing[0].academy_id) !== Number(authUser.academy_id)) {
            return NextResponse.json(
                { success: false, message: "Forbidden. You cannot update a coach from another academy." },
                { status: 403 }
            );
        }

        // Validate references if supplied
        const referenceTables = {
            academy_id: "cst_academy",
            branch_id: "cst_branch",
        };

        for (const [field, table] of Object.entries(referenceTables)) {
            if (
                Object.prototype.hasOwnProperty.call(body, field) &&
                body[field] !== null &&
                body[field] !== ""
            ) {
                const [rows] = await connection.execute(
                    `SELECT id FROM ${table} WHERE id = ?`,
                    [body[field]]
                );

                if (rows.length === 0) {
                    return NextResponse.json(
                        {
                            success: false,
                            message: `${field} not found`,
                        },
                        { status: 400 }
                    );
                }
            }
        }

        // Validate branch belongs to the final academy selection
        const [currentRows] = await connection.execute(
            `SELECT academy_id, branch_id
             FROM cst_coaches
             WHERE id = ?`,
            [id]
        );

        const finalAcademyId = Object.prototype.hasOwnProperty.call(body, "academy_id")
            ? body.academy_id
            : currentRows[0].academy_id;

        const finalBranchId = Object.prototype.hasOwnProperty.call(body, "branch_id")
            ? body.branch_id
            : currentRows[0].branch_id;

        if (finalBranchId !== null && finalBranchId !== "") {
            const [branchRows] = await connection.execute(
                `SELECT academy_id
                 FROM cst_branch
                 WHERE id = ?`,
                [finalBranchId]
            );

            if (
                branchRows.length === 0 ||
                (
                    finalAcademyId !== null &&
                    finalAcademyId !== "" &&
                    Number(branchRows[0].academy_id) !== Number(finalAcademyId)
                )
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Branch does not belong to selected academy",
                    },
                    { status: 400 }
                );
            }
        }

        values.push(id);

        await connection.execute(
            `UPDATE cst_coaches
             SET ${updates.join(", ")}
             WHERE id = ? AND is_deleted = 0`,
            values
        );

        return NextResponse.json({
            success: true,
            message: "Coach updated successfully",
        });
    } catch (error) {
        console.error("PUT Coach Error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                {
                    success: false,
                    message: "coach_code already exists",
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { success: false, message: "Failed to update coach", error: error.message },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// DELETE: Soft delete coach profile
export async function DELETE(request, { params }) {
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
                { success: false, message: "Forbidden. Insufficient permissions to delete coach." },
                { status: 403 }
            );
        }

        const { id } = await params;

        connection = await pool.getConnection();

        const [existing] = await connection.execute(
            `SELECT id, academy_id, branch_id
             FROM cst_coaches
             WHERE id = ? AND is_deleted = 0`,
            [id]
        );

        if (existing.length === 0) {
            return NextResponse.json(
                { success: false, message: "Coach not found" },
                { status: 404 }
            );
        }

        // Multi-Tenant Isolation
        if (authUser.isBranchAdmin && (Number(existing[0].branch_id) !== Number(authUser.branch_id) || (authUser.academy_id && Number(existing[0].academy_id) !== Number(authUser.academy_id)))) {
            return NextResponse.json(
                { success: false, message: "Forbidden. You cannot delete a coach from another branch." },
                { status: 403 }
            );
        }
        if (authUser.isAcademyAdmin && authUser.academy_id && Number(existing[0].academy_id) !== Number(authUser.academy_id)) {
            return NextResponse.json(
                { success: false, message: "Forbidden. You cannot delete a coach from another academy." },
                { status: 403 }
            );
        }

        const [result] = await connection.execute(
            `UPDATE cst_coaches
             SET is_deleted = 1
             WHERE id = ?
               AND is_deleted = 0`,
            [id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json(
                { success: false, message: "Coach not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Coach profile deleted successfully",
        });
    } catch (error) {
        console.error("DELETE Coach Error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to delete coach", error: error.message },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
