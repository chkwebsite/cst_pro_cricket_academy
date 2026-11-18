import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";

export async function GET(request) {
    let connection;

    try {
        const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
        if (errorResponse) return errorResponse;

        connection = await pool.getConnection();

        // Resolve Umpire ID
        let umpireId = authUser.umpire_id || null;
        if (!umpireId) {
            const [uRows] = await connection.query(
                "SELECT id FROM cst_umpires WHERE user_id = ? AND is_deleted = 0 LIMIT 1",
                [authUser.id]
            );
            if (uRows.length > 0) umpireId = uRows[0].id;
        }

        if (!umpireId) {
            return NextResponse.json(
                { success: false, message: "No active umpire profile associated with this account." },
                { status: 404 }
            );
        }

        // 1. Fetch Umpire Profile
        const [profileRows] = await connection.query(
            `SELECT
                u.id,
                u.user_id,
                u.umpire_name,
                u.email,
                u.mobile,
                u.alternate_mobile,
                u.experience_years,
                u.qualification,
                u.address,
                u.status,
                a.academy_name,
                b.branch_name
             FROM cst_umpires u
             LEFT JOIN cst_academy a ON a.id = u.academy_id
             LEFT JOIN cst_branch b ON b.id = u.branch_id
             WHERE u.id = ? AND u.is_deleted = 0
             LIMIT 1`,
            [umpireId]
        );

        if (profileRows.length === 0) {
            return NextResponse.json(
                { success: false, message: "Umpire profile not found." },
                { status: 404 }
            );
        }

        const umpireProfile = profileRows[0];

        // 2. Fetch Assigned Matches
        const [matches] = await connection.query(
            `SELECT
                m.id AS match_id,
                m.booking_id,
                m.match_no,
                m.match_type,
                m.overs,
                m.match_date,
                m.match_time,
                m.status AS match_status,
                ta.team_name AS team_a_name,
                tb.team_name AS team_b_name,
                g.ground_name,
                COALESCE(mu.umpire_role, 'Official Umpire') AS umpire_role,
                COALESCE(mu.fee_amount, uf.fee_amount, 0) AS fee_amount,
                COALESCE(mu.payment_status, 'Pending') AS payment_status,
                mu.remarks AS payment_remarks,
                (SELECT COUNT(*) FROM cst_match_scorecard ms WHERE ms.match_id = m.id) AS scorecard_entries
             FROM cst_matches m
             LEFT JOIN cst_teams ta ON ta.id = m.team_a_id
             LEFT JOIN cst_teams tb ON tb.id = m.team_b_id
             LEFT JOIN cst_ground g ON g.id = m.ground_id
             LEFT JOIN cst_match_umpires mu ON mu.match_id = m.id AND mu.umpire_id = ?
             LEFT JOIN cst_ground_bookings gb ON gb.id = m.booking_id AND gb.umpire_id = ?
             LEFT JOIN cst_umpire_fees uf ON uf.id = gb.umpire_fee_id
             WHERE (mu.umpire_id = ? OR gb.umpire_id = ?)
             ORDER BY m.match_date DESC, m.match_time DESC`,
            [umpireId, umpireId, umpireId, umpireId]
        );

        // 3. Fetch Assigned Ground Bookings
        const [bookings] = await connection.query(
            `SELECT
                gb.id AS booking_id,
                gb.match_id,
                gb.booking_no,
                gb.booking_date,
                gb.purpose,
                gb.booking_status,
                gb.customer_name,
                gb.customer_phone,
                g.ground_name,
                gs.slot_name,
                gs.start_time,
                gs.end_time,
                uf.match_type,
                COALESCE(uf.fee_amount, 0) AS fee_amount,
                COALESCE(uf.payment_type, 'Per Match') AS payment_type,
                gb.payment_status AS customer_payment_status
             FROM cst_ground_bookings gb
             LEFT JOIN cst_ground g ON g.id = gb.ground_id
             LEFT JOIN cst_ground_slots gs ON gs.id = gb.slot_id
             LEFT JOIN cst_umpire_fees uf ON uf.id = gb.umpire_fee_id
             WHERE gb.umpire_id = ?
             ORDER BY gb.booking_date DESC, gb.id DESC`,
            [umpireId]
        );

        // 4. Fetch Actual Umpire Payments Made
        const [paymentRows] = await connection.query(
            `SELECT
                id,
                match_id,
                booking_id,
                amount,
                payment_date,
                payment_mode,
                transaction_no,
                remarks
             FROM cst_umpire_payments
             WHERE umpire_id = ?
             ORDER BY payment_date DESC, id DESC`,
            [umpireId]
        );

        // 5. Calculate Aggregate Statistics without double counting
        let totalFeesEarned = 0;
        let totalFeesPaid = 0;
        let totalFeesPending = 0;
        let upcomingMatchesCount = 0;
        let completedMatchesCount = 0;

        const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

        // Process matches
        matches.forEach((m) => {
            const fee = Number(m.fee_amount || 0);
            totalFeesEarned += fee;

            // Compute paid amount for this match
            const matchPayments = paymentRows.filter(
                (p) =>
                    (p.match_id && Number(p.match_id) === Number(m.match_id)) ||
                    (m.booking_id && p.booking_id && Number(p.booking_id) === Number(m.booking_id))
            );
            const paidForMatch = matchPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

            if (paidForMatch >= fee && fee > 0) {
                m.payment_status = "Paid";
                m.paid_amount = paidForMatch;
                totalFeesPaid += fee;
            } else if (paidForMatch > 0) {
                m.payment_status = "Partial";
                m.paid_amount = paidForMatch;
                totalFeesPaid += paidForMatch;
                totalFeesPending += Math.max(fee - paidForMatch, 0);
            } else if (m.payment_status === "Paid") {
                totalFeesPaid += fee;
            } else {
                m.payment_status = "Pending";
                m.paid_amount = 0;
                totalFeesPending += fee;
            }

            const mDate = String(m.match_date || "").slice(0, 10);
            if (m.match_status === "Completed" || (mDate && mDate < todayStr)) {
                completedMatchesCount++;
            } else if (m.match_status !== "Cancelled") {
                upcomingMatchesCount++;
            }
        });

        // Process ground bookings - prevent double counting if match already represents the booking
        bookings.forEach((b) => {
            const linkedMatch = matches.find(
                (m) =>
                    (m.booking_id && Number(m.booking_id) === Number(b.booking_id)) ||
                    (b.match_id && Number(m.match_id) === Number(b.match_id))
            );

            if (linkedMatch) {
                b.is_match_linked = true;
                b.linked_match_no = linkedMatch.match_no;
                b.umpire_payment_status = linkedMatch.payment_status;
                b.paid_amount = linkedMatch.paid_amount || 0;
            } else {
                // Standalone ground booking with umpire assigned, not played as a separate match
                const fee = Number(b.fee_amount || 0);
                if (fee > 0) {
                    totalFeesEarned += fee;

                    const bookingPayments = paymentRows.filter(
                        (p) => p.booking_id && Number(p.booking_id) === Number(b.booking_id)
                    );
                    const paidForBooking = bookingPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

                    if (paidForBooking >= fee) {
                        b.umpire_payment_status = "Paid";
                        b.paid_amount = paidForBooking;
                        totalFeesPaid += fee;
                    } else if (paidForBooking > 0) {
                        b.umpire_payment_status = "Partial";
                        b.paid_amount = paidForBooking;
                        totalFeesPaid += paidForBooking;
                        totalFeesPending += Math.max(fee - paidForBooking, 0);
                    } else {
                        b.umpire_payment_status = "Pending";
                        b.paid_amount = 0;
                        totalFeesPending += fee;
                    }
                }
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                umpire: umpireProfile,
                stats: {
                    totalMatches: matches.length,
                    upcomingMatches: upcomingMatchesCount,
                    completedMatches: completedMatchesCount,
                    totalBookings: bookings.length,
                    totalFeesEarned,
                    totalFeesPaid,
                    totalFeesPending,
                },
                matches,
                bookings,
                payments: paymentRows,
            },
        });

    } catch (error) {
        console.error("GET Umpire Dashboard Error:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch umpire dashboard data",
                error: process.env.NODE_ENV === "development" ? error.message : undefined,
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
