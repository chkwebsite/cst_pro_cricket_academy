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
        console.log("Testing functional unique index creation on cst_programs...");
        // Check if index already exists
        const [existing] = await conn.query("SHOW INDEX FROM cst_programs WHERE Key_name = 'uq_program_academy_branch_name'");
        if (existing.length === 0) {
            await conn.query("CREATE UNIQUE INDEX uq_program_academy_branch_name ON cst_programs (academy_id, (COALESCE(branch_id, 0)), program_name)");
            console.log("Index created successfully!");
        } else {
            console.log("Index already exists.");
        }

        const [keys] = await conn.query("SHOW KEYS FROM cst_programs");
        console.table(keys.map(k => ({ Key_name: k.Key_name, Column_name: k.Column_name, Expression: k.Expression, Non_unique: k.Non_unique })));
    } finally {
        conn.release();
        await pool.end();
    }
}

main().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
