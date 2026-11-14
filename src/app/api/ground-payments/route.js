import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";
import {
    applyGroundBookingPaymentDelta,
    getOutstandingCents,
    lockGroundBookings,
    toCents,
} from "./paymentHelpers";

async function checkBookingAccess(connection, bookingId, authUser) {
    const [rows] = await connection.query(
        `SELECT gb.id, gb.customer_phone, g.academy_id, g.branch_id
         FROM cst_ground_bookings gb
         INNER JOIN cst_ground g ON g.id = gb.ground_id
         WHERE gb.id = ? AND g.is_deleted = 0 LIMIT 1`,
        [bookingId]
    );
    if (rows.length === 0) return { allowed: false, notFound: true };
    const b = rows[0];
    if (authUser.isSuperAdmin) return { allowed: true, booking: b };
    if (authUser.isPlayer) {
        const isOwner = Boolean(b.customer_phone && authUser.phone && b.customer_phone === authUser.phone);
        return { allowed: isOwner, booking: b };
    }
    if (Number(b.academy_id) !== Number(authUser.academy_id)) return { allowed: false, booking: b };
    if (authUser.isAcademyAdmin) return { allowed: true, booking: b };
    if (authUser.isBranchAdmin) return { allowed: Number(b.branch_id) === Number(authUser.branch_id), booking: b };
    const allowedBranches = (authUser.assignedBranchIds || [authUser.branch_id]).map(Number);
    return { allowed: allowedBranches.includes(Number(b.branch_id)), booking: b };
}

// GET: Get all ground payments with filters
export async function GET(request) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    let connection;

    try {
        connection = await pool.getConnection();

        const { searchParams } = new URL(request.url);

        const booking_id = searchParams.get("booking_id");
        const booking_no = searchParams.get("booking_no");
        const payment_date = searchParams.get("payment_date");
        const payment_mode = searchParams.get("payment_mode");
        const transaction_no = searchParams.get("transaction_no");

        let sql = `
            SELECT
                gp.id,
                gp.booking_id,
                gp.payment_date,
                gp.amount,
                gp.payment_mode,
                gp.transaction_no,
                gp.remarks,
                gp.created_at,
                gb.booking_no, 
                gb.customer_name,
                g.academy_id,
                g.branch_id
            FROM cst_ground_payments gp
            INNER JOIN cst_ground_bookings gb ON gb.id = gp.booking_id
            INNER JOIN cst_ground g ON g.id = gb.ground_id
            WHERE g.is_deleted = 0
        `;

        const values = [];

        // Tenant Scoping
        if (authUser.isPlayer) {
            sql += " AND (gb.customer_phone IS NOT NULL AND gb.customer_phone = ?)";
            values.push(authUser.phone || "");
        } else if (authUser.isBranchAdmin && authUser.branch_id) {
            sql += " AND g.academy_id = ? AND g.branch_id = ?";
            values.push(authUser.academy_id, authUser.branch_id);
        } else if (authUser.isAcademyAdmin && authUser.academy_id) {
            sql += " AND g.academy_id = ?";
            values.push(authUser.academy_id);
            const branchIdParam = searchParams.get("branch_id");
            if (branchIdParam) {
                sql += " AND g.branch_id = ?";
                values.push(branchIdParam);
            }
        } else if (!authUser.isSuperAdmin && authUser.academy_id) {
            sql += " AND g.academy_id = ?";
            values.push(authUser.academy_id);
            const allowed = authUser.assignedBranchIds || [authUser.branch_id];
            sql += ` AND g.branch_id IN (${allowed.map(() => "?").join(",")})`;
            values.push(...allowed);
        } else {
            // Super Admin
            const academyIdParam = searchParams.get("academy_id");
            const branchIdParam = searchParams.get("branch_id");
            if (academyIdParam) {
                sql += " AND g.academy_id = ?";
                values.push(academyIdParam);
            }
            if (branchIdParam) {
                sql += " AND g.branch_id = ?";
                values.push(branchIdParam);
            }
        }

        if (booking_id) {
            sql += " AND gp.booking_id = ?";
            values.push(booking_id);
        }

        if (booking_no) {
            sql += " AND gb.booking_no LIKE ?";
            values.push(`%${booking_no.trim()}%`);
        }

        if (payment_date) {
            sql += " AND gp.payment_date = ?";
            values.push(payment_date);
        }

        if (payment_mode) {
            sql += " AND gp.payment_mode = ?";
            values.push(payment_mode);
        }

        if (transaction_no) {
            sql += " AND gp.transaction_no LIKE ?";
            values.push(`%${transaction_no}%`);
        }

        sql += " ORDER BY gp.id DESC";

        const [rows] = await connection.execute(sql, values);

        return NextResponse.json({
            success: true,
            message: "Ground payments fetched successfully",
            data: rows,
        });

    } catch (error) {
        console.error("GET Ground Payments Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch ground payments",
                error: error.message,
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }
}

// POST: Add new ground payment
export async function POST(request) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    if (authUser.isPlayer) {
        return NextResponse.json(
            { success: false, message: "Forbidden. Players cannot record payments." },
            { status: 403 }
        );
    }

    let connection;
    let transactionStarted = false;

    try {
        const body = await request.json();

        const {
            booking_id,
            payment_date,
            amount,
            payment_mode,
            transaction_no,
            remarks,
        } = body;

        // Required field validation
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

        // Validate payment date: YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(payment_date)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "payment_date must be in YYYY-MM-DD format",
                },
                { status: 400 }
            );
        }

        const validPaymentModes = [
            "Cash",
            "UPI",
            "Card",
            "Bank Transfer",
            "Cheque",
        ];

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

        // Verify booking access
        const access = await checkBookingAccess(connection, bookingId, authUser);
        if (!access.allowed) {
            return NextResponse.json(
                {
                    success: false,
                    message: access.notFound ? "Ground booking not found" : "Access denied for this booking",
                },
                { status: access.notFound ? 404 : 403 }
            );
        }

        await connection.beginTransaction();
        transactionStarted = true;

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

        if (toCents(paymentAmount) > getOutstandingCents(booking)) {
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

        const [result] = await connection.execute(
            `INSERT INTO cst_ground_payments
            (
                booking_id,
                payment_date,
                amount,
                payment_mode,
                transaction_no,
                remarks
            )
            VALUES(?, ?, ?, ?, ?, ?)`,
            [
                bookingId,
                payment_date,
                paymentAmount,
                payment_mode,
                transaction_no || null,
                remarks || null,
            ]
        );

        await applyGroundBookingPaymentDelta(connection, booking, toCents(paymentAmount));

        const [newPayment] = await connection.execute(
            `SELECT * FROM cst_ground_payments WHERE id = ?`,
            [result.insertId]
        );

        await connection.commit();
        transactionStarted = false;

        return NextResponse.json(
            {
                success: true,
                message: "Ground payment added successfully",
                data: newPayment[0],
            },
            { status: 201 }
        );

    } catch (error) {
        if (connection && transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error("GROUND PAYMENT ROLLBACK ERROR:", rollbackError);
            }
        }

        console.error("POST Ground Payment Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: error.message || "Failed to add ground payment",
                error: error.message,
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }
}
