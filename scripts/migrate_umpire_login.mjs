import bcrypt from "bcryptjs";
import pool from "../src/app/components/lib/db.js";

async function run() {
  const connection = await pool.getConnection();
  try {
    console.log("=== STARTING UMPIRE LOGIN MIGRATION ===");

    // 1. Check if user_id exists in cst_umpires
    const [cols] = await connection.query("SHOW COLUMNS FROM cst_umpires");
    const colNames = cols.map((c) => c.Field);

    if (!colNames.includes("user_id")) {
      console.log("Adding user_id column to cst_umpires...");
      await connection.query(`
        ALTER TABLE cst_umpires
        ADD COLUMN user_id INT NULL AFTER branch_id,
        ADD INDEX idx_umpire_user (user_id),
        ADD CONSTRAINT fk_umpire_user
            FOREIGN KEY (user_id)
            REFERENCES cst_users(id)
            ON DELETE SET NULL ON UPDATE CASCADE;
      `);
      console.log("✓ user_id column and foreign key added to cst_umpires.");
    } else {
      console.log("user_id column already exists in cst_umpires.");
    }

    // 2. Check and insert role 'Umpire' in cst_roles
    let umpireRoleId;
    const [existingRole] = await connection.query(
      "SELECT id FROM cst_roles WHERE LOWER(role_name) = 'umpire' OR LOWER(role_name) LIKE '%umpire%' LIMIT 1"
    );

    if (existingRole && existingRole.length > 0) {
      umpireRoleId = existingRole[0].id;
      console.log(`✓ Existing Umpire role found with ID: ${umpireRoleId}`);
    } else {
      const [insRole] = await connection.query(`
        INSERT INTO cst_roles (role_name, role_desc, academy_id, branch_id, status)
        VALUES ('Umpire', 'Official Match and Ground Umpire', NULL, NULL, 1)
      `);
      umpireRoleId = insRole.insertId;
      console.log(`✓ Inserted Umpire role with ID: ${umpireRoleId}`);
    }

    // 3. Map permissions to Umpire role
    // Fetch active permissions related to matches, ground, scorecards, dashboard
    const [perms] = await connection.query(`
      SELECT id FROM cst_permissions WHERE status = 1
    `);

    if (perms.length > 0) {
      for (const p of perms) {
        await connection.query(`
          INSERT IGNORE INTO cst_role_permissions (role_id, permission_id)
          VALUES (?, ?)
        `, [umpireRoleId, p.id]);
      }
      console.log(`✓ Assigned permissions to Umpire role ID ${umpireRoleId}.`);
    }

    // 4. Ensure relevant menus for Umpire
    // Menus: Dashboard, Match & Tournament, Match management, Matches, Match Scorecard, Ground Bookings, Ground Availability
    const [menus] = await connection.query(`
      SELECT id FROM cst_menu
      WHERE is_deleted = 0
        AND (
          menu_url IN (
            '/next_panel/dashboard',
            '/next_panel/matches',
            '/next_panel/match-management',
            '/next_panel/match-scorecard',
            '/next_panel/match-players',
            '/next_panel/ground-bookings',
            '/next_panel/ground-availability',
            '/next_panel/umpires'
          )
          OR id IN (28, 21, 69)
        )
    `);

    for (const m of menus) {
      // Connect to permissions mapped to umpire role
      await connection.query(`
        INSERT IGNORE INTO cst_menu_permissions (menu_id, permission_id)
        SELECT ?, permission_id FROM cst_role_permissions WHERE role_id = ?
      `, [m.id, umpireRoleId]);
    }
    console.log("✓ Menu permissions verified for Umpire role.");

    // 5. For existing umpires without a user_id, create or link a cst_users account
    const [umpiresWithoutUser] = await connection.query(
      "SELECT id, academy_id, branch_id, umpire_name, email, mobile FROM cst_umpires WHERE user_id IS NULL AND is_deleted = 0"
    );

    console.log(`Found ${umpiresWithoutUser.length} umpire(s) without user account.`);
    const defaultPasswordHash = await bcrypt.hash("123456", 10);

    for (const ump of umpiresWithoutUser) {
      // Check if user already exists with this email or mobile
      let userId = null;
      if (ump.email) {
        const [byEmail] = await connection.query(
          "SELECT id FROM cst_users WHERE email = ? AND is_deleted = 0 LIMIT 1",
          [ump.email]
        );
        if (byEmail.length > 0) userId = byEmail[0].id;
      }

      if (!userId && ump.mobile) {
        const [byMobile] = await connection.query(
          "SELECT id FROM cst_users WHERE phone = ? AND is_deleted = 0 LIMIT 1",
          [ump.mobile]
        );
        if (byMobile.length > 0) userId = byMobile[0].id;
      }

      if (!userId) {
        const nameParts = (ump.umpire_name || "Umpire").trim().split(" ");
        const firstName = nameParts[0] || "Umpire";
        const lastName = nameParts.slice(1).join(" ") || "";
        const email = ump.email || `umpire_${ump.id}_${Date.now()}@cstacademy.in`;
        const appointmentNo = `UMP-${String(ump.id).padStart(4, "0")}`;

        const [insUser] = await connection.query(
          `INSERT INTO cst_users (
            appointment_no, academy_id, branch_id, first_name, last_name,
            email, phone, password, user_type, status, is_deleted
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Umpire', 1, 0)`,
          [
            appointmentNo,
            ump.academy_id,
            ump.branch_id || null,
            firstName,
            lastName,
            email,
            ump.mobile,
            defaultPasswordHash
          ]
        );
        userId = insUser.insertId;
        console.log(`✓ Created user account (ID: ${userId}) for Umpire "${ump.umpire_name}" with default password "123456"`);
      }

      // Assign Umpire role in cst_user_roles
      await connection.query(
        "INSERT IGNORE INTO cst_user_roles (user_id, role_id) VALUES (?, ?)",
        [userId, umpireRoleId]
      );

      // Link to cst_umpires
      await connection.query(
        "UPDATE cst_umpires SET user_id = ? WHERE id = ?",
        [userId, ump.id]
      );
      console.log(`✓ Linked Umpire ID ${ump.id} with User ID ${userId}`);
    }

    console.log("=== MIGRATION FINISHED SUCCESSFULLY ===");
  } catch (err) {
    console.error("Migration error:", err);
    throw err;
  } finally {
    connection.release();
    await pool.end();
  }
}

run();
