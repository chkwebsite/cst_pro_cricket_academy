import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "@/app/components/lib/db";
import { ensurePlayerAccess } from "@/app/components/lib/playerAccessInit.js";
import { getUserRole, ROLES, ROLE_ALLOWED_ROUTES } from "@/app/components/lib/rbac.js";
import { getAcademySubscription } from "@/app/components/lib/subscription-service.js";

export async function POST(request) {
    let connection;

    try {
        const body = await request.json();

        const login = String(body.login ?? body.email ?? "").trim();
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
                u.id,
                u.appointment_no,
                u.academy_id,
                u.branch_id,
                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                u.password,
                u.profile_image,
                u.user_type,
                u.status,
                u.is_deleted,
                u.last_login_at,
                u.created_at,
                u.updated_at,
                a.academy_name,
                a.academy_code,
                a.logo AS academy_logo,
                b.branch_name
            FROM cst_users u
            LEFT JOIN cst_academy a ON a.id = u.academy_id
            LEFT JOIN cst_branch b ON b.id = u.branch_id
            WHERE
                (
                    LOWER(u.email) = LOWER(?)
                    OR u.appointment_no = ?
                    OR u.phone = ?
                )
            LIMIT 1
            `,
            [login, login, login]
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

        // Fallback for Player or Umpire accounts: allow default password '123456', user phone, or appointment number
        const isPlayerUser =
            user.user_type === "7" ||
            String(user.user_type || "").toLowerCase().includes("player");
        const isUmpireUser =
            String(user.user_type || "").toLowerCase().includes("umpire");

        if (!passwordMatch && (isPlayerUser || isUmpireUser)) {
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
                    console.error("Failed to update password hash:", hashErr);
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

        const userRole = getUserRole(user);
        const isSuperAdmin = userRole === ROLES.SUPER_ADMIN;
        const isPlayer =
            user.user_type === "7" ||
            userRole === ROLES.PLAYER ||
            String(user.user_type || "").toLowerCase().includes("player") ||
            String(user.role_name || "").toLowerCase().includes("player");
        const isUmpire =
            userRole === ROLES.UMPIRE ||
            String(user.user_type || "").toLowerCase().includes("umpire") ||
            String(user.role_name || "").toLowerCase().includes("umpire");

        // Subscription & Academy Status Validation
        let subInfo = null;
        if (!isSuperAdmin && user.academy_id) {
            subInfo = await getAcademySubscription(user.academy_id, connection);

            // A. Manual Academy Deactivation Check
            if (!subInfo.is_academy_active) {
                if (!isPlayer) {
                    return NextResponse.json(
                        {
                            success: false,
                            message: "Your academy is currently inactive. Please contact the system administrator.",
                            code: "ACADEMY_INACTIVE",
                            subscription: subInfo,
                        },
                        { status: 403 }
                    );
                }
                // Player continues in read-only mode
            }

            // B. Subscription Expiry / Restriction Check
            if (!subInfo.is_subscription_active) {
                if (!isPlayer) {
                    const blockMsg =
                        subInfo.subscription_status === "suspended"
                            ? "Your academy subscription has been suspended. Please contact the system administrator."
                            : subInfo.subscription_status === "cancelled"
                            ? "Your academy subscription has been cancelled. Please contact the system administrator."
                            : "Your academy subscription has expired. Please contact the system administrator to renew.";
                    return NextResponse.json(
                        {
                            success: false,
                            message: blockMsg,
                            code: "SUBSCRIPTION_RESTRICTED",
                            subscription_status: subInfo.subscription_status,
                            subscription: subInfo,
                        },
                        { status: 403 }
                    );
                }
                // Player continues in read-only mode
            }
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
            academy_name: user.academy_name || (isSuperAdmin ? "Super Admin Portal" : "CST Pro Cricket Academy"),
            academy_code: user.academy_code || null,
            academy_logo: user.academy_logo || null,
            branch_name: user.branch_name || null,
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

        const [staffMatch] = await connection.query(
            "SELECT id, date_of_joining, current_salary FROM cst_staff WHERE user_id = ? AND is_deleted = 0 LIMIT 1",
            [user.id]
        );
        if (staffMatch.length > 0) {
            userData.staff_id = staffMatch[0].id;
            userData.date_of_joining = staffMatch[0].date_of_joining;
            userData.current_salary = staffMatch[0].current_salary;
        }

        const [umpireMatch] = await connection.query(
            "SELECT id, umpire_name, experience_years, qualification FROM cst_umpires WHERE user_id = ? AND is_deleted = 0 LIMIT 1",
            [user.id]
        );
        if (umpireMatch.length > 0) {
            userData.umpire_id = umpireMatch[0].id;
            userData.umpire_name = umpireMatch[0].umpire_name;
            userData.qualification = umpireMatch[0].qualification;
        }

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

        if (isPlayer) {
            // If academy is inactive or subscription expired/restricted, player is in strict read-only mode
            const isRestrictedReadOnly = subInfo && subInfo.is_read_only;

            // Remove general dashboard and administrative product management menus from sidebar for player
            const filteredPlayerPerms = uniquePermissions.filter((item) => {
                if (item.menu_url === "/next_panel/dashboard" || item.menu_key === "dashboard") return false;
                if (item.menu_id === 54 || item.menu_key === "Product_Master") return false;
                if ([55, 56, 57, 58, 60].includes(item.menu_id)) return false;
                // If inactive academy, only keep player-dashboard
                if (isRestrictedReadOnly && item.menu_key !== "player-dashboard" && item.menu_url !== "/next_panel/player-dashboard") {
                    return false;
                }
                return true;
            });
            uniquePermissions.length = 0;
            uniquePermissions.push(...filteredPlayerPerms);

            const hasPlayerDashboard = uniquePermissions.some(
                (item) => item.menu_url === "/next_panel/player-dashboard" || item.menu_key === "player-dashboard"
            );
            if (!hasPlayerDashboard) {
                uniquePermissions.unshift({
                    user_permission_id: null,
                    permission_id: null,
                    module_name: "Player Dashboard",
                    permission_name: "view_player_dashboard",
                    menu_id: 99991,
                    parent_id: null,
                    menu_key: "player-dashboard",
                    menu_name: "Player Dashboard",
                    menu_title: "Player Dashboard",
                    menu_icon: "player-dashboard",
                    menu_url: "/next_panel/player-dashboard",
                    menu_type: "link",
                    menu_order: 0,
                    is_sidebar: 1,
                    is_active: 1,
                });
            }

            const hasAttendance = uniquePermissions.some(
                (item) => item.menu_url === "/next_panel/attendance"
            );
            if (!hasAttendance) {
                uniquePermissions.push({
                    user_permission_id: null,
                    permission_id: null,
                    module_name: "My Attendance",
                    permission_name: "view_attendance",
                    menu_id: 70,
                    parent_id: null,
                    menu_key: "attendance",
                    menu_name: "My Attendance",
                    menu_title: "My Attendance",
                    menu_icon: "calendar-check",
                    menu_url: "/next_panel/attendance",
                    menu_type: "link",
                    menu_order: 1,
                    is_sidebar: 1,
                    is_active: 1,
                });
            }

            const hasFeeStatus = uniquePermissions.some(
                (item) => item.menu_url === "/next_panel/fee-status"
            );
            if (!hasFeeStatus) {
                uniquePermissions.push({
                    user_permission_id: null,
                    permission_id: null,
                    module_name: "My Fee Status",
                    permission_name: "view_fee_status",
                    menu_id: 71,
                    parent_id: null,
                    menu_key: "fee-status",
                    menu_name: "My Fee Status",
                    menu_title: "My Fee Status",
                    menu_icon: "fee-status",
                    menu_url: "/next_panel/fee-status",
                    menu_type: "link",
                    menu_order: 2,
                    is_sidebar: 1,
                    is_active: 1,
                });
            }

            const hasProgramFees = uniquePermissions.some(
                (item) => item.menu_url === "/next_panel/player-program-fees"
            );
            if (!hasProgramFees) {
                uniquePermissions.push({
                    user_permission_id: null,
                    permission_id: null,
                    module_name: "My Program Fees",
                    permission_name: "view_player_program_fees",
                    menu_id: 36,
                    parent_id: null,
                    menu_key: "player-program-fees",
                    menu_name: "My Program Fees",
                    menu_title: "My Program Fees",
                    menu_icon: "receipt",
                    menu_url: "/next_panel/player-program-fees",
                    menu_type: "link",
                    menu_order: 3,
                    is_sidebar: 1,
                    is_active: 1,
                });
            }

            const hasGroundAvailability = uniquePermissions.some(
                (item) => item.menu_url === "/next_panel/ground-availability"
            );
            if (!hasGroundAvailability) {
                uniquePermissions.push({
                    user_permission_id: null,
                    permission_id: null,
                    module_name: "Ground Availability",
                    permission_name: "view_ground_availability",
                    menu_id: 72,
                    parent_id: null,
                    menu_key: "ground-availability",
                    menu_name: "Ground Availability",
                    menu_title: "Ground Availability",
                    menu_icon: "ground-availability",
                    menu_url: "/next_panel/ground-availability",
                    menu_type: "link",
                    menu_order: 4,
                    is_sidebar: 1,
                    is_active: 1,
                });
            }

            const hasGroundBookings = uniquePermissions.some(
                (item) => item.menu_url === "/next_panel/ground-bookings" || item.menu_url === "next_panel/ground-bookings"
            );
            if (!hasGroundBookings) {
                uniquePermissions.push({
                    user_permission_id: null,
                    permission_id: null,
                    module_name: "Ground Bookings",
                    permission_name: "view_ground_bookings",
                    menu_id: 25,
                    parent_id: null,
                    menu_key: "ground-bookings",
                    menu_name: "Ground Bookings",
                    menu_title: "Ground Bookings",
                    menu_icon: "ground-bookings",
                    menu_url: "/next_panel/ground-bookings",
                    menu_type: "link",
                    menu_order: 5,
                    is_sidebar: 1,
                    is_active: 1,
                });
            }

            const hasOrders = uniquePermissions.some(
                (item) => item.menu_url === "/next_panel/orders"
            );
            if (!hasOrders) {
                uniquePermissions.push({
                    user_permission_id: null,
                    permission_id: null,
                    module_name: "My Orders",
                    permission_name: "view_orders",
                    menu_id: 59,
                    parent_id: null,
                    menu_key: "orders",
                    menu_name: "My Orders",
                    menu_title: "My Orders",
                    menu_icon: "shopping-bag",
                    menu_url: "/next_panel/orders",
                    menu_type: "link",
                    menu_order: 6,
                    is_sidebar: 1,
                    is_active: 1,
                });
            }
        }

        /*
         * Subscription Metadata Context
         */
        userData.permissions = uniquePermissions;
        userData.role = userRole;
        userData.isSuperAdmin = isSuperAdmin;
        userData.isAcademyAdmin = userRole === ROLES.ACADEMY_ADMIN;
        userData.isBranchAdmin = userRole === ROLES.BRANCH_ADMIN;

        // Populate SaaS Subscription fields
        userData.subscription = subInfo;
        userData.academy_status = subInfo ? (subInfo.is_academy_active ? 1 : 0) : 1;
        userData.subscription_status = subInfo ? subInfo.subscription_status : "active";
        userData.plan_name = subInfo ? subInfo.plan_name : (isSuperAdmin ? "Super Admin Plan" : "Standard Plan");
        userData.subscription_start_date = subInfo ? subInfo.subscription_start_date : null;
        userData.subscription_end_date = subInfo ? subInfo.subscription_end_date : null;
        userData.grace_end_date = subInfo ? subInfo.grace_end_date : null;
        userData.grace_days_remaining = subInfo ? subInfo.grace_days_remaining : 0;
        userData.is_subscription_active = isSuperAdmin ? true : (subInfo ? subInfo.is_subscription_active : true);
        userData.is_grace_period = isSuperAdmin ? false : (subInfo ? subInfo.is_grace_period : false);
        userData.is_academy_active = isSuperAdmin ? true : (subInfo ? subInfo.is_academy_active : true);
        userData.is_read_only = isSuperAdmin ? false : (isPlayer && subInfo ? subInfo.is_read_only : false);
        userData.show_subscription_alert = isSuperAdmin ? false : (subInfo ? subInfo.show_subscription_alert : false);
        userData.is_access_allowed = isSuperAdmin ? true : (subInfo ? subInfo.is_access_allowed : true);

        const roleAllowed = ROLE_ALLOWED_ROUTES[userRole] || [];
        const tokenPermissions = isSuperAdmin
            ? ["*"]
            : Array.from(new Set([
                ...uniquePermissions.map((item) => item.menu_url).filter(Boolean),
                ...roleAllowed,
                ...(isPlayer ? [
                    "/next_panel/player-dashboard",
                    "/next_panel/attendance",
                    "/next_panel/fee-status",
                    "/next_panel/player-program-fees",
                    "/next_panel/ground-availability",
                    "/next_panel/ground-bookings",
                    "/next_panel/orders",
                    "/next_panel/my-orders"
                ] : []),
                ...(isUmpire ? [
                    "/next_panel/dashboard",
                    "/next_panel/matches",
                    "/next_panel/match-management",
                    "/next_panel/match-scorecard",
                    "/next_panel/match-players",
                    "/next_panel/match-innings",
                    "/next_panel/match-bowling-scorecard",
                    "/next_panel/ground-bookings",
                    "/next_panel/ground-availability",
                    "/next_panel/umpires"
                ] : []),
            ]));

        const token = jwt.sign(
            {
                id: user.id,
                appointment_no: user.appointment_no,
                academy_id: user.academy_id ? Number(user.academy_id) : null,
                branch_id: user.branch_id ? Number(user.branch_id) : null,
                academy_name: userData.academy_name,
                academy_code: userData.academy_code,
                branch_name: userData.branch_name,
                email: user.email,
                user_type: user.user_type,
                role: userRole,
                umpire_id: userData.umpire_id || null,
                permissions: tokenPermissions,
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
                token,

                user: userData,

                permissions: uniquePermissions,

                session: {
                    user: userData,
                    permissions: uniquePermissions,
                },

                permission_count: uniquePermissions.length,

                // Explicit Section 6 Subscription Response Fields
                academy_status: userData.academy_status,
                subscription_status: userData.subscription_status,
                plan_name: userData.plan_name,
                subscription_start_date: userData.subscription_start_date,
                subscription_end_date: userData.subscription_end_date,
                grace_end_date: userData.grace_end_date,
                grace_days_remaining: userData.grace_days_remaining,
                is_subscription_active: userData.is_subscription_active,
                is_grace_period: userData.is_grace_period,
                is_academy_active: userData.is_academy_active,
                is_read_only: userData.is_read_only,
                show_subscription_alert: userData.show_subscription_alert,
                is_access_allowed: userData.is_access_allowed,
                subscription: subInfo,
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