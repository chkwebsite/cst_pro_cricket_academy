import { NextResponse } from "next/server";
import pool from "./db.js";
import { getAuthUser, ROLES } from "./rbac.js";

/**
 * Tenant Isolation & Access Control Security Module
 * CST Cricket Academy Management System
 * 
 * Enforces strict Academy-wise and Branch-wise data isolation at the API and Database layer.
 */

/**
 * Get authenticated user with full tenant context (primary + assigned branches).
 * If unauthenticated or role not permitted, returns a ready-to-return NextResponse error.
 * 
 * @param {Request} request 
 * @param {Object} options { allowedRoles?: Array<string> }
 * @returns {Promise<{ user: Object|null, errorResponse: NextResponse|null }>}
 */
export async function getAuthenticatedUser(request, options = {}) {
    try {
        const user = await getAuthUser(request);
        if (!user || !user.id) {
            return {
                user: null,
                errorResponse: NextResponse.json(
                    { success: false, message: "Unauthorized: Please log in to continue" },
                    { status: 401 }
                ),
            };
        }

        // Fetch all assigned branches from cst_user_branches
        let assignedBranchIds = [];
        try {
            const [rows] = await pool.query(
                `SELECT branch_id FROM cst_user_branches WHERE user_id = ? AND status = 1`,
                [user.id]
            );
            const extraBranchIds = rows.map((r) => Number(r.branch_id)).filter(Boolean);
            const branchSet = new Set();
            if (user.branch_id) branchSet.add(Number(user.branch_id));
            extraBranchIds.forEach((bId) => branchSet.add(bId));
            assignedBranchIds = Array.from(branchSet);
        } catch (dbErr) {
            console.error("Error fetching user branches:", dbErr);
            assignedBranchIds = user.branch_id ? [Number(user.branch_id)] : [];
        }

        user.assignedBranchIds = assignedBranchIds;
        user.accessibleBranchIds = assignedBranchIds;

        // Role authorization check if allowedRoles is specified
        if (options.allowedRoles && Array.isArray(options.allowedRoles) && options.allowedRoles.length > 0) {
            const isAllowed = options.allowedRoles.includes(user.role);
            if (!isAllowed) {
                return {
                    ...user,
                    user,
                    errorResponse: NextResponse.json(
                        { success: false, message: "Forbidden: You do not have permission to perform this action" },
                        { status: 403 }
                    ),
                };
            }
        }

        return {
            ...user,
            user,
            errorResponse: null,
        };
    } catch (err) {
        console.error("getAuthenticatedUser error:", err);
        return {
            user: null,
            errorResponse: NextResponse.json(
                { success: false, message: "Internal server error during authentication" },
                { status: 500 }
            ),
        };
    }
}

/**
 * Resolve tenant query scope based on user's role and requested filters.
 * 
 * Access Rules:
 * - Super Admin: Unrestricted by default. Can optionally filter by requested academy_id and branch_id.
 * - Academy Admin: STRICTLY restricted to user.academy_id. Can view all branches in their academy, or filter to a specific requested branch.
 * - Branch Admin: STRICTLY restricted to user.academy_id AND user.branch_id. Requested branch_id is ignored/forced.
 * - Staff / Accountant / Coach / Management: Scoped to user.academy_id AND user.assignedBranchIds.
 * - Player: Scoped to user.academy_id, user.branch_id, AND strictly forced user_id = user.id.
 * 
 * @param {Object} user Authenticated user object
 * @param {Object|URLSearchParams} searchParams URL search params or plain object
 * @returns {Object} { academyId, branchIds, userId, isSuperAdmin, isAcademyAdmin, isBranchAdmin, isPlayer }
 */
