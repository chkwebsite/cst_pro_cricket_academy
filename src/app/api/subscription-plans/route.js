import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation";
import { recordSubscriptionHistory } from "@/app/components/lib/subscription-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/subscription-plans
 * List all active/inactive subscription plans (excluding deleted)
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");

        let sql = `
            SELECT 
                id, 
                plan_name, 
                plan_code, 
                duration_months, 
                price, 
                description, 
                features, 
                status, 
                created_at, 
                updated_at 
            FROM cst_subscription_plans 
            WHERE is_deleted = 0
        `;
        const params = [];

        if (status !== null && status !== undefined && status !== "") {
            sql += ` AND status = ?`;
            params.push(Number(status));
        }

        sql += ` ORDER BY duration_months ASC, price ASC`;

        const [rows] = await pool.query(sql, params);

        const formatted = rows.map((plan) => {
            let features = plan.features;
            if (typeof features === "string") {
                try {
                    features = JSON.parse(features);
                } catch {
                    features = [];
                }
            }
            return {
                ...plan,
                price: Number(plan.price),
                duration_months: Number(plan.duration_months),
                status: Number(plan.status),
                features: Array.isArray(features) ? features : [],
            };
        });

        return NextResponse.json({
            success: true,
            data: formatted,
            count: formatted.length,
        });
    } catch (error) {
        console.error("GET /api/subscription-plans error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch subscription plans", error: error.message },
            { status: 500 }
        );
    }
}

/**
 * POST /api/subscription-plans
 * Create a new subscription plan (Super Admin only)
 */
export async function POST(request) {
    try {
        const { user, errorResponse } = await getAuthenticatedUser(request, { skipSubscriptionCheck: true });
        if (errorResponse) return errorResponse;

        if (!user.isSuperAdmin) {
            return NextResponse.json(
                { success: false, message: "Forbidden: Only Super Admin can manage subscription plans" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const {
            plan_name,
            plan_code,
            duration_months,
            price,
            description = "",
            features = [],
            status = 1,
        } = body;

        if (!plan_name || !String(plan_name).trim()) {
            return NextResponse.json(
                { success: false, message: "Plan name is required" },
                { status: 400 }
            );
        }

        if (!duration_months || isNaN(Number(duration_months)) || Number(duration_months) <= 0) {
            return NextResponse.json(
                { success: false, message: "Valid duration in months is required" },
                { status: 400 }
            );
        }

        if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0) {
            return NextResponse.json(
                { success: false, message: "Valid price is required" },
                { status: 400 }
            );
        }

        const normalizedCode = (
            plan_code || `PLAN_${String(plan_name).trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`
        ).trim();

        // Check duplicate code
        const [existing] = await pool.query(
            "SELECT id FROM cst_subscription_plans WHERE plan_code = ? AND is_deleted = 0 LIMIT 1",
            [normalizedCode]
        );
        if (existing.length > 0) {
            return NextResponse.json(
                { success: false, message: `A plan with code "${normalizedCode}" already exists` },
                { status: 409 }
            );
        }

        const featuresArray = Array.isArray(features)
            ? features
            : typeof features === "string"
            ? features.split("\n").map((f) => f.trim()).filter(Boolean)
            : [];

        const [result] = await pool.query(
            `INSERT INTO cst_subscription_plans 
             (plan_name, plan_code, duration_months, price, description, features, status, is_deleted, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
            [
                String(plan_name).trim(),
                normalizedCode,
                Number(duration_months),
                Number(price),
                description || "",
                JSON.stringify(featuresArray),
                status ? 1 : 0,
            ]
        );

        // Audit log
        await recordSubscriptionHistory({
            academyId: null,
            subscriptionId: null,
            eventType: "plan_created",
            planId: result.insertId,
            previousValues: null,
            newValues: {
                id: result.insertId,
                plan_name,
                plan_code: normalizedCode,
                duration_months,
                price,
            },
            changedBy: user.id,
            remarks: `Created new plan: ${plan_name}`,
        });

        return NextResponse.json(
            {
                success: true,
                message: "Subscription plan created successfully",
                data: {
                    id: result.insertId,
                    plan_name,
                    plan_code: normalizedCode,
                    duration_months: Number(duration_months),
                    price: Number(price),
                    description,
                    features: featuresArray,
                    status: status ? 1 : 0,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST /api/subscription-plans error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to create subscription plan", error: error.message },
            { status: 500 }
        );
    }
}
