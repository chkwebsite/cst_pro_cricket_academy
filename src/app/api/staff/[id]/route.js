import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthUser } from "@/app/components/lib/rbac";

// =====================================================
// GET - SINGLE STAFF
// GET /api/staff/:id
// =====================================================
export async function GET(request, { params }) {
    const authUser = await getAuthUser(request);
    if (!authUser) {
        return NextResponse.json({ success: false, message: "Unauthorized. Authentication required." }, { status: 401 });
    }

    const connection = await pool.getConnection();
    try {
        const { id } = await params;

        if (!id || !/^\d+$/.test(String(id))) {
            return NextResponse.json({ success: false, message: "Valid Staff ID is required" }, { status: 400 });
        }

        const [rows] = await connection.query(
            `SELECT
                s.id, s.appointment_no, s.user_id, s.role_id, r.role_name,
                s.academy_id, ac.academy_name, s.branch_id, b.branch_name,
                s.first_name, s.last_name, s.father_name, s.mother_name, s.gender,
                s.speciality, s.experience, s.previous_academy, s.previous_academy_duration,
                s.qualification, s.achievement, s.last_salary, s.current_salary,
                s.dob, s.date_of_joining, s.date_of_appointment, s.status,
                s.created_at, s.updated_at
             FROM cst_staff s
             LEFT JOIN cst_roles r ON s.role_id = r.id
             LEFT JOIN cst_academy ac ON s.academy_id = ac.id
             LEFT JOIN cst_branch b ON s.branch_id = b.id
             WHERE s.id = ? AND s.is_deleted = 0
             LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json({ success: false, message: "Staff not found" }, { status: 404 });
        }

        const staff = rows[0];

        // Multi-Tenant and Role Isolation
        if (authUser.isStaff && !authUser.isSuperAdmin && !authUser.isAcademyAdmin && !authUser.isBranchAdmin) {
            if (Number(staff.user_id) !== Number(authUser.id)) {
                return NextResponse.json({ success: false, message: "Forbidden. You can only view your own staff record." }, { status: 403 });
            }
        }
        if (authUser.isBranchAdmin && (Number(staff.branch_id) !== Number(authUser.branch_id) || (authUser.academy_id && Number(staff.academy_id) !== Number(authUser.academy_id)))) {
            return NextResponse.json({ success: false, message: "Forbidden. You cannot view staff from another branch." }, { status: 403 });
        }
        if (authUser.isAcademyAdmin && authUser.academy_id && Number(staff.academy_id) !== Number(authUser.academy_id)) {
            return NextResponse.json({ success: false, message: "Forbidden. You cannot view staff from another academy." }, { status: 403 });
        }

        return NextResponse.json({ success: true, data: staff });
    } catch (error) {
        console.error("SINGLE STAFF GET ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch staff", error: error.message },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}

// =====================================================
// PUT - UPDATE STAFF
// =====================================================
export async function PUT(request, { params }) {
    const authUser = await getAuthUser(request);
    if (!authUser) {
        return NextResponse.json({ success: false, message: "Unauthorized. Authentication required." }, { status: 401 });
    }

    if (!authUser.isSuperAdmin && !authUser.isAcademyAdmin && !authUser.isBranchAdmin) {
        return NextResponse.json({ success: false, message: "Forbidden. Insufficient permissions to update staff." }, { status: 403 });
    }

    const connection = await pool.getConnection();
    try {
        const { id } = await params;

        if (!id || !/^\d+$/.test(String(id))) {
            return NextResponse.json({ success: false, message: "Valid Staff ID is required" }, { status: 400 });
        }

        const body = await request.json();
        const {
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

        const [existing] = await connection.query(
            `SELECT id, academy_id, branch_id FROM cst_staff WHERE id = ? AND is_deleted = 0 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return NextResponse.json({ success: false, message: "Staff not found" }, { status: 404 });
        }

        // Multi-Tenant Isolation on Existing Record
        if (authUser.isBranchAdmin && (Number(existing[0].branch_id) !== Number(authUser.branch_id) || (authUser.academy_id && Number(existing[0].academy_id) !== Number(authUser.academy_id)))) {
            return NextResponse.json({ success: false, message: "Forbidden. You cannot update staff from another branch." }, { status: 403 });
        }
        if (authUser.isAcademyAdmin && authUser.academy_id && Number(existing[0].academy_id) !== Number(authUser.academy_id)) {
            return NextResponse.json({ success: false, message: "Forbidden. You cannot update staff from another academy." }, { status: 403 });
        }

        // Validate target branch and academy
        if (authUser.isBranchAdmin && Number(branch_id) !== Number(authUser.branch_id)) {
            return NextResponse.json({ success: false, message: "Forbidden. You cannot assign staff to another branch." }, { status: 403 });
        }
        if (authUser.isAcademyAdmin && authUser.academy_id && Number(academy_id) !== Number(authUser.academy_id)) {
            return NextResponse.json({ success: false, message: "Forbidden. You cannot assign staff to another academy." }, { status: 403 });
        }

        await connection.beginTransaction();

        // Check if branch belongs to academy
        const [branchRows] = await connection.query(
            `SELECT id FROM cst_branch WHERE id = ? AND academy_id = ? LIMIT 1`,
            [branch_id, academy_id]
        );
        if (branchRows.length === 0) {
            await connection.rollback();
            return NextResponse.json(
                { success: false, message: "Branch does not belong to the selected academy" },
                { status: 400 }
            );
        }

        const [roleRows] = await connection.query(
            `SELECT id FROM cst_roles WHERE id = ? AND status = 1 LIMIT 1`,
            [role_id]
        );
        if (roleRows.length === 0) {
            await connection.rollback();
            return NextResponse.json({ success: false, message: "Invalid or inactive role" }, { status: 400 });
        }

        await connection.query(
            `UPDATE cst_staff
             SET role_id = ?,
                 academy_id = ?,
                 branch_id = ?,
                 first_name = ?,
                 last_name = ?,
                 father_name = ?,
                 mother_name = ?,
                 gender = ?,
                 speciality = ?,
                 experience = ?,
                 previous_academy = ?,
                 previous_academy_duration = ?,
                 qualification = ?,
                 achievement = ?,
                 last_salary = ?,
                 current_salary = ?,
                 dob = ?,
                 date_of_joining = ?,
                 date_of_appointment = ?,
                 status = ?,
                 updated_at = NOW()
             WHERE id = ?`,
            [
                role_id,
                academy_id,
                branch_id,
                first_name.trim(),
                last_name ? last_name.trim() : null,
                father_name ? father_name.trim() : null,
                mother_name ? mother_name.trim() : null,
                gender || null,
                speciality ? speciality.trim() : null,
                experience ? experience.trim() : null,
                previous_academy ? previous_academy.trim() : null,
                previous_academy_duration ? previous_academy_duration.trim() : null,
                qualification ? qualification.trim() : null,
                achievement ? achievement.trim() : null,
                last_salary !== undefined && last_salary !== "" ? Number(last_salary) : null,
                current_salary !== undefined && current_salary !== "" ? Number(current_salary) : null,
                dob || null,
                date_of_joining || null,
                date_of_appointment || null,
                status !== undefined ? Number(status) : 1,
                id,
            ]
        );

        await connection.commit();

        return NextResponse.json({ success: true, message: "Staff updated successfully", data: { id: Number(id) } });
    } catch (error) {
        await connection.rollback();
        console.error("STAFF PUT ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Failed to update staff", error: error.message },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}

// =====================================================
// DELETE - SOFT DELETE STAFF
// =====================================================
export async function DELETE(request, { params }) {
    const authUser = await getAuthUser(request);
    if (!authUser) {
        return NextResponse.json({ success: false, message: "Unauthorized. Authentication required." }, { status: 401 });
    }

    if (!authUser.isSuperAdmin && !authUser.isAcademyAdmin && !authUser.isBranchAdmin) {
        return NextResponse.json({ success: false, message: "Forbidden. Insufficient permissions to delete staff." }, { status: 403 });
    }

    const connection = await pool.getConnection();
    try {
        const { id } = await params;

        if (!id || !/^\d+$/.test(String(id))) {
            return NextResponse.json({ success: false, message: "Valid Staff ID is required" }, { status: 400 });
        }

        const [existing] = await connection.query(
            `SELECT id, academy_id, branch_id FROM cst_staff WHERE id = ? AND is_deleted = 0 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return NextResponse.json({ success: false, message: "Staff not found" }, { status: 404 });
        }

        // Multi-Tenant Isolation
        if (authUser.isBranchAdmin && (Number(existing[0].branch_id) !== Number(authUser.branch_id) || (authUser.academy_id && Number(existing[0].academy_id) !== Number(authUser.academy_id)))) {
            return NextResponse.json({ success: false, message: "Forbidden. You cannot delete staff from another branch." }, { status: 403 });
        }
        if (authUser.isAcademyAdmin && authUser.academy_id && Number(existing[0].academy_id) !== Number(authUser.academy_id)) {
            return NextResponse.json({ success: false, message: "Forbidden. You cannot delete staff from another academy." }, { status: 403 });
        }

        await connection.query(`UPDATE cst_staff SET is_deleted = 1, status = 0 WHERE id = ?`, [id]);

        return NextResponse.json({ success: true, message: "Staff deleted successfully" });
    } catch (error) {
        console.error("STAFF DELETE ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Failed to delete staff", error: error.message },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}
