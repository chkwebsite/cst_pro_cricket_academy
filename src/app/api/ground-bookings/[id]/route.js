import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";





// =====================================================
// GET SINGLE BOOKING
// =====================================================
export async function GET(request, { params }) {

    const connection = await pool.getConnection();

    try {

        const { id } = await params;

        const { searchParams } = new URL(request.url);

        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");

        if (!academy_id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Academy ID is required"
                },
                { status: 400 }
            );
        }

        if (!branch_id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Branch ID is required"
                },
                { status: 400 }
            );
        }

        // ==========================================
        // BOOKING
        // ==========================================

        const [rows] = await connection.query(
            `
            SELECT
                gb.id,
                gb.booking_no,

                gb.ground_id,
                g.ground_name,
                g.ground_code,

                g.academy_id,
                g.branch_id,

                gb.slot_id,
                gs.slot_name,
                gs.start_time,
                gs.end_time,

                gb.match_id,
                gb.tournament_id,

                gb.customer_name,
                gb.customer_phone,
                gb.customer_email,

                gb.booking_date,
                gb.purpose,

                gb.total_amount,
                gb.paid_amount,
                gb.balance_amount,

                gb.payment_status,
                gb.booking_status,

                gb.remarks,

                gb.created_at,
                gb.updated_at

            FROM cst_ground_bookings gb

            INNER JOIN cst_ground g
                ON g.id = gb.ground_id

            INNER JOIN cst_ground_slots gs
                ON gs.id = gb.slot_id

            WHERE gb.id = ?
            AND g.academy_id = ?
            AND g.branch_id = ?
            AND g.is_deleted = 0

            LIMIT 1
            `,
            [
                id,
                academy_id,
                branch_id
            ]
        );

        if (rows.length === 0) {

            return NextResponse.json(
                {
                    success: false,
                    message: "Booking not found"
                },
                { status: 404 }
            );
        }

        // ==========================================
        // PAYMENTS
        // ==========================================

        const [payments] = await connection.query(
            `
            SELECT
                id,
                booking_id,
                payment_date,
                amount,
                payment_mode,
                transaction_no,
                remarks,
                created_at

            FROM cst_ground_payments

            WHERE booking_id = ?

            ORDER BY id DESC
            `,
            [id]
        );

        return NextResponse.json({
            success: true,
            message: "Ground booking fetched successfully",
            data: {
                ...rows[0],
                payments
            }
        });

    } catch (error) {

        console.error("GET SINGLE BOOKING ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch booking",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        connection.release();
    }
}


