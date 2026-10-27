import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


const PAYMENT_MODES = [
    "Cash",
    "UPI",
    "Card",
    "Bank Transfer",
    "Cheque",
];

const PAYMENT_STATUSES = [
    "Paid",
    "Refunded",
    "Cancelled",
];

const isPositiveInt = (value) =>
    Number.isInteger(Number(value)) && Number(value) > 0;

const isValidAmount = (value) =>
    value !== undefined &&
    value !== null &&
    value !== "" &&
    Number.isFinite(Number(value)) &&
    Number(value) > 0;

function normalizeDate(value) {
    if (!value) return null;

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
}

async function recalculateFeeStatus(connection, feeStatusId) {
    const [feeRows] = await connection.execute(
        `SELECT id, fee_amount, status, fee_type, match_player_id
         FROM cst_fee_status
         WHERE id = ?
         FOR UPDATE`,
        [feeStatusId]
    );

    if (!feeRows.length) {
        throw new Error("Fee status record not found.");
    }

    const fee = feeRows[0];

    if (fee.status === "Cancelled") {
        throw new Error("Cannot recalculate a cancelled fee record.");
    }

    const [paymentRows] = await connection.execute(
        `SELECT
            COALESCE(
                SUM(
                    CASE
                        WHEN status = 'Paid' THEN amount
                        WHEN status = 'Refunded' THEN -amount
                        ELSE 0
                    END
                ),
                0
            ) AS net_paid
         FROM cst_fee_payments
         WHERE fee_status_id = ?`,
        [feeStatusId]
    );

    const paidAmount = Number(paymentRows[0].net_paid);
    const feeAmount = Number(fee.fee_amount);

    if (paidAmount < 0) {
        throw new Error("Total refunds cannot exceed total payments.");
    }

    if (paidAmount > feeAmount) {
        throw new Error("Total payments cannot exceed the fee amount.");
    }

    let feeStatus = "Pending";

    if (paidAmount > 0 && paidAmount < feeAmount) {
        feeStatus = "Partial";
    } else if (paidAmount === feeAmount) {
        feeStatus = "Paid";
    }

    await connection.execute(
        `UPDATE cst_fee_status
         SET paid_amount = ?,
             status = ?
         WHERE id = ?`,
        [paidAmount, feeStatus, feeStatusId]
    );

    if (fee.fee_type === "Match Player" && fee.match_player_id) {
        const playerPaymentStatus = feeAmount <= 0
            ? "Not Generated"
            : paidAmount <= 0
                ? "Pending"
                : paidAmount >= feeAmount
                    ? "Paid"
                    : "Partial";
        await connection.execute(
            `UPDATE cst_match_players
             SET paid_amount = ?, payment_status = ?
             WHERE id = ?`,
            [paidAmount, playerPaymentStatus, fee.match_player_id]
        );
    }
}

