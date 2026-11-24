import mysql from "mysql2/promise";

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

async function main() {
    const conn = await pool.getConnection();
    try {
        console.log("=== 1. DESCRIBE cst_programs ===");
        const [cols] = await conn.query("DESCRIBE cst_programs");
        console.table(cols.map(c => ({ Field: c.Field, Type: c.Type, Null: c.Null, Key: c.Key, Default: c.Default })));

        console.log("=== 2. SHOW KEYS FROM cst_programs ===");
        const [keys] = await conn.query("SHOW KEYS FROM cst_programs");
        console.table(keys.map(k => ({ Key_name: k.Key_name, Column_name: k.Column_name, Non_unique: k.Non_unique })));

        console.log("=== 3. Sample rows from cst_programs ===");
        const [rows] = await conn.query(`
            SELECT id, academy_id, branch_id, program_name, program_code, status, is_deleted, created_at
            FROM cst_programs
            ORDER BY id DESC
            LIMIT 20
        `);
        console.table(rows);

        console.log("=== 4. Check for duplicate program_name per (academy_id, branch_id) ===");
        const [dups] = await conn.query(`
            SELECT academy_id, branch_id, program_name, COUNT(*) as cnt
            FROM cst_programs
            WHERE is_deleted = 0
            GROUP BY academy_id, branch_id, program_name
            HAVING cnt > 1
        `);
        console.table(dups);

    } finally {
        conn.release();
        await pool.end();
    }
}

main().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
