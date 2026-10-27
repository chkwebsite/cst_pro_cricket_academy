import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/app/components/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ensures cst_public_users table and cst_menu item exist.
 */
async function ensurePublicUsersTableAndMenu(connection) {
    // 1. Table
    await connection.query(`
        CREATE TABLE IF NOT EXISTS \`cst_public_users\` (
            \`id\` INT NOT NULL AUTO_INCREMENT,
            \`name\` VARCHAR(150) NOT NULL,
            \`email\` VARCHAR(150) NOT NULL,
            \`phone\` VARCHAR(20) NOT NULL,
            \`password\` VARCHAR(255) NOT NULL,
            \`profile_image\` VARCHAR(255) DEFAULT NULL,
            \`user_type\` VARCHAR(50) NOT NULL DEFAULT 'Public User',
            \`status\` TINYINT NOT NULL DEFAULT 1,
            \`is_deleted\` TINYINT NOT NULL DEFAULT 0,
            \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (\`id\`),
            UNIQUE KEY \`uniq_email\` (\`email\`),
            UNIQUE KEY \`uniq_phone\` (\`phone\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Menu Item under "Appointments & Users"
    try {
        const [existingMenu] = await connection.query(
            "SELECT id FROM cst_menu WHERE menu_url = '/next_panel/public-users' LIMIT 1"
        );

        if (!existingMenu || existingMenu.length === 0) {
            // Find parent_id for "Appointments & Users"
            const [parentRows] = await connection.query(
                `SELECT id FROM cst_menu
                 WHERE (id = 17 OR menu_key = 'appointments-users' OR LOWER(menu_title) LIKE '%appointment%')
                   AND is_deleted = 0
                 LIMIT 1`
            );
            const parentId = parentRows && parentRows.length > 0 ? parentRows[0].id : 17;

            const [insertResult] = await connection.query(
                `INSERT INTO cst_menu (
                    parent_id, menu_key, menu_name, menu_title, menu_icon, menu_url,
                    menu_type, menu_order, is_sidebar, is_active, status, is_deleted
                ) VALUES (?, 'public-users', 'Public users', 'Public Users', 'users', '/next_panel/public-users', 'link', 6, 1, 1, 1, 0)`,
                [parentId]
            );

            const newMenuId = insertResult.insertId;

            if (newMenuId) {
                // Grant to all active permissions
                await connection.query(
                    `INSERT IGNORE INTO cst_menu_permissions (menu_id, permission_id)
                     SELECT ?, id FROM cst_permissions WHERE status = 1`,
                    [newMenuId]
                );
            }
        }
    } catch (menuErr) {
        console.warn("ensurePublicUsersTableAndMenu menu setup note:", menuErr?.message);
    }
}

// GET - List public users
export async function GET(request) {
    let connection;

    try {
        connection = await pool.getConnection();
        await ensurePublicUsersTableAndMenu(connection);

        const { searchParams } = new URL(request.url);
        const search = String(searchParams.get("search") || "").trim();
        const status = searchParams.get("status");
        const page = Math.max(Number(searchParams.get("page") || 1), 1);
        const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 200);
        const offset = (page - 1) * limit;

        const where = ["is_deleted = 0"];
        const values = [];

        if (status !== null && status !== undefined && status !== "") {
            where.push("status = ?");
            values.push(Number(status));
        }

        if (search) {
            where.push("(name LIKE ? OR email LIKE ? OR phone LIKE ?)");
            const sVal = `%${search}%`;
            values.push(sVal, sVal, sVal);
        }

        const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

        // Total count for current filter
        const [countRows] = await connection.query(
            `SELECT COUNT(*) AS total FROM cst_public_users ${whereSql}`,
            values
        );
        const totalCount = Number(countRows[0]?.total || 0);

        // Fetch users
        const [rows] = await connection.query(
            `SELECT
                id,
                name,
                email,
                phone,
                profile_image,
                user_type,
                status,
                created_at,
                updated_at
             FROM cst_public_users
             ${whereSql}
             ORDER BY id DESC
             LIMIT ? OFFSET ?`,
            [...values, limit, offset]
        );

        // Compute overall stats (total, active, inactive, today)
        const [statsRows] = await connection.query(`
            SELECT
                COUNT(*) AS total_all,
                SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS active_count,
                SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS inactive_count,
                SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS today_count
            FROM cst_public_users
            WHERE is_deleted = 0
        `);

        const stats = {
            total: Number(statsRows[0]?.total_all || 0),
            active: Number(statsRows[0]?.active_count || 0),
            inactive: Number(statsRows[0]?.inactive_count || 0),
            today: Number(statsRows[0]?.today_count || 0),
        };

        return NextResponse.json({
            success: true,
            data: rows,
            stats,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit) || 1,
            },
        });
    } catch (error) {
        console.error("GET /api/public-users error:", error);
        return NextResponse.json(
            {
                success: false,
                message: error.message || "Failed to fetch public users",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// POST - Create a new public user manually from panel
export async function POST(request) {
    let connection;

    try {
        const body = await request.json();
        const name = String(body.name || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const phone = String(body.phone || "").trim().replace(/[^0-9]/g, "");
        const password = String(body.password || "").trim();
        const userType = String(body.user_type || "Public User").trim();
        const status = body.status !== undefined ? Number(body.status) : 1;

        if (!name) {
            return NextResponse.json({ success: false, message: "Full Name is required." }, { status: 400 });
        }
        if (!email) {
            return NextResponse.json({ success: false, message: "Email is required." }, { status: 400 });
        }
        if (!phone) {
            return NextResponse.json({ success: false, message: "Phone number is required." }, { status: 400 });
        }
        if (!password || password.length < 6) {
            return NextResponse.json({ success: false, message: "Password must be at least 6 characters." }, { status: 400 });
        }

        connection = await pool.getConnection();
        await ensurePublicUsersTableAndMenu(connection);

        // Check duplicates
        const [existing] = await connection.query(
            "SELECT id, email, phone FROM cst_public_users WHERE (email = ? OR phone = ?) AND is_deleted = 0 LIMIT 1",
            [email, phone]
        );

        if (existing && existing.length > 0) {
            const conflict = existing[0];
            if (conflict.email === email) {
                return NextResponse.json({ success: false, message: "Email is already registered." }, { status: 409 });
            }
            if (conflict.phone === phone) {
                return NextResponse.json({ success: false, message: "Phone number is already registered." }, { status: 409 });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [insertResult] = await connection.query(
            `INSERT INTO cst_public_users (name, email, phone, password, user_type, status, is_deleted)
             VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [name, email, phone, hashedPassword, userType, status]
        );

        return NextResponse.json({
            success: true,
            message: "Public user created successfully.",
            id: insertResult.insertId,
        });
    } catch (error) {
        console.error("POST /api/public-users error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Failed to create public user" },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
