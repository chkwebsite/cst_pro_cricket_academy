import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import db from "@/app/components/lib/db";

export const runtime = "nodejs";

export async function POST(request) {
    try {
        const body = await request.json().catch(() => ({}));
        const login = String(body.login || body.email || body.phone || "").trim();
        const password = String(body.password || "");

        if (!login) {
            return NextResponse.json(
                { success: false, message: "Email or mobile number is required." },
                { status: 400 }
            );
        }
        if (!password) {
            return NextResponse.json(
                { success: false, message: "Password is required." },
                { status: 400 }
            );
        }

        const cleanLogin = login.replace(/[^0-9]/g, "");

        const [users] = await db.query(
            `SELECT id, name, email, phone, password, profile_image, user_type, status, is_deleted
             FROM cst_public_users
             WHERE (LOWER(email) = LOWER(?) OR phone = ? OR (length(?) >= 10 AND phone = ?))
             LIMIT 1`,
            [login, login, cleanLogin, cleanLogin]
        );

        if (users.length === 0) {
            return NextResponse.json(
                { success: false, message: "Invalid email/mobile number or password." },
                { status: 401 }
            );
        }

        const user = users[0];

        if (Number(user.is_deleted) === 1) {
            return NextResponse.json(
                { success: false, message: "This account has been deactivated." },
                { status: 403 }
            );
        }
        if (Number(user.status) !== 1) {
            return NextResponse.json(
                { success: false, message: "Your account is inactive. Please contact support." },
                { status: 403 }
            );
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return NextResponse.json(
                { success: false, message: "Invalid email/mobile number or password." },
                { status: 401 }
            );
        }

        const userPayload = {
            id: user.id,
            name: user.name,
            first_name: user.name.split(" ")[0] || user.name,
            last_name: user.name.split(" ").slice(1).join(" ") || "",
            email: user.email,
            phone: user.phone,
            user_type: user.user_type || "Public User",
            profile_image: user.profile_image || null,
            is_public: true,
        };

        const session = {
            user: userPayload,
            permissions: ["public_user", "ground_booking"],
        };

        const jwtSecret = process.env.JWT_SECRET || "cst_public_auth_secret_token_2026";
        const token = jwt.sign(
            { public_user_id: user.id, email: user.email, name: user.name, user_type: "public" },
            jwtSecret,
            { expiresIn: "30d" }
        );

        const response = NextResponse.json({
            success: true,
            message: "Login successful!",
            user: userPayload,
            session,
            token,
        });

        response.cookies.set("public_auth_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 30 * 24 * 60 * 60,
        });

        return response;
    } catch (error) {
        console.error("Public Login POST error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Failed to sign in." },
            { status: 500 }
        );
    }
}
