import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import pool from "@/app/components/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "cricketAcademy_2026@Admin#Panel$Role%Secure123";

export async function POST(request) {
    let connection;

    try {
        const body = await request.json();
        const userId = Number(body.user_id);
        const otpCode = String(body.otp_code || "").trim();

        if (!userId || !otpCode) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User ID and 6-digit verification code are required.",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        // 1. Purge expired records
        await connection.query(`DELETE FROM cst_password_resets WHERE expires_at < NOW()`);

        // 2. Query matching reset code
        const [rows] = await connection.query(
            `
            SELECT id, user_id, otp_code, expires_at, status
            FROM cst_password_resets
            WHERE user_id = ?
              AND otp_code = ?
              AND expires_at >= NOW()
              AND status IN ('pending', 'verified')
            LIMIT 1
            `,
            [userId, otpCode]
        );

        if (!rows || rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid or expired verification code. Please confirm the code with your Branch/Academy Admin.",
                },
                { status: 400 }
            );
        }

        const resetRecord = rows[0];

        // Mark as verified
        await connection.query(
            `UPDATE cst_password_resets SET status = 'verified', updated_at = NOW() WHERE id = ?`,
            [resetRecord.id]
        );

        // Generate secure short-lived reset token
        const resetToken = jwt.sign(
            {
                reset_id: resetRecord.id,
                user_id: resetRecord.user_id,
                purpose: "cst_academy_password_reset",
            },
            JWT_SECRET,
            { expiresIn: "10m" }
        );

        return NextResponse.json({
            success: true,
            message: "Code verified successfully! Please enter your new password.",
            reset_token: resetToken,
        });
    } catch (error) {
        console.error("Error in forgot-password/verify-code:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Unable to verify the code due to a server error. Please try again.",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
