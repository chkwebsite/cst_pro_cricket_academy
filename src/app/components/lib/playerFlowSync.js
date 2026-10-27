import pool from "./db.js";
import crypto from "crypto";

/**
 * Generate a unique receipt number for payments.
 */
export function generateReceiptNo() {
    const timestamp = Date.now();
    const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
    return `CST-${timestamp}-${randomHex}`;
}

/**
 * Format a Date object or date string as YYYY-MM-DD.
 */
export function formatDate(date) {
    if (!date) return new Date().toISOString().slice(0, 10);
    if (typeof date === "string") {
        if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
            return date.slice(0, 10);
        }
    }
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) {
        return new Date().toISOString().slice(0, 10);
    }
    return d.toISOString().slice(0, 10);
}

/**
 * Format a Date or date string to the first day of that month: YYYY-MM-01.
 */
export function formatMonthStart(date) {
    const ymd = formatDate(date);
    return `${ymd.slice(0, 7)}-01`;
}

/**
 * Sync when a User Program is inserted (e.g. via /api/user-programs or /api/admission-players).
 *
 * Automatically:
 * 1. Creates/ensures a monthly fee invoice in cst_player_program_fees (based on program fee rates).
 * 2. If initial payment is provided (> 0), creates a payment in cst_player_payments and updates fee status.
 * 3. Creates/ensures an attendance record in cst_player_attendance for the player on enrollment start date.
 */
