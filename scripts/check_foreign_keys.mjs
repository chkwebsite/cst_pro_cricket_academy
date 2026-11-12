import pool from "../src/app/components/lib/db.js";

async function run() {
  const [fks] = await pool.query(`
    SELECT 
      TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
  `);
  console.log('Total Foreign Keys:', fks.length);
  console.table(fks);
  process.exit(0);
}
run();