export function resolveTenantScope(user, searchParams = {}) {
    const getParam = (key) => {
        if (!searchParams) return null;
        if (typeof searchParams.get === "function") return searchParams.get(key);
        return searchParams[key] ?? null;
    };

    const requestedAcademyId = getParam("academy_id") ? Number(getParam("academy_id")) : null;
    const requestedBranchId = getParam("branch_id") ? Number(getParam("branch_id")) : null;
    const requestedUserId = getParam("user_id") ? Number(getParam("user_id")) : null;

    // Super Admin: global access, can filter if explicitly specified
    if (user.isSuperAdmin) {
        return {
            academyId: requestedAcademyId || null,
            branchIds: requestedBranchId ? [requestedBranchId] : [],
            userId: requestedUserId || null,
            isSuperAdmin: true,
            isAcademyAdmin: false,
            isBranchAdmin: false,
            isPlayer: false,
        };
    }

    // Academy Admin: strictly own academy, can view all branches or filter to requested branch
    if (user.isAcademyAdmin) {
        return {
            academyId: Number(user.academy_id),
            branchIds: requestedBranchId ? [requestedBranchId] : [],
            userId: requestedUserId || null,
            isSuperAdmin: false,
            isAcademyAdmin: true,
            isBranchAdmin: false,
            isPlayer: false,
        };
    }

    // Branch Admin: strictly own academy AND own branch
    if (user.isBranchAdmin) {
        return {
            academyId: Number(user.academy_id),
            branchIds: user.branch_id ? [Number(user.branch_id)] : [-1],
            userId: requestedUserId || null,
            isSuperAdmin: false,
            isAcademyAdmin: false,
            isBranchAdmin: true,
            isPlayer: false,
        };
    }

    // Player: strictly own user record and own branch
    if (user.isPlayer) {
        return {
            academyId: Number(user.academy_id),
            branchIds: user.branch_id ? [Number(user.branch_id)] : [],
            userId: Number(user.id), // Strictly forced! Cannot view other players
            isSuperAdmin: false,
            isAcademyAdmin: false,
            isBranchAdmin: false,
            isPlayer: true,
        };
    }

    // Branch Staff / Accountant / Coach / Management / Ground Staff
    let authorizedBranches = user.assignedBranchIds && user.assignedBranchIds.length > 0
        ? user.assignedBranchIds
        : (user.branch_id ? [Number(user.branch_id)] : [-1]);

    if (requestedBranchId) {
        // If specific branch requested, allow only if in authorized branches
        if (authorizedBranches.includes(requestedBranchId)) {
            authorizedBranches = [requestedBranchId];
        } else {
            // Requested branch outside user's assignment -> match nothing
            authorizedBranches = [-1];
        }
    }

    return {
        academyId: Number(user.academy_id),
        branchIds: authorizedBranches,
        userId: requestedUserId || null,
        isSuperAdmin: false,
        isAcademyAdmin: false,
        isBranchAdmin: false,
        isPlayer: false,
    };
}

/**
 * Builds SQL WHERE condition string and appends values to params array.
 * 
 * @param {string} tableAlias Alias of the target table, e.g. "cst_batches" or "b"
 * @param {Object} scope Resolved tenant scope from resolveTenantScope
 * @param {Object} options Configuration options
 *   - hasAcademy: boolean (default true)
 *   - hasBranch: boolean (default true)
 *   - hasUser: boolean (default false, true for player-scoped queries)
 *   - academyColumn: string (default "academy_id")
 *   - branchColumn: string (default "branch_id")
 *   - userColumn: string (default "user_id")
 * @returns {{ sql: string, params: Array<any> }}
 */
export function buildTenantWhere(tableAlias, scope, options = {}) {
    const hasAcademy = options.hasAcademy !== false;
    const hasBranch = options.hasBranch !== false;
    const hasUser = Boolean(options.hasUser);
    const academyCol = options.academyColumn || "academy_id";
    const branchCol = options.branchColumn || "branch_id";
    const userCol = options.userColumn || "user_id";

    const prefix = tableAlias ? `${tableAlias}.` : "";
    let sql = "";
    const params = [];

    if (hasAcademy && scope.academyId) {
        sql += ` AND ${prefix}${academyCol} = ?`;
        params.push(scope.academyId);
    }

    if (hasBranch && scope.branchIds && scope.branchIds.length > 0) {
        if (scope.branchIds.length === 1) {
            sql += ` AND ${prefix}${branchCol} = ?`;
            params.push(scope.branchIds[0]);
        } else {
            sql += ` AND ${prefix}${branchCol} IN (?)`;
            params.push(scope.branchIds);
        }
    }

    if (hasUser && scope.userId) {
        sql += ` AND ${prefix}${userCol} = ?`;
        params.push(scope.userId);
    }

    return { sql, params };
}

