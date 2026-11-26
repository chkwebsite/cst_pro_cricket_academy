import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation";
import { renewSubscription } from "@/app/components/lib/subscription-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/subscription-renew
 * Renew an academy's SaaS subscription
 */
export async function POST(request) {
    try {
        const { user, errorResponse } = await getAuthenticatedUser(request, { skipSubscriptionCheck: true });
        if (errorResponse) return errorResponse;

        const body = await request.json();
        const {
            academy_id,
            plan_id,
            payment_mode = "manual",
            transaction_id = null,
            amount = null,
            remarks = "Subscription renewal",
            force_start_date = null,
        } = body;

        const targetAcademyId = user.isSuperAdmin ? academy_id : user.academy_id;

        if (!targetAcademyId) {
            return NextResponse.json(
                { success: false, message: "Target Academy ID is required" },
                { status: 400 }
            );
        }

        if (!user.isSuperAdmin && Number(user.academy_id) !== Number(targetAcademyId)) {
            return NextResponse.json(
                { success: false, message: "Forbidden: You cannot renew other academies" },
                { status: 403 }
            );
        }

        if (!plan_id) {
            return NextResponse.json(
                { success: false, message: "Subscription Plan ID is required" },
                { status: 400 }
            );
        }

        const result = await renewSubscription({
            academyId: Number(targetAcademyId),
            planId: Number(plan_id),
            paymentMode: payment_mode,
            transactionId: transaction_id,
            amount: amount !== null && amount !== undefined ? Number(amount) : null,
            remarks,
            createdBy: user.id,
            forceStartDate: force_start_date,
        });

        return NextResponse.json({
            success: true,
            message: `Subscription successfully renewed for ${result.plan_name}`,
            data: result,
        });
    } catch (error) {
        console.error("POST /api/subscription-renew error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Failed to renew subscription" },
            { status: 500 }
        );
    }
}
