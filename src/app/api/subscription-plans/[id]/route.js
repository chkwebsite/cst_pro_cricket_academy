import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation";
import { recordSubscriptionHistory } from "@/app/components/lib/subscription-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/subscription-plans/[id]
 */
export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const [rows] = await pool.query(
            "SELECT * FROM cst_subscription_plans WHERE id = ? AND is_deleted = 0 LIMIT 1",
            [id]
        );

        if (!rows || rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Subscription plan not found" },
                { status: 404 }
            );
        }

        const plan = rows[0];
        let features = plan.features;
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
                ...plan,
                price: Number(plan.price),
                duration_months: Number(plan.duration_months),
                status: Number(plan.status),
                features: Array.isArray(features) ? features : [],
            },
        });
    } catch (error) {
        console.error("GET /api/subscription-plans/[id] error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch plan", error: error.message },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/subscription-plans/[id]
 * Update plan details and prices (Super Admin only)
 */
export async function PUT(request, { params }) {
    try {
        const { user, errorResponse } = await getAuthenticatedUser(request, { skipSubscriptionCheck: true });
        if (errorResponse) return errorResponse;

        if (!user.isSuperAdmin) {
            return NextResponse.json(
                { success: false, message: "Forbidden: Only Super Admin can modify subscription plans" },
                { status: 403 }
            );
        }

        const { id } = await params;
        const [existing] = await pool.query(
            "SELECT * FROM cst_subscription_plans WHERE id = ? AND is_deleted = 0 LIMIT 1",
            [id]
        );

        if (!existing || existing.length === 0) {
            return NextResponse.json(
                { success: false, message: "Subscription plan not found" },
                { status: 404 }
            );
        }

        const prev = existing[0];
        const body = await request.json();

        const plan_name = body.plan_name !== undefined ? String(body.plan_name).trim() : prev.plan_name;
        const plan_code = body.plan_code !== undefined ? String(body.plan_code).trim() : prev.plan_code;
        const duration_months = body.duration_months !== undefined ? Number(body.duration_months) : prev.duration_months;
        const price = body.price !== undefined ? Number(body.price) : Number(prev.price);
        const description = body.description !== undefined ? body.description : prev.description;
        const status = body.status !== undefined ? (body.status ? 1 : 0) : prev.status;

        let featuresJson = prev.features;
        if (body.features !== undefined) {
            const featuresArray = Array.isArray(body.features)
                ? body.features
                : typeof body.features === "string"
                ? body.features.split("\n").map((f) => f.trim()).filter(Boolean)
                : [];
            featuresJson = JSON.stringify(featuresArray);
        }

        await pool.query(
            `UPDATE cst_subscription_plans 
             SET plan_name = ?, plan_code = ?, duration_months = ?, price = ?, description = ?, features = ?, status = ?, updated_at = NOW()
             WHERE id = ?`,
            [plan_name, plan_code, duration_months, price, description, featuresJson, status, id]
        );

        // Audit log
        await recordSubscriptionHistory({
            academyId: null,
            subscriptionId: null,
            eventType: "plan_updated",
            planId: Number(id),
            previousValues: {
                plan_name: prev.plan_name,
                duration_months: prev.duration_months,
                price: Number(prev.price),
                status: prev.status,
            },
            newValues: {
                plan_name,
                duration_months,
                price,
                status,
            },
            changedBy: user.id,
            remarks: `Updated subscription plan #${id} (${plan_name})`,
        });

        return NextResponse.json({
            success: true,
            message: "Subscription plan updated successfully",
            data: {
                id: Number(id),
                plan_name,
                plan_code,
                duration_months,
                price,
                description,
                status,
            },
        });
    } catch (error) {
        console.error("PUT /api/subscription-plans/[id] error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to update subscription plan", error: error.message },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/subscription-plans/[id]
 * Soft delete a plan (Super Admin only)
 */
export async function DELETE(request, { params }) {
    try {
        const { user, errorResponse } = await getAuthenticatedUser(request, { skipSubscriptionCheck: true });
        if (errorResponse) return errorResponse;

        if (!user.isSuperAdmin) {
            return NextResponse.json(
                { success: false, message: "Forbidden: Only Super Admin can delete subscription plans" },
                { status: 403 }
            );
        }

        const { id } = await params;
        const [existing] = await pool.query(
            "SELECT * FROM cst_subscription_plans WHERE id = ? AND is_deleted = 0 LIMIT 1",
            [id]
        );

        if (!existing || existing.length === 0) {
            return NextResponse.json(
                { success: false, message: "Subscription plan not found" },
                { status: 404 }
            );
        }

        // Check if any academy is actively using this plan
        const [activeSubs] = await pool.query(
            "SELECT id FROM cst_academy_subscriptions WHERE plan_id = ? AND subscription_status = 'active' LIMIT 1",
            [id]
        );
        if (activeSubs.length > 0) {
            return NextResponse.json(
                { success: false, message: "Cannot delete this plan because it is currently assigned to one or more active academy subscriptions. You may deactivate it instead." },
                { status: 400 }
            );
        }

        await pool.query(
            "UPDATE cst_subscription_plans SET is_deleted = 1, updated_at = NOW() WHERE id = ?",
            [id]
        );

        await recordSubscriptionHistory({
            academyId: null,
            subscriptionId: null,
            eventType: "plan_deleted",
            planId: Number(id),
            previousValues: { plan_name: existing[0].plan_name },
            newValues: { is_deleted: 1 },
            changedBy: user.id,
            remarks: `Deleted plan #${id} (${existing[0].plan_name})`,
        });

        return NextResponse.json({
            success: true,
            message: "Subscription plan deleted successfully",
        });
    } catch (error) {
        console.error("DELETE /api/subscription-plans/[id] error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to delete plan", error: error.message },
            { status: 500 }
        );
    }
}
