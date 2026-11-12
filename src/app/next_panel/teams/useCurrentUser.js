"use client";

import { useUser } from "../components/UserContext";

export const ROLES = {
    SUPER: "super_admin",
    ACADEMY: "academy_admin",
    BRANCH: "branch_admin",
};

// Tolerant of "Super Admin", "super-admin", "academy_admin", ...
function normalizeRole(value) {
    const r = String(value || "").toLowerCase();
    if (r.includes("super")) return ROLES.SUPER;
    if (r.includes("academy")) return ROLES.ACADEMY;
    if (r.includes("branch")) return ROLES.BRANCH;
    return null;
}

/*
|--------------------------------------------------------------------------
| Wraps your UserContext so the teams pages only depend on this one shape:
|   { ready, id, role, academyId, branchId }
|--------------------------------------------------------------------------
| useUser() may return the user directly, or { user, loading } - both work.
| If your context exposes the user under another key / role under another
| field name, only this file needs a change.
*/
export default function useCurrentUser() {
    const ctx = useUser();
    const user = ctx && "user" in ctx ? ctx.user : ctx;

    // No loading flag in the context? Treat "no user yet" as still loading.
    const ready = ctx && "loading" in ctx ? !ctx.loading : Boolean(user);

    return {
        ready,
        id: user?.id ?? null,
        role: normalizeRole(user?.role ?? user?.role_name ?? user?.user_role ?? user?.user_type),
        academyId: user?.academy_id ?? null,
        branchId: user?.branch_id ?? null,
    };
}
