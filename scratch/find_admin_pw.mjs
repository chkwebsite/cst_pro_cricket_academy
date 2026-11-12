import fs from "fs";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

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

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT password FROM cst_users WHERE id = 6`
    );
    const hash = rows[0].password;
    console.log("Full hash:", hash);

    const tests = [
      "123456",
      "admin@123",
      "Admin@123",
      "password123",
      "Password@123",
      "SuperAdmin@123",
      "superadmin@123",
      "cst@123",
      "Cst@123",
      "CST@123",
      "root@123",
      "12345",
      "1234",
      "secret",
      "cstcricket",
      "cstpro",
      "cricket@123",
      "Cricket@123"
    ];
    for (const t of tests) {
      if (await bcrypt.compare(t, hash)) {
        console.log(`MATCH FOUND: "${t}"`);
        break;
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    conn.release();
    await pool.end();
  }
}

run();
