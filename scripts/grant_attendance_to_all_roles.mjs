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

        // 1. Fetch all permissions
        const [perms] = await connection.query("SELECT id, module_name, permission_name FROM cst_permissions");
        console.log(`Found ${perms.length} permissions in system.`);

        // 2. Menu 63 (Attendance) and Menu 64 (Staff/User Management parent)
        const targetMenuIds = [63, 64];

        for (const menuId of targetMenuIds) {
            for (const p of perms) {
                const [exists] = await connection.query(
                    "SELECT id FROM cst_menu_permissions WHERE menu_id = ? AND permission_id = ?",
                    [menuId, p.id]
                );

                if (exists.length === 0) {
                    await connection.query(
                        "INSERT INTO cst_menu_permissions (menu_id, permission_id) VALUES (?, ?)",
                        [menuId, p.id]
                    );
                    console.log(`Linked Menu ${menuId} to Permission ${p.id} (${p.module_name} - ${p.permission_name})`);
                }
            }
        }

        await connection.commit();
        console.log("Successfully granted Attendance menu permissions to all roles!");
    } catch (err) {
        await connection.rollback();
        console.error("Error linking menu permissions:", err);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

main();
