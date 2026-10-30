import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import crypto from "crypto";
import { syncOnPaymentRecorded } from "@/app/components/lib/playerFlowSync.js";
import { getAuthUser } from "@/app/components/lib/rbac";


// ============================================
// Helper: Validate Amount
// ============================================
function isValidAmount(value) {
    return (
        value !== undefined &&
        value !== null &&
        value !== "" &&
        Number.isFinite(Number(value)) &&
        Number(value) > 0
    );
}

// ============================================
// Helper: Generate Receipt Number
// ============================================
function generateReceiptNo() {
    return `CST-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

// ============================================
// Helper: Update Fee Balance from Successful
// Payments
// ============================================
async function recalculateFee(connection, feeId) {
    const [fees] = await connection.query(
        `
        SELECT id, total_amount, payment_status
        FROM cst_player_program_fees
        WHERE id = ?
    FOR UPDATE
        `,
        [feeId]
    );

    if (fees.length === 0) {
        throw new Error("Monthly fee record not found.");
    }

    const fee = fees[0];

    const [payments] = await connection.query(
        `
SELECT
COALESCE(SUM(paid_amount), 0) AS paid_amount
        FROM cst_player_payments
        WHERE player_program_fee_id = ?
    AND payment_status = 'Success'
        `,
        [feeId]
    );

    const totalAmount = Number(fee.total_amount);
    const paidAmount = Number(payments[0].paid_amount);

    if (paidAmount > totalAmount) {
        throw new Error(
            "Total successful payments cannot exceed the fee amount."
        );
    }

    const dueAmount = Number(
        (totalAmount - paidAmount).toFixed(2)
    );

    let paymentStatus = fee.payment_status;

    if (paymentStatus !== "Cancelled") {
        if (dueAmount === 0) {
            paymentStatus = "Paid";
        } else if (paidAmount > 0) {
            paymentStatus = "Partial";
        } else {
            paymentStatus = "Pending";
        }
    }

    await connection.query(
        `
        UPDATE cst_player_program_fees
        SET paid_amount = ?,
    due_amount = ?,
    payment_status = ?
        WHERE id = ?
            `,
        [
            paidAmount,
            dueAmount,
            paymentStatus,
            feeId
        ]
    );

    return {
        total_amount: totalAmount,
        paid_amount: paidAmount,
        due_amount: dueAmount,
        payment_status: paymentStatus
    };
}

// ============================================
// GET: Payment List
// ============================================
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);

        const id = searchParams.get("id");
        const player_program_fee_id =
            searchParams.get("player_program_fee_id");
        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");
        const admission_players_id =
            searchParams.get("admission_players_id");
        const program_id = searchParams.get("program_id");
        const payment_mode = searchParams.get("payment_mode");
        const payment_status = searchParams.get("payment_status");
        const receipt_no = searchParams.get("receipt_no");
        const from_date = searchParams.get("from_date");
        const to_date = searchParams.get("to_date");
        const search = searchParams.get("search");

        const allowedModes = [
            "Cash",
            "UPI",
            "Card",
            "Bank Transfer",
            "Cheque"
        ];

        const allowedStatuses = [
            "Success",
            "Failed",
            "Refunded"
        ];

        if (payment_mode && !allowedModes.includes(payment_mode)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid payment_mode."
                },
                { status: 400 }
            );
        }

        if (
            payment_status &&
            !allowedStatuses.includes(payment_status)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid payment_status."
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        let sql = `
            SELECT
pay.id,
    pay.player_program_fee_id,
    pay.receipt_no,
    pay.paid_amount,
    pay.payment_mode,
    pay.transaction_no,
    pay.payment_date,
    pay.payment_status,
    pay.remarks,
    pay.received_by,
    pay.created_at,

    f.academy_id,
    f.branch_id,
    f.user_program_id,
    f.admission_players_id,
    f.program_id,
    f.fee_month,
    f.total_amount AS invoice_amount,
        f.paid_amount AS invoice_paid_amount,
            f.due_amount AS invoice_due_amount,
                f.payment_status AS invoice_status,

                    ap.admission_no,
                    CONCAT(
                        ap.first_name,
                        ' ',
                        COALESCE(ap.last_name, '')
                    ) AS player_name,

                        p.program_name,

                        CONCAT(
                            COALESCE(receiver.first_name, ''),
                            ' ',
                            COALESCE(receiver.last_name, '')
                        ) AS received_by_name

            FROM cst_player_payments pay

            INNER JOIN cst_player_program_fees f
                ON f.id = pay.player_program_fee_id

            INNER JOIN cst_admission_players ap
                ON ap.id = f.admission_players_id

            INNER JOIN cst_programs p
                ON p.id = f.program_id

            LEFT JOIN cst_users receiver
                ON receiver.id = pay.received_by

            WHERE 1 = 1
    `;

        const values = [];

        if (id) {
            sql += ` AND pay.id = ? `;
            values.push(id);
        }

        if (player_program_fee_id) {
            sql += ` AND pay.player_program_fee_id = ? `;
            values.push(player_program_fee_id);
        }

        const authUser = await getAuthUser(request);
        if (authUser) {
            if (authUser.isBranchAdmin && authUser.branch_id) {
                sql += " AND f.branch_id = ? AND f.academy_id = ?";
                values.push(authUser.branch_id, authUser.academy_id);
            } else if (authUser.isAcademyAdmin && authUser.academy_id) {
                sql += " AND f.academy_id = ?";
                values.push(authUser.academy_id);
                if (branch_id) {
                    sql += " AND f.branch_id = ?";
                    values.push(branch_id);
                }
            } else if (authUser.isAccountant && authUser.academy_id) {
                sql += " AND f.academy_id = ?";
                values.push(authUser.academy_id);
                if (authUser.branch_id) {
                    sql += " AND f.branch_id = ?";
                    values.push(authUser.branch_id);
                } else if (branch_id) {
                    sql += " AND f.branch_id = ?";
                    values.push(branch_id);
                }
            } else if (!authUser.isSuperAdmin && authUser.academy_id) {
                sql += " AND f.academy_id = ?";
                values.push(authUser.academy_id);
            } else {
                if (academy_id) { sql += ` AND f.academy_id = ? `; values.push(academy_id); }
                if (branch_id) { sql += ` AND f.branch_id = ? `; values.push(branch_id); }
            }
        } else {
            if (academy_id) { sql += ` AND f.academy_id = ? `; values.push(academy_id); }
            if (branch_id) { sql += ` AND f.branch_id = ? `; values.push(branch_id); }
        }

        if (admission_players_id) {
            sql += ` AND f.admission_players_id = ? `;
            values.push(admission_players_id);
        }

        if (program_id) {
            sql += ` AND f.program_id = ? `;
            values.push(program_id);
        }

        if (payment_mode) {
            sql += ` AND pay.payment_mode = ? `;
            values.push(payment_mode);
        }

        if (payment_status) {
            sql += ` AND pay.payment_status = ? `;
            values.push(payment_status);
        }

        if (receipt_no) {
            sql += ` AND pay.receipt_no = ? `;
            values.push(receipt_no);
        }

        if (from_date) {
            sql += ` AND pay.payment_date >= ? `;
            values.push(`${ from_date } 00:00:00`);
        }

        if (to_date) {
            sql += ` AND pay.payment_date < DATE_ADD(?, INTERVAL 1 DAY)`;
            values.push(to_date);
        }

        if (search) {
            sql += `
AND(
    pay.receipt_no LIKE ?
    OR ap.admission_no LIKE ?
    OR ap.first_name LIKE ?
    OR ap.last_name LIKE ?
    OR p.program_name LIKE ?
                )
    `;

            const searchValue = `%${search.trim()}%`;

            values.push(
                searchValue,
                searchValue,
                searchValue,
                searchValue,
                searchValue
            );
        }

        sql += ` ORDER BY pay.payment_date DESC, pay.id DESC`;

        const [rows] = await connection.query(sql, values);

        return NextResponse.json({
            success: true,
            message: "Payments fetched successfully.",
            total: rows.length,
            data: rows
        });

    } catch (error) {
        console.error("GET Payments Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch payments."
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }
}


// ============================================
// POST: Receive Payment
// ============================================
export async function POST(request) {
    const authUser = await getAuthUser(request);
    if (authUser && (authUser.isCoach || authUser.isPlayer)) {
        return NextResponse.json(
            { success: false, message: "Coaches and Players do not have permission to record payments" },
            { status: 403 }
        );
    }

    let connection;

    try {
        const body = await request.json();

        const {
            player_program_fee_id,
            paid_amount,
            payment_mode = "Cash",
            transaction_no = null,
            payment_date,
            remarks = null,
            received_by = null
        } = body;

        if (!player_program_fee_id || !isValidAmount(paid_amount)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "player_program_fee_id and a positive paid_amount are required."
                },
                { status: 400 }
            );
        }

        const allowedModes = [
            "Cash",
            "UPI",
            "Card",
            "Bank Transfer",
            "Cheque"
        ];

        if (!allowedModes.includes(payment_mode)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid payment_mode."
                },
                { status: 400 }
            );
        }

        const amount = Number(Number(paid_amount).toFixed(2));

        if (!Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "paid_amount must be greater than zero."
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        await connection.beginTransaction();

        // Lock invoice row to prevent concurrent overpayment.
        const [fees] = await connection.query(
            `
SELECT
id,
    total_amount,
    paid_amount,
    due_amount,
    payment_status
            FROM cst_player_program_fees
            WHERE id = ?
    FOR UPDATE
        `,
            [player_program_fee_id]
        );

        if (fees.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Monthly fee invoice not found."
                },
                { status: 404 }
            );
        }

        const fee = fees[0];

        if (fee.payment_status === "Cancelled") {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Cannot receive payment for a cancelled invoice."
                },
                { status: 409 }
            );
        }

        // Recalculate from successful payment history.
        const [successfulPayments] = await connection.query(
            `
            SELECT COALESCE(SUM(paid_amount), 0) AS paid_amount
            FROM cst_player_payments
            WHERE player_program_fee_id = ?
    AND payment_status = 'Success'
        `,
            [player_program_fee_id]
        );

        const alreadyPaid = Number(successfulPayments[0].paid_amount);
        const totalAmount = Number(fee.total_amount);
        const currentDue = Number(
            (totalAmount - alreadyPaid).toFixed(2)
        );

        if (amount > currentDue) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Payment amount cannot exceed the outstanding balance.",
                    total_amount: totalAmount,
                    paid_amount: alreadyPaid,
                    due_amount: currentDue
                },
                { status: 400 }
            );
        }

        const receiptNo = generateReceiptNo();

        // Payment is treated as successful when received by this endpoint.
        const [result] = await connection.query(
            `
            INSERT INTO cst_player_payments(
            player_program_fee_id,
            receipt_no,
            paid_amount,
            payment_mode,
            transaction_no,
            payment_date,
            payment_status,
            remarks,
            received_by
        )
VALUES(?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), 'Success', ?, ?)
    `,
            [
                player_program_fee_id,
                receiptNo,
                amount,
                payment_mode,
                transaction_no,
                payment_date || null,
                remarks,
                received_by
            ]
        );

        const feeSummary = await recalculateFee(
            connection,
            player_program_fee_id
        );

        // Automatically update attendance for player on payment date
        try {
            await syncOnPaymentRecorded({
                connection,
                playerProgramFeeId: player_program_fee_id,
                paidAmount: amount,
                paymentDate: payment_date || new Date(),
                paymentMode: payment_mode,
                receiptNo,
                paymentStatus: "Success",
                remarks,
                receivedBy: received_by,
            });
        } catch (attErr) {
            console.error("ATTENDANCE SYNC ON PAYMENT ERROR:", attErr);
        }

        await connection.commit();

        return NextResponse.json(
            {
                success: true,
                message: "Payment received successfully.",
                data: {
                    id: result.insertId,
                    player_program_fee_id: Number(player_program_fee_id),
                    receipt_no: receiptNo,
                    paid_amount: amount,
                    payment_mode,
                    transaction_no,
                    payment_status: "Success",
                    ...feeSummary
                }
            },
            { status: 201 }
        );

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("POST Payment Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to receive payment."
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }
}



