import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";

export async function GET(request, { params }) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    let connection;

    try {
        connection = await pool.getConnection();

        const [rows] = await connection.query(
            `SELECT
                up.*,
                u.umpire_name,
                u.mobile AS umpire_mobile,
                m.match_no,
                gb.booking_no,
                a.academy_name,
                b.branch_name
             FROM cst_umpire_payments up
             INNER JOIN cst_umpires u ON u.id = up.umpire_id
             LEFT JOIN cst_matches m ON m.id = up.match_id
             LEFT JOIN cst_ground_bookings gb ON gb.id = up.booking_id
             LEFT JOIN cst_academy a ON a.id = up.academy_id
             LEFT JOIN cst_branch b ON b.id = up.branch_id
             WHERE up.id = ? LIMIT 1`,
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
        console.error("GET /api/umpire-payments/[id] error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Failed to load payment record." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

export async function DELETE(request, { params }) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    let connection;

    try {
        connection = await pool.getConnection();

        const [rows] = await connection.query(
            "SELECT * FROM cst_umpire_payments WHERE id = ? LIMIT 1",
            [id]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Payment record not found." },
                { status: 404 }
            );
        }

        const payment = rows[0];

        await connection.beginTransaction();

        await connection.query("DELETE FROM cst_umpire_payments WHERE id = ?", [id]);

        // Recompute match payment status
        if (payment.match_id) {
            const [sumRows] = await connection.query(
                `SELECT SUM(amount) AS total_paid
                 FROM cst_umpire_payments
                 WHERE umpire_id = ? AND (match_id = ? OR (booking_id IS NOT NULL AND booking_id = ?))`,
                [payment.umpire_id, payment.match_id, payment.booking_id || 0]
            );

            const [feeRows] = await connection.query(
                `SELECT fee_amount FROM cst_match_umpires WHERE match_id = ? AND umpire_id = ? LIMIT 1`,
                [payment.match_id, payment.umpire_id]
            );

            const fee = feeRows.length > 0 ? Number(feeRows[0].fee_amount || 0) : 0;
            const totalPaid = Number(sumRows[0]?.total_paid || 0);
            const newStatus = totalPaid >= fee && fee > 0 ? "Paid" : totalPaid > 0 ? "Partial" : "Pending";

            await connection.query(
                `UPDATE cst_match_umpires SET payment_status = ? WHERE match_id = ? AND umpire_id = ?`,
                [newStatus, payment.match_id, payment.umpire_id]
            );
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: "Umpire payment deleted successfully.",
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("DELETE /api/umpire-payments/[id] error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Failed to delete payment." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
