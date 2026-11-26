import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation";

export const dynamic = "force-dynamic";

/**
 * GET /api/subscription-history
 * Query subscription audit and change logs
 */
export async function GET(request) {
    try {
        const { user, errorResponse } = await getAuthenticatedUser(request, { skipSubscriptionCheck: true });
        if (errorResponse) return errorResponse;

        const { searchParams } = new URL(request.url);
        const academyId = searchParams.get("academy_id");
        const eventType = searchParams.get("event_type");
        const search = searchParams.get("search");

        let effectiveAcademyId = academyId;
        if (!user.isSuperAdmin) {
            effectiveAcademyId = user.academy_id;
        }

        let sql = `
            SELECT 
                h.*,
                a.academy_name,
                a.academy_code,
                p.plan_name,
                p.plan_code,
                u.first_name AS user_first_name,
                u.last_name AS user_last_name,
                u.email AS user_email
            FROM cst_subscription_history h
            LEFT JOIN cst_academy a ON a.id = h.academy_id
            LEFT JOIN cst_subscription_plans p ON p.id = h.plan_id
            LEFT JOIN cst_users u ON u.id = h.changed_by
            WHERE 1 = 1
        `;
        const params = [];

        if (effectiveAcademyId) {
            sql += ` AND h.academy_id = ?`;
            params.push(Number(effectiveAcademyId));
        }

        if (eventType) {
            sql += ` AND h.event_type = ?`;
            params.push(eventType);
        }

        if (search) {
            sql += ` AND (a.academy_name LIKE ? OR h.event_type LIKE ? OR h.remarks LIKE ?)`;
            const q = `%${search.trim()}%`;
            params.push(q, q, q);
        }

        sql += ` ORDER BY h.id DESC LIMIT 200`;

        const [rows] = await pool.query(sql, params);

        const formatted = rows.map((r) => {
            let prev = r.previous_values;
            let next = r.new_values;
            if (typeof prev === "string") {
                try { prev = JSON.parse(prev); } catch { prev = null; }
            }
            if (typeof next === "string") {
                try { next = JSON.parse(next); } catch { next = null; }
            }
            return {
                ...r,
                previous_values: prev,
                new_values: next,
                changed_by_name: [r.user_first_name, r.user_last_name].filter(Boolean).join(" ") || "System / Admin",
            };
        });

        return NextResponse.json({
            success: true,
            data: formatted,
            count: formatted.length,
        });
    } catch (error) {
        console.error("GET /api/subscription-history error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch subscription history", error: error.message },
            { status: 500 }
        );
    }
}
