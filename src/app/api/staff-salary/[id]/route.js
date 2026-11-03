import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthUser } from "@/app/components/lib/rbac";

export async function GET(request, { params }) {
    let connection;
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
        }
        if (!authUser.isSuperAdmin && !authUser.isAcademyAdmin && !authUser.isBranchAdmin) {
            return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
        }

        const { id } = await params;
        connection = await pool.getConnection();

        const [rows] = await connection.query(
            `SELECT 
                sal.*,
                s.appointment_no,
                s.first_name,
                s.last_name,
                s.user_id,
                r.role_name,
                a.academy_name,
                b.branch_name,
                u.email,
                u.phone
            FROM cst_staff_salary sal
            JOIN cst_staff s ON s.id = sal.staff_id
            LEFT JOIN cst_roles r ON r.id = s.role_id
            LEFT JOIN cst_academy a ON a.id = sal.academy_id
            LEFT JOIN cst_branch b ON b.id = sal.branch_id
            LEFT JOIN cst_users u ON u.id = s.user_id
            WHERE sal.id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json({ success: false, message: "Record not found." }, { status: 404 });
        }

        const record = rows[0];

        // Multi-Tenant Isolation
        if (authUser.isAcademyAdmin && String(record.academy_id) !== String(authUser.academy_id)) {
            return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
        }
        if (authUser.isBranchAdmin && (String(record.branch_id) !== String(authUser.branch_id) || String(record.academy_id) !== String(authUser.academy_id))) {
            return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
        }

        return NextResponse.json({ success: true, data: record });
    } catch (err) {
        console.error("GET /api/staff-salary/[id] error:", err);
        return NextResponse.json({ success: false, message: err.message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

export async function PUT(request, { params }) {
    let connection;
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
        }
        if (!authUser.isSuperAdmin && !authUser.isAcademyAdmin && !authUser.isBranchAdmin) {
            return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
        }

        const { id } = await params;
        connection = await pool.getConnection();

        const [existing] = await connection.query(`SELECT * FROM cst_staff_salary WHERE id = ?`, [id]);
        if (existing.length === 0) {
            return NextResponse.json({ success: false, message: "Record not found." }, { status: 404 });
        }

        const current = existing[0];

        // Multi-Tenant Isolation
        if (authUser.isAcademyAdmin && String(current.academy_id) !== String(authUser.academy_id)) {
            return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
        }
        if (authUser.isBranchAdmin && (String(current.branch_id) !== String(authUser.branch_id) || String(current.academy_id) !== String(authUser.academy_id))) {
            return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
        }

        const body = await request.json();

        let basic_salary = body.basic_salary !== undefined ? Number(body.basic_salary) : Number(current.basic_salary);
        let hra = body.hra !== undefined ? Number(body.hra) : Number(current.hra);
        let da = body.da !== undefined ? Number(body.da) : Number(current.da || 0);
        let conveyance_allowance = body.conveyance_allowance !== undefined ? Number(body.conveyance_allowance) : (body.conveyance !== undefined ? Number(body.conveyance) : Number(current.conveyance_allowance));
        let medical_allowance = body.medical_allowance !== undefined ? Number(body.medical_allowance) : Number(current.medical_allowance || 0);
        let other_allowance = body.other_allowance !== undefined ? Number(body.other_allowance) : Number(current.other_allowance);
        let pf_deduction = body.pf_deduction !== undefined ? Number(body.pf_deduction) : Number(current.pf_deduction);
        let advance_deduction = body.advance_deduction !== undefined ? Number(body.advance_deduction) : Number(current.advance_deduction || 0);
        let esi_deduction = body.esi_deduction !== undefined ? Number(body.esi_deduction) : Number(current.esi_deduction || 0);
        let professional_tax = body.professional_tax !== undefined ? Number(body.professional_tax) : Number(current.professional_tax || 0);
        let other_deduction = body.other_deduction !== undefined ? Number(body.other_deduction) : Number(current.other_deduction || 0);
        let effective_from = body.effective_from || current.effective_from;
        let effective_to = body.effective_to !== undefined ? body.effective_to : current.effective_to;
        let status = body.status || current.status;

        const gross_salary = Math.round((basic_salary + hra + da + conveyance_allowance + medical_allowance + other_allowance) * 100) / 100;
        const totalDeductions = pf_deduction + advance_deduction + esi_deduction + professional_tax + other_deduction;
        const net_salary = Math.max(0, Math.round((gross_salary - totalDeductions) * 100) / 100);

        await connection.query(
            `UPDATE cst_staff_salary SET
                basic_salary = ?,
                hra = ?,
                da = ?,
                conveyance_allowance = ?,
                medical_allowance = ?,
                other_allowance = ?,
                gross_salary = ?,
                pf_deduction = ?,
                advance_deduction = ?,
                esi_deduction = ?,
                professional_tax = ?,
                other_deduction = ?,
                net_salary = ?,
                effective_from = ?,
                effective_to = ?,
                status = ?
            WHERE id = ?`,
            [
                basic_salary, hra, da, conveyance_allowance, medical_allowance, other_allowance,
                gross_salary, pf_deduction, advance_deduction, esi_deduction, professional_tax, other_deduction,
                net_salary, effective_from, effective_to, status,
                id
            ]
        );

        return NextResponse.json({
            success: true,
            message: "Staff salary structure updated successfully.",
            data: { id, gross_salary, net_salary }
        });
    } catch (err) {
        console.error("PUT /api/staff-salary/[id] error:", err);
        return NextResponse.json({ success: false, message: err.message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

export async function DELETE(request, { params }) {
    let connection;
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
        }
        if (!authUser.isSuperAdmin && !authUser.isAcademyAdmin && !authUser.isBranchAdmin) {
            return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
        }

        const { id } = await params;
        connection = await pool.getConnection();

        const [existing] = await connection.query(`SELECT * FROM cst_staff_salary WHERE id = ?`, [id]);
        if (existing.length === 0) {
            return NextResponse.json({ success: false, message: "Record not found." }, { status: 404 });
        }

        const current = existing[0];

        // Multi-Tenant Isolation
        if (authUser.isAcademyAdmin && String(current.academy_id) !== String(authUser.academy_id)) {
            return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
        }
        if (authUser.isBranchAdmin && (String(current.branch_id) !== String(authUser.branch_id) || String(current.academy_id) !== String(authUser.academy_id))) {
            return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
        }

        // Soft deactivation or hard delete
        await connection.query(`UPDATE cst_staff_salary SET status = 'Inactive' WHERE id = ?`, [id]);

        return NextResponse.json({ success: true, message: "Staff salary structure marked Inactive." });
    } catch (err) {
        console.error("DELETE /api/staff-salary/[id] error:", err);
        return NextResponse.json({ success: false, message: err.message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}