export async function syncOnUserProgramInsert({
    connection: passedConn,
    userProgramId,
    admissionPlayersId,
    programId,
    branchId,
    userId = null,
    startDate = null,
    endDate = null,
    status = 1,
    initialPayment = null,
}) {
    let conn = passedConn;
    const shouldRelease = !passedConn;

    try {
        if (!conn) {
            conn = await pool.getConnection();
        }

        // Fetch user program details if missing
        if (!programId || !branchId || !admissionPlayersId) {
            const [upRows] = await conn.query(
                `SELECT * FROM cst_user_programs WHERE id = ? LIMIT 1`,
                [userProgramId]
            );
            if (upRows.length > 0) {
                const up = upRows[0];
                programId = programId || up.program_id;
                branchId = branchId || up.branch_id;
                admissionPlayersId = admissionPlayersId || up.admission_players_id;
                userId = userId || up.user_id;
                startDate = startDate || up.start_date;
                endDate = endDate || up.end_date;
                status = status !== undefined ? status : up.status;
            }
        }

        if (!programId || !admissionPlayersId) {
            console.warn("[playerFlowSync] Missing programId or admissionPlayersId for userProgramId:", userProgramId);
            return null;
        }

        // Fetch program details
        const [programs] = await conn.query(
            `SELECT id, academy_id, branch_id, program_name, program_fee, registration_fee, daily_fee, kit_fee
             FROM cst_programs WHERE id = ? LIMIT 1`,
            [programId]
        );

        if (programs.length === 0) {
            console.warn("[playerFlowSync] Program not found:", programId);
            return null;
        }

        const program = programs[0];
        const academyId = program.academy_id;
        const targetBranchId = branchId || program.branch_id;

        // 1. ================= FEE INVOICE CREATION =================
        const feeMonth = formatMonthStart(startDate || new Date());
        const feeAmount = Number(program.program_fee || 0);
        const registrationFee = Number(program.registration_fee || 0);
        const dailyFee = Number(program.daily_fee || 0);
        const kitFee = Number(program.kit_fee || 0);
        const discountAmount = Number(initialPayment?.discount_amount || 0);
        const lateFee = Number(initialPayment?.late_fee || 0);

        const subtotal = feeAmount + registrationFee + dailyFee + kitFee;
        const totalAmount = Math.max(0, Number((subtotal - discountAmount + lateFee).toFixed(2)));

        const initialPaid = Number(initialPayment?.paid_amount || 0);
        const paidAmount = Number(Math.min(totalAmount, Math.max(0, initialPaid)).toFixed(2));
        const dueAmount = Number(Math.max(0, totalAmount - paidAmount).toFixed(2));

        let paymentStatus = "Pending";
        if (totalAmount === 0 || dueAmount === 0) {
            paymentStatus = "Paid";
        } else if (paidAmount > 0) {
            paymentStatus = "Partial";
        }

        const dueDate = initialPayment?.due_date || formatDate(startDate || new Date());
        const feeRemarks = initialPayment?.remarks || "Auto-generated on player program enrollment";

        // Check if fee invoice already exists
        const [existingFees] = await conn.query(
            `SELECT id, paid_amount, total_amount, payment_status
             FROM cst_player_program_fees
             WHERE user_program_id = ? AND fee_month = ?
             LIMIT 1`,
            [userProgramId, feeMonth]
        );

        let feeId;
        if (existingFees.length === 0) {
            const [feeResult] = await conn.query(
                `INSERT INTO cst_player_program_fees (
                    academy_id, branch_id, user_program_id, admission_players_id, program_id,
                    fee_month, fee_amount, registration_fee, daily_fee, kit_fee,
                    discount_amount, late_fee, total_amount, paid_amount, due_amount,
                    payment_status, due_date, remarks
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    academyId,
                    targetBranchId,
                    userProgramId,
                    admissionPlayersId,
                    programId,
                    feeMonth,
                    feeAmount,
                    registrationFee,
                    dailyFee,
                    kitFee,
                    discountAmount,
                    lateFee,
                    totalAmount,
                    paidAmount,
                    dueAmount,
                    paymentStatus,
                    dueDate,
                    feeRemarks,
                ]
            );
            feeId = feeResult.insertId;
        } else {
            feeId = existingFees[0].id;
            // If existing fee has no payments, update with latest rates
            if (Number(existingFees[0].paid_amount) === 0) {
                await conn.query(
                    `UPDATE cst_player_program_fees
                     SET academy_id = ?, branch_id = ?, program_id = ?, admission_players_id = ?,
                         fee_amount = ?, registration_fee = ?, daily_fee = ?, kit_fee = ?,
                         total_amount = ?, paid_amount = ?, due_amount = ?, payment_status = ?,
                         due_date = ?, remarks = ?
                     WHERE id = ?`,
                    [
                        academyId,
                        targetBranchId,
                        programId,
                        admissionPlayersId,
                        feeAmount,
                        registrationFee,
                        dailyFee,
                        kitFee,
                        totalAmount,
                        paidAmount,
                        dueAmount,
                        paymentStatus,
                        dueDate,
                        feeRemarks,
                        feeId,
                    ]
                );
            }
        }

        // 2. ================= INITIAL PAYMENT CREATION =================
        let paymentRecord = null;
        if (paidAmount > 0) {
            const receiptNo = initialPayment?.receipt_no || generateReceiptNo();
            const paymentMode = initialPayment?.payment_mode || "Cash";
            const transactionNo = initialPayment?.transaction_no || null;
            const paymentDate = initialPayment?.payment_date || new Date().toISOString().slice(0, 19).replace("T", " ");
            const receivedBy = initialPayment?.received_by || userId || null;
            const paymentRemarks = initialPayment?.payment_remarks || "Initial enrollment fee payment";

            const [payResult] = await conn.query(
                `INSERT INTO cst_player_payments (
                    player_program_fee_id, receipt_no, paid_amount, payment_mode,
                    transaction_no, payment_date, payment_status, remarks, received_by
                ) VALUES (?, ?, ?, ?, ?, ?, 'Success', ?, ?)`,
                [
                    feeId,
                    receiptNo,
                    paidAmount,
                    paymentMode,
                    transactionNo,
                    paymentDate,
                    paymentRemarks,
                    receivedBy,
                ]
            );

            paymentRecord = {
                id: payResult.insertId,
                receipt_no: receiptNo,
                paid_amount: paidAmount,
                payment_mode: paymentMode,
            };
        }

        // 3. ================= ATTENDANCE RECORD CREATION =================
        const attendanceDate = formatDate(startDate || new Date());
        const attendanceStatus = "Present";
        let attendanceRemarks = `Enrolled in ${program.program_name || "Program"}`;
        if (paidAmount > 0) {
            attendanceRemarks += ` | Initial payment ₹${paidAmount} received (${paymentStatus})`;
        }

        // Check if attendance already exists for this player on this date
        const [existingAtt] = await conn.query(
            `SELECT id FROM cst_player_attendance
             WHERE user_program_id = ? AND attendance_date = ?
             LIMIT 1`,
            [userProgramId, attendanceDate]
        );

        let attendanceId;
        if (existingAtt.length === 0) {
            const [attResult] = await conn.query(
                `INSERT INTO cst_player_attendance (
                    academy_id, branch_id, user_program_id, admission_players_id, program_id,
                    attendance_date, attendance_status, remarks, marked_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    academyId,
                    targetBranchId,
                    userProgramId,
                    admissionPlayersId,
                    programId,
                    attendanceDate,
                    attendanceStatus,
                    attendanceRemarks,
                    userId || null,
                ]
            );
            attendanceId = attResult.insertId;
        } else {
            attendanceId = existingAtt[0].id;
            await conn.query(
                `UPDATE cst_player_attendance
                 SET academy_id = ?, branch_id = ?, program_id = ?, admission_players_id = ?,
                     attendance_status = 'Present',
                     remarks = ?
                 WHERE id = ?`,
                [
                    academyId,
                    targetBranchId,
                    programId,
                    admissionPlayersId,
                    attendanceRemarks,
                    attendanceId,
                ]
            );
        }

        // 4. ================= INDIVIDUAL TRAINING AUTO-INSERT =================
        // If program_id is 1 ("One-on-One (1:1)"), auto-insert into cst_individual_training
        let individualTrainingId = null;
        if (Number(programId) === 1) {
            try {
                individualTrainingId = await syncIndividualTrainingOnEnrollment({
                    connection: conn,
                    academyId,
                    branchId: targetBranchId,
                    userProgramId,
                    startDate: startDate || new Date(),
                    endDate,
                    status: Number(status) === 1 ? "Active" : "On Hold",
                    remarks: "Auto-created on 1:1 Individual Training enrollment",
                });
            } catch (itErr) {
                console.error("[playerFlowSync] Individual training sync error:", itErr);
            }
        }

        return {
            feeId,
            paymentRecord,
            attendanceId,
            individualTrainingId,
            feeMonth,
            totalAmount,
            paidAmount,
            dueAmount,
            paymentStatus,
        };
    } catch (err) {
        console.error("[playerFlowSync] syncOnUserProgramInsert error:", err);
        throw err;
    } finally {
        if (shouldRelease && conn) {
            conn.release();
        }
    }
}

