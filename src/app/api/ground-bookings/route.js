import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


// =====================================================
// GET GROUND BOOKINGS
// GET /api/ground-bookings
//
// Filters:
// academy_id
// branch_id
// ground_id
// slot_id
// booking_date
// booking_status
// payment_status
// booking_no
// customer_name
// customer_phone
// page
// limit
// =====================================================


// =====================================================
// GET - ALL BOOKINGS
// =====================================================
export async function GET(request) {
    const connection = await pool.getConnection();

    try {
        const { searchParams } = new URL(request.url);

        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");
        const ground_id = searchParams.get("ground_id");
        const slot_id = searchParams.get("slot_id");
        const booking_date = searchParams.get("booking_date");
        const booking_status = searchParams.get("booking_status");
        const payment_status = searchParams.get("payment_status");
        const balance_due = searchParams.get("balance_due");
        const booking_no = searchParams.get("booking_no");
        const customer_name = searchParams.get("customer_name");
        const customer_phone = searchParams.get("customer_phone");

        const page = Math.max(parseInt(searchParams.get("page") || "1"), 1);
        const limit = Math.min(
            Math.max(parseInt(searchParams.get("limit") || "20"), 1),
            100
        );

        const offset = (page - 1) * limit;

        let where = `
            WHERE g.is_deleted = 0
        `;

        const params = [];

        // Academy filter
        if (academy_id) {
            where += ` AND g.academy_id = ?`;
            params.push(academy_id);
        }

        // Branch filter
        if (branch_id) {
            where += ` AND g.branch_id = ?`;
            params.push(branch_id);
        }

        // Ground filter
        if (ground_id) {
            where += ` AND gb.ground_id = ?`;
            params.push(ground_id);
        }

        // Slot filter
        if (slot_id) {
            where += ` AND gb.slot_id = ?`;
            params.push(slot_id);
        }

        // Booking date
        if (booking_date) {
            where += ` AND gb.booking_date = ?`;
            params.push(booking_date);
        }

        // Booking status
        if (booking_status) {
            where += ` AND gb.booking_status = ?`;
            params.push(booking_status);
        }

        // Payment status
        if (payment_status) {
            where += ` AND gb.payment_status = ?`;
            params.push(payment_status);
        }

        if (balance_due === "1" || balance_due === "true") {
            where += ` AND gb.balance_amount > 0`;
        }

        // Booking number
        if (booking_no) {
            where += ` AND gb.booking_no LIKE ?`;
            params.push(`%${booking_no}%`);
        }

        // Customer name
        if (customer_name) {
            where += ` AND gb.customer_name LIKE ?`;
            params.push(`%${customer_name}%`);
        }

        // Customer phone
        if (customer_phone) {
            where += ` AND gb.customer_phone LIKE ?`;
            params.push(`%${customer_phone}%`);
        }

        // Count
        const [countRows] = await connection.query(
            `
            SELECT COUNT(*) AS total
            FROM cst_ground_bookings gb
            INNER JOIN cst_ground g
                ON g.id = gb.ground_id
            INNER JOIN cst_ground_slots gs
                ON gs.id = gb.slot_id
            ${where}
            `,
            params
        );

        const total = countRows[0].total;

        // Data
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

            ${where}

            ORDER BY gb.id DESC

            LIMIT ? OFFSET ?
            `,
            [...params, limit, offset]
        );

        return NextResponse.json({
            success: true,
            message: "Ground bookings fetched successfully",
            data: rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("GET GROUND BOOKINGS ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch ground bookings",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        connection.release();
    }
}


// =====================================================
// POST - CREATE BOOKING
// =====================================================
export async function POST(request) {
    const connection = await pool.getConnection();

    try {
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

        if (!purpose) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Purpose is required"
                },
                { status: 400 }
            );
        }

        const totalAmount = Number(total_amount);
        const paidAmount = Number(paid_amount);

        if (totalAmount < 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Total amount cannot be negative"
                },
                { status: 400 }
            );
        }

        if (paidAmount < 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Paid amount cannot be negative"
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

        // ==========================================
        // START TRANSACTION
        // ==========================================

        await connection.beginTransaction();

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
                gs.id,
                gs.ground_id,
                gs.status
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
        // CHECK DUPLICATE BOOKING
        // ==========================================

        const [duplicateRows] = await connection.query(
            `
            SELECT id, booking_no
            FROM cst_ground_bookings
            WHERE ground_id = ?
            AND slot_id = ?
            AND booking_date = ?
            AND booking_status IN ('Booked', 'Confirmed')
            LIMIT 1
            `,
            [
                ground_id,
                slot_id,
                booking_date
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
        // MATCH VALIDATION
        // ==========================================

        if (match_id) {
            const [matchRows] = await connection.query(
                `
                SELECT id
                FROM cst_matches
                WHERE id = ?
                AND academy_id = ?
                AND branch_id = ?
                LIMIT 1
                `,
                [
                    match_id,
                    academy_id,
                    branch_id
                ]
            );

            if (matchRows.length === 0) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid match for selected academy/branch"
                    },
                    { status: 400 }
                );
            }
        }

        // ==========================================
        // TOURNAMENT VALIDATION
        // ==========================================

        if (tournament_id) {
            const [tournamentRows] = await connection.query(
                `
                SELECT id
                FROM cst_tournaments
                WHERE id = ?
                AND academy_id = ?
                AND branch_id = ?
                LIMIT 1
                `,
                [
                    tournament_id,
                    academy_id,
                    branch_id
                ]
            );

            if (tournamentRows.length === 0) {
                await connection.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid tournament for selected academy/branch"
                    },
                    { status: 400 }
                );
            }
        }

        // ==========================================
        // BOOKING NUMBER
        // ==========================================

        const year = new Date().getFullYear();

        const bookingNo = `GB-${year}-${Date.now()}`;

        // ==========================================
        // INSERT BOOKING
        // ==========================================

        const [bookingResult] = await connection.query(
            `
            INSERT INTO cst_ground_bookings
            (
                booking_no,

                ground_id,
                slot_id,

                match_id,
                tournament_id,

                customer_name,
                customer_phone,
                customer_email,

                booking_date,
                purpose,

                total_amount,
                paid_amount,
                balance_amount,

                payment_status,
                booking_status,

                remarks
            )
            VALUES
            (
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                'Booked',
                ?
            )
            `,
            [
                bookingNo,

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

                remarks
            ]
        );

        const bookingId = bookingResult.insertId;

        // ==========================================
        // INSERT PAYMENT
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
                    bookingId,
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

        return NextResponse.json(
            {
                success: true,
                message: "Ground booking created successfully",
                data: {
                    id: bookingId,
                    booking_no: bookingNo,
                    academy_id: Number(academy_id),
                    branch_id: Number(branch_id),
                    ground_id: Number(ground_id),
                    slot_id: Number(slot_id),
                    total_amount: totalAmount,
                    paid_amount: paidAmount,
                    balance_amount: balanceAmount,
                    payment_status: paymentStatus,
                    booking_status: "Booked"
                }
            },
            { status: 201 }
        );

    } catch (error) {

        await connection.rollback();

        console.error("POST GROUND BOOKING ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to create ground booking",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        connection.release();
    }
}