import { spawn } from "child_process";

const PORT = 3006;
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
        });
        let data = null;
        try {
            data = await res.json();
        } catch {
            data = null;
        }
        return { status: res.status, ok: res.ok, data };
    } catch (err) {
        return { status: 0, ok: false, error: err.message };
    }
}

async function main() {
    console.log("=== Testing User Weekly Off, Attendance & Role-Based Isolation ===");

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
    console.log("Next.js Server is healthy and listening on port " + PORT);

    try {
        // 1. Authenticate test accounts
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

        console.log("Auth tokens acquired. Running tests...");

        const tests = [];
        function record(name, passed, details = "") {
            tests.push({ name, passed, details });
            console.log(`[${passed ? "PASS" : "FAIL"}] ${name} ${details ? `(${details})` : ""}`);
        }

        // Test 1: Unauthenticated user rejected from /api/user-weekly-off
        const unauthRes = await request("/api/user-weekly-off");
        record("Unauthenticated /api/user-weekly-off returns 401", unauthRes.status === 401, `Status: ${unauthRes.status}`);

        // Test 2: Player GET /api/user-weekly-off returns own schedule (200)
        const playerGetRes = await request("/api/user-weekly-off", { token: playerToken });
        record("Player GET /api/user-weekly-off returns 200 (self schedule)", playerGetRes.status === 200 && playerGetRes.data?.success, `Status: ${playerGetRes.status}`);

        // Test 3: Player POST /api/user-weekly-off forbidden (403)
        const playerPostRes = await request("/api/user-weekly-off", {
            method: "POST",
            token: playerToken,
            body: { user_id: 1, days: ["Sunday"] }
        });
        record("Player forbidden from POST /api/user-weekly-off with 403", playerPostRes.status === 403, `Status: ${playerPostRes.status}`);

        // Test 4: Branch Admin GET user weekly off (isolated to own branch)
        const branchGetRes = await request("/api/user-weekly-off", { token: branchAdminToken });
        record(
            "Branch Admin GET /api/user-weekly-off succeeds with userDaysMap",
            branchGetRes.status === 200 && branchGetRes.data?.success && branchGetRes.data?.userDaysMap !== undefined,
            `Status: ${branchGetRes.status}`
        );

        // Test 5: Branch Admin blocked from querying another branch
        const crossBranchRes = await request("/api/user-weekly-off?branch_id=9999", { token: branchAdminToken });
        record(
            "Branch Admin cannot access other branch records (Tenant Isolation)",
            crossBranchRes.status === 403,
            `Status: ${crossBranchRes.status}`
        );

        // Test 6: Super Admin GET weekly off across academies
        const superGetRes = await request("/api/user-weekly-off?academy_id=1&branch_id=1", { token: superToken });
        record(
            "Super Admin GET /api/user-weekly-off across academy/branch",
            superGetRes.status === 200 && superGetRes.data?.success,
            `Status: ${superGetRes.status}`
        );

        // Test 7: Academy Admin GET weekly off within own academy
        const acadGetRes = await request("/api/user-weekly-off?branch_id=1", { token: acadAdminToken });
        record(
            "Academy Admin GET /api/user-weekly-off within academy branches",
            acadGetRes.status === 200 && acadGetRes.data?.success,
            `Status: ${acadGetRes.status}`
        );

        // Test 7: Update Weekly Off for a user (atomic batch sync)
        const usersListRes = await request("/api/users?academy_id=1&branch_id=1", { token: superToken });
        const testUser = usersListRes.data?.data?.[0];
        let testUserId = testUser?.id;

        if (testUserId) {
            const updateRes = await request("/api/user-weekly-off", {
                method: "POST",
                token: branchAdminToken,
                body: {
                    academy_id: 1,
                    branch_id: 1,
                    user_id: testUserId,
                    days: ["Monday", "Sunday"],
                },
            });
            record(
                "Update User Weekly Off via POST (atomic batch array)",
                (updateRes.status === 200 || updateRes.status === 201) && updateRes.data?.success,
                `Status: ${updateRes.status}`
            );

            // Verify the update via GET
            const verifyRes = await request(`/api/user-weekly-off?user_id=${testUserId}`, { token: branchAdminToken });
            const userDays = verifyRes.data?.userDaysMap?.[testUserId] || [];
            record(
                "Verify saved weekly off days in userDaysMap",
                userDays.includes("Monday") && userDays.includes("Sunday"),
                `Days: ${JSON.stringify(userDays)}`
            );
        } else {
            record("Update User Weekly Off skipped (no test user)", false, "No user");
        }

        // Test 8: Save Attendance with "Week off" status in cst_attendance
        const todayStr = new Date().toISOString().slice(0, 10);
        const saveAttRes = await request("/api/attendance", {
            method: "POST",
            token: branchAdminToken,
            body: {
                academy_id: 1,
                branch_id: 1,
                user_id: testUserId,
                attendance_type: "Staff",
                attendance_date: todayStr,
                attendance_status: "Week off",
            },
        });
        record(
            "Save Attendance with 'Week off' status (enum validation)",
            (saveAttRes.status === 200 || saveAttRes.status === 201) && saveAttRes.data?.success,
            `Status: ${saveAttRes.status}`
        );

        // Test 9: Fetch Attendance and verify "Week off" persisted
        const curMonth = new Date().getMonth() + 1;
        const curYear = new Date().getFullYear();
        const getAttRes = await request(
            `/api/attendance?academy_id=1&branch_id=1&user_id=${testUserId}&month=${curMonth}&year=${curYear}`,
            { token: branchAdminToken }
        );
        const savedRecord = (getAttRes.data?.data || []).find(
            (r) => String(r.user_id) === String(testUserId) && String(r.attendance_date).slice(0, 10) === todayStr
        );
        record(
            "Fetch Attendance verifies 'Week off' is returned correctly",
            savedRecord && savedRecord.attendance_status === "Week off",
            `Status: ${savedRecord?.attendance_status}`
        );

        // Test 10: Player Self-Attendance Authorization
        const meRes = await request("/api/auth/me", { token: playerToken });
        const playerUserId = meRes.data?.user?.id;

        if (playerUserId) {
            // Test 10a: Player can mark their own attendance
            const playerSelfAttRes = await request("/api/attendance", {
                method: "POST",
                token: playerToken,
                body: {
                    user_id: playerUserId,
                    attendance_type: "Player",
                    attendance_date: todayStr,
                    attendance_status: "Present",
                },
            });
            record(
                "Player can mark their OWN attendance (Self-Attendance)",
                (playerSelfAttRes.status === 200 || playerSelfAttRes.status === 201) && playerSelfAttRes.data?.success,
                `Status: ${playerSelfAttRes.status}`
            );

            // Test 10b: Player FORBIDDEN from marking attendance for another user (IDOR prevention)
            const otherUserId = testUserId && testUserId !== playerUserId ? testUserId : 99999;
            const playerTamperAttRes = await request("/api/attendance", {
                method: "POST",
                token: playerToken,
                body: {
                    user_id: otherUserId,
                    attendance_type: "Player",
                    attendance_date: todayStr,
                    attendance_status: "Present",
                },
            });
            record(
                "Player FORBIDDEN from marking attendance for other users (403)",
                playerTamperAttRes.status === 403,
                `Status: ${playerTamperAttRes.status}`
            );

            // Test 10c: Player GET attendance only returns self data
            const playerGetAttRes = await request(
                `/api/attendance?month=${curMonth}&year=${curYear}`,
                { token: playerToken }
            );
            const allSelfRecords = (playerGetAttRes.data?.data || []).every(
                (r) => String(r.user_id) === String(playerUserId)
            );
            record(
                "Player GET /api/attendance strictly isolated to self",
                playerGetAttRes.status === 200 && allSelfRecords,
                `Records Count: ${playerGetAttRes.data?.data?.length || 0}`
            );
        }

        // Test 11: Verify frontend pages render 200 OK
        const attPageRes = await request("/next_panel/attendance", { token: branchAdminToken });
        record("Frontend /next_panel/attendance renders 200 OK (Branch Admin)", attPageRes.status === 200, `Status: ${attPageRes.status}`);

        const playerAttPageRes = await request("/next_panel/attendance", { token: playerToken });
        record("Frontend /next_panel/attendance renders 200 OK (Player Self View)", playerAttPageRes.status === 200, `Status: ${playerAttPageRes.status}`);

        const weeklyOffPageRes = await request("/next_panel/user-weekly-off", { token: branchAdminToken });
        record("Frontend /next_panel/user-weekly-off renders 200 OK (Admin)", weeklyOffPageRes.status === 200, `Status: ${weeklyOffPageRes.status}`);

        const passed = tests.filter((t) => t.passed).length;
        const failed = tests.filter((t) => !t.passed).length;
        console.log(`\n=== Test Suite Complete: ${passed} PASSED, ${failed} FAILED ===`);

        if (failed > 0) {
            process.exit(1);
        }
    } finally {
        console.log("Shutting down Next.js production server...");
        serverProcess.kill("SIGKILL");
    }
}

main().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
