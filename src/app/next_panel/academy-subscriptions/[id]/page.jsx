"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
    Shield,
    ArrowLeft,
    Calendar,
    IndianRupee,
    Clock,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Receipt,
    History,
    RefreshCw,
    Building2,
    Mail,
    Phone,
    UserCheck,
    CreditCard,
    FileText,
} from "lucide-react";

export default function AcademySubscriptionDetailPage({ params }) {
    const resolvedParams = use(params);
    const id = resolvedParams.id;

    const [sub, setSub] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadDetails = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/academy-subscriptions/${id}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to load subscription details");
            setSub(json.data || null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) loadDetails();
    }, [id]);

    const formatINR = (val) => {
        return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(val || 0);
    };

    if (loading) {
        return (
            <div className="container-fluid py-5 text-center">
                <div className="spinner-border text-primary" role="status"></div>
                <p className="text-muted mt-2 small">Loading subscription details...</p>
            </div>
        );
    }

    if (error || !sub) {
        return (
            <div className="container-fluid py-4">
                <div className="alert alert-danger rounded-3 shadow-sm">
                    {error || "Subscription not found"}
                </div>
                <Link href="/next_panel/academy-subscriptions" className="btn btn-outline-secondary btn-sm">
                    <ArrowLeft size={14} className="me-1" /> Back to Subscriptions
                </Link>
            </div>
        );
    }

    return (
        <div className="container-fluid py-2">
            {/* Top Bar */}
            <div className="d-flex align-items-center justify-content-between mb-3">
                <Link
                    href="/next_panel/academy-subscriptions"
                    className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1.5"
                >
                    <ArrowLeft size={14} /> Back to Academy Subscriptions
                </Link>
                <button
                    type="button"
                    onClick={loadDetails}
                    className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
                >
                    <RefreshCw size={13} /> Refresh
                </button>
            </div>

            {/* Header Card */}
            <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                    <div className="d-flex align-items-start gap-3">
                        <div className="p-3 bg-primary-subtle text-primary rounded-4">
                            <Shield size={32} />
                        </div>
                        <div>
                            <div className="d-flex align-items-center gap-2 mb-1">
                                <h1 className="h4 mb-0 fw-bold">{sub.academy_name}</h1>
                                <span className={`badge px-2.5 py-1 rounded-pill ${
                                    sub.academy_status === 1
                                        ? "bg-success-subtle text-success border border-success-subtle"
                                        : "bg-danger-subtle text-danger border border-danger-subtle"
                                }`}>
                                    Academy {sub.academy_status === 1 ? "Active" : "Inactive"}
                                </span>
                            </div>
                            <p className="text-muted mb-0 font-monospace small">
                                Code: {sub.academy_code} | Contact: {sub.contact_person || "N/A"}
                            </p>
                        </div>
                    </div>

                    {/* Status Badge */}
                    <div className="text-md-end">
                        <div className="small text-muted mb-1">Subscription Status</div>
                        {sub.subscription_status === "active" && (
                            <span className="badge bg-success text-white px-3 py-2 rounded-pill fs-6">
                                <CheckCircle2 size={16} className="me-1" /> Active Subscription
                            </span>
                        )}
                        {sub.subscription_status === "grace_period" && (
                            <span className="badge bg-warning text-dark px-3 py-2 rounded-pill fs-6 fw-bold">
                                <AlertTriangle size={16} className="me-1" /> In 5-Day Grace Period ({sub.grace_days_remaining}d left)
                            </span>
                        )}
                        {sub.subscription_status === "expired" && (
                            <span className="badge bg-danger text-white px-3 py-2 rounded-pill fs-6">
                                <XCircle size={16} className="me-1" /> Subscription Expired
                            </span>
                        )}
                        {sub.subscription_status === "suspended" && (
                            <span className="badge bg-secondary text-white px-3 py-2 rounded-pill fs-6">
                                <Clock size={16} className="me-1" /> Suspended
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="row g-4">
                {/* Left Column: Plan & Validity Card */}
                <div className="col-12 col-lg-5">
                    <div className="card border-0 rounded-4 shadow-sm mb-4">
                        <div className="card-header bg-white border-0 pt-4 px-4 pb-0">
                            <h5 className="fw-bold mb-0 text-dark">Current Plan & Validity</h5>
                        </div>
                        <div className="card-body px-4 py-3">
                            <div className="p-3 bg-light rounded-3 border mb-3">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className="fw-bold h5 text-primary mb-0">{sub.plan_name}</span>
                                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">
                                        {sub.duration_months} Month{sub.duration_months > 1 ? "s" : ""}
                                    </span>
                                </div>
                                <div className="text-muted small mb-2">
                                    Price: <strong>{formatINR(sub.plan_price)}</strong>
                                </div>
                                {sub.plan_description && (
                                    <p className="text-secondary small mb-0">{sub.plan_description}</p>
                                )}
                            </div>

                            <ul className="list-group list-group-flush small">
                                <li className="list-group-item d-flex justify-content-between px-0 py-2">
                                    <span className="text-muted">Subscription Start Date:</span>
                                    <strong className="text-dark">{sub.subscription_start_date || "N/A"}</strong>
                                </li>
                                <li className="list-group-item d-flex justify-content-between px-0 py-2">
                                    <span className="text-muted">Subscription Expiry Date:</span>
                                    <strong className="text-danger">{sub.subscription_end_date || "N/A"}</strong>
                                </li>
                                <li className="list-group-item d-flex justify-content-between px-0 py-2">
                                    <span className="text-muted">Configured Grace Period:</span>
                                    <strong className="text-dark">{sub.grace_period_days || 5} Days</strong>
                                </li>
                                <li className="list-group-item d-flex justify-content-between px-0 py-2">
                                    <span className="text-muted">Grace Period End Date:</span>
                                    <strong className="text-warning-emphasis">{sub.grace_end_date || "N/A"}</strong>
                                </li>
                                <li className="list-group-item d-flex justify-content-between px-0 py-2">
                                    <span className="text-muted">Payment Mode:</span>
                                    <strong className="text-dark text-capitalize">{sub.payment_status} ({sub.is_manual ? "Manual" : "Online"})</strong>
                                </li>
                                {sub.remarks && (
                                    <li className="list-group-item px-0 py-2">
                                        <span className="text-muted d-block mb-1">Remarks:</span>
                                        <p className="text-secondary mb-0 bg-light p-2 rounded-2">{sub.remarks}</p>
                                    </li>
                                )}
                            </ul>
                        </div>
                    </div>

                    {/* Features Card */}
                    <div className="card border-0 rounded-4 shadow-sm mb-4">
                        <div className="card-header bg-white border-0 pt-4 px-4 pb-0">
                            <h6 className="fw-bold mb-0 text-dark">Plan Entitlements & Features</h6>
                        </div>
                        <div className="card-body px-4 py-3">
                            <ul className="list-unstyled mb-0 small">
                                {(sub.features || []).map((feat, idx) => (
                                    <li key={idx} className="d-flex align-items-center gap-2 mb-2 text-secondary">
                                        <CheckCircle2 size={15} className="text-success flex-shrink-0" />
                                        <span>{feat}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Right Column: Payments & Audit Trail */}
                <div className="col-12 col-lg-7">
                    {/* Payments Table */}
                    <div className="card border-0 rounded-4 shadow-sm mb-4">
                        <div className="card-header bg-white border-0 pt-4 px-4 pb-2 d-flex justify-content-between align-items-center">
                            <h5 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                                <Receipt size={18} className="text-primary" /> Payment Transactions
                            </h5>
                            <span className="badge bg-light text-secondary border">
                                {(sub.payments || []).length} Transaction(s)
                            </span>
                        </div>
                        <div className="card-body px-0 py-0">
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0 small">
                                    <thead className="table-light text-muted">
                                        <tr>
                                            <th className="ps-4">Invoice #</th>
                                            <th>Amount</th>
                                            <th>Mode</th>
                                            <th>Date</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(sub.payments || []).length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="text-center py-4 text-muted">
                                                    No payments recorded yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            sub.payments.map((p) => (
                                                <tr key={p.id}>
                                                    <td className="ps-4 font-monospace fw-medium text-dark">
                                                        {p.invoice_number}
                                                        <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                                            TXN: {p.transaction_id}
                                                        </div>
                                                    </td>
                                                    <td className="fw-bold text-success">
                                                        {formatINR(p.amount)}
                                                    </td>
                                                    <td className="text-capitalize">{p.payment_mode}</td>
                                                    <td>{new Date(p.payment_date || p.created_at).toLocaleDateString()}</td>
                                                    <td>
                                                        <span className={`badge rounded-pill ${
                                                            p.payment_status === "success"
                                                                ? "bg-success-subtle text-success"
                                                                : "bg-warning-subtle text-warning-emphasis"
                                                        }`}>
                                                            {p.payment_status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Audit History Timeline */}
                    <div className="card border-0 rounded-4 shadow-sm">
                        <div className="card-header bg-white border-0 pt-4 px-4 pb-2 d-flex justify-content-between align-items-center">
                            <h5 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                                <History size={18} className="text-primary" /> Subscription Audit Trail
                            </h5>
                            <span className="badge bg-light text-secondary border">
                                {(sub.history || []).length} Event(s)
                            </span>
                        </div>
                        <div className="card-body px-4 py-3">
                            {(sub.history || []).length === 0 ? (
                                <p className="text-muted small text-center py-4">No audit logs found.</p>
                            ) : (
                                <div className="timeline">
                                    {sub.history.map((h) => (
                                        <div key={h.id} className="border-start border-2 border-primary-subtle ps-3 pb-3 position-relative">
                                            <div
                                                className="position-absolute bg-primary rounded-circle"
                                                style={{ width: "8px", height: "8px", left: "-5px", top: "4px" }}
                                            ></div>
                                            <div className="d-flex justify-content-between align-items-start">
                                                <span className="badge bg-light text-dark border text-capitalize small">
                                                    {String(h.event_type).replace(/_/g, " ")}
                                                </span>
                                                <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                                                    {new Date(h.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                            <p className="small text-secondary mb-1 mt-1">
                                                {h.remarks || "No remarks provided"}
                                            </p>
                                            <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                                                Changed by: {[h.first_name, h.last_name].filter(Boolean).join(" ") || "Super Admin"}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
