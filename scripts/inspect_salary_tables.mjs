import pool from "../src/app/components/lib/db.js";

async function run() {
    const tables = ['cst_staff_salary', 'cst_staff_salary_payments', 'cst_staff_salary_transactions'];
    for (const t of tables) {
        const [cols] = await pool.query(`DESCRIBE \`${t}\``);
        console.log(`\n================= ${t} =================`);
        for (const c of cols) {
            console.log(`${c.Field} | ${c.Type} | Null:${c.Null} | Key:${c.Key} | Def:${c.Default}`);
        }
    }
    process.exit(0);
}
run();
