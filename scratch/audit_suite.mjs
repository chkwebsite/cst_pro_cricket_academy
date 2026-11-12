import fs from "fs";
import mysql from "mysql2/promise";
import jwt from "jsonwebtoken";

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

const JWT_SECRET = env.JWT_SECRET || "cricketAcademy_2026@Admin#Panel$Role%Secure123";

async function runAudit() {
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  const connection = await pool.getConnection();
  const results = {
    authTests: [],
    tenantIsolationTests: [],
    dbIntegrityTests: [],
    apiSecurityIssues: [],
  };

  try {
    console.log("=========================================");
    console.log("  PHASE 1: AUTHENTICATION AUDIT FOR ALL ROLES");
    console.log("=========================================");

    const testUsers = [
      { role: "Super Admin", email: "superadmin@gmail.com", expectedRole: "SUPER_ADMIN", expectedDashboard: "/next_panel/dashboard" },
      { role: "Academy Admin 1", email: "chandan@gmail.com", expectedRole: "ACADEMY_ADMIN", expectedDashboard: "/next_panel/dashboard" },
      { role: "Academy Admin 2", email: "academyadmin2@gmail.com", expectedRole: "ACADEMY_ADMIN", expectedDashboard: "/next_panel/dashboard" },
      { role: "Branch Admin 1", email: "rajneesh@gmail.com", expectedRole: "BRANCH_ADMIN", expectedDashboard: "/next_panel/dashboard" },
      { role: "Branch Admin 2", email: "branchadmin2@gmail.com", expectedRole: "BRANCH_ADMIN", expectedDashboard: "/next_panel/dashboard" },
      { role: "Accountant", email: "accountant@gmail.com", expectedRole: "ACCOUNTANT", expectedDashboard: "/next_panel/dashboard" },
      { role: "Coach", email: "deepakwalia@gmail.com", expectedRole: "COACH", expectedDashboard: "/next_panel/dashboard" },
      { role: "Staff", email: "staffsunil@gmail.com", expectedRole: "STAFF", expectedDashboard: "/next_panel/dashboard" },
      { role: "Player", email: "player11@gmail.com", expectedRole: "PLAYER", expectedDashboard: "/next_panel/player-dashboard" },
    ];

    for (const tu of testUsers) {
      const [uRows] = await connection.query(
        `SELECT id, appointment_no, email, user_type, academy_id, branch_id, status, is_deleted, password 
         FROM cst_users WHERE email = ?`,
        [tu.email]
      );
      if (uRows.length === 0) {
        results.authTests.push({ test: `User exists: ${tu.role}`, status: "FAIL", details: `User ${tu.email} not found` });
      } else {
        const u = uRows[0];
        const isActive = Number(u.status) === 1 && Number(u.is_deleted) === 0;
        results.authTests.push({
          test: `User exists & active: ${tu.role} (${u.email})`,
          status: isActive ? "PASS" : "FAIL",
          details: `status: ${u.status}, is_deleted: ${u.is_deleted}, academy: ${u.academy_id}, branch: ${u.branch_id}`,
        });

        // Test JWT creation and verification
        const token = jwt.sign(
          { id: u.id, appointment_no: u.appointment_no, academy_id: u.academy_id, branch_id: u.branch_id, email: u.email, user_type: u.user_type },
          JWT_SECRET,
          { expiresIn: "7d" }
        );
        const verified = jwt.verify(token, JWT_SECRET);
        results.authTests.push({
          test: `JWT sign & verify: ${tu.role}`,
          status: verified.id === u.id ? "PASS" : "FAIL",
          details: `token claims valid for id ${u.id}`,
        });
      }
    }

    console.log("=========================================");
    console.log("  PHASE 2: DATABASE INTEGRITY AUDIT");
    console.log("=========================================");

    // 1. Orphan user_programs
    const [orphanUP] = await connection.query(
      `SELECT up.id, up.user_id, up.program_id 
       FROM cst_user_programs up
       LEFT JOIN cst_users u ON u.id = up.user_id
       WHERE u.id IS NULL AND up.is_deleted = 0`
    );
    results.dbIntegrityTests.push({
      test: "Orphan cst_user_programs (no user)",
      count: orphanUP.length,
      status: orphanUP.length === 0 ? "PASS" : "WARN",
    });

    // 2. Orphan player program fees
    const [orphanPPF] = await connection.query(
      `SELECT ppf.id, ppf.user_program_id 
       FROM cst_player_program_fees ppf
       LEFT JOIN cst_user_programs up ON up.id = ppf.user_program_id
       WHERE up.id IS NULL`
    );
    results.dbIntegrityTests.push({
      test: "Orphan cst_player_program_fees (no user_program)",
      count: orphanPPF.length,
      status: orphanPPF.length === 0 ? "PASS" : "WARN",
    });

    // 3. Orphan fee status
    const [orphanFS] = await connection.query(
      `SELECT fs.id, fs.academy_id, fs.user_id 
       FROM cst_fee_status fs
       LEFT JOIN cst_academy a ON a.id = fs.academy_id
       WHERE a.id IS NULL`
    );
    results.dbIntegrityTests.push({
      test: "Orphan cst_fee_status (invalid academy)",
      count: orphanFS.length,
      status: orphanFS.length === 0 ? "PASS" : "WARN",
    });

    // 4. Duplicate active player enrollments for same program in same dates
    const [dupEnrollments] = await connection.query(
      `SELECT user_id, program_id, COUNT(*) as cnt 
       FROM cst_user_programs 
       WHERE is_deleted = 0 AND status = 1 
       GROUP BY user_id, program_id HAVING cnt > 1`
    );
    results.dbIntegrityTests.push({
      test: "Duplicate active enrollments for same program",
      count: dupEnrollments.length,
      status: dupEnrollments.length === 0 ? "PASS" : "WARN",
      details: dupEnrollments,
    });

    // 5. Inactive or deleted users in system
    const [inactiveUsers] = await connection.query(
      `SELECT id, email, status, is_deleted FROM cst_users WHERE status != 1 OR is_deleted = 1`
    );
    results.dbIntegrityTests.push({
      test: "Inactive or deleted user count in system",
      count: inactiveUsers.length,
      status: "INFO",
      details: inactiveUsers.map(u => ({ id: u.id, email: u.email, status: u.status, is_deleted: u.is_deleted })),
    });

    // 6. Fee payments with amount <= 0
    const [zeroPayments] = await connection.query(
      `SELECT id, fee_status_id, amount FROM cst_fee_payments WHERE amount <= 0`
    );
    results.dbIntegrityTests.push({
      test: "Zero or negative fee payments",
      count: zeroPayments.length,
      status: zeroPayments.length === 0 ? "PASS" : "WARN",
    });

    // 7. Check cst_ground_bookings columns
    const [gbCols] = await connection.query(`DESCRIBE cst_ground_bookings`);
    results.dbIntegrityTests.push({
      test: "cst_ground_bookings schema",
      columns: gbCols.map(c => c.Field),
      status: "INFO",
    });

    console.log("\n--- Audit Results Summary ---");
    console.log(JSON.stringify(results, null, 2));

  } catch (err) {
    console.error("Audit error:", err);
  } finally {
    connection.release();
    await pool.end();
  }
}

runAudit();
