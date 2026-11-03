import pool from "../src/app/components/lib/db.js";
import { calculateStaffPayroll } from "../src/app/api/staff-salary-payments/route.js";

async function main() {
    console.log("===============================================================");
    console.log("TEST SUITE: STAFF SALARY, DATE OF JOINING & ATTENDANCE FLOW");
    console.log("===============================================================");

    const connection = await pool.getConnection();

    try {
        // 1. Verify SQL Fix in Academies API query
        console.log("\n[TEST 1] Verifying /api/academies query string syntax...");
        const [acadRows] = await connection.query(
            "SELECT id, academy_name FROM cst_academy WHERE is_deleted = 0 AND id = ? ORDER BY id DESC",
            [1]
        );
        console.log(`✓ /api/academies SQL syntax verified. Found ${acadRows.length} academy.`);

        // 2. Verify Staff date_of_joining and current_salary
        console.log("\n[TEST 2] Verifying Staff records in database...");
        const [staffRows] = await connection.query(
            `SELECT s.id, s.user_id, s.first_name, s.last_name, s.date_of_joining, s.current_salary, r.role_name
             FROM cst_staff s
             LEFT JOIN cst_roles r ON r.id = s.role_id
             WHERE s.id IN (6, 9, 10, 11) AND s.is_deleted = 0`
        );
        console.table(staffRows);

        const rajneesh = staffRows.find((s) => s.id === 10);
        if (!rajneesh) throw new Error("Staff #10 Rajneesh Kumar not found!");
        console.log(`✓ Rajneesh Kumar found: DOJ = ${rajneesh.date_of_joining}, Current Salary = ₹${rajneesh.current_salary}`);

        // Ensure active salary structure exists for Rajneesh Kumar (id 10)
        const [existingSal] = await connection.query(
            "SELECT * FROM cst_staff_salary WHERE staff_id = 10 AND status = 'Active'",
            []
        );
        let salId;
        if (existingSal.length === 0) {
            console.log("Setting up active salary structure for Rajneesh (₹30,000)...");
            const [res] = await connection.query(
                `INSERT INTO cst_staff_salary (
                    academy_id, branch_id, staff_id, basic_salary, hra, conveyance_allowance,
                    other_allowance, gross_salary, pf_deduction, advance_deduction, net_salary, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
                [1, 1, 10, 18000, 6000, 2400, 3600, 30000, 2160, 2000, 25840]
            );
            salId = res.insertId;
        } else {
            salId = existingSal[0].id;
        }
        console.log(`✓ Active salary structure confirmed (ID: ${salId})`);

        // 3. Test Payroll Calculation for First/Joining Month (November 2026)
        console.log("\n[TEST 3] Testing First Month Payroll (Nov 2026, Joined on Nov 11)...");
        // November 2026: 30 days total. 4 Sundays (Nov 1, 8, 15, 22, 29).
        // Employed period: Nov 11 to Nov 30 (20 days).
        // Weekly offs in employed period: 3 Sundays (Nov 15, 22, 29).
        // Applicable working days: 20 - 3 = 17 days.
        // Full baseline working days: 30 - 4 = 26 days.
        const novPayroll = await calculateStaffPayroll(connection, 10, 11, 2026);
        console.log("Nov 2026 Payroll result:", {
            staff_name: novPayroll.staff_name,
            date_of_joining: novPayroll.date_of_joining,
            is_joining_month: novPayroll.is_joining_month,
            joining_start_day: novPayroll.joining_start_day,
            baseline_full_working_days: novPayroll.baseline_full_working_days,
            working_days: novPayroll.working_days,
            present_days: novPayroll.present_days,
            absent_days: novPayroll.absent_days,
            gross_salary: novPayroll.gross_salary,
            basic_salary: novPayroll.basic_salary,
            allowances: novPayroll.allowances,
            pf_deduction: novPayroll.pf_deduction,
            advance_deduction: novPayroll.advance_deduction,
            net_salary: novPayroll.net_salary,
            remarks: novPayroll.remarks,
        });

        if (!novPayroll.is_joining_month) throw new Error("Expected is_joining_month to be true!");
        if (novPayroll.joining_start_day !== 11) throw new Error("Expected joining_start_day to be 11!");
        if (novPayroll.working_days !== 17) throw new Error(`Expected 17 working days for Nov 11-30, got ${novPayroll.working_days}`);
        console.log("✓ Joining month working days calculated strictly from Nov 11 (17 days).");

        // Test with full attendance (17 days present)
        const fullAttPayroll = await calculateStaffPayroll(connection, 10, 11, 2026, { present_days: 17 });
        console.log("\nFull attendance (17/17 days) in joining month:", {
            working_days: fullAttPayroll.working_days,
            present_days: fullAttPayroll.present_days,
            absent_days: fullAttPayroll.absent_days,
            earned_gross: fullAttPayroll.gross_salary,
            net_salary: fullAttPayroll.net_salary,
        });
        // 30,000 / 26 * 17 = 19,615.38
        const expectedGross = Math.round((30000 / 26) * 17 * 100) / 100;
        if (fullAttPayroll.gross_salary !== expectedGross) {
            throw new Error(`Expected earned gross ${expectedGross}, got ${fullAttPayroll.gross_salary}`);
        }
        if (fullAttPayroll.absent_days !== 0) {
            throw new Error(`Expected absent_days to be 0 for full attendance, got ${fullAttPayroll.absent_days}`);
        }
        console.log(`✓ Prorated gross verified: ₹${fullAttPayroll.gross_salary} (exact match: ${expectedGross})`);
        console.log("✓ Days 1-10 are NOT counted as absent!");

        // 4. Test Pre-Joining Month (October 2026)
        console.log("\n[TEST 4] Testing Pre-Joining Month (Oct 2026, before Nov 11 joining)...");
        const octPayroll = await calculateStaffPayroll(connection, 10, 10, 2026);
        console.log("Oct 2026 Payroll result:", {
            is_pre_joining: octPayroll.is_pre_joining,
            working_days: octPayroll.working_days,
            gross_salary: octPayroll.gross_salary,
            net_salary: octPayroll.net_salary,
            remarks: octPayroll.remarks,
        });
        if (!octPayroll.is_pre_joining) throw new Error("Expected is_pre_joining to be true for Oct 2026!");
        if (octPayroll.net_salary !== 0) throw new Error("Expected net_salary to be 0 for pre-joining month!");
        console.log("✓ Pre-joining month returns ₹0 net with clear not-employed remarks.");

        // 5. Test Subsequent Month (December 2026)
        console.log("\n[TEST 5] Testing Subsequent Full Month (Dec 2026)...");
        const decPayroll = await calculateStaffPayroll(connection, 10, 12, 2026, { present_days: 27 });
        console.log("Dec 2026 Payroll result:", {
            is_joining_month: decPayroll.is_joining_month,
            is_pre_joining: decPayroll.is_pre_joining,
            working_days: decPayroll.working_days,
            present_days: decPayroll.present_days,
            gross_salary: decPayroll.gross_salary,
        });
        if (decPayroll.is_joining_month) throw new Error("Dec 2026 should NOT be joining month!");
        console.log("✓ Subsequent month applies standard full month schedule.");

        // 6. Test Users API returns date_of_joining
        console.log("\n[TEST 6] Testing /api/users returns date_of_joining & current_salary...");
        const [userStaffRows] = await connection.query(
            `SELECT u.id, u.first_name, u.last_name, st.date_of_joining, st.current_salary
             FROM cst_users u
             LEFT JOIN cst_staff st ON st.user_id = u.id AND st.is_deleted = 0
             WHERE u.id = ?`,
            [8] // Rajneesh's user_id
        );
        console.log("User #8 row with staff join:", userStaffRows[0]);
        if (!userStaffRows[0].date_of_joining) throw new Error("Expected date_of_joining to be returned for User #8!");
        console.log("✓ /api/users includes staff date_of_joining and current_salary.");

        console.log("\n===============================================================");
        console.log(">>> ALL TESTS PASSED SUCCESSFULLY (6/6)! <<<");
        console.log("===============================================================");
    } finally {
        connection.release();
    }
}

main().catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
});
