import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const PANEL_PREFIX = "/next_panel";
const LOGIN_PATH = "/login";
const NO_PERMISSION_PATH = `${PANEL_PREFIX}/no-permission`;

const MANAGEMENT_MODULES = {
    [`${PANEL_PREFIX}/match-management`]: [
        `${PANEL_PREFIX}/matches`,
        `${PANEL_PREFIX}/teams`,
        `${PANEL_PREFIX}/team-players`,
        `${PANEL_PREFIX}/match-players`,
    ],
    [`${PANEL_PREFIX}/tournament-management`]: [
        `${PANEL_PREFIX}/tournaments`,
        `${PANEL_PREFIX}/tournament-teams`,
        `${PANEL_PREFIX}/tournament-team-players`,
        `${PANEL_PREFIX}/tournament-matches`,
    ],
};

// Rate limiter for authentication and password reset endpoints
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_AUTH_ATTEMPTS = 20;

function isRateLimited(ip, endpoint) {
    const key = `${ip}:${endpoint}`;
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return false;
    }

    entry.count += 1;
    return entry.count > MAX_AUTH_ATTEMPTS;
}

if (typeof setInterval !== "undefined") {
    setInterval(() => {
        const now = Date.now();
        for (const [key, val] of rateLimitMap.entries()) {
            if (now > val.resetAt) {
                rateLimitMap.delete(key);
            }
        }
    }, 5 * 60 * 1000).unref?.();
}

function applySecurityHeaders(response) {
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
    response.headers.set("X-XSS-Protection", "1; mode=block");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    return response;
}

function normalizeMenuPath(value) {
    if (typeof value !== "string" || !value.trim()) return null;

    let path = value.trim().startsWith("/") ? value.trim() : `/${value.trim()}`;
    path = path.length > 1 ? path.replace(/\/+$/, "") : path;

    if (path === PANEL_PREFIX || path.startsWith(`${PANEL_PREFIX}/`)) return path;
    return `${PANEL_PREFIX}${path}`;
}

function matchesMenuPath(pathname, menuPath) {
    return pathname === menuPath || pathname.startsWith(`${menuPath}/`);
}

function hasPagePermission(pathname, permissions) {
    if (permissions.includes("*")) return true;
    const requiredPaths = MANAGEMENT_MODULES[pathname] || [pathname];

    return permissions.some((permission) => {
        const rawUrl = typeof permission === "string" ? permission : permission?.menu_url;
        const menuPath = normalizeMenuPath(rawUrl);
        return menuPath && requiredPaths.some((requiredPath) => matchesMenuPath(requiredPath, menuPath));
    });
}

// Strictly Admin-Only APIs: ANY method (GET, POST, PUT, DELETE) requires valid admin auth
const ADMIN_ONLY_APIS = [
    "/api/users",
    "/api/roles",
    "/api/permissions",
    "/api/role-permissions",
    "/api/menu",
    "/api/menu-permissions",
    "/api/user-roles",
    "/api/user-branches",
    "/api/user-programs",
    "/api/fee-payments",
    "/api/fee-status",
    "/api/player-payments",
    "/api/ground-payments",
    "/api/order-payments",
    "/api/player-program-fees",
    "/api/player-dashboard",
    "/api/password-resets",
    "/api/admission-players",
    "/api/outside-players",
    "/api/staff",
    "/api/student-enquiries-flowup",
];

// Resource APIs where GET is public/viewable, but modifications (POST, PUT, PATCH, DELETE) require admin auth
const PROTECTED_MUTATIONS = [
    "/api/matches",
    "/api/match-innings",
    "/api/match-players",
    "/api/match-scorecard",
    "/api/match-bowling-scorecard",
    "/api/tournaments",
    "/api/tournament-matches",
    "/api/tournament-teams",
    "/api/tournament-team-players",
    "/api/products",
    "/api/product-categories",
    "/api/product-images",
    "/api/product-stock",
    "/api/gallery-albums",
    "/api/gallery-categories",
    "/api/gallery-images",
    "/api/gallery-videos",
    "/api/academies",
    "/api/branch",
    "/api/ground",
    "/api/ground-slots",
    "/api/coaches",
    "/api/programs",
    "/api/age-groups",
    "/api/teams",
    "/api/team-players",
    "/api/batches",
    "/api/batch-coaches",
    "/api/batch-players",
    "/api/player-attendance",
    "/api/public-users",
];

