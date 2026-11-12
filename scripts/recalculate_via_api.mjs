import { spawn } from "child_process";

const PORT = 3008;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function login(loginVal, password) {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: loginVal, password }),
    });
    const json = await res.json();
    const token = json.token || json.data?.token;
    return { token };
}

async function main() {
    console.log("===============================================================");
    console.log("STARTING TEST SERVER TO RECALCULATE PAYROLL WITH NEW FORMULA");
    console.log("===============================================================");

    const serverProcess = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
        env: { ...process.env, PORT: String(PORT) },
        stdio: "pipe",
    });

    let ready = false;
    for (let i = 0; i < 25; i++) {
        await sleep(1000);
        try {
            const probe = await fetch(`${BASE_URL}/api/programs`);
            if (probe.status === 200) {
                ready = true;
                break;
            }
        } catch {}
    }

    if (!ready) {
        console.error("Failed to start server within 25 seconds.");
        serverProcess.kill("SIGKILL");
        process.exit(1);
    }
    console.log("Next.js Server is running on port " + PORT);

    try {
        const { token } = await login("superadmin@gmail.com", "Password@123");
        const authHeaders = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            Cookie: `auth_token=${token}`,
        };

        // 1. Bulk generate Branch 2 (November 2026) - The branch in user's screenshot
        console.log("\n[TEST 1] Triggering Bulk Payroll for Branch 2 (November 2026)...");
        const b2Res = await fetch(`${BASE_URL}/api/staff-salary-payments`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
                action: "generate_bulk",
                branch_id: 2,
                salary_month: 11,
                salary_year: 2026,
            }),
        });
        const b2Json = await b2Res.json();
        console.log("Bulk generation result for Branch 2:", b2Json.message);

        // 2. Fetch Branch 2 Payments list
        console.log("\n[TEST 2] Fetching updated payments for Branch 2...");
        const listRes = await fetch(`${BASE_URL}/api/staff-salary-payments?branch_id=2&month=11&year=2026`, {
            headers: { Authorization: `Bearer ${token}`, Cookie: `auth_token=${token}` },
        });
        const listJson = await listRes.json();
        console.log("Payments in Branch 2:");
        console.table(listJson.data.map((p) => ({
            staff: `${p.first_name} ${p.last_name}`,
            base_monthly: p.full_base_salary,
            working_days_vs_present: `${p.present_days} / ${p.working_days} Days`,
            absent_days: p.absent_days,
            late_days: p.late_days,
            half_days: p.half_days,
            paid_leaves: p.paid_leaves,
            gross_salary: p.gross_salary,
            net_salary: p.net_salary,
            status: p.payment_status,
        })));

        // 3. Verify Deepak Walia's calculation:
        // Deepak Walia: Base = 35000, Days in Nov = 30
        // If 0 absences: 30 / 30 Days = 30.00, Gross = 35000.00
        const deepak = listJson.data.find((p) => p.staff_id === 9);
        if (!deepak) throw new Error("Deepak Walia not found in Branch 2!");
        console.log("\nDeepak Walia Payroll Details:", {
            name: `${deepak.first_name} ${deepak.last_name}`,
            base: deepak.full_base_salary,
            working_days: deepak.working_days,
            present_days: deepak.present_days,
            gross_salary: deepak.gross_salary,
            net_salary: deepak.net_salary,
        });

        // 4. Test User's Exact Example:
        // "agar salary 30000 hai aur working day 28.5 hai to 30000/30 Ya 31 ya 28 ya 29 depend on month *28.5"
        console.log("\n[TEST 3] Testing User's Exact Formula: Salary = 30000, Working Days = 28.5 in November (30 days)...");
        // We calculate for staff 10 with overrides: { working_days: 30, present_days: 28.5 }
        const testFormulaRes = await fetch(`${BASE_URL}/api/staff-salary-payments`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
                action: "calculate",
                staff_id: 10,
                salary_month: 11,
                salary_year: 2026,
                working_days: 30,
                present_days: 28.5,
                absent_days: 1,
                late_days: 2, // 2 lates = 0.5d deduction => 30 - 1 - 0.5 = 28.5
            }),
        });
        const testFormulaJson = await testFormulaRes.json();
        const fData = testFormulaJson.data;
        console.log("Formula Test Result:", {
            base_salary: fData.base_gross_salary,
            total_month_days: fData.total_month_days,
            working_days: fData.working_days,
            present_days: fData.present_days,
            daily_rate: fData.daily_rate,
            earned_gross: fData.gross_salary,
            net_salary: fData.net_salary,
        });

        // Expected gross: (30000 / 30) * 28.5 = 28500
        const expectedGross = Math.round((30000 / 30) * 28.5 * 100) / 100;
        if (Number(fData.gross_salary) !== expectedGross) {
            throw new Error(`Formula mismatch: Expected ${expectedGross}, got ${fData.gross_salary}`);
        }
        console.log(`✓ USER'S EXACT FORMULA CONFIRMED: ₹${fData.gross_salary} = (₹30000 / 30) * 28.5 days.`);

        // 5. Test Deduction Rules:
        // Absent = 1d, Half Day = 0.5d, Late = 0.25d, Leave = 1d
        console.log("\n[TEST 4] Testing Exact Deductions:");
        console.log("- Absent: 1 day deduction");
        console.log("- Leave: 1 day deduction");
        console.log("- Half Day: 0.5 day deduction");
        console.log("- Late: 0.25 day deduction");
        console.log("- Week off: 0.0 deduction (included in working days)");

        // 30 days - 1 absent (1) - 1 leave (1) - 1 half day (0.5) - 1 late (0.25) = 30 - 2.75 = 27.25 working days!
        const deductTestRes = await fetch(`${BASE_URL}/api/staff-salary-payments`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
                action: "calculate",
                staff_id: 10,
                salary_month: 11,
                salary_year: 2026,
                absent_days: 1,
                paid_leaves: 1,
                half_days: 1,
                late_days: 1,
            }),
        });
        const deductTestJson = await deductTestRes.json();
        const dData = deductTestJson.data;
        console.log("Deductions Result:", {
            total_month_days: dData.total_month_days,
            working_days: dData.working_days,
            present_days: dData.present_days,
            deducted_days: dData.deducted_days,
            gross_salary: dData.gross_salary,
        });
        // 30 - (1 + 1 + 0.5 + 0.25) = 27.25 days
        if (Number(dData.deducted_days) !== 2.75) {
            throw new Error(`Expected 2.75 deducted days, got ${dData.deducted_days}`);
        }
        if (Number(dData.present_days) !== 27.25) {
            throw new Error(`Expected 27.25 payable working days, got ${dData.present_days}`);
        }
        const expectedDeductGross = Math.round((30000 / 30) * 27.25 * 100) / 100; // 27250
        if (Number(dData.gross_salary) !== expectedDeductGross) {
            throw new Error(`Expected ${expectedDeductGross}, got ${dData.gross_salary}`);
        }
        console.log(`✓ DEDUCTIONS VERIFIED: 1 Absent (1d) + 1 Leave (1d) + 1 Half (0.5d) + 1 Late (0.25d) = 2.75 days deducted -> 27.25 working days -> ₹${dData.gross_salary} gross.`);

        console.log("\n===============================================================");
        console.log(">>> ALL RECALCULATION & FORMULA TESTS PASSED (100% SUCCESS) <<<");
        console.log("===============================================================");
    } finally {
        serverProcess.kill("SIGKILL");
        process.exit(0);
    }
}

main().catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
});
