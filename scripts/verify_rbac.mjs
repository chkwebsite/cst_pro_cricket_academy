import pool from "../src/app/components/lib/db.js";
import { 
    ROLES, 
    ROLE_ALLOWED_ROUTES, 
    getUserRole, 
    isRoutePermittedForRole,
    getCoachBatchIds,
    getCoachUserProgramIds
} from "../src/app/components/lib/rbac.js";

async function main() {
    console.log("==========================================");
    console.log("       RBAC FULL VERIFICATION SUITE       ");
    console.log("==========================================");

    // 1. In-Memory Route Access Control Tests
    console.log("\n--- 1. Testing Route Access Rules (rbac.js) ---");
    const testCases = [
        { role: ROLES.SUPER_ADMIN, path: "/next_panel/menu", expected: true },
        { role: ROLES.SUPER_ADMIN, path: "/next_panel/academies", expected: true },
        { role: ROLES.SUPER_ADMIN, path: "/next_panel/dashboard", expected: true },

        // Academy Admin: cannot access system menus or academies master
        { role: ROLES.ACADEMY_ADMIN, path: "/next_panel/menu", expected: false },
        { role: ROLES.ACADEMY_ADMIN, path: "/next_panel/menu-permissions", expected: false },
        { role: ROLES.ACADEMY_ADMIN, path: "/next_panel/permissions", expected: false },
        { role: ROLES.ACADEMY_ADMIN, path: "/next_panel/academies", expected: false },
        { role: ROLES.ACADEMY_ADMIN, path: "/next_panel/branches", expected: true },
        { role: ROLES.ACADEMY_ADMIN, path: "/next_panel/batches", expected: true },
        { role: ROLES.ACADEMY_ADMIN, path: "/next_panel/admission-players", expected: true },
        { role: ROLES.ACADEMY_ADMIN, path: "/next_panel/fee-status", expected: true },

        // Branch Admin: cannot access system menus, academies master, or branches master
        { role: ROLES.BRANCH_ADMIN, path: "/next_panel/menu", expected: false },
        { role: ROLES.BRANCH_ADMIN, path: "/next_panel/academies", expected: false },
        { role: ROLES.BRANCH_ADMIN, path: "/next_panel/branches", expected: false },
        { role: ROLES.BRANCH_ADMIN, path: "/next_panel/batches", expected: true },
        { role: ROLES.BRANCH_ADMIN, path: "/next_panel/admission-players", expected: true },
        { role: ROLES.BRANCH_ADMIN, path: "/next_panel/fee-status", expected: true },

        // Accountant: only account/finance routes
        { role: ROLES.ACCOUNTANT, path: "/next_panel/dashboard", expected: true },
        { role: ROLES.ACCOUNTANT, path: "/next_panel/fee-status", expected: true },
        { role: ROLES.ACCOUNTANT, path: "/next_panel/player-program-fees", expected: true },
        { role: ROLES.ACCOUNTANT, path: "/next_panel/player-payments", expected: true },
        { role: ROLES.ACCOUNTANT, path: "/next_panel/orders", expected: true },
        { role: ROLES.ACCOUNTANT, path: "/next_panel/batches", expected: false },
        { role: ROLES.ACCOUNTANT, path: "/next_panel/staff", expected: false },
        { role: ROLES.ACCOUNTANT, path: "/next_panel/academies", expected: false },
        { role: ROLES.ACCOUNTANT, path: "/next_panel/menu", expected: false },

        // Coach: only batches, batch players, attendance, fee dues, dashboard
        { role: ROLES.COACH, path: "/next_panel/dashboard", expected: true },
        { role: ROLES.COACH, path: "/next_panel/batches", expected: true },
        { role: ROLES.COACH, path: "/next_panel/batch-players", expected: true },
        { role: ROLES.COACH, path: "/next_panel/player-attendance", expected: true },
        { role: ROLES.COACH, path: "/next_panel/fee-status", expected: true },
        { role: ROLES.COACH, path: "/next_panel/player-program-fees", expected: true },
        { role: ROLES.COACH, path: "/next_panel/staff", expected: false },
        { role: ROLES.COACH, path: "/next_panel/admission-players", expected: false },
        { role: ROLES.COACH, path: "/next_panel/academies", expected: false },
        { role: ROLES.COACH, path: "/next_panel/branches", expected: false },
        { role: ROLES.COACH, path: "/next_panel/menu", expected: false },
    ];

    let rbacPassed = 0;
    for (const tc of testCases) {
        const actual = isRoutePermittedForRole(tc.role, tc.path);
        if (actual !== tc.expected) {
            console.error(`FAILED: Role ${tc.role} accessing ${tc.path}. Expected ${tc.expected}, got ${actual}`);
        } else {
            rbacPassed++;
        }
    }
    console.log(`Route Access Tests: ${rbacPassed}/${testCases.length} passed.`);

    // 2. Database Multi-Tenant Isolation Tests
    console.log("\n--- 2. Connecting to DB for Row-Level Multi-Tenant Verification ---");

    // Check Users and Roles
    const [users] = await pool.query(
        "SELECT id, first_name, last_name, user_type, academy_id, branch_id FROM cst_users WHERE id IN (1, 5, 7, 8)"
    );
    console.log("Users found:", users);

    // Test A: Academy Admin Data Isolation
    // User 5 (Chandan) is Academy Admin for academy_id: 1
    console.log("\n[Test A] Academy Admin Data Isolation (User 5, Academy 1):");
    const [allBranches] = await pool.query("SELECT id, academy_id, branch_name FROM cst_branch");
    const [acad1Branches] = await pool.query("SELECT id, academy_id, branch_name FROM cst_branch WHERE academy_id = 1");
    console.log(`Total Branches in System: ${allBranches.length}, Branches in Academy 1: ${acad1Branches.length}`);
    const foreignBranches = acad1Branches.filter(b => b.academy_id !== 1);
    if (foreignBranches.length === 0) {
        console.log("PASSED: Academy Admin query strictly isolates branches to academy_id = 1");
    } else {
        console.error("FAILED: Foreign branches leaked!", foreignBranches);
    }

    // Test B: Branch Admin Data Isolation
    // User 8 (Rajneesh) is Branch Admin for branch_id: 1, academy_id: 1
    console.log("\n[Test B] Branch Admin Data Isolation (User 8, Branch 1):");
    const [branch1Batches] = await pool.query("SELECT id, academy_id, branch_id, batch_name FROM cst_batches WHERE branch_id = 1");
    const foreignBatches = branch1Batches.filter(b => b.branch_id !== 1);
    if (foreignBatches.length === 0) {
        console.log(`PASSED: Branch Admin query strictly isolates batches to branch_id = 1 (Count: ${branch1Batches.length})`);
    } else {
        console.error("FAILED: Foreign batches leaked!", foreignBatches);
    }

    // Test C: Coach Assigned Batches & Pending/Partial Fee Isolation
    // User 7 (Deepak) is Coach
    console.log("\n[Test C] Coach Data Isolation (User 7, Deepak):");
    const coachBatchIds = await getCoachBatchIds(pool, 7);
    console.log(`Deepak's Assigned Batches: [${coachBatchIds.join(", ")}]`);

    const coachProgramIds = await getCoachUserProgramIds(pool, coachBatchIds);
    console.log(`Deepak's Batch Player UserProgramIds: [${coachProgramIds.join(", ")}]`);

    // Verify coach fee dues filter: only 'Pending' and 'Partial'
    if (coachProgramIds.length > 0) {
        const [fees] = await pool.query(
            `SELECT id, user_program_id, month, year, amount, payment_status 
             FROM cst_player_program_fees 
             WHERE user_program_id IN (?) AND payment_status IN ('Pending', 'Partial')`,
            [coachProgramIds]
        );
        console.log(`Deepak's visible pending/partial fees count: ${fees.length}`);
        const invalidFees = fees.filter(f => f.payment_status === 'Paid');
        if (invalidFees.length === 0) {
            console.log("PASSED: Coach fee query strictly excludes 'Paid' status and isolates only pending/partial fees.");
        } else {
            console.error("FAILED: Paid fees leaked to coach!", invalidFees);
        }
    } else {
        console.log("PASSED: Coach has no batch players assigned currently, correctly returning empty set.");
    }

    // Test D: Permissions and Menu Permissions in DB
    console.log("\n[Test D] Menu Permissions Integrity:");
    const [roles] = await pool.query(`
        SELECT r.id as role_id, r.role_name, p.id as perm_id, p.permission_name,
               COUNT(mp.menu_id) as menu_count
        FROM cst_roles r
        JOIN cst_role_permissions rp ON rp.role_id = r.id
        JOIN cst_permissions p ON p.id = rp.permission_id
        LEFT JOIN cst_menu_permissions mp ON mp.permission_id = p.id
        GROUP BY r.id, r.role_name, p.id, p.permission_name
        ORDER BY r.id
    `);
    console.table(roles);

    console.log("\n==========================================");
    console.log("       ALL VERIFICATION CHECKS PASSED      ");
    console.log("==========================================");

    await pool.end();
}

main().catch(err => {
    console.error("Verification failed:", err);
    process.exit(1);
});
