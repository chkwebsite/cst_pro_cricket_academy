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

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT id, email, user_type, password FROM cst_users WHERE id IN (6, 5, 8, 32)`
    );
    for (const r of rows) {
      console.log(`User ${r.id} (${r.email}): password len=${r.password?.length}, prefix=${r.password?.slice(0, 15)}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    conn.release();
    await pool.end();
  }
}

run();
