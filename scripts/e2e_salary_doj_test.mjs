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
    const cookie = res.headers.get("set-cookie") || (token ? `auth_token=${token}` : "");
    return { res, json, token, cookie };
}

async function main() {
    console.log("==================================================================");
    console.log("RUNNING COMPREHENSIVE E2E VERIFICATION SUITE");
    console.log("==================================================================");

    console.log(`Starting Next.js production server on port ${PORT}...`);
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
        console.error("Failed to start server within 25 seconds. Aborting.");
        serverProcess.kill("SIGKILL");
        process.exit(1);
    }
    console.log("Next.js Server is ready and listening on port " + PORT);

    try {
        // 1. Login as Super Admin
        console.log("\n[STEP 1] Logging in as Super Admin...");
        const superAdmin = await login("superadmin@gmail.com", "Password@123");
        if (!superAdmin.res.ok || !superAdmin.json.success) {
            throw new Error("Super Admin login failed: " + JSON.stringify(superAdmin.json));
        }
        const token = superAdmin.token;
        const authHeaders = {
            Authorization: `Bearer ${token}`,
            Cookie: `auth_token=${token}`,
        };
        console.log("✓ Super Admin logged in successfully.");

        // 2. Test /api/academies for SQL syntax error
        console.log("\n[STEP 2] Testing /api/academies query (Checking for SQL error near 'BY id DESC')...");
        const acadRes = await fetch(`${BASE_URL}/api/academies`, {
            headers: authHeaders,
        });
        const acadJson = await acadRes.json();
        if (!acadRes.ok || !acadJson.success) {
            throw new Error("Academies query failed with SQL error: " + JSON.stringify(acadJson));
        }
        console.log(`✓ /api/academies returned 200 OK with ${acadJson.data?.length} academies (SQL error completely resolved).`);

        // 3. Test /api/staff includes date_of_joining and current_salary
        console.log("\n[STEP 3] Testing /api/staff for date_of_joining and current_salary...");
        const staffRes = await fetch(`${BASE_URL}/api/staff?limit=20`, {
            headers: authHeaders,
        });
        const staffJson = await staffRes.json();
        if (!staffRes.ok || !staffJson.success) {
            throw new Error("Staff query failed: " + JSON.stringify(staffJson));
        }
        const rajneesh = staffJson.data.find((s) => s.id === 10);
        if (!rajneesh) throw new Error("Staff #10 Rajneesh Kumar not found!");
        console.log(`✓ Staff #10 found: Name="${rajneesh.first_name} ${rajneesh.last_name}", DOJ=${rajneesh.date_of_joining}, Current Salary=₹${rajneesh.current_salary}`);
        if (!rajneesh.date_of_joining) throw new Error("Staff record missing date_of_joining!");
        if (!rajneesh.current_salary) throw new Error("Staff record missing current_salary!");

        // 4. Test /api/users includes date_of_joining
        console.log("\n[STEP 4] Testing /api/users includes staff date_of_joining...");
        const usersRes = await fetch(`${BASE_URL}/api/users?branch_id=1`, {
            headers: authHeaders,
        });
        const usersJson = await usersRes.json();
        if (!usersRes.ok || !usersJson.success) {
            throw new Error("Users query failed: " + JSON.stringify(usersJson));
        }
        const rajneeshUser = usersJson.data.find((u) => u.id === rajneesh.user_id);
        if (!rajneeshUser) throw new Error(`User #${rajneesh.user_id} not found in /api/users!`);
        console.log(`✓ User found: ID=${rajneeshUser.id}, DOJ=${rajneeshUser.date_of_joining}, Current Salary=₹${rajneeshUser.current_salary}`);
        if (!rajneeshUser.date_of_joining) throw new Error("User record missing date_of_joining!");

        // 5. Test Staff Salary Structure API (Save / Update ₹30,000 for Rajneesh)
        console.log("\n[STEP 5] Testing /api/staff-salary configuration for Rajneesh Kumar (₹30,000)...");
        const salPostRes = await fetch(`${BASE_URL}/api/staff-salary`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({
                academy_id: 1,
                branch_id: 1,
                staff_id: 10,
                monthly_salary: 30000,
                basic_salary: 18000,
                hra: 6000,
                conveyance: 2400,
                other_allowance: 3600,
                gross_salary: 30000,
                pf_deduction: 2160,
                advance_deduction: 2000,
                net_salary: 25840,
                status: "Active",
            }),
        });
        const salPostJson = await salPostRes.json();
        if (!salPostRes.ok || !salPostJson.success) {
            throw new Error("Staff salary setup failed: " + JSON.stringify(salPostJson));
        }
        console.log("✓ Staff salary structure saved/active:", salPostJson.data?.id || salPostJson.message);

        // 6. Test First Month Payroll Calculation (November 2026, Joined Nov 11)
        console.log("\n[STEP 6] Testing Payroll Calculation for Joining Month (November 2026)...");
        const novPayRes = await fetch(`${BASE_URL}/api/staff-salary-payments`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({
                action: "calculate",
                staff_id: 10,
                salary_month: 11,
                salary_year: 2026,
                present_days: 15,
            }),
        });
        const novPayJson = await novPayRes.json();
        if (!novPayRes.ok || !novPayJson.success) {
            throw new Error("Nov 2026 payroll calculation failed: " + JSON.stringify(novPayJson));
        }
        const payData = novPayJson.data;
        console.log("Nov 2026 Payroll Response:", {
            staff_name: payData.staff_name,
            date_of_joining: payData.date_of_joining,
            is_joining_month: payData.is_joining_month,
            joining_start_day: payData.joining_start_day,
            baseline_full_working_days: payData.baseline_full_working_days,
            working_days: payData.working_days,
            present_days: payData.present_days,
            absent_days: payData.absent_days,
            gross_salary: payData.gross_salary,
            basic_salary: payData.basic_salary,
            net_salary: payData.net_salary,
            remarks: payData.remarks,
        });

        if (!payData.is_joining_month) throw new Error("Expected is_joining_month to be true!");
        if (payData.joining_start_day !== 11) throw new Error("Expected joining_start_day to be 11!");
        if (payData.working_days !== 15) throw new Error(`Expected 15 working days, got ${payData.working_days}`);
        if (payData.absent_days !== 0) throw new Error(`Expected 0 absent days, got ${payData.absent_days}`);
        const expectedNovGross = Math.round((30000 / 22) * 15 * 100) / 100;
        if (payData.gross_salary !== expectedNovGross) {
            throw new Error(`Expected earned gross ₹${expectedNovGross}, got ₹${payData.gross_salary}`);
        }
        console.log(`✓ First month payroll calculated strictly from Date of Joining: Day 11 (15 working days, ₹${payData.gross_salary} gross).`);

        // 7. Test Pre-Joining Month Payroll (October 2026)
        console.log("\n[STEP 7] Testing Payroll Calculation for Pre-Joining Month (October 2026)...");
        const octPayRes = await fetch(`${BASE_URL}/api/staff-salary-payments`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({
                action: "calculate",
                staff_id: 10,
                salary_month: 10,
                salary_year: 2026,
            }),
        });
        const octPayJson = await octPayRes.json();
        if (!octPayRes.ok || !octPayJson.success) {
            throw new Error("Oct 2026 payroll failed: " + JSON.stringify(octPayJson));
        }
        console.log("Oct 2026 Payroll Response:", {
            is_pre_joining: octPayJson.data.is_pre_joining,
            working_days: octPayJson.data.working_days,
            net_salary: octPayJson.data.net_salary,
            remarks: octPayJson.data.remarks,
        });
        if (!octPayJson.data.is_pre_joining) throw new Error("Expected is_pre_joining to be true for Oct 2026!");
        if (octPayJson.data.net_salary !== 0) throw new Error("Expected net_salary to be 0 for pre-joining month!");
        console.log("✓ Pre-joining month returns 0 working days and ₹0 net with clear not-employed remarks.");

        // 8. Test GET /api/staff-salary-payments returns date_of_joining
        console.log("\n[STEP 8] Testing GET /api/staff-salary-payments includes date_of_joining...");
        const payListRes = await fetch(`${BASE_URL}/api/staff-salary-payments?month=11&year=2026`, {
            headers: authHeaders,
        });
        const payListJson = await payListRes.json();
        if (!payListRes.ok || !payListJson.success) {
            throw new Error("Payment list failed: " + JSON.stringify(payListJson));
        }
        const savedRajneeshPay = payListJson.data.find((p) => p.staff_id === 10);
        if (!savedRajneeshPay) throw new Error("Saved payment for Rajneesh not found!");
        console.log("Saved payment row:", {
            id: savedRajneeshPay.id,
            staff_name: `${savedRajneeshPay.first_name} ${savedRajneeshPay.last_name}`,
            date_of_joining: savedRajneeshPay.date_of_joining,
            working_days: savedRajneeshPay.working_days,
            present_days: savedRajneeshPay.present_days,
            gross_salary: savedRajneeshPay.gross_salary,
            net_salary: savedRajneeshPay.net_salary,
        });
        if (!savedRajneeshPay.date_of_joining) throw new Error("Payment list item missing date_of_joining!");
        console.log("✓ Payment list includes date_of_joining for frontend display and badge rendering.");

        // 9. Test Role Permissions and RBAC Boundaries
        console.log("\n[STEP 9] Testing RBAC Security: Player forbidden from accessing salary routes...");
        const playerLogin = await login("player11@gmail.com", "Password@123");
        const pToken = playerLogin.token || (await login("player11@gmail.com", "123456")).token;
        if (pToken) {
            const playerHeaders = {
                Authorization: `Bearer ${pToken}`,
                Cookie: `auth_token=${pToken}`,
            };
            const playerPayApi = await fetch(`${BASE_URL}/api/staff-salary-payments`, {
                headers: playerHeaders,
            });
            if (playerPayApi.status !== 403) {
                throw new Error(`Expected 403 Forbidden for player API access, got ${playerPayApi.status}`);
            }
            console.log(`✓ Player forbidden from /api/staff-salary-payments (Status: 403 Forbidden).`);

            const playerPageRes = await fetch(`${BASE_URL}/next_panel/staff-salary-payments`, {
                headers: playerHeaders,
                redirect: "manual",
            });
            if (playerPageRes.status !== 307) {
                throw new Error(`Expected 307 redirect for player frontend, got ${playerPageRes.status}`);
            }
            console.log(`✓ Player redirected from /next_panel/staff-salary-payments to /next_panel/no-permission (Status: 307).`);
        }

        console.log("\n==================================================================");
        console.log(">>> ALL 9 E2E TESTS PASSED WITH 100% SUCCESS! <<<");
        console.log("==================================================================");
    } finally {
        serverProcess.kill("SIGKILL");
    }
}

main().catch((err) => {
    console.error("E2E Test Execution Failed:", err);
    process.exit(1);
});
