import Link from "next/link";
import { notFound } from "next/navigation";
import {
    ArrowLeft,
    CalendarCheck,
    Clock,
    Edit,
    IndianRupee,
    Mail,
    Phone,
    User,
} from "lucide-react";
import pool from "@/app/components/lib/db";

export default async function GroundBookingDetailPage({ params }) {
    const { id } = await params;

    let booking = null;

    const connection = await pool.getConnection();

    try {
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
            LIMIT 1
            `,
            [id]
        );

        if (!rows.length) {
            notFound();
        }

        booking = rows[0];

        const [payments] = await connection.query(
            `
            SELECT
                id,
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

        booking.payments = payments || [];

        const [imageRows] = await connection.query(
            `
            SELECT
                id,
                ground_id,
                ground_image,
                is_primary,
                status
            FROM cst_ground_images
            WHERE ground_id = ?
            AND status = 1
            ORDER BY is_primary DESC, id DESC
            `,
            [booking.ground_id]
        );

        booking.images = imageRows || [];
    } catch (error) {
        console.error("GROUND BOOKING DETAIL ERROR:", error);
        throw new Error("Failed to load booking details");
    } finally {
        connection.release();
    }

    const prettyDate = (value) => {
        if (!value) return "—";
        return new Date(value).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    const prettyTime = (value) => {
        if (!value) return "—";
        return value.slice(0, 5);
    };

    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href="/next_panel/ground-bookings" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to Ground Bookings
                        </Link>

                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <div>
                                <div className="d-flex align-items-center gap-2 mb-1">
                                    <CalendarCheck size={22} />
                                    <h1 className="h4 mb-0">Booking Details</h1>
                                </div>
                                <p className="text-muted mb-0">{booking.booking_no}</p>
                            </div>

                            <Link
                                href={`/next_panel/ground-bookings/${booking.id}/edit?academy_id=${booking.academy_id}&branch_id=${booking.branch_id}`}
                                className="btn btn-primary"
                            >
                                <Edit size={16} className="me-2" /> Edit booking
                            </Link>
                        </div>
                    </div>
                </div>

                {booking.images && booking.images.length > 0 && (
                    <div className="col-12">
                        <div className="bg-white rounded-4 shadow-sm p-4">
                            <h2 className="h6 mb-3">Ground Image</h2>
                            <div className="row g-3">
                                {booking.images.slice(0, 4).map((image) => (
                                    <div key={image.id} className="col-12 col-sm-6 col-md-4 col-lg-3">
                                        <div className="border rounded-3 overflow-hidden bg-light">
                                            <img
                                                src={image.ground_image}
                                                alt={`${booking.ground_name} ground`}
                                                className="img-fluid w-100"
                                                style={{ height: 180, objectFit: "cover" }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="col-lg-8">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label className="text-muted small">Ground</label>
                                <div className="fw-semibold">{booking.ground_name} ({booking.ground_code})</div>
                            </div>

                            <div className="col-md-6">
                                <label className="text-muted small">Slot</label>
                                <div className="fw-semibold">{booking.slot_name}</div>
                                <div className="text-muted small">
                                    {prettyTime(booking.start_time)} - {prettyTime(booking.end_time)}
                                </div>
                            </div>

                            <div className="col-md-6">
                                <label className="text-muted small">Booking Date</label>
                                <div className="fw-semibold">{prettyDate(booking.booking_date)}</div>
                            </div>

                            <div className="col-md-6">
                                <label className="text-muted small">Status</label>
                                <div>
                                    <span className="badge bg-success">{booking.booking_status}</span>
                                </div>
                            </div>

                            <div className="col-md-6">
                                <label className="text-muted small">Purpose</label>
                                <div className="fw-semibold">{booking.purpose || "Practice"}</div>
                            </div>

                            <div className="col-md-6">
                                <label className="text-muted small">Payment Status</label>
                                <div className="fw-semibold">{booking.payment_status || "Pending"}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-lg-4">
                    <div className="bg-white rounded-4 shadow-sm p-4 h-100">
                        <h2 className="h6 mb-3">Customer</h2>

                        <div className="d-flex align-items-center gap-2 mb-2">
                            <User size={16} className="text-muted" />
                            <span className="fw-semibold">{booking.customer_name}</span>
                        </div>

                        {booking.customer_phone && (
                            <div className="d-flex align-items-center gap-2 mb-2">
                                <Phone size={16} className="text-muted" />
                                <span>{booking.customer_phone}</span>
                            </div>
                        )}

                        {booking.customer_email && (
                            <div className="d-flex align-items-center gap-2 mb-2">
                                <Mail size={16} className="text-muted" />
                                <span>{booking.customer_email}</span>
                            </div>
                        )}

                        {booking.remarks && (
                            <div className="mt-3">
                                <label className="text-muted small">Remarks</label>
                                <p className="mb-0">{booking.remarks}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="col-lg-6">
                    <div className="bg-white rounded-4 shadow-sm p-4 h-100">
                        <h2 className="h6 mb-3">Payment Summary</h2>

                        <div className="d-flex justify-content-between py-2 border-bottom">
                            <span>Total amount</span>
                            <strong>₹{Number(booking.total_amount || 0).toLocaleString("en-IN")}</strong>
                        </div>

                        <div className="d-flex justify-content-between py-2 border-bottom">
                            <span>Paid amount</span>
                            <strong>₹{Number(booking.paid_amount || 0).toLocaleString("en-IN")}</strong>
                        </div>

                        <div className="d-flex justify-content-between py-2 border-bottom">
                            <span>Balance</span>
                            <strong>₹{Number(booking.balance_amount || 0).toLocaleString("en-IN")}</strong>
                        </div>

                        <div className="d-flex justify-content-between py-2">
                            <span>Payment mode</span>
                            <strong>{booking.payments?.[0]?.payment_mode || "—"}</strong>
                        </div>
                    </div>
                </div>

                <div className="col-lg-6">
                    <div className="bg-white rounded-4 shadow-sm p-4 h-100">
                        <h2 className="h6 mb-3">Payment History</h2>

                        {(!booking.payments || booking.payments.length === 0) ? (
                            <p className="text-muted mb-0">No payment records found for this booking.</p>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-sm align-middle mb-0">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Mode</th>
                                            <th>Amount</th>
                                            <th>Ref</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {booking.payments.map((payment) => (
                                            <tr key={payment.id}>
                                                <td>{prettyDate(payment.payment_date)}</td>
                                                <td>{payment.payment_mode || "—"}</td>
                                                <td>
                                                    <span className="d-inline-flex align-items-center gap-1">
                                                        <IndianRupee size={12} />
                                                        {Number(payment.amount || 0).toLocaleString("en-IN")}
                                                    </span>
                                                </td>
                                                <td>{payment.transaction_no || "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <div className="d-flex align-items-center gap-2 text-muted small">
                                <Clock size={16} />
                                <span>Created: {prettyDate(booking.created_at)}</span>
                            </div>

                            <div className="d-flex align-items-center gap-2 text-muted small">
                                <CalendarCheck size={16} />
                                <span>Updated: {prettyDate(booking.updated_at)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