// GET /api/fee-payments/10
export async function GET(request, context) {
    let connection;

    try {
        const { id } = await context.params;

        if (!isPositiveInt(id)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid payment ID.",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            `SELECT
                fp.*,
                fs.academy_id,
                fs.branch_id,
                fs.fee_type,
                fs.fee_amount,
                fs.paid_amount,
                fs.balance_amount,
                fs.status AS fee_status,
                u.first_name AS created_by_first_name,
                u.last_name AS created_by_last_name,
                pu.first_name,
                pu.last_name,
                pu.first_name AS player_first_name,
                pu.last_name AS player_last_name,
                op.player_name AS outside_player_name,
                op.player_name
             FROM cst_fee_payments fp
             INNER JOIN cst_fee_status fs
                ON fs.id = fp.fee_status_id
             LEFT JOIN cst_match_players mp
                ON mp.id = fs.match_player_id
             LEFT JOIN cst_tournament_team_players ttp
                ON ttp.id = fs.tournament_team_player_id
             LEFT JOIN cst_users pu
                ON pu.id = COALESCE(fs.user_id, mp.user_id, ttp.user_id)
             LEFT JOIN cst_outside_players op
                ON op.id = COALESCE(fs.outside_player_id, mp.outside_player_id, ttp.outside_player_id)
             LEFT JOIN cst_users u
                ON u.id = fp.created_by
             WHERE fp.id = ?
             LIMIT 1`,
            [Number(id)]
        );

        if (!rows.length) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Payment record not found.",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("GET single fee payment error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch payment.",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// PUT /api/fee-payments/10
export async function PUT(request, context) {
    let connection;

    try {
        const { id } = await context.params;

        if (!isPositiveInt(id)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid payment ID.",
                },
                { status: 400 }
            );
        }

        const body = await request.json();

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [paymentRows] = await connection.execute(
            `SELECT *
             FROM cst_fee_payments
             WHERE id = ?
             FOR UPDATE`,
            [Number(id)]
        );

        if (!paymentRows.length) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Payment record not found.",
                },
                { status: 404 }
            );
        }

        const old = paymentRows[0];

        if (
            old.status !== "Paid" &&
            body.status === "Paid"
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "A refunded or cancelled payment cannot be marked Paid again. Record a new payment instead.",
                },
                { status: 400 }
            );
        }

        const amount =
            body.amount === undefined
                ? Number(old.amount)
                : Number(body.amount);

        const paymentMode =
            body.payment_mode === undefined
                ? old.payment_mode
                : body.payment_mode;

        const status =
            body.status === undefined
                ? old.status
                : body.status;

        const paymentDate =
            body.payment_date === undefined
                ? old.payment_date
                : normalizeDate(body.payment_date);

        const transactionNo =
            body.transaction_no === undefined
                ? old.transaction_no
                : body.transaction_no
                    ? String(body.transaction_no).trim()
                    : null;

        const remarks =
            body.remarks === undefined
                ? old.remarks
                : body.remarks
                    ? String(body.remarks).trim()
                    : null;

        const createdBy =
            body.created_by === undefined
                ? old.created_by
                : body.created_by === null ||
                    body.created_by === ""
                    ? null
                    : Number(body.created_by);

        if (!isValidAmount(amount)) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "amount must be greater than zero.",
                },
                { status: 400 }
            );
        }

        if (!PAYMENT_MODES.includes(paymentMode)) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid payment_mode.",
                },
                { status: 400 }
            );
        }

        if (!PAYMENT_STATUSES.includes(status)) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid payment status.",
                },
                { status: 400 }
            );
        }

        if (
            body.payment_date !== undefined &&
            body.payment_date !== null &&
            body.payment_date !== "" &&
            !paymentDate
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid payment_date.",
                },
                { status: 400 }
            );
        }

        if (
            createdBy !== null &&
            !isPositiveInt(createdBy)
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid created_by.",
                },
                { status: 400 }
            );
        }

        const feeStatusId = Number(old.fee_status_id);

        const [feeRows] = await connection.execute(
            `SELECT id, fee_amount, status
             FROM cst_fee_status
             WHERE id = ?
             FOR UPDATE`,
            [feeStatusId]
        );

        if (!feeRows.length) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Related fee record not found.",
                },
                { status: 404 }
            );
        }

        if (feeRows[0].status === "Cancelled") {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Cannot update a payment for a cancelled fee.",
                },
                { status: 400 }
            );
        }

        const [otherPayments] = await connection.execute(
            `SELECT
                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'Paid' THEN amount
                            WHEN status = 'Refunded' THEN -amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS net_paid
             FROM cst_fee_payments
             WHERE fee_status_id = ?
               AND id <> ?`,
            [feeStatusId, Number(id)]
        );

        const otherNetPaid = Number(otherPayments[0].net_paid);

        const projectedPaid =
            otherNetPaid +
            (status === "Paid"
                ? amount
                : status === "Refunded"
                    ? -amount
                    : 0);

        if (
            projectedPaid < 0 ||
            projectedPaid > Number(feeRows[0].fee_amount)
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "This change would make total payments or refunds invalid for the fee.",
                },
                { status: 400 }
            );
        }

        await connection.execute(
            `UPDATE cst_fee_payments
             SET amount = ?,
                 payment_mode = ?,
                 transaction_no = ?,
                 payment_date = COALESCE(?, payment_date),
                 status = ?,
                 remarks = ?,
                 created_by = ?
             WHERE id = ?`,
            [
                amount,
                paymentMode,
                transactionNo,
                paymentDate,
                status,
                remarks,
                createdBy,
                Number(id),
            ]
        );

        await recalculateFeeStatus(connection, feeStatusId);

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Payment updated successfully.",
        });
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("PUT fee payment error:", error);

        return NextResponse.json(
            {
                success: false,
                message: error.message || "Failed to update payment.",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// DELETE /api/fee-payments/10
// Only non-Paid payments can be physically deleted.
export async function DELETE(request, context) {
    let connection;

    try {
        const { id } = await context.params;

        if (!isPositiveInt(id)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid payment ID.",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.execute(
            `SELECT *
             FROM cst_fee_payments
             WHERE id = ?
             FOR UPDATE`,
            [Number(id)]
        );

        if (!rows.length) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Payment record not found.",
                },
                { status: 404 }
            );
        }

        if (rows[0].status === "Paid") {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Paid payments cannot be deleted. Mark the payment as Refunded or Cancelled instead.",
                },
                { status: 400 }
            );
        }

        const feeStatusId = Number(rows[0].fee_status_id);

        await connection.execute(
            "DELETE FROM cst_fee_payments WHERE id = ?",
            [Number(id)]
        );

        await recalculateFeeStatus(connection, feeStatusId);

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Payment deleted successfully.",
        });
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("DELETE fee payment error:", error);

        return NextResponse.json(
            {
                success: false,
                message: error.message || "Failed to delete payment.",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}