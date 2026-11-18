"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Award,
    Calendar,
    CheckCircle2,
    Clock,
    DollarSign,
    Edit3,
    Eye,
    MapPin,
    Receipt,
    RefreshCw,
    Shield,
    Swords,
    Trophy,
    UserCheck,
    AlertCircle,
    CalendarCheck,
} from "lucide-react";

export default function UmpireDashboard({ user }) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState("matches"); // 'matches', 'bookings', 'fees'

    const fetchDashboardData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/umpire-dashboard");
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to load dashboard data");
            }

            setData(json.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const umpire = data?.umpire || {};
    const stats = data?.stats || {
        totalMatches: 0,
        upcomingMatches: 0,
        completedMatches: 0,
        totalBookings: 0,
        totalFeesEarned: 0,
        totalFeesPaid: 0,
        totalFeesPending: 0,
    };
    const matches = data?.matches || [];
    const bookings = data?.bookings || [];

    const displayName = umpire.umpire_name || user?.name || "Official Match Umpire";

    const formatDate = (val) => {
        if (!val) return "—";
        const [y, m, d] = String(val).slice(0, 10).split("-");
        return `${d}/${m}/${y}`;
    };

    const formatPrice = (val) => `₹${Number(val || 0).toLocaleString("en-IN")}`;

    return (
        <div className="container-fluid px-0 py-2">
            {/* Hero Welcome Banner */}
            <div
                className="card border-0 text-white mb-4 shadow-sm overflow-hidden"
                style={{
                    background: "linear-gradient(135deg, #0b2545 0%, #134074 60%, #0077b6 100%)",
                    borderRadius: "16px",
                }}
            >
                <div className="card-body p-4 p-md-5">
                    <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
                        <div>
                            <div className="d-flex align-items-center gap-2 mb-2">
                                <span className="badge bg-light text-primary px-3 py-1 rounded-pill fw-semibold">
                                    <UserCheck size={14} className="me-1" /> Match Official Portal
                                </span>
                                {umpire.qualification && (
                                    <span className="badge bg-white text-dark px-2 py-1 rounded-pill">
                                        <Award size={12} className="me-1" /> {umpire.qualification}
                                    </span>
                                )}
                            </div>
                            <h1 className="h3 fw-bold mb-1 text-white">Welcome back, {displayName}!</h1>
                            <p className="text-white-50 mb-0">
                                {umpire.academy_name ? `${umpire.academy_name} • ` : ""}
                                {umpire.branch_name ? umpire.branch_name : "Academy Officiating Panel"}
                            </p>
                        </div>

                        <button
                            type="button"
                            className="btn btn-outline-light btn-sm d-inline-flex align-items-center gap-1 rounded-pill px-3"
                            onClick={fetchDashboardData}
                            disabled={loading}
                        >
                            <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh Data
                        </button>
                    </div>
                </div>
            </div>

            {error && (
                <div className="alert alert-danger d-flex align-items-center gap-2 mb-4" role="alert">
                    <AlertCircle size={18} />
                    <div>{error}</div>
                </div>
            )}

            {/* KPI Summary Cards */}
            <div className="row g-3 mb-4">
                {/* Total Assigned Matches */}
                <div className="col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 h-100 p-3 bg-white">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="text-muted small fw-semibold">My Matches</span>
                            <div className="p-2 rounded-3 bg-primary-subtle text-primary">
                                <Swords size={20} />
                            </div>
                        </div>
                        <div className="h3 fw-bold mb-1">{stats.totalMatches}</div>
                        <div className="small text-muted">
                            <span className="text-primary fw-semibold">{stats.upcomingMatches} upcoming</span> • {stats.completedMatches} completed
                        </div>
                    </div>
                </div>

                {/* Ground Bookings */}
                <div className="col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 h-100 p-3 bg-white">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="text-muted small fw-semibold">Ground Bookings</span>
                            <div className="p-2 rounded-3 bg-info-subtle text-info">
                                <CalendarCheck size={20} />
                            </div>
                        </div>
                        <div className="h3 fw-bold mb-1">{stats.totalBookings}</div>
                        <div className="small text-muted">Officiating slots booked</div>
                    </div>
                </div>

                {/* Fees Paid */}
                <div className="col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 h-100 p-3 bg-white">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="text-muted small fw-semibold">Fee Received</span>
                            <div className="p-2 rounded-3 bg-success-subtle text-success">
                                <CheckCircle2 size={20} />
                            </div>
                        </div>
                        <div className="h3 fw-bold text-success mb-1">{formatPrice(stats.totalFeesPaid)}</div>
                        <div className="small text-muted">Paid to account</div>
                    </div>
                </div>

                {/* Fees Pending */}
                <div className="col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 h-100 p-3 bg-white">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="text-muted small fw-semibold">Fee Pending / Due</span>
                            <div className="p-2 rounded-3 bg-warning-subtle text-warning">
                                <Clock size={20} />
                            </div>
                        </div>
                        <div className={`h3 fw-bold mb-1 ${stats.totalFeesPending > 0 ? "text-danger" : "text-muted"}`}>
                            {formatPrice(stats.totalFeesPending)}
                        </div>
                        <div className="small text-muted">
                            Total earned: {formatPrice(stats.totalFeesEarned)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="card border-0 shadow-sm rounded-4 mb-4">
                <div className="card-header bg-white border-0 pt-3 px-4 pb-0">
                    <ul className="nav nav-tabs card-header-tabs border-bottom-0">
                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link fw-semibold ${activeTab === "matches" ? "active text-primary border-bottom border-primary border-3" : "text-muted"}`}
                                onClick={() => setActiveTab("matches")}
                            >
                                <Swords size={16} className="me-2" /> My Assigned Matches ({matches.length})
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link fw-semibold ${activeTab === "bookings" ? "active text-primary border-bottom border-primary border-3" : "text-muted"}`}
                                onClick={() => setActiveTab("bookings")}
                            >
                                <CalendarCheck size={16} className="me-2" /> Ground Bookings ({bookings.length})
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link fw-semibold ${activeTab === "fees" ? "active text-primary border-bottom border-primary border-3" : "text-muted"}`}
                                onClick={() => setActiveTab("fees")}
                            >
                                <DollarSign size={16} className="me-2" /> Remuneration & Payment Status
                            </button>
                        </li>
                    </ul>
                </div>

                <div className="card-body p-4">
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                            <div className="text-muted mt-2">Loading officiating records...</div>
                        </div>
                    ) : (
                        <>
                            {/* TAB 1: MATCHES */}
                            {activeTab === "matches" && (
                                <>
                                    {matches.length === 0 ? (
                                        <div className="text-center py-5 text-muted">
                                            <Swords size={40} className="mb-2 opacity-50" />
                                            <h5>No Matches Assigned Yet</h5>
                                            <p className="small text-muted">You will see your assigned matches here once appointed by academy administration.</p>
                                        </div>
                                    ) : (
                                        <div className="table-responsive">
                                            <table className="table table-hover align-middle mb-0">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>Match</th>
                                                        <th>Teams</th>
                                                        <th>Venue / Ground</th>
                                                        <th>Date & Time</th>
                                                        <th>Your Role</th>
                                                        <th>Fee</th>
                                                        <th>Payment</th>
                                                        <th className="text-end">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {matches.map((m) => (
                                                        <tr key={m.match_id}>
                                                            <td>
                                                                <div className="fw-bold">{m.match_no}</div>
                                                                <span className="badge bg-light text-dark border">
                                                                    {m.match_type} {m.overs ? `(${m.overs} Ov)` : ""}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <div className="fw-semibold">
                                                                    {m.team_a_name} <span className="text-muted">vs</span> {m.team_b_name}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div>{m.ground_name || "Assigned Ground"}</div>
                                                            </td>
                                                            <td>
                                                                <div>{formatDate(m.match_date)}</div>
                                                                <small className="text-muted">{m.match_time ? m.match_time.slice(0, 5) : ""}</small>
                                                            </td>
                                                            <td>
                                                                <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                                                    {m.umpire_role}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <strong className="text-dark">{formatPrice(m.fee_amount)}</strong>
                                                            </td>
                                                            <td>
                                                                <span
                                                                    className={`badge ${
                                                                        m.payment_status === "Paid"
                                                                            ? "bg-success"
                                                                            : m.payment_status === "Partial"
                                                                            ? "bg-info"
                                                                            : "bg-warning text-dark"
                                                                    }`}
                                                                >
                                                                    {m.payment_status || "Pending"}
                                                                </span>
                                                            </td>
                                                            <td className="text-end">
                                                                <div className="d-inline-flex gap-1">
                                                                    <Link
                                                                        href={`/next_panel/match-scorecard/${m.match_id}/edit`}
                                                                        className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1"
                                                                        title="Scorecard Scoring"
                                                                    >
                                                                        <Edit3 size={14} /> Scorecard
                                                                    </Link>
                                                                    <Link
                                                                        href={`/next_panel/matches/${m.match_id}/scorecard`}
                                                                        className="btn btn-sm btn-outline-secondary"
                                                                        title="View Match"
                                                                    >
                                                                        <Eye size={14} />
                                                                    </Link>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* TAB 2: GROUND BOOKINGS */}
                            {activeTab === "bookings" && (
                                <>
                                    {bookings.length === 0 ? (
                                        <div className="text-center py-5 text-muted">
                                            <CalendarCheck size={40} className="mb-2 opacity-50" />
                                            <h5>No Ground Bookings Assigned</h5>
                                            <p className="small text-muted">You will see ground booking officiating requests here.</p>
                                        </div>
                                    ) : (
                                        <div className="table-responsive">
                                            <table className="table table-hover align-middle mb-0">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>Booking #</th>
                                                        <th>Date</th>
                                                        <th>Ground & Slot</th>
                                                        <th>Purpose</th>
                                                        <th>Customer</th>
                                                        <th>Format Rate</th>
                                                        <th>Status</th>
                                                        <th className="text-end">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {bookings.map((b) => (
                                                        <tr key={b.booking_id}>
                                                            <td>
                                                                <div className="fw-bold">{b.booking_no}</div>
                                                                {b.is_match_linked && (
                                                                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle mt-1 d-inline-block">
                                                                        Match: {b.linked_match_no}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td>{formatDate(b.booking_date)}</td>
                                                            <td>
                                                                <div className="fw-semibold">{b.ground_name}</div>
                                                                <small className="text-muted">
                                                                    {b.slot_name} ({b.start_time ? b.start_time.slice(0, 5) : ""} – {b.end_time ? b.end_time.slice(0, 5) : ""})
                                                                </small>
                                                            </td>
                                                            <td>
                                                                <span className="badge bg-light text-dark border">{b.purpose}</span>
                                                            </td>
                                                            <td>
                                                                <div>{b.customer_name}</div>
                                                                {b.customer_phone && <small className="text-muted">{b.customer_phone}</small>}
                                                            </td>
                                                            <td>
                                                                <strong className="text-success">{formatPrice(b.fee_amount)}</strong>
                                                                <small className="text-muted d-block">{b.match_type} ({b.payment_type})</small>
                                                            </td>
                                                            <td>
                                                                <span className="badge bg-info-subtle text-info border">
                                                                    {b.booking_status}
                                                                </span>
                                                            </td>
                                                            <td className="text-end">
                                                                <Link
                                                                    href={`/next_panel/ground-bookings/${b.booking_id}`}
                                                                    className="btn btn-sm btn-outline-primary"
                                                                >
                                                                    <Eye size={14} className="me-1" /> View Booking
                                                                </Link>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* TAB 3: FEES & REMUNERATION STATUS */}
                            {activeTab === "fees" && (
                                <div>
                                    <div className="row g-3 mb-4">
                                        <div className="col-md-4">
                                            <div className="p-3 rounded-3 bg-light border">
                                                <small className="text-muted d-block">Total Fees Payable</small>
                                                <div className="h4 fw-bold mb-0">{formatPrice(stats.totalFeesEarned)}</div>
                                            </div>
                                        </div>
                                        <div className="col-md-4">
                                            <div className="p-3 rounded-3 bg-success-subtle border border-success-subtle">
                                                <small className="text-success d-block fw-semibold">Paid to Umpire</small>
                                                <div className="h4 fw-bold text-success mb-0">{formatPrice(stats.totalFeesPaid)}</div>
                                            </div>
                                        </div>
                                        <div className="col-md-4">
                                            <div className="p-3 rounded-3 bg-warning-subtle border border-warning-subtle">
                                                <small className="text-warning-emphasis d-block fw-semibold">Balance Due / Pending</small>
                                                <div className="h4 fw-bold text-danger mb-0">{formatPrice(stats.totalFeesPending)}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <h6 className="fw-bold mb-3">Assignment Remuneration Ledger</h6>
                                    <div className="table-responsive">
                                        <table className="table table-bordered align-middle">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Assignment / Match</th>
                                                    <th>Role</th>
                                                    <th>Agreed Amount</th>
                                                    <th>Payment Status</th>
                                                    <th>Remarks</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {matches.map((m) => (
                                                    <tr key={`fee-match-${m.match_id}`}>
                                                        <td>{formatDate(m.match_date)}</td>
                                                        <td>
                                                            <div className="fw-bold">{m.match_no}</div>
                                                            <small className="text-muted">{m.team_a_name} vs {m.team_b_name}</small>
                                                        </td>
                                                        <td>{m.umpire_role}</td>
                                                        <td className="fw-bold text-dark">{formatPrice(m.fee_amount)}</td>
                                                        <td>
                                                            <span
                                                                className={`badge ${
                                                                    m.payment_status === "Paid"
                                                                        ? "bg-success"
                                                                        : m.payment_status === "Partial"
                                                                        ? "bg-info"
                                                                        : "bg-warning text-dark"
                                                                }`}
                                                            >
                                                                {m.payment_status || "Pending"}
                                                            </span>
                                                        </td>
                                                        <td className="text-muted small">{m.payment_remarks || "—"}</td>
                                                    </tr>
                                                ))}

                                                {bookings.filter((b) => !b.is_match_linked).map((b) => (
                                                    <tr key={`fee-booking-${b.booking_id}`}>
                                                        <td>{formatDate(b.booking_date)}</td>
                                                        <td>
                                                            <div className="fw-bold">{b.booking_no}</div>
                                                            <small className="text-muted">Ground Slot: {b.ground_name}</small>
                                                        </td>
                                                        <td>Ground Booking Official</td>
                                                        <td className="fw-bold text-dark">{formatPrice(b.fee_amount)}</td>
                                                        <td>
                                                            <span
                                                                className={`badge ${
                                                                    b.umpire_payment_status === "Paid"
                                                                        ? "bg-success"
                                                                        : b.umpire_payment_status === "Partial"
                                                                        ? "bg-info"
                                                                        : "bg-warning text-dark"
                                                                }`}
                                                            >
                                                                {b.umpire_payment_status || "Pending"}
                                                            </span>
                                                        </td>
                                                        <td className="text-muted small">Customer: {b.customer_name}</td>
                                                    </tr>
                                                ))}

                                                {matches.length === 0 && bookings.length === 0 && (
                                                    <tr>
                                                        <td colSpan="6" className="text-center text-muted py-4">
                                                            No remuneration records found.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
