import jwt from "jsonwebtoken";
import pool from "./db.js";
export * from "./rbac-rules.js";
import { getUserRole, ROLES } from "./rbac-rules.js";

export const JWT_SECRET =
    process.env.JWT_SECRET || "cricketAcademy_2026@Admin#Panel$Role%Secure123";

/**
 * Extract authenticated user context from request cookies or getServerSession
 */
export async function getAuthUser(request) {
    try {
        let token = null;

        if (request && typeof request.cookies?.get === "function") {
            token = request.cookies.get("auth_token")?.value;
        }

        if (!token && request && typeof request.headers?.get === "function") {
            const authHeader = request.headers.get("authorization");
            if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
                token = authHeader.slice(7).trim();
            }
        }

        if (!token) {
            try {
                const nextHeaders = await import("next/headers");
                const cookieStore = await nextHeaders.cookies();
                token = cookieStore.get("auth_token")?.value;
            } catch (cErr) {
                // If not in a Next.js request context (e.g. script/test), cookies won't be available
            }
        }

        if (!token) return null;

        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded || !decoded.id) return null;

        // Fetch fresh status and assignment from DB to guarantee security
        const [rows] = await pool.query(
            `SELECT id, appointment_no, academy_id, branch_id, first_name, last_name, email, phone, user_type, status, is_deleted
             FROM cst_users
             WHERE id = ?
             LIMIT 1`,
            [decoded.id]
        );

        if (!rows || rows.length === 0) return null;
        const u = rows[0];

        if (Number(u.is_deleted) === 1 || Number(u.status) !== 1) {
            return null;
        }

        const role = getUserRole(u);

        return {
            id: u.id,
            appointment_no: u.appointment_no,
            academy_id: u.academy_id ? Number(u.academy_id) : null,
            branch_id: u.branch_id ? Number(u.branch_id) : null,
            first_name: u.first_name,
            last_name: u.last_name,
            email: u.email,
            phone: u.phone,
            user_type: u.user_type,
            role,
            isSuperAdmin: role === ROLES.SUPER_ADMIN,
            isAcademyAdmin: role === ROLES.ACADEMY_ADMIN,
            isBranchAdmin: role === ROLES.BRANCH_ADMIN,
            isManagement: role === ROLES.MANAGEMENT,
            isAccountant: role === ROLES.ACCOUNTANT,
            isCoach: role === ROLES.COACH,
            isStaff: role === ROLES.STAFF || role === ROLES.GROUND_STAFF,
            isPlayer: role === ROLES.PLAYER,
        };
    } catch (err) {
        return null;
    }
}

/**
 * Helper to fetch batch IDs assigned to a Coach
 */
export async function getCoachBatchIds(connectionOrPool, coachUserId) {
    if (!coachUserId) return [];
    try {
        let sql = `SELECT DISTINCT batch_id
             FROM cst_batch_coaches
             WHERE status = 1
               AND is_deleted = 0`;
        const params = [];
        if (Array.isArray(coachUserId)) {
            if (coachUserId.length === 0) return [];
            sql += ` AND coach_user_id IN (?)`;
            params.push(coachUserId);
        } else {
            sql += ` AND coach_user_id = ?`;
            params.push(coachUserId);
        }
        const [rows] = await connectionOrPool.query(sql, params);
        return rows.map((r) => Number(r.batch_id)).filter(Boolean);
    } catch (err) {
        console.error("getCoachBatchIds error:", err);
        return [];
    }
}

/**
 * Helper to fetch player user_program_ids assigned to a Coach's batches
 */
export async function getCoachUserProgramIds(connectionOrPool, coachUserIdOrBatchIds) {
    let batchIds = [];
    if (Array.isArray(coachUserIdOrBatchIds)) {
        batchIds = coachUserIdOrBatchIds;
    } else {
        batchIds = await getCoachBatchIds(connectionOrPool, coachUserIdOrBatchIds);
    }
    if (!batchIds.length) return [];
    try {
        const [rows] = await connectionOrPool.query(
            `SELECT DISTINCT user_program_id
             FROM cst_batch_players
             WHERE batch_id IN (?)
               AND status = 'Active'`,
            [batchIds]
        );
        return rows.map((r) => Number(r.user_program_id)).filter(Boolean);
    } catch (err) {
        console.error("getCoachUserProgramIds error:", err);
        return [];
    }
}

/**
 * Helper to fetch admission_players_ids in Coach's batches
 */
export async function getCoachAdmissionPlayerIds(connectionOrPool, coachUserIdOrProgramIds) {
    let userProgramIds = [];
    if (Array.isArray(coachUserIdOrProgramIds)) {
        userProgramIds = coachUserIdOrProgramIds;
    } else {
        userProgramIds = await getCoachUserProgramIds(connectionOrPool, coachUserIdOrProgramIds);
    }
    if (!userProgramIds.length) return [];
    try {
        const [rows] = await connectionOrPool.query(
            `SELECT DISTINCT admission_players_id
             FROM cst_user_programs
             WHERE id IN (?)
               AND is_deleted = 0`,
            [userProgramIds]
        );
        return rows.map((r) => Number(r.admission_players_id)).filter(Boolean);
    } catch (err) {
        console.error("getCoachAdmissionPlayerIds error:", err);
        return [];
    }
}
