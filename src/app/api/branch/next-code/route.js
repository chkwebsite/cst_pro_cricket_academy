import { NextResponse } from "next/server";
import { getNextBranchCode } from "@/app/components/lib/branches";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const academyIdParam = searchParams.get("academy_id");

        const { user: authUser } = await getAuthenticatedUser(request);
        const academyId =
            academyIdParam ||
            (authUser && !authUser.isSuperAdmin ? authUser.academy_id : null);

        const result = await getNextBranchCode({ academyId });

        return NextResponse.json(result);
    } catch (error) {
        console.error("GET next branch code error:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch next branch code",
                next_branch_code: "BR-001",
                error: error.message,
            },
            { status: 500 }
        );
    }
}
