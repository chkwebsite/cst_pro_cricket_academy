import pool from "./db.js";
import { ROLES, getUserRole } from "./rbac-rules.js";
import { NextResponse } from "next/server.js";

/**
 * Format a Date object or date-like string to YYYY-MM-DD
 */
export function formatDateToYMD(dateInput) {
    if (!dateInput) return null;
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

/**
 * Add days to a YYYY-MM-DD string or Date
 */
export function addDays(dateInput, days) {
    const d = new Date(dateInput);
    d.setDate(d.getDate() + Number(days));
    return formatDateToYMD(d);
}

/**
 * Add months to a YYYY-MM-DD string or Date
 */
export function addMonths(dateInput, months) {
    const d = new Date(dateInput);
    d.setMonth(d.getMonth() + Number(months));
    // Subtract 1 day so 1 month from Jan 1 is Jan 31
    d.setDate(d.getDate() - 1);
    return formatDateToYMD(d);
}

/**
 * Calculate difference in whole days between two YYYY-MM-DD dates (d2 - d1)
 */
export function diffInDays(dateStr1, dateStr2) {
    const d1 = new Date(`${dateStr1}T00:00:00Z`);
    const d2 = new Date(`${dateStr2}T00:00:00Z`);
    const diffMs = d2.getTime() - d1.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Generate a unique invoice number for subscription payments
 */
export function generateInvoiceNumber(academyId) {
    const now = new Date();
    const yr = now.getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `INV-SUB-${yr}-A${academyId || 0}-${Date.now().toString().slice(-6)}${rand}`;
}

/**
 * Generate a unique transaction reference if not provided
 */
export function generateTransactionId() {
    return `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

/**
 * Pure server-side subscription calculation logic.
 * Handles exact boundaries for active, grace period (5 days default), and expiry.
 * 
 * @param {Object|null} sub Row from cst_academy_subscriptions
 * @param {number|string} academyStatus 1 = active, 0 = inactive
 * @param {Date|string} targetDate Reference date (defaults to current server date)
 */
export function calculateSubscriptionStatus(sub, academyStatus = 1, targetDate = new Date()) {
    const todayStr = formatDateToYMD(targetDate);
    const isAcademyActive = Number(academyStatus) === 1;

    if (!sub || !sub.id) {
        return {
            has_subscription: false,
            subscription_id: null,
            academy_id: sub?.academy_id ? Number(sub.academy_id) : null,
            academy_name: sub?.academy_name || "Academy",
            plan_id: null,
            plan_name: "No Active Plan",
            plan_code: null,
            duration_months: 0,
            price: 0,
            subscription_start_date: null,
            subscription_end_date: null,
            grace_period_days: 5,
            grace_end_date: null,
            subscription_status: "none",
            payment_status: "none",
            is_manual: 0,
            is_subscription_active: false,
            is_grace_period: false,
            is_academy_active: isAcademyActive,
            is_read_only: true,
            grace_days_remaining: 0,
            days_until_expiry: 0,
            show_subscription_alert: false,
            is_access_allowed: false,
            message: isAcademyActive
                ? "No active subscription found for this academy. Please subscribe to continue."
                : "Your academy is currently inactive. Please contact the system administrator.",
        };
    }

    const startDateStr = formatDateToYMD(sub.subscription_start_date);
    const endDateStr = formatDateToYMD(sub.subscription_end_date);
    const graceDays = Number(sub.grace_period_days ?? 5);
    // Calculate or use grace_end_date
    const graceEndDateStr = sub.grace_end_date
        ? formatDateToYMD(sub.grace_end_date)
        : addDays(endDateStr, graceDays);

    let calculatedStatus = sub.subscription_status || "active";
    let isSubscriptionActive = false;
    let isGracePeriod = false;
    let graceDaysRemaining = 0;
    let daysUntilExpiry = 0;
    let showAlert = false;
    let message = "";

    // If manually suspended or cancelled, respect explicit status
    if (calculatedStatus === "suspended") {
        isSubscriptionActive = false;
        isGracePeriod = false;
        message = "Your academy subscription has been suspended. Please contact the system administrator.";
    } else if (calculatedStatus === "cancelled") {
        isSubscriptionActive = false;
        isGracePeriod = false;
        message = "Your academy subscription has been cancelled. Please contact the system administrator.";
    } else {
        // Date-driven status determination
        if (todayStr <= endDateStr) {
            // Still in active period
            calculatedStatus = "active";
            isSubscriptionActive = true;
            isGracePeriod = false;
            daysUntilExpiry = Math.max(0, diffInDays(todayStr, endDateStr));
            message = "Subscription is active.";
        } else if (todayStr <= graceEndDateStr) {
            // Expired, but within grace period
            calculatedStatus = "grace_period";
            isSubscriptionActive = true; // Access remains available during grace period!
            isGracePeriod = true;
            showAlert = true;
            // Days remaining includes today
            graceDaysRemaining = Math.max(1, diffInDays(todayStr, graceEndDateStr) + 1);
            message = `Your academy subscription has expired. You are currently using the 5-day grace period (${graceDaysRemaining} day${graceDaysRemaining === 1 ? "" : "s"} remaining). Please renew your subscription to continue using the academy management system.`;
        } else {
            // Past grace period: Expired
            calculatedStatus = "expired";
            isSubscriptionActive = false;
            isGracePeriod = false;
            graceDaysRemaining = 0;
            daysUntilExpiry = 0;
            message = "Your academy subscription has expired beyond the grace period. Access to academy modules is restricted. Please renew to restore full access.";
        }
    }

    // Read-only applies if academy is deactivated OR subscription is not active (expired/suspended/cancelled)
    const isReadOnly = !isAcademyActive || !isSubscriptionActive;

    // Access allowed for normal users requires active academy AND active subscription (active or grace)
    const isAccessAllowed = isAcademyActive && isSubscriptionActive;

    return {
        has_subscription: true,
        subscription_id: sub.id,
        academy_id: Number(sub.academy_id),
        academy_name: sub.academy_name || "Academy",
        plan_id: sub.plan_id ? Number(sub.plan_id) : null,
        plan_name: sub.plan_name || "Standard Plan",
        plan_code: sub.plan_code || "PLAN_STANDARD",
        duration_months: Number(sub.duration_months || 0),
        price: Number(sub.price || 0),
        subscription_start_date: startDateStr,
        subscription_end_date: endDateStr,
        grace_period_days: graceDays,
        grace_end_date: graceEndDateStr,
        subscription_status: calculatedStatus,
        payment_status: sub.payment_status || "success",
        is_manual: Number(sub.is_manual ?? 0),
        is_subscription_active: isSubscriptionActive,
        is_grace_period: isGracePeriod,
        is_academy_active: isAcademyActive,
        is_read_only: isReadOnly,
        grace_days_remaining: graceDaysRemaining,
        days_until_expiry: daysUntilExpiry,
        show_subscription_alert: showAlert,
        is_access_allowed: isAccessAllowed,
        message,
    };
}

/**
 * Fetch academy details and its latest subscription, computing current live status.
 * Also keeps DB status synchronized if it moved into grace_period or expired.
 */
export async function getAcademySubscription(academyId, connectionOrPool = pool) {
    if (!academyId) {
        return calculateSubscriptionStatus(null, 0);
    }

    try {
        // 1. Fetch Academy
        const [academies] = await connectionOrPool.query(
            `SELECT id, academy_name, academy_code, status, is_deleted
             FROM cst_academy
             WHERE id = ? AND is_deleted = 0
             LIMIT 1`,
            [academyId]
        );

        if (!academies || academies.length === 0) {
            return calculateSubscriptionStatus(null, 0);
        }

        const academy = academies[0];

        // 2. Fetch Latest Subscription with Plan Info
        const [subs] = await connectionOrPool.query(
            `SELECT 
                s.*,
                p.plan_name,
                p.plan_code,
                p.duration_months,
                p.price,
                p.features,
                p.description AS plan_description
             FROM cst_academy_subscriptions s
             LEFT JOIN cst_subscription_plans p ON p.id = s.plan_id
             WHERE s.academy_id = ?
             ORDER BY s.id DESC
             LIMIT 1`,
            [academyId]
        );

        const rawSub = subs.length > 0 ? { ...subs[0], academy_name: academy.academy_name } : null;
        const computed = calculateSubscriptionStatus(rawSub, academy.status);

        // 3. Opportunistically sync calculated status into DB if changed and not manually suspended/cancelled
        if (
            rawSub &&
            !["suspended", "cancelled"].includes(rawSub.subscription_status) &&
            rawSub.subscription_status !== computed.subscription_status
        ) {
            try {
                await connectionOrPool.query(
                    `UPDATE cst_academy_subscriptions
                     SET subscription_status = ?, updated_at = NOW()
                     WHERE id = ?`,
                    [computed.subscription_status, rawSub.id]
                );
            } catch (syncErr) {
                console.warn("Failed to auto-sync subscription_status:", syncErr.message);
            }
        }

        return computed;
    } catch (err) {
        console.error("Error in getAcademySubscription:", err);
        return calculateSubscriptionStatus(null, 0);
    }
}

/**
 * Check academy status directly
 */
export async function checkAcademyStatus(academyId, connectionOrPool = pool) {
    if (!academyId) return { exists: false, isActive: false, academy: null };
    try {
        const [rows] = await connectionOrPool.query(
            "SELECT id, academy_name, status, is_deleted FROM cst_academy WHERE id = ? LIMIT 1",
            [academyId]
        );
        if (!rows || rows.length === 0 || Number(rows[0].is_deleted) === 1) {
            return { exists: false, isActive: false, academy: null };
        }
        return {
            exists: true,
            isActive: Number(rows[0].status) === 1,
            academy: rows[0],
        };
    } catch (err) {
        console.error("checkAcademyStatus error:", err);
        return { exists: false, isActive: false, academy: null };
    }
}

/**
 * Check whether a user should be restricted to Read-Only access.
 * Super Admin is never read-only.
 * Players of inactive or expired academies get Read-Only access.
 */
export function checkReadOnlyAccess(user, subscriptionInfo) {
    if (!user) return { isReadOnly: true, reason: "Unauthenticated" };
    if (user.isSuperAdmin || user.role === ROLES.SUPER_ADMIN) {
        return { isReadOnly: false, reason: null };
    }

    if (!subscriptionInfo) {
        return { isReadOnly: true, reason: "No subscription info available" };
    }

    if (!subscriptionInfo.is_academy_active) {
        return {
            isReadOnly: true,
            reason: "Contact to Academy Administrator",
            detail: "Your academy is currently inactive. Contact to Academy Administrator.",
        };
    }

    if (!subscriptionInfo.is_subscription_active) {
        return {
            isReadOnly: true,
            reason: "Contact to Academy Administrator",
            detail: "Your academy subscription has expired. Contact to Academy Administrator.",
        };
    }

    return { isReadOnly: false, reason: null };
}

/**
 * Centralized API-level authorization and subscription validator.
 * Enforces rules for Super Admin, Academy Admin, Branch Admin, Staff, and Players.
 * 
 * Rules:
 * 1. Super Admin: Always allowed, never read-only.
 * 2. If Academy is manually deactivated or subscription expired past grace:
 *    - Academy Admin, Branch Admin, Staff, Coach, Accountant: BLOCKED (403 Forbidden).
 *    - Player: Allowed in READ-ONLY mode.
 *      - GET/HEAD requests: Allowed.
 *      - POST/PUT/PATCH/DELETE requests: BLOCKED (403 Forbidden with exact message "Contact to Academy Administrator").
 * 3. During 5-day grace period:
 *    - All users allowed.
 *    - Returned metadata indicates `is_grace_period: true, show_subscription_alert: true`.
 * 
 * @param {Request} request 
 * @param {Object} user Authenticated user object
 * @returns {Promise<{ allowed: boolean, isReadOnly: boolean, subscription: Object, errorResponse: NextResponse|null }>}
 */
export async function validateAcademyAccess(request, user) {
    if (!user) {
        return {
            allowed: false,
            isReadOnly: true,
            subscription: null,
            errorResponse: NextResponse.json(
                { success: false, message: "Unauthorized: Please log in." },
                { status: 401 }
            ),
        };
    }

    // Super Admin is never restricted by academy subscription
    if (user.isSuperAdmin || user.role === ROLES.SUPER_ADMIN) {
        return {
            allowed: true,
            isReadOnly: false,
            subscription: {
                is_subscription_active: true,
                is_academy_active: true,
                is_grace_period: false,
                is_read_only: false,
                isSuperAdmin: true,
            },
            errorResponse: null,
        };
    }

    const academyId = user.academy_id ? Number(user.academy_id) : null;
    if (!academyId) {
        return {
            allowed: false,
            isReadOnly: true,
            subscription: null,
            errorResponse: NextResponse.json(
                { success: false, message: "Forbidden: No academy associated with this user." },
                { status: 403 }
            ),
        };
    }

    const sub = await getAcademySubscription(academyId);
    const isPlayer =
        user.isPlayer ||
        user.role === ROLES.PLAYER ||
        user.user_type === "7" ||
        String(user.user_type || "").toLowerCase().includes("player");

    // Case 1: Academy is manually deactivated (cst_academy.status !== 1)
    if (!sub.is_academy_active) {
        if (isPlayer) {
            // Player allowed in read-only mode
            const method = (request?.method || "GET").toUpperCase();
            if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
                return {
                    allowed: false,
                    isReadOnly: true,
                    subscription: sub,
                    errorResponse: NextResponse.json(
                        {
                            success: false,
                            message: "Contact to Academy Administrator",
                            code: "ACADEMY_INACTIVE_READ_ONLY",
                        },
                        { status: 403 }
                    ),
                };
            }
            return {
                allowed: true,
                isReadOnly: true,
                subscription: sub,
                errorResponse: null,
            };
        } else {
            // Academy Admin, Branch Admin, Staff blocked
            return {
                allowed: false,
                isReadOnly: true,
                subscription: sub,
                errorResponse: NextResponse.json(
                    {
                        success: false,
                        message: "Your academy is currently inactive. Please contact the system administrator.",
                        code: "ACADEMY_INACTIVE",
                    },
                    { status: 403 }
                ),
            };
        }
    }

    // Case 2: Subscription is NOT active (expired past grace period, suspended, or cancelled)
    if (!sub.is_subscription_active) {
        if (isPlayer) {
            // Player allowed in read-only mode
            const method = (request?.method || "GET").toUpperCase();
            if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
                return {
                    allowed: false,
                    isReadOnly: true,
                    subscription: sub,
                    errorResponse: NextResponse.json(
                        {
                            success: false,
                            message: "Contact to Academy Administrator",
                            code: "SUBSCRIPTION_EXPIRED_READ_ONLY",
                        },
                        { status: 403 }
                    ),
                };
            }
            return {
                allowed: true,
                isReadOnly: true,
                subscription: sub,
                errorResponse: null,
            };
        } else {
            // Non-players blocked
            const msg =
                sub.subscription_status === "suspended"
                    ? "Your academy subscription is suspended. Please contact the system administrator."
                    : sub.subscription_status === "cancelled"
                    ? "Your academy subscription has been cancelled. Please contact the system administrator."
                    : "Your academy subscription has expired. Please contact the system administrator to renew.";

            return {
                allowed: false,
                isReadOnly: true,
                subscription: sub,
                errorResponse: NextResponse.json(
                    {
                        success: false,
                        message: msg,
                        code: "SUBSCRIPTION_RESTRICTED",
                        subscription_status: sub.subscription_status,
                    },
                    { status: 403 }
                ),
            };
        }
    }

    // Case 3: Subscription is active OR in grace period
    return {
        allowed: true,
        isReadOnly: false,
        subscription: sub,
        errorResponse: null,
    };
}

/**
 * Record an audit entry in cst_subscription_history
 */
export async function recordSubscriptionHistory({
    connection,
    academyId,
    subscriptionId = null,
    eventType,
    planId = null,
    previousValues = null,
    newValues = null,
    changedBy = null,
    remarks = null,
}) {
    const conn = connection || pool;
    try {
        await conn.query(
            `INSERT INTO cst_subscription_history 
             (academy_id, subscription_id, event_type, plan_id, previous_values, new_values, changed_by, remarks, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                academyId,
                subscriptionId,
                eventType,
                planId,
                previousValues ? JSON.stringify(previousValues) : null,
                newValues ? JSON.stringify(newValues) : null,
                changedBy,
                remarks,
            ]
        );
    } catch (err) {
        console.error("Failed to record subscription history:", err);
    }
}