// =====================================================
// PUT - UPDATE BOOKING
// =====================================================
export async function PUT(request, { params }) {

    const connection = await pool.getConnection();

    try {

        const { id } = await params;

        const body = await request.json();

        const {
            academy_id,
            branch_id,

            ground_id,
            slot_id,

            match_id = null,
            tournament_id = null,

            customer_name,
            customer_phone = null,
            customer_email = null,

            booking_date,

            purpose = "Practice",

            total_amount = 0,
            paid_amount = 0,

            payment_mode = null,
            transaction_no = null,

            booking_status = "Booked",

            remarks = null
        } = body;

        // ==========================================
        // VALIDATION
        // ==========================================

        if (!academy_id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Academy ID is required"
                },
                { status: 400 }
            );
        }

        if (!branch_id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Branch ID is required"
                },
                { status: 400 }
            );
        }

        if (!ground_id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Ground ID is required"
                },
                { status: 400 }
            );
        }

        if (!slot_id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Slot ID is required"
                },
                { status: 400 }
            );
        }

        if (!customer_name) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Customer name is required"
                },
                { status: 400 }
            );
        }

        if (!booking_date) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Booking date is required"
                },
                { status: 400 }
            );
        }

        const totalAmount = Number(total_amount);
        const paidAmount = Number(paid_amount);

        if (totalAmount < 0 || paidAmount < 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Amount cannot be negative"
                },
                { status: 400 }
            );
        }

        if (paidAmount > totalAmount) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Paid amount cannot be greater than total amount"
                },
                { status: 400 }
            );
        }

        if (paidAmount > 0 && !payment_mode) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Payment mode is required when paid amount is greater than 0"
                },
                { status: 400 }
            );
        }

        // ==========================================
        // PAYMENT STATUS
        // ==========================================

        let paymentStatus = "Pending";

        if (totalAmount > 0 && paidAmount === totalAmount) {
            paymentStatus = "Paid";
        } else if (paidAmount > 0 && paidAmount < totalAmount) {
            paymentStatus = "Partial";
        }

        const balanceAmount = totalAmount - paidAmount;

        await connection.beginTransaction();

        // ==========================================
        // CHECK EXISTING BOOKING
        // ==========================================

        const [existingRows] = await connection.query(
            `
            SELECT
                gb.id,
                gb.ground_id,
                gb.slot_id,
                gb.booking_date
            FROM cst_ground_bookings gb

            INNER JOIN cst_ground g
                ON g.id = gb.ground_id

            WHERE gb.id = ?
            AND g.academy_id = ?
            AND g.branch_id = ?
            AND g.is_deleted = 0

            LIMIT 1
            `,
            [
                id,
                academy_id,
                branch_id
            ]
        );

        if (existingRows.length === 0) {

            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Booking not found or access denied"
                },
                { status: 404 }
            );
        }

        // ==========================================
        // CHECK GROUND
        // ==========================================

        const [groundRows] = await connection.query(
            `
            SELECT
                id,
                academy_id,
                branch_id,
                status,
                is_deleted

            FROM cst_ground

            WHERE id = ?
            AND academy_id = ?
            AND branch_id = ?
            AND is_deleted = 0

            LIMIT 1
            `,
            [
                ground_id,
                academy_id,
                branch_id
            ]
        );

        if (groundRows.length === 0) {

            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Ground does not belong to selected academy/branch"
                },
                { status: 400 }
            );
        }

        if (groundRows[0].status !== 1) {

            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Ground is inactive"
                },
                { status: 400 }
            );
        }

        // ==========================================
        // CHECK SLOT
        // ==========================================

        const [slotRows] = await connection.query(
            `
            SELECT
                gs.id

            FROM cst_ground_slots gs

            INNER JOIN cst_ground g
                ON g.id = gs.ground_id

            WHERE gs.id = ?
            AND gs.ground_id = ?
            AND g.academy_id = ?
            AND g.branch_id = ?
            AND g.is_deleted = 0
            AND gs.status = 1

            LIMIT 1
            `,
            [
                slot_id,
                ground_id,
                academy_id,
                branch_id
            ]
        );

        if (slotRows.length === 0) {

            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid slot for selected ground"
                },
                { status: 400 }
            );
        }

        // ==========================================
        // DUPLICATE BOOKING
        // ==========================================

        const [duplicateRows] = await connection.query(
            `
            SELECT id, booking_no

            FROM cst_ground_bookings

            WHERE ground_id = ?
            AND slot_id = ?
            AND booking_date = ?

            AND booking_status IN ('Booked', 'Confirmed')

            AND id != ?

            LIMIT 1
            `,
            [
                ground_id,
                slot_id,
                booking_date,
                id
            ]
        );

        if (duplicateRows.length > 0) {

            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "This ground slot is already booked for selected date",
                    booking_no: duplicateRows[0].booking_no
                },
                { status: 409 }
            );
        }

        // ==========================================
        // UPDATE BOOKING
        // ==========================================

        await connection.query(
            `
            UPDATE cst_ground_bookings

            SET
                ground_id = ?,
                slot_id = ?,

                match_id = ?,
                tournament_id = ?,

                customer_name = ?,
                customer_phone = ?,
                customer_email = ?,

                booking_date = ?,
                purpose = ?,

                total_amount = ?,
                paid_amount = ?,
                balance_amount = ?,

                payment_status = ?,
                booking_status = ?,

                remarks = ?

            WHERE id = ?
            `,
            [
                ground_id,
                slot_id,

                match_id,
                tournament_id,

                customer_name,
                customer_phone,
                customer_email,

                booking_date,
                purpose,

                totalAmount,
                paidAmount,
                balanceAmount,

                paymentStatus,
                booking_status,

                remarks,

                id
            ]
        );

        // ==========================================
        // DELETE OLD PAYMENTS
        // ==========================================

        await connection.query(
            `
            DELETE FROM cst_ground_payments
            WHERE booking_id = ?
            `,
            [id]
        );

        // ==========================================
        // INSERT NEW PAYMENT
        // ==========================================

        if (paidAmount > 0) {

            await connection.query(
                `
                INSERT INTO cst_ground_payments
                (
                    booking_id,
                    payment_date,
                    amount,
                    payment_mode,
                    transaction_no,
                    remarks
                )

                VALUES
                (
                    ?,
                    CURDATE(),
                    ?,
                    ?,
                    ?,
                    ?
                )
                `,
                [
                    id,
                    paidAmount,
                    payment_mode,
                    transaction_no,
                    remarks
                ]
            );
        }

        // ==========================================
        // COMMIT
        // ==========================================

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Ground booking updated successfully",
            data: {
                id: Number(id),
                academy_id: Number(academy_id),
                branch_id: Number(branch_id),
                ground_id: Number(ground_id),
                slot_id: Number(slot_id),
                total_amount: totalAmount,
                paid_amount: paidAmount,
                balance_amount: balanceAmount,
                payment_status: paymentStatus,
                booking_status
            }
        });

    } catch (error) {

        await connection.rollback();

        console.error("PUT GROUND BOOKING ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update ground booking",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        connection.release();
    }
}


// =====================================================
// DELETE - DELETE BOOKING
// =====================================================
export async function DELETE(request, { params }) {

    const connection = await pool.getConnection();

    try {

        const { id } = await params;

        const { searchParams } = new URL(request.url);

        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");

        if (!academy_id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Academy ID is required"
                },
                { status: 400 }
            );
        }

        if (!branch_id) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Branch ID is required"
                },
                { status: 400 }
            );
        }

        // ==========================================
        // CHECK BOOKING ACCESS
        // ==========================================

        const [rows] = await connection.query(
            `
            SELECT gb.id

            FROM cst_ground_bookings gb

            INNER JOIN cst_ground g
                ON g.id = gb.ground_id

            WHERE gb.id = ?
            AND g.academy_id = ?
            AND g.branch_id = ?
            AND g.is_deleted = 0

            LIMIT 1
            `,
            [
                id,
                academy_id,
                branch_id
            ]
        );

        if (rows.length === 0) {

            return NextResponse.json(
                {
                    success: false,
                    message: "Booking not found or access denied"
                },
                { status: 404 }
            );
        }

        // ==========================================
        // DELETE BOOKING
        // ==========================================

        await connection.query(
            `
            DELETE FROM cst_ground_bookings
            WHERE id = ?
            `,
            [id]
        );

        return NextResponse.json({
            success: true,
            message: "Ground booking deleted successfully"
        });

    } catch (error) {

        console.error("DELETE GROUND BOOKING ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete ground booking",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        connection.release();
    }
}