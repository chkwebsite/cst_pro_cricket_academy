import pool from "../src/app/components/lib/db.js";

async function run() {
    const [staff] = await pool.query(`
        SELECT s.id, s.user_id, s.first_name, s.last_name, s.date_of_joining, s.current_salary,
               u.id AS user_pk, u.email
        FROM cst_staff s
        LEFT JOIN cst_users u ON u.id = s.user_id
    `);
    console.table(staff);
    process.exit(0);
}
run();
