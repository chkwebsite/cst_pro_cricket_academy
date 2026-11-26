import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation";
import { calculateSubscriptionStatus } from "@/app/components/lib/subscription-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/subscription-reports
 * Comprehensive SaaS Subscription Analytics & Reports
 */
export async function GET(request) {
    try {
        const { user, errorResponse } = await getAuthenticatedUser(request, { skipSubscriptionCheck: true });
        if (errorResponse) return errorResponse;

        if (!user.isSuperAdmin) {
            return NextResponse.json(
                { success: false, message: "Forbidden: Only Super Admin can view subscription reports" },
                { status: 403 }
            );
        }

        // 1. Fetch all academies and their latest subscriptions
        const [academies] = await pool.query(
            `SELECT 
                a.id AS academy_id,
                a.academy_name,
                a.academy_code,
                a.status AS academy_status,
                a.email,
                a.phone,
                s.id AS subscription_id,
                s.plan_id,
                s.subscription_start_date,
                s.subscription_end_date,
                s.grace_period_days,
                s.grace_end_date,
                s.subscription_status,
                s.payment_status,
                p.plan_name,
                p.plan_code,
                p.price AS plan_price
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
             WHERE a.is_deleted = 0
             ORDER BY a.id ASC`
        );

        let activeCount = 0;
        let graceCount = 0;
        let expiredCount = 0;
        let suspendedCount = 0;
        let cancelledCount = 0;
        let noSubCount = 0;
        let inactiveAcademyCount = 0;
        const upcomingExpiries = [];

        const planCounts = {};

        for (const acad of academies) {
            if (Number(acad.academy_status) !== 1) {
                inactiveAcademyCount++;
            }

            if (!acad.subscription_id) {
                noSubCount++;
                continue;
            }

            const computed = calculateSubscriptionStatus(acad, acad.academy_status);

            if (computed.subscription_status === "active") {
                activeCount++;
                // Check if expiring in next 30 days
                if (computed.days_until_expiry <= 30) {
                    upcomingExpiries.push({
                        academy_id: acad.academy_id,
                        academy_name: acad.academy_name,
                        academy_code: acad.academy_code,
                        plan_name: computed.plan_name,
                        subscription_end_date: computed.subscription_end_date,
                        grace_end_date: computed.grace_end_date,
                        days_remaining: computed.days_until_expiry,
                        status: "active",
                    });
                }
            } else if (computed.subscription_status === "grace_period") {
                graceCount++;
                upcomingExpiries.push({
                    academy_id: acad.academy_id,
                    academy_name: acad.academy_name,
                    academy_code: acad.academy_code,
                    plan_name: computed.plan_name,
                    subscription_end_date: computed.subscription_end_date,
                    grace_end_date: computed.grace_end_date,
                    days_remaining: computed.grace_days_remaining,
                    status: "grace_period",
                });
            } else if (computed.subscription_status === "expired") {
                expiredCount++;
            } else if (computed.subscription_status === "suspended") {
                suspendedCount++;
            } else if (computed.subscription_status === "cancelled") {
                cancelledCount++;
            }

            const pName = acad.plan_name || "Unassigned";
            planCounts[pName] = (planCounts[pName] || 0) + 1;
        }

        // 2. Fetch total revenue and recent payments
        const [revenueRows] = await pool.query(
            `SELECT 
                IFNULL(SUM(amount), 0) AS total_revenue,
                COUNT(*) AS total_success_payments
             FROM cst_subscription_payments
             WHERE payment_status = 'success'`
        );
        const totalRevenue = Number(revenueRows[0]?.total_revenue || 0);

        // 3. Monthly Revenue Trend (Last 6 months)
        const [monthlyRows] = await pool.query(
            `SELECT 
                DATE_FORMAT(payment_date, '%Y-%m') AS month,
                IFNULL(SUM(amount), 0) AS revenue,
                COUNT(*) AS payment_count
             FROM cst_subscription_payments
             WHERE payment_status = 'success'
               AND payment_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
             GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
             ORDER BY month ASC`
        );

        // Sort upcoming expiries by urgency (fewest days remaining first)
        upcomingExpiries.sort((a, b) => a.days_remaining - b.days_remaining);

        return NextResponse.json({
            success: true,
            data: {
                kpis: {
                    total_academies: academies.length,
                    active_subscriptions: activeCount,
                    grace_period_subscriptions: graceCount,
                    expired_subscriptions: expiredCount,
                    suspended_subscriptions: suspendedCount,
                    cancelled_subscriptions: cancelledCount,
                    no_subscription: noSubCount,
                    inactive_academies: inactiveAcademyCount,
                    total_revenue: totalRevenue,
                },
                upcoming_expiries: upcomingExpiries,
                plan_distribution: Object.entries(planCounts).map(([name, count]) => ({
                    plan_name: name,
                    count,
                })),
                monthly_revenue: monthlyRows.map((m) => ({
                    month: m.month,
                    revenue: Number(m.revenue),
                    count: Number(m.payment_count),
                })),
            },
        });
    } catch (error) {
        console.error("GET /api/subscription-reports error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to generate subscription reports", error: error.message },
            { status: 500 }
        );
    }
}
