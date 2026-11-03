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
                t.*,
                p.salary_month,
                p.salary_year,
                p.net_salary AS payment_net_salary,
                p.paid_amount AS payment_total_paid,
                p.due_amount AS payment_due_amount,
                p.payment_status AS payment_current_status,
                s.appointment_no,
                s.first_name,
                s.last_name,
                s.user_id,
                r.role_name,
                a.academy_name,
                b.branch_name,
                u.email
            FROM cst_staff_salary_transactions t
            JOIN cst_staff_salary_payments p ON p.id = t.salary_payment_id
            JOIN cst_staff s ON s.id = p.staff_id
            LEFT JOIN cst_roles r ON r.id = s.role_id
            LEFT JOIN cst_academy a ON a.id = p.academy_id
            LEFT JOIN cst_branch b ON b.id = p.branch_id
            LEFT JOIN cst_users u ON u.id = s.user_id
            WHERE t.id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json({ success: false, message: "Transaction record not found." }, { status: 404 });
        }

        const tx = rows[0];

        // Multi-Tenant Isolation
        if (authUser.isAcademyAdmin && String(tx.academy_id) !== String(authUser.academy_id)) {
            return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
        }
        if (authUser.isBranchAdmin && (String(tx.branch_id) !== String(authUser.branch_id) || String(tx.academy_id) !== String(authUser.academy_id))) {
            return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
        }

        return NextResponse.json({ success: true, data: tx });
    } catch (err) {
        console.error("GET /api/staff-salary-transactions/[id] error:", err);
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
        await connection.beginTransaction();

        const [existing] = await connection.query(
            `SELECT t.*, p.academy_id, p.branch_id, p.net_salary 
             FROM cst_staff_salary_transactions t
             JOIN cst_staff_salary_payments p ON p.id = t.salary_payment_id
             WHERE t.id = ? FOR UPDATE`,
            [id]
        );

        if (existing.length === 0) {
            await connection.rollback();
            return NextResponse.json({ success: false, message: "Transaction record not found." }, { status: 404 });
        }

        const tx = existing[0];

        // Multi-Tenant Isolation
        if (authUser.isAcademyAdmin && String(tx.academy_id) !== String(authUser.academy_id)) {
            await connection.rollback();
            return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
        }
        if (authUser.isBranchAdmin && (String(tx.branch_id) !== String(authUser.branch_id) || String(tx.academy_id) !== String(authUser.academy_id))) {
            await connection.rollback();
            return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
        }

        const salaryPaymentId = tx.salary_payment_id;

        // Delete transaction
        await connection.query(`DELETE FROM cst_staff_salary_transactions WHERE id = ?`, [id]);

        // Recalculate parent payment
        const [sumRows] = await connection.query(
            `SELECT COALESCE(SUM(amount), 0) AS total_paid 
             FROM cst_staff_salary_transactions 
             WHERE salary_payment_id = ?`,
            [salaryPaymentId]
        );

        const totalPaid = Number(sumRows[0]?.total_paid || 0);
        const netSalary = Number(tx.net_salary || 0);
        const dueAmount = Math.max(0, Math.round((netSalary - totalPaid) * 100) / 100);

        let newStatus = "Pending";
        if (dueAmount <= 0 && totalPaid > 0) {
            newStatus = "Paid";
        } else if (totalPaid > 0) {
            newStatus = "Partial";
        }

        await connection.query(
            `UPDATE cst_staff_salary_payments SET
                paid_amount = ?,
                due_amount = ?,
                payment_status = ?
             WHERE id = ?`,
            [totalPaid, dueAmount, newStatus, salaryPaymentId]
        );

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Transaction deleted and salary payment balance recalculated.",
            data: { salary_payment_id: salaryPaymentId, total_paid: totalPaid, due_amount: dueAmount, payment_status: newStatus }
        });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("DELETE /api/staff-salary-transactions/[id] error:", err);
        return NextResponse.json({ success: false, message: err.message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}
