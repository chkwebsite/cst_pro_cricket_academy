import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";

function isValidDate(date) {
    if (typeof date !== "string") return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsedDate = new Date(`${date}T00:00:00.000Z`);
    return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === date;
}

function isValidAmount(value) {
    return (
        value !== null &&
        value !== undefined &&
        value !== "" &&
        Number.isFinite(Number(value)) &&
        Number(value) >= 0
    );
}

function calculateFeeAmounts({
    fee_amount,
    registration_fee = 0,
    daily_fee = 0,
    kit_fee = 0,
    discount_amount = 0,
    late_fee = 0
}) {
    const fee = Number(fee_amount);
    const registration = Number(registration_fee);
    const daily = Number(daily_fee);
    const kit = Number(kit_fee);
    const discount = Number(discount_amount);
    const late = Number(late_fee);

    const subtotal = fee + registration + daily + kit;
    if (discount > subtotal) return null;

    const total = subtotal - discount + late;
    return {
        fee_amount: fee,
        registration_fee: registration,
        daily_fee: daily,
        kit_fee: kit,
        discount_amount: discount,
        late_fee: late,
        total_amount: Number(total.toFixed(2))
    };
}

// ============================================
// GET: Single Monthly Fee
// ============================================
export async function GET(request, context) {
    let connection;

    try {
        const params = await context?.params;
        const { searchParams } = new URL(request.url);
        const id = params?.id || searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { success: false, message: "Fee id is required." },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [rows] = await connection.query(
            `
            SELECT
                f.id,
                f.academy_id,
                f.branch_id,
                f.user_program_id,
                f.admission_players_id,
                f.program_id,
                f.fee_month,
                DATE_FORMAT(f.fee_month, '%M %Y') AS fee_month_name,
                f.fee_amount,
                f.registration_fee,
                f.daily_fee,
                f.kit_fee,
                f.discount_amount,
                f.late_fee,
                f.total_amount,
                f.paid_amount,
                f.due_amount,
                f.payment_status,
                f.due_date,
                f.remarks,
                f.created_at,
                f.updated_at,
                ap.admission_no,
                CONCAT_WS(' ', ap.first_name, ap.last_name) AS player_name,
                p.program_name,
                up.appointment_no,
                up.start_date,
                up.end_date,
                a.academy_name,
                b.branch_name
            FROM cst_player_program_fees f
            INNER JOIN cst_user_programs up ON up.id = f.user_program_id
            INNER JOIN cst_admission_players ap ON ap.id = f.admission_players_id
            INNER JOIN cst_programs p ON p.id = f.program_id
            LEFT JOIN cst_academy a ON a.id = f.academy_id
            LEFT JOIN cst_branch b ON b.id = f.branch_id
            WHERE f.id = ?
            LIMIT 1
            `,
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Monthly fee record not found." },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("GET Monthly Fee Error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch monthly fee.", error: error.message },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

// ============================================
// PUT: Update Monthly Fee
// ============================================
export async function PUT(request, context) {
    let connection;

    try {
        const params = await context?.params;
        const body = await request.json();

        const id = body.id || params?.id;
        const {
            fee_amount,
            registration_fee,
            daily_fee,
            kit_fee,
            discount_amount,
            late_fee,
            payment_status,
            due_date,
            remarks
        } = body;

        if (!id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Fee id is required."
                },
                { status: 400 }
            );
        }

        const allowedStatuses = [
            "Pending",
            "Partial",
            "Paid",
            "Cancelled"
        ];

        if (
            payment_status !== undefined &&
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

        if (
            due_date !== undefined &&
            due_date !== null &&
            !isValidDate(due_date)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid due_date. Use YYYY-MM-DD."
                },
                { status: 400 }
            );
        }

        const amountFields = {
            fee_amount,
            registration_fee,
            daily_fee,
            kit_fee,
            discount_amount,
            late_fee
        };

        for (const [key, value] of Object.entries(amountFields)) {
            if (value !== undefined && !isValidAmount(value)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `${key} must be a valid non-negative amount.`
                    },
                    { status: 400 }
                );
            }
        }

        connection = await pool.getConnection();

        await connection.beginTransaction();

        const [fees] = await connection.query(
            `
            SELECT *
            FROM cst_player_program_fees
            WHERE id = ?
            FOR UPDATE
            `,
            [id]
        );

        if (fees.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Monthly fee record not found."
                },
                { status: 404 }
            );
        }

        const current = fees[0];

        const calculated = calculateFeeAmounts({
            fee_amount: fee_amount ?? current.fee_amount,
            registration_fee: registration_fee ?? current.registration_fee,
            daily_fee: daily_fee ?? current.daily_fee,
            kit_fee: kit_fee ?? current.kit_fee,
            discount_amount: discount_amount ?? current.discount_amount,
            late_fee: late_fee ?? current.late_fee
        });

        if (!calculated) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Discount cannot exceed the subtotal."
                },
                { status: 400 }
            );
        }

        const paidAmount = Number(current.paid_amount);

        if (paidAmount > calculated.total_amount) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Total fee cannot be reduced below the amount already paid."
                },
                { status: 400 }
            );
        }

        const dueAmount = Number(
            (calculated.total_amount - paidAmount).toFixed(2)
        );

        let newStatus = payment_status ?? current.payment_status;

        if (newStatus !== "Cancelled") {
            if (dueAmount === 0) {
                newStatus = "Paid";
            } else if (paidAmount > 0) {
                newStatus = "Partial";
            } else {
                newStatus = "Pending";
            }
        }

        await connection.query(
            `
            UPDATE cst_player_program_fees
            SET
                fee_amount = ?,
                registration_fee = ?,
                daily_fee = ?,
                kit_fee = ?,
                discount_amount = ?,
                late_fee = ?,
                total_amount = ?,
                due_amount = ?,
                payment_status = ?,
                due_date = ?,
                remarks = ?
            WHERE id = ?
            `,
            [
                calculated.fee_amount,
                calculated.registration_fee,
                calculated.daily_fee,
                calculated.kit_fee,
                calculated.discount_amount,
                calculated.late_fee,
                calculated.total_amount,
                dueAmount,
                newStatus,
                due_date === undefined ? current.due_date : due_date,
                remarks === undefined ? current.remarks : remarks,
                id
            ]
        );

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Monthly fee updated successfully.",
            data: {
                id: Number(id),
                ...calculated,
                paid_amount: paidAmount,
                due_amount: dueAmount,
                payment_status: newStatus,
                due_date: due_date === undefined ? current.due_date : due_date,
                remarks: remarks === undefined ? current.remarks : remarks
            }
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("PUT Monthly Fees Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update monthly fee."
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }
}

// ============================================
// DELETE: Delete Fee (only if no payment exists)
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
                    message: "Fee id is required."
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        await connection.beginTransaction();

        const [fees] = await connection.query(
            `
            SELECT id, paid_amount
            FROM cst_player_program_fees
            WHERE id = ?
            FOR UPDATE
            `,
            [id]
        );

        if (fees.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Monthly fee record not found."
                },
                { status: 404 }
            );
        }

        if (Number(fees[0].paid_amount) > 0) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Fee cannot be deleted because payment has been recorded."
                },
                { status: 409 }
            );
        }

        const [payments] = await connection.query(
            `
            SELECT id
            FROM cst_player_payments
            WHERE player_program_fee_id = ?
            LIMIT 1
            `,
            [id]
        );

        if (payments.length > 0) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Fee cannot be deleted because payment history exists."
                },
                { status: 409 }
            );
        }

        await connection.query(
            `
            DELETE FROM cst_player_program_fees
            WHERE id = ?
            `,
            [id]
        );

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Monthly fee deleted successfully."
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("DELETE Monthly Fees Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete monthly fee."
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }
}
