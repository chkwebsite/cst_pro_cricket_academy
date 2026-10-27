import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";

// =====================================================
// GET - SINGLE STAFF
// GET /api/staff/:id
// =====================================================
export async function GET(request, { params }) {
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

        return NextResponse.json({ success: true, data: rows[0] });
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
// Note: appointment_no and user_id are intentionally NOT editable here —
// they match the frontend, where those fields are read-only in the form.
// Use a separate "link user" endpoint/flow for changing user_id.
// =====================================================
export async function PUT(request, { params }) {
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
            `SELECT id FROM cst_staff WHERE id = ? AND is_deleted = 0 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return NextResponse.json({ success: false, message: "Staff not found" }, { status: 404 });
        }

        await connection.beginTransaction();

        // Same academy/branch guard as create — defense in depth in case
        // a stale or tampered payload reaches the API directly.
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

        const toNumberOrNull = (v) => (v === undefined || v === null || v === "" ? null : Number(v));
        const toNumberOrZero = (v) => (v === undefined || v === null || v === "" ? 0 : Number(v));

        await connection.query(
            `UPDATE cst_staff SET
                role_id = ?, academy_id = ?, branch_id = ?,
                first_name = ?, last_name = ?, father_name = ?, mother_name = ?, gender = ?,
                speciality = ?, experience = ?, previous_academy = ?, previous_academy_duration = ?,
                qualification = ?, achievement = ?, last_salary = ?, current_salary = ?,
                dob = ?, date_of_joining = ?, date_of_appointment = ?, status = ?
             WHERE id = ?`,
            [
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
    const connection = await pool.getConnection();
    try {
        const { id } = await params;

        if (!id || !/^\d+$/.test(String(id))) {
            return NextResponse.json({ success: false, message: "Valid Staff ID is required" }, { status: 400 });
        }

        const [existing] = await connection.query(
            `SELECT id FROM cst_staff WHERE id = ? AND is_deleted = 0 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return NextResponse.json({ success: false, message: "Staff not found" }, { status: 404 });
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
