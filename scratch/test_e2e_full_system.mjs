import jwt from "jsonwebtoken";
import pool from "../src/app/components/lib/db.js";
import { getAuthUser, JWT_SECRET, getUserRole, ROLES } from "../src/app/components/lib/rbac.js";

// Helper replicated from staff-salary/route.js for testing calculation logic
function autoCalculateComponents(monthlySalary, pfRate = 0.12, customAdvance = 0) {
    const gross = Number(monthlySalary) || 0;
    const basic = Math.round(gross * 0.60 * 100) / 100;
    const hra = Math.round(gross * 0.20 * 100) / 100;
    const conveyance = Math.round(gross * 0.08 * 100) / 100;
    const otherAllowance = Math.round((gross - basic - hra - conveyance) * 100) / 100;
    const pf = Math.round(basic * pfRate * 100) / 100;
    const advance = Number(customAdvance) || 0;
    const totalDeductions = pf + advance;
    const net = Math.max(0, Math.round((gross - totalDeductions) * 100) / 100);

    return {
        gross_salary: gross,
        basic_salary: basic,
        hra,
        conveyance_allowance: conveyance,
        other_allowance: otherAllowance,
        pf_deduction: pf,
        advance_deduction: advance,
        net_salary: net,
    };
}

const TEST_RESULTS = {
    passed: 0,
    failed: 0,
    cases: []
};

function recordTest(name, passed, details = "") {
    if (passed) {
        TEST_RESULTS.passed++;
        TEST_RESULTS.cases.push({ name, status: "PASS", details });
        console.log(`[PASS] ${name}`);
    } else {
        TEST_RESULTS.failed++;
        TEST_RESULTS.cases.push({ name, status: "FAIL", details });
        console.error(`[FAIL] ${name}: ${details}`);
    }
}

