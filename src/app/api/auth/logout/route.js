import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
    try {
        const response = NextResponse.json({
            success: true,
            message: "Logout successful",
        });

        // Expire Academy User token
        response.cookies.set("auth_token", "", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 0,
            expires: new Date(0),
            path: "/",
        });

        // Expire Public User token as well
        response.cookies.set("public_auth_token", "", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 0,
            expires: new Date(0),
            path: "/",
        });

        return response;
    } catch (error) {
        console.error("Logout API error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Logout failed",
            },
            { status: 500 }
        );
    }
}