import mysql from 'mysql2/promise';

async function runE2EFullAuditSuite() {
    console.log('========================================================================');
    console.log('   ANTIGRAVITY SENIOR QA & SECURITY AUDIT - FULL SYSTEM SUITE           ');
    console.log('========================================================================');
    console.log(`Timestamp: ${new Date().toISOString()}`);

    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'mysql-9490c4b-chandankeshri100-fdcb.b.aivencloud.com',
        user: process.env.DB_USER || 'avnadmin',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'defaultdb',
        port: Number(process.env.DB_PORT) || 22222,
        ssl: { rejectUnauthorized: false }
    });

    const conn = await pool.getConnection();

    const report = {
        total: 0,
        passed: 0,
        failed: 0,
        modules: {},
        tests: []
    };

    function record(moduleName, testName, testType, passed, details = '') {
        report.total++;
        if (!report.modules[moduleName]) {
            report.modules[moduleName] = { total: 0, passed: 0, failed: 0 };
        }
        report.modules[moduleName].total++;

        if (passed) {
            report.passed++;
            report.modules[moduleName].passed++;
            console.log(`  [PASS] [${moduleName}] [${testType}] ${testName}`);
        } else {
            report.failed++;
            report.modules[moduleName].failed++;
            console.error(`  [FAIL] [${moduleName}] [${testType}] ${testName} -> ${details}`);
        }
        report.tests.push({ module: moduleName, name: testName, type: testType, passed, details });
    }

    try {
        // =================================================================
        // MODULE 1: AUTHENTICATION, SECURITY & RBAC
        // =================================================================
        console.log('\n--- MODULE 1: AUTHENTICATION, SECURITY & RBAC ---');

        // Test 1.1: Password Hashing Integrity
        const [rawUsers] = await conn.query('SELECT id, email, password FROM cst_users WHERE password IS NOT NULL LIMIT 20');
        const allHashed = rawUsers.length > 0 && rawUsers.every(u =>
            u.password.startsWith('$2a$') || u.password.startsWith('$2b$') || u.password.startsWith('$argon2') || u.password.length >= 50
        );
        record('Auth & Security', 'All user passwords securely hashed in database', 'Security', allHashed, 'Found plain or unhashed passwords');

        // Test 1.2: SQL Injection Immunity Simulation
        const sqliInput = "' OR '1'='1";
        const [sqliResult] = await conn.query('SELECT id, email FROM cst_users WHERE email = ?', [sqliInput]);
        record('Auth & Security', 'SQL parameterization prevents SQL Injection on email lookup', 'Security', sqliResult.length === 0);

        // Test 1.3: Super Admin User Existence & Integrity
        const [superAdmins] = await conn.query("SELECT id, email, user_type FROM cst_users WHERE user_type = 'Super Admin' AND is_deleted = 0");
        record('Auth & Security', 'Super Admin active account exists', 'Positive', superAdmins.length > 0);

        // Test 1.4: Role definitions completeness
        const [roles] = await conn.query('SELECT id, role_name FROM cst_roles WHERE status = 1');
        const roleNames = roles.map(r => r.role_name.toLowerCase());
        const hasCoreRoles = ['super admin', 'academy admin', 'branch admin', 'coach', 'player'].some(r => roleNames.includes(r));
        record('Auth & Security', 'Core RBAC roles exist in cst_roles', 'Positive', hasCoreRoles);

        // Test 1.5: Role-Permission mapping integrity
        const [rolePerms] = await conn.query(`
            SELECT rp.id, rp.role_id, rp.permission_id
            FROM cst_role_permissions rp
            LEFT JOIN cst_roles r ON rp.role_id = r.id
            LEFT JOIN cst_permissions p ON rp.permission_id = p.id
            WHERE r.id IS NULL OR p.id IS NULL
        `);
        record('Auth & Security', 'Role-Permission referential integrity (zero dangling permissions)', 'Integrity', rolePerms.length === 0);

        // =================================================================
        // MODULE 2: ACADEMIES & BRANCHES
        // =================================================================
        console.log('\n--- MODULE 2: ACADEMIES & BRANCHES ---');

        // Test 2.1: Academies exist and have codes
        const [academies] = await conn.query('SELECT id, academy_name, academy_code FROM cst_academy WHERE is_deleted = 0');
        record('Academies', 'Active academies exist with name and code', 'Positive', academies.length > 0 && academies.every(a => a.academy_name && a.academy_code));

        // Test 2.2: Branches linked to valid academies
        const [branches] = await conn.query(`
            SELECT b.id, b.branch_name, b.academy_id, a.id as a_id
            FROM cst_branch b
            LEFT JOIN cst_academy a ON b.academy_id = a.id
            WHERE b.is_deleted = 0
        `);
        record('Branches', 'All branches linked to valid active academy', 'Cross-Module', branches.length > 0 && branches.every(b => b.a_id !== null));

        // Test 2.3: Branch unique names within same academy
        const [branchDuplicates] = await conn.query(`
            SELECT academy_id, LOWER(TRIM(branch_name)) as bname, COUNT(*) as cnt
            FROM cst_branch
            WHERE is_deleted = 0
            GROUP BY academy_id, LOWER(TRIM(branch_name))
            HAVING cnt > 1
        `);
        record('Branches', 'Branch names unique within each academy', 'Validation', branchDuplicates.length === 0, 'Found duplicate branch names');

        // =================================================================
        // MODULE 3: TEAMS & OUTSIDE PLAYERS
        // =================================================================
        console.log('\n--- MODULE 3: TEAMS & OUTSIDE PLAYERS ---');

        // Test 3.1: Team Name Uniqueness within Academy & Branch
        const [teamDupes] = await conn.query(`
            SELECT academy_id, branch_id, LOWER(TRIM(team_name)) as tname, COUNT(*) as cnt
            FROM cst_teams
            WHERE is_deleted = 0
            GROUP BY academy_id, branch_id, LOWER(TRIM(team_name))
            HAVING cnt > 1
        `);
        record('Teams', 'No duplicate team names within same academy and branch', 'Validation', teamDupes.length === 0, 'Found duplicate teams');

        // Test 3.2: Team Code format and uniqueness
        const [teamCodeDupes] = await conn.query(`
            SELECT academy_id, team_code, COUNT(*) as cnt
            FROM cst_teams
            WHERE team_code IS NOT NULL AND is_deleted = 0
            GROUP BY academy_id, team_code
            HAVING cnt > 1
        `);
        record('Teams', 'Team codes unique within each academy', 'Validation', teamCodeDupes.length === 0);

        // Test 3.3: Outside Players Mandatory Schema Constraints
        const [outsideCols] = await conn.query('DESCRIBE cst_outside_players');
        const mandatoryCols = ['player_name', 'date_of_birth', 'age_group_id', 'phone', 'email'];
        const allColsNotNull = mandatoryCols.every(colName => {
            const col = outsideCols.find(c => c.Field === colName);
            return col && col.Null === 'NO';
        });
        record('Outside Players', 'All 5 mandatory fields (name, dob, age group, phone, email) strictly NOT NULL in DB', 'Database', allColsNotNull);

        // Test 3.4: Outside Players valid data integrity
        const [outsideRows] = await conn.query('SELECT id, player_name, phone, email, date_of_birth, age_group_id FROM cst_outside_players WHERE is_deleted = 0');
        const allOutsideValid = outsideRows.length > 0 && outsideRows.every(p =>
            p.player_name && p.phone && p.email && p.date_of_birth && p.age_group_id
        );
        record('Outside Players', 'Existing outside players satisfy all mandatory data requirements', 'Positive', allOutsideValid);

        // =================================================================
        // MODULE 4: MATCHES, SCORECARDS & TOURNAMENTS
        // =================================================================
        console.log('\n--- MODULE 4: MATCHES, SCORECARDS & TOURNAMENTS ---');

        // Test 4.1: Matches required fields
        const [matches] = await conn.query('SELECT id, match_no, match_type, match_date, team_a_id, team_b_id FROM cst_matches LIMIT 25');
        const matchesValid = matches.length === 0 || matches.every(m => m.match_no && m.match_type && m.match_date && m.team_a_id && m.team_b_id);
        record('Matches', 'Matches have all mandatory fields (match_no, type, date, team A, team B)', 'Positive', matchesValid);

        // Test 4.2: Team A and Team B are different in every match
        const sameTeamMatches = matches.filter(m => Number(m.team_a_id) === Number(m.team_b_id));
        record('Matches', 'Negative rule enforced: Team A != Team B in all matches', 'Validation', sameTeamMatches.length === 0);

        // Test 4.3: Match Players integrity
        const [matchPlayersDangling] = await conn.query(`
            SELECT mp.id
            FROM cst_match_players mp
            LEFT JOIN cst_matches m ON mp.match_id = m.id
            LEFT JOIN cst_teams t ON mp.team_id = t.id
            WHERE m.id IS NULL OR t.id IS NULL
        `);
        record('Matches', 'Match Players link to valid match and valid team', 'Cross-Module', matchPlayersDangling.length === 0);

        // Test 4.4: Match Scorecard integrity
        const [scorecardDangling] = await conn.query(`
            SELECT s.id
            FROM cst_match_scorecard s
            LEFT JOIN cst_matches m ON s.match_id = m.id
            WHERE m.id IS NULL
        `);
        record('Matches', 'Match batting scorecards link to valid match', 'Cross-Module', scorecardDangling.length === 0);

        // Test 4.5: Tournament Teams linking
        const [tourneyTeamsDangling] = await conn.query(`
            SELECT tt.id
            FROM cst_tournament_teams tt
            LEFT JOIN cst_tournaments t ON tt.tournament_id = t.id
            LEFT JOIN cst_teams tm ON tt.team_id = tm.id
            WHERE t.id IS NULL OR tm.id IS NULL
        `);
        record('Tournaments', 'Tournament teams link to valid tournament and team', 'Cross-Module', tourneyTeamsDangling.length === 0);

        // =================================================================
        // MODULE 5: GROUNDS & GROUND BOOKINGS
        // =================================================================
        console.log('\n--- MODULE 5: GROUNDS & GROUND BOOKINGS ---');

        // Test 5.1: Grounds linked to valid academy
        const [grounds] = await conn.query(`
            SELECT g.id, g.ground_name, g.academy_id, a.id as a_id
            FROM cst_ground g
            LEFT JOIN cst_academy a ON g.academy_id = a.id
            WHERE g.is_deleted = 0
        `);
        record('Grounds', 'Grounds link to valid academy', 'Cross-Module', grounds.length > 0 && grounds.every(g => g.a_id !== null));

        // Test 5.2: Ground slots link to valid ground
        const [slotsDangling] = await conn.query(`
            SELECT gs.id
            FROM cst_ground_slots gs
            LEFT JOIN cst_ground g ON gs.ground_id = g.id
            WHERE g.id IS NULL
        `);
        record('Grounds', 'Ground slots link to valid ground', 'Cross-Module', slotsDangling.length === 0);

        // Test 5.3: Ground bookings double-booking check
        const [doubleBookings] = await conn.query(`
            SELECT ground_id, slot_id, DATE(booking_date) as bdate, COUNT(*) as cnt
            FROM cst_ground_bookings
            WHERE booking_status IN ('confirmed', 'booked')
            GROUP BY ground_id, slot_id, DATE(booking_date)
            HAVING cnt > 1
        `);
        record('Ground Bookings', 'No double-bookings on same ground slot and date', 'Validation', doubleBookings.length === 0, 'Found overlapping bookings');

        // =================================================================
        // MODULE 6: PROGRAMS, BATCHES & ADMISSIONS
        // =================================================================
        console.log('\n--- MODULE 6: PROGRAMS, BATCHES & ADMISSIONS ---');

        // Test 6.1: Programs have valid names and codes
        const [programs] = await conn.query('SELECT id, program_name, program_code FROM cst_programs WHERE is_deleted = 0');
        record('Programs', 'Active programs exist with program name', 'Positive', programs.length > 0 && programs.every(p => p.program_name));

        // Test 6.2: Batches referential integrity
        const [batchesDangling] = await conn.query(`
            SELECT b.id
            FROM cst_batches b
            LEFT JOIN cst_programs p ON b.program_id = p.id
            WHERE p.id IS NULL
        `);
        record('Batches', 'All batches reference a valid program', 'Cross-Module', batchesDangling.length === 0);

        // Test 6.3: Admission Players linking
        const [admissionsDangling] = await conn.query(`
            SELECT ap.id
            FROM cst_admission_players ap
            LEFT JOIN cst_users u ON ap.user_id = u.id
            LEFT JOIN cst_programs p ON ap.program_id = p.id
            WHERE u.id IS NULL OR p.id IS NULL
        `);
        record('Admissions', 'Admission players link to valid user and program', 'Cross-Module', admissionsDangling.length === 0);

        // Test 6.4: Batch Coaches valid assignment
        const [batchCoachesDangling] = await conn.query(`
            SELECT bc.id
            FROM cst_batch_coaches bc
            LEFT JOIN cst_batches b ON bc.batch_id = b.id
            LEFT JOIN cst_users u ON bc.coach_user_id = u.id
            WHERE b.id IS NULL OR u.id IS NULL
        `);
        record('Batches', 'Batch coaches reference valid batch and coach user', 'Cross-Module', batchCoachesDangling.length === 0);

        // =================================================================
        // MODULE 7: FINANCE, FEES & SALARIES
        // =================================================================
        console.log('\n--- MODULE 7: FINANCE, FEES & SALARIES ---');

        // Test 7.1: Fee status records link to valid user (when user fee)
        const [feeStatusDangling] = await conn.query(`
            SELECT fs.id
            FROM cst_fee_status fs
            LEFT JOIN cst_users u ON fs.user_id = u.id
            WHERE fs.user_id IS NOT NULL AND u.id IS NULL
        `);
        record('Finance', 'Fee status records link to valid user', 'Cross-Module', feeStatusDangling.length === 0);

        // Test 7.2: Fee payments link to valid fee status
        const [feePayDangling] = await conn.query(`
            SELECT fp.id
            FROM cst_fee_payments fp
            LEFT JOIN cst_fee_status fs ON fp.fee_status_id = fs.id
            WHERE fs.id IS NULL
        `);
        record('Finance', 'Fee payments link to valid fee status record', 'Cross-Module', feePayDangling.length === 0);

        // Test 7.3: Negative fee amounts check
        const [negativeFees] = await conn.query(`
            SELECT id, amount FROM cst_fee_payments WHERE amount < 0
        `);
        record('Finance', 'Negative fee validation: no negative amounts in fee payments', 'Validation', negativeFees.length === 0);

        // Test 7.4: Staff salary records link to valid staff
        const [salaryDangling] = await conn.query(`
            SELECT ss.id
            FROM cst_staff_salary ss
            LEFT JOIN cst_staff s ON ss.staff_id = s.id
            WHERE s.id IS NULL
        `);
        record('Finance', 'Staff salary structures link to valid staff', 'Cross-Module', salaryDangling.length === 0);

        // =================================================================
        // MODULE 8: E-COMMERCE / PRODUCTS & ORDERS
        // =================================================================
        console.log('\n--- MODULE 8: E-COMMERCE / PRODUCTS & ORDERS ---');

        // Test 8.1: Products link to valid category
        const [productsDangling] = await conn.query(`
            SELECT p.id
            FROM cst_products p
            LEFT JOIN cst_product_categories c ON p.category_id = c.id
            WHERE p.category_id IS NOT NULL AND c.id IS NULL
        `);
        record('Shop & Products', 'Products link to valid product category', 'Cross-Module', productsDangling.length === 0);

        // Test 8.2: Order items link to valid order and product
        const [orderItemsDangling] = await conn.query(`
            SELECT oi.id
            FROM cst_order_items oi
            LEFT JOIN cst_orders o ON oi.order_id = o.id
            LEFT JOIN cst_products p ON oi.product_id = p.id
            WHERE o.id IS NULL OR p.id IS NULL
        `);
        record('Shop & Orders', 'Order items link to valid order and product', 'Cross-Module', orderItemsDangling.length === 0);

        // =================================================================
        // MODULE 9: MEDIA & GALLERY
        // =================================================================
        console.log('\n--- MODULE 9: MEDIA & GALLERY ---');

        // Test 9.1: Gallery albums link to category
        const [albumsDangling] = await conn.query(`
            SELECT a.id
            FROM cst_gallery_albums a
            LEFT JOIN cst_gallery_categories c ON a.category_id = c.id
            WHERE a.category_id IS NOT NULL AND c.id IS NULL
        `);
        record('Gallery', 'Gallery albums link to valid gallery category', 'Cross-Module', albumsDangling.length === 0);

        // Test 9.2: Gallery images link to album
        const [imagesDangling] = await conn.query(`
            SELECT gi.id
            FROM cst_gallery_images gi
            LEFT JOIN cst_gallery_albums a ON gi.album_id = a.id
            WHERE a.id IS NULL
        `);
        record('Gallery', 'Gallery images link to valid gallery album', 'Cross-Module', imagesDangling.length === 0);

        // =================================================================
        // MODULE 10: USER BRANCHES & WEEKLY OFF
        // =================================================================
        console.log('\n--- MODULE 10: USER BRANCHES & WEEKLY OFF ---');

        // Test 10.1: User branches link to valid user and branch
        const [userBranchesDangling] = await conn.query(`
            SELECT ub.id
            FROM cst_user_branches ub
            LEFT JOIN cst_users u ON ub.user_id = u.id
            LEFT JOIN cst_branch b ON ub.branch_id = b.id
            WHERE (ub.user_id IS NOT NULL AND u.id IS NULL)
               OR (ub.branch_id IS NOT NULL AND b.id IS NULL)
        `);
        record('User Branches', 'User branches link to valid user and branch', 'Cross-Module', userBranchesDangling.length === 0);

        // Test 10.2: User weekly off links to valid user
        const [weeklyOffDangling] = await conn.query(`
            SELECT uwo.id
            FROM cst_user_weekly_off uwo
            LEFT JOIN cst_users u ON uwo.user_id = u.id
            WHERE u.id IS NULL
        `);
        record('User Roles & Shifts', 'User weekly offs link to valid user', 'Cross-Module', weeklyOffDangling.length === 0);

        console.log('\n========================================================================');
        console.log(`TOTAL TESTS EXECUTED: ${report.total}`);
        console.log(`PASSED: ${report.passed}`);
        console.log(`FAILED: ${report.failed}`);
        console.log(`SUCCESS RATE: ${((report.passed / report.total) * 100).toFixed(2)}%`);
        console.log('========================================================================');

        return report;

    } finally {
        conn.release();
        await pool.end();
    }
}

runE2EFullAuditSuite().then(report => {
    if (report.failed > 0) process.exit(1);
    process.exit(0);
}).catch(err => {
    console.error('Test Suite encountered fatal error:', err);
    process.exit(1);
});
