import pool from '../src/app/components/lib/db.js';
import fs from 'fs';

async function extractSchema() {
    try {
        const [tables] = await pool.query('SHOW TABLES');
        const dbName = pool.pool.config.connectionConfig.database;
        const tableKey = `Tables_in_${dbName}`;
        const tableList = tables.map(t => t[tableKey] || Object.values(t)[0]);

        const schema = {};

        for (const table of tableList) {
            const [columns] = await pool.query(`SHOW FULL COLUMNS FROM \`${table}\``);
            const [indexes] = await pool.query(`SHOW INDEX FROM \`${table}\``);
            schema[table] = {
                columns: columns.map(c => ({
                    field: c.Field,
                    type: c.Type,
                    collation: c.Collation,
                    null: c.Null,
                    key: c.Key,
                    default: c.Default,
                    extra: c.Extra,
                    comment: c.Comment
                })),
                indexes: indexes.map(i => ({
                    name: i.Key_name,
                    column: i.Column_name,
                    unique: i.Non_unique === 0,
                    type: i.Index_type
                }))
            };
        }

        fs.writeFileSync('scratch/db_schema.json', JSON.stringify(schema, null, 2));
        console.log(`Schema extracted for ${tableList.length} tables to scratch/db_schema.json`);
    } catch (err) {
        console.error('Error extracting schema:', err);
    } finally {
        await pool.end();
    }
}

extractSchema();
