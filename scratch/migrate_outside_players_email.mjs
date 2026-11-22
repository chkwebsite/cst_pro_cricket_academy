import mysql from 'mysql2/promise';

async function migrateEmail() {
    console.log('Running outside players email NOT NULL migration...');

    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'mysql-9490c4b-chandankeshri100-fdcb.b.aivencloud.com',
        user: process.env.DB_USER || 'avnadmin',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'defaultdb',
        port: Number(process.env.DB_PORT) || 22222,
        ssl: { rejectUnauthorized: false }
    });

    const conn = await pool.getConnection();

    try {
        // 1. Backfill NULL / empty email addresses
        const [emailUpdate] = await conn.query(`
            UPDATE cst_outside_players
            SET email = CONCAT(LOWER(REPLACE(player_name, ' ', '_')), '_', id, '@cstcricket.local')
            WHERE email IS NULL OR TRIM(email) = ''
        `);
        console.log('1. Updated missing emails:', emailUpdate.affectedRows);

        // 2. Alter column to NOT NULL
        await conn.query(`
            ALTER TABLE cst_outside_players
            MODIFY COLUMN email VARCHAR(150) NOT NULL
        `);
        console.log('2. Column email set to NOT NULL');

        // 3. Verify schema
        const [columns] = await conn.query('DESCRIBE cst_outside_players');
        const relevant = columns.filter(c =>
            ['player_name', 'date_of_birth', 'age_group_id', 'phone', 'email'].includes(c.Field)
        );
        console.log('\nFinal Schema for all mandatory columns:');
        console.table(relevant);

    } finally {
        conn.release();
        await pool.end();
    }
}

migrateEmail().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
