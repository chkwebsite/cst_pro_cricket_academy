import mysql from 'mysql2/promise';

async function testTeamValidation() {
    console.log('Testing Duplicate Team Validation...');
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
        // 1. Verify duplicates count for Swet Team
        const [swetRows] = await conn.query(
            "SELECT id, team_name, team_code, academy_id, branch_id FROM cst_teams WHERE team_name = 'Swet Team' AND is_deleted = 0"
        );
        console.log('1. Remaining Swet Team records in DB (should be exactly 1):', swetRows.length);
        if (swetRows.length === 1) {
            console.log('   [PASS] Only 1 record exists:', swetRows[0]);
        } else {
            console.error('   [FAIL] Expected 1 record, found:', swetRows.length);
        }

        // 2. Test duplicate query simulated
        const trimmedTeamName = 'Swet Team';
        const finalAcademyId = 2;
        const finalBranchId = 3;
        const [duplicateRows] = await conn.query(
            `
            SELECT id, team_name, team_code
            FROM cst_teams
            WHERE LOWER(TRIM(team_name)) = LOWER(?)
            AND academy_id = ?
            AND (
                (? IS NULL AND (branch_id IS NULL OR branch_id = 0))
                OR branch_id = ?
            )
            AND is_deleted = 0
            LIMIT 1
            `,
            [trimmedTeamName, finalAcademyId, finalBranchId, finalBranchId]
        );
        console.log('2. Query for duplicate "Swet Team" in Academy 2, Branch 3:');
        if (duplicateRows.length > 0) {
            console.log('   [PASS] Successfully detected duplicate! Matches team id:', duplicateRows[0].id);
        } else {
            console.error('   [FAIL] Did not detect duplicate.');
        }

        // 3. Test unique team name query
        const uniqueTeamName = 'Super Unique Team ' + Date.now();
        const [uniqueRows] = await conn.query(
            `
            SELECT id, team_name, team_code
            FROM cst_teams
            WHERE LOWER(TRIM(team_name)) = LOWER(?)
            AND academy_id = ?
            AND (
                (? IS NULL AND (branch_id IS NULL OR branch_id = 0))
                OR branch_id = ?
            )
            AND is_deleted = 0
            LIMIT 1
            `,
            [uniqueTeamName, finalAcademyId, finalBranchId, finalBranchId]
        );
        console.log('3. Query for unique team name:');
        if (uniqueRows.length === 0) {
            console.log('   [PASS] Unique team name correctly allowed.');
        } else {
            console.error('   [FAIL] Unique team name incorrectly blocked.');
        }

    } finally {
        conn.release();
        await pool.end();
    }
}

testTeamValidation().catch(console.error);
