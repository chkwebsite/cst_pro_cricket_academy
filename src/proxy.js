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

export function proxy(request) {
    const token = request.cookies.get("auth_token")?.value;
    const { pathname } = request.nextUrl;
    const isPanelRequest = pathname === PANEL_PREFIX || pathname.startsWith(`${PANEL_PREFIX}/`);

    if (!token) {
        if (isPanelRequest) {
            return NextResponse.redirect(new URL(`${LOGIN_PATH}?redirect=${encodeURIComponent(pathname)}`, request.url));
        }

        return NextResponse.next();
    }

    let payload;

    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        const response = isPanelRequest
            ? NextResponse.redirect(new URL(`${LOGIN_PATH}?redirect=${encodeURIComponent(pathname)}`, request.url))
            : NextResponse.next();

        response.cookies.delete("auth_token");
        return response;
    }

    if (pathname === LOGIN_PATH) {
        return NextResponse.redirect(new URL(`${PANEL_PREFIX}/dashboard`, request.url));
    }

    if (
        isPanelRequest &&
        pathname !== `${PANEL_PREFIX}/dashboard` &&
        pathname !== NO_PERMISSION_PATH
    ) {
        const userType = String(payload?.user_type || payload?.role || "").toLowerCase().replace(/[^a-z0-9]/g, "");

        // 1. Super Admin: full access to all panel modules
        if (userType.includes("super")) {
            return NextResponse.next();
        }

        // 2. Academy Admin: full operational access EXCEPT system menus and external academy master
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
                return NextResponse.redirect(new URL(NO_PERMISSION_PATH, request.url));
            }
            return NextResponse.next();
        }

        // 3. Branch Admin: branch operational access, strictly no global/academy masters or system menus
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
                return NextResponse.redirect(new URL(NO_PERMISSION_PATH, request.url));
            }
            return NextResponse.next();
        }

        // 4. Accountant: ONLY accounts and finance modules
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
                return NextResponse.redirect(new URL(NO_PERMISSION_PATH, request.url));
            }
            return NextResponse.next();
        }

        // 5. Coach: ONLY batches, batch-players, attendance, and fee status
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
                return NextResponse.redirect(new URL(NO_PERMISSION_PATH, request.url));
            }
            return NextResponse.next();
        }

        // 6. Other roles: check against token permissions
        const permissions = Array.isArray(payload?.permissions) ? payload.permissions : [];

        if (!hasPagePermission(pathname, permissions)) {
            return NextResponse.redirect(new URL(NO_PERMISSION_PATH, request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/login", "/next_panel/:path*"],
};
