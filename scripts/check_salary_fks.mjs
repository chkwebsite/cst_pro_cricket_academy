import pool from "../src/app/components/lib/db.js";

async function run() {
    const [fks] = await pool.query(`
        SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('cst_staff_salary', 'cst_staff_salary_payments', 'cst_staff_salary_transactions', 'cst_staff')
          AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    console.log("Foreign keys for salary and staff:", fks);

    const [staff] = await pool.query(`SELECT * FROM cst_staff LIMIT 3`);
    console.log("Sample cst_staff records:", staff);

    const [existingSalaries] = await pool.query(`SELECT * FROM cst_staff_salary LIMIT 3`);
    console.log("Sample cst_staff_salary records:", existingSalaries);

    process.exit(0);
}
run();
