"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Shield,
    RefreshCw,
    Search,
    AlertTriangle,
    CheckCircle2,
    Clock,
    XCircle,
    Calendar,
    ArrowUpRight,
    Plus,
    Filter,
    Power,
    IndianRupee,
    CreditCard,
    AlertCircle,
    ExternalLink,
} from "lucide-react";

export default function AcademySubscriptionsPage() {
    const [subscriptions, setSubscriptions] = useState([]);
    const [plans, setPlans] = useState([]);
    const [summary, setSummary] = useState({ total: 0, active: 0, grace_period: 0, expired: 0, suspended: 0, no_subscription: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    // Filters
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // Give / Assign Subscription Modal
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignAcademyId, setAssignAcademyId] = useState("");
    const [assignPlanId, setAssignPlanId] = useState("");
    const [assignStartDate, setAssignStartDate] = useState(new Date().toISOString().split("T")[0]);
    const [assignGraceDays, setAssignGraceDays] = useState(5);
    const [assignPaymentMode, setAssignPaymentMode] = useState("manual");
    const [assignAmount, setAssignAmount] = useState("");
    const [assignTransactionId, setAssignTransactionId] = useState("");
    const [assignRemarks, setAssignRemarks] = useState("Initial subscription given by Super Admin");
    const [submittingAssign, setSubmittingAssign] = useState(false);

    // Renewal Modal
    const [showRenewModal, setShowRenewModal] = useState(false);
    const [renewTarget, setRenewTarget] = useState(null);
    const [renewPlanId, setRenewPlanId] = useState("");
    const [renewPaymentMode, setRenewPaymentMode] = useState("manual");
    const [renewAmount, setRenewAmount] = useState("");
    const [renewRemarks, setRenewRemarks] = useState("");
    const [submittingRenew, setSubmittingRenew] = useState(false);

    // Quick Extend Modal
    const [showExtendModal, setShowExtendModal] = useState(false);
    const [extendTarget, setExtendTarget] = useState(null);
    const [extendDays, setExtendDays] = useState(7);
    const [extendRemarks, setExtendRemarks] = useState("");
    const [submittingExtend, setSubmittingExtend] = useState(false);

    // Status Change Modal (Suspend / Cancel / Activate)
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [statusTarget, setStatusTarget] = useState(null);
    const [targetNewStatus, setTargetNewStatus] = useState("active");
    const [statusReason, setStatusReason] = useState("");
    const [submittingStatus, setSubmittingStatus] = useState(false);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set("search", search.trim());
            if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);

            const [subRes, planRes] = await Promise.all([
                fetch(`/api/academy-subscriptions?${params.toString()}`),
                fetch("/api/subscription-plans?status=1"),
            ]);

            const subJson = await subRes.json();
            const planJson = await planRes.json();

            if (!subRes.ok) throw new Error(subJson.message || "Failed to load subscriptions");
            setSubscriptions(subJson.data || []);
            setSummary(subJson.summary || { total: 0, active: 0, grace_period: 0, expired: 0, suspended: 0, no_subscription: 0 });

            if (planRes.ok) {
                setPlans(planJson.data || []);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [statusFilter]);

    const handleSearch = (e) => {
        e.preventDefault();
        loadData();
    };

    // Toggle Academy Active / Inactive
    const handleToggleAcademyStatus = async (item) => {
        const newStatus = item.academy_status === 1 ? 0 : 1;
        const actionLabel = newStatus === 1 ? "Activate" : "Deactivate";
        if (
            !confirm(
                `Are you sure you want to ${actionLabel} academy "${item.academy_name}"?\n${
                    newStatus === 0
                        ? "Non-player academy staff and admins will be blocked from logging in. Players will only have READ-ONLY access."
                        : "Full access will be restored according to subscription eligibility."
                }`
            )
        ) {
            return;
        }

        try {
            const res = await fetch(`/api/academies/${item.academy_id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to update academy status");

            setSuccessMsg(`Academy "${item.academy_name}" is now ${newStatus === 1 ? "Active" : "Inactive"}.`);
            loadData();
        } catch (err) {
            setError(err.message);
        }
    };

    // Open Assign / Give Subscription Modal
    const openAssignModal = (item = null) => {
        const defaultAcademyId = item ? item.academy_id : (subscriptions[0]?.academy_id || "");
        const defaultPlan = plans[0];
        setAssignAcademyId(defaultAcademyId);
        setAssignPlanId(defaultPlan ? defaultPlan.id : "");
        setAssignStartDate(new Date().toISOString().split("T")[0]);
        setAssignGraceDays(5);
        setAssignPaymentMode("manual");
        setAssignAmount(defaultPlan ? defaultPlan.price : "");
        setAssignTransactionId("");
        setAssignRemarks(item ? `Subscription given to ${item.academy_name}` : "Manual subscription given by Super Admin");
        setShowAssignModal(true);
    };

    // Submit Assign Subscription
    const handleAssignSubmit = async (e) => {
        e.preventDefault();
        setSubmittingAssign(true);
        setError(null);
        setSuccessMsg(null);

        try {
            const res = await fetch("/api/academy-subscriptions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    academy_id: Number(assignAcademyId),
                    plan_id: Number(assignPlanId),
                    start_date: assignStartDate,
                    grace_period_days: Number(assignGraceDays),
                    payment_mode: assignPaymentMode,
                    amount: Number(assignAmount),
                    transaction_id: assignTransactionId.trim() || null,
                    remarks: assignRemarks,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to give subscription");

            const acadName = subscriptions.find((s) => s.academy_id === Number(assignAcademyId))?.academy_name || "Academy";
            setSuccessMsg(`Subscription successfully given to ${acadName}! Invoice: ${json.data?.invoice_number}`);
            setShowAssignModal(false);
            loadData();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmittingAssign(false);
        }
    };

    // Open Renew Modal
    const openRenewModal = (sub) => {
        setRenewTarget(sub);
        const defaultPlan = plans.find((p) => p.id === sub.plan_id) || plans[0];
        setRenewPlanId(defaultPlan ? defaultPlan.id : "");
        setRenewAmount(defaultPlan ? defaultPlan.price : "");
        setRenewPaymentMode("manual");
        setRenewRemarks(`Renewal for ${sub.academy_name}`);
        setShowRenewModal(true);
    };

    // Submit Renew
    const handleRenewSubmit = async (e) => {
        e.preventDefault();
        setSubmittingRenew(true);
        setError(null);
        setSuccessMsg(null);

        try {
            const res = await fetch("/api/subscription-renew", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    academy_id: renewTarget.academy_id,
                    plan_id: Number(renewPlanId),
                    payment_mode: renewPaymentMode,
                    amount: Number(renewAmount),
                    remarks: renewRemarks,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to renew subscription");

            setSuccessMsg(`Subscription successfully renewed for "${renewTarget.academy_name}"! Invoice: ${json.data?.invoice_number}`);
            setShowRenewModal(false);
            loadData();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmittingRenew(false);
        }
    };

    // Open Quick Extend Modal
    const openExtendModal = (sub) => {
        setExtendTarget(sub);
        setExtendDays(7);
        setExtendRemarks("Courtesy extension granted by Super Admin");
        setShowExtendModal(true);
    };

    // Submit Extend
    const handleExtendSubmit = async (e) => {
        e.preventDefault();
        setSubmittingExtend(true);
        setError(null);
        setSuccessMsg(null);

        try {
            const res = await fetch(`/api/academy-subscriptions/${extendTarget.subscription_id || extendTarget.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "extend_days",
                    days: Number(extendDays),
                    remarks: extendRemarks,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to extend subscription");

            setSuccessMsg(`Extended subscription for "${extendTarget.academy_name}" by ${extendDays} days!`);
            setShowExtendModal(false);
            loadData();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmittingExtend(false);
        }
    };

    // Open Status Modal
    const openStatusModal = (sub, statusToSet) => {
        setStatusTarget(sub);
        setTargetNewStatus(statusToSet);
        setStatusReason(statusToSet === "suspended" ? "Payment overdue / account suspended" : "Restored by Super Admin");
        setShowStatusModal(true);
    };

    // Submit Status Change
    const handleStatusSubmit = async (e) => {
        e.preventDefault();
        setSubmittingStatus(true);
        setError(null);
        setSuccessMsg(null);

        try {
            const res = await fetch(`/api/academy-subscriptions/${statusTarget.subscription_id || statusTarget.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "change_status",
                    new_status: targetNewStatus,
                    remarks: statusReason,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to update status");

            setSuccessMsg(`Updated subscription status for "${statusTarget.academy_name}" to ${targetNewStatus}.`);
            setShowStatusModal(false);
            loadData();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmittingStatus(false);
        }
    };

    const formatINR = (val) => {
        return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(val || 0);
    };

    return (
        <div className="container-fluid py-2">
            {/* Page Header */}
            <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                    <div>
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <Shield className="text-primary" size={26} />
                            <h1 className="h4 mb-0 fw-bold">Academy SaaS Subscriptions</h1>
                        </div>
                        <p className="text-muted mb-0 small">
                            Give subscriptions manually, monitor live lifecycles, grace periods, and renewal statuses.
                        </p>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        <button
                            type="button"
                            onClick={() => openAssignModal()}
                            className="btn btn-primary btn-sm d-flex align-items-center gap-1.5 shadow-sm"
                        >
                            <Plus size={15} /> Give Subscription
                        </button>
                        <Link href="/next_panel/subscription-plans" className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1.5">
                            <Plus size={15} /> Manage Plans
                        </Link>
                        <button
                            type="button"
                            onClick={loadData}
                            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                            title="Refresh"
                        >
                            <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
                        </button>
                    </div>
                </div>

                {/* Summary Filter Pills */}
                <div className="d-flex flex-wrap gap-2 pt-3 border-top mt-3">
                    <button
                        type="button"
                        onClick={() => setStatusFilter("all")}
                        className={`btn btn-sm rounded-pill px-3 ${statusFilter === "all" ? "btn-primary" : "btn-light border"}`}
                    >
                        All Academies ({summary.total})
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatusFilter("active")}
                        className={`btn btn-sm rounded-pill px-3 ${statusFilter === "active" ? "btn-success" : "btn-light border"}`}
                    >
                        Active ({summary.active})
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatusFilter("grace_period")}
                        className={`btn btn-sm rounded-pill px-3 ${statusFilter === "grace_period" ? "btn-warning text-dark fw-bold" : "btn-light border"}`}
                    >
                        Grace Period ({summary.grace_period})
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatusFilter("expired")}
                        className={`btn btn-sm rounded-pill px-3 ${statusFilter === "expired" ? "btn-danger" : "btn-light border"}`}
                    >
                        Expired ({summary.expired})
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatusFilter("suspended")}
                        className={`btn btn-sm rounded-pill px-3 ${statusFilter === "suspended" ? "btn-secondary" : "btn-light border"}`}
                    >
                        Suspended ({summary.suspended})
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatusFilter("no_subscription")}
                        className={`btn btn-sm rounded-pill px-3 ${statusFilter === "no_subscription" ? "btn-dark" : "btn-light border"}`}
                    >
                        No Subscription ({summary.no_subscription || 0})
                    </button>
                </div>
            </div>

            {/* Alerts */}
            {successMsg && (
                <div className="alert alert-success alert-dismissible fade show rounded-3 shadow-sm" role="alert">
                    <div className="d-flex align-items-center gap-2">
                        <CheckCircle2 size={18} />
                        <span>{successMsg}</span>
                    </div>
                    <button type="button" className="btn-close" onClick={() => setSuccessMsg(null)}></button>
                </div>
            )}

            {error && (
                <div className="alert alert-danger alert-dismissible fade show rounded-3 shadow-sm" role="alert">
                    <div className="d-flex align-items-center gap-2">
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                    <button type="button" className="btn-close" onClick={() => setError(null)}></button>
                </div>
            )}

            {/* Search Bar */}
            <div className="bg-white rounded-4 shadow-sm p-3 mb-4">
                <form onSubmit={handleSearch} className="row g-2 align-items-center">
                    <div className="col-12 col-md-6 col-lg-8">
                        <div className="input-group">
                            <span className="input-group-text bg-light border-end-0">
                                <Search size={16} className="text-muted" />
                            </span>
                            <input
                                type="text"
                                className="form-control border-start-0 ps-0"
                                placeholder="Search by academy name, code, or contact person..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="col-6 col-md-3 col-lg-2">
                        <button type="submit" className="btn btn-primary w-100">
                            Search
                        </button>
                    </div>
                    <div className="col-6 col-md-3 col-lg-2">
                        <button
                            type="button"
                            className="btn btn-outline-secondary w-100"
                            onClick={() => {
                                setSearch("");
                                setTimeout(() => loadData(), 0);
                            }}
                        >
                            Reset
                        </button>
                    </div>
                </form>
            </div>

            {/* Table */}
            <div className="bg-white rounded-4 shadow-sm overflow-hidden mb-4">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light text-muted small text-uppercase">
                            <tr>
                                <th className="ps-4">Academy</th>
                                <th>Manual Status</th>
                                <th>Current Plan</th>
                                <th>Subscription Validity</th>
                                <th>Grace Period</th>
                                <th>Subscription Status</th>
                                <th className="text-end pe-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="text-center py-5">
                                        <div className="spinner-border text-primary spinner-border-sm me-2" role="status"></div>
                                        <span className="text-muted small">Loading academy subscriptions...</span>
                                    </td>
                                </tr>
                            ) : subscriptions.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="text-center py-5 text-muted">
                                        No academies found.
                                    </td>
                                </tr>
                            ) : (
                                subscriptions.map((item) => (
                                    <tr key={item.academy_id}>
                                        {/* Academy Info */}
                                        <td className="ps-4">
                                            <div className="fw-bold text-dark">{item.academy_name}</div>
                                            <div className="small text-muted font-monospace">{item.academy_code}</div>
                                            {item.contact_person && (
                                                <div className="text-secondary" style={{ fontSize: "0.75rem" }}>
                                                    Contact: {item.contact_person} {item.phone ? `(${item.phone})` : ""}
                                                </div>
                                            )}
                                        </td>

                                        {/* Academy Status (Manual) */}
                                        <td>
                                            <button
                                                type="button"
                                                onClick={() => handleToggleAcademyStatus(item)}
                                                className={`btn btn-sm d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded-pill ${
                                                    item.academy_status === 1
                                                        ? "btn-outline-success"
                                                        : "btn-outline-danger"
                                                }`}
                                                title={`Click to ${item.academy_status === 1 ? "Deactivate" : "Activate"} Academy`}
                                            >
                                                <Power size={13} />
                                                <span>{item.academy_status === 1 ? "Active" : "Deactivated"}</span>
                                            </button>
                                        </td>

                                        {/* Current Plan */}
                                        <td>
                                            {item.has_subscription ? (
                                                <>
                                                    <div className="fw-semibold text-dark">{item.plan_name}</div>
                                                    <div className="text-primary small fw-medium">
                                                        {formatINR(item.plan_price)} ({item.duration_months} mo)
                                                    </div>
                                                </>
                                            ) : (
                                                <span className="badge bg-light text-secondary border">
                                                    No Active Plan
                                                </span>
                                            )}
                                        </td>

                                        {/* Validity Dates */}
                                        <td>
                                            {item.has_subscription ? (
                                                <>
                                                    <div className="small text-dark d-flex align-items-center gap-1">
                                                        <Calendar size={13} className="text-muted" />
                                                        <span>Exp: <strong className="text-danger">{item.subscription_end_date || "N/A"}</strong></span>
                                                    </div>
                                                    <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                                                        Start: {item.subscription_start_date || "N/A"}
                                                    </div>
                                                    {item.subscription_status === "active" && (
                                                        <div className="text-success fw-medium" style={{ fontSize: "0.75rem" }}>
                                                            {item.days_until_expiry} day{item.days_until_expiry === 1 ? "" : "s"} left
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-muted small fst-italic">Not Given</span>
                                            )}
                                        </td>

                                        {/* Grace Period */}
                                        <td>
                                            {item.has_subscription ? (
                                                <>
                                                    <div className="small">
                                                        <span>End: <strong>{item.grace_end_date || "N/A"}</strong></span>
                                                    </div>
                                                    <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                                                        ({item.grace_period_days} Days Grace)
                                                    </div>
                                                    {item.subscription_status === "grace_period" && (
                                                        <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill mt-1">
                                                            {item.grace_days_remaining} day{item.grace_days_remaining === 1 ? "" : "s"} left in Grace!
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-muted small">—</span>
                                            )}
                                        </td>

                                        {/* Subscription Status Badge */}
                                        <td>
                                            {item.subscription_status === "active" && (
                                                <span className="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1.5 rounded-pill d-inline-flex align-items-center gap-1">
                                                    <CheckCircle2 size={13} /> Active
                                                </span>
                                            )}
                                            {item.subscription_status === "grace_period" && (
                                                <span className="badge bg-warning-subtle text-dark border border-warning px-2.5 py-1.5 rounded-pill d-inline-flex align-items-center gap-1">
                                                    <AlertTriangle size={13} className="text-warning-emphasis" /> Grace Period
                                                </span>
                                            )}
                                            {item.subscription_status === "expired" && (
                                                <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2.5 py-1.5 rounded-pill d-inline-flex align-items-center gap-1">
                                                    <XCircle size={13} /> Expired
                                                </span>
                                            )}
                                            {item.subscription_status === "suspended" && (
                                                <span className="badge bg-secondary-subtle text-secondary border border-secondary px-2.5 py-1.5 rounded-pill d-inline-flex align-items-center gap-1">
                                                    <Clock size={13} /> Suspended
                                                </span>
                                            )}
                                            {(item.subscription_status === "no_subscription" || item.subscription_status === "none" || !item.has_subscription) && (
                                                <span className="badge bg-secondary-subtle text-secondary border px-2.5 py-1.5 rounded-pill d-inline-flex align-items-center gap-1">
                                                    No Subscription
                                                </span>
                                            )}
                                        </td>

                                        {/* Actions */}
                                        <td className="text-end pe-4">
                                            {item.has_subscription ? (
                                                <div className="btn-group btn-group-sm">
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary d-inline-flex align-items-center gap-1"
                                                        onClick={() => openRenewModal(item)}
                                                        title="Renew Subscription"
                                                    >
                                                        <RefreshCw size={13} /> Renew
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-secondary"
                                                        onClick={() => openExtendModal(item)}
                                                        title="Quick Extend Days"
                                                    >
                                                        +Extend
                                                    </button>
                                                    {item.subscription_status === "active" ? (
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-warning"
                                                            onClick={() => openStatusModal(item, "suspended")}
                                                            title="Suspend Subscription"
                                                        >
                                                            Suspend
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-success"
                                                            onClick={() => openStatusModal(item, "active")}
                                                            title="Activate Subscription"
                                                        >
                                                            Activate
                                                        </button>
                                                    )}
                                                    <Link
                                                        href={`/next_panel/academy-subscriptions/${item.subscription_id}`}
                                                        className="btn btn-outline-dark"
                                                        title="View Full Details & History"
                                                    >
                                                        <ExternalLink size={13} />
                                                    </Link>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1.5 shadow-sm"
                                                    onClick={() => openAssignModal(item)}
                                                    title="Give Subscription to this Academy"
                                                >
                                                    <Plus size={14} /> Give Subscription
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal: Give / Assign Subscription */}
            {showAssignModal && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content rounded-4 border-0 shadow">
                            <div className="modal-header border-bottom px-4 pt-4 pb-3">
                                <div>
                                    <h5 className="modal-title fw-bold">Give Subscription Manually</h5>
                                    <p className="text-muted small mb-0">Assign a SaaS plan to an academy with custom validity and payment tracking</p>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setShowAssignModal(false)}
                                    disabled={submittingAssign}
                                ></button>
                            </div>

                            <form onSubmit={handleAssignSubmit}>
                                <div className="modal-body px-4 py-3">
                                    <div className="row g-3">
                                        <div className="col-12 col-md-6">
                                            <label className="form-label fw-semibold small">
                                                Target Academy <span className="text-danger">*</span>
                                            </label>
                                            <select
                                                className="form-select"
                                                value={assignAcademyId}
                                                onChange={(e) => {
                                                    const aId = Number(e.target.value);
                                                    setAssignAcademyId(aId);
                                                    const acad = subscriptions.find((s) => s.academy_id === aId);
                                                    if (acad) {
                                                        setAssignRemarks(`Subscription given to ${acad.academy_name}`);
                                                    }
                                                }}
                                                required
                                            >
                                                {subscriptions.map((s) => (
                                                    <option key={s.academy_id} value={s.academy_id}>
                                                        {s.academy_name} ({s.academy_code})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="col-12 col-md-6">
                                            <label className="form-label fw-semibold small">
                                                Select Subscription Plan <span className="text-danger">*</span>
                                            </label>
                                            <select
                                                className="form-select"
                                                value={assignPlanId}
                                                onChange={(e) => {
                                                    const pId = Number(e.target.value);
                                                    setAssignPlanId(pId);
                                                    const found = plans.find((p) => p.id === pId);
                                                    if (found) setAssignAmount(found.price);
                                                }}
                                                required
                                            >
                                                {plans.map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.plan_name} ({p.duration_months} Month{p.duration_months > 1 ? "s" : ""}) — {formatINR(p.price)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="col-12 col-md-4">
                                            <label className="form-label fw-semibold small">
                                                Subscription Start Date <span className="text-danger">*</span>
                                            </label>
                                            <input
                                                type="date"
                                                className="form-control"
                                                value={assignStartDate}
                                                onChange={(e) => setAssignStartDate(e.target.value)}
                                                required
                                            />
                                        </div>

                                        <div className="col-12 col-md-4">
                                            <label className="form-label fw-semibold small">
                                                Grace Period (Days)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="30"
                                                className="form-control"
                                                value={assignGraceDays}
                                                onChange={(e) => setAssignGraceDays(Number(e.target.value))}
                                            />
                                        </div>

                                        <div className="col-12 col-md-4">
                                            <label className="form-label fw-semibold small">
                                                Amount Received (₹) <span className="text-danger">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                className="form-control"
                                                value={assignAmount}
                                                onChange={(e) => setAssignAmount(e.target.value)}
                                                required
                                            />
                                        </div>

                                        <div className="col-12 col-md-6">
                                            <label className="form-label fw-semibold small">Payment Mode</label>
                                            <select
                                                className="form-select"
                                                value={assignPaymentMode}
                                                onChange={(e) => setAssignPaymentMode(e.target.value)}
                                            >
                                                <option value="manual">Manual / Cash</option>
                                                <option value="bank_transfer">Bank Transfer / NEFT</option>
                                                <option value="upi">UPI / QR Code</option>
                                                <option value="cheque">Cheque</option>
                                                <option value="online">Online Payment</option>
                                            </select>
                                        </div>

                                        <div className="col-12 col-md-6">
                                            <label className="form-label fw-semibold small">
                                                Transaction Reference / UTR (Optional)
                                            </label>
                                            <input
                                                type="text"
                                                className="form-control font-monospace"
                                                placeholder="e.g. UTR12345678 (auto-generated if blank)"
                                                value={assignTransactionId}
                                                onChange={(e) => setAssignTransactionId(e.target.value)}
                                            />
                                        </div>

                                        <div className="col-12">
                                            <label className="form-label fw-semibold small">Remarks / Notes</label>
                                            <textarea
                                                className="form-control"
                                                rows="2"
                                                value={assignRemarks}
                                                onChange={(e) => setAssignRemarks(e.target.value)}
                                                placeholder="e.g. Offline cash payment received by Super Admin..."
                                            ></textarea>
                                        </div>
                                    </div>
                                </div>

                                <div className="modal-footer border-top px-4 py-3">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        onClick={() => setShowAssignModal(false)}
                                        disabled={submittingAssign}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary d-flex align-items-center gap-1.5"
                                        disabled={submittingAssign}
                                    >
                                        {submittingAssign ? "Assigning..." : "Confirm & Give Subscription"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Renew Subscription */}
            {showRenewModal && renewTarget && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content rounded-4 border-0 shadow">
                            <div className="modal-header border-bottom px-4 pt-4 pb-3">
                                <div>
                                    <h5 className="modal-title fw-bold">Renew Academy Subscription</h5>
                                    <p className="text-muted small mb-0">{renewTarget.academy_name}</p>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setShowRenewModal(false)}
                                    disabled={submittingRenew}
                                ></button>
                            </div>

                            <form onSubmit={handleRenewSubmit}>
                                <div className="modal-body px-4 py-3">
                                    <div className="alert alert-info py-2 small mb-3">
                                        <strong>Cycle Calculation Rule:</strong> If renewed during active or grace period,
                                        the next cycle will automatically begin on <strong>{renewTarget.subscription_end_date} + 1 day</strong>.
                                        If already expired beyond grace, the new cycle starts today.
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small">
                                            Select Subscription Plan <span className="text-danger">*</span>
                                        </label>
                                        <select
                                            className="form-select"
                                            value={renewPlanId}
                                            onChange={(e) => {
                                                const pId = Number(e.target.value);
                                                setRenewPlanId(pId);
                                                const found = plans.find((p) => p.id === pId);
                                                if (found) setRenewAmount(found.price);
                                            }}
                                            required
                                        >
                                            {plans.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.plan_name} ({p.duration_months} mo) - {formatINR(p.price)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="row g-2 mb-3">
                                        <div className="col-6">
                                            <label className="form-label fw-semibold small">
                                                Amount (₹) <span className="text-danger">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                className="form-control"
                                                value={renewAmount}
                                                onChange={(e) => setRenewAmount(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label fw-semibold small">Payment Mode</label>
                                            <select
                                                className="form-select"
                                                value={renewPaymentMode}
                                                onChange={(e) => setRenewPaymentMode(e.target.value)}
                                            >
                                                <option value="manual">Manual / Cash</option>
                                                <option value="bank_transfer">Bank Transfer / NEFT</option>
                                                <option value="upi">UPI / QR Code</option>
                                                <option value="cheque">Cheque</option>
                                                <option value="online">Online Payment</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small">Remarks / Notes</label>
                                        <textarea
                                            className="form-control"
                                            rows="2"
                                            value={renewRemarks}
                                            onChange={(e) => setRenewRemarks(e.target.value)}
                                            placeholder="e.g. Annual renewal received via NEFT..."
                                        ></textarea>
                                    </div>
                                </div>

                                <div className="modal-footer border-top px-4 py-3">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        onClick={() => setShowRenewModal(false)}
                                        disabled={submittingRenew}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary d-flex align-items-center gap-2"
                                        disabled={submittingRenew}
                                    >
                                        {submittingRenew ? "Processing..." : "Confirm & Renew Plan"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Quick Extend Days */}
            {showExtendModal && extendTarget && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content rounded-4 border-0 shadow">
                            <div className="modal-header border-bottom px-4 pt-4 pb-3">
                                <div>
                                    <h5 className="modal-title fw-bold">Extend Subscription Expiry</h5>
                                    <p className="text-muted small mb-0">{extendTarget.academy_name}</p>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setShowExtendModal(false)}
                                    disabled={submittingExtend}
                                ></button>
                            </div>

                            <form onSubmit={handleExtendSubmit}>
                                <div className="modal-body px-4 py-3">
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small">Extend By (Days)</label>
                                        <div className="d-flex gap-2">
                                            {[7, 15, 30, 60].map((d) => (
                                                <button
                                                    key={d}
                                                    type="button"
                                                    className={`btn btn-sm flex-fill ${extendDays === d ? "btn-primary" : "btn-outline-secondary"}`}
                                                    onClick={() => setExtendDays(d)}
                                                >
                                                    +{d} Days
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small">Custom Days</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="365"
                                            className="form-control"
                                            value={extendDays}
                                            onChange={(e) => setExtendDays(Number(e.target.value))}
                                            required
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small">Reason / Remarks</label>
                                        <textarea
                                            className="form-control"
                                            rows="2"
                                            value={extendRemarks}
                                            onChange={(e) => setExtendRemarks(e.target.value)}
                                            placeholder="Reason for extension..."
                                        ></textarea>
                                    </div>
                                </div>

                                <div className="modal-footer border-top px-4 py-3">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        onClick={() => setShowExtendModal(false)}
                                        disabled={submittingExtend}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={submittingExtend}
                                    >
                                        {submittingExtend ? "Saving..." : "Apply Extension"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Status Change (Suspend / Cancel / Activate) */}
            {showStatusModal && statusTarget && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content rounded-4 border-0 shadow">
                            <div className="modal-header border-bottom px-4 pt-4 pb-3">
                                <div>
                                    <h5 className="modal-title fw-bold">Update Subscription Status</h5>
                                    <p className="text-muted small mb-0">{statusTarget.academy_name}</p>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setShowStatusModal(false)}
                                    disabled={submittingStatus}
                                ></button>
                            </div>

                            <form onSubmit={handleStatusSubmit}>
                                <div className="modal-body px-4 py-3">
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small">New Status</label>
                                        <select
                                            className="form-select"
                                            value={targetNewStatus}
                                            onChange={(e) => setTargetNewStatus(e.target.value)}
                                        >
                                            <option value="active">Active</option>
                                            <option value="suspended">Suspended</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small">Reason / Remarks</label>
                                        <textarea
                                            className="form-control"
                                            rows="2"
                                            value={statusReason}
                                            onChange={(e) => setStatusReason(e.target.value)}
                                            required
                                        ></textarea>
                                    </div>
                                </div>

                                <div className="modal-footer border-top px-4 py-3">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        onClick={() => setShowStatusModal(false)}
                                        disabled={submittingStatus}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={submittingStatus}
                                    >
                                        {submittingStatus ? "Updating..." : "Update Status"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
