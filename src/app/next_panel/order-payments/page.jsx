"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    AlertCircle,
    ArrowUpDown,
    Calendar,
    CheckCircle2,
    Clock,
    CreditCard,
    DollarSign,
    Edit,
    ExternalLink,
    Filter,
    Plus,
    Receipt,
    RefreshCw,
    Search,
    Trash2,
    User,
    X,
    XCircle,
} from "lucide-react";

const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Bank Transfer", "COD"];
const PAYMENT_STATUSES = ["Pending", "Success", "Failed", "Refunded"];

function formatPaymentDate(dateVal) {
    if (!dateVal) return "—";
    const dateObj = new Date(typeof dateVal === "string" ? dateVal.replace(" ", "T") : dateVal);
    if (isNaN(dateObj.getTime())) return String(dateVal);
    return dateObj.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function OrderPaymentsPage() {
    const [payments, setPayments] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    // Filters
    const [search, setSearch] = useState("");
    const [methodFilter, setMethodFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [reloadCount, setReloadCount] = useState(0);

    // Modal states
    const [showRecordModal, setShowRecordModal] = useState(false);
    const [viewPayment, setViewPayment] = useState(null);
    const [editPayment, setEditPayment] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Form fields for recording a new payment
    const [formOrderId, setFormOrderId] = useState("");
    const [formAmount, setFormAmount] = useState("");
    const [formMethod, setFormMethod] = useState("UPI");
    const [formStatus, setFormStatus] = useState("Success");
    const [formProvider, setFormProvider] = useState("");
    const [formTransactionNo, setFormTransactionNo] = useState("");
    const [formGatewayOrderId, setFormGatewayOrderId] = useState("");
    const [formNotes, setFormNotes] = useState("");

    // Form fields for editing an existing payment
    const [editStatus, setEditStatus] = useState("Success");
    const [editTransactionNo, setEditTransactionNo] = useState("");
    const [editProvider, setEditProvider] = useState("");
    const [editNotes, setEditNotes] = useState("");

    // Fetch payments
    useEffect(() => {
        let isMounted = true;
        async function fetchPayments() {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (search.trim()) params.set("search", search.trim());
                if (methodFilter) params.set("payment_method", methodFilter);
                if (statusFilter) params.set("payment_status", statusFilter);
                if (startDate) params.set("start_date", startDate);
                if (endDate) params.set("end_date", endDate);

                const res = await fetch(`/api/order-payments?${params.toString()}`);
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.message || "Failed to load payments.");

                if (isMounted) setPayments(json.data || []);
            } catch (err) {
                if (isMounted) setError(err.message);
            } finally {
                if (isMounted) setLoading(false);
            }
        }
        fetchPayments();
        return () => {
            isMounted = false;
        };
    }, [search, methodFilter, statusFilter, startDate, endDate, reloadCount]);

    // Fetch recent orders for the record payment modal dropdown
    useEffect(() => {
        let isMounted = true;
        async function fetchOrdersList() {
            try {
                const res = await fetch("/api/orders");
                const json = await res.json();
                if (isMounted && res.ok && json.success) {
                    setOrders(json.data || []);
                }
            } catch {
                /* non-fatal */
            }
        }
        fetchOrdersList();
        return () => {
            isMounted = false;
        };
    }, []);

    // KPI Metrics
    const totalCollected = payments
        .filter((p) => p.payment_status === "Success")
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const successfulCount = payments.filter((p) => p.payment_status === "Success").length;
    const pendingCount = payments.filter((p) => p.payment_status === "Pending").length;
    const failedOrRefundedCount = payments.filter((p) => ["Failed", "Refunded"].includes(p.payment_status)).length;

    // Reset create modal
    const handleOpenRecordModal = (presetOrderId = "") => {
        setFormOrderId(presetOrderId ? String(presetOrderId) : "");
        setFormAmount("");
        setFormMethod("UPI");
        setFormStatus("Success");
        setFormProvider("");
        setFormTransactionNo("");
        setFormGatewayOrderId("");
        setFormNotes("");
        setShowRecordModal(true);
    };

    // Auto-fill amount when order is selected
    const handleOrderSelect = (orderId) => {
        setFormOrderId(orderId);
        const selected = orders.find((o) => String(o.id) === String(orderId));
        if (selected) {
            setFormAmount(String(selected.grand_total || ""));
        }
    };

    // Submit new payment
    const handleCreatePayment = async (e) => {
        e.preventDefault();
        if (!formOrderId) {
            alert("Please select an order.");
            return;
        }
        if (!formAmount || Number(formAmount) <= 0) {
            alert("Please enter a valid payment amount.");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                order_id: Number(formOrderId),
                amount: Number(formAmount),
                payment_method: formMethod,
                payment_status: formStatus,
                payment_provider: formProvider.trim() || null,
                transaction_no: formTransactionNo.trim() || null,
                gateway_order_id: formGatewayOrderId.trim() || null,
                notes: formNotes.trim() || null,
                payment_date: new Date().toISOString().slice(0, 19).replace("T", " "),
            };

            const res = await fetch("/api/order-payments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to record payment.");

            setNotice("Payment successfully recorded!");
            setShowRecordModal(false);
            setReloadCount((c) => c + 1);
        } catch (err) {
            alert(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Open Edit modal
    const handleOpenEdit = (p) => {
        setEditPayment(p);
        setEditStatus(p.payment_status || "Pending");
        setEditTransactionNo(p.transaction_no || "");
        setEditProvider(p.payment_provider || "");
        setEditNotes(p.notes || "");
    };

    // Submit edit payment
    const handleUpdatePayment = async (e) => {
        e.preventDefault();
        if (!editPayment) return;

        setSubmitting(true);
        try {
            const payload = {
                payment_status: editStatus,
                transaction_no: editTransactionNo.trim() || null,
                payment_provider: editProvider.trim() || null,
                notes: editNotes.trim() || null,
            };

            const res = await fetch(`/api/order-payments/${editPayment.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to update payment.");

            setNotice("Payment record updated successfully!");
            setEditPayment(null);
            setReloadCount((c) => c + 1);
        } catch (err) {
            alert(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Delete payment
    const handleDeletePayment = async (id) => {
        if (!window.confirm("Are you sure you want to delete this payment record? This will adjust the order payment balance.")) {
            return;
        }

        try {
            const res = await fetch(`/api/order-payments/${id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete payment.");

            setNotice("Payment record deleted.");
            setReloadCount((c) => c + 1);
        } catch (err) {
            alert(err.message);
        }
    };

    return (
        <div className="container-fluid p-4">
            {/* Breadcrumb & Header */}
            <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
                <div>
                    <nav aria-label="breadcrumb">
                        <ol className="breadcrumb mb-1 small text-muted">
                            <li className="breadcrumb-item">Product Master</li>
                            <li className="breadcrumb-item active text-dark fw-semibold" aria-current="page">
                                Order Payments
                            </li>
                        </ol>
                    </nav>
                    <h2 className="h4 fw-bold text-navy mb-0 d-flex align-items-center gap-2">
                        <CreditCard className="text-teal" size={24} />
                        Order Payments
                    </h2>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setReloadCount((c) => c + 1)}
                        className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1 rounded-3 px-3 py-2"
                        disabled={loading}
                    >
                        <RefreshCw size={14} className={loading ? "spin" : ""} />
                        <span>Refresh</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleOpenRecordModal()}
                        className="btn btn-teal text-white btn-sm d-inline-flex align-items-center gap-1 rounded-3 px-3 py-2 shadow-sm"
                        style={{ backgroundColor: "#00a699", borderColor: "#00a699" }}
                    >
                        <Plus size={16} />
                        <span>Record Payment</span>
                    </button>
                </div>
            </div>

            {/* Notice message */}
            {notice && (
                <div className="alert alert-success alert-dismissible fade show rounded-3 small py-2 px-3 mb-4 d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-2">
                        <CheckCircle2 size={16} />
                        <span>{notice}</span>
                    </div>
                    <button type="button" className="btn-close p-2" onClick={() => setNotice(null)}></button>
                </div>
            )}

            {/* Error message */}
            {error && (
                <div className="alert alert-danger rounded-3 small py-2 px-3 mb-4 d-flex align-items-center gap-2">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            {/* KPI Cards */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                        <div className="d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small fw-medium text-uppercase">Total Collected</div>
                                <div className="h4 fw-bold text-navy mb-0 mt-1">₹{totalCollected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                            </div>
                            <div className="p-3 rounded-circle bg-success-subtle text-success">
                                <DollarSign size={22} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                        <div className="d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small fw-medium text-uppercase">Total Transactions</div>
                                <div className="h4 fw-bold text-navy mb-0 mt-1">{payments.length}</div>
                            </div>
                            <div className="p-3 rounded-circle bg-primary-subtle text-primary">
                                <Receipt size={22} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                        <div className="d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small fw-medium text-uppercase">Successful</div>
                                <div className="h4 fw-bold text-success mb-0 mt-1">{successfulCount}</div>
                            </div>
                            <div className="p-3 rounded-circle bg-success-subtle text-success">
                                <CheckCircle2 size={22} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                        <div className="d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small fw-medium text-uppercase">Pending / Failed</div>
                                <div className="h4 fw-bold text-warning mb-0 mt-1">
                                    {pendingCount} <span className="small text-muted fw-normal">/ {failedOrRefundedCount} failed</span>
                                </div>
                            </div>
                            <div className="p-3 rounded-circle bg-warning-subtle text-warning">
                                <Clock size={22} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="card border-0 shadow-sm rounded-4 p-3 bg-white mb-4">
                <div className="row g-2">
                    <div className="col-12 col-md-4">
                        <div className="input-group">
                            <span className="input-group-text bg-light border-end-0">
                                <Search size={16} className="text-muted" />
                            </span>
                            <input
                                type="text"
                                className="form-control border-start-0 bg-light"
                                placeholder="Search by Order #, Customer, Phone, Txn ID..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="col-6 col-md-2">
                        <select
                            className="form-select bg-light"
                            value={methodFilter}
                            onChange={(e) => setMethodFilter(e.target.value)}
                        >
                            <option value="">All Methods</option>
                            {PAYMENT_METHODS.map((m) => (
                                <option key={m} value={m}>
                                    {m}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="col-6 col-md-2">
                        <select
                            className="form-select bg-light"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">All Statuses</option>
                            {PAYMENT_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="col-6 col-md-2">
                        <input
                            type="date"
                            className="form-control bg-light"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            title="Start Date"
                        />
                    </div>

                    <div className="col-6 col-md-2">
                        <input
                            type="date"
                            className="form-control bg-light"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            title="End Date"
                        />
                    </div>
                </div>
            </div>

            {/* Payments Table */}
            <div className="card border-0 shadow-sm rounded-4 bg-white overflow-hidden">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light border-bottom">
                            <tr className="text-uppercase small text-muted">
                                <th className="ps-4">ID</th>
                                <th>Order #</th>
                                <th>Customer</th>
                                <th>Method</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Txn Ref</th>
                                <th>Date</th>
                                <th className="text-end pe-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-5 text-muted">
                                        <div className="spinner-border spinner-border-sm text-secondary me-2"></div>
                                        Loading payments...
                                    </td>
                                </tr>
                            ) : payments.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-5 text-muted">
                                        No order payment records found matching the criteria.
                                    </td>
                                </tr>
                            ) : (
                                payments.map((p) => {
                                    const statusBadge =
                                        p.payment_status === "Success"
                                            ? "bg-success-subtle text-success border border-success-subtle"
                                            : p.payment_status === "Pending"
                                            ? "bg-warning-subtle text-warning border border-warning-subtle"
                                            : p.payment_status === "Refunded"
                                            ? "bg-info-subtle text-info border border-info-subtle"
                                            : "bg-danger-subtle text-danger border border-danger-subtle";

                                    return (
                                        <tr key={p.id}>
                                            <td className="ps-4 fw-semibold text-muted small">#{p.id}</td>
                                            <td>
                                                <Link
                                                    href={`/next_panel/orders?search=${encodeURIComponent(p.order_no || "")}`}
                                                    className="text-decoration-none px-2.5 py-1 rounded-2 fw-bold small d-inline-flex align-items-center gap-1.5 shadow-xs transition"
                                                    style={{
                                                        backgroundColor: "#f1f5f9",
                                                        color: "#0f172a",
                                                        border: "1px solid #cbd5e1",
                                                        fontSize: "0.82rem",
                                                    }}
                                                    title="View order details"
                                                >
                                                    <span>{p.order_no || `Order #${p.order_id}`}</span>
                                                    <ExternalLink size={13} style={{ color: "#475569" }} />
                                                </Link>
                                            </td>
                                            <td>
                                                <div className="fw-semibold text-dark small">{p.customer_name || "—"}</div>
                                                <div className="text-muted small">{p.customer_phone || ""}</div>
                                            </td>
                                            <td>
                                                <span className="badge bg-light text-dark border px-2 py-1 small">
                                                    {p.payment_method}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="fw-bold text-navy">
                                                    ₹{Number(p.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge rounded-pill px-2.5 py-1 small ${statusBadge}`}>
                                                    {p.payment_status}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="text-muted small text-truncate" style={{ maxWidth: "160px" }}>
                                                    {p.transaction_no || p.gateway_transaction_id || p.gateway_order_id || "—"}
                                                </div>
                                                {p.payment_provider && (
                                                    <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                                                        Via {p.payment_provider}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="small text-dark fw-medium">
                                                {formatPaymentDate(p.payment_date || p.created_at)}
                                            </td>
                                            <td className="text-end pe-4">
                                                <div className="d-flex align-items-center justify-content-end gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setViewPayment(p)}
                                                        className="btn btn-sm btn-light border p-1.5 text-navy"
                                                        title="View Receipt Details"
                                                    >
                                                        <Receipt size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEdit(p)}
                                                        className="btn btn-sm btn-light border p-1.5 text-navy"
                                                        title="Edit Status & Notes"
                                                    >
                                                        <Edit size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeletePayment(p.id)}
                                                        className="btn btn-sm btn-light border p-1.5 text-danger"
                                                        title="Delete Payment"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal: Record New Payment */}
            {showRecordModal && (
                <div
                    className="modal fade show d-block"
                    tabIndex="-1"
                    style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
                >
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow rounded-4">
                            <div className="modal-header border-bottom px-4 pt-4 pb-3">
                                <h5 className="modal-title fw-bold text-navy d-flex align-items-center gap-2">
                                    <Plus className="text-teal" size={20} />
                                    Record Order Payment
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setShowRecordModal(false)}
                                    disabled={submitting}
                                ></button>
                            </div>

                            <form onSubmit={handleCreatePayment}>
                                <div className="modal-body px-4 py-3">
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-navy mb-1">
                                            Select Order <span className="text-danger">*</span>
                                        </label>
                                        <select
                                            className="form-select"
                                            value={formOrderId}
                                            onChange={(e) => handleOrderSelect(e.target.value)}
                                            required
                                            disabled={submitting}
                                        >
                                            <option value="">-- Choose Order --</option>
                                            {orders.map((o) => (
                                                <option key={o.id} value={o.id}>
                                                    {o.order_no} — {o.customer_name} (₹{Number(o.grand_total).toFixed(2)}) [{o.payment_status}]
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="row g-2 mb-3">
                                        <div className="col-12 col-sm-6">
                                            <label className="form-label small fw-semibold text-navy mb-1">
                                                Amount (₹) <span className="text-danger">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0.01"
                                                className="form-control"
                                                placeholder="999.00"
                                                value={formAmount}
                                                onChange={(e) => setFormAmount(e.target.value)}
                                                required
                                                disabled={submitting}
                                            />
                                        </div>

                                        <div className="col-12 col-sm-6">
                                            <label className="form-label small fw-semibold text-navy mb-1">
                                                Payment Method <span className="text-danger">*</span>
                                            </label>
                                            <select
                                                className="form-select"
                                                value={formMethod}
                                                onChange={(e) => setFormMethod(e.target.value)}
                                                required
                                                disabled={submitting}
                                            >
                                                {PAYMENT_METHODS.map((m) => (
                                                    <option key={m} value={m}>
                                                        {m}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="row g-2 mb-3">
                                        <div className="col-12 col-sm-6">
                                            <label className="form-label small fw-semibold text-navy mb-1">
                                                Payment Status <span className="text-danger">*</span>
                                            </label>
                                            <select
                                                className="form-select"
                                                value={formStatus}
                                                onChange={(e) => setFormStatus(e.target.value)}
                                                required
                                                disabled={submitting}
                                            >
                                                {PAYMENT_STATUSES.map((s) => (
                                                    <option key={s} value={s}>
                                                        {s}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="col-12 col-sm-6">
                                            <label className="form-label small fw-semibold text-navy mb-1">
                                                Payment Provider
                                            </label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="Razorpay / Paytm / Cash"
                                                value={formProvider}
                                                onChange={(e) => setFormProvider(e.target.value)}
                                                disabled={submitting}
                                            />
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-navy mb-1">
                                            Transaction No / Ref ID
                                        </label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="UPI-12345678 / BANK-TXN-987"
                                            value={formTransactionNo}
                                            onChange={(e) => setFormTransactionNo(e.target.value)}
                                            disabled={submitting}
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-navy mb-1">
                                            Notes / Remarks
                                        </label>
                                        <textarea
                                            className="form-control"
                                            rows={2}
                                            placeholder="Collected at counter or verified via bank..."
                                            value={formNotes}
                                            onChange={(e) => setFormNotes(e.target.value)}
                                            disabled={submitting}
                                        />
                                    </div>
                                </div>

                                <div className="modal-footer border-top px-4 py-3">
                                    <button
                                        type="button"
                                        className="btn btn-light"
                                        onClick={() => setShowRecordModal(false)}
                                        disabled={submitting}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-teal text-white"
                                        style={{ backgroundColor: "#00a699", borderColor: "#00a699" }}
                                        disabled={submitting}
                                    >
                                        {submitting ? "Saving..." : "Save Payment"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Edit Payment */}
            {editPayment && (
                <div
                    className="modal fade show d-block"
                    tabIndex="-1"
                    style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
                >
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow rounded-4">
                            <div className="modal-header border-bottom px-4 pt-4 pb-3">
                                <h5 className="modal-title fw-bold text-navy d-flex align-items-center gap-2">
                                    <Edit className="text-teal" size={20} />
                                    Update Payment #{editPayment.id}
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setEditPayment(null)}
                                    disabled={submitting}
                                ></button>
                            </div>

                            <form onSubmit={handleUpdatePayment}>
                                <div className="modal-body px-4 py-3">
                                    <div className="p-3 bg-light rounded-3 mb-3 small">
                                        <div className="d-flex justify-content-between mb-1">
                                            <span className="text-muted">Order:</span>
                                            <span className="fw-bold text-navy">{editPayment.order_no}</span>
                                        </div>
                                        <div className="d-flex justify-content-between mb-1">
                                            <span className="text-muted">Customer:</span>
                                            <span className="fw-semibold text-dark">{editPayment.customer_name}</span>
                                        </div>
                                        <div className="d-flex justify-content-between">
                                            <span className="text-muted">Amount:</span>
                                            <span className="fw-bold text-success">₹{Number(editPayment.amount).toFixed(2)} ({editPayment.payment_method})</span>
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-navy mb-1">
                                            Payment Status <span className="text-danger">*</span>
                                        </label>
                                        <select
                                            className="form-select"
                                            value={editStatus}
                                            onChange={(e) => setEditStatus(e.target.value)}
                                            required
                                            disabled={submitting}
                                        >
                                            {PAYMENT_STATUSES.map((s) => (
                                                <option key={s} value={s}>
                                                    {s}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-navy mb-1">
                                            Transaction No / Ref ID
                                        </label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={editTransactionNo}
                                            onChange={(e) => setEditTransactionNo(e.target.value)}
                                            disabled={submitting}
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-navy mb-1">
                                            Payment Provider
                                        </label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={editProvider}
                                            onChange={(e) => setEditProvider(e.target.value)}
                                            disabled={submitting}
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-navy mb-1">
                                            Notes / Remarks
                                        </label>
                                        <textarea
                                            className="form-control"
                                            rows={2}
                                            value={editNotes}
                                            onChange={(e) => setEditNotes(e.target.value)}
                                            disabled={submitting}
                                        />
                                    </div>
                                </div>

                                <div className="modal-footer border-top px-4 py-3">
                                    <button
                                        type="button"
                                        className="btn btn-light"
                                        onClick={() => setEditPayment(null)}
                                        disabled={submitting}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-teal text-white"
                                        style={{ backgroundColor: "#00a699", borderColor: "#00a699" }}
                                        disabled={submitting}
                                    >
                                        {submitting ? "Updating..." : "Update Payment"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: View Receipt / Details */}
            {viewPayment && (
                <div
                    className="modal fade show d-block"
                    tabIndex="-1"
                    style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
                >
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow rounded-4">
                            <div className="modal-header border-bottom px-4 pt-4 pb-3">
                                <h5 className="modal-title fw-bold text-navy d-flex align-items-center gap-2">
                                    <Receipt className="text-teal" size={20} />
                                    Payment Receipt #{viewPayment.id}
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setViewPayment(null)}
                                ></button>
                            </div>

                            <div className="modal-body px-4 py-3">
                                <div className="text-center py-3 border-bottom mb-3">
                                    <div className="text-muted small text-uppercase fw-semibold">Amount Paid</div>
                                    <div className="display-6 fw-bold text-navy my-1">
                                        ₹{Number(viewPayment.amount).toFixed(2)}
                                    </div>
                                    <span
                                        className={`badge rounded-pill px-3 py-1.5 small ${
                                            viewPayment.payment_status === "Success"
                                                ? "bg-success-subtle text-success border border-success-subtle"
                                                : "bg-warning-subtle text-warning border border-warning-subtle"
                                        }`}
                                    >
                                        {viewPayment.payment_status}
                                    </span>
                                </div>

                                <div className="row g-2 small">
                                    <div className="col-5 text-muted">Order Number:</div>
                                    <div className="col-7 fw-semibold text-navy">{viewPayment.order_no}</div>

                                    <div className="col-5 text-muted">Customer Name:</div>
                                    <div className="col-7 fw-semibold text-dark">{viewPayment.customer_name || "—"}</div>

                                    <div className="col-5 text-muted">Customer Phone:</div>
                                    <div className="col-7 text-dark">{viewPayment.customer_phone || "—"}</div>

                                    <div className="col-5 text-muted">Payment Method:</div>
                                    <div className="col-7 text-dark">{viewPayment.payment_method}</div>

                                    <div className="col-5 text-muted">Provider:</div>
                                    <div className="col-7 text-dark">{viewPayment.payment_provider || "—"}</div>

                                    <div className="col-5 text-muted">Transaction ID:</div>
                                    <div className="col-7 text-dark font-monospace">{viewPayment.transaction_no || "—"}</div>

                                    <div className="col-5 text-muted">Gateway Order ID:</div>
                                    <div className="col-7 text-dark font-monospace">{viewPayment.gateway_order_id || "—"}</div>

                                    <div className="col-5 text-muted">Date & Time:</div>
                                    <div className="col-7 text-dark fw-semibold">
                                        {formatPaymentDate(viewPayment.payment_date || viewPayment.created_at)}
                                    </div>

                                    {viewPayment.notes && (
                                        <>
                                            <div className="col-5 text-muted">Notes:</div>
                                            <div className="col-7 text-dark">{viewPayment.notes}</div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="modal-footer border-top px-4 py-3">
                                <Link
                                    href={`/next_panel/orders?search=${encodeURIComponent(viewPayment.order_no || "")}`}
                                    className="btn btn-outline-navy btn-sm me-auto"
                                    onClick={() => setViewPayment(null)}
                                >
                                    Open Related Order
                                </Link>
                                <button
                                    type="button"
                                    className="btn btn-light btn-sm"
                                    onClick={() => setViewPayment(null)}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
