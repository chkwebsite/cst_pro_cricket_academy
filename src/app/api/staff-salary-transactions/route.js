import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import crypto from "crypto";
import { getAuthUser } from "@/app/components/lib/rbac";

function generateTransactionNo(prefix = "TXN-SAL") {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
    return `${prefix}-${dateStr}-${rand}`;
}

// =========================================================================
// GET: List Salary Transactions (Admin only)
// =========================================================================
export async function GET(request) {
    let connection;
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
        }
        if (!authUser.isSuperAdmin && !authUser.isAcademyAdmin && !authUser.isBranchAdmin) {
            return NextResponse.json({ success: false, message: "Forbidden. Insufficient permissions." }, { status: 403 });
        }

        connection = await pool.getConnection();
        const { searchParams } = new URL(request.url);

        let academy_id = searchParams.get("academy_id");
        let branch_id = searchParams.get("branch_id");
        const staff_id = searchParams.get("staff_id");
        const salary_payment_id = searchParams.get("salary_payment_id");
        const payment_mode = searchParams.get("payment_mode");
        const search = (searchParams.get("search") || "").trim();

        // Multi-Tenant Isolation
        if (authUser.isSuperAdmin) {
            // Unrestricted
        } else if (authUser.isAcademyAdmin) {
            if (academy_id && String(academy_id) !== String(authUser.academy_id)) {
                return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
            }
            academy_id = authUser.academy_id;
        } else if (authUser.isBranchAdmin) {
            if (branch_id && String(branch_id) !== String(authUser.branch_id)) {
                return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
            }
            branch_id = authUser.branch_id;
            academy_id = authUser.academy_id;
        }

        const where = ["t.id IS NOT NULL"];
        const params = [];

        if (academy_id) {
            where.push("p.academy_id = ?");
            params.push(academy_id);
        }
        if (branch_id) {
            where.push("p.branch_id = ?");
            params.push(branch_id);
        }
        if (staff_id) {
            where.push("p.staff_id = ?");
            params.push(staff_id);
        }
        if (salary_payment_id) {
            where.push("t.salary_payment_id = ?");
            params.push(salary_payment_id);
        }
        if (payment_mode) {
            where.push("t.payment_mode = ?");
            params.push(payment_mode);
        }
        if (search) {
            where.push("(t.transaction_no LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ? OR s.appointment_no LIKE ?)");
            const q = `%${search}%`;
            params.push(q, q, q, q);
        }

        const sql = `
            SELECT 
                t.*,
                p.salary_month,
                p.salary_year,
                p.net_salary AS payment_net_salary,
                p.paid_amount AS payment_total_paid,
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
            WHERE ${where.join(" AND ")}
            ORDER BY t.id DESC
        `;

        const [rows] = await connection.query(sql, params);
        return NextResponse.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        console.error("GET /api/staff-salary-transactions error:", err);
        return NextResponse.json({ success: false, message: err.message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

// =========================================================================
// POST: Disburse Payment / Create Salary Transaction (Admin only)
// =========================================================================
export async function POST(request) {
    let connection;
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
        }
        if (!authUser.isSuperAdmin && !authUser.isAcademyAdmin && !authUser.isBranchAdmin) {
            return NextResponse.json({ success: false, message: "Forbidden. Insufficient permissions." }, { status: 403 });
        }

        const body = await request.json();
        const {
            salary_payment_id,
            amount,
            payment_mode = "Bank Transfer",
            transaction_no,
            payment_date = new Date().toISOString().slice(0, 19).replace("T", " "),
            remarks = "Salary disbursement",
        } = body;

        const numAmount = Number(amount);
        if (!salary_payment_id || isNaN(numAmount) || numAmount <= 0) {
            return NextResponse.json(
                { success: false, message: "Validation error: salary_payment_id and positive amount are required." },
                { status: 400 }
            );
        }

        const validModes = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque"];
        if (!validModes.includes(payment_mode)) {
            return NextResponse.json(
                { success: false, message: `Invalid payment_mode. Must be one of: ${validModes.join(", ")}` },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Lock and fetch parent salary payment record
        const [payRows] = await connection.query(
            `SELECT p.*, s.first_name, s.last_name 
             FROM cst_staff_salary_payments p
             JOIN cst_staff s ON s.id = p.staff_id
             WHERE p.id = ? FOR UPDATE`,
            [salary_payment_id]
        );

        if (payRows.length === 0) {
            await connection.rollback();
            return NextResponse.json({ success: false, message: "Salary payment record not found." }, { status: 404 });
        }

        const payment = payRows[0];

        // Multi-Tenant Isolation
        if (authUser.isAcademyAdmin && String(payment.academy_id) !== String(authUser.academy_id)) {
            await connection.rollback();
            return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
        }
        if (authUser.isBranchAdmin && (String(payment.branch_id) !== String(authUser.branch_id) || String(payment.academy_id) !== String(authUser.academy_id))) {
            await connection.rollback();
            return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
        }

        // 2. Generate or use transaction number
        const finalTxNo = (transaction_no || "").trim() || generateTransactionNo();

        // 3. Insert transaction
        const [txRes] = await connection.query(
            `INSERT INTO cst_staff_salary_transactions (
                salary_payment_id, academy_id, branch_id, staff_id,
                amount, payment_mode, transaction_no, payment_date, remarks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                salary_payment_id, payment.academy_id, payment.branch_id, payment.staff_id,
                numAmount, payment_mode, finalTxNo, payment_date, remarks
            ]
        );

        // 4. Recalculate total payments for this salary record
        const [sumRows] = await connection.query(
            `SELECT COALESCE(SUM(amount), 0) AS total_paid 
             FROM cst_staff_salary_transactions 
             WHERE salary_payment_id = ?`,
            [salary_payment_id]
        );

        const totalPaid = Number(sumRows[0]?.total_paid || 0);
        const netSalary = Number(payment.net_salary || 0);
        const dueAmount = Math.max(0, Math.round((netSalary - totalPaid) * 100) / 100);

        let newStatus = "Pending";
        if (dueAmount <= 0 && totalPaid > 0) {
            newStatus = "Paid";
        } else if (totalPaid > 0) {
            newStatus = "Partial";
        }

        // 5. Update parent payment record
        await connection.query(
            `UPDATE cst_staff_salary_payments SET
                paid_amount = ?,
                due_amount = ?,
                payment_status = ?,
                payment_date = CURRENT_DATE
             WHERE id = ?`,
            [totalPaid, dueAmount, newStatus, salary_payment_id]
        );

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: `Payment of ₹${numAmount} successfully recorded for ${payment.first_name} ${payment.last_name}.`,
            data: {
                transaction_id: txRes.insertId,
                transaction_no: finalTxNo,
                amount: numAmount,
                payment_mode,
                total_paid: totalPaid,
                due_amount: dueAmount,
                payment_status: newStatus,
            },
        }, { status: 201 });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("POST /api/staff-salary-transactions error:", err);
        return NextResponse.json({ success: false, message: "Transaction recording failed: " + err.message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}
