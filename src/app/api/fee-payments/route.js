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

function isValidDate(value) {
    if (!value) return false;

    const date = new Date(value);

    return !Number.isNaN(date.getTime());
}

function normalizeDate(value) {
    if (!value) return null;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return null;

    return date;
}

function getPaymentStatus(paidAmount) {
    const paid = Number(paidAmount);

    if (paid <= 0) return "Pending";

    return "Partial";
}

/*
  Recalculate fee status from all payment records.

  Paid payments increase the received amount.
  Refunded payments decrease the received amount.
  Cancelled payments are ignored.
*/
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
        throw new Error(
            "Cannot recalculate a cancelled fee record."
        );
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
        throw new Error(
            "Total refunds cannot exceed total payments."
        );
    }

    if (paidAmount > feeAmount) {
        throw new Error(
            "Total payments cannot exceed the fee amount."
        );
    }

    let status = "Pending";

    if (paidAmount > 0 && paidAmount < feeAmount) {
        status = "Partial";
    } else if (paidAmount === feeAmount) {
        status = "Paid";
    }

    await connection.execute(
        `UPDATE cst_fee_status
         SET paid_amount = ?,
             status = ?
         WHERE id = ?`,
        [paidAmount, status, feeStatusId]
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

// GET /api/fee-payments
// Examples:
// /api/fee-payments?fee_status_id=10
// /api/fee-payments?payment_mode=UPI
// /api/fee-payments?status=Paid
// /api/fee-payments?date_from=2026-10-01&date_to=2026-10-31

export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);

        const conditions = [];
        const values = [];

        const idFilters = [
            "id",
            "fee_status_id",
            "created_by",
        ];

        for (const field of idFilters) {
            const value = searchParams.get(field);

            if (value !== null && value !== "") {
                if (!isPositiveInt(value)) {
                    return NextResponse.json(
                        {
                            success: false,
                            message: `${field} must be a positive integer.`,
                        },
                        { status: 400 }
                    );
                }

                conditions.push(`fp.${field} = ?`);
                values.push(Number(value));
            }
        }

        const paymentMode = searchParams.get("payment_mode");

        if (paymentMode) {
            if (!PAYMENT_MODES.includes(paymentMode)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid payment_mode.",
                    },
                    { status: 400 }
                );
            }

            conditions.push("fp.payment_mode = ?");
            values.push(paymentMode);
        }

        const status = searchParams.get("status");

        if (status) {
            if (!PAYMENT_STATUSES.includes(status)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid payment status.",
                    },
                    { status: 400 }
                );
            }

            conditions.push("fp.status = ?");
            values.push(status);
        }

        const dateFrom = searchParams.get("date_from");
        const dateTo = searchParams.get("date_to");

        if (dateFrom) {
            if (!isValidDate(dateFrom)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid date_from.",
                    },
                    { status: 400 }
                );
            }

            conditions.push("fp.payment_date >= ?");
            values.push(dateFrom);
        }

        if (dateTo) {
            if (!isValidDate(dateTo)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid date_to.",
                    },
                    { status: 400 }
                );
            }

            conditions.push(
                "fp.payment_date < DATE_ADD(?, INTERVAL 1 DAY)"
            );
            values.push(dateTo);
        }

        const whereClause = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            `SELECT
                fp.*,
                fs.academy_id,
                fs.branch_id,
                fs.fee_type,
                fs.tournament_id,
                fs.tournament_team_id,
                fs.tournament_team_player_id,
                fs.match_id,
                fs.match_team_id,
                fs.match_player_id,
                fs.ground_booking_id,
                fs.user_id,
                fs.outside_player_id,
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
             ${whereClause}
             ORDER BY fp.payment_date DESC, fp.id DESC`,
            values
        );

        return NextResponse.json({
            success: true,
            count: rows.length,
            data: rows,
        });
    } catch (error) {
        console.error("GET fee payments error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch payment records.",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// POST /api/fee-payments
export async function POST(request) {
    let connection;

    try {
        const body = await request.json();

        const feeStatusId = Number(body.fee_status_id);
        const amount = Number(body.amount);
        const paymentMode = body.payment_mode;
        const createdBy =
            body.created_by === undefined ||
                body.created_by === null ||
                body.created_by === ""
                ? null
                : Number(body.created_by);

        if (!isPositiveInt(feeStatusId)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid fee_status_id is required.",
                },
                { status: 400 }
            );
        }

        if (!isValidAmount(body.amount)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "amount must be greater than zero.",
                },
                { status: 400 }
            );
        }

        if (!PAYMENT_MODES.includes(paymentMode)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid payment_mode.",
                },
                { status: 400 }
            );
        }

        if (
            createdBy !== null &&
            !isPositiveInt(createdBy)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "created_by must be a positive integer or null.",
                },
                { status: 400 }
            );
        }

        const paymentDate =
            body.payment_date === undefined ||
                body.payment_date === null ||
                body.payment_date === ""
                ? null
                : normalizeDate(body.payment_date);

        if (
            body.payment_date &&
            !paymentDate
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid payment_date.",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [feeRows] = await connection.execute(
            `SELECT id, fee_amount, paid_amount, status
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
                    message: "Fee status record not found.",
                },
                { status: 404 }
            );
        }

        const fee = feeRows[0];

        if (fee.status === "Cancelled") {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Cannot accept payment for a cancelled fee.",
                },
                { status: 400 }
            );
        }

        // Check amount against the current balance.
        const balance =
            Number(fee.fee_amount) - Number(fee.paid_amount);

        if (amount > balance) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: `Payment amount cannot exceed the remaining balance of ${balance.toFixed(2)}.`,
                },
                { status: 400 }
            );
        }

        const [result] = await connection.execute(
            `INSERT INTO cst_fee_payments (
                fee_status_id,
                amount,
                payment_mode,
                transaction_no,
                payment_date,
                status,
                remarks,
                created_by
            ) VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), 'Paid', ?, ?)`,
            [
                feeStatusId,
                amount,
                paymentMode,
                body.transaction_no
                    ? String(body.transaction_no).trim()
                    : null,
                paymentDate,
                body.remarks
                    ? String(body.remarks).trim()
                    : null,
                createdBy,
            ]
        );

        await recalculateFeeStatus(connection, feeStatusId);

        await connection.commit();

        return NextResponse.json(
            {
                success: true,
                message: "Payment recorded successfully.",
                id: result.insertId,
            },
            { status: 201 }
        );
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("POST fee payment error:", error);

        return NextResponse.json(
            {
                success: false,
                message: error.message || "Failed to record payment.",
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}