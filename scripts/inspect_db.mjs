import pool from "../src/app/components/lib/db.js";

async function main() {
    try {
        const [tables] = await pool.query("SHOW TABLES");
        const dbName = process.env.DB_NAME || "defaultdb";
        const list = [];
        for (const t of tables) {
            const tableName = Object.values(t)[0];
            try {
                const [[{ count }]] = await pool.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
                list.push({ tableName, count });
            } catch (err) {
                list.push({ tableName, count: "ERROR: " + err.message });
            }
        }
        console.table(list);
    } catch (err) {
        console.error("Error inspecting DB:", err);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

main();
