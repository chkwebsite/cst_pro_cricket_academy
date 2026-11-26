import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation";
import {
    calculateSubscriptionStatus,
    formatDateToYMD,
    addMonths,
    addDays,
    generateInvoiceNumber,
    generateTransactionId,
    recordSubscriptionHistory,
} from "@/app/components/lib/subscription-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/academy-subscriptions
 * List all academy subscriptions with live computed statuses and filter support
 */
export async function GET(request) {
    try {
        const { user, errorResponse } = await getAuthenticatedUser(request, { skipSubscriptionCheck: true });
        if (errorResponse) return errorResponse;

        const { searchParams } = new URL(request.url);
        const academyId = searchParams.get("academy_id");
        const statusFilter = searchParams.get("status");
        const planId = searchParams.get("plan_id");
        const search = searchParams.get("search");

        // Non Super-Admin can only view their own academy
        let effectiveAcademyId = academyId;
        if (!user.isSuperAdmin) {
            effectiveAcademyId = user.academy_id;
        }

        let sql = `
            SELECT 
                a.id AS academy_id,
                a.academy_name,
                a.academy_code,
                a.status AS academy_status,
                a.email AS academy_email,
                a.phone AS academy_phone,
                a.contact_person,
                s.id AS subscription_id,
                s.plan_id,
                s.subscription_start_date,
                s.subscription_end_date,
                s.grace_period_days,
                s.grace_end_date,
                s.subscription_status,
                s.payment_status,
                s.is_manual,
                s.remarks,
                s.created_by,
                s.created_at AS subscription_created_at,
                s.updated_at AS subscription_updated_at,
                p.plan_name,
                p.plan_code,
                p.duration_months,
                p.price AS plan_price,
                u.first_name AS created_by_first_name,
                u.last_name AS created_by_last_name
            FROM cst_academy a
            LEFT JOIN (
                SELECT s1.*
                FROM cst_academy_subscriptions s1
                INNER JOIN (
                    SELECT academy_id, MAX(id) AS max_id
                    FROM cst_academy_subscriptions
                    GROUP BY academy_id
                ) s2 ON s1.id = s2.max_id
            ) s ON s.academy_id = a.id
            LEFT JOIN cst_subscription_plans p ON p.id = s.plan_id
            LEFT JOIN cst_users u ON u.id = s.created_by
            WHERE a.is_deleted = 0
        `;
        const params = [];

        if (effectiveAcademyId) {
            sql += ` AND a.id = ?`;
            params.push(Number(effectiveAcademyId));
        }

        if (planId) {
            sql += ` AND s.plan_id = ?`;
            params.push(Number(planId));
        }

        if (search) {
            sql += ` AND (a.academy_name LIKE ? OR a.academy_code LIKE ? OR a.contact_person LIKE ?)`;
            const q = `%${search.trim()}%`;
            params.push(q, q, q);
        }

        sql += ` ORDER BY a.id ASC`;

        const [rows] = await pool.query(sql, params);

        // Compute live status and boundaries for each row
        const computedList = rows.map((row) => {
            const hasSub = Boolean(row.subscription_id);
            const computed = hasSub
                ? calculateSubscriptionStatus({ ...row, id: row.subscription_id }, row.academy_status)
                : {
                      has_subscription: false,
                      subscription_id: null,
                      plan_id: null,
                      plan_name: "No Active Subscription",
                      plan_code: null,
                      duration_months: 0,
                      price: 0,
                      subscription_start_date: null,
                      subscription_end_date: null,
                      grace_period_days: 5,
                      grace_end_date: null,
                      subscription_status: "no_subscription",
                      is_subscription_active: false,
                      is_grace_period: false,
                      is_academy_active: Number(row.academy_status) === 1,
                      is_read_only: true,
                      grace_days_remaining: 0,
                      days_until_expiry: 0,
                      show_subscription_alert: false,
                      is_access_allowed: false,
                      message: "No subscription assigned yet. Please assign a subscription plan.",
                  };

            return {
                id: row.subscription_id || null,
                subscription_id: row.subscription_id || null,
                has_subscription: hasSub,
                academy_id: row.academy_id,
                academy_name: row.academy_name,
                academy_code: row.academy_code,
                academy_status: Number(row.academy_status),
                contact_person: row.contact_person,
                email: row.academy_email,
                phone: row.academy_phone,
                plan_id: row.plan_id || null,
                plan_name: row.plan_name || computed.plan_name,
                plan_code: row.plan_code || null,
                duration_months: Number(row.duration_months || 0),
                plan_price: Number(row.plan_price || 0),
                subscription_start_date: computed.subscription_start_date,
                subscription_end_date: computed.subscription_end_date,
                grace_period_days: computed.grace_period_days,
                grace_end_date: computed.grace_end_date,
                db_status: row.subscription_status || "none",
                subscription_status: computed.subscription_status,
                payment_status: row.payment_status || "none",
                is_manual: Number(row.is_manual ?? 0),
                remarks: row.remarks || null,
                created_by_name: [row.created_by_first_name, row.created_by_last_name].filter(Boolean).join(" ") || (hasSub ? "System" : "-"),
                created_at: row.subscription_created_at || null,
                updated_at: row.subscription_updated_at || null,
                // Status flags
                is_subscription_active: computed.is_subscription_active,
                is_grace_period: computed.is_grace_period,
                is_academy_active: computed.is_academy_active,
                is_read_only: computed.is_read_only,
                grace_days_remaining: computed.grace_days_remaining,
                days_until_expiry: computed.days_until_expiry,
                show_subscription_alert: computed.show_subscription_alert,
                is_access_allowed: computed.is_access_allowed,
                status_message: computed.message,
            };
        });

        // Filter by computed status if requested
        let filtered = computedList;
        if (statusFilter && statusFilter !== "all") {
            if (statusFilter === "no_subscription") {
                filtered = computedList.filter((item) => item.subscription_status === "no_subscription" || item.subscription_status === "none");
            } else {
                filtered = computedList.filter((item) => item.subscription_status === statusFilter);
            }
        }

        // Summary counts
        const summary = {
            total: computedList.length,
            active: computedList.filter((s) => s.subscription_status === "active").length,
            grace_period: computedList.filter((s) => s.subscription_status === "grace_period").length,
            expired: computedList.filter((s) => s.subscription_status === "expired").length,
            suspended: computedList.filter((s) => s.subscription_status === "suspended").length,
            no_subscription: computedList.filter((s) => s.subscription_status === "no_subscription" || s.subscription_status === "none").length,
        };

        return NextResponse.json({
            success: true,
            data: filtered,
            summary,
            count: filtered.length,
        });
    } catch (error) {
        console.error("GET /api/academy-subscriptions error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch academy subscriptions", error: error.message },
            { status: 500 }
        );
    }
}

