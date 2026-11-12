import pool from "../src/app/components/lib/db.js";

async function main() {
    console.log("=== Creating cst_user_weekly_off and updating cst_attendance ===");
    const connection = await pool.getConnection();

    try {
        // 1. Alter cst_attendance enum to include 'Week off'
        console.log("1. Updating cst_attendance.attendance_status ENUM to include 'Week off'...");
        await connection.query(`
            ALTER TABLE cst_attendance 
            MODIFY COLUMN attendance_status ENUM('Present','Absent','Late','Half Day','Leave','Week off') NOT NULL DEFAULT 'Present'
        `);
        console.log("cst_attendance enum updated successfully.");

        // 2. Create cst_user_weekly_off table
        console.log("2. Creating cst_user_weekly_off table...");
        await connection.query(`
            CREATE TABLE IF NOT EXISTS cst_user_weekly_off (
                id INT AUTO_INCREMENT PRIMARY KEY,
                academy_id INT NOT NULL,
                branch_id INT NOT NULL,
                user_id INT NOT NULL,
                day_of_week ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL,
                status TINYINT NOT NULL DEFAULT 1,
                remarks VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_user_day (user_id, day_of_week),
                INDEX idx_academy_branch (academy_id, branch_id),
                INDEX idx_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log("cst_user_weekly_off table created successfully.");

        // 3. Seed some dummy weekly off records for active users
        console.log("3. Seeding sample weekly offs...");
        const [users] = await connection.query(`
            SELECT id, academy_id, branch_id, user_type 
            FROM cst_users 
            WHERE is_deleted = 0 AND branch_id IS NOT NULL AND academy_id IS NOT NULL
            LIMIT 15
        `);

        for (const u of users) {
            // Give Sunday as weekly off by default
            await connection.query(`
                INSERT INTO cst_user_weekly_off (academy_id, branch_id, user_id, day_of_week, status)
                VALUES (?, ?, ?, 'Sunday', 1)
                ON DUPLICATE KEY UPDATE status = 1
            `, [u.academy_id, u.branch_id, u.id]);

            // For Staff / Coaches, also give Monday as weekly off
            if (String(u.user_type || "").toLowerCase().includes("coach") || String(u.user_type || "").toLowerCase().includes("staff")) {
                await connection.query(`
                    INSERT INTO cst_user_weekly_off (academy_id, branch_id, user_id, day_of_week, status)
                    VALUES (?, ?, ?, 'Monday', 1)
                    ON DUPLICATE KEY UPDATE status = 1
                `, [u.academy_id, u.branch_id, u.id]);
            }
        }
        console.log("Sample weekly offs seeded successfully.");

        console.log("=== Migration & Seeding Completed Successfully ===");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    } finally {
        if (connection) connection.release();
    }
}

main();
