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
        Number(value) > 0
    );
}

// Recalculate parent order payment status.
// Call while the parent order is locked.
async function syncOrderPaymentStatus(connection, orderId) {
    const [orders] = await connection.execute(
        "SELECT grand_total FROM cst_orders WHERE id = ? FOR UPDATE",
        [orderId]
    );

    if (orders.length === 0) {
        throw new Error("Order not found.");
    }

    const [rows] = await connection.execute(
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
        [orderId]
    );

    const paid = Number(rows[0].paid_amount);
    const refunded = Number(rows[0].refunded_amount);
    const grandTotal = Number(orders[0].grand_total);

    let status = "Pending";

    if (paid > 0 && paid >= grandTotal) {
        status = "Paid";
    } else if (paid > 0) {
        status = "Partial";
    } else if (refunded > 0) {
        status = "Refunded";
    } else if (Number(rows[0].failed_count) > 0) {
        status = "Failed";
    }

    await connection.execute(
        "UPDATE cst_orders SET payment_status = ? WHERE id = ?",
        [status, orderId]
    );

    return status;
}


// GET: Single payment
export async function GET(request, { params }) {
    try {
        const { id } = await params;

        if (!validId(id)) {
            return NextResponse.json(
                { success: false, message: "Invalid payment ID." },
                { status: 400 }
            );
        }

        const [rows] = await db.execute(
            `
            SELECT
op.*,
    o.order_no,
    o.customer_name,
    o.customer_phone,
    o.order_status,
    o.payment_status AS order_payment_status
            FROM cst_order_payments op
            INNER JOIN cst_orders o ON o.id = op.order_id
            WHERE op.id = ?
    LIMIT 1
        `,
            [Number(id)]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Payment not found." },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("GET Single Payment Error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch payment." },
            { status: 500 }
        );
    }
}


// PUT: Update payment
export async function PUT(request, { params }) {
    let connection;

    try {
        const { id } = await params;

        if (!validId(id)) {
            return NextResponse.json(
                { success: false, message: "Invalid payment ID." },
                { status: 400 }
            );
        }

        const body = await request.json();

        const allowedFields = [
            "amount",
            "payment_method",
            "payment_provider",
            "gateway_order_id",
            "gateway_transaction_id",
            "transaction_no",
            "payment_status",
            "payment_date",
            "notes",
        ];

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.execute(
            `
            SELECT op.*, o.grand_total
            FROM cst_order_payments op
            INNER JOIN cst_orders o ON o.id = op.order_id
            WHERE op.id = ?
    FOR UPDATE
        `,
            [Number(id)]
        );

        if (rows.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Payment not found." },
                { status: 404 }
            );
        }

        const existing = rows[0];
        const payment = {};

        for (const field of allowedFields) {
            payment[field] = Object.prototype.hasOwnProperty.call(body, field)
                ? body[field]
                : existing[field];
        }

        if (!validAmount(payment.amount)) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "amount must be greater than zero." },
                { status: 400 }
            );
        }

        if (!PAYMENT_METHODS.includes(payment.payment_method)) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Invalid payment_method." },
                { status: 400 }
            );
        }

        if (!PAYMENT_STATUSES.includes(payment.payment_status)) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Invalid payment_status." },
                { status: 400 }
            );
        }

        if (
            payment.payment_date &&
            Number.isNaN(Date.parse(payment.payment_date))
        ) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Invalid payment_date." },
                { status: 400 }
            );
        }

        // Lock parent order before checking the total paid amount.
        const [orderRows] = await connection.execute(
            "SELECT grand_total FROM cst_orders WHERE id = ? FOR UPDATE",
            [existing.order_id]
        );

        if (orderRows.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Order not found." },
                { status: 404 }
            );
        }

        if (payment.payment_status === "Success") {
            const [paidRows] = await connection.execute(
                `
                SELECT COALESCE(SUM(amount), 0) AS paid_amount
                FROM cst_order_payments
                WHERE order_id = ?
    AND payment_status = 'Success'
                  AND id <> ?
    `,
                [existing.order_id, Number(id)]
            );

            const otherPaid = Number(paidRows[0].paid_amount);
            const grandTotal = Number(orderRows[0].grand_total);

            if (otherPaid + Number(payment.amount) > grandTotal + 0.001) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message: "Payment amount exceeds the remaining order balance.",
                        remaining_amount: Number(
                            Math.max(0, grandTotal - otherPaid).toFixed(2)
                        ),
                    },
                    { status: 400 }
                );
            }
        }

        await connection.execute(
            `
            UPDATE cst_order_payments
            SET amount = ?,
    payment_method = ?,
    payment_provider = ?,
    gateway_order_id = ?,
    gateway_transaction_id = ?,
    transaction_no = ?,
    payment_status = ?,
    payment_date = ?,
    notes = ?
        WHERE id = ?
            `,
            [
                Number(payment.amount),
                payment.payment_method,
                payment.payment_provider || null,
                payment.gateway_order_id || null,
                payment.gateway_transaction_id || null,
                payment.transaction_no || null,
                payment.payment_status,
                payment.payment_date || null,
                payment.notes || null,
                Number(id),
            ]
        );

        const orderPaymentStatus = await syncOrderPaymentStatus(
            connection,
            existing.order_id
        );

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Payment updated successfully.",
            id: Number(id),
            order_payment_status: orderPaymentStatus,
        });
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("PUT Order Payment Error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                {
                    success: false,
                    message: "This gateway_transaction_id already exists.",
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { success: false, message: "Failed to update payment." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}


// DELETE: Delete a payment record
export async function DELETE(request, { params }) {
    let connection;

    try {
        const { id } = await params;

        if (!validId(id)) {
            return NextResponse.json(
                { success: false, message: "Invalid payment ID." },
                { status: 400 }
            );
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.execute(
            "SELECT * FROM cst_order_payments WHERE id = ? FOR UPDATE",
            [Number(id)]
        );

        if (rows.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                { success: false, message: "Payment not found." },
                { status: 404 }
            );
        }

        const payment = rows[0];

        // Avoid deleting successful or refunded financial records.
        if (
            payment.payment_status === "Success" ||
            payment.payment_status === "Refunded"
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Successful or refunded payments cannot be deleted. Use a refund/reconciliation workflow.",
                },
                { status: 409 }
            );
        }

        await connection.execute(
            "DELETE FROM cst_order_payments WHERE id = ?",
            [Number(id)]
        );

        const orderPaymentStatus = await syncOrderPaymentStatus(
            connection,
            payment.order_id
        );

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Payment deleted successfully.",
            order_payment_status: orderPaymentStatus,
        });
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("DELETE Order Payment Error:", error);

        return NextResponse.json(
            { success: false, message: "Failed to delete payment." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
