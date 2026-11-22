import mysql from 'mysql2/promise';

async function migrateOutsidePlayers() {
    console.log('Running outside players database migration...');

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
        // 1. Backfill NULL / empty phone numbers
        const [phoneUpdate] = await conn.query(`
            UPDATE cst_outside_players
            SET phone = CONCAT('98000000', LPAD(id, 2, '0'))
            WHERE phone IS NULL OR TRIM(phone) = ''
        `);
        console.log('1. Updated missing phones:', phoneUpdate.affectedRows);

        // 2. Backfill NULL / invalid date_of_birth
        const [dobUpdate] = await conn.query(`
            UPDATE cst_outside_players
            SET date_of_birth = '2016-01-15'
            WHERE date_of_birth IS NULL OR date_of_birth < '1950-01-01'
        `);
        console.log('2. Updated missing / invalid date_of_birth:', dobUpdate.affectedRows);

        // 3. Alter columns to NOT NULL
        await conn.query(`
            ALTER TABLE cst_outside_players
            MODIFY COLUMN phone VARCHAR(30) NOT NULL
        `);
        console.log('3. Column phone set to NOT NULL');

        await conn.query(`
            ALTER TABLE cst_outside_players
            MODIFY COLUMN date_of_birth DATE NOT NULL
        `);
        console.log('4. Column date_of_birth set to NOT NULL');

        // Verify schema
        const [columns] = await conn.query('DESCRIBE cst_outside_players');
        const relevant = columns.filter(c =>
            ['player_name', 'date_of_birth', 'age_group_id', 'phone'].includes(c.Field)
        );
        console.log('\nFinal Schema for mandatory columns:');
        console.table(relevant);

    } finally {
        conn.release();
        await pool.end();
    }
}

migrateOutsidePlayers().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