/**
 * Subscription Renewal Workflow with Full Database Transaction.
 * 
 * Logic:
 * - If renewed during active or grace period:
 *   Next cycle starts from (previous subscription_end_date + 1 day).
 * - If renewed after expiry:
 *   Next cycle starts from current date (or specified forceStartDate).
 * 
 * @param {Object} params
 * @param {number} params.academyId
 * @param {number} params.planId
 * @param {string} params.paymentMode 'online' | 'cash' | 'bank_transfer' | 'cheque' | 'manual'
 * @param {string} [params.transactionId]
 * @param {number} [params.amount]
 * @param {string} [params.remarks]
 * @param {number} [params.createdBy] Super Admin user ID
 * @param {string} [params.forceStartDate] Optional custom start date
 * @param {number} [params.gracePeriodDays] Default 5
 */
export async function renewSubscription({
    academyId,
    planId,
    paymentMode = "manual",
    transactionId = null,
    amount = null,
    remarks = "Subscription renewed",
    createdBy = null,
    forceStartDate = null,
    gracePeriodDays = 5,
}) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Fetch Plan
        const [plans] = await conn.query(
            "SELECT * FROM cst_subscription_plans WHERE id = ? AND is_deleted = 0 LIMIT 1",
            [planId]
        );
        if (!plans || plans.length === 0) {
            throw new Error("Invalid or inactive subscription plan selected");
        }
        const plan = plans[0];
        const durationMonths = Number(plan.duration_months || 1);
        const planPrice = amount !== null && amount !== undefined ? Number(amount) : Number(plan.price || 0);

        // 2. Fetch Latest Subscription
        const [currentSubs] = await conn.query(
            `SELECT * FROM cst_academy_subscriptions
             WHERE academy_id = ?
             ORDER BY id DESC LIMIT 1`,
            [academyId]
        );

        const currentSub = currentSubs.length > 0 ? currentSubs[0] : null;
        const todayStr = formatDateToYMD(new Date());

        let newStartDate;
        if (forceStartDate) {
            newStartDate = formatDateToYMD(forceStartDate);
        } else if (currentSub && currentSub.subscription_end_date) {
            const curEndDateStr = formatDateToYMD(currentSub.subscription_end_date);
            const curGraceEndStr = currentSub.grace_end_date
                ? formatDateToYMD(currentSub.grace_end_date)
                : addDays(curEndDateStr, currentSub.grace_period_days || 5);

            // If active or within grace period: next cycle start = previous subscription_end_date + 1 day
            if (todayStr <= curGraceEndStr) {
                newStartDate = addDays(curEndDateStr, 1);
            } else {
                // Expired past grace period: starts from today
                newStartDate = todayStr;
            }
        } else {
            newStartDate = todayStr;
        }

        // Calculate end date and grace end date
        const newEndDate = addMonths(newStartDate, durationMonths);
        const newGraceEndDate = addDays(newEndDate, gracePeriodDays);
        const finalTxnId = transactionId || generateTransactionId();
        const invoiceNo = generateInvoiceNumber(academyId);

        // 3. Insert New Subscription Record
        const [subResult] = await conn.query(
            `INSERT INTO cst_academy_subscriptions 
             (academy_id, plan_id, subscription_start_date, subscription_end_date, grace_period_days, grace_end_date, subscription_status, payment_status, is_manual, remarks, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'active', 'success', ?, ?, ?, NOW(), NOW())`,
            [
                academyId,
                planId,
                newStartDate,
                newEndDate,
                gracePeriodDays,
                newGraceEndDate,
                paymentMode === "manual" ? 1 : 0,
                remarks,
                createdBy,
            ]
        );
        const newSubscriptionId = subResult.insertId;

        // 4. Insert Payment Record
        const [payResult] = await conn.query(
            `INSERT INTO cst_subscription_payments
             (academy_id, subscription_id, transaction_id, invoice_number, amount, payment_mode, payment_date, payment_status, remarks, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), 'success', ?, NOW(), NOW())`,
            [
                academyId,
                newSubscriptionId,
                finalTxnId,
                invoiceNo,
                planPrice,
                paymentMode,
                `Renewal payment for ${plan.plan_name}`,
            ]
        );

        // 5. Audit History Record
        await recordSubscriptionHistory({
            connection: conn,
            academyId,
            subscriptionId: newSubscriptionId,
            eventType: currentSub ? "renewal" : "initial_assignment",
            planId,
            previousValues: currentSub
                ? {
                      id: currentSub.id,
                      plan_id: currentSub.plan_id,
                      subscription_start_date: formatDateToYMD(currentSub.subscription_start_date),
                      subscription_end_date: formatDateToYMD(currentSub.subscription_end_date),
                      subscription_status: currentSub.subscription_status,
                  }
                : null,
            newValues: {
                id: newSubscriptionId,
                plan_id: planId,
                plan_name: plan.plan_name,
                subscription_start_date: newStartDate,
                subscription_end_date: newEndDate,
                grace_end_date: newGraceEndDate,
                subscription_status: "active",
                amount: planPrice,
                invoice_number: invoiceNo,
            },
            changedBy: createdBy,
            remarks: `Renewed with plan ${plan.plan_name} (${durationMonths} month(s))`,
        });

        // 6. Ensure Academy status is active
        await conn.query("UPDATE cst_academy SET status = 1, updated_at = NOW() WHERE id = ?", [academyId]);

        await conn.commit();

        return {
            success: true,
            subscription_id: newSubscriptionId,
            payment_id: payResult.insertId,
            invoice_number: invoiceNo,
            transaction_id: finalTxnId,
            start_date: newStartDate,
            end_date: newEndDate,
            grace_end_date: newGraceEndDate,
            plan_name: plan.plan_name,
            amount: planPrice,
        };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}
