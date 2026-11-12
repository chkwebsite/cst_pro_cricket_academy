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

async function checkPasswords() {
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
    const testEmails = [
      "superadmin@gmail.com",
      "chandan@gmail.com",
      "academyadmin2@gmail.com",
      "rajneesh@gmail.com",
      "branchadmin2@gmail.com",
      "branchadmin3@gmail.com",
      "accountant@gmail.com",
      "deepakwalia@gmail.com",
      "coachrajesh@gmail.com",
      "staffsunil@gmail.com",
      "sumit@gmail.com",
      "player11@gmail.com",
      "player10@gmail.com",
      "player1@gmail.com"
    ];

    const candidatePasswords = [
      "123456",
      "12345678",
      "admin",
      "admin123",
      "password",
      "cst@123",
      "cst123",
      "superadmin",
      "superadmin123",
      "chandan",
      "chandan123",
      "rajneesh",
      "accountant",
      "deepak",
      "deepak123",
      "coach123"
    ];

    for (const email of testEmails) {
      const [rows] = await conn.execute(
        `SELECT id, first_name, last_name, email, password, user_type, phone, appointment_no, status, is_deleted 
         FROM cst_users WHERE email = ?`,
        [email]
      );
      if (!rows.length) {
        console.log(`User not found: ${email}`);
        continue;
      }
      const u = rows[0];
      let matched = null;
      for (const p of candidatePasswords) {
        if (await bcrypt.compare(p, u.password)) {
          matched = p;
          break;
        }
      }
      // Also check phone and appointment_no
      if (!matched && u.phone && await bcrypt.compare(String(u.phone).trim(), u.password)) {
        matched = `phone (${u.phone})`;
      }
      if (!matched && u.appointment_no && await bcrypt.compare(String(u.appointment_no).trim(), u.password)) {
        matched = `appointment (${u.appointment_no})`;
      }

      console.log(`User [${u.id}] ${u.email} (${u.user_type}): password matched -> ${matched || "UNKNOWN HASH"}`);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    conn.release();
    await pool.end();
  }
}

checkPasswords();
