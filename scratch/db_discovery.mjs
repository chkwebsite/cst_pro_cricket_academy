import fs from "fs";
import mysql from "mysql2/promise";

const envText = fs.readFileSync(".env.local", "utf-8");
const env = {};
for (const line of envText.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx !== -1) {
    const k = trimmed.substring(0, idx).trim();
    const v = trimmed.substring(idx + 1).trim();
    env[k] = v;
  }
}

async function run() {
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  const connection = await pool.getConnection();
  try {
    console.log("=== ALL TABLES IN DATABASE ===");
    const [tables] = await connection.query(`SHOW TABLES`);
    const tableNames = tables.map(t => Object.values(t)[0]);
    console.log(tableNames.join(", "));

    console.log("\n=== CST_ROLES ===");
    const [roles] = await connection.query(`SELECT * FROM cst_roles`);
    console.table(roles);

    console.log("\n=== DISTINCT USER TYPES IN CST_USERS ===");
    const [userTypes] = await connection.query(
      `SELECT user_type, COUNT(*) as count FROM cst_users GROUP BY user_type`
    );
    console.table(userTypes);

    console.log("\n=== USERS SUMMARY PER ROLE/TYPE (Sample of each) ===");
    const [sampleUsers] = await connection.query(
      `SELECT id, appointment_no, first_name, last_name, email, phone, user_type, academy_id, branch_id, status, is_deleted 
       FROM cst_users 
       WHERE is_deleted = 0 
       ORDER BY id ASC LIMIT 25`
    );
    console.table(sampleUsers);

    console.log("\n=== ACADEMIES ===");
    const [academies] = await connection.query(`SELECT id, academy_name, status, is_deleted FROM cst_academy`);
    console.table(academies);

    console.log("\n=== BRANCHES ===");
    const [branches] = await connection.query(`SELECT id, academy_id, branch_name, status, is_deleted FROM cst_branch`);
    console.table(branches);

    console.log("\n=== CST_USER_ROLES MAPPING ===");
    const [userRoles] = await connection.query(
      `SELECT ur.id, ur.user_id, ur.role_id, r.role_name, u.email, u.user_type
       FROM cst_user_roles ur
       JOIN cst_roles r ON r.id = ur.role_id
       JOIN cst_users u ON u.id = ur.user_id
       LIMIT 20`
    );
    console.table(userRoles);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    connection.release();
    await pool.end();
  }
}

run();
