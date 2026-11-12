import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/app/components/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET - Single public user details
export async function GET(request, { params }) {
    let connection;

    try {
        const { id } = await params;
        connection = await pool.getConnection();

        const [rows] = await connection.query(
            `SELECT id, name, email, phone, profile_image, user_type, status, created_at, updated_at
             FROM cst_public_users
             WHERE id = ? AND is_deleted = 0
             LIMIT 1`,
            [id]
        );

        if (!rows || rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Public user not found." },
                { status: 404 }
            );
        }

        const user = rows[0];

        // Check if user has ground bookings or enquiries
        let bookingCount = 0;
        try {
            const [bRows] = await connection.query(
                `SELECT COUNT(*) AS total FROM cst_ground_bookings WHERE (customer_phone = ? OR customer_email = ?) AND is_deleted = 0`,
                [user.phone, user.email]
            );
            bookingCount = Number(bRows[0]?.total || 0);
        } catch (_) {
            // Ignore if bookings table doesn't have these columns
        }

        return NextResponse.json({
            success: true,
            data: {
                ...user,
                total_bookings: bookingCount,
            },
        });
    } catch (error) {
        console.error("GET /api/public-users/[id] error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Failed to fetch public user." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// PUT / PATCH - Update public user
export async function PUT(request, { params }) {
    let connection;

    try {
        const { id } = await params;
        const body = await request.json();

        connection = await pool.getConnection();

        // Check exists
        const [existing] = await connection.query(
            "SELECT id, email, phone FROM cst_public_users WHERE id = ? AND is_deleted = 0 LIMIT 1",
            [id]
        );

        if (!existing || existing.length === 0) {
            return NextResponse.json(
                { success: false, message: "Public user not found." },
                { status: 404 }
            );
        }

        const updates = [];
        const values = [];

        // 1. Name
        if (body.name !== undefined) {
            const name = String(body.name).trim();
            if (!name) return NextResponse.json({ success: false, message: "Name cannot be empty." }, { status: 400 });
            updates.push("name = ?");
            values.push(name);
        }

        // 2. Email
        if (body.email !== undefined) {
            const email = String(body.email).trim().toLowerCase();
            if (!email) return NextResponse.json({ success: false, message: "Email cannot be empty." }, { status: 400 });

            // check unique
            const [dup] = await connection.query(
                "SELECT id FROM cst_public_users WHERE email = ? AND id != ? AND is_deleted = 0 LIMIT 1",
                [email, id]
            );
            if (dup && dup.length > 0) {
                return NextResponse.json({ success: false, message: "Email is already taken by another user." }, { status: 409 });
            }
            updates.push("email = ?");
            values.push(email);
        }

        // 3. Phone
        if (body.phone !== undefined) {
            const phone = String(body.phone).trim().replace(/[^0-9]/g, "");
            if (!phone) return NextResponse.json({ success: false, message: "Phone cannot be empty." }, { status: 400 });

            // check unique
            const [dupPhone] = await connection.query(
                "SELECT id FROM cst_public_users WHERE phone = ? AND id != ? AND is_deleted = 0 LIMIT 1",
                [phone, id]
            );
            if (dupPhone && dupPhone.length > 0) {
                return NextResponse.json({ success: false, message: "Phone is already taken by another user." }, { status: 409 });
            }
            updates.push("phone = ?");
            values.push(phone);
        }

        // 4. Status
        if (body.status !== undefined) {
            updates.push("status = ?");
            values.push(Number(body.status) === 1 ? 1 : 0);
        }

        // 5. Password (optional reset)
        if (body.password && String(body.password).trim().length >= 6) {
            const hashedPassword = await bcrypt.hash(String(body.password).trim(), 10);
            updates.push("password = ?");
            values.push(hashedPassword);
        }

        if (updates.length === 0) {
            return NextResponse.json({ success: false, message: "No fields provided to update." }, { status: 400 });
        }

        values.push(id);
        await connection.query(
            `UPDATE cst_public_users SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
            values
        );

        return NextResponse.json({
            success: true,
            message: "Public user updated successfully.",
        });
    } catch (error) {
        console.error("PUT /api/public-users/[id] error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Failed to update public user." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// DELETE - Soft delete public user
export async function DELETE(request, { params }) {
    let connection;

    try {
        const { id } = await params;
        connection = await pool.getConnection();

        const [result] = await connection.query(
            "UPDATE cst_public_users SET is_deleted = 1, updated_at = NOW() WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json(
                { success: false, message: "Public user not found." },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Public user deleted successfully.",
        });
    } catch (error) {
        console.error("DELETE /api/public-users/[id] error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Failed to delete public user." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
