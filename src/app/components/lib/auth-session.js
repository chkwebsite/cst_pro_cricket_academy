import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import pool from "./db";
import { getUserRole, ROLES, ROLE_ALLOWED_ROUTES } from "./rbac";

const JWT_SECRET = process.env.JWT_SECRET || "cricketAcademy_2026@Admin#Panel$Role%Secure123";

/**
 * Server-side session verification.
 * Checks both Academy User (auth_token) and Public User (public_auth_token) cookies.
 * Returns { user, permissions } or null.
 */
export async function getServerSession() {
    try {
        const cookieStore = await cookies();
        const authToken = cookieStore.get("auth_token")?.value;
        const publicToken = cookieStore.get("public_auth_token")?.value;

        // 1. Academy User Token
        if (authToken) {
            try {
                const decoded = jwt.verify(authToken, JWT_SECRET);
                if (decoded && decoded.id) {
                    try {
                        const [rows] = await pool.query(
                            `SELECT
                                id,
                                appointment_no,
                                academy_id,
                                branch_id,
                                first_name,
                                last_name,
                                email,
                                phone,
                                profile_image,
                                user_type,
                                status,
                                is_deleted
                            FROM cst_users
                            WHERE id = ?
                            LIMIT 1`,
                            [decoded.id]
                        );

                        if (rows && rows.length > 0) {
                            const u = rows[0];
                            if (Number(u.is_deleted) !== 1 && Number(u.status) === 1) {
                                const fullName =
                                    [u.first_name, u.last_name].filter(Boolean).join(" ") ||
                                    u.appointment_no ||
                                    "Academy User";

                                const role = getUserRole(u);
                                const isSuper = role === ROLES.SUPER_ADMIN || (Array.isArray(decoded.permissions) && decoded.permissions.includes("*"));

                                let livePermissions = [];
                                if (isSuper) {
                                    livePermissions = ["*"];
                                } else {
                                    try {
                                        const [permRows] = await pool.query(
                                            `SELECT DISTINCT m.menu_url
                                             FROM cst_user_roles ur
                                             INNER JOIN cst_role_permissions rp ON rp.role_id = ur.role_id
                                             INNER JOIN cst_permissions p ON p.id = rp.permission_id
                                             INNER JOIN cst_menu_permissions mp ON mp.permission_id = p.id
                                             INNER JOIN cst_menu m ON m.id = mp.menu_id
                                             WHERE ur.user_id = ? AND p.status = 1 AND m.is_deleted = 0 AND m.is_active = 1 AND m.status = 1`,
                                            [u.id]
                                        );
                                        const dbUrls = permRows.map((r) => r.menu_url).filter(Boolean);
                                        const standardUrls = ROLE_ALLOWED_ROUTES[role] || [];
                                        livePermissions = Array.from(new Set([...dbUrls, ...standardUrls]));
                                    } catch (pErr) {
                                        console.warn("getServerSession: permission DB lookup failed, falling back to token payload:", pErr?.message);
                                        livePermissions = Array.isArray(decoded.permissions) ? decoded.permissions : (ROLE_ALLOWED_ROUTES[role] || []);
                                    }
                                }

                                return {
                                    user: {
                                        id: u.id,
                                        appointment_no: u.appointment_no,
                                        academy_id: u.academy_id ? Number(u.academy_id) : null,
                                        branch_id: u.branch_id ? Number(u.branch_id) : null,
                                        first_name: u.first_name,
                                        last_name: u.last_name,
                                        name: fullName,
                                        email: u.email,
                                        phone: u.phone,
                                        profile_image: u.profile_image || null,
                                        user_type: u.user_type || "Academy User",
                                        role,
                                        isSuperAdmin: role === ROLES.SUPER_ADMIN,
                                        isAcademyAdmin: role === ROLES.ACADEMY_ADMIN,
                                        isBranchAdmin: role === ROLES.BRANCH_ADMIN,
                                        isAccountant: role === ROLES.ACCOUNTANT,
                                        isCoach: role === ROLES.COACH,
                                        isPlayer: role === ROLES.PLAYER,
                                        is_public: false,
                                    },
                                    permissions: livePermissions.length > 0 ? livePermissions : (Array.isArray(decoded.permissions) ? decoded.permissions : []),
                                };
                            }
                        }
                    } catch (dbErr) {
                        console.warn("getServerSession: cst_users DB lookup failed, falling back to token payload:", dbErr?.message);
                    }

                    // Fallback to verified JWT payload
                    return {
                        user: {
                            id: decoded.id,
                            appointment_no: decoded.appointment_no,
                            first_name: decoded.appointment_no || "Academy",
                            last_name: "User",
                            name: decoded.appointment_no || decoded.email || "Academy User",
                            email: decoded.email,
                            user_type: decoded.user_type || "Academy User",
                            is_public: false,
                        },
                        permissions: Array.isArray(decoded.permissions) ? decoded.permissions : [],
                    };
                }
            } catch (jwtErr) {
                // Invalid or expired authToken
            }
        }

        // 2. Public User Token
        if (publicToken) {
            try {
                const decoded = jwt.verify(publicToken, JWT_SECRET);
                if (decoded && decoded.public_user_id) {
                    try {
                        const [pRows] = await pool.query(
                            `SELECT id, name, email, phone, profile_image, user_type, status, is_deleted
                             FROM cst_public_users
                             WHERE id = ?
                             LIMIT 1`,
                            [decoded.public_user_id]
                        );

                        if (pRows && pRows.length > 0) {
                            const pu = pRows[0];
                            if (Number(pu.is_deleted) !== 1) {
                                return {
                                    user: {
                                        id: pu.id,
                                        name: pu.name,
                                        first_name: pu.name?.split(" ")[0] || pu.name,
                                        last_name: pu.name?.split(" ").slice(1).join(" ") || "",
                                        email: pu.email,
                                        phone: pu.phone,
                                        profile_image: pu.profile_image || null,
                                        user_type: pu.user_type || "Public User",
                                        is_public: true,
                                    },
                                    permissions: ["public_user", "ground_booking"],
                                };
                            }
                        }
                    } catch (dbErr) {
                        console.warn("getServerSession: cst_public_users DB lookup failed, falling back to token payload:", dbErr?.message);
                    }

                    // Fallback to verified JWT payload
                    return {
                        user: {
                            id: decoded.public_user_id,
                            name: decoded.name || "Public User",
                            first_name: (decoded.name || "Public").split(" ")[0],
                            last_name: (decoded.name || "").split(" ").slice(1).join(" "),
                            email: decoded.email || null,
                            phone: decoded.phone || null,
                            user_type: "Public User",
                            is_public: true,
                        },
                        permissions: ["public_user", "ground_booking"],
                    };
                }
            } catch (jwtErr) {
                // Invalid or expired publicToken
            }
        }

        return null;
    } catch (err) {
        if (err?.digest === "DYNAMIC_SERVER_USAGE") {
            throw err;
        }
        console.error("getServerSession error:", err);
        return null;
    }
}
