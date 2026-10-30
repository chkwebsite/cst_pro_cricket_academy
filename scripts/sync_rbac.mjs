import mysql from "mysql2/promise";

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
});

async function main() {
    console.log("=== STARTING RBAC DATABASE SYNC ===");

    // 1. Ensure Permissions Exist
    const permissionsToEnsure = [
        { module: "Super Power", name: "super_pawer_all" },
        { module: "Academy Admin", name: "academy_admin" },
        { module: "Branch Admin", name: "branch_admin" },
        { module: "Accountant", name: "accountant" },
        { module: "Coach", name: "coach" },
        { module: "Player Dashboard", name: "view_player_dashboard" },
        { module: "Ground Staff", name: "ground_staff" },
    ];

    const permMap = new Map();

    for (const p of permissionsToEnsure) {
        const [existing] = await pool.query(
            "SELECT id FROM cst_permissions WHERE permission_name = ? LIMIT 1",
            [p.name]
        );
        if (existing.length > 0) {
            permMap.set(p.name, existing[0].id);
        } else {
            const [res] = await pool.query(
                "INSERT INTO cst_permissions (module_name, permission_name, status, created_at, updated_at) VALUES (?, ?, 1, NOW(), NOW())",
                [p.module, p.name]
            );
            permMap.set(p.name, res.insertId);
            console.log(`Inserted permission: ${p.name} (id: ${res.insertId})`);
        }
    }

    console.log("Permissions Map:", Object.fromEntries(permMap.entries()));

    // 2. Fetch all active menus
    const [menus] = await pool.query(
        "SELECT id, menu_key, menu_name, menu_url, parent_id FROM cst_menu WHERE is_deleted = 0"
    );

    // Helpers to find menu IDs
    const findMenuIdsByUrls = (urls) => {
        return menus
            .filter((m) => {
                if (!m.menu_url) return false;
                const norm = m.menu_url.startsWith("/") ? m.menu_url : `/${m.menu_url}`;
                return urls.some((u) => norm === u || norm === `/next_panel${u}` || norm.endsWith(u));
            })
            .map((m) => m.id);
    };

    // System menu IDs that should be SUPER ADMIN ONLY
    const systemMenuKeys = ["Menus", "Menu", "Menu-p", "Permissions", "Roles", "User roles", "Permissions_in", "Academies"];
    const systemMenuIds = new Set(menus.filter(m => systemMenuKeys.includes(m.menu_key) || systemMenuKeys.includes(m.menu_name)).map(m => m.id));
    // Also include submenus of parent id 3 (Menu) and parent id 10 (Permissions)
    menus.forEach(m => {
        if ([3, 10].includes(m.parent_id)) systemMenuIds.add(m.id);
        if (m.menu_url && (m.menu_url.includes("/menu") || m.menu_url.includes("/permissions") || m.menu_url.includes("/academies"))) {
            systemMenuIds.add(m.id);
        }
    });

    // Operational Menus for Academy Admin: all menus EXCEPT systemMenuIds
    const academyAdminMenuIds = menus
        .filter(m => !systemMenuIds.has(m.id) && m.id !== 61) // exclude player dashboard
        .map(m => m.id);

    // Operational Menus for Branch Admin: all operational menus EXCEPT academies and branches master
    const branchAdminMenuIds = menus
        .filter(m => !systemMenuIds.has(m.id) && m.id !== 61 && m.id !== 7 && m.menu_key !== "Branches" && m.menu_key !== "Academies")
        .map(m => m.id);

    // Accountant Menus: Accounts, Fee status, Payments, Matrix, Orders, Attendance
    const accountantUrls = [
        "/fee-status",
        "/fee-payments",
        "/player-attendance",
        "/player-program-fees",
        "/player-payments",
        "/player-fees-matrix",
        "/ground-payments",
        "/orders",
        "/order-payments",
    ];
    const accountantMenuIds = Array.from(new Set([
        34, // parent Accounts menu
        54, // Product Master parent
        ...findMenuIdsByUrls(accountantUrls),
    ]));

    // Coach Menus: Batches, Batch Players, Player Attendance, Fee Status
    const coachUrls = [
        "/batches",
        "/batch-players",
        "/player-attendance",
        "/fee-status",
        "/player-program-fees",
    ];
    const coachMenuIds = Array.from(new Set([
        5, // Masters parent menu
        34, // Accounts parent menu
        ...findMenuIdsByUrls(coachUrls),
    ]));

    // 3. Link Menus to Permissions in cst_menu_permissions
    async function syncMenuPerms(permId, menuIds) {
        // Clear existing
        await pool.query("DELETE FROM cst_menu_permissions WHERE permission_id = ?", [permId]);
        for (const mid of menuIds) {
            await pool.query(
                "INSERT INTO cst_menu_permissions (menu_id, permission_id, created_at) VALUES (?, ?, NOW())",
                [mid, permId]
            );
        }
    }

    const acadAdminPermId = permMap.get("academy_admin");
    const branchAdminPermId = permMap.get("branch_admin");
    const accountantPermId = permMap.get("accountant");
    const coachPermId = permMap.get("coach");

    console.log(`Syncing Academy Admin menus (${academyAdminMenuIds.length} menus)...`);
    await syncMenuPerms(acadAdminPermId, academyAdminMenuIds);

    console.log(`Syncing Branch Admin menus (${branchAdminMenuIds.length} menus)...`);
    await syncMenuPerms(branchAdminPermId, branchAdminMenuIds);

    console.log(`Syncing Accountant menus (${accountantMenuIds.length} menus)...`);
    await syncMenuPerms(accountantPermId, accountantMenuIds);

    console.log(`Syncing Coach menus (${coachMenuIds.length} menus)...`);
    await syncMenuPerms(coachPermId, coachMenuIds);

    // 4. Link Roles to Permissions in cst_role_permissions
    // cst_roles:
    // 1: Super Admin -> super_pawer_all (3)
    // 2: Academy Admin(CST) -> academy_admin (acadAdminPermId)
    // 3: Branch Admin(CST) -> branch_admin (branchAdminPermId)
    // 4: Accountent(CST) -> accountant (accountantPermId)
    // 5: Coach(CST) -> coach (coachPermId)
    // 6: Academy Admin(SM) -> academy_admin (acadAdminPermId)
    const roleMappings = [
        { roleId: 1, permId: permMap.get("super_pawer_all") },
        { roleId: 2, permId: acadAdminPermId },
        { roleId: 3, permId: branchAdminPermId },
        { roleId: 4, permId: accountantPermId },
        { roleId: 5, permId: coachPermId },
        { roleId: 6, permId: acadAdminPermId },
    ];

    for (const rm of roleMappings) {
        const [existing] = await pool.query(
            "SELECT id FROM cst_role_permissions WHERE role_id = ? AND permission_id = ?",
            [rm.roleId, rm.permId]
        );
        if (existing.length === 0) {
            await pool.query(
                "INSERT INTO cst_role_permissions (role_id, permission_id, created_at) VALUES (?, ?, NOW())",
                [rm.roleId, rm.permId]
            );
            console.log(`Linked Role ${rm.roleId} to Permission ${rm.permId}`);
        }
    }

    // 5. Ensure user roles in cst_user_roles
    // Ensure Deepak (user 7, Coach) is linked to Role 5
    const [coachUserRole] = await pool.query(
        "SELECT id FROM cst_user_roles WHERE user_id = 7 AND role_id = 5"
    );
    if (coachUserRole.length === 0) {
        await pool.query(
            "INSERT INTO cst_user_roles (user_id, role_id, created_at) VALUES (7, 5, NOW())"
        );
        console.log("Assigned user 7 to Role 5 (Coach)");
    }

    // Ensure Chandan (user 5, Academy Admin) is linked to Role 2
    const [acadUserRole] = await pool.query(
        "SELECT id FROM cst_user_roles WHERE user_id = 5 AND role_id = 2"
    );
    if (acadUserRole.length === 0) {
        await pool.query(
            "INSERT INTO cst_user_roles (user_id, role_id, created_at) VALUES (5, 2, NOW())"
        );
        console.log("Assigned user 5 to Role 2 (Academy Admin)");
    }

    // Ensure Rajneesh (user 8, Branch Admin) is linked to Role 3
    const [branchUserRole] = await pool.query(
        "SELECT id FROM cst_user_roles WHERE user_id = 8 AND role_id = 3"
    );
    if (branchUserRole.length === 0) {
        await pool.query(
            "INSERT INTO cst_user_roles (user_id, role_id, created_at) VALUES (8, 3, NOW())"
        );
        console.log("Assigned user 8 to Role 3 (Branch Admin)");
    }

    console.log("=== RBAC SYNC COMPLETED SUCCESSFULLY ===");
    await pool.end();
}

main().catch(console.error);
