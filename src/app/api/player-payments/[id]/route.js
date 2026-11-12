import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { syncOnPaymentRecorded } from "@/app/components/lib/playerFlowSync.js";

// ============================================
// GET: Single Payment
// ============================================
export async function GET(request, context) {
    let connection;

    try {
        const params = await context?.params;
        const { searchParams } = new URL(request.url);
        const id = params?.id || searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Payment id is required." },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [rows] = await connection.query(
            `
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
                DATE_FORMAT(f.fee_month, '%M %Y') AS fee_month_name,
                f.total_amount AS invoice_amount,
                f.paid_amount AS invoice_paid_amount,
                f.due_amount AS invoice_due_amount,
                f.payment_status AS invoice_status,

                ap.admission_no,
                CONCAT_WS(' ', ap.first_name, ap.last_name) AS player_name,
                ap.phone AS player_phone,
                ap.email AS player_email,

                p.program_name,

                a.academy_name,
                b.branch_name,

                CONCAT_WS(' ', receiver.first_name, receiver.last_name) AS received_by_name

            FROM cst_player_payments pay
            INNER JOIN cst_player_program_fees f ON f.id = pay.player_program_fee_id
            INNER JOIN cst_admission_players ap ON ap.id = f.admission_players_id
            INNER JOIN cst_programs p ON p.id = f.program_id
            LEFT JOIN cst_academy a ON a.id = f.academy_id
            LEFT JOIN cst_branch b ON b.id = f.branch_id
            LEFT JOIN cst_users receiver ON receiver.id = pay.received_by
            WHERE pay.id = ?
            LIMIT 1
            `,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Payment record not found." },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("GET Payment Error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch payment.", error: error.message },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// ============================================
// PUT: Update Payment
// ============================================
export async function PUT(request, context) {
    let connection;

    try {
        const params = await context?.params;
        const body = await request.json();

        const id = body.id || params?.id;
        const {
            paid_amount,
            payment_mode,
            transaction_no,
            payment_date,
            payment_status,
            remarks
        } = body;

        if (!id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Payment id is required."
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

        if (
            payment_mode !== undefined &&
            !allowedModes.includes(payment_mode)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid payment_mode."
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        await connection.beginTransaction();

        const [payments] = await connection.query(
            `
            SELECT *
            FROM cst_player_payments
            WHERE id = ?
            FOR UPDATE
            `,
            [id]
        );

        if (payments.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Payment record not found."
                },
                { status: 404 }
            );
        }

        const updates = [];
        const values = [];

        if (paid_amount !== undefined) {
            updates.push("paid_amount = ?");
            values.push(Number(paid_amount));
        }

        if (payment_mode !== undefined) {
            updates.push("payment_mode = ?");
            values.push(payment_mode);
        }

        if (payment_status !== undefined) {
            updates.push("payment_status = ?");
            values.push(payment_status);
        }

        if (transaction_no !== undefined) {
            updates.push("transaction_no = ?");
            values.push(transaction_no || null);
        }

        if (payment_date !== undefined) {
            updates.push("payment_date = ?");
            values.push(payment_date);
        }

        if (remarks !== undefined) {
            updates.push("remarks = ?");
            values.push(remarks || null);
        }

        if (updates.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "No editable fields provided."
                },
                { status: 400 }
            );
        }

        values.push(id);

        await connection.query(
            `
            UPDATE cst_player_payments
            SET ${updates.join(", ")}
            WHERE id = ?
            `,
            values
        );

        // Recalculate fee and update attendance
        const paymentRow = payments[0];
        try {
            await syncOnPaymentRecorded({
                connection,
                playerProgramFeeId: paymentRow.player_program_fee_id,
                paidAmount: paid_amount !== undefined ? Number(paid_amount) : Number(paymentRow.paid_amount),
                paymentDate: payment_date !== undefined ? payment_date : paymentRow.payment_date,
                paymentMode: payment_mode !== undefined ? payment_mode : paymentRow.payment_mode,
                receiptNo: paymentRow.receipt_no,
                paymentStatus: payment_status !== undefined ? payment_status : paymentRow.payment_status,
                remarks: remarks !== undefined ? remarks : paymentRow.remarks,
            });
        } catch (syncErr) {
            console.error("PAYMENT UPDATE FLOW SYNC ERROR:", syncErr);
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Payment details updated successfully."
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("PUT Payment Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update payment.",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }
}

// ============================================
// DELETE: Delete Payment (only Failed)
// ============================================
export async function DELETE(request, context) {
    let connection;

    try {
        const params = await context?.params;
        const { searchParams } = new URL(request.url);

        const id = searchParams.get("id") || params?.id;

        if (!id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Payment id is required."
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        await connection.beginTransaction();

        const [payments] = await connection.query(
            `
            SELECT *
            FROM cst_player_payments
            WHERE id = ?
            FOR UPDATE
            `,
            [id]
        );

        if (payments.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Payment record not found."
                },
                { status: 404 }
            );
        }

        const payment = payments[0];

        if (payment.payment_status !== "Failed") {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Only failed payments can be deleted. Successful or refunded payments must be handled through an auditable reversal/refund workflow."
                },
                { status: 409 }
            );
        }

        await connection.query(
            `
            DELETE FROM cst_player_payments
            WHERE id = ?
            `,
            [id]
        );

        // Recalculate fee invoice
        try {
            await syncOnPaymentRecorded({
                connection,
                playerProgramFeeId: payment.player_program_fee_id,
            });
        } catch (syncErr) {
            console.error("PAYMENT DELETE FLOW SYNC ERROR:", syncErr);
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Failed payment record deleted successfully."
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("DELETE Payment Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete payment.",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }
}