/**
 * Sync when a User Program is updated (e.g. via PUT /api/user-programs/[id] or PUT /api/admission-players/[id]).
 *
 * Automatically:
 * 1. Updates linked cst_player_program_fees (academy_id, branch_id, program_id, admission_players_id).
 *    If fee is unpaid ('Pending' & paid_amount = 0), updates rates to match the new program.
 * 2. Updates linked cst_player_attendance (academy_id, branch_id, program_id, admission_players_id).
 * 3. If program status changed to inactive (0), updates pending fee status to 'Cancelled' or updates remarks.
 */
export async function syncOnUserProgramUpdate({
    connection: passedConn,
    userProgramId,
    admissionPlayersId = null,
    programId = null,
    branchId = null,
    userId = null,
    startDate = null,
    endDate = null,
    status = null,
    paymentInfo = null,
}) {
    let conn = passedConn;
    const shouldRelease = !passedConn;

    try {
        if (!conn) {
            conn = await pool.getConnection();
        }

        // Fetch current user program data from DB
        const [upRows] = await conn.query(
            `SELECT * FROM cst_user_programs WHERE id = ? LIMIT 1`,
            [userProgramId]
        );

        if (upRows.length === 0) {
            console.warn("[playerFlowSync] User program not found for update:", userProgramId);
            return null;
        }

        const currentUp = upRows[0];
        const effectiveProgramId = programId || currentUp.program_id;
        const effectiveBranchId = branchId || currentUp.branch_id;
        const effectivePlayerId = admissionPlayersId || currentUp.admission_players_id;
        const effectiveStatus = status !== undefined && status !== null ? Number(status) : currentUp.status;

        // Fetch program details
        const [programs] = await conn.query(
            `SELECT id, academy_id, branch_id, program_name, program_fee, registration_fee, daily_fee, kit_fee
             FROM cst_programs WHERE id = ? LIMIT 1`,
            [effectiveProgramId]
        );

        if (programs.length === 0) {
            console.warn("[playerFlowSync] Program not found:", effectiveProgramId);
            return null;
        }

        const program = programs[0];
        const academyId = program.academy_id;
        const targetBranchId = effectiveBranchId || program.branch_id;

        // 1. UPDATE cst_player_program_fees
        // Always update metadata (academy_id, branch_id, program_id, admission_players_id)
        await conn.query(
            `UPDATE cst_player_program_fees
             SET academy_id = ?, branch_id = ?, program_id = ?, admission_players_id = ?
             WHERE user_program_id = ?`,
            [academyId, targetBranchId, effectiveProgramId, effectivePlayerId, userProgramId]
        );

        // For pending/unpaid invoices, refresh fee amounts based on the new program rates
        const feeAmount = Number(program.program_fee || 0);
        const registrationFee = Number(program.registration_fee || 0);
        const dailyFee = Number(program.daily_fee || 0);
        const kitFee = Number(program.kit_fee || 0);

        const [pendingFees] = await conn.query(
            `SELECT id, discount_amount, late_fee, paid_amount
             FROM cst_player_program_fees
             WHERE user_program_id = ? AND paid_amount = 0 AND payment_status = 'Pending'`,
            [userProgramId]
        );

        for (const pf of pendingFees) {
            const discount = Number(pf.discount_amount || 0);
            const late = Number(pf.late_fee || 0);
            const subtotal = feeAmount + registrationFee + dailyFee + kitFee;
            const newTotal = Math.max(0, Number((subtotal - discount + late).toFixed(2)));

            await conn.query(
                `UPDATE cst_player_program_fees
                 SET fee_amount = ?, registration_fee = ?, daily_fee = ?, kit_fee = ?,
                     total_amount = ?, due_amount = ?
                 WHERE id = ?`,
                [feeAmount, registrationFee, dailyFee, kitFee, newTotal, newTotal, pf.id]
            );
        }

        // If status changed to inactive (0), flag pending invoices
        if (effectiveStatus === 0) {
            await conn.query(
                `UPDATE cst_player_program_fees
                 SET remarks = CONCAT(COALESCE(remarks, ''), ' [Program inactive]')
                 WHERE user_program_id = ? AND payment_status = 'Pending'`,
                [userProgramId]
            );
        }

        // 2. UPDATE cst_player_attendance
        await conn.query(
            `UPDATE cst_player_attendance
             SET academy_id = ?, branch_id = ?, program_id = ?, admission_players_id = ?
             WHERE user_program_id = ?`,
            [academyId, targetBranchId, effectiveProgramId, effectivePlayerId, userProgramId]
        );

        // Ensure at least one attendance record exists for this enrollment
        const [attCount] = await conn.query(
            `SELECT COUNT(*) AS total FROM cst_player_attendance WHERE user_program_id = ?`,
            [userProgramId]
        );

        if (Number(attCount[0]?.total || 0) === 0) {
            const attDate = formatDate(startDate || currentUp.start_date || new Date());
            await conn.query(
                `INSERT INTO cst_player_attendance (
                    academy_id, branch_id, user_program_id, admission_players_id, program_id,
                    attendance_date, attendance_status, remarks, marked_by
                ) VALUES (?, ?, ?, ?, ?, ?, 'Present', ?, ?)`,
                [
                    academyId,
                    targetBranchId,
                    userProgramId,
                    effectivePlayerId,
                    effectiveProgramId,
                    attDate,
                    `Enrolled in ${program.program_name || "Program"}`,
                    userId || null,
                ]
            );
        }

        // 3. Handle optional payment update if passed
        if (paymentInfo && Number(paymentInfo.paid_amount) > 0) {
            // Find latest fee record
            const [latestFees] = await conn.query(
                `SELECT id, total_amount, paid_amount FROM cst_player_program_fees
                 WHERE user_program_id = ? ORDER BY id DESC LIMIT 1`,
                [userProgramId]
            );

            if (latestFees.length > 0) {
                const targetFee = latestFees[0];
                const amt = Number(paymentInfo.paid_amount);
                const receiptNo = paymentInfo.receipt_no || generateReceiptNo();

                await conn.query(
                    `INSERT INTO cst_player_payments (
                        player_program_fee_id, receipt_no, paid_amount, payment_mode,
                        transaction_no, payment_date, payment_status, remarks, received_by
                    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'Success', ?, ?)`,
                    [
                        targetFee.id,
                        receiptNo,
                        amt,
                        paymentInfo.payment_mode || "Cash",
                        paymentInfo.transaction_no || null,
                        paymentInfo.remarks || "Updated enrollment payment",
                        userId || null,
                    ]
                );

                // Recalculate fee & update attendance
                await syncOnPaymentRecorded({
                    connection: conn,
                    playerProgramFeeId: targetFee.id,
                    paidAmount: amt,
                    paymentMode: paymentInfo.payment_mode || "Cash",
                    receiptNo,
                    paymentStatus: "Success",
                });
            }
        }

        // 4. If program is One-on-One (1:1), sync individual training
        if (Number(effectiveProgramId) === 1) {
            try {
                await syncIndividualTrainingOnEnrollment({
                    connection: conn,
                    academyId,
                    branchId: targetBranchId,
                    userProgramId,
                    startDate: startDate || currentUp.start_date || new Date(),
                    endDate: endDate !== undefined ? endDate : currentUp.end_date,
                    status: Number(status) === 1 ? "Active" : "On Hold",
                    remarks: "Auto-synced on 1:1 Individual Training update",
                });
            } catch (itErr) {
                console.error("[playerFlowSync] Individual training sync on update error:", itErr);
            }
        }

        return { success: true };
    } catch (err) {
        console.error("[playerFlowSync] syncOnUserProgramUpdate error:", err);
        throw err;
    } finally {
        if (shouldRelease && conn) {
            conn.release();
        }
    }
}