/**
 * Verifies that a single record belongs to the user's authorized academy and branch before GET detail, PUT, or DELETE.
 * Returns { errorResponse: null, record } on success, or { errorResponse, record: null } on failure.
 * 
 * @param {Object} connection MySQL connection or pool
 * @param {Object} config
 *   - table: string (table name, e.g. "cst_batches")
 *   - id: number|string (record ID)
 *   - user: Object (authenticated user)
 *   - academyColumn?: string (default "academy_id", pass null if table has no academy_id)
 *   - branchColumn?: string (default "branch_id", pass null if table has no branch_id)
 *   - userColumn?: string (default null, e.g. "user_id" for player-owned records)
 *   - softDeleteColumn?: string (default "is_deleted", pass null if table has no soft delete)
 *   - selectCols?: string (default "*")
 * @returns {Promise<{ errorResponse: NextResponse|null, record: Object|null }>}
 */
export async function verifyRecordAccess(connection, {
    table,
    id,
    user,
    academyColumn = "academy_id",
    branchColumn = "branch_id",
    userColumn = null,
    softDeleteColumn = "is_deleted",
    selectCols = "*",
}) {
    if (!id) {
        return {
            errorResponse: NextResponse.json({ success: false, message: "ID is required" }, { status: 400 }),
            record: null,
        };
    }

    let query = `SELECT ${selectCols} FROM ${table} WHERE id = ?`;
    const params = [id];

    if (softDeleteColumn) {
        query += ` AND ${softDeleteColumn} = 0`;
    }
    query += ` LIMIT 1`;

    const [rows] = await connection.query(query, params);
    if (!rows || rows.length === 0) {
        return {
            errorResponse: NextResponse.json({ success: false, message: "Record not found" }, { status: 404 }),
            record: null,
        };
    }

    const record = rows[0];

    // Super Admin has global access to all records
    if (user.isSuperAdmin) {
        return { errorResponse: null, record };
    }

    // Verify Academy ownership
    if (academyColumn && record[academyColumn] !== undefined && record[academyColumn] !== null) {
        if (Number(record[academyColumn]) !== Number(user.academy_id)) {
            return {
                errorResponse: NextResponse.json(
                    { success: false, message: "Access denied: Record belongs to another academy" },
                    { status: 403 }
                ),
                record: null,
            };
        }
    }

    // Verify Branch ownership
    if (branchColumn && record[branchColumn] !== undefined && record[branchColumn] !== null) {
        const recordBranchId = Number(record[branchColumn]);

        if (user.isBranchAdmin) {
            if (recordBranchId !== Number(user.branch_id)) {
                return {
                    errorResponse: NextResponse.json(
                        { success: false, message: "Access denied: Record belongs to another branch" },
                        { status: 403 }
                    ),
                    record: null,
                };
            }
        } else if (!user.isAcademyAdmin) {
            // For Staff / Coach / Accountant, verify branch is in assigned branches
            const allowedBranches = user.assignedBranchIds || (user.branch_id ? [Number(user.branch_id)] : []);
            if (!allowedBranches.includes(recordBranchId)) {
                return {
                    errorResponse: NextResponse.json(
                        { success: false, message: "Access denied: Record belongs to an unauthorized branch" },
                        { status: 403 }
                    ),
                    record: null,
                };
            }
        }
    }

    // Verify Player ownership for player-specific tables
    if (user.isPlayer && userColumn && record[userColumn] !== undefined && record[userColumn] !== null) {
        if (Number(record[userColumn]) !== Number(user.id)) {
            return {
                errorResponse: NextResponse.json(
                    { success: false, message: "Access denied: You cannot access another player's record" },
                    { status: 403 }
                ),
                record: null,
            };
        }
    }

    return { errorResponse: null, record };
}

