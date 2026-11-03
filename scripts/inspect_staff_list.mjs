import pool from "../src/app/components/lib/db.js";

async function run() {
    const [staffList] = await pool.query(`
        SELECT s.id, s.user_id, s.appointment_no, s.first_name, s.last_name, s.academy_id, s.branch_id, s.role_id, r.role_name, u.email
        FROM cst_staff s
        LEFT JOIN cst_roles r ON r.id = s.role_id
        LEFT JOIN cst_users u ON u.id = s.user_id
        WHERE s.is_deleted = 0
    `);
    console.log("Total cst_staff records:", staffList.length);
    console.table(staffList);
    process.exit(0);
}
run();
