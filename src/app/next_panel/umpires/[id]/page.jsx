import Link from "next/link";
import { notFound } from "next/navigation";
import {
    ArrowLeft,
    Building2,
    Calendar,
    DollarSign,
    Edit,
    Mail,
    MapPin,
    Phone,
    Shield,
    UserCheck,
    Award,
    Key
} from "lucide-react";
import pool from "@/app/components/lib/db";

export default async function UmpireDetailPage({ params }) {
    const { id } = await params;
    const umpireId = Number(id);

    if (!umpireId || isNaN(umpireId)) {
        notFound();
    }

    let umpire = null;
    let fees = [];
    let recentBookings = [];

    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.query(
            `SELECT
                u.*,
                a.academy_name,
                b.branch_name,
                usr.appointment_no,
                usr.last_login_at
             FROM cst_umpires u
             LEFT JOIN cst_academy a ON a.id = u.academy_id
             LEFT JOIN cst_branch b ON b.id = u.branch_id
             LEFT JOIN cst_users usr ON usr.id = u.user_id
             WHERE u.id = ? AND u.is_deleted = 0
             LIMIT 1`,
            [umpireId]
        );

        if (!rows || rows.length === 0) {
            notFound();
        }

        umpire = rows[0];

        const [feeRows] = await connection.query(
            `SELECT * FROM cst_umpire_fees WHERE umpire_id = ? ORDER BY id ASC`,
            [umpireId]
        );
        fees = feeRows || [];

        // Check recent bookings assigned
        const [bookingRows] = await connection.query(
            `SELECT
                gb.id,
                gb.booking_no,
                gb.booking_date,
                gb.purpose,
                gb.booking_status,
                g.ground_name,
                gs.slot_name,
                uf.match_type,
                uf.fee_amount
             FROM cst_ground_bookings gb
             LEFT JOIN cst_ground g ON g.id = gb.ground_id
             LEFT JOIN cst_ground_slots gs ON gs.id = gb.slot_id
             LEFT JOIN cst_umpire_fees uf ON uf.id = gb.umpire_fee_id
             WHERE gb.umpire_id = ?
             ORDER BY gb.booking_date DESC
             LIMIT 5`,
            [umpireId]
        );
        recentBookings = bookingRows || [];

    } finally {
        connection.release();
    }

    return (
        <div className="container-fluid py-4">
            {/* Header */}
            <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div>
                        <Link
                            href="/next_panel/umpires"
                            className="btn btn-sm btn-outline-secondary mb-3 d-inline-flex align-items-center gap-1"
                        >
                            <ArrowLeft size={16} /> Back to Umpires
                        </Link>
                        <div className="d-flex align-items-center gap-3">
                            <h1 className="h4 fw-bold mb-0">{umpire.umpire_name}</h1>
                            <span
                                className={`badge ${
                                    umpire.status === 1 ? "bg-success" : "bg-secondary"
                                }`}
                            >
                                {umpire.status === 1 ? "Active" : "Inactive"}
                            </span>
                        </div>
                        <p className="text-muted small mb-0 mt-1">
                            {umpire.qualification || "Registered Cricket Match Umpire"}
                        </p>
                    </div>

                    <Link
                        href={`/next_panel/umpires/${umpire.id}/edit`}
                        className="btn btn-primary d-inline-flex align-items-center gap-2"
                    >
                        <Edit size={16} /> Edit Profile & Fees
                    </Link>
                </div>
            </div>

            <div className="row g-4">
                {/* Left Column: Personal & Contact Info */}
                <div className="col-lg-4">
                    <div className="card border-0 shadow-sm rounded-4 mb-4">
                        <div className="card-header bg-white border-0 pt-4 px-4 pb-0">
                            <h5 className="fw-bold mb-0">Umpire Profile</h5>
                        </div>
                        <div className="card-body p-4">
                            <ul className="list-unstyled mb-0">
                                <li className="mb-3 d-flex align-items-start gap-3">
                                    <Phone size={18} className="text-primary mt-1 flex-shrink-0" />
                                    <div>
                                        <small className="text-muted d-block">Mobile</small>
                                        <span className="fw-medium">{umpire.mobile}</span>
                                        {umpire.alternate_mobile && (
                                            <small className="text-muted d-block">
                                                Alt: {umpire.alternate_mobile}
                                            </small>
                                        )}
                                    </div>
                                </li>

                                {umpire.email && (
                                    <li className="mb-3 d-flex align-items-start gap-3">
                                        <Mail size={18} className="text-primary mt-1 flex-shrink-0" />
                                        <div>
                                            <small className="text-muted d-block">Email</small>
                                            <span className="fw-medium">{umpire.email}</span>
                                        </div>
                                    </li>
                                )}

                                <li className="mb-3 d-flex align-items-start gap-3">
                                    <Building2 size={18} className="text-primary mt-1 flex-shrink-0" />
                                    <div>
                                        <small className="text-muted d-block">Academy & Branch</small>
                                        <span className="fw-medium">{umpire.academy_name}</span>
                                        <div className="text-muted small">
                                            {umpire.branch_name ? umpire.branch_name : "Academy-wide"}
                                        </div>
                                    </div>
                                </li>

                                <li className="mb-3 d-flex align-items-start gap-3">
                                    <Award size={18} className="text-primary mt-1 flex-shrink-0" />
                                    <div>
                                        <small className="text-muted d-block">Experience & Certification</small>
                                        <span className="fw-medium">
                                            {umpire.experience_years ? `${umpire.experience_years} Years` : "N/A"}
                                        </span>
                                        {umpire.qualification && (
                                            <div className="text-muted small">{umpire.qualification}</div>
                                        )}
                                    </div>
                                </li>

                                {umpire.address && (
                                    <li className="mb-3 d-flex align-items-start gap-3">
                                        <MapPin size={18} className="text-primary mt-1 flex-shrink-0" />
                                        <div>
                                            <small className="text-muted d-block">Address</small>
                                            <span className="small">{umpire.address}</span>
                                        </div>
                                    </li>
                                )}

                                <li className="d-flex align-items-start gap-3 pt-2 border-top">
                                    <Key size={18} className="text-primary mt-1 flex-shrink-0" />
                                    <div>
                                        <small className="text-muted d-block">Portal Login Credentials</small>
                                        <span className="badge bg-success-subtle text-success">Active Account</span>
                                        <div className="small text-muted mt-1">
                                            Login ID: <strong>{umpire.mobile}</strong>
                                        </div>
                                        {umpire.email && (
                                            <div className="small text-muted">
                                                Email: <strong>{umpire.email}</strong>
                                            </div>
                                        )}
                                        {umpire.appointment_no && (
                                            <div className="small text-muted">
                                                Code: <strong>{umpire.appointment_no}</strong>
                                            </div>
                                        )}
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Right Column: Match Fees & History */}
                <div className="col-lg-8">
                    {/* Fee Schedule */}
                    <div className="card border-0 shadow-sm rounded-4 mb-4">
                        <div className="card-header bg-white border-0 pt-4 px-4 pb-0 d-flex justify-content-between align-items-center">
                            <h5 className="fw-bold mb-0">Configured Fee Schedule</h5>
                            <span className="badge bg-light text-dark border">
                                {fees.length} Match Types Configured
                            </span>
                        </div>
                        <div className="card-body p-4">
                            {fees.length === 0 ? (
                                <p className="text-muted mb-0">No fees configured yet.</p>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table align-middle table-hover mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Match Format</th>
                                                <th>Fee Amount</th>
                                                <th>Billing Basis</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fees.map((f) => (
                                                <tr key={f.id}>
                                                    <td className="fw-semibold">{f.match_type}</td>
                                                    <td className="fw-bold text-success">
                                                        ₹{Number(f.fee_amount).toLocaleString("en-IN")}
                                                    </td>
                                                    <td>
                                                        <span className="badge bg-light text-dark border">
                                                            {f.payment_type}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span
                                                            className={`badge ${
                                                                f.status === 1
                                                                    ? "bg-success-subtle text-success"
                                                                    : "bg-secondary-subtle text-secondary"
                                                            }`}
                                                        >
                                                            {f.status === 1 ? "Active" : "Inactive"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Bookings Assigned */}
                    <div className="card border-0 shadow-sm rounded-4">
                        <div className="card-header bg-white border-0 pt-4 px-4 pb-0">
                            <h5 className="fw-bold mb-0">Recent Ground Booking Assignments</h5>
                        </div>
                        <div className="card-body p-4">
                            {recentBookings.length === 0 ? (
                                <p className="text-muted mb-0">No ground booking assignments yet.</p>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table align-middle table-hover mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Booking #</th>
                                                <th>Date</th>
                                                <th>Ground / Slot</th>
                                                <th>Format / Rate</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recentBookings.map((b) => (
                                                <tr key={b.id}>
                                                    <td>
                                                        <Link
                                                            href={`/next_panel/ground-bookings/${b.id}`}
                                                            className="text-decoration-none fw-semibold"
                                                        >
                                                            {b.booking_no}
                                                        </Link>
                                                    </td>
                                                    <td>
                                                        {new Date(b.booking_date).toLocaleDateString("en-IN", {
                                                            day: "2-digit",
                                                            month: "short",
                                                            year: "numeric",
                                                        })}
                                                    </td>
                                                    <td>
                                                        <div>{b.ground_name}</div>
                                                        <small className="text-muted">{b.slot_name}</small>
                                                    </td>
                                                    <td>
                                                        <span className="badge bg-light text-primary border me-1">
                                                            {b.match_type || "Standard"}
                                                        </span>
                                                        {b.fee_amount && (
                                                            <small className="text-muted">
                                                                ₹{Number(b.fee_amount).toLocaleString("en-IN")}
                                                            </small>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <span className="badge bg-info-subtle text-info">
                                                            {b.booking_status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
