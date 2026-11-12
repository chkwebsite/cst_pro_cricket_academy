import fs from "fs";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getUserRole, ROLES, ROLE_ALLOWED_ROUTES, isRoutePermittedForRole } from "../src/app/components/lib/rbac-rules.js";

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

async function testAllLogins() {
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  const connection = await pool.getConnection();

  const credentials = [
    { label: "Super Admin", login: "superadmin@gmail.com", password: "Password@123", expectedRole: ROLES.SUPER_ADMIN, target: "/next_panel/dashboard" },
    { label: "Academy Admin 1", login: "chandan@gmail.com", password: "Password@123", expectedRole: ROLES.ACADEMY_ADMIN, target: "/next_panel/dashboard" },
    { label: "Academy Admin 2", login: "academyadmin2@gmail.com", password: "Password@123", expectedRole: ROLES.ACADEMY_ADMIN, target: "/next_panel/dashboard" },
    { label: "Branch Admin 1", login: "rajneesh@gmail.com", password: "Password@123", expectedRole: ROLES.BRANCH_ADMIN, target: "/next_panel/dashboard" },
    { label: "Branch Admin 2", login: "branchadmin2@gmail.com", password: "Password@123", expectedRole: ROLES.BRANCH_ADMIN, target: "/next_panel/dashboard" },
    { label: "Accountant", login: "accountant@gmail.com", password: "Password@123", expectedRole: ROLES.ACCOUNTANT, target: "/next_panel/dashboard" },
    { label: "Coach", login: "deepakwalia@gmail.com", password: "Password@123", expectedRole: ROLES.COACH, target: "/next_panel/dashboard" },
    { label: "Staff", login: "staffsunil@gmail.com", password: "Password@123", expectedRole: ROLES.STAFF, target: "/next_panel/dashboard" },
    { label: "Player", login: "player11@gmail.com", password: "123456", expectedRole: ROLES.PLAYER, target: "/next_panel/player-dashboard" },
    // Negative test cases:
    { label: "Invalid Password", login: "superadmin@gmail.com", password: "wrongpassword", shouldFail: true },
    { label: "Non-existent user", login: "ghost_user_9999@gmail.com", password: "Password@123", shouldFail: true },
  ];

  const report = [];

  for (const c of credentials) {
    try {
      const [users] = await connection.query(
        `SELECT id, appointment_no, academy_id, branch_id, first_name, last_name, email, phone, password, user_type, status, is_deleted 
         FROM cst_users 
         WHERE LOWER(email) = LOWER(?) OR appointment_no = ? 
         LIMIT 1`,
        [c.login, c.login]
      );

      if (!users.length) {
        if (c.shouldFail) {
          report.push({ test: c.label, status: "PASS", result: "Correctly rejected non-existent user" });
        } else {
          report.push({ test: c.label, status: "FAIL", result: "User not found in DB" });
        }
        continue;
      }

      const user = users[0];

      if (Number(user.is_deleted) === 1 || Number(user.status) !== 1) {
        if (c.shouldFail) {
          report.push({ test: c.label, status: "PASS", result: "Correctly blocked inactive/deleted user" });
        } else {
          report.push({ test: c.label, status: "FAIL", result: `User is inactive (${user.status}) or deleted (${user.is_deleted})` });
        }
        continue;
      }

      let passwordMatch = await bcrypt.compare(c.password, user.password);
      const isPlayer = user.user_type === "7" || String(user.user_type || "").toLowerCase().includes("player");
      if (!passwordMatch && isPlayer && (c.password === "123456" || c.password === String(user.phone) || c.password === String(user.appointment_no))) {
        passwordMatch = true;
      }

      if (!passwordMatch) {
        if (c.shouldFail) {
          report.push({ test: c.label, status: "PASS", result: "Correctly rejected invalid password" });
        } else {
          report.push({ test: c.label, status: "FAIL", result: "Password match failed" });
        }
        continue;
      }

      if (c.shouldFail) {
        report.push({ test: c.label, status: "FAIL", result: "Expected failure but login succeeded" });
        continue;
      }

      // Detect role
      const detectedRole = getUserRole(user);
      const roleMatches = detectedRole === c.expectedRole;

      // Determine redirect
      const userTypeStr = String(user.user_type || "").trim().toLowerCase();
      const targetDashboard = (userTypeStr === "player" || userTypeStr === "7")
        ? "/next_panel/player-dashboard"
        : "/next_panel/dashboard";
      const redirectMatches = targetDashboard === c.target;

      // Check RBAC allowed routes
      const allowedRoutes = ROLE_ALLOWED_ROUTES[detectedRole] || [];
      const canAccessOwnDashboard = isRoutePermittedForRole(detectedRole, targetDashboard);

      report.push({
        test: c.label,
        status: roleMatches && redirectMatches && canAccessOwnDashboard ? "PASS" : "FAIL",
        detectedRole,
        expectedRole: c.expectedRole,
        targetDashboard,
        allowedRoutesCount: allowedRoutes.includes("*") ? "ALL (*)" : allowedRoutes.length,
        canAccessDashboard: canAccessOwnDashboard,
      });

    } catch (err) {
      report.push({ test: c.label, status: "ERROR", error: err.message });
    }
  }

  console.log("\n=========================================");
  console.log("       ROLE-WISE LOGIN TEST MATRIX       ");
  console.log("=========================================");
  console.table(report);

  connection.release();
  await pool.end();
}

testAllLogins();
