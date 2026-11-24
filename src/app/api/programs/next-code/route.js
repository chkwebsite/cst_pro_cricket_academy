import { NextResponse } from "next/server";
import { getNextProgramCode } from "@/app/components/lib/programs";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const academyIdParam = searchParams.get("academy_id");

        const { user: authUser } = await getAuthenticatedUser(request);
        const academyId =
            academyIdParam ||
            (authUser && !authUser.isSuperAdmin ? authUser.academy_id : null);

        const result = await getNextProgramCode({ academyId });

        return NextResponse.json(result);
    } catch (error) {
        console.error("GET next program code error:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch next program code",
                next_program_code: "PRG-001",
                error: error.message,
            },
            { status: 500 }
        );
    }
}
