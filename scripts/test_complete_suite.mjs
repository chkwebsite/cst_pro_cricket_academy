import http from 'http';
import { spawn } from 'child_process';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "cricketAcademy_2026@Admin#Panel$Role%Secure123";
const PORT = 3006;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function request(urlPath, options = {}) {
    const url = `${BASE_URL}${urlPath}`;
    const headers = options.headers || {};
    if (options.token) {
        headers['Authorization'] = `Bearer ${options.token}`;
        headers['Cookie'] = `auth_token=${options.token}`;
    }
    if (options.body && typeof options.body === 'object') {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }

    try {
        const res = await fetch(url, {
            method: options.method || 'GET',
            headers,
            body: options.body
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
    console.log("===============================================================");
    console.log("   CST CRICKET ACADEMY - ENTERPRISE QA & AUDIT TEST SUITE      ");
    console.log("===============================================================");

    console.log(`Starting Next.js production server on port ${PORT}...`);
    const serverProcess = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], {
        env: { ...process.env, PORT: String(PORT) },
        stdio: 'pipe'
    });

    let ready = false;
    for (let i = 0; i < 20; i++) {
        await sleep(1000);
        try {
            const probe = await request('/api/programs');
            if (probe.status === 200) {
                ready = true;
                break;
            }
        } catch {}
    }

    if (!ready) {
        console.error("Failed to start server within 20 seconds. Aborting.");
        serverProcess.kill('SIGKILL');
        process.exit(1);
    }
    console.log("Next.js Server is healthy and listening on port " + PORT);

    const results = [];
    function record(moduleName, testName, passed, details = "") {
        results.push({ module: moduleName, test: testName, status: passed ? "PASS" : "FAIL", details });
        const icon = passed ? "✓" : "✗";
        console.log(`[${icon}] ${moduleName} - ${testName}: ${passed ? "PASS" : "FAIL"} ${details ? `(${details})` : ""}`);
    }

    try {
        // ========================================================
        // 1. AUTHENTICATION & LOGIN TESTING (ALL ROLES)
        // ========================================================
        console.log("\n--- SECTION 1: AUTHENTICATION TESTING ---");

        const testAccounts = [
            { role: "Super Admin", email: "superadmin@gmail.com", user_type: "Super Admin", academy_id: null, branch_id: null },
            { role: "Academy Admin 1", email: "chandan@gmail.com", user_type: "Academy Admin", academy_id: 1, branch_id: 1 },
            { role: "Academy Admin 2", email: "academyadmin2@gmail.com", user_type: "Academy Admin", academy_id: 2, branch_id: 3 },
            { role: "Branch Admin 1", email: "rajneesh@gmail.com", user_type: "Branch Admin", academy_id: 1, branch_id: 1 },
            { role: "Branch Admin 2", email: "branchadmin2@gmail.com", user_type: "Branch Admin", academy_id: 1, branch_id: 2 },
            { role: "Accountant", email: "accountant@gmail.com", user_type: "Accountant", academy_id: 1, branch_id: 1 },
            { role: "Management", email: "management@gmail.com", user_type: "Management", academy_id: 1, branch_id: 1 },
            { role: "Coach", email: "deepakwalia@gmail.com", user_type: "Coach", academy_id: 1, branch_id: 2 },
            { role: "Staff", email: "sumit@gmail.com", user_type: "Ground Staff", academy_id: 1, branch_id: 1 },
            { role: "Player", email: "player11@gmail.com", user_type: "Player", academy_id: 1, branch_id: 1 },
        ];

        const tokens = {};

        // A. Test invalid login
        const badLogin = await request('/api/auth/login', {
            method: 'POST',
            body: { login: 'superadmin@gmail.com', password: 'WrongPassword!999' }
        });
        record("Authentication", "Invalid password rejected (401)", badLogin.status === 401, `Status: ${badLogin.status}`);

        // B. Login all roles
        for (const acc of testAccounts) {
            const loginRes = await request('/api/auth/login', {
                method: 'POST',
                body: { login: acc.email, password: 'Password@123' }
            });
            const ok = loginRes.status === 200 && loginRes.data?.success;
            record("Authentication", `Login role: ${acc.role}`, ok, `User: ${acc.email}`);
            let token = loginRes.data?.token;
            if (!token && loginRes.headers) {
                const cookie = loginRes.headers.get('set-cookie');
                const match = cookie?.match(/auth_token=([^;]+)/);
                if (match) token = match[1];
            }
            if (ok && token) {
                tokens[acc.role] = token;
            }
        }

        // C. /api/auth/me verification
        if (tokens["Super Admin"]) {
            const meRes = await request('/api/auth/me', { token: tokens["Super Admin"] });
            record("Authentication", "Session verification /api/auth/me", meRes.status === 200 && meRes.data?.user?.email === "superadmin@gmail.com");
        }

        // ========================================================
        // 2. UNPROTECTED VS PROTECTED ACCESS (SECURITY & IDOR)
        // ========================================================
        console.log("\n--- SECTION 2: SECURITY & ACCESS CONTROL ---");

        // Unauthenticated access to admin APIs must return 401
        const adminEndpoints = [
            "/api/users",
            "/api/roles",
            "/api/permissions",
            "/api/user-roles",
            "/api/fee-payments",
            "/api/fee-status",
            "/api/batches",
            "/api/batch-players",
            "/api/player-attendance",
            "/api/student-enquiries",
            "/api/individual-training",
        ];

        for (const ep of adminEndpoints) {
            const unauth = await request(ep);
            record("Security Access Control", `Unauthenticated ${ep} returns 401`, unauth.status === 401, `Status: ${unauth.status}`);
        }

        // Player Role attempting to access unauthorized admin endpoints
        const playerToken = tokens["Player"];
        if (playerToken) {
            const playerUsers = await request('/api/users', { token: playerToken });
            record("Role Authorization", "Player blocked from /api/users", playerUsers.status === 403 || playerUsers.status === 401, `Status: ${playerUsers.status}`);

            const playerRoles = await request('/api/roles', { token: playerToken });
            record("Role Authorization", "Player blocked from /api/roles", playerRoles.status === 403 || playerRoles.status === 401, `Status: ${playerRoles.status}`);
        }

        // ========================================================
        // 3. MULTI-TENANT ACADEMY & BRANCH DATA ISOLATION
        // ========================================================
        console.log("\n--- SECTION 3: MULTI-TENANT DATA ISOLATION ---");

        const superToken = tokens["Super Admin"];
        const acad1Token = tokens["Academy Admin 1"];
        const acad2Token = tokens["Academy Admin 2"];
        const branch1Token = tokens["Branch Admin 1"];

        // A. Branch Admin Isolation: Branch Admin 1 must only see Branch 1 data
        if (branch1Token) {
            const bBatches = await request('/api/batches', { token: branch1Token });
            const allBranch1 = (bBatches.data?.data || []).every(b => b.branch_id === 1);
            record("Multi-Tenant Isolation", "Branch Admin 1 strictly isolated to branch_id = 1", allBranch1 && (bBatches.data?.data?.length > 0), `Count: ${bBatches.data?.data?.length}`);

            const bPlayers = await request('/api/admission-players', { token: branch1Token });
            const allBranch1Players = (bPlayers.data?.data || []).every(p => p.branch_id === 1);
            record("Multi-Tenant Isolation", "Branch Admin 1 players strictly branch_id = 1", allBranch1Players, `Count: ${bPlayers.data?.data?.length}`);
        }

        // B. Academy Admin Isolation: Academy Admin 1 vs Academy Admin 2
        if (acad1Token && acad2Token) {
            const acad1Branches = await request('/api/branch', { token: acad1Token });
            const onlyAcad1 = (acad1Branches.data?.data || []).every(b => b.academy_id === 1);
            record("Multi-Tenant Isolation", "Academy Admin 1 branches strictly academy_id = 1", onlyAcad1, `Branches in Acad 1: ${acad1Branches.data?.data?.length}`);

            const acad2Branches = await request('/api/branch', { token: acad2Token });
            const onlyAcad2 = (acad2Branches.data?.data || []).every(b => b.academy_id === 2);
            record("Multi-Tenant Isolation", "Academy Admin 2 branches strictly academy_id = 2", onlyAcad2, `Branches in Acad 2: ${acad2Branches.data?.data?.length}`);
        }

        // C. Super Admin sees all academies
        if (superToken) {
            const superAcademies = await request('/api/academies', { token: superToken });
            record("Super Admin Scope", "Super Admin sees all academies", superAcademies.status === 200 && (superAcademies.data?.data?.length >= 2), `Count: ${superAcademies.data?.data?.length}`);
        }

        // ========================================================
        // 4. COACH SCOPE ISOLATION
        // ========================================================
        console.log("\n--- SECTION 4: COACH SCOPE ISOLATION ---");

        const coachToken = tokens["Coach"];
        if (coachToken) {
            const coachBatches = await request('/api/batches', { token: coachToken });
            record("Coach Isolation", "Coach gets assigned batches", coachBatches.status === 200 && coachBatches.data?.success, `Batches: ${coachBatches.data?.data?.length}`);

            const coachFees = await request('/api/player-program-fees', { token: coachToken });
            const noPaidFees = (coachFees.data?.data || []).every(f => f.payment_status !== "Paid");
            record("Coach Isolation", "Coach dues exclude Paid fees", noPaidFees, `Visible pending/partial count: ${coachFees.data?.data?.length}`);
        }

        // ========================================================
        // 5. MODULE CRUD & GET FUNCTIONALITY (ALL MODULES)
        // ========================================================
        console.log("\n--- SECTION 5: MODULE-WISE API TESTING ---");

        const modulesToTest = [
            { name: "Academies", endpoint: "/api/academies" },
            { name: "Branches", endpoint: "/api/branch" },
            { name: "Age Groups", endpoint: "/api/age-groups" },
            { name: "Programs", endpoint: "/api/programs" },
            { name: "Batches", endpoint: "/api/batches" },
            { name: "Batch Coaches", endpoint: "/api/batch-coaches" },
            { name: "Batch Players", endpoint: "/api/batch-players" },
            { name: "Admission Players", endpoint: "/api/admission-players" },
            { name: "Coaches", endpoint: "/api/coaches" },
            { name: "Staff", endpoint: "/api/staff" },
            { name: "Fee Status", endpoint: "/api/fee-status" },
            { name: "Fee Payments", endpoint: "/api/fee-payments" },
            { name: "Player Program Fees", endpoint: "/api/player-program-fees" },
            { name: "Player Program Fees Matrix", endpoint: "/api/player-program-fees/matrix" },
            { name: "Player Payments", endpoint: "/api/player-payments" },
            { name: "Player Attendance", endpoint: "/api/player-attendance" },
            { name: "Grounds", endpoint: "/api/ground" },
            { name: "Ground Slots", endpoint: "/api/ground-slots" },
            { name: "Ground Bookings", endpoint: "/api/ground-bookings" },
            { name: "Ground Booking Requests", endpoint: "/api/ground-booking-requests" },
            { name: "Ground Payments", endpoint: "/api/ground-payments" },
            { name: "Matches", endpoint: "/api/matches" },
            { name: "Match Types", endpoint: "/api/match-types" },
            { name: "Match Teams", endpoint: "/api/match-teams" },
            { name: "Match Players", endpoint: "/api/match-players" },
            { name: "Match Innings", endpoint: "/api/match-innings" },
            { name: "Match Scorecard", endpoint: "/api/match-scorecard" },
            { name: "Match Bowling Scorecard", endpoint: "/api/match-bowling-scorecard" },
            { name: "Tournaments", endpoint: "/api/tournaments" },
            { name: "Tournament Teams", endpoint: "/api/tournament-teams" },
            { name: "Tournament Matches", endpoint: "/api/tournament-matches" },
            { name: "Tournament Team Players", endpoint: "/api/tournament-team-players" },
            { name: "Individual Training", endpoint: "/api/individual-training" },
            { name: "Products", endpoint: "/api/products" },
            { name: "Product Categories", endpoint: "/api/product-categories" },
            { name: "Product Stock", endpoint: "/api/product-stock" },
            { name: "Orders", endpoint: "/api/orders" },
            { name: "Order Items", endpoint: "/api/order-items" },
            { name: "Order Payments", endpoint: "/api/order-payments" },
            { name: "Gallery Albums", endpoint: "/api/gallery-albums" },
            { name: "Gallery Categories", endpoint: "/api/gallery-categories" },
            { name: "Gallery Images", endpoint: "/api/gallery-images" },
            { name: "Gallery Videos", endpoint: "/api/gallery-videos" },
            { name: "Student Enquiries", endpoint: "/api/student-enquiries" },
            { name: "Student Enquiries Followup", endpoint: "/api/student-enquiries-flowup" },
            { name: "Roles", endpoint: "/api/roles" },
            { name: "Permissions", endpoint: "/api/permissions" },
            { name: "Role Permissions", endpoint: "/api/role-permissions" },
            { name: "Menu", endpoint: "/api/menu" },
            { name: "Menu Permissions", endpoint: "/api/menu-permissions" },
            { name: "Users", endpoint: "/api/users" },
            { name: "User Roles", endpoint: "/api/user-roles" },
            { name: "User Branches", endpoint: "/api/user-branches" },
            { name: "User Programs", endpoint: "/api/user-programs" },
            { name: "Password Resets", endpoint: "/api/password-resets" },
        ];

        for (const m of modulesToTest) {
            const res = await request(m.endpoint, { token: superToken });
            const count = Array.isArray(res.data?.data) ? res.data.data.length : (res.data?.success ? 1 : 0);
            record(m.name, `GET ${m.endpoint}`, res.status === 200 && res.data?.success, `Records: ${count}`);
        }

        // ========================================================
        // 6. CRUD MUTATION INTEGRITY (CREATE -> VERIFY -> UPDATE -> DELETE)
        // ========================================================
        console.log("\n--- SECTION 6: CRUD MUTATION INTEGRITY ---");

        // Test Category CRUD
        const newCat = await request('/api/product-categories', {
            method: 'POST',
            token: superToken,
            body: {
                category_name: `Test Cat ${Date.now()}`,
                description: "Temporary category for QA CRUD verification",
                status: 1
            }
        });
        const catId = newCat.data?.id || newCat.data?.data?.id;
        record("Product Categories CRUD", "POST (Create category)", newCat.status === 201 || newCat.status === 200, `New ID: ${catId}`);

        if (catId) {
            const getCat = await request(`/api/product-categories/${catId}`, { token: superToken });
            record("Product Categories CRUD", "GET Single (Read created category)", getCat.status === 200);

            const putCat = await request(`/api/product-categories/${catId}`, {
                method: 'PUT',
                token: superToken,
                body: {
                    category_name: `Updated Cat ${Date.now()}`,
                    description: "Updated description",
                    status: 1
                }
            });
            record("Product Categories CRUD", "PUT (Update category)", putCat.status === 200);

            const delCat = await request(`/api/product-categories/${catId}`, {
                method: 'DELETE',
                token: superToken
            });
            record("Product Categories CRUD", "DELETE (Delete category)", delCat.status === 200);
        }

        // ========================================================
        // 7. INPUT VALIDATION & SQL INJECTION ROBUSTNESS
        // ========================================================
        console.log("\n--- SECTION 7: VALIDATION & SQL INJECTION ---");

        // A. Missing required fields in POST
        const badPost = await request('/api/product-categories', {
            method: 'POST',
            token: superToken,
            body: { description: "Missing category_name" }
        });
        record("Input Validation", "Missing required field rejected (400)", badPost.status === 400);

        // B. Non-existent ID handling
        const badIdGet = await request('/api/product-categories/99999999', { token: superToken });
        record("Error Handling", "Non-existent record returns 404", badIdGet.status === 404);

        // C. SQL Injection payload in search parameter
        const sqliSearch = await request("/api/programs?search=' OR '1'='1", { token: superToken });
        record("Security SQLi", "SQL Injection in search sanitized", sqliSearch.status === 200 && Array.isArray(sqliSearch.data?.data));

    } catch (err) {
        console.error("Test execution exception:", err);
    } finally {
        console.log("\nStopping Next.js server...");
        serverProcess.kill('SIGINT');
        await sleep(1000);
    }

    // ========================================================
    // TEST REPORT SUMMARY
    // ========================================================
    console.log("\n===============================================================");
    console.log("                     FINAL TEST SUMMARY                        ");
    console.log("===============================================================");
    const passedCount = results.filter(r => r.status === "PASS").length;
    const failedCount = results.filter(r => r.status === "FAIL").length;
    console.log(`TOTAL TESTS EXECUTED: ${results.length}`);
    console.log(`PASSED: ${passedCount}`);
    console.log(`FAILED: ${failedCount}`);

    if (failedCount > 0) {
        console.log("\nFAILED TESTS:");
        console.table(results.filter(r => r.status === "FAIL"));
    }

    process.exit(failedCount > 0 ? 1 : 0);
}

main();