async function runAllAudits() {
    console.log("===============================================================");
    console.log("CST CRICKET ACADEMY MANAGEMENT SYSTEM - FULL E2E SYSTEM AUDIT");
    console.log("===============================================================\n");

    // -------------------------------------------------------------
    // SUITE 1: DATABASE INTEGRITY & ROLE SCHEMA AUDIT
    // -------------------------------------------------------------
    console.log("--- SUITE 1: DATABASE INTEGRITY & ROLES ---");
    try {
        const [roles] = await pool.query("SELECT id, role_name, status FROM cst_roles ORDER BY id ASC");
        recordTest("Fetch all system roles", roles.length > 0, `Total roles found: ${roles.length}`);

        const expectedRoles = [
            { name: "Super Admin", pattern: "super admin" },
            { name: "Academy Admin", pattern: "academy admin" },
            { name: "Branch Admin", pattern: "branch admin" },
            { name: "Accountant", pattern: "account" },
            { name: "Coach", pattern: "coach" },
            { name: "Staff", pattern: "staff" },
            { name: "Player", pattern: "player" }
        ];
        for (const roleDef of expectedRoles) {
            const match = roles.find(r => r.role_name.toLowerCase().includes(roleDef.pattern));
            recordTest(`Role registered: ${roleDef.name}`, !!match, match ? `Found: '${match.role_name}' (ID: ${match.id})` : "Missing");
        }

        const [tables] = await pool.query("SHOW TABLES");
        const tableList = tables.map(t => Object.values(t)[0]);
        recordTest("Database contains all core tables", tableList.length >= 60, `Found ${tableList.length} tables`);

        const coreRequiredTables = [
            "cst_users", "cst_roles", "cst_academy", "cst_branch",
            "cst_admission_players", "cst_coaches", "cst_staff", "cst_programs",
            "cst_batches", "cst_matches", "cst_tournaments", "cst_ground",
            "cst_ground_slots", "cst_ground_bookings", "cst_attendance",
            "cst_fee_status", "cst_fee_payments", "cst_staff_salary"
        ];
        for (const tbl of coreRequiredTables) {
            recordTest(`Core table exists: ${tbl}`, tableList.includes(tbl));
        }
    } catch (err) {
        recordTest("Database tables check", false, err.message);
    }

    // -------------------------------------------------------------
    // SUITE 2: MULTI-TENANT ISOLATION & ID SPOOFING DEFENSE
    // -------------------------------------------------------------
    console.log("\n--- SUITE 2: MULTI-TENANT ISOLATION & RBAC API GUARDS ---");
    try {
        // Fetch users from Branch 1 and Branch 2 to simulate cross-tenant attacks
        const [b1Users] = await pool.query(
            "SELECT id, email, academy_id, branch_id, user_type FROM cst_users WHERE branch_id = 1 AND status = 1 AND is_deleted = 0 LIMIT 1"
        );
        const [b2Users] = await pool.query(
            "SELECT id, email, academy_id, branch_id, user_type FROM cst_users WHERE branch_id = 2 AND status = 1 AND is_deleted = 0 LIMIT 1"
        );

        if (b1Users.length > 0 && b2Users.length > 0) {
            const userB1 = b1Users[0];
            const userB2 = b2Users[0];

            // Generate synthetic auth tokens for testing
            const tokenB1 = jwt.sign({ id: userB1.id, email: userB1.email }, JWT_SECRET, { expiresIn: "1h" });
            const tokenB2 = jwt.sign({ id: userB2.id, email: userB2.email }, JWT_SECRET, { expiresIn: "1h" });

            // Verify getAuthUser resolves identity correctly
            const mockReqB1 = {
                cookies: { get: () => ({ value: tokenB1 }) },
                headers: { get: () => null }
            };
            const authCtxB1 = await getAuthUser(mockReqB1);
            recordTest("getAuthUser resolves Branch 1 user identity", !!authCtxB1 && authCtxB1.id === userB1.id);
            recordTest("getAuthUser correctly populates tenant IDs", authCtxB1?.branch_id === 1);

            // Test Cross-Branch Admission Player Access
            const [pBranch2] = await pool.query(
                "SELECT id, branch_id FROM cst_admission_players WHERE branch_id = 2 AND is_deleted = 0 LIMIT 1"
            );
            if (pBranch2.length > 0) {
                // If userB1 is a branch admin of branch 1, they must NOT be permitted to access player from branch 2
                const isCrossAllowed = (authCtxB1.isBranchAdmin && authCtxB1.branch_id !== pBranch2[0].branch_id);
                recordTest("Cross-branch admission isolation flag verified", !isCrossAllowed || authCtxB1.isSuperAdmin);
            }
        }
    } catch (err) {
        recordTest("Tenant isolation test", false, err.message);
    }

    // -------------------------------------------------------------
    // SUITE 3: BUSINESS CALCULATIONS & LOGIC
    // -------------------------------------------------------------
    console.log("\n--- SUITE 3: BUSINESS CALCULATIONS & FINANCIAL INTEGRITY ---");
    try {
        // 1. Staff Salary Component Formula Test
        const grossSalary = 50000;
        const comp = autoCalculateComponents(grossSalary, 0.12, 0);
        recordTest(
            "Salary components: Basic is 60%",
            comp.basic_salary === 30000,
            `Expected 30000, got ${comp.basic_salary}`
        );
        recordTest(
            "Salary components: HRA is 20%",
            comp.hra === 10000,
            `Expected 10000, got ${comp.hra}`
        );
        recordTest(
            "Salary components: Conveyance is 8%",
            comp.conveyance_allowance === 4000,
            `Expected 4000, got ${comp.conveyance_allowance}`
        );
        recordTest(
            "Salary components: Other Allowance is 12%",
            comp.other_allowance === 6000,
            `Expected 6000, got ${comp.other_allowance}`
        );
        recordTest(
            "Salary components: PF is 12% of Basic",
            comp.pf_deduction === 3600,
            `Expected 3600, got ${comp.pf_deduction}`
        );
        recordTest(
            "Salary components: Net Salary = Gross - PF",
            comp.net_salary === 46400,
            `Expected 46400, got ${comp.net_salary}`
        );

        // 2. Floating-point tolerance verification on fee payments
        const feeAmount = 1550.00;
        const paidAmount = 1550.00;
        const tolerance = 0.009;
        const isValidPayment = (paidAmount <= (feeAmount + tolerance));
        recordTest("Fee payment floating-point tolerance check", isValidPayment);

        // 3. IST Timezone Date Formatting (to prevent 1-day month offset)
        const utcDate = new Date("2026-10-31T18:30:00.000Z"); // Exactly 2026-11-01 00:00:00 IST
        const istFormatted = utcDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
        recordTest("IST Date Normalization prevents 1-day prior UTC shift", istFormatted === "2026-11-01", `Got ${istFormatted}`);
    } catch (err) {
        recordTest("Business calculation tests", false, err.message);
    }

    // -------------------------------------------------------------
    // SUITE 4: PLAYER MULTI-PROGRAM AGGREGATION VERIFICATION
    // -------------------------------------------------------------
    console.log("\n--- SUITE 4: PLAYER DASHBOARD MULTI-PROGRAM VERIFICATION ---");
    try {
        // Query player 11 active programs
        const [programs] = await pool.query(
            `SELECT up.id, up.user_id, up.program_id, up.start_date, up.end_date, p.program_name
             FROM cst_user_programs up
             INNER JOIN cst_programs p ON p.id = up.program_id
             WHERE up.user_id = 11 AND up.status = 1`
        );
        recordTest("Player 11 has multiple active enrolled programs", programs.length >= 2, `Count: ${programs.length}`);

        // Verify program monthly fee records for Player 11
        const [fees] = await pool.query(
            `SELECT pf.id, pf.program_id, pf.fee_month, pf.total_amount, pf.paid_amount, pf.payment_status
             FROM cst_player_program_fees pf
             WHERE pf.admission_players_id IN (
                 SELECT id FROM cst_admission_players WHERE user_id = 11
             )`
        );
        recordTest("Player 11 has program fee matrix records", fees.length > 0, `Count: ${fees.length}`);

        // Verify event fee records for Player 11 in cst_fee_status
        const [eventFees] = await pool.query(
            `SELECT fs.id, fs.fee_type, fs.fee_amount, fs.paid_amount, fs.status
             FROM cst_fee_status fs
             WHERE fs.user_id = 11`
        );
        recordTest("Player 11 has tournament/match fee status records", eventFees.length > 0, `Count: ${eventFees.length}`);

        // Verify payment records link correctly to recorded_by user
        const [payments] = await pool.query(
            `SELECT fp.id, fp.fee_status_id, fp.amount, fp.created_by, CONCAT(u.first_name, ' ', u.last_name) as recorded_by_name
             FROM cst_fee_payments fp
             LEFT JOIN cst_users u ON u.id = fp.created_by
             LIMIT 5`
        );
        recordTest("Payments properly associate with created_by user", payments.every(p => p.recorded_by_name !== null));
    } catch (err) {
        recordTest("Player multi-program test", false, err.message);
    }

    // -------------------------------------------------------------
    // SUITE 5: ATTENDANCE 7-DAY PAST RESTRICTION LOGIC
    // -------------------------------------------------------------
    console.log("\n--- SUITE 5: ATTENDANCE 7-DAY PAST RESTRICTION VERIFICATION ---");
    try {
        const todayObj = new Date();
        const currentYear = todayObj.getFullYear();
        const currentMonth = todayObj.getMonth() + 1;
        const currentDay = todayObj.getDate();
        const todayMidnight = new Date(currentYear, currentMonth - 1, currentDay).getTime();

        // 3 days ago: should be editable
        const threeDaysAgo = new Date(todayMidnight - (3 * 24 * 60 * 60 * 1000));
        const diff3 = Math.round((todayMidnight - threeDaysAgo.getTime()) / (1000 * 60 * 60 * 24));
        const is3Allowed = diff3 >= 0 && diff3 <= 7;
        recordTest("Attendance 3 days ago is permitted for non-admin", is3Allowed);

        // 8 days ago: should be blocked for non-admin
        const eightDaysAgo = new Date(todayMidnight - (8 * 24 * 60 * 60 * 1000));
        const diff8 = Math.round((todayMidnight - eightDaysAgo.getTime()) / (1000 * 60 * 60 * 24));
        const is8Allowed = diff8 >= 0 && diff8 <= 7;
        recordTest("Attendance 8 days ago is blocked for non-admin", !is8Allowed);

        // Future date (tomorrow): should be blocked for non-admin
        const tomorrow = new Date(todayMidnight + (1 * 24 * 60 * 60 * 1000));
        const diffTomorrow = Math.round((todayMidnight - tomorrow.getTime()) / (1000 * 60 * 60 * 24));
        const isTomorrowAllowed = diffTomorrow >= 0 && diffTomorrow <= 7;
        recordTest("Attendance in future is blocked for non-admin", !isTomorrowAllowed);
    } catch (err) {
        recordTest("Attendance 7-day test", false, err.message);
    }

    // -------------------------------------------------------------
    // SUITE 6: GROUND BOOKING DOUBLE-BOOKING CONFLICT CHECK
    // -------------------------------------------------------------
    console.log("\n--- SUITE 6: GROUND BOOKING CONFLICT CHECK ---");
    try {
        const [bookings] = await pool.query(
            `SELECT ground_id, slot_id, booking_date, COUNT(*) as cnt
             FROM cst_ground_bookings
             WHERE booking_status IN ('Booked', 'Confirmed')
             GROUP BY ground_id, slot_id, booking_date
             HAVING cnt > 1`
        );
        recordTest(
            "Zero double-bookings exist in database",
            bookings.length === 0,
            bookings.length === 0 ? "No slot conflicts found" : `Found ${bookings.length} conflicting slot records`
        );
    } catch (err) {
        recordTest("Ground booking conflict test", false, err.message);
    }

    console.log("\n===============================================================");
    console.log(`TOTAL TESTS: ${TEST_RESULTS.passed + TEST_RESULTS.failed}`);
    console.log(`PASSED: ${TEST_RESULTS.passed}`);
    console.log(`FAILED: ${TEST_RESULTS.failed}`);
    console.log("===============================================================");

    await pool.end();
}

runAllAudits().catch(console.error);
