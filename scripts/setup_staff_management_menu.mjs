import mysql from 'mysql2/promise';

async function main() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: Number(process.env.DB_PORT || 3306),
        ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === 'REQUIRED' ? { rejectUnauthorized: false } : undefined,
    });

    console.log("Connected to MySQL database.");

    try {
        await connection.beginTransaction();

        // 1. Check or Insert Staff/User Management parent menu
        const [existingParents] = await connection.query(
            "SELECT id FROM cst_menu WHERE menu_key = 'staff-user-management' OR menu_title = 'Staff/User Management' LIMIT 1"
        );

        let parentMenuId;
        if (existingParents.length > 0) {
            parentMenuId = existingParents[0].id;
            console.log(`Found existing Staff/User Management menu (ID: ${parentMenuId})`);
            await connection.query(
                "UPDATE cst_menu SET menu_name = 'Staff/User Management', menu_title = 'Staff/User Management', menu_key = 'staff-user-management', menu_type = 'module', menu_order = 4, menu_icon = 'users', parent_id = NULL, status = 1, is_sidebar = 1, is_active = 1 WHERE id = ?",
                [parentMenuId]
            );
        } else {
            const [insertRes] = await connection.query(
                "INSERT INTO cst_menu (parent_id, menu_key, menu_name, menu_title, menu_url, menu_order, menu_type, menu_icon, status, is_sidebar, is_active) VALUES (NULL, 'staff-user-management', 'Staff/User Management', 'Staff/User Management', NULL, 4, 'module', 'users', 1, 1, 1)"
            );
            parentMenuId = insertRes.insertId;
            console.log(`Created Staff/User Management menu (ID: ${parentMenuId})`);
        }

        // 2. Update Attendance (menu id 63 or by key 'attendance') to be a child under Staff/User Management
        const [attMenus] = await connection.query(
            "SELECT id FROM cst_menu WHERE id = 63 OR menu_url = '/next_panel/attendance' LIMIT 1"
        );
        let attendanceMenuId = attMenus[0]?.id || 63;
        await connection.query(
            "UPDATE cst_menu SET parent_id = ?, menu_name = 'Attendance', menu_title = 'Attendance', menu_url = '/next_panel/attendance', menu_key = 'attendance', menu_order = 1, menu_type = 'link', menu_icon = 'calendar-check', status = 1, is_sidebar = 1, is_active = 1 WHERE id = ?",
            [parentMenuId, attendanceMenuId]
        );
        console.log(`Updated Attendance menu (ID: ${attendanceMenuId}) parent_id -> ${parentMenuId}`);

        // 3. Check or Insert User Weekly Off child menu
        const [existingWeeklyOff] = await connection.query(
            "SELECT id FROM cst_menu WHERE menu_key = 'user-weekly-off' OR menu_url = '/next_panel/user-weekly-off' LIMIT 1"
        );
        let weeklyOffMenuId;
        if (existingWeeklyOff.length > 0) {
            weeklyOffMenuId = existingWeeklyOff[0].id;
            await connection.query(
                "UPDATE cst_menu SET parent_id = ?, menu_name = 'User Weekly Off', menu_title = 'User Weekly Off', menu_url = '/next_panel/user-weekly-off', menu_key = 'user-weekly-off', menu_order = 2, menu_type = 'link', menu_icon = 'calendar', status = 1, is_sidebar = 1, is_active = 1 WHERE id = ?",
                [parentMenuId, weeklyOffMenuId]
            );
            console.log(`Updated User Weekly Off menu (ID: ${weeklyOffMenuId}) parent_id -> ${parentMenuId}`);
        } else {
            const [wRes] = await connection.query(
                "INSERT INTO cst_menu (parent_id, menu_key, menu_name, menu_title, menu_url, menu_order, menu_type, menu_icon, status, is_sidebar, is_active) VALUES (?, 'user-weekly-off', 'User Weekly Off', 'User Weekly Off', '/next_panel/user-weekly-off', 2, 'link', 'calendar', 1, 1, 1)",
                [parentMenuId]
            );
            weeklyOffMenuId = wRes.insertId;
            console.log(`Created User Weekly Off menu (ID: ${weeklyOffMenuId}) under parent ${parentMenuId}`);
        }

        // 4. Permissions: 3 (Super Power / Super Admin), 8 (Academy Admin), 9 (Branch Admin)
        const rolePermissions = [3, 8, 9];
        const menuIdsToLink = [parentMenuId, attendanceMenuId, weeklyOffMenuId];

        for (const menuId of menuIdsToLink) {
            for (const permId of rolePermissions) {
                const [exists] = await connection.query(
                    "SELECT id FROM cst_menu_permissions WHERE menu_id = ? AND permission_id = ?",
                    [menuId, permId]
                );
                if (exists.length === 0) {
                    await connection.query(
                        "INSERT INTO cst_menu_permissions (menu_id, permission_id) VALUES (?, ?)",
                        [menuId, permId]
                    );
                    console.log(`Granted permission ${permId} to menu ${menuId}`);
                }
            }
        }

        await connection.commit();
        console.log("Successfully setup Staff/User Management menu hierarchy and permissions!");
    } catch (err) {
        await connection.rollback();
        console.error("Failed to setup menu:", err);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

main();
