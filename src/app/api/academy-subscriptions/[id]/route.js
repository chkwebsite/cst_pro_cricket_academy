import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation";
import {
    calculateSubscriptionStatus,
    formatDateToYMD,
    addDays,
    recordSubscriptionHistory,
} from "@/app/components/lib/subscription-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/academy-subscriptions/[id]
 * Fetch subscription details, payments, and audit history
 */
export async function GET(request, { params }) {
    try {
        const { user, errorResponse } = await getAuthenticatedUser(request, { skipSubscriptionCheck: true });
        if (errorResponse) return errorResponse;

        const { id } = await params;

        const [rows] = await pool.query(
            `SELECT 
                s.*,
                a.academy_name,
                a.academy_code,
                a.status AS academy_status,
                a.contact_person,
                a.email AS academy_email,
                a.phone AS academy_phone,
                p.plan_name,
                p.plan_code,
                p.duration_months,
                p.price AS plan_price,
                p.features,
                p.description AS plan_description,
                u.first_name AS created_by_first_name,
                u.last_name AS created_by_last_name
             FROM cst_academy_subscriptions s
             INNER JOIN cst_academy a ON a.id = s.academy_id
             LEFT JOIN cst_subscription_plans p ON p.id = s.plan_id
             LEFT JOIN cst_users u ON u.id = s.created_by
             WHERE s.id = ?
             LIMIT 1`,
            [id]
        );

        if (!rows || rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Subscription not found" },
                { status: 404 }
            );
        }

        const sub = rows[0];

        // Access check
        if (!user.isSuperAdmin && Number(user.academy_id) !== Number(sub.academy_id)) {
            return NextResponse.json(
                { success: false, message: "Forbidden: You can only view your own academy subscription" },
                { status: 403 }
            );
        }

        const computed = calculateSubscriptionStatus(sub, sub.academy_status);

        // Fetch payments for this subscription
        const [payments] = await pool.query(
            `SELECT * FROM cst_subscription_payments 
             WHERE subscription_id = ? 
             ORDER BY id DESC`,
            [id]
        );

        // Fetch history audit trail
        const [history] = await pool.query(
            `SELECT h.*, u.first_name, u.last_name, p.plan_name
             FROM cst_subscription_history h
             LEFT JOIN cst_users u ON u.id = h.changed_by
             LEFT JOIN cst_subscription_plans p ON p.id = h.plan_id
             WHERE h.subscription_id = ? OR h.academy_id = ?
             ORDER BY h.id DESC`,
            [id, sub.academy_id]
        );

        let features = sub.features;
        if (typeof features === "string") {
            try {
                features = JSON.parse(features);
            } catch {
                features = [];
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                ...sub,
                features: Array.isArray(features) ? features : [],
                ...computed,
                payments,
                history,
            },
        });
    } catch (error) {
        console.error("GET /api/academy-subscriptions/[id] error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch subscription details", error: error.message },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/academy-subscriptions/[id]
 * Update subscription (status, remarks, grace_period_days, expiry extension) (Super Admin only)
 */
export async function PUT(request, { params }) {
    try {
        const { user, errorResponse } = await getAuthenticatedUser(request, { skipSubscriptionCheck: true });
        if (errorResponse) return errorResponse;

        if (!user.isSuperAdmin) {
            return NextResponse.json(
                { success: false, message: "Forbidden: Only Super Admin can modify academy subscriptions" },
                { status: 403 }
            );
        }

        const { id } = await params;
        const [existing] = await pool.query(
            "SELECT * FROM cst_academy_subscriptions WHERE id = ? LIMIT 1",
            [id]
        );

        if (!existing || existing.length === 0) {
            return NextResponse.json(
                { success: false, message: "Subscription not found" },
                { status: 404 }
            );
        }

        const prev = existing[0];
        const body = await request.json();

        const subscription_status = body.subscription_status || prev.subscription_status;
        const remarks = body.remarks !== undefined ? body.remarks : prev.remarks;
        const grace_period_days = body.grace_period_days !== undefined ? Number(body.grace_period_days) : prev.grace_period_days;
        const subscription_end_date = body.subscription_end_date
            ? formatDateToYMD(body.subscription_end_date)
            : formatDateToYMD(prev.subscription_end_date);
        const grace_end_date = body.grace_end_date
            ? formatDateToYMD(body.grace_end_date)
            : addDays(subscription_end_date, grace_period_days);

        await pool.query(
            `UPDATE cst_academy_subscriptions
             SET subscription_status = ?, subscription_end_date = ?, grace_period_days = ?, grace_end_date = ?, remarks = ?, updated_at = NOW()
             WHERE id = ?`,
            [subscription_status, subscription_end_date, grace_period_days, grace_end_date, remarks, id]
        );

        // Record audit
        await recordSubscriptionHistory({
            academyId: prev.academy_id,
            subscriptionId: Number(id),
            eventType: "status_update",
            planId: prev.plan_id,
            previousValues: {
                subscription_status: prev.subscription_status,
                subscription_end_date: formatDateToYMD(prev.subscription_end_date),
                grace_end_date: formatDateToYMD(prev.grace_end_date),
                grace_period_days: prev.grace_period_days,
            },
            newValues: {
                subscription_status,
                subscription_end_date,
                grace_end_date,
                grace_period_days,
            },
            changedBy: user.id,
            remarks: body.reason || `Updated subscription #${id} status to ${subscription_status}`,
        });

        return NextResponse.json({
            success: true,
            message: "Subscription updated successfully",
            data: {
                id: Number(id),
                subscription_status,
                subscription_end_date,
                grace_period_days,
                grace_end_date,
                remarks,
            },
        });
    } catch (error) {
        console.error("PUT /api/academy-subscriptions/[id] error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to update subscription", error: error.message },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/academy-subscriptions/[id]
 * Quick action: extend expiry days or change status (suspend, activate, cancel)
 */
export async function PATCH(request, { params }) {
    try {
        const { user, errorResponse } = await getAuthenticatedUser(request, { skipSubscriptionCheck: true });
        if (errorResponse) return errorResponse;

        if (!user.isSuperAdmin) {
            return NextResponse.json(
                { success: false, message: "Forbidden: Only Super Admin can modify academy subscriptions" },
                { status: 403 }
            );
        }

        const { id } = await params;
        const [existing] = await pool.query(
            "SELECT * FROM cst_academy_subscriptions WHERE id = ? LIMIT 1",
            [id]
        );

        if (!existing || existing.length === 0) {
            return NextResponse.json(
                { success: false, message: "Subscription not found" },
                { status: 404 }
            );
        }

        const prev = existing[0];
        const body = await request.json();
        const { action, days = 0, new_status, remarks = "" } = body;

        let newEndDate = formatDateToYMD(prev.subscription_end_date);
        let newGraceEndDate = formatDateToYMD(prev.grace_end_date);
        let newStatus = prev.subscription_status;
        let eventType = "subscription_patch";

        if (action === "extend_days") {
            eventType = "expiry_extended";
            newEndDate = addDays(newEndDate, Number(days));
            newGraceEndDate = addDays(newEndDate, prev.grace_period_days || 5);
            newStatus = "active";
        } else if (action === "change_status" && new_status) {
            eventType = `status_changed_${new_status}`;
            newStatus = new_status;
        }

        await pool.query(
            `UPDATE cst_academy_subscriptions
             SET subscription_status = ?, subscription_end_date = ?, grace_end_date = ?, remarks = CONCAT(IFNULL(remarks, ''), ' | ', ?), updated_at = NOW()
             WHERE id = ?`,
            [newStatus, newEndDate, newGraceEndDate, remarks || `PATCH action: ${action}`, id]
        );

        await recordSubscriptionHistory({
            academyId: prev.academy_id,
            subscriptionId: Number(id),
            eventType,
            planId: prev.plan_id,
            previousValues: {
                subscription_status: prev.subscription_status,
                subscription_end_date: formatDateToYMD(prev.subscription_end_date),
            },
            newValues: {
                subscription_status: newStatus,
                subscription_end_date: newEndDate,
                grace_end_date: newGraceEndDate,
            },
            changedBy: user.id,
            remarks: remarks || `Quick action: ${action}`,
        });

        return NextResponse.json({
            success: true,
            message: `Subscription successfully updated (${action})`,
            data: {
                id: Number(id),
                subscription_status: newStatus,
                subscription_end_date: newEndDate,
                grace_end_date: newGraceEndDate,
            },
        });
    } catch (error) {
        console.error("PATCH /api/academy-subscriptions/[id] error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to update subscription", error: error.message },
            { status: 500 }
        );
    }
}
