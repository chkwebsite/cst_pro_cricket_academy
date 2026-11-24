import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";

const VALID_MODES = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque"];

/**
 * GET /api/umpire-payments
 * Returns:
 * 1. duties: List of match & ground assignments with total fee, paid, balance due, and payment status.
 * 2. payments: Individual payment transaction records from cst_umpire_payments.
 * 3. stats: Aggregated totals (totalDue, totalPaid, totalOutstanding).
 */
export async function GET(request) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    let connection;

    try {
        connection = await pool.getConnection();
        const { searchParams } = new URL(request.url);

        const academyIdParam = searchParams.get("academy_id");
        const branchIdParam = searchParams.get("branch_id");
        const umpireIdParam = searchParams.get("umpire_id");
        const statusParam = searchParams.get("status"); // 'Paid', 'Partial', 'Pending'
        const searchParam = searchParams.get("search");
        const dateFromParam = searchParams.get("date_from");
        const dateToParam = searchParams.get("date_to");

        // Determine tenant scope
        let targetAcademyId = null;
        let targetBranchId = null;

        if (authUser.isSuperAdmin) {
            targetAcademyId = academyIdParam ? Number(academyIdParam) : null;
            targetBranchId = branchIdParam ? Number(branchIdParam) : null;
        } else if (authUser.isAcademyAdmin) {
            targetAcademyId = Number(authUser.academy_id);
            targetBranchId = branchIdParam ? Number(branchIdParam) : null;
        } else if (authUser.isBranchAdmin) {
            targetAcademyId = Number(authUser.academy_id);
            targetBranchId = Number(authUser.branch_id);
        } else {
            targetAcademyId = Number(authUser.academy_id || 0);
            targetBranchId = authUser.branch_id ? Number(authUser.branch_id) : null;
        }

        // 1. Fetch Umpire Match Assignments
        let matchWhere = " WHERE (mu.umpire_id IS NOT NULL OR gb.umpire_id IS NOT NULL) ";
        const matchParams = [];

        if (targetAcademyId) {
            matchWhere += " AND m.academy_id = ? ";
            matchParams.push(targetAcademyId);
        }
        if (targetBranchId) {
            matchWhere += " AND m.branch_id = ? ";
            matchParams.push(targetBranchId);
        }
        if (umpireIdParam) {
            matchWhere += " AND (mu.umpire_id = ? OR gb.umpire_id = ?) ";
            matchParams.push(Number(umpireIdParam), Number(umpireIdParam));
        }
        if (dateFromParam) {
            matchWhere += " AND m.match_date >= ? ";
            matchParams.push(dateFromParam);
        }
        if (dateToParam) {
            matchWhere += " AND m.match_date <= ? ";
            matchParams.push(dateToParam);
        }

        const [matchRows] = await connection.query(
            `SELECT
                m.id AS match_id,
                m.booking_id,
                m.match_no,
                m.match_type,
                m.match_date,
                m.match_time,
                m.academy_id,
                m.branch_id,
                a.academy_name,
                b.branch_name,
                g.ground_name,
                COALESCE(u_mu.id, u_gb.id) AS umpire_id,
                COALESCE(u_mu.umpire_name, u_gb.umpire_name) AS umpire_name,
                COALESCE(u_mu.mobile, u_gb.mobile) AS umpire_mobile,
                COALESCE(mu.umpire_role, 'Official Umpire') AS umpire_role,
                COALESCE(mu.fee_amount, uf.fee_amount, 0) AS fee_amount,
                COALESCE(mu.payment_status, 'Pending') AS base_payment_status,
                mu.id AS match_umpire_id
             FROM cst_matches m
             LEFT JOIN cst_academy a ON a.id = m.academy_id
             LEFT JOIN cst_branch b ON b.id = m.branch_id
             LEFT JOIN cst_ground g ON g.id = m.ground_id
             LEFT JOIN cst_match_umpires mu ON mu.match_id = m.id
             LEFT JOIN cst_umpires u_mu ON u_mu.id = mu.umpire_id
             LEFT JOIN cst_ground_bookings gb ON gb.id = m.booking_id
             LEFT JOIN cst_umpires u_gb ON u_gb.id = gb.umpire_id
             LEFT JOIN cst_umpire_fees uf ON uf.id = gb.umpire_fee_id
             ${matchWhere}
             ORDER BY m.match_date DESC, m.id DESC`,
            matchParams
        );

        // 2. Fetch Standalone Ground Bookings where umpire was assigned (not linked to match)
        let bookingWhere = " WHERE gb.umpire_id IS NOT NULL ";
        const bookingParams = [];

        if (targetAcademyId) {
            bookingWhere += " AND g.academy_id = ? ";
            bookingParams.push(targetAcademyId);
        }
        if (targetBranchId) {
            bookingWhere += " AND g.branch_id = ? ";
            bookingParams.push(targetBranchId);
        }
        if (umpireIdParam) {
            bookingWhere += " AND gb.umpire_id = ? ";
            bookingParams.push(Number(umpireIdParam));
        }
        if (dateFromParam) {
            bookingWhere += " AND gb.booking_date >= ? ";
            bookingParams.push(dateFromParam);
        }
        if (dateToParam) {
            bookingWhere += " AND gb.booking_date <= ? ";
            bookingParams.push(dateToParam);
        }

        const [bookingRows] = await connection.query(
            `SELECT
                gb.id AS booking_id,
                gb.match_id,
                gb.booking_no,
                gb.booking_date,
                g.academy_id,
                g.branch_id,
                a.academy_name,
                b.branch_name,
                g.ground_name,
                u.id AS umpire_id,
                u.umpire_name,
                u.mobile AS umpire_mobile,
                'Ground Official' AS umpire_role,
                COALESCE(uf.fee_amount, 0) AS fee_amount,
                uf.match_type,
                gb.booking_status
             FROM cst_ground_bookings gb
             INNER JOIN cst_ground g ON g.id = gb.ground_id
             LEFT JOIN cst_academy a ON a.id = g.academy_id
             LEFT JOIN cst_branch b ON b.id = g.branch_id
             LEFT JOIN cst_umpires u ON u.id = gb.umpire_id
             LEFT JOIN cst_umpire_fees uf ON uf.id = gb.umpire_fee_id
             ${bookingWhere}
             ORDER BY gb.booking_date DESC, gb.id DESC`,
            bookingParams
        );

        // 3. Fetch All Payment Transactions from cst_umpire_payments
        let payWhere = " WHERE 1=1 ";
        const payParams = [];
        if (targetAcademyId) {
            payWhere += " AND up.academy_id = ? ";
            payParams.push(targetAcademyId);
        }
        if (targetBranchId) {
            payWhere += " AND up.branch_id = ? ";
            payParams.push(targetBranchId);
        }
        if (umpireIdParam) {
            payWhere += " AND up.umpire_id = ? ";
            payParams.push(Number(umpireIdParam));
        }

        const [paymentList] = await connection.query(
            `SELECT
                up.id,
                up.academy_id,
                up.branch_id,
                up.umpire_id,
                up.match_id,
                up.booking_id,
                up.payment_date,
                up.amount,
                up.payment_mode,
                up.transaction_no,
                up.remarks,
                up.payment_status,
                up.created_at,
                u.umpire_name,
                u.mobile AS umpire_mobile,
                m.match_no,
                gb.booking_no
             FROM cst_umpire_payments up
             INNER JOIN cst_umpires u ON u.id = up.umpire_id
             LEFT JOIN cst_matches m ON m.id = up.match_id
             LEFT JOIN cst_ground_bookings gb ON gb.id = up.booking_id
             ${payWhere}
             ORDER BY up.payment_date DESC, up.id DESC`,
            payParams
        );

        // 4. Combine Duties (Deduplicate match vs booking)
        const combinedDuties = [];

        // Add matches
        matchRows.forEach((m) => {
            const fee = Number(m.fee_amount || 0);

            // Find all payments for this match or its linked booking
            const relatedPayments = paymentList.filter(
                (p) =>
                    (p.match_id && Number(p.match_id) === Number(m.match_id)) ||
                    (m.booking_id && p.booking_id && Number(p.booking_id) === Number(m.booking_id))
            );

            const totalPaid = relatedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
            const balanceDue = Math.max(fee - totalPaid, 0);

            let status = "Pending";
            if (totalPaid >= fee && fee > 0) {
                status = "Paid";
            } else if (totalPaid > 0) {
                status = "Partial";
            }

            combinedDuties.push({
                duty_key: `match-${m.match_id}`,
                duty_type: "Match",
                match_id: m.match_id,
                booking_id: m.booking_id,
                match_no: m.match_no,
                booking_no: m.booking_id ? `Booking #${m.booking_id}` : null,
                match_type: m.match_type,
                date: m.match_date,
                time: m.match_time,
                academy_id: m.academy_id,
                branch_id: m.branch_id,
                academy_name: m.academy_name,
                branch_name: m.branch_name,
                ground_name: m.ground_name,
                umpire_id: m.umpire_id,
                umpire_name: m.umpire_name,
                umpire_mobile: m.umpire_mobile,
                umpire_role: m.umpire_role,
                fee_amount: fee,
                paid_amount: totalPaid,
                balance_amount: balanceDue,
                payment_status: status,
                last_payment_date: relatedPayments.length > 0 ? relatedPayments[0].payment_date : null,
                last_payment_mode: relatedPayments.length > 0 ? relatedPayments[0].payment_mode : null,
                payment_count: relatedPayments.length,
            });
        });

        // Add standalone bookings that are NOT already in matchRows
        bookingRows.forEach((b) => {
            const matchExists = matchRows.some(
                (m) =>
                    (m.booking_id && Number(m.booking_id) === Number(b.booking_id)) ||
                    (b.match_id && Number(m.match_id) === Number(b.match_id))
            );

            if (!matchExists) {
                const fee = Number(b.fee_amount || 0);
                const relatedPayments = paymentList.filter(
                    (p) => p.booking_id && Number(p.booking_id) === Number(b.booking_id)
                );

                const totalPaid = relatedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
                const balanceDue = Math.max(fee - totalPaid, 0);

                let status = "Pending";
                if (totalPaid >= fee && fee > 0) {
                    status = "Paid";
                } else if (totalPaid > 0) {
                    status = "Partial";
                }

                combinedDuties.push({
                    duty_key: `booking-${b.booking_id}`,
                    duty_type: "Ground Booking",
                    match_id: null,
                    booking_id: b.booking_id,
                    match_no: null,
                    booking_no: b.booking_no,
                    match_type: b.match_type || "Ground Booking",
                    date: b.booking_date,
                    time: null,
                    academy_id: b.academy_id,
                    branch_id: b.branch_id,
                    academy_name: b.academy_name,
                    branch_name: b.branch_name,
                    ground_name: b.ground_name,
                    umpire_id: b.umpire_id,
                    umpire_name: b.umpire_name,
                    umpire_mobile: b.umpire_mobile,
                    umpire_role: "Ground Official",
                    fee_amount: fee,
                    paid_amount: totalPaid,
                    balance_amount: balanceDue,
                    payment_status: status,
                    last_payment_date: relatedPayments.length > 0 ? relatedPayments[0].payment_date : null,
                    last_payment_mode: relatedPayments.length > 0 ? relatedPayments[0].payment_mode : null,
                    payment_count: relatedPayments.length,
                });
            }
        });

        // 5. Apply Status and Search Filters on Duties
        let filteredDuties = combinedDuties;

        if (statusParam && statusParam !== "All") {
            filteredDuties = filteredDuties.filter(
                (d) => d.payment_status.toLowerCase() === statusParam.toLowerCase()
            );
        }

        if (searchParam && searchParam.trim()) {
            const q = searchParam.trim().toLowerCase();
            filteredDuties = filteredDuties.filter(
                (d) =>
                    (d.umpire_name && d.umpire_name.toLowerCase().includes(q)) ||
                    (d.umpire_mobile && d.umpire_mobile.includes(q)) ||
                    (d.match_no && d.match_no.toLowerCase().includes(q)) ||
                    (d.booking_no && d.booking_no.toLowerCase().includes(q)) ||
                    (d.ground_name && d.ground_name.toLowerCase().includes(q))
            );
        }

        // 6. Calculate Stats
        const totalFeesDue = combinedDuties.reduce((sum, d) => sum + Number(d.fee_amount || 0), 0);
        const totalFeesPaid = combinedDuties.reduce((sum, d) => sum + Number(d.paid_amount || 0), 0);
        const totalOutstanding = Math.max(totalFeesDue - totalFeesPaid, 0);

        return NextResponse.json({
            success: true,
            data: {
                duties: filteredDuties,
                payments: paymentList,
                stats: {
                    totalDuties: combinedDuties.length,
                    totalFeesDue,
                    totalFeesPaid,
                    totalOutstanding,
                    pendingCount: combinedDuties.filter((d) => d.payment_status === "Pending").length,
                    partialCount: combinedDuties.filter((d) => d.payment_status === "Partial").length,
                    paidCount: combinedDuties.filter((d) => d.payment_status === "Paid").length,
                },
            },
        });
    } catch (error) {
        console.error("GET /api/umpire-payments error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Failed to load umpire payments." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

/**
 * POST /api/umpire-payments
 * Records an umpire fee payment transaction.
 */
export async function POST(request) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    let connection;

    try {
        const body = await request.json();
        const {
            umpire_id,
            match_id,
            booking_id,
            amount,
            payment_date,
            payment_mode = "Cash",
            transaction_no,
            remarks,
        } = body;

        // Validation
        const errors = {};
        if (!umpire_id) {
            errors.umpire_id = "Please select an umpire.";
        }

        const payAmount = Number(amount);
        if (amount === undefined || amount === null || amount === "") {
            errors.amount = "Payment amount is required.";
        } else if (!Number.isFinite(payAmount) || payAmount <= 0) {
            errors.amount = "Valid payment amount greater than zero is required.";
        }

        if (!payment_date) {
            errors.payment_date = "Payment date is required.";
        }

        if (payment_mode && !VALID_MODES.includes(payment_mode)) {
            errors.payment_mode = `Invalid payment mode. Supported modes: ${VALID_MODES.join(", ")}`;
        }

        if (Object.keys(errors).length > 0) {
            return NextResponse.json(
                { success: false, message: Object.values(errors)[0], errors },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        // Verify Umpire
        const [uRows] = await connection.query(
            "SELECT id, academy_id, branch_id, umpire_name FROM cst_umpires WHERE id = ? AND is_deleted = 0 LIMIT 1",
            [umpire_id]
        );

        if (uRows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Selected umpire does not exist.", errors: { umpire_id: "Selected umpire does not exist." } },
                { status: 404 }
            );
        }

        const umpire = uRows[0];
        const academyId = body.academy_id || umpire.academy_id || authUser.academy_id;
        const branchId = body.branch_id || umpire.branch_id || authUser.branch_id || null;

        // Start DB Transaction
        await connection.beginTransaction();

        // 1. Insert into cst_umpire_payments
        const [payResult] = await connection.query(
            `INSERT INTO cst_umpire_payments (
                academy_id,
                branch_id,
                umpire_id,
                match_id,
                booking_id,
                payment_date,
                amount,
                payment_mode,
                transaction_no,
                remarks,
                payment_status,
                paid_by_user_id
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Paid', ?)`,
            [
                academyId,
                branchId,
                umpire_id,
                match_id ? Number(match_id) : null,
                booking_id ? Number(booking_id) : null,
                payment_date,
                payAmount,
                payment_mode,
                transaction_no ? String(transaction_no).trim() : null,
                remarks ? String(remarks).trim() : null,
                authUser.id,
            ]
        );

        const newPaymentId = payResult.insertId;

        // 2. Compute updated total paid for this duty and update match_umpires
        if (match_id) {
            const [feeRows] = await connection.query(
                `SELECT
                    COALESCE(mu.fee_amount, uf.fee_amount, 0) AS fee_amount,
                    mu.id AS match_umpire_id
                 FROM cst_matches m
                 LEFT JOIN cst_match_umpires mu ON mu.match_id = m.id AND mu.umpire_id = ?
                 LEFT JOIN cst_ground_bookings gb ON gb.id = m.booking_id AND gb.umpire_id = ?
                 LEFT JOIN cst_umpire_fees uf ON uf.id = gb.umpire_fee_id
                 WHERE m.id = ? LIMIT 1`,
                [umpire_id, umpire_id, match_id]
            );

            const fee = feeRows.length > 0 ? Number(feeRows[0].fee_amount || 0) : 0;
            const matchUmpireId = feeRows.length > 0 ? feeRows[0].match_umpire_id : null;

            // Calculate total paid across all payments for this match
            const [sumRows] = await connection.query(
                `SELECT SUM(amount) AS total_paid
                 FROM cst_umpire_payments
                 WHERE umpire_id = ? AND (match_id = ? OR (booking_id IS NOT NULL AND booking_id = ?))`,
                [umpire_id, match_id, booking_id || 0]
            );

            const totalPaid = Number(sumRows[0]?.total_paid || 0);
            const newStatus = totalPaid >= fee && fee > 0 ? "Paid" : totalPaid > 0 ? "Partial" : "Pending";

            if (matchUmpireId) {
                await connection.query(
                    `UPDATE cst_match_umpires
                     SET payment_status = ?,
                         remarks = COALESCE(?, remarks)
                     WHERE id = ?`,
                    [newStatus, remarks || null, matchUmpireId]
                );
            } else {
                // Check if a record already exists for this match and umpire
                const [existingRoles] = await connection.query(
                    `SELECT id, umpire_id, umpire_role FROM cst_match_umpires WHERE match_id = ?`,
                    [match_id]
                );

                const existingForUmpire = existingRoles.find((r) => Number(r.umpire_id) === Number(umpire_id));
                if (existingForUmpire) {
                    await connection.query(
                        `UPDATE cst_match_umpires
                         SET payment_status = ?,
                             remarks = COALESCE(?, remarks)
                         WHERE id = ?`,
                        [newStatus, remarks || null, existingForUmpire.id]
                    );
                } else {
                    const takenRoles = new Set(existingRoles.map((r) => r.umpire_role));
                    const candidateRoles = [
                        body.umpire_role,
                        "Official Umpire",
                        "On Field Umpire 1",
                        "On Field Umpire 2",
                        "Third Umpire",
                        "Fourth Umpire",
                        "Ground Official",
                    ].filter(Boolean);

                    const roleToUse = candidateRoles.find((role) => !takenRoles.has(role)) || "Official Umpire";

                    await connection.query(
                        `INSERT INTO cst_match_umpires (
                            academy_id, branch_id, match_id, umpire_id, umpire_role, fee_amount, payment_status, remarks
                         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE payment_status = VALUES(payment_status), fee_amount = VALUES(fee_amount)`,
                        [
                            academyId,
                            branchId || 1,
                            match_id,
                            umpire_id,
                            roleToUse,
                            fee,
                            newStatus,
                            remarks || `Paid via ${payment_mode}`,
                        ]
                    );
                }
            }
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: `Payment of ₹${payAmount.toLocaleString("en-IN")} recorded successfully for umpire ${umpire.umpire_name}.`,
            data: {
                payment_id: newPaymentId,
                amount: payAmount,
                payment_date,
                payment_mode,
            },
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("POST /api/umpire-payments error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Failed to record umpire payment." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
