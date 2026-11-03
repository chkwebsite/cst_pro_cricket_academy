import pool from "../src/app/components/lib/db.js";

async function run() {
    const tables = ['cst_staff_salary', 'cst_staff_salary_payments', 'cst_staff_salary_transactions'];
    for (const t of tables) {
        try {
            const [cols] = await pool.query(`DESCRIBE \`${t}\``);
            console.log(`=== ${t} ===`);
            console.table(cols.map(c => ({ Field: c.Field, Type: c.Type, Null: c.Null, Key: c.Key, Default: c.Default })));
        } catch (e) {
            console.log(`Error describing ${t}:`, e.message);
        }
    }
    process.exit(0);
}
run();
