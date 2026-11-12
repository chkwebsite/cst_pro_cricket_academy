import pool from "../src/app/components/lib/db.js";

async function main() {
    console.log("=== Registering Attendance Menu in cst_menu ===");
    const connection = await pool.getConnection();

    try {
        // 1. Check if Attendance menu already exists
        const [existing] = await connection.query(
            "SELECT id, menu_key, menu_name, menu_url FROM cst_menu WHERE menu_url = '/next_panel/attendance' OR menu_key = 'attendance'"
        );

        let menuId;
        if (existing.length > 0) {
            menuId = existing[0].id;
            console.log(`Menu already exists with ID: ${menuId}`);
            await connection.query(
                `UPDATE cst_menu 
                 SET menu_key = 'attendance', menu_name = 'Attendance', menu_title = 'Attendance', 
                     menu_url = '/next_panel/attendance', menu_icon = 'calendar-check', 
                     is_sidebar = 1, is_active = 1, status = 1, is_deleted = 0
                 WHERE id = ?`,
                [menuId]
            );
        } else {
            const [insertRes] = await connection.query(
                `INSERT INTO cst_menu (
                    parent_id, menu_key, menu_name, menu_title, menu_icon, menu_url,
                    menu_type, menu_order, is_sidebar, is_active, status, is_deleted, created_at, updated_at
                ) VALUES (
                    NULL, 'attendance', 'Attendance', 'Attendance', 'calendar-check', '/next_panel/attendance',
                    'link', 5, 1, 1, 1, 0, NOW(), NOW()
                )`
            );
            menuId = insertRes.insertId;
            console.log(`Created new Attendance menu with ID: ${menuId}`);
        }

        // 2. Link permissions:
        // Permission 3: super_pawer_all (Super Admin)
        // Permission 8: academy_admin (Academy Admin)
        // Permission 9: branch_admin (Branch Admin)
        const targetPermIds = [3, 8, 9];

        for (const permId of targetPermIds) {
            const [permLink] = await connection.query(
                "SELECT id FROM cst_menu_permissions WHERE menu_id = ? AND permission_id = ?",
                [menuId, permId]
            );
            if (permLink.length === 0) {
                await connection.query(
                    "INSERT INTO cst_menu_permissions (menu_id, permission_id, created_at) VALUES (?, ?, NOW())",
                    [menuId, permId]
                );
                console.log(`Linked menu ${menuId} to permission ${permId}`);
            } else {
                console.log(`Permission ${permId} already linked to menu ${menuId}`);
            }
        }

        console.log("=== Attendance Menu Registered Successfully ===");
        process.exit(0);
    } catch (err) {
        console.error("Failed to register attendance menu:", err);
        process.exit(1);
    } finally {
        if (connection) connection.release();
    }
}

main();
