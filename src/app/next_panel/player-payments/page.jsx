"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
    Calendar,
    CheckCircle2,
    CreditCard,
    DollarSign,
    Edit,
    Eye,
    Filter,
    Plus,
    Printer,
    Receipt,
    Search,
    Trash2,
    XCircle,
    ArrowLeft,
    AlertCircle,
} from "lucide-react";
import { useUser } from "../components/UserContext";

const STATUS_BADGE = {
    Success: "bg-success text-white",
    Failed: "bg-danger text-white",
    Refunded: "bg-warning text-dark",
    Paid: "bg-success text-white",
    Partial: "bg-warning text-dark",
    Pending: "bg-secondary text-white",
    Cancelled: "bg-danger text-white",
};

function PlayerPaymentsContent() {
    const searchParams = useSearchParams();
    const feeIdParam = searchParams.get("player_program_fee_id");
    const admissionPlayerIdParam = searchParams.get("admission_players_id");
    const initialSearchParam = searchParams.get("search") || "";

    const { user } = useUser();
    const hasSessionUser = Boolean(user);
    const userAcademyId = user?.academy_id;
    const hasAssignedAcademy =
        userAcademyId !== null && userAcademyId !== undefined && userAcademyId !== "" && Number(userAcademyId) !== 0;

    const [payments, setPayments] = useState([]);
    const [feeInfo, setFeeInfo] = useState(null);
    const [loadingFeeInfo, setLoadingFeeInfo] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    // Filters
    const [search, setSearch] = useState(initialSearchParam);
    const [paymentMode, setPaymentMode] = useState("");
    const [paymentStatus, setPaymentStatus] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    // Load fee info if landing with player_program_fee_id
    useEffect(() => {
        if (!feeIdParam) {
            setFeeInfo(null);
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                setLoadingFeeInfo(true);
                const res = await fetch(`/api/player-program-fees/${feeIdParam}`);
                const json = await res.json();
                if (!cancelled && res.ok && json.success) {
                    setFeeInfo(json.data);
                }
            } catch {
                if (!cancelled) setFeeInfo(null);
            } finally {
                if (!cancelled) setLoadingFeeInfo(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [feeIdParam]);

    const loadPayments = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (hasAssignedAcademy) params.set("academy_id", String(userAcademyId));
            if (feeIdParam) params.set("player_program_fee_id", feeIdParam);
            if (admissionPlayerIdParam) params.set("admission_players_id", admissionPlayerIdParam);
            if (paymentMode) params.set("payment_mode", paymentMode);
            if (paymentStatus) params.set("payment_status", paymentStatus);
            if (fromDate) params.set("from_date", fromDate);
            if (toDate) params.set("to_date", toDate);
            if (search.trim()) params.set("search", search.trim());

            const res = await fetch(`/api/player-payments?${params.toString()}`);
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to load payments.");
            setPayments(json.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!hasSessionUser) return;
        loadPayments();
    }, [hasSessionUser, feeIdParam, admissionPlayerIdParam, paymentMode, paymentStatus, fromDate, toDate]);

    const handleSearch = (e) => {
        e.preventDefault();
        loadPayments();
    };

    const handleClear = () => {
        setSearch("");
        setPaymentMode("");
        setPaymentStatus("");
        setFromDate("");
        setToDate("");
    };

    const handleDelete = async (p) => {
        if (p.payment_status !== "Failed") {
            return alert("Only payments marked with status 'Failed' can be deleted to maintain audit integrity.");
        }
        if (!confirm(`Are you sure you want to delete payment receipt ${p.receipt_no}?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/player-payments/${p.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete payment.");

            setNotice("Payment record deleted successfully.");
            loadPayments();
        } catch (err) {
            setError(err.message);
        }
    };

    // Summary calculations
    const stats = payments.reduce(
        (acc, item) => {
            const amt = Number(item.paid_amount) || 0;
            if (item.payment_status === "Success" || !item.payment_status) {
                acc.totalCollected += amt;
                if (item.payment_mode === "Cash") acc.cashCollected += amt;
                else if (item.payment_mode === "UPI") acc.upiCollected += amt;
                else acc.otherCollected += amt;
            }
            return acc;
        },
        { totalCollected: 0, cashCollected: 0, upiCollected: 0, otherCollected: 0 }
    );

    return (
        <div className="container-fluid py-4">
            {/* Header */}
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
                <div>
                    <h4 className="mb-0 fw-bold">Player Fee Payments & Receipts</h4>
                    <small className="text-muted">View collection logs, printable receipts, and payment transactions.</small>
                </div>
                <div className="d-flex gap-2">
                    <Link
                        href="/next_panel/player-fees-matrix"
                        className="btn btn-outline-info d-flex align-items-center gap-1"
                    >
                        <Calendar size={16} /> Yearly Matrix (Jan-Dec)
                    </Link>
                    <Link
                        href="/next_panel/player-program-fees"
                        className="btn btn-outline-primary d-flex align-items-center gap-1"
                    >
                        <Receipt size={16} /> Fee Invoices
                    </Link>
                    <Link
                        href={feeIdParam ? `/next_panel/player-payments/new?player_program_fee_id=${feeIdParam}` : "/next_panel/player-payments/new"}
                        className="btn btn-success d-flex align-items-center gap-1 fw-semibold"
                    >
                        <Plus size={16} /> Record Payment
                    </Link>
                </div>
            </div>

            {/* Context Banner: Landing with specific fee invoice */}
            {feeIdParam && (
                <div className="card border-0 shadow-sm mb-4 border-start border-4 border-primary bg-light">
                    <div className="card-body p-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
                        <div>
                            <div className="d-flex align-items-center gap-2">
                                <span className="badge bg-primary">Invoice #{feeIdParam}</span>
                                {feeInfo && (
                                    <h6 className="mb-0 fw-bold text-dark">
                                        {feeInfo.player_name} ({feeInfo.admission_no}) — {feeInfo.program_name} [{feeInfo.fee_month_name}]
                                    </h6>
                                )}
                            </div>
                            {feeInfo && (
                                <div className="d-flex flex-wrap align-items-center gap-3 mt-2 text-muted small">
                                    <span>Total: <strong>₹{Number(feeInfo.total_amount).toFixed(2)}</strong></span>
                                    <span>Paid: <strong className="text-success">₹{Number(feeInfo.paid_amount).toFixed(2)}</strong></span>
                                    <span>Due: <strong className="text-danger">₹{Number(feeInfo.due_amount).toFixed(2)}</strong></span>
                                    <span>
                                        Status:{" "}
                                        <span className={`badge ${STATUS_BADGE[feeInfo.payment_status] || "bg-secondary"}`}>
                                            {feeInfo.payment_status}
                                        </span>
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="d-flex gap-2 align-items-center">
                            {feeInfo && feeInfo.payment_status !== "Paid" && (
                                <Link
                                    href={`/next_panel/player-payments/new?player_program_fee_id=${feeIdParam}`}
                                    className="btn btn-sm btn-success fw-semibold d-flex align-items-center gap-1"
                                >
                                    <Plus size={14} /> Pay Balance (₹{Number(feeInfo.due_amount).toFixed(2)})
                                </Link>
                            )}
                            <Link
                                href="/next_panel/player-fees-matrix"
                                className="btn btn-sm btn-outline-info d-flex align-items-center gap-1"
                            >
                                <ArrowLeft size={14} /> Back to Matrix
                            </Link>
                            <Link href="/next_panel/player-payments" className="btn btn-sm btn-outline-secondary">
                                Clear Filter / Show All
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Notifications */}
            {notice && (
                <div className="alert alert-success alert-dismissible fade show" role="alert">
                    {notice}
                    <button type="button" className="btn-close" onClick={() => setNotice(null)} />
                </div>
            )}
            {error && (
                <div className="alert alert-danger alert-dismissible fade show" role="alert">
                    {error}
                    <button type="button" className="btn-close" onClick={() => setError(null)} />
                </div>
            )}

            {/* Stat Cards */}
            <div className="row g-3 mb-4">
                <div className="col-sm-6 col-xl-3">
                    <div className="card shadow-sm border-0 border-start border-success border-4 h-100">
                        <div className="card-body">
                            <div className="text-muted small fw-semibold text-uppercase">Total Collections</div>
                            <div className="fs-4 fw-bold text-success mt-1">
                                ₹{stats.totalCollected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </div>
                            <div className="small text-muted mt-1">{payments.length} Transactions Recorded</div>
                        </div>
                    </div>
                </div>

                <div className="col-sm-6 col-xl-3">
                    <div className="card shadow-sm border-0 border-start border-primary border-4 h-100">
                        <div className="card-body">
                            <div className="text-muted small fw-semibold text-uppercase">Cash Collections</div>
                            <div className="fs-4 fw-bold text-primary mt-1">
                                ₹{stats.cashCollected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </div>
                            <div className="small text-muted mt-1">Physical cash payments</div>
                        </div>
                    </div>
                </div>

                <div className="col-sm-6 col-xl-3">
                    <div className="card shadow-sm border-0 border-start border-info border-4 h-100">
                        <div className="card-body">
                            <div className="text-muted small fw-semibold text-uppercase">UPI Collections</div>
                            <div className="fs-4 fw-bold text-info mt-1">
                                ₹{stats.upiCollected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </div>
                            <div className="small text-muted mt-1">Digital UPI / QR transfers</div>
                        </div>
                    </div>
                </div>

                <div className="col-sm-6 col-xl-3">
                    <div className="card shadow-sm border-0 border-start border-warning border-4 h-100">
                        <div className="card-body">
                            <div className="text-muted small fw-semibold text-uppercase">Other Collections</div>
                            <div className="fs-4 fw-bold text-warning mt-1">
                                ₹{stats.otherCollected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </div>
                            <div className="small text-muted mt-1">Card, Cheque, Bank Transfer</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="card shadow-sm border-0 mb-4">
                <div className="card-body p-3">
                    <form onSubmit={handleSearch} className="row g-2 align-items-center">
                        <div className="col-md-3">
                            <div className="input-group">
                                <span className="input-group-text bg-white border-end-0">
                                    <Search size={16} className="text-muted" />
                                </span>
                                <input
                                    type="text"
                                    className="form-control border-start-0"
                                    placeholder="Search receipt, player, adm no..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="col-md-2">
                            <select
                                className="form-select"
                                value={paymentMode}
                                onChange={(e) => setPaymentMode(e.target.value)}
                            >
                                <option value="">All Payment Modes</option>
                                <option value="Cash">Cash</option>
                                <option value="UPI">UPI</option>
                                <option value="Card">Card</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="Cheque">Cheque</option>
                            </select>
                        </div>

                        <div className="col-md-2">
                            <select
                                className="form-select"
                                value={paymentStatus}
                                onChange={(e) => setPaymentStatus(e.target.value)}
                            >
                                <option value="">All Statuses</option>
                                <option value="Success">Success</option>
                                <option value="Failed">Failed</option>
                                <option value="Refunded">Refunded</option>
                            </select>
                        </div>

                        <div className="col-md-2">
                            <input
                                type="date"
                                className="form-control"
                                title="From Date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                            />
                        </div>

                        <div className="col-md-1">
                            <input
                                type="date"
                                className="form-control"
                                title="To Date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                            />
                        </div>

                        <div className="col-md-2 d-flex gap-2">
                            <button type="submit" className="btn btn-outline-primary flex-grow-1">
                                Filter
                            </button>
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={handleClear}
                                title="Reset Filters"
                            >
                                Reset
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Payments Table */}
            <div className="card shadow-sm border-0">
                <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                    <h6 className="mb-0 fw-bold">Payments Received ({payments.length})</h6>
                </div>

                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                            <tr>
                                <th>Receipt No</th>
                                <th>Date</th>
                                <th>Player Details</th>
                                <th>Program & Month</th>
                                <th className="text-end">Amount Paid</th>
                                <th>Mode & Reference</th>
                                <th>Received By</th>
                                <th className="text-center">Status</th>
                                <th className="text-center" style={{ width: "130px" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="9" className="text-center py-5 text-muted">
                                        <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
                                        Loading payments...
                                    </td>
                                </tr>
                            ) : payments.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="text-center py-5 text-muted">
                                        {feeIdParam ? (
                                            <div>
                                                <AlertCircle size={32} className="text-warning mb-2" />
                                                <p className="mb-2">No payments recorded yet for Invoice #{feeIdParam}.</p>
                                                <Link
                                                    href={`/next_panel/player-payments/new?player_program_fee_id=${feeIdParam}`}
                                                    className="btn btn-sm btn-success fw-semibold"
                                                >
                                                    <Plus size={14} className="me-1" /> Record First Payment
                                                </Link>
                                            </div>
                                        ) : (
                                            "No payments recorded matching your filters."
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                payments.map((p) => (
                                    <tr key={p.id}>
                                        <td>
                                            <Link
                                                href={`/next_panel/player-payments/${p.id}`}
                                                className="fw-bold font-monospace text-decoration-none"
                                            >
                                                {p.receipt_no}
                                            </Link>
                                        </td>
                                        <td className="small text-muted">
                                            {p.payment_date ? p.payment_date.slice(0, 10) : "-"}
                                        </td>
                                        <td>
                                            <div className="fw-semibold text-dark">{p.player_name || "N/A"}</div>
                                            <small className="text-muted">{p.admission_no || "-"}</small>
                                        </td>
                                        <td>
                                            <div className="fw-semibold">{p.program_name || "-"}</div>
                                            <small className="text-muted">{p.fee_month_name || "-"}</small>
                                        </td>
                                        <td className="text-end fw-bold text-success">
                                            ₹{Number(p.paid_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                        </td>
                                        <td>
                                            <span className="badge bg-light text-dark border me-1">
                                                {p.payment_mode}
                                            </span>
                                            {p.transaction_no && (
                                                <div className="small text-muted font-monospace mt-1">
                                                    Ref: {p.transaction_no}
                                                </div>
                                            )}
                                        </td>
                                        <td className="small text-muted">{p.received_by_name || "-"}</td>
                                        <td className="text-center">
                                            <span className={`badge ${STATUS_BADGE[p.payment_status] || "bg-secondary"}`}>
                                                {p.payment_status || "Success"}
                                            </span>
                                        </td>
                                        <td className="text-center">
                                            <div className="d-flex justify-content-center gap-1">
                                                <Link
                                                    href={`/next_panel/player-payments/${p.id}`}
                                                    className="btn btn-sm btn-outline-primary"
                                                    title="View Receipt"
                                                >
                                                    <Eye size={14} />
                                                </Link>
                                                <Link
                                                    href={`/next_panel/player-payments/${p.id}/edit`}
                                                    className="btn btn-sm btn-outline-secondary"
                                                    title="Edit Payment Note"
                                                >
                                                    <Edit size={14} />
                                                </Link>
                                                {p.payment_status === "Failed" && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger"
                                                        onClick={() => handleDelete(p)}
                                                        title="Delete Failed Record"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default function PlayerPaymentsPage() {
    return (
        <Suspense
            fallback={
                <div className="container-fluid py-5 text-center text-muted">
                    <div className="spinner-border text-primary me-2" role="status" />
                    Loading payments...
                </div>
            }
        >
            <PlayerPaymentsContent />
        </Suspense>
    );
}
