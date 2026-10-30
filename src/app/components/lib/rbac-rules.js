/**
 * Canonical Role Constants and Pure Route Validation
 * Safe for Client Components, Middleware, and Server APIs.
 */

export const ROLES = {
    SUPER_ADMIN: "SUPER_ADMIN",
    ACADEMY_ADMIN: "ACADEMY_ADMIN",
    BRANCH_ADMIN: "BRANCH_ADMIN",
    ACCOUNTANT: "ACCOUNTANT",
    COACH: "COACH",
    PLAYER: "PLAYER",
    GROUND_STAFF: "GROUND_STAFF",
    PUBLIC_USER: "PUBLIC_USER",
};

/**
 * Normalizes user_type string into a canonical role key
 */
export function getUserRole(user) {
    if (!user) return null;
    const raw = String(user.user_type || user.role_name || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

    if (raw.includes("super")) return ROLES.SUPER_ADMIN;
    if (raw.includes("academyadmin") || raw.includes("academy")) return ROLES.ACADEMY_ADMIN;
    if (raw.includes("branchadmin") || raw.includes("branch")) return ROLES.BRANCH_ADMIN;
    if (raw.includes("account") || raw.includes("accountant") || raw.includes("accountent")) return ROLES.ACCOUNTANT;
    if (raw.includes("coach")) return ROLES.COACH;
    if (raw.includes("groundstaff") || raw.includes("staffground")) return ROLES.GROUND_STAFF;
    if (raw.includes("player") || raw === "7" || String(user.user_type) === "7") return ROLES.PLAYER;
    if (raw.includes("public")) return ROLES.PUBLIC_USER;

    return ROLES.SUPER_ADMIN;
}

/**
 * Standard Allowed Routes per Role (Enterprise Best-Practice Standard)
 */
export const ROLE_ALLOWED_ROUTES = {
    [ROLES.SUPER_ADMIN]: ["*"],

    [ROLES.ACADEMY_ADMIN]: [
        "/next_panel/dashboard",
        "/next_panel/branches",
        "/next_panel/age-groups",
        "/next_panel/programs",
        "/next_panel/coaches",
        "/next_panel/staff",
        "/next_panel/batches",
        "/next_panel/batch-coaches",
        "/next_panel/batch-players",
        "/next_panel/admission-players",
        "/next_panel/outside-players",
        "/next_panel/Players",
        "/next_panel/student-enquiries",
        "/next_panel/student-enquiries-flowup",
        "/next_panel/player-attendance",
        "/next_panel/player-program-fees",
        "/next_panel/player-fees-matrix",
        "/next_panel/fee-status",
        "/next_panel/fee-payments",
        "/next_panel/player-payments",
        "/next_panel/grounds",
        "/next_panel/ground-slots",
        "/next_panel/ground-availability",
        "/next_panel/ground-bookings",
        "/next_panel/ground-booking-requests",
        "/next_panel/ground-payments",
        "/next_panel/ground-images",
        "/next_panel/matches",
        "/next_panel/match-types",
        "/next_panel/match-management",
        "/next_panel/match-innings",
        "/next_panel/match-players",
        "/next_panel/match-scorecard",
        "/next_panel/match-bowling-scorecard",
        "/next_panel/tournaments",
        "/next_panel/tournament-management",
        "/next_panel/tournament-matches",
        "/next_panel/tournament-teams",
        "/next_panel/tournament-team-players",
        "/next_panel/teams",
        "/next_panel/team-players",
        "/next_panel/products",
        "/next_panel/product-categories",
        "/next_panel/product-images",
        "/next_panel/product-stock",
        "/next_panel/orders",
        "/next_panel/order-payments",
        "/next_panel/individual-training",
        "/next_panel/gallery-categories",
        "/next_panel/gallery-albums",
        "/next_panel/gallery-images",
        "/next_panel/gallery-videos",
        "/next_panel/gallery-management",
        "/next_panel/public-users",
        "/next_panel/password-resets",
        "/next_panel/Settings",
    ],

    [ROLES.BRANCH_ADMIN]: [
        "/next_panel/dashboard",
        "/next_panel/age-groups",
        "/next_panel/programs",
        "/next_panel/coaches",
        "/next_panel/staff",
        "/next_panel/batches",
        "/next_panel/batch-coaches",
        "/next_panel/batch-players",
        "/next_panel/admission-players",
        "/next_panel/outside-players",
        "/next_panel/Players",
        "/next_panel/student-enquiries",
        "/next_panel/student-enquiries-flowup",
        "/next_panel/player-attendance",
        "/next_panel/player-program-fees",
        "/next_panel/player-fees-matrix",
        "/next_panel/fee-status",
        "/next_panel/fee-payments",
        "/next_panel/player-payments",
        "/next_panel/grounds",
        "/next_panel/ground-slots",
        "/next_panel/ground-availability",
        "/next_panel/ground-bookings",
        "/next_panel/ground-booking-requests",
        "/next_panel/ground-payments",
        "/next_panel/ground-images",
        "/next_panel/matches",
        "/next_panel/match-types",
        "/next_panel/match-management",
        "/next_panel/match-innings",
        "/next_panel/match-players",
        "/next_panel/match-scorecard",
        "/next_panel/match-bowling-scorecard",
        "/next_panel/tournaments",
        "/next_panel/tournament-management",
        "/next_panel/tournament-matches",
        "/next_panel/tournament-teams",
        "/next_panel/tournament-team-players",
        "/next_panel/teams",
        "/next_panel/team-players",
        "/next_panel/products",
        "/next_panel/product-categories",
        "/next_panel/product-images",
        "/next_panel/product-stock",
        "/next_panel/orders",
        "/next_panel/order-payments",
        "/next_panel/individual-training",
        "/next_panel/gallery-categories",
        "/next_panel/gallery-albums",
        "/next_panel/gallery-images",
        "/next_panel/gallery-videos",
        "/next_panel/gallery-management",
        "/next_panel/public-users",
        "/next_panel/password-resets",
        "/next_panel/Settings",
    ],

    [ROLES.ACCOUNTANT]: [
        "/next_panel/dashboard",
        "/next_panel/fee-status",
        "/next_panel/fee-payments",
        "/next_panel/player-attendance",
        "/next_panel/player-program-fees",
        "/next_panel/player-payments",
        "/next_panel/player-fees-matrix",
        "/next_panel/ground-payments",
        "/next_panel/orders",
        "/next_panel/order-payments",
    ],

    [ROLES.COACH]: [
        "/next_panel/dashboard",
        "/next_panel/batches",
        "/next_panel/batch-players",
        "/next_panel/player-attendance",
        "/next_panel/player-program-fees",
        "/next_panel/fee-status",
    ],

    [ROLES.PLAYER]: [
        "/next_panel/player-dashboard",
        "/next_panel/dashboard",
        "/next_panel/my-orders",
        "/next_panel/orders",
    ],

    [ROLES.GROUND_STAFF]: [
        "/next_panel/dashboard",
        "/next_panel/grounds",
        "/next_panel/ground-slots",
        "/next_panel/ground-availability",
        "/next_panel/ground-bookings",
    ],
};

/**
 * Checks whether a pathname is permitted for a role
 */
export function isRoutePermittedForRole(roleKey, pathname) {
    if (!roleKey) return false;
    const allowed = ROLE_ALLOWED_ROUTES[roleKey];
    if (!allowed) return false;
    if (allowed.includes("*")) return true;

    const normalized = pathname.toLowerCase().replace(/\/$/, "");

    return allowed.some((route) => {
        const normRoute = route.toLowerCase().replace(/\/$/, "");
        return normalized === normRoute || normalized.startsWith(normRoute + "/");
    });
}
