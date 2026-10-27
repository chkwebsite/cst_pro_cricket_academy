// Thin fetch wrappers around the existing API routes.
//
// IMPORTANT: if these 404 in your project, your routes probably live under
// a different prefix (e.g. /api/admin/menu instead of /api/menu). Update
// API_BASE below — every function in this file uses it, so one edit fixes
// every call.
const API_BASE = "/api";
// Routes used (relative to API_BASE):
//   /menu                    (list, create)
//   /menu/[id]               (get, update, soft-delete)
//   /menu-permissions        (list, create)
//   /menu-permissions/[id]   (get, update, delete)
//   /permissions             (assumed to exist alongside cst_permissions,
//                              same { success, data } shape as /menu)
//
// Every function throws an Error with a human-readable message on failure,
// so callers can catch once and show it in the UI.

async function request(url, options) {
    let response;

    try {
        response = await fetch(url, {
            headers: { "Content-Type": "application/json" },
            ...options,
        });
    } catch (networkError) {
        throw new Error("Network error — could not reach the server");
    }

    let payload = null;

    try {
        payload = await response.json();
    } catch {
        // no JSON body
    }

    if (!response.ok || (payload && payload.success === false)) {
        const message =
            payload?.message ||
            payload?.error ||
            `Request failed (${response.status})`;
        throw new Error(message);
    }

    return payload;
}

// ---------- Menus ----------

export function listMenus(params = {}) {
    const query = new URLSearchParams({
        limit: "100",
        is_deleted: "0",
        ...params,
    }).toString();

    return request(`${API_BASE}/menu?${query}`);
}

export function getMenu(id) {
    return request(`${API_BASE}/menu/${id}`);
}

export function createMenu(data) {
    return request(`${API_BASE}/menu`, {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export function updateMenu(id, data) {
    return request(`${API_BASE}/menu/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
    });
}

export function deleteMenu(id) {
    return request(`${API_BASE}/menu/${id}`, {
        method: "DELETE",
    });
}

// ---------- Menu <-> Permission links ----------

export function listMenuPermissions(menuId) {
    const query = new URLSearchParams({
        menu_id: menuId,
        limit: "100",
    }).toString();

    return request(`${API_BASE}/menu-permissions?${query}`);
}

export function createMenuPermission(data) {
    return request(`${API_BASE}/menu-permissions`, {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export function deleteMenuPermission(id) {
    return request(`${API_BASE}/menu-permissions/${id}`, {
        method: "DELETE",
    });
}

// ---------- Permissions catalog ----------
// cst_permissions columns: id, module_name, permission_name, status
// (confirmed from /api/permissions — there is no permission_key column).

export function listPermissions() {
    const query = new URLSearchParams({ limit: "100" }).toString();
    return request(`${API_BASE}/permissions?${query}`);
}
