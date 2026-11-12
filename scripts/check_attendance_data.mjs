import pool from "../src/app/components/lib/db.js";

async function main() {
    const [rows] = await pool.query(
        `SELECT a.id, a.user_id, u.first_name, u.last_name, a.attendance_date, a.attendance_status 
         FROM cst_attendance a 
         JOIN cst_users u ON u.id = a.user_id 
         WHERE a.attendance_date BETWEEN '2026-11-01' AND '2026-11-30'
         ORDER BY a.user_id, a.attendance_date`
    );
    console.log("Found attendance rows in Nov 2026:", rows.length);
    console.table(rows.slice(0, 20));

    const [staffRows] = await pool.query(
        `SELECT s.id, s.user_id, s.branch_id, s.first_name, s.last_name, s.current_salary, sal.gross_salary, sal.net_salary
         FROM cst_staff s
         LEFT JOIN cst_staff_salary sal ON sal.staff_id = s.id AND sal.status = 'Active'
         WHERE s.is_deleted = 0`
    );
    console.log("All staff with salary structures:");
    console.table(staffRows);

    process.exit(0);
}

main().catch(console.error);
