import pool from "../src/app/components/lib/db.js";

async function run() {
    await pool.query("UPDATE cst_staff SET current_salary = 25000 WHERE id = 6");
    await pool.query("UPDATE cst_staff SET current_salary = 35000 WHERE id = 9");
    await pool.query("UPDATE cst_staff SET current_salary = 30000 WHERE id = 10");
    await pool.query("UPDATE cst_staff SET current_salary = 18000 WHERE id = 11");
    await pool.query("UPDATE cst_staff SET current_salary = 25000 WHERE id = 8");
    console.log("Updated staff current_salary values.");
    process.exit(0);
}
run();