/**
 * Sync when a player payment is recorded/updated (e.g. via POST /api/player-payments or PUT /api/player-payments/[id]).
 *
 * "aur agar player-payments karta hai tab next_panel/player-attendance aur next_panel/player-program-fees bhi update ho."
 *
 * Automatically:
 * 1. Recalculates cst_player_program_fees (paid_amount, due_amount, payment_status: 'Paid', 'Partial', 'Pending').
 * 2. Updates/creates cst_player_attendance for the payment date:
 *    - Marks player attendance as 'Present'.
 *    - Updates remarks to log payment receipt, amount, and payment status.
 */
export async function syncOnPaymentRecorded({
    connection: passedConn,
    playerProgramFeeId,
    paidAmount = 0,
    paymentDate = null,
    paymentMode = "Cash",
    receiptNo = null,
    paymentStatus = "Success",
    remarks = null,
    receivedBy = null,
}) {
    let conn = passedConn;
    const shouldRelease = !passedConn;

    try {
        if (!conn) {
            conn = await pool.getConnection();
        }

        // 1. ================= RECALCULATE FEE =================
        const [fees] = await conn.query(
            `SELECT id, academy_id, branch_id, user_program_id, admission_players_id, program_id,
                    fee_month, total_amount, payment_status
             FROM cst_player_program_fees
             WHERE id = ? LIMIT 1`,
            [playerProgramFeeId]
        );

        if (fees.length === 0) {
            throw new Error(`Monthly fee record #${playerProgramFeeId} not found.`);
        }

        const fee = fees[0];

        // Sum all successful payments for this fee invoice
        const [payments] = await conn.query(
            `SELECT COALESCE(SUM(paid_amount), 0) AS total_paid
             FROM cst_player_payments
             WHERE player_program_fee_id = ? AND payment_status = 'Success'`,
            [playerProgramFeeId]
        );

        const totalAmount = Number(fee.total_amount);
        const totalPaid = Number(Number(payments[0].total_paid).toFixed(2));
        const dueAmount = Number(Math.max(0, totalAmount - totalPaid).toFixed(2));

        let nextFeeStatus = fee.payment_status;
        if (nextFeeStatus !== "Cancelled") {
            if (dueAmount === 0 || totalPaid >= totalAmount) {
                nextFeeStatus = "Paid";
            } else if (totalPaid > 0) {
                nextFeeStatus = "Partial";
            } else {
                nextFeeStatus = "Pending";
            }
        }

        await conn.query(
            `UPDATE cst_player_program_fees
             SET paid_amount = ?, due_amount = ?, payment_status = ?
             WHERE id = ?`,
            [totalPaid, dueAmount, nextFeeStatus, playerProgramFeeId]
        );

        // 2. ================= UPDATE / RECORD ATTENDANCE =================
        const attDate = formatDate(paymentDate || new Date());
        const paymentNote = `Fee payment ₹${Number(paidAmount || totalPaid).toFixed(2)} (${paymentMode}) - Receipt: ${receiptNo || "N/A"} - Status: ${nextFeeStatus}`;

        // Check if attendance already exists for this enrollment and date
        const [existingAtt] = await conn.query(
            `SELECT id, remarks, attendance_status
             FROM cst_player_attendance
             WHERE user_program_id = ? AND attendance_date = ?
             LIMIT 1`,
            [fee.user_program_id, attDate]
        );

        let attendanceId;
        if (existingAtt.length > 0) {
            attendanceId = existingAtt[0].id;
            const currentRemarks = existingAtt[0].remarks || "";
            // Append payment note if not already mentioned
            const updatedRemarks = currentRemarks.includes(receiptNo)
                ? currentRemarks
                : currentRemarks
                ? `${currentRemarks} | ${paymentNote}`
                : paymentNote;

            await conn.query(
                `UPDATE cst_player_attendance
                 SET attendance_status = 'Present',
                     remarks = ?
                 WHERE id = ?`,
                [updatedRemarks, attendanceId]
            );
        } else {
            const [newAtt] = await conn.query(
                `INSERT INTO cst_player_attendance (
                    academy_id, branch_id, user_program_id, admission_players_id, program_id,
                    attendance_date, attendance_status, remarks, marked_by
                ) VALUES (?, ?, ?, ?, ?, ?, 'Present', ?, ?)`,
                [
                    fee.academy_id,
                    fee.branch_id,
                    fee.user_program_id,
                    fee.admission_players_id,
                    fee.program_id,
                    attDate,
                    paymentNote,
                    receivedBy,
                ]
            );
            attendanceId = newAtt.insertId;
        }

        return {
            playerProgramFeeId,
            totalAmount,
            paidAmount: totalPaid,
            dueAmount,
            paymentStatus: nextFeeStatus,
            attendanceId,
            attendanceDate: attDate,
        };
    } catch (err) {
        console.error("[playerFlowSync] syncOnPaymentRecorded error:", err);
        throw err;
    } finally {
        if (shouldRelease && conn) {
            conn.release();
        }
    }
}

