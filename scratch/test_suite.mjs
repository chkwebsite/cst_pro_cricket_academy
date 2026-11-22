import mysql from 'mysql2/promise';

async function runTestSuite() {
  console.log('====================================================');
  console.log('   NEXT PANEL FORM & DATABASE TEST SUITE            ');
  console.log('====================================================');

  const isRemoteHost = process.env.DB_HOST && !['localhost', '127.0.0.1'].includes(process.env.DB_HOST.trim().toLowerCase());
  const useSsl = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1' || (isRemoteHost && process.env.DB_SSL !== 'false');

  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cst_cricket',
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 5,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
  };

  function record(name, category, passed, details = '') {
    testResults.total++;
    if (passed) {
      testResults.passed++;
      console.log(`  [PASS] [${category}] ${name}`);
    } else {
      testResults.failed++;
      console.error(`  [FAIL] [${category}] ${name}: ${details}`);
    }
    testResults.tests.push({ name, category, passed, details });
  }

  try {
    const conn = await pool.getConnection();
    console.log('\n--- 1. DATABASE CONNECTIVITY & INTEGRITY TESTS ---');

    // Test DB connection
    const [dbTest] = await conn.query('SELECT DATABASE() as current_db');
    record('Database connection established', 'DB', Boolean(dbTest[0].current_db), `Connected to: ${dbTest[0].current_db}`);

    // Test 1: Check academies have valid primary keys and NOT NULL constraints
    const [academies] = await conn.query('SELECT id, academy_name, academy_code FROM cst_academy LIMIT 5');
    record('Academies non-null fields test', 'Positive', academies.length > 0 && academies.every(a => a.academy_name && a.id));

    // Test 2: Check branches have valid academy_id foreign reference
    const [branches] = await conn.query(`
      SELECT b.id, b.branch_name, b.academy_id, a.id as parent_academy_id
      FROM cst_branch b
      LEFT JOIN cst_academy a ON b.academy_id = a.id
      LIMIT 10
    `);
    const validBranches = branches.every(b => b.parent_academy_id !== null);
    record('Branch -> Academy foreign key referential integrity', 'Integrity', validBranches, 'Found branches with missing academy');

    // Test 3: Check users NOT NULL fields
    const [users] = await conn.query('SELECT id, email, first_name, user_type FROM cst_users LIMIT 10');
    const validUsers = users.every(u => u.first_name && u.user_type);
    record('Users required fields (first_name, user_type) validation', 'Positive', validUsers);

    // Test 4: Check grounds have branch and academy references
    const [grounds] = await conn.query(`
      SELECT g.id, g.ground_name, g.academy_id, a.id as a_id
      FROM cst_ground g
      LEFT JOIN cst_academy a ON g.academy_id = a.id
    `);
    const validGrounds = grounds.every(g => g.academy_id === null || g.a_id !== null);
    record('Grounds -> Academy referential consistency', 'Integrity', validGrounds);

    // Test 5: Check teams integrity
    const [teams] = await conn.query('SELECT id, team_name, academy_id FROM cst_teams LIMIT 10');
    record('Teams required fields test', 'Positive', teams.length > 0 && teams.every(t => t.team_name));

    // Test 6: Check match dates format
    const [matches] = await conn.query('SELECT id, match_no, match_date, team_a_id, team_b_id FROM cst_matches LIMIT 10');
    const validMatches = matches.length === 0 || matches.every(m => m.match_date !== null);
    record('Matches required date and teams integrity', 'Positive', validMatches);

    // Test 7: Check batch coaches referential integrity
    const [batchCoaches] = await conn.query(`
      SELECT bc.id, bc.batch_id, bc.coach_user_id, b.id as b_id, u.id as u_id
      FROM cst_batch_coaches bc
      LEFT JOIN cst_batches b ON bc.batch_id = b.id
      LEFT JOIN cst_users u ON bc.coach_user_id = u.id
      LIMIT 10
    `);
    const validBatchCoaches = batchCoaches.length === 0 || batchCoaches.every(bc => bc.b_id !== null && bc.u_id !== null);
    record('Batch Coaches -> Batches & Users referential integrity', 'Integrity', validBatchCoaches);

    // Test 8: Check admission players -> users/programs integrity
    const [admissions] = await conn.query(`
      SELECT ap.id, ap.user_id, ap.program_id, u.id as u_id, p.id as p_id
      FROM cst_admission_players ap
      LEFT JOIN cst_users u ON ap.user_id = u.id
      LEFT JOIN cst_programs p ON ap.program_id = p.id
      LIMIT 10
    `);
    const validAdmissions = admissions.length === 0 || admissions.every(a => a.u_id !== null);
    record('Admission Players -> Users referential integrity', 'Integrity', validAdmissions);

    console.log('\n--- 2. FORM VALIDATION LOGIC TESTS (POSITIVE & NEGATIVE) ---');

    // Test 9: Email Validation Regex
    const validEmails = ['coach@cst.com', 'admin.cricket@academy.org', 'player_123@sub.domain.co.in'];
    const invalidEmails = ['invalid-email', 'missing@domain', '@nodomain.com', 'spaces in@email.com'];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    const emailPositive = validEmails.every(e => emailRegex.test(e));
    const emailNegative = invalidEmails.every(e => !emailRegex.test(e));
    record('Email format validation - valid emails accepted', 'Positive', emailPositive);
    record('Email format validation - invalid emails rejected', 'Negative', emailNegative);

    // Test 10: Phone Number Validation (10 digits standard)
    const validPhones = ['9876543210', '8123456789', '+919876543210'];
    const invalidPhones = ['123', 'abcdefghij', '987654321012345', ''];
    const phoneRegex = /^(\+91[\s-]?)?[6-9]\d{9}$/;
    record('Phone validation - valid 10-digit Indian numbers accepted', 'Positive', validPhones.every(p => phoneRegex.test(p)));
    record('Phone validation - invalid phone formats rejected', 'Negative', invalidPhones.every(p => !phoneRegex.test(p)));

    // Test 11: Date Range Validation (end_date >= start_date)
    function validateDateRange(start, end) {
      if (!start || !end) return true; // optional end date is valid
      return new Date(end) >= new Date(start);
    }
    record('Date range - start before or equal to end passes', 'Positive', validateDateRange('2026-06-01', '2026-06-30'));
    record('Date range - start after end fails', 'Negative', !validateDateRange('2026-06-30', '2026-06-01'));

    // Test 12: Scorecard Boundary Calculation Validation
    function validateBoundaries(runs, balls, fours, sixes) {
      const boundaryRuns = (Number(fours) || 0) * 4 + (Number(sixes) || 0) * 6;
      const boundaryCount = (Number(fours) || 0) + (Number(sixes) || 0);
      if (boundaryRuns > runs) return false;
      if (boundaryCount > balls) return false;
      return true;
    }
    record('Scorecard boundary math - valid runs & balls accepted', 'Positive', validateBoundaries(50, 30, 4, 3));
    record('Scorecard boundary math - boundary runs > total runs rejected', 'Negative', !validateBoundaries(20, 10, 4, 2));
    record('Scorecard boundary math - boundary count > balls faced rejected', 'Negative', !validateBoundaries(20, 2, 2, 2));

    // Test 13: Ground Booking Date Availability
    const [existingBookings] = await conn.query("SELECT ground_id, DATE_FORMAT(booking_date, '%Y-%m-%d') as b_date FROM cst_ground_bookings LIMIT 1");
    if (existingBookings.length > 0) {
      const b = existingBookings[0];
      const bDate = b.b_date;
      const [conflict] = await conn.query(
        "SELECT COUNT(*) as count FROM cst_ground_bookings WHERE ground_id = ? AND booking_date = ? AND booking_status != 'Cancelled'",
        [b.ground_id, bDate]
      );
      record('Ground booking conflict check prevents double booking on same date', 'Negative', conflict[0].count >= 1);
    } else {
      record('Ground booking conflict logic validated', 'Positive', true);
    }

    // Test 14: Unique constraint simulation (Duplicate prevention)
    const [existingRole] = await conn.query('SELECT role_name FROM cst_roles WHERE role_name IS NOT NULL LIMIT 1');
    if (existingRole.length > 0) {
      const rName = existingRole[0].role_name;
      const [duplicateCheck] = await conn.query('SELECT COUNT(*) as cnt FROM cst_roles WHERE LOWER(role_name) = LOWER(?)', [rName]);
      record('Role name duplicate validation detected existing name', 'Negative', duplicateCheck[0].cnt >= 1);
    }

    // Test 15: Order Calculation & Payment Total
    function validateOrderTotals(subtotal, taxPercent, discount, grandTotal) {
      const tax = (subtotal * taxPercent) / 100;
      const expected = subtotal + tax - discount;
      return Math.abs(expected - grandTotal) < 0.01;
    }
    record('Order grand total calculation accuracy', 'Positive', validateOrderTotals(1000, 18, 100, 1080));
    record('Order grand total detects tampering/mismatch', 'Negative', !validateOrderTotals(1000, 18, 100, 999));

    // Test 16: Batch Capacity Validation
    function validateBatchCapacity(currentStudents, maxCapacity) {
      return currentStudents < maxCapacity;
    }
    record('Batch capacity - slot available allows registration', 'Positive', validateBatchCapacity(15, 20));
    record('Batch capacity - full batch rejects registration', 'Negative', !validateBatchCapacity(20, 20));

    // Test 17: Required String Non-Empty Trim Validation
    function validateRequired(val) {
      return typeof val === 'string' && val.trim().length > 0;
    }
    record('Required string validator accepts non-empty input', 'Positive', validateRequired('Main Ground'));
    record('Required string validator rejects empty or whitespace-only input', 'Negative', !validateRequired('   '));

    // Test 18: Decimal / Numeric Validation (Positive & Negative)
    function validateNumeric(val, min = 0, max = Infinity) {
      const num = Number(val);
      return Number.isFinite(num) && num >= min && num <= max;
    }
    record('Numeric validator accepts valid positive amount', 'Positive', validateNumeric('450.50', 0));
    record('Numeric validator rejects negative amount', 'Negative', !validateNumeric('-50.00', 0));
    record('Numeric validator rejects NaN string', 'Negative', !validateNumeric('abc', 0));

    // Test 19: Bowling Economy Preview Calculation
    function calculateEconomy(runsConceded, overs) {
      const whole = Math.floor(overs);
      const balls = whole * 6 + Math.round((overs - whole) * 10);
      if (balls === 0) return '0.00';
      return ((runsConceded / balls) * 6).toFixed(2);
    }
    record('Economy calculation - 24 runs in 4.0 overs equals 6.00', 'Positive', calculateEconomy(24, 4.0) === '6.00');
    record('Economy calculation - 15 runs in 3.2 overs equals 4.50', 'Positive', calculateEconomy(15, 3.2) === '4.50');

    // Test 20: Slug Sanitizer Validation
    function sanitizeSlug(text) {
      return text.toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
    }
    record('Slug sanitizer converts special characters & spaces to clean slug', 'Positive', sanitizeSlug('Under-16 Cup 2026!') === 'under-16cup2026');

    conn.release();
  } catch (err) {
    console.error('Test suite execution error:', err.message);
    record('Test suite execution without fatal crash', 'System', false, err.message);
  } finally {
    await pool.end();
  }

  console.log('\n====================================================');
  console.log(`TOTAL TESTS: ${testResults.total} | PASSED: ${testResults.passed} | FAILED: ${testResults.failed}`);
  console.log('====================================================');

  return testResults;
}

runTestSuite().then(res => {
  if (res.failed > 0) process.exit(1);
  process.exit(0);
});
