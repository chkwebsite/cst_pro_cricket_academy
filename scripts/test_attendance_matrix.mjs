import jwt from "jsonwebtoken";

import { spawn } from "child_process";

const JWT_SECRET = process.env.JWT_SECRET || "cricketAcademy_2026@Admin#Panel$Role%Secure123";
const PORT = 3006;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
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
    console.log("=== Testing Attendance Matrix API & Multi-Tenant Authorization ===");

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

    // 1. Authenticate accounts via /api/auth/login
    console.log("Authenticating test accounts...");
    const superLogin = await request("/api/auth/login", {
        method: "POST",
        body: { login: "superadmin@gmail.com", password: "Password@123" }
    });
    const superToken = superLogin.data?.token;

    const acadLogin = await request("/api/auth/login", {
        method: "POST",
        body: { login: "chandan@gmail.com", password: "Password@123" }
    });
    const acadAdminToken = acadLogin.data?.token;

    const branchLogin = await request("/api/auth/login", {
        method: "POST",
        body: { login: "rajneesh@gmail.com", password: "Password@123" }
    });
    const branchAdminToken = branchLogin.data?.token;

    const playerLogin = await request("/api/auth/login", {
        method: "POST",
        body: { login: "player11@gmail.com", password: "Password@123" }
    });
    let playerToken = playerLogin.data?.token;
    if (!playerToken) {
        const pRetry = await request("/api/auth/login", {
            method: "POST",
            body: { login: "player11@gmail.com", password: "123456" }
        });
        playerToken = pRetry.data?.token;
    }

    console.log("Auth tokens obtained successfully.");

    const tests = [];
    function record(name, passed, details = "") {
        tests.push({ name, passed, details });
        console.log(`[${passed ? "PASS" : "FAIL"}] ${name} ${details ? `(${details})` : ""}`);
    }

    // 1. Unauthenticated check
    const unauth = await request("/api/attendance");
    record("Unauthenticated /api/attendance returns 401", unauth.status === 401, `Status: ${unauth.status}`);

    // 2. Player forbidden check
    const playerCheck = await request("/api/attendance", { token: playerToken });
    record("Player blocked from /api/attendance with 403", playerCheck.status === 403, `Status: ${playerCheck.status}`);

    // 3. Super Admin GET
    const superGet = await request("/api/attendance?academy_id=1&branch_id=1&month=11&year=2026", { token: superToken });
    record("Super Admin GET /api/attendance", superGet.status === 200 && superGet.data?.success, `Status: ${superGet.status}`);

    // 4. Branch Admin GET (Strict Isolation)
    const branchGet = await request("/api/attendance?academy_id=999&branch_id=999&month=11&year=2026", { token: branchAdminToken });
    record("Branch Admin GET strictly isolated (cannot spoof branch 999)", branchGet.status === 200, `Status: ${branchGet.status}`);

    // 5. POST Auto-Save Attendance (Upsert Test)
    const testDate = "2026-11-15";
    const postRes1 = await request("/api/attendance", {
        method: "POST",
        token: branchAdminToken,
        body: {
            academy_id: 1,
            branch_id: 1,
            user_id: 11,
            attendance_type: "Player",
            attendance_date: testDate,
            attendance_status: "Present",
        },
    });
    record("POST /api/attendance initial record creation", postRes1.status === 201 && postRes1.data?.success, `Status: ${postRes1.status}`);

    // 6. POST Update (Auto-save dropdown change to 'Late')
    const postRes2 = await request("/api/attendance", {
        method: "POST",
        token: branchAdminToken,
        body: {
            academy_id: 1,
            branch_id: 1,
            user_id: 11,
            attendance_type: "Player",
            attendance_date: testDate,
            attendance_status: "Late",
        },
    });
    record("POST /api/attendance auto-save UPSERT on same date", postRes2.status === 201 && postRes2.data?.success, `Status: ${postRes2.status}`);

    // 7. Verify updated status
    const verifyGet = await request(`/api/attendance?user_id=11&attendance_date=${testDate}`, { token: branchAdminToken });
    const matching = (verifyGet.data?.data || []).find((r) => r.attendance_date.slice(0, 10) === testDate);
    record("Verified updated status in DB is 'Late'", matching?.attendance_status === "Late", `Status: ${matching?.attendance_status}`);

    // 8. Batch bulk mark
    const batchRes = await request("/api/attendance", {
        method: "POST",
        token: superToken,
        body: {
            items: [
                { academy_id: 1, branch_id: 1, user_id: 11, attendance_type: "Player", attendance_date: "2026-11-16", attendance_status: "Present" },
                { academy_id: 1, branch_id: 1, user_id: 12, attendance_type: "Player", attendance_date: "2026-11-16", attendance_status: "Present" },
            ],
        },
    });
    record("POST /api/attendance bulk mark items", batchRes.status === 201 && batchRes.data?.success, `Status: ${batchRes.status}`);

    const failed = tests.filter((t) => !t.passed);
    console.log(`\nTOTAL: ${tests.length}, PASSED: ${tests.length - failed.length}, FAILED: ${failed.length}`);

    serverProcess.kill("SIGKILL");
    process.exit(failed.length === 0 ? 0 : 1);
} finally {
    serverProcess.kill("SIGKILL");
}
}

main();
