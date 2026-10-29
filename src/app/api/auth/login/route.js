import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "@/app/components/lib/db";
import { ensurePlayerAccess } from "@/app/components/lib/playerAccessInit.js";

export async function POST(request) {
    let connection;

    try {
        const body = await request.json();

        const login = String(body.login ?? "").trim();
        const password = String(body.password ?? "");

        if (!login) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Email or appointment number is required",
                },
                { status: 400 }
            );
        }

        if (!password) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Password is required",
                },
                { status: 400 }
            );
        }

        const JWT_SECRET = process.env.JWT_SECRET;

        if (!JWT_SECRET) {
            console.error("JWT_SECRET is missing");

            return NextResponse.json(
                {
                    success: false,
                    message: "Server configuration error",
                },
                { status: 500 }
            );
        }

        connection = await pool.getConnection();
        await ensurePlayerAccess(connection);

        /*
         * Login by:
         * 1. Email
         * 2. Appointment number
         */
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
                password,
                profile_image,
                user_type,
                status,
                is_deleted,
                last_login_at,
                created_at,
                updated_at
            FROM cst_users
            WHERE
                (
                    LOWER(email) = LOWER(?)
                    OR appointment_no = ?
                )
            LIMIT 1
            `,
            [login, login]
        );

        if (users.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid email/appointment number or password",
                },
                { status: 401 }
            );
        }

        const user = users[0];

        /*
         * Check deleted
         */
        if (Number(user.is_deleted) === 1) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Your account has been deleted",
                },
                { status: 403 }
            );
        }

        /*
         * Check active
         */
        if (Number(user.status) !== 1) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Your account is inactive",
                },
                { status: 403 }
            );
        }

        /*
         * Check password
         */
        let passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        // Fallback for Player accounts: allow default password '123456', user phone, or appointment number
        const isPlayerUser =
            user.user_type === "7" ||
            String(user.user_type || "").toLowerCase().includes("player");

        if (!passwordMatch && isPlayerUser) {
            if (
                password === "123456" ||
                (user.phone && password === String(user.phone).trim()) ||
                (user.appointment_no && password === String(user.appointment_no).trim())
            ) {
                passwordMatch = true;
                try {
                    const newHash = await bcrypt.hash(password, 10);
                    await connection.query("UPDATE cst_users SET password = ? WHERE id = ?", [newHash, user.id]);
                } catch (hashErr) {
                    console.error("Failed to update player password hash:", hashErr);
                }
            }
        }

        if (!passwordMatch) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid email/appointment number or password",
                },
                { status: 401 }
            );
        }


        const [permissions] = await connection.query(
            `
            SELECT
               
                p.permission_name,
                p.status AS permission_status,

                m.id AS menu_id,
                m.parent_id,
                m.menu_key,
                m.menu_name,
                m.menu_title,
                m.menu_icon,
                m.menu_url,
                m.menu_type,
                m.menu_order,
                m.is_sidebar,
                m.is_active,
                m.status AS menu_status

            FROM cst_user_roles ur

            INNER JOIN cst_role_permissions rp
                ON rp.role_id = ur.role_id

            INNER JOIN cst_permissions p
                ON p.id = rp.permission_id

            INNER JOIN cst_menu_permissions mp
                ON mp.permission_id = p.id

            INNER JOIN cst_menu m
                ON m.id = mp.menu_id

            WHERE
                ur.user_id = ?
                AND p.status = 1
                AND m.is_deleted = 0
                AND m.is_active = 1
                AND m.status = 1

            ORDER BY
                m.parent_id ASC,
                m.menu_order ASC,
                m.id ASC
            `,
            [user.id]
        );

        /*
         * Update last login
         */
        await connection.query(
            `
            UPDATE cst_users
            SET last_login_at = NOW()
            WHERE id = ?
            `,
            [user.id]
        );

        /*
         * Remove password from response
         */
        const userData = {
            id: user.id,
            appointment_no: user.appointment_no,
            academy_id: user.academy_id,
            branch_id: user.branch_id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            phone: user.phone,
            profile_image: typeof user.profile_image === "string"
                ? user.profile_image.trimEnd()
                : user.profile_image,
            user_type: user.user_type,
            status: Number(user.status),
            last_login_at: user.last_login_at,
            created_at: user.created_at,
            updated_at: user.updated_at,
        };

        /*
         * Remove duplicate menu/permission combinations
         */
        const uniquePermissions = [];
        const permissionMap = new Map();

        for (const item of permissions) {
            const key = `${item.menu_id}-${item.permission_id}`;

            if (!permissionMap.has(key)) {
                permissionMap.set(key, true);

                uniquePermissions.push({
                    user_permission_id: item.user_permission_id,

                    permission_id: item.permission_id,
                    module_name: item.module_name,
                    permission_name: item.permission_name,

                    menu_id: item.menu_id,
                    parent_id: item.parent_id,

                    menu_key: item.menu_key,
                    menu_name: item.menu_name,
                    menu_title: item.menu_title,
                    menu_icon: item.menu_icon,
                    menu_url: item.menu_url,
                    menu_type: item.menu_type,
                    menu_order: item.menu_order,

                    is_sidebar: Number(item.is_sidebar),
                    is_active: Number(item.is_active),
                });
            }
        }

        const isPlayer =
            user.user_type === "7" ||
            String(user.user_type || "").toLowerCase().includes("player");

        if (isPlayer) {
            const hasPlayerDashboard = uniquePermissions.some(
                (item) => item.menu_url === "/next_panel/player-dashboard"
            );

            if (!hasPlayerDashboard) {
                uniquePermissions.unshift({
                    user_permission_id: null,
                    permission_id: null,
                    module_name: "Player Dashboard",
                    permission_name: "view_player_dashboard",
                    menu_id: 99999,
                    parent_id: null,
                    menu_key: "player-dashboard",
                    menu_name: "Player Dashboard",
                    menu_title: "Player Dashboard",
                    menu_icon: "player-dashboard",
                    menu_url: "/next_panel/player-dashboard",
                    menu_type: "link",
                    menu_order: 1,
                    is_sidebar: 1,
                    is_active: 1,
                });
            }
        }

        userData.permissions = uniquePermissions;

        /*
         * JWT
         */
        const isSuperAdmin =
            user.user_type === "Super Admin" ||
            user.user_type === "superadmin" ||
            user.user_type === "super admin";

        const token = jwt.sign(
            {
                id: user.id,
                appointment_no: user.appointment_no,
                email: user.email,
                user_type: user.user_type,
                permissions: isSuperAdmin
                    ? ["*"]
                    : (isPlayer
                        ? Array.from(new Set([...uniquePermissions.map((item) => item.menu_url).filter(Boolean), "/next_panel/player-dashboard"]))
                        : uniquePermissions.map((item) => item.menu_url).filter(Boolean)),
            },
            JWT_SECRET,
            {
                expiresIn: "7d",
            }
        );

        /*
         * Create response
         */
        const response = NextResponse.json(
            {
                success: true,
                message: "Login successful",

                user: userData,

                permissions: uniquePermissions,

                session: {
                    user: userData,
                    permissions: uniquePermissions,
                },

                permission_count: uniquePermissions.length,
            },
            { status: 200 }
        );

        /*
         * Store JWT in HttpOnly cookie
         */
        response.cookies.set("auth_token", token, {
            httpOnly: true,

            secure: process.env.NODE_ENV === "production" && (request.headers.get("x-forwarded-proto") === "https" || request.url.startsWith("https:")),

            sameSite: "lax",

            maxAge: 60 * 60 * 24 * 7,

            path: "/",
        });

        return response;

    } catch (error) {
        console.error("LOGIN API ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
            },
            { status: 500 }
        );

    } finally {
        if (connection) {
            connection.release();
        }
    }
}