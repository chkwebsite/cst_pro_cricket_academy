import { NextResponse } from "next/server";
import { getNextMatchNumber } from "@/app/components/lib/matches";
import { getAuthUser } from "@/app/components/lib/rbac";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const academyIdParam = searchParams.get("academy_id");

        const authUser = await getAuthUser(request);
        const academyId =
            academyIdParam ||
            (authUser && !authUser.isSuperAdmin ? authUser.academy_id : null);

        const result = await getNextMatchNumber({ academyId });

        return NextResponse.json(result);
    } catch (error) {
        console.error("GET next match number error:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch next match number",
                next_match_no: "M-001",
                error: error.message,
            },
            { status: 500 }
        );
    }
}
