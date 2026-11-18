import pool from "../src/app/components/lib/db.js";

async function run() {
  try {
    const [rows] = await pool.query(
      "SELECT id, menu_key, menu_name, menu_title, menu_icon, menu_url, menu_order FROM cst_menu WHERE parent_id IS NULL AND is_deleted = 0 ORDER BY menu_order ASC"
    );
    console.log("Top-level menus:", rows);

    const [rolePerms] = await pool.query("SELECT * FROM cst_permissions LIMIT 10");
    console.log("Permissions sample:", rolePerms);

    const [roles] = await pool.query("SELECT * FROM cst_roles");
    console.log("Roles:", roles);
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    await pool.end();
  }
}

run();
