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
        // Allow Super Admin full bypass to all modules
        const userType = String(payload?.user_type || "").toLowerCase().trim();
        if (userType === "super admin" || userType === "superadmin") {
            return NextResponse.next();
        }

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