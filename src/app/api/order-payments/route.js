import { NextResponse } from "next/server";
import db from "@/app/components/lib/db";

const PAYMENT_METHODS = [
    "Cash",
    "UPI",
    "Card",
    "Bank Transfer",
    "COD",
];

const PAYMENT_STATUSES = [
    "Pending",
    "Success",
    "Failed",
    "Refunded",
];

function validId(value) {
    return Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

function validAmount(value) {
    return (
        value !== null &&
        value !== "" &&
        /^\d+(\.\d{1,2})?$/.test(String(value)) &&
        Number.isFinite(Number(value)) &&
        Number(value) >= 0
    );
}


// GET: All order payments with filters
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);

        const order_id = searchParams.get("order_id");
        const payment_method = searchParams.get("payment_method");
        const payment_status = searchParams.get("payment_status");
        const payment_provider = searchParams.get("payment_provider");
        const transaction_no = searchParams.get("transaction_no");
        const gateway_order_id = searchParams.get("gateway_order_id");
        const gateway_transaction_id = searchParams.get("gateway_transaction_id");
        const search = searchParams.get("search");

        const min_amount = searchParams.get("min_amount");
        const max_amount = searchParams.get("max_amount");
        const start_date = searchParams.get("start_date");
        const end_date = searchParams.get("end_date");

        let sql = `
SELECT
op.*,
    COALESCE(op.payment_date, op.created_at) AS payment_date,
    o.order_no,
    o.customer_name,
    o.customer_phone,
    o.order_status,
    o.payment_status AS order_payment_status
            FROM cst_order_payments op
            INNER JOIN cst_orders o
                ON o.id = op.order_id
            WHERE 1 = 1
    `;

        const values = [];

        if (order_id !== null) {
            if (!validId(order_id)) {
                return NextResponse.json(
                    { success: false, message: "Invalid order_id." },
                    { status: 400 }
                );
            }

            sql += " AND op.order_id = ?";
            values.push(Number(order_id));
        }

        if (payment_method) {
            if (!PAYMENT_METHODS.includes(payment_method)) {
                return NextResponse.json(
                    { success: false, message: "Invalid payment_method." },
                    { status: 400 }
                );
            }

            sql += " AND op.payment_method = ?";
            values.push(payment_method);
        }

        if (payment_status) {
            if (!PAYMENT_STATUSES.includes(payment_status)) {
                return NextResponse.json(
                    { success: false, message: "Invalid payment_status." },
                    { status: 400 }
                );
            }

            sql += " AND op.payment_status = ?";
            values.push(payment_status);
        }

        if (payment_provider) {
            sql += " AND op.payment_provider LIKE ?";
            values.push(`% ${ payment_provider }% `);
        }

        if (transaction_no) {
            sql += " AND op.transaction_no LIKE ?";
            values.push(`% ${ transaction_no }% `);
        }

        if (gateway_order_id) {
            sql += " AND op.gateway_order_id LIKE ?";
            values.push(`% ${ gateway_order_id }% `);
        }

        if (gateway_transaction_id) {
            sql += " AND op.gateway_transaction_id LIKE ?";
            values.push(`% ${ gateway_transaction_id }% `);
        }

        if (search) {
            sql += `
AND(
    o.order_no LIKE ?
    OR o.customer_name LIKE ?
    OR o.customer_phone LIKE ?
    OR op.transaction_no LIKE ?
    OR op.gateway_transaction_id LIKE ?
                )
    `;

            const keyword = `% ${ search }% `;
            values.push(keyword, keyword, keyword, keyword, keyword);
        }

        if (min_amount !== null && min_amount !== "") {
            if (!validAmount(min_amount)) {
                return NextResponse.json(
                    { success: false, message: "Invalid min_amount." },
                    { status: 400 }
                );
            }

            sql += " AND op.amount >= ?";
            values.push(Number(min_amount));
        }

        if (max_amount !== null && max_amount !== "") {
            if (!validAmount(max_amount)) {
                return NextResponse.json(
                    { success: false, message: "Invalid max_amount." },
                    { status: 400 }
                );
            }

            sql += " AND op.amount <= ?";
            values.push(Number(max_amount));
        }

        if (start_date) {
            sql += " AND op.created_at >= ?";
            values.push(`${ start_date } 00:00:00`);
        }

        if (end_date) {
            sql += " AND op.created_at < DATE_ADD(?, INTERVAL 1 DAY)";
            values.push(end_date);
        }

        sql += " ORDER BY op.id DESC";

        const [payments] = await db.execute(sql, values);

        return NextResponse.json({
            success: true,
            total: payments.length,
            data: payments,
        });
    } catch (error) {
        console.error("GET Order Payments Error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch order payments." },
            { status: 500 }
        );
    }
}


