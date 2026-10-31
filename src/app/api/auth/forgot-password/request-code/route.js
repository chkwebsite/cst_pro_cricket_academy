import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";

export async function POST(request) {
    let connection;

    try {
        const body = await request.json();
        const rawIdentifier = String(body.identifier || "").trim();

        if (!rawIdentifier) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Please enter your Appointment Number, Email, or Phone Number.",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        // 1. Hard delete all expired reset records across the table (> 10 minutes old)
        await connection.query(`DELETE FROM cst_password_resets WHERE expires_at < NOW()`);

        // 2. Identify user by appointment_no, email, or phone in cst_users
        const cleanPhone = rawIdentifier.replace(/[^0-9+]/g, "");

        const [users] = await connection.query(
            `
            SELECT 
                id, 
                appointment_no, 
                academy_id, 
                branch_id, 
                first_name, 
                last_name, 
                email, 
                phone, 
                user_type, 
                status, 
                is_deleted
            FROM cst_users
            WHERE is_deleted = 0
              AND status = 1
              AND (
                  appointment_no = ?
                  OR LOWER(email) = LOWER(?)
                  OR phone = ?
                  OR (LENGTH(?) >= 7 AND REPLACE(REPLACE(phone, ' ', ''), '-', '') LIKE ?)
              )
            LIMIT 1
            `,
            [
                rawIdentifier,
                rawIdentifier,
                rawIdentifier,
                cleanPhone,
                cleanPhone ? `%${cleanPhone.slice(-10)}%` : rawIdentifier,
            ]
        );

        if (!users || users.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "No active Academy User account found matching that Appointment No, Email, or Phone Number.",
                },
                { status: 404 }
            );
        }

        const user = users[0];

        // Determine identifier type
        let identifierType = "appointment_no";
        if (rawIdentifier.includes("@")) {
            identifierType = "email";
        } else if (/^\+?[0-9\s-]{7,15}$/.test(rawIdentifier)) {
            identifierType = "phone";
        }

        // 3. Clear any existing pending requests for this specific user
        await connection.query(
            `DELETE FROM cst_password_resets WHERE user_id = ?`,
            [user.id]
        );

        // 4. Generate cryptographically strong/random 6-digit verification code
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        // 5. Insert into cst_password_resets with 10-minute expiry
        await connection.query(
            `
            INSERT INTO cst_password_resets (
                user_id,
                identifier,
                identifier_type,
                otp_code,
                academy_id,
                branch_id,
                status,
                expires_at,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'pending', DATE_ADD(NOW(), INTERVAL 10 MINUTE), NOW(), NOW())
            `,
            [
                user.id,
                rawIdentifier,
                identifierType,
                otpCode,
                user.academy_id || null,
                user.branch_id || null,
            ]
        );

        const displayName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.appointment_no || "User";

        return NextResponse.json({
            success: true,
            message: `A 6-digit verification code has been generated for ${displayName} and auto-filled.`,
            user_id: user.id,
            user_name: displayName,
            appointment_no: user.appointment_no,
            otp_code: otpCode,
            expires_in_seconds: 600,
        });
    } catch (error) {
        console.error("Error in forgot-password/request-code:", error);
        return NextResponse.json(
            {
                success: false,
                message: "An internal server error occurred while processing your request. Please try again.",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