/**
 * Backfill existing active user programs that do not have fee or attendance records.
 * Ensures the admin panel immediately displays complete data.
 */
export async function backfillActiveUserPrograms({ connection: passedConn } = {}) {
    let conn = passedConn;
    const shouldRelease = !passedConn;

    try {
        if (!conn) {
            conn = await pool.getConnection();
        }

        const [userPrograms] = await conn.query(
            `SELECT up.id, up.user_id, up.appointment_no, up.program_id, up.branch_id,
                    up.admission_players_id, up.start_date, up.end_date, up.status
             FROM cst_user_programs up
             WHERE up.is_deleted = 0 AND up.status = 1`
        );

        let createdFees = 0;
        let createdAtt = 0;

        for (const up of userPrograms) {
            const feeMonth = formatMonthStart(up.start_date || new Date());

            // Check fee record
            const [fees] = await conn.query(
                `SELECT id FROM cst_player_program_fees
                 WHERE user_program_id = ? AND fee_month = ? LIMIT 1`,
                [up.id, feeMonth]
            );

            if (fees.length === 0) {
                await syncOnUserProgramInsert({
                    connection: conn,
                    userProgramId: up.id,
                    admissionPlayersId: up.admission_players_id,
                    programId: up.program_id,
                    branchId: up.branch_id,
                    userId: up.user_id,
                    startDate: up.start_date,
                    endDate: up.end_date,
                    status: up.status,
                });
                createdFees++;
            }

            // Check attendance record
            const attDate = formatDate(up.start_date || new Date());
            const [att] = await conn.query(
                `SELECT id FROM cst_player_attendance
                 WHERE user_program_id = ? AND attendance_date = ? LIMIT 1`,
                [up.id, attDate]
            );

            if (att.length === 0) {
                const [prog] = await conn.query(
                    `SELECT academy_id, program_name FROM cst_programs WHERE id = ? LIMIT 1`,
                    [up.program_id]
                );
                const acadId = prog[0]?.academy_id || 1;
                const pName = prog[0]?.program_name || "Program";

                await conn.query(
                    `INSERT INTO cst_player_attendance (
                        academy_id, branch_id, user_program_id, admission_players_id, program_id,
                        attendance_date, attendance_status, remarks, marked_by
                    ) VALUES (?, ?, ?, ?, ?, ?, 'Present', ?, ?)`,
                    [
                        acadId,
                        up.branch_id,
                        up.id,
                        up.admission_players_id,
                        up.program_id,
                        attDate,
                        `Enrolled in ${pName}`,
                        up.user_id || null,
                    ]
                );
                createdAtt++;
            }
        }

        return { totalProcessed: userPrograms.length, createdFees, createdAtt };
    } catch (err) {
        console.error("[playerFlowSync] backfillActiveUserPrograms error:", err);
        throw err;
    } finally {
        if (shouldRelease && conn) {
            conn.release();
        }
    }
}

