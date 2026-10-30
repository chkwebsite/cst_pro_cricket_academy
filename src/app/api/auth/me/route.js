import { NextResponse } from "next/server";
import { getServerSession } from "@/app/components/lib/auth-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await getServerSession();

        if (session && session.user) {
            return NextResponse.json({
                success: true,
                user: session.user,
                permissions: session.permissions || [],
                session,
            });
        }

        return NextResponse.json(
            {
                success: false,
                message: "Not authenticated",
                user: null,
                session: null,
            },
            { status: 401 }
        );
    } catch (error) {
        console.error("GET /api/auth/me error:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
                user: null,
                session: null,
            },
            { status: 500 }
        );
    }
}
