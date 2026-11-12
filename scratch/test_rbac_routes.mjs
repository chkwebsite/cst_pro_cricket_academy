import { ROLES, isRoutePermittedForRole } from "../src/app/components/lib/rbac-rules.js";

const crossRoleTests = [
  // Player restrictions
  { role: ROLES.PLAYER, route: "/next_panel/staff", shouldAllow: false },
  { role: ROLES.PLAYER, route: "/next_panel/academies", shouldAllow: false },
  { role: ROLES.PLAYER, route: "/next_panel/branches", shouldAllow: false },
  { role: ROLES.PLAYER, route: "/next_panel/staff-salary", shouldAllow: false },
  { role: ROLES.PLAYER, route: "/next_panel/dashboard", shouldAllow: true }, // general dashboard allowed but redirects to player-dashboard
  { role: ROLES.PLAYER, route: "/next_panel/player-dashboard", shouldAllow: true },
  { role: ROLES.PLAYER, route: "/next_panel/ground-availability", shouldAllow: true },
  { role: ROLES.PLAYER, route: "/next_panel/fee-status", shouldAllow: true },

  // Coach restrictions
  { role: ROLES.COACH, route: "/next_panel/staff-salary", shouldAllow: false },
  { role: ROLES.COACH, route: "/next_panel/academies", shouldAllow: false },
  { role: ROLES.COACH, route: "/next_panel/branches", shouldAllow: false },
  { role: ROLES.COACH, route: "/next_panel/coaches", shouldAllow: false },
  { role: ROLES.COACH, route: "/next_panel/batches", shouldAllow: true },
  { role: ROLES.COACH, route: "/next_panel/batch-players", shouldAllow: true },
  { role: ROLES.COACH, route: "/next_panel/player-attendance", shouldAllow: true },

  // Staff restrictions
  { role: ROLES.STAFF, route: "/next_panel/staff-salary", shouldAllow: false },
  { role: ROLES.STAFF, route: "/next_panel/academies", shouldAllow: false },
  { role: ROLES.STAFF, route: "/next_panel/branches", shouldAllow: false },

  // Accountant restrictions
  { role: ROLES.ACCOUNTANT, route: "/next_panel/academies", shouldAllow: false },
  { role: ROLES.ACCOUNTANT, route: "/next_panel/branches", shouldAllow: false },
  { role: ROLES.ACCOUNTANT, route: "/next_panel/coaches", shouldAllow: false },
  { role: ROLES.ACCOUNTANT, route: "/next_panel/fee-payments", shouldAllow: true },
  { role: ROLES.ACCOUNTANT, route: "/next_panel/player-fees-matrix", shouldAllow: true },

  // Branch Admin restrictions
  { role: ROLES.BRANCH_ADMIN, route: "/next_panel/academies", shouldAllow: false },
  { role: ROLES.BRANCH_ADMIN, route: "/next_panel/branches", shouldAllow: false },
  { role: ROLES.BRANCH_ADMIN, route: "/next_panel/batches", shouldAllow: true },
  { role: ROLES.BRANCH_ADMIN, route: "/next_panel/admission-players", shouldAllow: true },

  // Academy Admin permissions
  { role: ROLES.ACADEMY_ADMIN, route: "/next_panel/academies", shouldAllow: false }, // only superadmin manages academies
  { role: ROLES.ACADEMY_ADMIN, route: "/next_panel/branches", shouldAllow: true },
  { role: ROLES.ACADEMY_ADMIN, route: "/next_panel/admission-players", shouldAllow: true },

  // Super Admin permissions
  { role: ROLES.SUPER_ADMIN, route: "/next_panel/academies", shouldAllow: true },
  { role: ROLES.SUPER_ADMIN, route: "/next_panel/branches", shouldAllow: true },
  { role: ROLES.SUPER_ADMIN, route: "/next_panel/dashboard", shouldAllow: true },
];

console.log("=== CROSS-ROLE ROUTE ACCESS MATRIX ===");
const report = crossRoleTests.map(t => {
  const allowed = isRoutePermittedForRole(t.role, t.route);
  const pass = allowed === t.shouldAllow;
  return {
    role: t.role,
    route: t.route,
    allowed,
    expectedAllowed: t.shouldAllow,
    status: pass ? "PASS" : "FAIL",
  };
});
console.table(report);