/**
 * Validates that a branch belongs to a specific academy.
 * 
 * @param {Object} connection 
 * @param {number|string} branchId 
 * @param {number|string} academyId 
 * @returns {Promise<boolean>}
 */
export async function validateBranchBelongsToAcademy(connection, branchId, academyId) {
    if (!branchId || !academyId) return false;
    try {
        const [rows] = await connection.query(
            `SELECT id FROM cst_branch WHERE id = ? AND academy_id = ? AND is_deleted = 0 LIMIT 1`,
            [branchId, academyId]
        );
        return rows && rows.length > 0;
    } catch (err) {
        console.error("validateBranchBelongsToAcademy error:", err);
        return false;
    }
}

/**
 * Validates that a program belongs to a specific academy.
 * 
 * @param {Object} connection 
 * @param {number|string} programId 
 * @param {number|string} academyId 
 * @returns {Promise<boolean>}
 */
export async function validateProgramBelongsToAcademy(connection, programId, academyId) {
    if (!programId || !academyId) return false;
    try {
        const [rows] = await connection.query(
            `SELECT id FROM cst_programs WHERE id = ? AND academy_id = ? AND is_deleted = 0 LIMIT 1`,
            [programId, academyId]
        );
        return rows && rows.length > 0;
    } catch (err) {
        console.error("validateProgramBelongsToAcademy error:", err);
        return false;
    }
}

/**
 * Sanitizes and overrides tenant ownership fields (academy_id, branch_id) for POST/PUT mutations.
 * Prevents clients from spoofing academy_id or branch_id.
 * 
 * @param {Object} user Authenticated user
 * @param {Object} payload Mutation data object (or parsed form data)
 * @param {Object} connection MySQL connection for branch verification
 * @returns {Promise<{ sanitized: Object, errorResponse: NextResponse|null }>}
 */
export async function sanitizeMutationPayload(user, payload, connection) {
    const sanitized = { ...payload };

    if (user.isSuperAdmin) {
        // Super Admin can set academy_id and branch_id
        return { sanitized, errorResponse: null };
    }

    // Force academy_id to user's assigned academy
    sanitized.academy_id = Number(user.academy_id);

    if (user.isAcademyAdmin) {
        // Academy Admin: if branch_id is supplied, verify it belongs to their academy
        if (sanitized.branch_id) {
            const isValid = await validateBranchBelongsToAcademy(connection, sanitized.branch_id, user.academy_id);
            if (!isValid) {
                return {
                    sanitized: null,
                    errorResponse: NextResponse.json(
                        { success: false, message: "Invalid branch: The selected branch does not belong to your academy" },
                        { status: 400 }
                    ),
                };
            }
        }
        return { sanitized, errorResponse: null };
    }

    if (user.isBranchAdmin) {
        // Branch Admin: strictly force branch_id to user's assigned branch
        sanitized.branch_id = Number(user.branch_id);
        return { sanitized, errorResponse: null };
    }

    if (user.isPlayer) {
        // Player: force user_id, academy_id, branch_id
        sanitized.user_id = Number(user.id);
        sanitized.academy_id = Number(user.academy_id);
        sanitized.branch_id = Number(user.branch_id);
        return { sanitized, errorResponse: null };
    }

    // Staff / Coach / Accountant
    if (sanitized.branch_id) {
        const requestedBranch = Number(sanitized.branch_id);
        const allowedBranches = user.assignedBranchIds || [Number(user.branch_id)];
        if (!allowedBranches.includes(requestedBranch)) {
            return {
                sanitized: null,
                errorResponse: NextResponse.json(
                    { success: false, message: "Invalid branch: You are not authorized to create records for this branch" },
                    { status: 403 }
                ),
            };
        }
    } else {
        sanitized.branch_id = Number(user.branch_id);
    }

    return { sanitized, errorResponse: null };
}
