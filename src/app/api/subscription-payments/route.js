import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation";
import { generateInvoiceNumber, generateTransactionId, recordSubscriptionHistory } from "@/app/components/lib/subscription-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/subscription-payments
 * List subscription payment transactions
 */
export async function GET(request) {
    try {
        const { user, errorResponse } = await getAuthenticatedUser(request, { skipSubscriptionCheck: true });
        if (errorResponse) return errorResponse;

        const { searchParams } = new URL(request.url);
        const academyId = searchParams.get("academy_id");
        const status = searchParams.get("status");
        const paymentMode = searchParams.get("payment_mode");
        const search = searchParams.get("search");

        let effectiveAcademyId = academyId;
        if (!user.isSuperAdmin) {
            effectiveAcademyId = user.academy_id;
        }

        let sql = `
            SELECT 
                p.*,
                a.academy_name,
                a.academy_code,
                s.subscription_start_date,
                s.subscription_end_date,
                s.subscription_status,
                sp.plan_name,
                sp.plan_code
            FROM cst_subscription_payments p
            INNER JOIN cst_academy a ON a.id = p.academy_id
            LEFT JOIN cst_academy_subscriptions s ON s.id = p.subscription_id
            LEFT JOIN cst_subscription_plans sp ON sp.id = s.plan_id
            WHERE 1 = 1
        `;
        const params = [];

        if (effectiveAcademyId) {
            sql += ` AND p.academy_id = ?`;
            params.push(Number(effectiveAcademyId));
        }

        if (status) {
            sql += ` AND p.payment_status = ?`;
            params.push(status);
        }

        if (paymentMode) {
            sql += ` AND p.payment_mode = ?`;
            params.push(paymentMode);
        }

        if (search) {
            sql += ` AND (p.invoice_number LIKE ? OR p.transaction_id LIKE ? OR a.academy_name LIKE ?)`;
            const q = `%${search.trim()}%`;
            params.push(q, q, q);
        }

        sql += ` ORDER BY p.id DESC`;

        const [rows] = await pool.query(sql, params);

        let totalRevenue = 0;
        let successfulCount = 0;
        let pendingCount = 0;
        let refundedCount = 0;

        const formatted = rows.map((r) => {
            const amt = Number(r.amount || 0);
            if (r.payment_status === "success") {
                totalRevenue += amt;
                successfulCount++;
            } else if (r.payment_status === "pending") {
                pendingCount++;
            } else if (r.payment_status === "refunded") {
                refundedCount++;
            }
            return {
                ...r,
                amount: amt,
            };
        });

        return NextResponse.json({
            success: true,
            data: formatted,
            summary: {
                total_revenue: totalRevenue,
                total_payments: formatted.length,
                success_count: successfulCount,
                pending_count: pendingCount,
                refunded_count: refundedCount,
            },
            count: formatted.length,
        });
    } catch (error) {
        console.error("GET /api/subscription-payments error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch subscription payments", error: error.message },
            { status: 500 }
        );
    }
}

/**
 * POST /api/subscription-payments
 * Record a payment manually (Super Admin only)
 */
export async function POST(request) {
    try {
        const { user, errorResponse } = await getAuthenticatedUser(request, { skipSubscriptionCheck: true });
        if (errorResponse) return errorResponse;

        if (!user.isSuperAdmin) {
            return NextResponse.json(
                { success: false, message: "Forbidden: Only Super Admin can record subscription payments" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const {
            academy_id,
            subscription_id,
            amount,
            payment_mode = "manual",
            payment_status = "success",
            transaction_id = null,
            remarks = "Manual payment recorded",
        } = body;

        if (!academy_id) {
            return NextResponse.json(
                { success: false, message: "Academy ID is required" },
                { status: 400 }
            );
        }

        if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) < 0) {
            return NextResponse.json(
                { success: false, message: "Valid payment amount is required" },
                { status: 400 }
            );
        }

        const invoiceNo = generateInvoiceNumber(academy_id);
        const txnId = transaction_id || generateTransactionId();

        const [result] = await pool.query(
            `INSERT INTO cst_subscription_payments
             (academy_id, subscription_id, transaction_id, invoice_number, amount, payment_mode, payment_date, payment_status, remarks, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, NOW(), NOW())`,
            [
                academy_id,
                subscription_id || null,
                txnId,
                invoiceNo,
                Number(amount),
                payment_mode,
                payment_status,
                remarks,
            ]
        );

        await recordSubscriptionHistory({
            academyId: Number(academy_id),
            subscriptionId: subscription_id ? Number(subscription_id) : null,
            eventType: "payment_recorded",
            planId: null,
            previousValues: null,
            newValues: {
                payment_id: result.insertId,
                invoice_number: invoiceNo,
                amount: Number(amount),
                payment_mode,
                payment_status,
            },
            changedBy: user.id,
            remarks: `Recorded manual payment of ₹${Number(amount)} for academy #${academy_id}`,
        });

        return NextResponse.json(
            {
                success: true,
                message: "Payment successfully recorded",
                data: {
                    id: result.insertId,
                    invoice_number: invoiceNo,
                    transaction_id: txnId,
                    amount: Number(amount),
                    payment_status,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST /api/subscription-payments error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to record payment", error: error.message },
            { status: 500 }
        );
    }
}