export function proxy(request) {
    const { pathname } = request.nextUrl;
    const method = request.method.toUpperCase();
    const isPanelRequest = pathname === PANEL_PREFIX || pathname.startsWith(`${PANEL_PREFIX}/`);
    const isApiRequest = pathname.startsWith("/api");

    // Extract auth token from cookie or Bearer authorization header
    const token =
        request.cookies.get("auth_token")?.value ||
        (request.headers.get("authorization")?.toLowerCase().startsWith("bearer ")
            ? request.headers.get("authorization").slice(7).trim()
            : null);

    let payload = null;
    if (token) {
        try {
            payload = jwt.verify(
                token,
                process.env.JWT_SECRET || "cricketAcademy_2026@Admin#Panel$Role%Secure123"
            );
        } catch {
            payload = null;
        }
    }

    // =========================================================
    // 1. API SECURITY LAYER
    // =========================================================
    if (isApiRequest) {
        // A. Rate Limiting on authentication & password reset endpoints
        if (
            pathname.startsWith("/api/auth/login") ||
            pathname.startsWith("/api/public-auth/login") ||
            pathname.startsWith("/api/auth/forgot-password")
        ) {
            const forwarded = request.headers.get("x-forwarded-for");
            const ip = (forwarded ? forwarded.split(",")[0].trim() : null) || request.headers.get("x-real-ip") || "127.0.0.1";
            if (isRateLimited(ip, pathname)) {
                return applySecurityHeaders(
                    NextResponse.json(
                        {
                            success: false,
                            message: "Too many attempts. Please slow down and try again in 1 minute.",
                        },
                        { status: 429 }
                    )
                );
            }
        }

        // B. Strictly Admin-Only APIs (GET, POST, PUT, DELETE)
        const isAdminOnly = ADMIN_ONLY_APIS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
        if (isAdminOnly) {
            if (!payload) {
                return applySecurityHeaders(
                    NextResponse.json(
                        {
                            success: false,
                            message: "Unauthorized. Administrator authentication required.",
                        },
                        { status: 401 }
                    )
                );
            }
        }

        // C. Protected Resource Mutations (POST, PUT, PATCH, DELETE)
        const isProtectedMutation = PROTECTED_MUTATIONS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
        if (isProtectedMutation && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
            if (!payload) {
                return applySecurityHeaders(
                    NextResponse.json(
                        {
                            success: false,
                            message: "Unauthorized. Authentication required to modify resources.",
                        },
                        { status: 401 }
                    )
                );
            }
        }

        const res = NextResponse.next();
        return applySecurityHeaders(res);
    }

    // =========================================================
    // 2. ADMIN PANEL UI ROUTE PROTECTION (/next_panel)
    // =========================================================
    if (!token || !payload) {
        if (isPanelRequest) {
            const redirectUrl = new URL(`${LOGIN_PATH}?redirect=${encodeURIComponent(pathname)}`, request.url);
            const redirectRes = NextResponse.redirect(redirectUrl);
            if (token && !payload) {
                redirectRes.cookies.delete("auth_token");
            }
            return applySecurityHeaders(redirectRes);
        }

        const res = NextResponse.next();
        return applySecurityHeaders(res);
    }

    if (pathname === LOGIN_PATH) {
        return applySecurityHeaders(NextResponse.redirect(new URL(`${PANEL_PREFIX}/dashboard`, request.url)));
    }

    if (
        isPanelRequest &&
        pathname !== `${PANEL_PREFIX}/dashboard` &&
        pathname !== NO_PERMISSION_PATH
    ) {
        const userType = String(payload?.user_type || payload?.role || "").toLowerCase().replace(/[^a-z0-9]/g, "");

        // Super Admin
        if (userType.includes("super")) {
            return applySecurityHeaders(NextResponse.next());
        }

        // Academy Admin
        if (userType.includes("academyadmin") || userType.includes("academy")) {
            const forbiddenForAcademyAdmin = [
                `${PANEL_PREFIX}/menu`,
                `${PANEL_PREFIX}/menu-permissions`,
                `${PANEL_PREFIX}/menu-management`,
                `${PANEL_PREFIX}/permissions`,
                `${PANEL_PREFIX}/roles`,
                `${PANEL_PREFIX}/role-permissions`,
                `${PANEL_PREFIX}/user-roles`,
                `${PANEL_PREFIX}/academies`,
            ];
            const isForbidden = forbiddenForAcademyAdmin.some((f) => matchesMenuPath(pathname, f));
            if (isForbidden) {
                return applySecurityHeaders(NextResponse.redirect(new URL(NO_PERMISSION_PATH, request.url)));
            }
            return applySecurityHeaders(NextResponse.next());
        }

        // Branch Admin
        if (userType.includes("branchadmin") || userType.includes("branch")) {
            const forbiddenForBranchAdmin = [
                `${PANEL_PREFIX}/academies`,
                `${PANEL_PREFIX}/branches`,
                `${PANEL_PREFIX}/menu`,
                `${PANEL_PREFIX}/menu-permissions`,
                `${PANEL_PREFIX}/menu-management`,
                `${PANEL_PREFIX}/permissions`,
                `${PANEL_PREFIX}/roles`,
                `${PANEL_PREFIX}/role-permissions`,
                `${PANEL_PREFIX}/user-roles`,
            ];
            const isForbidden = forbiddenForBranchAdmin.some((f) => matchesMenuPath(pathname, f));
            if (isForbidden) {
                return applySecurityHeaders(NextResponse.redirect(new URL(NO_PERMISSION_PATH, request.url)));
            }
            return applySecurityHeaders(NextResponse.next());
        }

        // Accountant
        if (userType.includes("account")) {
            const allowedForAccountant = [
                `${PANEL_PREFIX}/dashboard`,
                `${PANEL_PREFIX}/fee-status`,
                `${PANEL_PREFIX}/fee-payments`,
                `${PANEL_PREFIX}/player-attendance`,
                `${PANEL_PREFIX}/player-program-fees`,
                `${PANEL_PREFIX}/player-payments`,
                `${PANEL_PREFIX}/player-fees-matrix`,
                `${PANEL_PREFIX}/ground-payments`,
                `${PANEL_PREFIX}/orders`,
                `${PANEL_PREFIX}/order-payments`,
            ];
            const isAllowed = allowedForAccountant.some((a) => matchesMenuPath(pathname, a));
            if (!isAllowed) {
                return applySecurityHeaders(NextResponse.redirect(new URL(NO_PERMISSION_PATH, request.url)));
            }
            return applySecurityHeaders(NextResponse.next());
        }

        // Coach
        if (userType.includes("coach")) {
            const allowedForCoach = [
                `${PANEL_PREFIX}/dashboard`,
                `${PANEL_PREFIX}/batches`,
                `${PANEL_PREFIX}/batch-players`,
                `${PANEL_PREFIX}/player-attendance`,
                `${PANEL_PREFIX}/fee-status`,
                `${PANEL_PREFIX}/player-program-fees`,
            ];
            const isAllowed = allowedForCoach.some((a) => matchesMenuPath(pathname, a));
            if (!isAllowed) {
                return applySecurityHeaders(NextResponse.redirect(new URL(NO_PERMISSION_PATH, request.url)));
            }
            return applySecurityHeaders(NextResponse.next());
        }

        // Other roles
        const permissions = Array.isArray(payload?.permissions) ? payload.permissions : [];
        if (!hasPagePermission(pathname, permissions)) {
            return applySecurityHeaders(NextResponse.redirect(new URL(NO_PERMISSION_PATH, request.url)));
        }
    }

    const finalRes = NextResponse.next();
    return applySecurityHeaders(finalRes);
}

export const config = {
    matcher: ["/login", "/next_panel/:path*", "/api/:path*"],
};
