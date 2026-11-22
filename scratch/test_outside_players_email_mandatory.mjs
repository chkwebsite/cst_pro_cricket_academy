import mysql from 'mysql2/promise';

async function testEmailMandatory() {
    console.log('Testing Outside Player Email Mandatory Validation...');

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
        // 1. Verify schema: email must be NOT NULL
        const [columns] = await conn.query('DESCRIBE cst_outside_players');
        const emailCol = columns.find(c => c.Field === 'email');
        console.log('1. email column Null allowed:', emailCol.Null);
        if (emailCol.Null === 'NO') {
            console.log('   [PASS] email is strictly NOT NULL in MySQL schema.');
        } else {
            console.error('   [FAIL] email is still nullable in schema!');
        }

        // 2. Negative test: Attempt inserting with NULL email
        let emailNullBlocked = false;
        try {
            await conn.query(`
                INSERT INTO cst_outside_players (academy_id, branch_id, player_name, age_group_id, phone, email, date_of_birth)
                VALUES (2, 3, 'Test Email Null', 1, '9998887771', NULL, '2015-01-01')
            `);
        } catch (err) {
            emailNullBlocked = true;
            console.log('   [PASS] DB successfully blocked NULL email:', err.message);
        }
        if (!emailNullBlocked) console.error('   [FAIL] DB accepted NULL email!');

        // 3. Positive test: Inserting valid record with all mandatory fields including email
        const testPhone = '99977' + Math.floor(10000 + Math.random() * 90000);
        const testEmail = `test_player_${Date.now()}@example.com`;
        const [insertRes] = await conn.query(`
            INSERT INTO cst_outside_players (academy_id, branch_id, player_name, age_group_id, phone, email, date_of_birth)
            VALUES (2, 3, 'Test Email Positive', 1, ?, ?, '2015-05-20')
        `, [testPhone, testEmail]);
        console.log('   [PASS] DB successfully inserted valid outside player with ID:', insertRes.insertId);

        // Clean up
        await conn.query('DELETE FROM cst_outside_players WHERE id = ?', [insertRes.insertId]);
        console.log('   [CLEANUP] Deleted test positive record.');

    } finally {
        conn.release();
        await pool.end();
    }
}

testEmailMandatory().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
