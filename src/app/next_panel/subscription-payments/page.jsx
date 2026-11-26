"use client";

import { useEffect, useState } from "react";
import {
    CreditCard,
    RefreshCw,
    Search,
    Plus,
    IndianRupee,
    CheckCircle2,
    Clock,
    AlertCircle,
    Receipt,
    Download,
    Building2,
} from "lucide-react";

export default function SubscriptionPaymentsPage() {
    const [payments, setPayments] = useState([]);
    const [summary, setSummary] = useState({ total_revenue: 0, total_payments: 0, success_count: 0, pending_count: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    // Filters
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [paymentMode, setPaymentMode] = useState("");

    // Record Payment Modal
    const [showModal, setShowModal] = useState(false);
    const [academies, setAcademies] = useState([]);
    const [formData, setFormData] = useState({
        academy_id: "",
        amount: "",
        payment_mode: "manual",
        payment_status: "success",
        transaction_id: "",
        remarks: "",
    });
    const [submitting, setSubmitting] = useState(false);

    const loadPayments = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set("search", search.trim());
            if (statusFilter) params.set("status", statusFilter);
            if (paymentMode) params.set("payment_mode", paymentMode);

            const res = await fetch(`/api/subscription-payments?${params.toString()}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to load payments");

            setPayments(json.data || []);
            setSummary(json.summary || { total_revenue: 0, total_payments: 0, success_count: 0, pending_count: 0 });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadAcademies = async () => {
        try {
            const res = await fetch("/api/academies");
            const json = await res.json();
            if (res.ok) setAcademies(json.data || []);
        } catch (_) {}
    };

    useEffect(() => {
        loadPayments();
        loadAcademies();
    }, [statusFilter, paymentMode]);

    const handleSearch = (e) => {
        e.preventDefault();
        loadPayments();
    };

    const handleOpenModal = () => {
        setFormData({
            academy_id: academies[0]?.id || "",
            amount: "",
            payment_mode: "manual",
            payment_status: "success",
            transaction_id: "",
            remarks: "Manual offline payment recorded",
        });
        setShowModal(true);
    };

    const handleRecordPayment = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        setSuccessMsg(null);

        try {
            const res = await fetch("/api/subscription-payments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    academy_id: Number(formData.academy_id),
                    amount: Number(formData.amount),
                    payment_mode: formData.payment_mode,
                    payment_status: formData.payment_status,
                    transaction_id: formData.transaction_id.trim() || null,
                    remarks: formData.remarks,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to record payment");

            setSuccessMsg(`Payment recorded successfully! Invoice: ${json.data?.invoice_number}`);
            setShowModal(false);
            loadPayments();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const formatINR = (val) => {
        return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(val || 0);
    };

    return (
        <div className="container-fluid py-2">
            {/* Header */}
            <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                    <div>
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <CreditCard className="text-primary" size={26} />
                            <h1 className="h4 mb-0 fw-bold">SaaS Subscription Payments</h1>
                        </div>
                        <p className="text-muted mb-0 small">
                            Track subscription payments, financial transaction logs, and generate invoice references.
                        </p>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        <button
                            type="button"
                            onClick={handleOpenModal}
                            className="btn btn-primary btn-sm d-flex align-items-center gap-1.5"
                        >
                            <Plus size={15} /> Record Manual Payment
                        </button>
                        <button
                            type="button"
                            onClick={loadPayments}
                            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                        >
                            <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
                        </button>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="row g-3 mt-3 pt-3 border-top">
                    <div className="col-12 col-sm-6 col-md-3">
                        <div className="p-3 bg-light rounded-3 border">
                            <div className="text-muted small">Total Subscription Revenue</div>
                            <div className="h4 fw-bold text-success mb-0 mt-1">
                                {formatINR(summary.total_revenue)}
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-sm-6 col-md-3">
                        <div className="p-3 bg-light rounded-3 border">
                            <div className="text-muted small">Total Payments</div>
                            <div className="h4 fw-bold text-dark mb-0 mt-1">
                                {summary.total_payments}
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-sm-6 col-md-3">
                        <div className="p-3 bg-light rounded-3 border">
                            <div className="text-muted small">Successful Transactions</div>
                            <div className="h4 fw-bold text-primary mb-0 mt-1">
                                {summary.success_count}
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-sm-6 col-md-3">
                        <div className="p-3 bg-light rounded-3 border">
                            <div className="text-muted small">Pending / Other</div>
                            <div className="h4 fw-bold text-warning mb-0 mt-1">
                                {summary.pending_count}
                            </div>
                        </div>
                    </div>
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

            {/* Filters Bar */}
            <div className="bg-white rounded-4 shadow-sm p-3 mb-4">
                <form onSubmit={handleSearch} className="row g-2 align-items-center">
                    <div className="col-12 col-md-5">
                        <div className="input-group">
                            <span className="input-group-text bg-light border-end-0">
                                <Search size={16} className="text-muted" />
                            </span>
                            <input
                                type="text"
                                className="form-control border-start-0 ps-0"
                                placeholder="Search by invoice #, transaction ID, or academy..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <select
                            className="form-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">All Payment Statuses</option>
                            <option value="success">Success</option>
                            <option value="pending">Pending</option>
                            <option value="failed">Failed</option>
                            <option value="refunded">Refunded</option>
                        </select>
                    </div>
                    <div className="col-6 col-md-2">
                        <select
                            className="form-select"
                            value={paymentMode}
                            onChange={(e) => setPaymentMode(e.target.value)}
                        >
                            <option value="">All Modes</option>
                            <option value="manual">Manual / Cash</option>
                            <option value="bank_transfer">Bank Transfer</option>
                            <option value="upi">UPI</option>
                            <option value="online">Online</option>
                        </select>
                    </div>
                    <div className="col-12 col-md-2 d-flex gap-2">
                        <button type="submit" className="btn btn-primary flex-fill">
                            Search
                        </button>
                        <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => {
                                setSearch("");
                                setStatusFilter("");
                                setPaymentMode("");
                                setTimeout(() => loadPayments(), 0);
                            }}
                        >
                            Reset
                        </button>
                    </div>
                </form>
            </div>

            {/* Payments Table */}
            <div className="bg-white rounded-4 shadow-sm overflow-hidden mb-4">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light text-muted small text-uppercase">
                            <tr>
                                <th className="ps-4">Invoice #</th>
                                <th>Academy</th>
                                <th>Plan</th>
                                <th>Amount (₹)</th>
                                <th>Mode</th>
                                <th>Date & Time</th>
                                <th>Status</th>
                                <th className="pe-4">Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="text-center py-5">
                                        <div className="spinner-border text-primary spinner-border-sm me-2" role="status"></div>
                                        <span className="text-muted small">Loading payments...</span>
                                    </td>
                                </tr>
                            ) : payments.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="text-center py-5 text-muted">
                                        No subscription payments found.
                                    </td>
                                </tr>
                            ) : (
                                payments.map((p) => (
                                    <tr key={p.id}>
                                        <td className="ps-4 font-monospace fw-bold text-dark">
                                            {p.invoice_number}
                                            <div className="text-muted fw-normal" style={{ fontSize: "0.75rem" }}>
                                                TXN: {p.transaction_id}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="fw-semibold text-dark">{p.academy_name}</div>
                                            <div className="small text-muted font-monospace">{p.academy_code}</div>
                                        </td>
                                        <td>
                                            <span className="badge bg-light text-secondary border">
                                                {p.plan_name || "SaaS Plan"}
                                            </span>
                                        </td>
                                        <td className="fw-bold text-success">
                                            {formatINR(p.amount)}
                                        </td>
                                        <td className="text-capitalize small">
                                            {String(p.payment_mode).replace(/_/g, " ")}
                                        </td>
                                        <td className="small text-muted">
                                            {new Date(p.payment_date || p.created_at).toLocaleString()}
                                        </td>
                                        <td>
                                            <span className={`badge px-2.5 py-1 rounded-pill ${
                                                p.payment_status === "success"
                                                    ? "bg-success-subtle text-success border border-success-subtle"
                                                    : p.payment_status === "pending"
                                                    ? "bg-warning-subtle text-warning-emphasis border border-warning-subtle"
                                                    : "bg-danger-subtle text-danger"
                                            }`}>
                                                {p.payment_status}
                                            </span>
                                        </td>
                                        <td className="pe-4 small text-secondary">
                                            {p.remarks || "-"}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal: Record Manual Payment */}
            {showModal && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content rounded-4 border-0 shadow">
                            <div className="modal-header border-bottom px-4 pt-4 pb-3">
                                <h5 className="modal-title fw-bold">Record Manual Subscription Payment</h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setShowModal(false)}
                                    disabled={submitting}
                                ></button>
                            </div>

                            <form onSubmit={handleRecordPayment}>
                                <div className="modal-body px-4 py-3">
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small">
                                            Academy <span className="text-danger">*</span>
                                        </label>
                                        <select
                                            className="form-select"
                                            value={formData.academy_id}
                                            onChange={(e) => setFormData({ ...formData, academy_id: e.target.value })}
                                            required
                                        >
                                            {academies.map((a) => (
                                                <option key={a.id} value={a.id}>
                                                    {a.academy_name} ({a.academy_code})
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
                                                placeholder="e.g. 27999"
                                                value={formData.amount}
                                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label fw-semibold small">Payment Mode</label>
                                            <select
                                                className="form-select"
                                                value={formData.payment_mode}
                                                onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                                            >
                                                <option value="manual">Manual / Cash</option>
                                                <option value="bank_transfer">Bank Transfer / NEFT</option>
                                                <option value="upi">UPI</option>
                                                <option value="cheque">Cheque</option>
                                                <option value="online">Online Gateway</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small">Transaction Reference / UTR</label>
                                        <input
                                            type="text"
                                            className="form-control font-monospace"
                                            placeholder="e.g. UTR12345678 (optional)"
                                            value={formData.transaction_id}
                                            onChange={(e) => setFormData({ ...formData, transaction_id: e.target.value })}
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small">Remarks</label>
                                        <textarea
                                            className="form-control"
                                            rows="2"
                                            placeholder="Notes regarding this payment..."
                                            value={formData.remarks}
                                            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                        ></textarea>
                                    </div>
                                </div>

                                <div className="modal-footer border-top px-4 py-3">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        onClick={() => setShowModal(false)}
                                        disabled={submitting}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={submitting}
                                    >
                                        {submitting ? "Recording..." : "Record Payment"}
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
