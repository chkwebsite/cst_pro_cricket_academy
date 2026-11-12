import pool from "../src/app/components/lib/db.js";

async function main() {
    const [cols] = await pool.query("DESCRIBE cst_player_program_fees");
    console.log("cst_player_program_fees columns:", cols.map(c => c.Field));
    await pool.end();
}

main().catch(console.error);