// POST: Create a payment record
export async function POST(request) {
    let connection;

    try {
        const body = await request.json();

        const {
            order_id,
            amount,
            payment_method,
            payment_provider = null,
            gateway_order_id = null,
            gateway_transaction_id = null,
            transaction_no = null,
            payment_status = "Pending",
            payment_date = null,
            notes = null,
        } = body;

        if (!validId(order_id)) {
            return NextResponse.json(
                { success: false, message: "Valid order_id is required." },
                { status: 400 }
            );
        }

        if (!validAmount(amount) || Number(amount) <= 0) {
            return NextResponse.json(
                { success: false, message: "amount must be greater than zero." },
                { status: 400 }
            );
        }

        if (!PAYMENT_METHODS.includes(payment_method)) {
            return NextResponse.json(
                { success: false, message: "Invalid payment_method." },
                { status: 400 }
            );
        }

        if (!PAYMENT_STATUSES.includes(payment_status)) {
            return NextResponse.json(
                { success: false, message: "Invalid payment_status." },
                { status: 400 }
            );
        }

        if (
            payment_date !== null &&
            payment_date !== "" &&
            Number.isNaN(Date.parse(payment_date))
        ) {
            return NextResponse.json(
                { success: false, message: "Invalid payment_date." },
                { status: 400 }
            );
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [orders] = await connection.execute(
            "SELECT id, grand_total FROM cst_orders WHERE id = ? FOR UPDATE",
            [Number(order_id)]
        );

        if (orders.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Order not found." },
                { status: 404 }
            );
        }

        // Do not accept a second successful payment beyond the order balance.
        if (payment_status === "Success") {
            const [paidRows] = await connection.execute(
                `
                SELECT COALESCE(SUM(amount), 0) AS paid_amount
                FROM cst_order_payments
                WHERE order_id = ?
    AND payment_status = 'Success'
        `,
                [Number(order_id)]
            );

            const alreadyPaid = Number(paidRows[0].paid_amount);
            const grandTotal = Number(orders[0].grand_total);

            if (alreadyPaid + Number(amount) > grandTotal + 0.001) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message: "Payment amount exceeds the remaining order balance.",
                        remaining_amount: Number(
                            Math.max(0, grandTotal - alreadyPaid).toFixed(2)
                        ),
                    },
                    { status: 400 }
                );
            }
        }

        const effectivePaymentDate = payment_date && !Number.isNaN(Date.parse(payment_date))
            ? new Date(payment_date).toISOString().slice(0, 19).replace("T", " ")
            : new Date().toISOString().slice(0, 19).replace("T", " ");

        const [result] = await connection.execute(
            `
            INSERT INTO cst_order_payments(
            order_id,
            amount,
            payment_method,
            payment_provider,
            gateway_order_id,
            gateway_transaction_id,
            transaction_no,
            payment_status,
            payment_date,
            notes
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                Number(order_id),
                Number(amount),
                payment_method,
                payment_provider || null,
                gateway_order_id || null,
                gateway_transaction_id || null,
                transaction_no || null,
                payment_status,
                effectivePaymentDate,
                notes || null,
            ]
        );

        // Recalculate parent order payment status.
        const [summary] = await connection.execute(
            `
SELECT
COALESCE(SUM(
    CASE WHEN payment_status = 'Success'
                    THEN amount ELSE 0 END
), 0) AS paid_amount,
    COALESCE(SUM(
        CASE WHEN payment_status = 'Refunded'
                    THEN amount ELSE 0 END
    ), 0) AS refunded_amount,
        SUM(payment_status = 'Failed') AS failed_count
            FROM cst_order_payments
            WHERE order_id = ?
    `,
            [Number(order_id)]
        );

        const paidAmount = Number(summary[0].paid_amount);
        const refundedAmount = Number(summary[0].refunded_amount);
        const grandTotal = Number(orders[0].grand_total);

        let orderPaymentStatus = "Pending";

        if (paidAmount > 0 && paidAmount >= grandTotal) {
            orderPaymentStatus = "Paid";
        } else if (paidAmount > 0) {
            orderPaymentStatus = "Partial";
        } else if (refundedAmount > 0) {
            orderPaymentStatus = "Refunded";
        } else if (Number(summary[0].failed_count) > 0) {
            orderPaymentStatus = "Failed";
        }

        await connection.execute(
            "UPDATE cst_orders SET payment_status = ? WHERE id = ?",
            [orderPaymentStatus, Number(order_id)]
        );

        await connection.commit();

        return NextResponse.json(
            {
                success: true,
                message: "Payment record created successfully.",
                id: result.insertId,
                order_payment_status: orderPaymentStatus,
            },
            { status: 201 }
        );
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("POST Order Payment Error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                {
                    success: false,
                    message: "This gateway_transaction_id already exists.",
                },
                { status: 409 }
            );
        }

        if (
            error.code === "ER_NO_REFERENCED_ROW_2" ||
            error.code === "ER_NO_REFERENCED_ROW"
        ) {
            return NextResponse.json(
                { success: false, message: "Invalid order_id." },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { success: false, message: "Failed to create payment." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
