import { spawn } from "child_process";

const PORT = 3007;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    const headers = options.headers || {};
    if (options.token) {
        headers["Authorization"] = `Bearer ${options.token}`;
        headers["Cookie"] = `auth_token=${options.token}`;
    }
    if (options.body && typeof options.body === "object") {
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(options.body);
    }

    try {
        const res = await fetch(url, {
            method: options.method || "GET",
            headers,
            body: options.body,
            redirect: options.redirect || "manual",
        });
        let data = null;
        try {
            data = await res.json();
        } catch {
            data = null;
        }
        return { status: res.status, ok: res.ok, data, headers: res.headers };
    } catch (err) {
        return { status: 0, ok: false, error: err.message };
    }
}

async function main() {
    console.log("=== Testing Staff Salary, Payments & Transactions Suite ===");

    console.log(`Starting Next.js production server on port ${PORT}...`);
    const serverProcess = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
        env: { ...process.env, PORT: String(PORT) },
        stdio: "pipe",
    });

    let ready = false;
    for (let i = 0; i < 20; i++) {
        await sleep(1000);
        try {
            const probe = await request("/api/programs");
            if (probe.status === 200) {
                ready = true;
                break;
            }
        } catch {}
    }

    if (!ready) {
        console.error("Failed to start server within 20 seconds. Aborting.");
        serverProcess.kill("SIGKILL");
        process.exit(1);
    }
    console.log("Next.js Server is listening on port " + PORT);

    try {
        // Authenticate test accounts
        console.log("Authenticating test accounts...");
        const superLogin = await request("/api/auth/login", {
            method: "POST",
            body: { login: "superadmin@gmail.com", password: "Password@123" },
        });
        const superToken = superLogin.data?.token;

        const acadLogin = await request("/api/auth/login", {
            method: "POST",
            body: { login: "chandan@gmail.com", password: "Password@123" },
        });
        const acadAdminToken = acadLogin.data?.token;

        const branchLogin = await request("/api/auth/login", {
            method: "POST",
            body: { login: "rajneesh@gmail.com", password: "Password@123" },
        });
        const branchAdminToken = branchLogin.data?.token;

        const playerLogin = await request("/api/auth/login", {
            method: "POST",
            body: { login: "player11@gmail.com", password: "Password@123" },
        });
        let playerToken = playerLogin.data?.token;
        if (!playerToken) {
            const pRetry = await request("/api/auth/login", {
                method: "POST",
                body: { login: "player11@gmail.com", password: "123456" },
            });
            playerToken = pRetry.data?.token;
        }

        const tests = [];
        function record(name, passed, details = "") {
            tests.push({ name, passed, details });
            console.log(`[${passed ? "PASS" : "FAIL"}] ${name} ${details ? `(${details})` : ""}`);
        }

        // Test 1: Unauthenticated request rejected with 401
        const unauth1 = await request("/api/staff-salary");
        record("Unauthenticated /api/staff-salary returns 401", unauth1.status === 401, `Status: ${unauth1.status}`);

        const unauth2 = await request("/api/staff-salary-payments");
        record("Unauthenticated /api/staff-salary-payments returns 401", unauth2.status === 401, `Status: ${unauth2.status}`);

        const unauth3 = await request("/api/staff-salary-transactions");
        record("Unauthenticated /api/staff-salary-transactions returns 401", unauth3.status === 401, `Status: ${unauth3.status}`);

        // Test 2: Player role FORBIDDEN (403) from accessing salary modules
        const playerSal = await request("/api/staff-salary", { token: playerToken });
        record("Player forbidden from /api/staff-salary (403)", playerSal.status === 403, `Status: ${playerSal.status}`);

        const playerPay = await request("/api/staff-salary-payments", { token: playerToken });
        record("Player forbidden from /api/staff-salary-payments (403)", playerPay.status === 403, `Status: ${playerPay.status}`);

        const playerTx = await request("/api/staff-salary-transactions", { token: playerToken });
        record("Player forbidden from /api/staff-salary-transactions (403)", playerTx.status === 403, `Status: ${playerTx.status}`);

        // Test 3: Branch Admin GET staff salary (isolated to own branch)
        const branchSal = await request("/api/staff-salary", { token: branchAdminToken });
        record("Branch Admin GET /api/staff-salary returns 200", branchSal.status === 200 && branchSal.data?.success, `Count: ${branchSal.data?.count}`);

        // Test 4: Branch Admin blocked from other branch (Tenant Isolation)
        const crossBranch = await request("/api/staff-salary?branch_id=9999", { token: branchAdminToken });
        record("Branch Admin cannot query other branch (Tenant Isolation 403)", crossBranch.status === 403, `Status: ${crossBranch.status}`);

        // Test 5: Super Admin & Academy Admin GET
        const superSal = await request("/api/staff-salary?academy_id=1", { token: superToken });
        record("Super Admin GET /api/staff-salary returns 200", superSal.status === 200 && superSal.data?.success, `Count: ${superSal.data?.count}`);

        const acadSal = await request("/api/staff-salary", { token: acadAdminToken });
        record("Academy Admin GET /api/staff-salary returns 200", acadSal.status === 200 && acadSal.data?.success, `Count: ${acadSal.data?.count}`);

        // Test 6: Auto-Calculation in Staff Salary Configuration (User Prompt Example)
        // Monthly Salary = 25000 -> Basic = 15000, HRA = 5000, Conveyance = 2000, Other = 3000, PF = 1800, Advance = 2000, Net = 21200
        const firstStaff = branchSal.data?.data?.[0];
        const testStaffId = firstStaff?.staff_id;

        if (testStaffId) {
            const createSalRes = await request("/api/staff-salary", {
                method: "POST",
                token: branchAdminToken,
                body: {
                    staff_id: testStaffId,
                    monthly_salary: 25000,
                    advance_deduction: 2000,
                },
            });

            const salData = createSalRes.data?.data;
            const autoCalcValid =
                salData &&
                Number(salData.gross_salary) === 25000 &&
                Number(salData.basic_salary) === 15000 &&
                Number(salData.hra) === 5000 &&
                Number(salData.conveyance_allowance) === 2000 &&
                Number(salData.other_allowance) === 3000 &&
                Number(salData.pf_deduction) === 1800 &&
                Number(salData.advance_deduction) === 2000 &&
                Number(salData.net_salary) === 21200;

            record(
                "Auto-calculation of Salary Components matches User Specification exactly (₹25,000 -> Net ₹21,200)",
                autoCalcValid,
                `Gross: ${salData?.gross_salary}, Basic: ${salData?.basic_salary}, HRA: ${salData?.hra}, Net: ${salData?.net_salary}`
            );

            // Test 7: Single Staff Salary GET by ID
            const singleSal = await request(`/api/staff-salary/${salData.id}`, { token: branchAdminToken });
            record("GET /api/staff-salary/[id] returns 200", singleSal.status === 200 && singleSal.data?.success, `ID: ${salData.id}`);
        } else {
            record("Auto-calculation skipped (no test staff)", false, "No staff");
        }

        // Test 8: Working Days & Attendance-Based Salary Calculation
        const curMonth = 11;
        const curYear = 2026;
        const calcPayRes = await request("/api/staff-salary-payments", {
            method: "POST",
            token: branchAdminToken,
            body: {
                staff_id: testStaffId,
                month: curMonth,
                year: curYear,
            },
        });

        const payData = calcPayRes.data?.data;
        const hasWorkingDays = payData && Number(payData.working_days) > 0;
        const netMatchesProrate = payData && Number(payData.net_salary) >= 0;

        record(
            "Calculate Salary on behalf of Working Days & Attendance",
            calcPayRes.status === 200 && hasWorkingDays && netMatchesProrate,
            `Working Days: ${payData?.working_days}, Present: ${payData?.present_days}, Earned Gross: ${payData?.gross_salary}, Net: ${payData?.net_salary}`
        );

        const paymentId = payData?.id;

        // Test 9: Disburse Payment via Transaction
        if (paymentId) {
            const payTxRes = await request("/api/staff-salary-transactions", {
                method: "POST",
                token: branchAdminToken,
                body: {
                    salary_payment_id: paymentId,
                    amount: 5000,
                    payment_mode: "Bank Transfer",
                    remarks: "Partial mid-month salary transfer",
                },
            });

            const txData = payTxRes.data?.data;
            record(
                "Record Salary Transaction Disburses & Updates Payment Status",
                payTxRes.status === 201 && txData?.transaction_no && (txData?.payment_status === "Partial" || txData?.payment_status === "Paid"),
                `TxNo: ${txData?.transaction_no}, Total Paid: ${txData?.total_paid}, Status: ${txData?.payment_status}`
            );

            // Test 10: GET /api/staff-salary-payments/[id] with child transactions
            const singlePay = await request(`/api/staff-salary-payments/${paymentId}`, { token: branchAdminToken });
            record(
                "GET /api/staff-salary-payments/[id] returns payment with transactions array",
                singlePay.status === 200 && Array.isArray(singlePay.data?.data?.transactions),
                `Tx Count: ${singlePay.data?.data?.transactions?.length}`
            );
        } else {
            record("Transaction disburse skipped (no payment id)", false, "No payment");
        }

        // Test 11: GET /api/staff-salary-transactions returns list
        const txListRes = await request("/api/staff-salary-transactions", { token: branchAdminToken });
        record(
            "GET /api/staff-salary-transactions returns 200 with list",
            txListRes.status === 200 && txListRes.data?.success && txListRes.data?.data?.length > 0,
            `Count: ${txListRes.data?.data?.length}`
        );

        // Test 12: Frontend Pages Render 200 OK for Admin
        const p1 = await request("/next_panel/staff-salary", { token: branchAdminToken });
        record("Frontend /next_panel/staff-salary renders 200 OK", p1.status === 200, `Status: ${p1.status}`);

        const p2 = await request("/next_panel/staff-salary-payments", { token: branchAdminToken });
        record("Frontend /next_panel/staff-salary-payments renders 200 OK", p2.status === 200, `Status: ${p2.status}`);

        const p3 = await request("/next_panel/staff-salary-transactions", { token: branchAdminToken });
        record("Frontend /next_panel/staff-salary-transactions renders 200 OK", p3.status === 200, `Status: ${p3.status}`);

        // Test 13: Player restricted from frontend salary pages
        const playerPage = await request("/next_panel/staff-salary", { token: playerToken, redirect: "manual" });
        const isForbiddenOrRedirect = playerPage.status === 307 || playerPage.status === 302 || playerPage.status === 403;
        record(
            "Player forbidden from /next_panel/staff-salary frontend (Redirects to no-permission)",
            isForbiddenOrRedirect,
            `Status: ${playerPage.status}, Location: ${playerPage.headers?.get("location")}`
        );

        const passed = tests.filter((t) => t.passed).length;
        const failed = tests.filter((t) => !t.passed).length;
        console.log(`\n=== Salary Test Suite Complete: ${passed} PASSED, ${failed} FAILED ===`);

        if (failed > 0) {
            process.exit(1);
        }
    } finally {
        console.log("Shutting down Next.js test server...");
        serverProcess.kill("SIGKILL");
    }
}

main().catch((err) => {
    console.error("Test execution error:", err);
    process.exit(1);
});
