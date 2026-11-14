import { NextResponse } from "next/server";
import { getNextGroundCode } from "@/app/components/lib/grounds";
import { getAuthUser } from "@/app/components/lib/rbac";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const academyIdParam = searchParams.get("academy_id");

        const authUser = await getAuthUser(request);
        const academyId =
            academyIdParam ||
            (authUser && !authUser.isSuperAdmin ? authUser.academy_id : null);

        const result = await getNextGroundCode({ academyId });

        return NextResponse.json(result);
    } catch (error) {
        console.error("GET next ground code error:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch next ground code",
                next_ground_code: "GD-CODE-001",
                error: error.message,
            },
            { status: 500 }
        );
    }
}
