import pool from "../src/app/components/lib/db.js";

async function run() {
    const tables = ['cst_staff_salary', 'cst_staff_salary_payments', 'cst_staff_salary_transactions'];
    for (const t of tables) {
        const [res] = await pool.query(`SHOW CREATE TABLE \`${t}\``);
        console.log(`\n================= ${t} =================`);
        console.log(res[0]['Create Table']);
    }
    process.exit(0);
}
run();
