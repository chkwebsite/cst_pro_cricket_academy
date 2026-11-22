import mysql from 'mysql2/promise';

async function testOutsidePlayers() {
    console.log('Testing Outside Players Mandatory Fields & Schema...');

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
        // 1. Verify schema for NOT NULL on all 4 fields
        const [columns] = await conn.query('DESCRIBE cst_outside_players');
        const checked = {};
        for (const col of columns) {
            if (['player_name', 'date_of_birth', 'age_group_id', 'phone'].includes(col.Field)) {
                checked[col.Field] = col.Null === 'NO';
                console.log(`Field [${col.Field}]: Null allowed = ${col.Null} (Mandatory: ${col.Null === 'NO'})`);
            }
        }

        const allMandatoryInDB = checked.player_name && checked.date_of_birth && checked.age_group_id && checked.phone;
        if (allMandatoryInDB) {
            console.log('  [PASS] All 4 fields (player_name, date_of_birth, age_group_id, phone) are strictly NOT NULL in MySQL schema.');
        } else {
            console.error('  [FAIL] Some fields are still nullable in DB:', checked);
        }

        // 2. Test negative: Attempt inserting with NULL phone
        let phoneNullBlocked = false;
        try {
            await conn.query(`
                INSERT INTO cst_outside_players (academy_id, branch_id, player_name, age_group_id, phone, date_of_birth)
                VALUES (2, 3, 'Test Negative', 1, NULL, '2015-01-01')
            `);
        } catch (err) {
            phoneNullBlocked = true;
            console.log('  [PASS] DB successfully blocked NULL phone:', err.message);
        }
        if (!phoneNullBlocked) console.error('  [FAIL] DB accepted NULL phone!');

        // 3. Test negative: Attempt inserting with NULL date_of_birth
        let dobNullBlocked = false;
        try {
            await conn.query(`
                INSERT INTO cst_outside_players (academy_id, branch_id, player_name, age_group_id, phone, date_of_birth)
                VALUES (2, 3, 'Test Negative', 1, '9999999999', NULL)
            `);
        } catch (err) {
            dobNullBlocked = true;
            console.log('  [PASS] DB successfully blocked NULL date_of_birth:', err.message);
        }
        if (!dobNullBlocked) console.error('  [FAIL] DB accepted NULL date_of_birth!');

        // 4. Test positive: Inserting valid record with all mandatory fields
        const testPhone = '99988' + Math.floor(10000 + Math.random() * 90000);
        const [insertRes] = await conn.query(`
            INSERT INTO cst_outside_players (academy_id, branch_id, player_name, age_group_id, phone, date_of_birth)
            VALUES (2, 3, 'Test Mandatory Positive', 1, ?, '2015-05-20')
        `, [testPhone]);
        console.log('  [PASS] DB successfully inserted valid outside player with ID:', insertRes.insertId);

        // Clean up test record
        await conn.query('DELETE FROM cst_outside_players WHERE id = ?', [insertRes.insertId]);
        console.log('  [CLEANUP] Deleted test positive record.');

    } finally {
        conn.release();
        await pool.end();
    }
}

testOutsidePlayers().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
