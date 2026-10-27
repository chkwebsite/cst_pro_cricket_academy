import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import {
    applyGroundBookingPaymentDelta,
    getOutstandingCents,
    lockGroundBookings,
    toCents,
} from "../paymentHelpers";


const validPaymentModes = [
    "Cash",
    "UPI",
    "Card",
    "Bank Transfer",
    "Cheque",
];

// GET: Get single ground payment
export async function GET(request, { params }) {
    let connection;


    try {
        const { id } = await params;
        const paymentId = Number(id);

        if (!Number.isInteger(paymentId) || paymentId <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid payment ID",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [rows] = await connection.execute(
            `SELECT *
        FROM cst_ground_payments
         WHERE id = ?
        LIMIT 1`,
            [paymentId]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Ground payment not found",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Ground payment fetched successfully",
            data: rows[0],
        });

    } catch (error) {
        console.error("GET Ground Payment Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch ground payment",
                error: error.message,
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }


}

// PUT: Update ground payment
export async function PUT(request, { params }) {
    let connection;
    let transactionStarted = false;


    try {
        const { id } = await params;
        const paymentId = Number(id);

        if (!Number.isInteger(paymentId) || paymentId <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid payment ID",
                },
                { status: 400 }
            );
        }

        const body = await request.json();

        const {
            booking_id,
            payment_date,
            amount,
            payment_mode,
            transaction_no,
            remarks,
        } = body;

        if (
            booking_id === undefined ||
            booking_id === null ||
            booking_id === "" ||
            !payment_date ||
            amount === undefined ||
            amount === null ||
            amount === "" ||
            !payment_mode
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "booking_id, payment_date, amount and payment_mode are required",
                },
                { status: 400 }
            );
        }

        const bookingId = Number(booking_id);
        const paymentAmount = Number(amount);

        if (!Number.isInteger(bookingId) || bookingId <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid booking_id",
                },
                { status: 400 }
            );
        }

        if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Payment amount must be greater than zero",
                },
                { status: 400 }
            );
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(payment_date)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "payment_date must be in YYYY-MM-DD format",
                },
                { status: 400 }
            );
        }

        if (!validPaymentModes.includes(payment_mode)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid payment_mode",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        const [existingPayments] = await connection.execute(
            `SELECT id, booking_id, amount
         FROM cst_ground_payments
         WHERE id = ?
        LIMIT 1
        FOR UPDATE`,
            [paymentId]
        );

        if (existingPayments.length === 0) {
            await connection.rollback();
            transactionStarted = false;
            return NextResponse.json(
                {
                    success: false,
                    message: "Ground payment not found",
                },
                { status: 404 }
            );
        }

        const existingPayment = existingPayments[0];
        const previousBookingId = Number(existingPayment.booking_id);
        const bookings = await lockGroundBookings(connection, [previousBookingId, bookingId]);
        const previousBooking = bookings.get(previousBookingId);
        const targetBooking = bookings.get(bookingId);

        if (!previousBooking || !targetBooking) {
            await connection.rollback();
            transactionStarted = false;
            return NextResponse.json(
                {
                    success: false,
                    message: "Ground booking not found",
                },
                { status: 404 }
            );
        }

        const previousAmountCents = toCents(existingPayment.amount);
        const availableCents = getOutstandingCents(targetBooking) +
            (previousBookingId === bookingId ? previousAmountCents : 0);

        if (toCents(paymentAmount) > availableCents) {
            await connection.rollback();
            transactionStarted = false;
            return NextResponse.json(
                {
                    success: false,
                    message: "Payment amount cannot exceed the booking balance",
                },
                { status: 400 }
            );
        }

        await connection.execute(
            `UPDATE cst_ground_payments
    SET
    booking_id = ?,
        payment_date = ?,
        amount = ?,
        payment_mode = ?,
        transaction_no = ?,
        remarks = ?
            WHERE id = ? `,
            [
                bookingId,
                payment_date,
                paymentAmount,
                payment_mode,
                transaction_no || null,
                remarks || null,
                paymentId,
            ]
        );

        if (previousBookingId === bookingId) {
            await applyGroundBookingPaymentDelta(
                connection,
                previousBooking,
                toCents(paymentAmount) - previousAmountCents
            );
        } else {
            await applyGroundBookingPaymentDelta(connection, previousBooking, -previousAmountCents);
            await applyGroundBookingPaymentDelta(connection, targetBooking, toCents(paymentAmount));
        }

        const [updatedPayments] = await connection.execute(
            `SELECT *
        FROM cst_ground_payments
         WHERE id = ? `,
            [paymentId]
        );

        await connection.commit();
        transactionStarted = false;

        return NextResponse.json({
            success: true,
            message: "Ground payment updated successfully",
            data: updatedPayments[0],
        });

    } catch (error) {
        if (connection && transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error("GROUND PAYMENT ROLLBACK ERROR:", rollbackError);
            }
        }

        console.error("PUT Ground Payment Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update ground payment",
                error: error.message,
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }


}

// DELETE: Delete ground payment
export async function DELETE(request, { params }) {
    let connection;
    let transactionStarted = false;


    try {
        const { id } = await params;
        const paymentId = Number(id);

        if (!Number.isInteger(paymentId) || paymentId <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid payment ID",
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        await connection.beginTransaction();
        transactionStarted = true;

        const [existingPayments] = await connection.execute(
            `SELECT id, booking_id, amount
         FROM cst_ground_payments
         WHERE id = ?
        LIMIT 1
        FOR UPDATE`,
            [paymentId]
        );

        if (existingPayments.length === 0) {
            await connection.rollback();
            transactionStarted = false;
            return NextResponse.json(
                {
                    success: false,
                    message: "Ground payment not found",
                },
                { status: 404 }
            );
        }

        const payment = existingPayments[0];
        const bookingId = Number(payment.booking_id);
        const bookings = await lockGroundBookings(connection, [bookingId]);
        const booking = bookings.get(bookingId);

        if (!booking) {
            await connection.rollback();
            transactionStarted = false;
            return NextResponse.json(
                {
                    success: false,
                    message: "Ground booking not found",
                },
                { status: 404 }
            );
        }

        await connection.execute(
            `DELETE FROM cst_ground_payments
         WHERE id = ? `,
            [paymentId]
        );

        await applyGroundBookingPaymentDelta(connection, booking, -toCents(payment.amount));
        await connection.commit();
        transactionStarted = false;

        return NextResponse.json({
            success: true,
            message: "Ground payment deleted successfully",
        });

    } catch (error) {
        if (connection && transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error("GROUND PAYMENT ROLLBACK ERROR:", rollbackError);
            }
        }

        console.error("DELETE Ground Payment Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete ground payment",
                error: error.message,
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }


}
