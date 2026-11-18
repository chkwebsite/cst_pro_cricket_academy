"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    IndianRupee,
    Search,
    SearchSlash,
    Plus,
    UserCheck,
    Calendar,
    Receipt,
    CheckCircle2,
    Clock,
    AlertCircle,
    ArrowRight,
    MapPin,
    Trash2,
    Eye,
} from "lucide-react";
import Pagination from "../components/Pagination";

const STATUS_BADGES = {
    Paid: "bg-success text-white",
    Partial: "bg-info text-white",
    Pending: "bg-warning text-dark",
};

const formatPrice = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "₹0";
    return `₹${n.toLocaleString("en-IN")}`;
};

const formatDate = (v) => {
    if (!v) return "—";
    const [y, m, d] = String(v).slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
};

export default function UmpirePaymentsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    const [duties, setDuties] = useState([]);
    const [payments, setPayments] = useState([]);
    const [stats, setStats] = useState({
        totalDuties: 0,
        totalFeesDue: 0,
        totalFeesPaid: 0,
        totalOutstanding: 0,
        pendingCount: 0,
        partialCount: 0,
        paidCount: 0,
    });

    // Active sub-tab: 'duties' or 'transactions'
    const [activeTab, setActiveTab] = useState("duties");

    // Filters
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("All");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [reloadKey, setReloadKey] = useState(0);

    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    useEffect(() => {
        const controller = new AbortController();

        const loadData = async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (search.trim()) params.set("search", search.trim());
                if (status && status !== "All") params.set("status", status);
                if (dateFrom) params.set("date_from", dateFrom);
                if (dateTo) params.set("date_to", dateTo);

                const res = await fetch(`/api/umpire-payments?${params.toString()}`, {
                    signal: controller.signal,
                });
                const json = await res.json();

                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to load umpire payments.");
                }

                setDuties(json.data.duties || []);
                setPayments(json.data.payments || []);
                setStats(json.data.stats || {});
            } catch (err) {
                if (err.name !== "AbortError") {
                    setError(err.message);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        const timer = setTimeout(loadData, 250);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [search, status, dateFrom, dateTo, reloadKey]);

    const handleClear = () => {
        setSearch("");
        setStatus("All");
        setDateFrom("");
        setDateTo("");
        setPage(1);
    };

    const handleDeletePayment = async (paymentId, amount) => {
        if (!confirm(`Revert payment transaction #${paymentId} of ${formatPrice(amount)}?`)) return;
        setError(null);
        setNotice(null);
        try {
            const res = await fetch(`/api/umpire-payments/${paymentId}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to delete payment record.");
            }
            setNotice("Payment reverted successfully.");
            setReloadKey((k) => k + 1);
        } catch (err) {
            setError(err.message);
        }
    };

    const totalPages = Math.ceil(duties.length / PAGE_SIZE) || 1;
    const pagedDuties = duties.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
        <div className="container-fluid">
            <div className="row g-3">
                {/* Header */}
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-3">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <div>
                                <h3 className="mb-1 d-flex align-items-center gap-2">
                                    <Receipt className="text-primary" size={26} />
                                    <span>Umpire Payments</span>
                                </h3>
                                <p className="text-muted mb-0">
                                    Manage, disburse, and track official fee remuneration for match and ground umpires.
                                </p>
                            </div>
                            <div className="d-flex gap-2">
                                <Link href="/next_panel/umpire-payments/new" className="btn btn-primary px-4 py-2 fw-semibold">
                                    <Plus size={18} className="me-1" /> Record Umpire Payment
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* KPI Metrics */}
                <div className="col-12">
                    <div className="row g-3 mb-2">
                        <div className="col-sm-6 col-xl-3">
                            <div className="card border-0 shadow-sm rounded-4 h-100 p-3 bg-white">
                                <div className="d-flex align-items-center justify-content-between">
                                    <div>
                                        <small className="text-muted fw-semibold">Total Fees Due</small>
                                        <h4 className="fw-bold text-dark mt-1 mb-0">{formatPrice(stats.totalFeesDue)}</h4>
                                        <small className="text-muted">{stats.totalDuties} assigned duties</small>
                                    </div>
                                    <div className="p-3 bg-primary-subtle text-primary rounded-4">
                                        <Receipt size={24} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-sm-6 col-xl-3">
                            <div className="card border-0 shadow-sm rounded-4 h-100 p-3 bg-white">
                                <div className="d-flex align-items-center justify-content-between">
                                    <div>
                                        <small className="text-success fw-semibold">Total Disbursed / Paid</small>
                                        <h4 className="fw-bold text-success mt-1 mb-0">{formatPrice(stats.totalFeesPaid)}</h4>
                                        <small className="text-muted">{stats.paidCount} duties fully paid</small>
                                    </div>
                                    <div className="p-3 bg-success-subtle text-success rounded-4">
                                        <CheckCircle2 size={24} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-sm-6 col-xl-3">
                            <div className="card border-0 shadow-sm rounded-4 h-100 p-3 bg-white">
                                <div className="d-flex align-items-center justify-content-between">
                                    <div>
                                        <small className="text-danger fw-semibold">Pending / Due to Umpires</small>
                                        <h4 className="fw-bold text-danger mt-1 mb-0">{formatPrice(stats.totalOutstanding)}</h4>
                                        <small className="text-muted">{stats.pendingCount} pending · {stats.partialCount} partial</small>
                                    </div>
                                    <div className="p-3 bg-danger-subtle text-danger rounded-4">
                                        <Clock size={24} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-sm-6 col-xl-3">
                            <div className="card border-0 shadow-sm rounded-4 h-100 p-3 bg-white">
                                <div className="d-flex align-items-center justify-content-between">
                                    <div>
                                        <small className="text-info fw-semibold">Payment Transactions</small>
                                        <h4 className="fw-bold text-info mt-1 mb-0">{payments.length}</h4>
                                        <small className="text-muted">Recorded receipts</small>
                                    </div>
                                    <div className="p-3 bg-info-subtle text-info rounded-4">
                                        <IndianRupee size={24} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="col-12">
                    <ul className="nav nav-pills bg-white p-2 rounded-4 shadow-sm">
                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link fw-semibold px-4 py-2 ${activeTab === "duties" ? "active" : ""}`}
                                onClick={() => setActiveTab("duties")}
                            >
                                <Receipt size={16} className="me-2" />
                                Umpire Duties & Remuneration ({duties.length})
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link fw-semibold px-4 py-2 ${activeTab === "transactions" ? "active" : ""}`}
                                onClick={() => setActiveTab("transactions")}
                            >
                                <IndianRupee size={16} className="me-2" />
                                Payment Transaction Receipts ({payments.length})
                            </button>
                        </li>
                    </ul>
                </div>

                {/* Filters */}
                <div className="col-12">
                    <div className="d-flex flex-wrap align-items-center gap-3">
                        <div className="input-group" style={{ maxWidth: "300px" }}>
                            <span className="input-group-text bg-white"><Search size={18} /></span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Umpire, mobile, match, booking"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <select
                            className="form-select"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            style={{ maxWidth: "180px" }}
                        >
                            <option value="All">All Statuses</option>
                            <option value="Pending">Pending</option>
                            <option value="Partial">Partial</option>
                            <option value="Paid">Paid</option>
                        </select>

                        <div className="d-flex align-items-center gap-2">
                            <input
                                type="date"
                                className="form-control"
                                aria-label="Date from"
                                style={{ maxWidth: "165px" }}
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                            />
                            <span className="text-muted">to</span>
                            <input
                                type="date"
                                className="form-control"
                                aria-label="Date to"
                                style={{ maxWidth: "165px" }}
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                            />
                        </div>

                        <button
                            type="button"
                            className="btn btn-outline-danger"
                            onClick={handleClear}
                            title="Clear filters"
                            aria-label="Clear filters"
                        >
                            <SearchSlash size={16} />
                        </button>
                    </div>
                </div>

                {/* Content Table */}
                <div className="col-12">
                    {error && <div className="alert alert-danger">{error}</div>}
                    {notice && <div className="alert alert-success">{notice}</div>}

                    {loading ? (
                        <div className="bg-white rounded-4 shadow-sm text-center py-5 text-muted">
                            <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
                            Loading umpire payment records...
                        </div>
                    ) : activeTab === "duties" ? (
                        duties.length === 0 ? (
                            <div className="bg-white rounded-4 shadow-sm text-center py-5 text-muted">
                                <AlertCircle size={40} className="mb-2 opacity-50" />
                                <h5>No Umpire Assignments Found</h5>
                                <p className="small mb-0">No match or ground booking duties matching your criteria.</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-4 shadow-sm overflow-hidden">
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle mb-0">
                                        <thead className="table-success">
                                            <tr>
                                                <th>#</th>
                                                <th>Umpire</th>
                                                <th>Duty / Event</th>
                                                <th>Venue</th>
                                                <th>Date &amp; Time</th>
                                                <th>Total Fee</th>
                                                <th>Paid Amount</th>
                                                <th>Balance Due</th>
                                                <th>Status</th>
                                                <th className="text-end">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pagedDuties.map((item, idx) => {
                                                const isPaid = item.payment_status === "Paid";
                                                const isPartial = item.payment_status === "Partial";

                                                const payHref = `/next_panel/umpire-payments/new?umpire_id=${item.umpire_id || ""}&match_id=${item.match_id || ""}&booking_id=${item.booking_id || ""}&due=${item.balance_amount || 0}&umpire_name=${encodeURIComponent(item.umpire_name || "")}&duty_no=${encodeURIComponent(item.match_no || item.booking_no || "")}`;

                                                return (
                                                    <tr key={item.duty_key}>
                                                        <th>{(page - 1) * PAGE_SIZE + idx + 1}</th>
                                                        <td>
                                                            <div className="fw-bold text-dark d-flex align-items-center gap-1">
                                                                <UserCheck size={14} className="text-primary" />
                                                                <span>{item.umpire_name || "—"}</span>
                                                            </div>
                                                            {item.umpire_mobile && (
                                                                <small className="text-muted d-block">{item.umpire_mobile}</small>
                                                            )}
                                                            {item.branch_name && (
                                                                <span className="badge bg-light text-secondary border mt-1">
                                                                    {item.branch_name}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <div className="fw-semibold">
                                                                {item.match_no ? item.match_no : item.booking_no}
                                                            </div>
                                                            <span className="badge text-bg-light border me-1">
                                                                {item.match_type}
                                                            </span>
                                                            <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                                                {item.umpire_role}
                                                            </span>
                                                        </td>
                                                        <td style={{ maxWidth: "200px" }}>
                                                            {item.ground_name ? (
                                                                <div className="small">
                                                                    <MapPin size={13} className="me-1 text-muted" />
                                                                    {item.ground_name}
                                                                </div>
                                                            ) : (
                                                                "—"
                                                            )}
                                                        </td>
                                                        <td>
                                                            <div>{formatDate(item.date)}</div>
                                                            {item.time && (
                                                                <small className="text-muted">{item.time.slice(0, 5)}</small>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <strong className="text-dark">{formatPrice(item.fee_amount)}</strong>
                                                        </td>
                                                        <td>
                                                            <span className="text-success fw-bold">{formatPrice(item.paid_amount)}</span>
                                                        </td>
                                                        <td>
                                                            <span className={item.balance_amount > 0 ? "text-danger fw-bold" : "text-muted"}>
                                                                {formatPrice(item.balance_amount)}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className={`badge ${STATUS_BADGES[item.payment_status] || "bg-secondary"}`}>
                                                                {item.payment_status}
                                                            </span>
                                                            {item.last_payment_date && (
                                                                <small className="text-muted d-block mt-1">
                                                                    Paid {formatDate(item.last_payment_date)}
                                                                </small>
                                                            )}
                                                        </td>
                                                        <td className="text-end">
                                                            {!isPaid ? (
                                                                <Link
                                                                    href={payHref}
                                                                    className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1 shadow-sm px-3"
                                                                >
                                                                    <IndianRupee size={14} /> Pay Fee
                                                                </Link>
                                                            ) : (
                                                                <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 d-inline-flex align-items-center gap-1">
                                                                    <CheckCircle2 size={13} /> Fully Paid
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="p-3 border-top">
                                    <Pagination
                                        page={page}
                                        totalPages={totalPages}
                                        total={duties.length}
                                        onPageChange={setPage}
                                        pageSize={PAGE_SIZE}
                                    />
                                </div>
                            </div>
                        )
                    ) : (
                        /* TRANSACTIONS TAB */
                        payments.length === 0 ? (
                            <div className="bg-white rounded-4 shadow-sm text-center py-5 text-muted">
                                <Receipt size={40} className="mb-2 opacity-50" />
                                <h5>No Payment Transactions Found</h5>
                                <p className="small mb-0">Disbursed payments to umpires will appear here.</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-4 shadow-sm overflow-hidden">
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Receipt #</th>
                                                <th>Payment Date</th>
                                                <th>Umpire</th>
                                                <th>Duty Assignment</th>
                                                <th>Amount Paid</th>
                                                <th>Payment Mode</th>
                                                <th>Transaction / Ref No</th>
                                                <th>Remarks</th>
                                                <th className="text-end">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {payments.map((p) => (
                                                <tr key={p.id}>
                                                    <td>
                                                        <span className="fw-bold">RCP-{String(p.id).padStart(5, "0")}</span>
                                                    </td>
                                                    <td>{formatDate(p.payment_date)}</td>
                                                    <td>
                                                        <div className="fw-bold">{p.umpire_name}</div>
                                                        <small className="text-muted">{p.umpire_mobile}</small>
                                                    </td>
                                                    <td>
                                                        {p.match_no ? (
                                                            <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                                                Match: {p.match_no}
                                                            </span>
                                                        ) : p.booking_no ? (
                                                            <span className="badge bg-info-subtle text-info border border-info-subtle">
                                                                Booking: {p.booking_no}
                                                            </span>
                                                        ) : (
                                                            "—"
                                                        )}
                                                    </td>
                                                    <td>
                                                        <strong className="text-success h6 mb-0">{formatPrice(p.amount)}</strong>
                                                    </td>
                                                    <td>
                                                        <span className="badge bg-light text-dark border">
                                                            {p.payment_mode}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {p.transaction_no ? (
                                                            <span className="font-monospace small">{p.transaction_no}</span>
                                                        ) : (
                                                            "—"
                                                        )}
                                                    </td>
                                                    <td className="text-muted small" style={{ maxWidth: "200px" }}>
                                                        {p.remarks || "—"}
                                                    </td>
                                                    <td className="text-end">
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-danger"
                                                            onClick={() => handleDeletePayment(p.id, p.amount)}
                                                            title="Revert / Delete Payment"
                                                            aria-label="Delete Payment"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