/**
 * Automatically sync/insert an Individual Training session in cst_individual_training
 * when program_id = 1 (One-on-One 1:1) is selected.
 */
export async function syncIndividualTrainingOnEnrollment({
    connection: passedConn,
    academyId,
    branchId,
    userProgramId,
    startDate = null,
    endDate = null,
    coachUserId = null,
    trainingDays = "Monday,Wednesday,Friday",
    startTime = "07:00:00",
    endTime = "08:00:00",
    sessionDuration = 60,
    status = "Active",
    remarks = "Auto-created on 1:1 Individual Training enrollment",
}) {
    let conn = passedConn;
    const shouldRelease = !passedConn;

    try {
        if (!conn) {
            conn = await pool.getConnection();
        }

        if (!userProgramId || !branchId || !academyId) {
            console.warn("[playerFlowSync] Missing userProgramId, branchId or academyId for individual training sync.");
            return null;
        }

        // Check if individual training record already exists for this enrollment
        const [existing] = await conn.query(
            `SELECT id, coach_user_id, status FROM cst_individual_training
             WHERE user_program_id = ? AND is_deleted = 0
             LIMIT 1`,
            [userProgramId]
        );

        const sDate = formatDate(startDate || new Date());
        const eDate = endDate ? formatDate(endDate) : null;

        if (existing.length > 0) {
            const existingId = existing[0].id;
            // Update existing record with updated dates/status and coach if provided
            await conn.query(
                `UPDATE cst_individual_training
                 SET academy_id = ?,
                     branch_id = ?,
                     coach_user_id = COALESCE(?, coach_user_id),
                     start_date = COALESCE(?, start_date),
                     end_date = ?,
                     status = ?,
                     remarks = COALESCE(?, remarks)
                 WHERE id = ?`,
                [
                    academyId,
                    branchId,
                    coachUserId || null,
                    sDate,
                    eDate,
                    status,
                    remarks,
                    existingId,
                ]
            );
            return existingId;
        }

        // Find an active coach for this branch/academy if coachUserId is not provided
        let finalCoachUserId = coachUserId;
        if (!finalCoachUserId) {
            const [branchCoaches] = await conn.query(
                `SELECT id FROM cst_users WHERE branch_id = ? AND status = 1 AND is_deleted = 0 ORDER BY id ASC LIMIT 1`,
                [branchId]
            );
            if (branchCoaches.length > 0) {
                finalCoachUserId = branchCoaches[0].id;
            } else {
                const [academyCoaches] = await conn.query(
                    `SELECT id FROM cst_users WHERE academy_id = ? AND status = 1 AND is_deleted = 0 ORDER BY id ASC LIMIT 1`,
                    [academyId]
                );
                if (academyCoaches.length > 0) {
                    finalCoachUserId = academyCoaches[0].id;
                } else {
                    const [anyCoach] = await conn.query(
                        `SELECT id FROM cst_users WHERE status = 1 AND is_deleted = 0 ORDER BY id ASC LIMIT 1`
                    );
                    if (anyCoach.length > 0) {
                        finalCoachUserId = anyCoach[0].id;
                    }
                }
            }
        }

        if (!finalCoachUserId) {
            console.warn("[playerFlowSync] No active coach user found in database to assign individual training.");
            return null;
        }

        const [insertResult] = await conn.query(
            `INSERT INTO cst_individual_training (
                academy_id, branch_id, user_program_id, coach_user_id,
                training_days, start_time, end_time, start_date, end_date,
                session_duration, status, remarks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                academyId,
                branchId,
                userProgramId,
                finalCoachUserId,
                trainingDays,
                startTime,
                endTime,
                sDate,
                eDate,
                sessionDuration,
                status,
                remarks,
            ]
        );

        return insertResult.insertId;
    } catch (err) {
        console.error("[playerFlowSync] syncIndividualTrainingOnEnrollment error:", err);
        return null;
    } finally {
        if (shouldRelease && conn) {
            conn.release();
        }
    }
}
