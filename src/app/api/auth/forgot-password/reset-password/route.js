import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "@/app/components/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "cricketAcademy_2026@Admin#Panel$Role%Secure123";

export async function POST(request) {
    let connection;

    try {
        const body = await request.json();
        const resetToken = String(body.reset_token || "").trim();
        const newPassword = String(body.new_password || "");
        const confirmPassword = String(body.confirm_password || "");

        if (!resetToken) {
            return NextResponse.json(
                { success: false, message: "Reset session token is missing. Please restart the process." },
                { status: 400 }
            );
        }

        if (!newPassword || newPassword.length < 6) {
            return NextResponse.json(
                { success: false, message: "New password must be at least 6 characters long." },
                { status: 400 }
            );
        }

        if (newPassword !== confirmPassword) {
            return NextResponse.json(
                { success: false, message: "New password and confirmation password do not match." },
                { status: 400 }
            );
        }

        // Verify JWT token
        let decoded;
        try {
            decoded = jwt.verify(resetToken, JWT_SECRET);
        } catch (jwtErr) {
            return NextResponse.json(
                { success: false, message: "Reset session has expired (exceeded 10 minutes). Please request a new code." },
                { status: 401 }
            );
        }

        if (!decoded || !decoded.user_id || decoded.purpose !== "cst_academy_password_reset") {
            return NextResponse.json(
                { success: false, message: "Invalid reset session token." },
                { status: 403 }
            );
        }

        connection = await pool.getConnection();

        // Check if reset record is still valid in cst_password_resets
        const [records] = await connection.query(
            `
            SELECT id, user_id, expires_at
            FROM cst_password_resets
            WHERE id = ? AND user_id = ? AND expires_at >= NOW()
            LIMIT 1
            `,
            [decoded.reset_id, decoded.user_id]
        );

        if (!records || records.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "The 10-minute reset window has expired. Please request a new verification code.",
                },
                { status: 400 }
            );
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password in cst_users
        await connection.query(
            `UPDATE cst_users SET password = ?, updated_at = NOW() WHERE id = ?`,
            [hashedPassword, decoded.user_id]
        );

        // Hard delete all reset requests for this user from cst_password_resets
        await connection.query(
            `DELETE FROM cst_password_resets WHERE user_id = ?`,
            [decoded.user_id]
        );

        return NextResponse.json({
            success: true,
            message: "Your password has been reset successfully! You can now sign in with your new password.",
        });
    } catch (error) {
        console.error("Error in forgot-password/reset-password:", error);
        return NextResponse.json(
            {
                success: false,
                message: "An unexpected error occurred while resetting your password. Please try again.",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
