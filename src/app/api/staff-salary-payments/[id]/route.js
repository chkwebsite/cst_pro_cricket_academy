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
                p.*,
                s.appointment_no,
                s.first_name,
                s.last_name,
                s.user_id,
                s.date_of_joining,
                r.role_name,
                a.academy_name,
                b.branch_name,
                sal.gross_salary AS full_base_salary,
                sal.pf_deduction AS base_pf_deduction,
                sal.advance_deduction AS base_advance_deduction,
                u.email,
                u.phone
            FROM cst_staff_salary_payments p
            JOIN cst_staff s ON s.id = p.staff_id
            LEFT JOIN cst_roles r ON r.id = s.role_id
            LEFT JOIN cst_staff_salary sal ON sal.id = p.salary_structure_id
            LEFT JOIN cst_academy a ON a.id = p.academy_id
            LEFT JOIN cst_branch b ON b.id = p.branch_id
            LEFT JOIN cst_users u ON u.id = s.user_id
            WHERE p.id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json({ success: false, message: "Payment record not found." }, { status: 404 });
        }

        const payment = rows[0];

        // Multi-Tenant Isolation
        if (authUser.isAcademyAdmin && String(payment.academy_id) !== String(authUser.academy_id)) {
            return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
        }
        if (authUser.isBranchAdmin && (String(payment.branch_id) !== String(authUser.branch_id) || String(payment.academy_id) !== String(authUser.academy_id))) {
            return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
        }

        // Also fetch transactions for this payment
        const [transactions] = await connection.query(
            `SELECT * FROM cst_staff_salary_transactions WHERE salary_payment_id = ? ORDER BY id DESC`,
            [id]
        );

        return NextResponse.json({
            success: true,
            data: {
                ...payment,
                transactions,
            },
        });
    } catch (err) {
        console.error("GET /api/staff-salary-payments/[id] error:", err);
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

        const [existing] = await connection.query(`SELECT * FROM cst_staff_salary_payments WHERE id = ?`, [id]);
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

        const bonus = body.bonus !== undefined ? Number(body.bonus) : Number(current.bonus || 0);
        const overtime_amount = body.overtime_amount !== undefined ? Number(body.overtime_amount) : Number(current.overtime_amount || 0);
        const deductions = body.deductions !== undefined ? Number(body.deductions) : Number(current.deductions || 0);
        const advance_deduction = body.advance_deduction !== undefined ? Number(body.advance_deduction) : Number(current.advance_deduction || 0);
        const remarks = body.remarks !== undefined ? body.remarks : current.remarks;
        const gross_salary = Number(current.gross_salary || 0);

        const net_salary = Math.max(0, Math.round((gross_salary + bonus + overtime_amount - deductions - advance_deduction) * 100) / 100);
        const paid_amount = Number(current.paid_amount || 0);
        const due_amount = Math.max(0, Math.round((net_salary - paid_amount) * 100) / 100);

        let payment_status = current.payment_status;
        if (due_amount <= 0 && paid_amount > 0) {
            payment_status = "Paid";
        } else if (paid_amount > 0) {
            payment_status = "Partial";
        } else {
            payment_status = "Pending";
        }

        await connection.query(
            `UPDATE cst_staff_salary_payments SET
                bonus = ?,
                overtime_amount = ?,
                deductions = ?,
                advance_deduction = ?,
                net_salary = ?,
                due_amount = ?,
                payment_status = ?,
                remarks = ?
            WHERE id = ?`,
            [bonus, overtime_amount, deductions, advance_deduction, net_salary, due_amount, payment_status, remarks, id]
        );

        return NextResponse.json({
            success: true,
            message: "Payment record updated successfully.",
            data: { id, net_salary, due_amount, payment_status }
        });
    } catch (err) {
        console.error("PUT /api/staff-salary-payments/[id] error:", err);
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

        const [existing] = await connection.query(`SELECT * FROM cst_staff_salary_payments WHERE id = ?`, [id]);
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

        await connection.beginTransaction();
        // Delete child transactions first
        await connection.query(`DELETE FROM cst_staff_salary_transactions WHERE salary_payment_id = ?`, [id]);
        await connection.query(`DELETE FROM cst_staff_salary_payments WHERE id = ?`, [id]);
        await connection.commit();

        return NextResponse.json({ success: true, message: "Payment record deleted successfully." });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("DELETE /api/staff-salary-payments/[id] error:", err);
        return NextResponse.json({ success: false, message: err.message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}