/**
 * POST /api/academy-subscriptions
 * Assign a new subscription plan to an academy (Super Admin only)
 */
export async function POST(request) {
    try {
        const { user, errorResponse } = await getAuthenticatedUser(request, { skipSubscriptionCheck: true });
        if (errorResponse) return errorResponse;

        if (!user.isSuperAdmin) {
            return NextResponse.json(
                { success: false, message: "Forbidden: Only Super Admin can assign academy subscriptions" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const {
            academy_id,
            plan_id,
            start_date,
            grace_period_days = 5,
            payment_mode = "manual",
            transaction_id = null,
            amount = null,
            remarks = "Manual subscription assignment",
        } = body;

        if (!academy_id) {
            return NextResponse.json(
                { success: false, message: "Academy ID is required" },
                { status: 400 }
            );
        }

        if (!plan_id) {
            return NextResponse.json(
                { success: false, message: "Subscription plan is required" },
                { status: 400 }
            );
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            // 1. Verify academy
            const [academies] = await conn.query(
                "SELECT id, academy_name, status FROM cst_academy WHERE id = ? AND is_deleted = 0 LIMIT 1",
                [academy_id]
            );
            if (academies.length === 0) {
                throw new Error("Academy not found");
            }
            const academy = academies[0];

            // 2. Verify plan
            const [plans] = await conn.query(
                "SELECT * FROM cst_subscription_plans WHERE id = ? AND is_deleted = 0 LIMIT 1",
                [plan_id]
            );
            if (plans.length === 0) {
                throw new Error("Subscription plan not found or inactive");
            }
            const plan = plans[0];
            const durationMonths = Number(plan.duration_months || 1);
            const planPrice = amount !== null && amount !== undefined ? Number(amount) : Number(plan.price || 0);

            // 3. Compute dates
            const startDateStr = start_date ? formatDateToYMD(start_date) : formatDateToYMD(new Date());
            const endDateStr = addMonths(startDateStr, durationMonths);
            const graceDays = Number(grace_period_days || 5);
            const graceEndDateStr = addDays(endDateStr, graceDays);

            const invoiceNo = generateInvoiceNumber(academy_id);
            const txnId = transaction_id || generateTransactionId();

            // 4. Insert subscription
            const [subResult] = await conn.query(
                `INSERT INTO cst_academy_subscriptions 
                 (academy_id, plan_id, subscription_start_date, subscription_end_date, grace_period_days, grace_end_date, subscription_status, payment_status, is_manual, remarks, created_by, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, 'active', 'success', 1, ?, ?, NOW(), NOW())`,
                [
                    academy_id,
                    plan_id,
                    startDateStr,
                    endDateStr,
                    graceDays,
                    graceEndDateStr,
                    remarks,
                    user.id,
                ]
            );
            const subId = subResult.insertId;

            // 5. Insert payment record
            await conn.query(
                `INSERT INTO cst_subscription_payments 
                 (academy_id, subscription_id, transaction_id, invoice_number, amount, payment_mode, payment_date, payment_status, remarks, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, NOW(), 'success', ?, NOW(), NOW())`,
                [
                    academy_id,
                    subId,
                    txnId,
                    invoiceNo,
                    planPrice,
                    payment_mode,
                    `Payment for plan ${plan.plan_name}`,
                ]
            );

            // 6. Record audit history
            await recordSubscriptionHistory({
                connection: conn,
                academyId: Number(academy_id),
                subscriptionId: subId,
                eventType: "initial_assignment",
                planId: Number(plan_id),
                previousValues: null,
                newValues: {
                    plan_name: plan.plan_name,
                    start_date: startDateStr,
                    end_date: endDateStr,
                    grace_end_date: graceEndDateStr,
                    amount: planPrice,
                    invoice_number: invoiceNo,
                },
                changedBy: user.id,
                remarks: `Assigned plan ${plan.plan_name} to ${academy.academy_name}`,
            });

            // 7. Ensure academy is active
            await conn.query("UPDATE cst_academy SET status = 1, updated_at = NOW() WHERE id = ?", [academy_id]);

            await conn.commit();

            return NextResponse.json(
                {
                    success: true,
                    message: `Subscription successfully assigned to ${academy.academy_name}`,
                    data: {
                        subscription_id: subId,
                        academy_id: Number(academy_id),
                        plan_name: plan.plan_name,
                        start_date: startDateStr,
                        end_date: endDateStr,
                        grace_end_date: graceEndDateStr,
                        invoice_number: invoiceNo,
                    },
                },
                { status: 201 }
            );
        } catch (txErr) {
            await conn.rollback();
            throw txErr;
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error("POST /api/academy-subscriptions error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Failed to assign subscription" },
            { status: 500 }
        );
    }
}
