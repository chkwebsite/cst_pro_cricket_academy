"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Calendar,
    CheckCircle2,
    Clock,
    CreditCard,
    DollarSign,
    Edit,
    Eye,
    Filter,
    Plus,
    Receipt,
    Search,
    Trash2,
    UserCheck,
    XCircle,
} from "lucide-react";
import { useUser } from "../components/UserContext";

const STATUS_BADGE = {
    Paid: "bg-success text-white",
    Partial: "bg-warning text-dark",
    Pending: "bg-secondary text-white",
    Cancelled: "bg-danger text-white",
};

export default function PlayerProgramFeesPage() {
    const { user } = useUser();
    const hasSessionUser = Boolean(user);
    const userAcademyId = user?.academy_id;
    const hasAssignedAcademy =
        userAcademyId !== null && userAcademyId !== undefined && userAcademyId !== "" && Number(userAcademyId) !== 0;

    const [fees, setFees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    // Filters
    const [search, setSearch] = useState("");
    const [month, setMonth] = useState("");
    const [status, setStatus] = useState("");
    const [programId, setProgramId] = useState("");
    const [programs, setPrograms] = useState([]);

    // Load programs for dropdown
    useEffect(() => {
        if (!hasSessionUser) return;
        (async () => {
            try {
                const res = await fetch("/api/programs");
                const json = await res.json();
                if (res.ok && json.success) setPrograms(json.data || []);
            } catch {
                /* ignore */
            }
        })();
    }, [hasSessionUser]);

    // Load Fees
    const loadFees = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (hasAssignedAcademy) params.set("academy_id", String(userAcademyId));
            if (month) params.set("month", month);
            if (status) params.set("payment_status", status);
            if (programId) params.set("program_id", programId);
            if (search.trim()) params.set("search", search.trim());

            const res = await fetch(`/api/player-program-fees?${params.toString()}`);
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to load fee invoices.");
            setFees(json.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!hasSessionUser) return;
        loadFees();
    }, [hasSessionUser, month, status, programId]);

    const handleSearch = (e) => {
        e.preventDefault();
        loadFees();
    };

    const handleClear = () => {
        setSearch("");
        setMonth("");
        setStatus("");
        setProgramId("");
        setTimeout(loadFees, 0);
    };

    // Delete fee invoice
    const handleDelete = async (fee) => {
        if (Number(fee.paid_amount) > 0) {
            return alert("Cannot delete an invoice that has payments recorded. Please refund or remove the payments first.");
        }
        if (!confirm(`Are you sure you want to delete fee invoice #${fee.id} for ${fee.player_name}?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/player-program-fees/${fee.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete fee invoice.");

            setNotice("Fee invoice deleted successfully.");
            loadFees();
        } catch (err) {
            setError(err.message);
        }
    };

    // Summary calculations
    const stats = fees.reduce(
        (acc, item) => {
            const total = Number(item.total_amount) || 0;
            const paid = Number(item.paid_amount) || 0;
            const due = Number(item.due_amount) || 0;
            acc.totalInvoiced += total;
            acc.totalPaid += paid;
            acc.totalDue += due;

            if (item.payment_status === "Paid") acc.paidCount += 1;
            else if (item.payment_status === "Partial") acc.partialCount += 1;
            else if (item.payment_status === "Pending") acc.pendingCount += 1;
            return acc;
        },
        { totalInvoiced: 0, totalPaid: 0, totalDue: 0, paidCount: 0, partialCount: 0, pendingCount: 0 }
    );

    return (
        <div className="container-fluid py-4">
            {/* Page Header */}
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
                <div>
                    <h4 className="mb-0 fw-bold">Player Monthly Program Fees</h4>
                    <small className="text-muted">Manage recurring monthly fee invoices, collections, and dues.</small>
                </div>
                <div className="d-flex gap-2">
                    <Link
                        href="/next_panel/player-fees-matrix"
                        className="btn btn-outline-info d-flex align-items-center gap-1"
                    >
                        <Calendar size={16} /> Yearly Matrix (Jan-Dec)
                    </Link>
                    <Link
                        href="/next_panel/player-payments"
                        className="btn btn-outline-primary d-flex align-items-center gap-1"
                    >
                        <Receipt size={16} /> View Payments
                    </Link>
                    <Link
                        href="/next_panel/player-program-fees/new"
                        className="btn btn-primary d-flex align-items-center gap-1 fw-semibold"
                    >
                        <Plus size={16} /> Generate Invoice
                    </Link>
                </div>
            </div>

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

            {/* Statistics Row */}
            <div className="row g-3 mb-4">
                <div className="col-sm-6 col-xl-3">
                    <div className="card shadow-sm border-0 border-start border-primary border-4 h-100">
                        <div className="card-body">
                            <div className="text-muted small fw-semibold text-uppercase">Total Invoiced</div>
                            <div className="fs-4 fw-bold text-dark mt-1">₹{stats.totalInvoiced.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                            <div className="small text-muted mt-1">{fees.length} Total Invoices</div>
                        </div>
                    </div>
                </div>

                <div className="col-sm-6 col-xl-3">
                    <div className="card shadow-sm border-0 border-start border-success border-4 h-100">
                        <div className="card-body">
                            <div className="text-muted small fw-semibold text-uppercase">Total Collected</div>
                            <div className="fs-4 fw-bold text-success mt-1">₹{stats.totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                            <div className="small text-muted mt-1">{stats.paidCount} Paid In Full</div>
                        </div>
                    </div>
                </div>

                <div className="col-sm-6 col-xl-3">
                    <div className="card shadow-sm border-0 border-start border-danger border-4 h-100">
                        <div className="card-body">
                            <div className="text-muted small fw-semibold text-uppercase">Outstanding Due</div>
                            <div className="fs-4 fw-bold text-danger mt-1">₹{stats.totalDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                            <div className="small text-muted mt-1">{stats.partialCount} Partial · {stats.pendingCount} Pending</div>
                        </div>
                    </div>
                </div>

                <div className="col-sm-6 col-xl-3">
                    <div className="card shadow-sm border-0 border-start border-info border-4 h-100">
                        <div className="card-body">
                            <div className="text-muted small fw-semibold text-uppercase">Collection Rate</div>
                            <div className="fs-4 fw-bold text-info mt-1">
                                {stats.totalInvoiced > 0
                                    ? `${((stats.totalPaid / stats.totalInvoiced) * 100).toFixed(1)}%`
                                    : "0%"}
                            </div>
                            <div className="small text-muted mt-1">Collected vs Invoiced</div>
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
                                    placeholder="Search player, adm no..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="col-md-2">
                            <input
                                type="month"
                                className="form-control"
                                title="Fee Month"
                                value={month}
                                onChange={(e) => setMonth(e.target.value)}
                            />
                        </div>

                        <div className="col-md-2">
                            <select
                                className="form-select"
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                            >
                                <option value="">All Statuses</option>
                                <option value="Pending">Pending</option>
                                <option value="Partial">Partial</option>
                                <option value="Paid">Paid</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                        </div>

                        <div className="col-md-3">
                            <select
                                className="form-select"
                                value={programId}
                                onChange={(e) => setProgramId(e.target.value)}
                            >
                                <option value="">All Programs</option>
                                {programs.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.program_name}
                                    </option>
                                ))}
                            </select>
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

            {/* Invoices Table */}
            <div className="card shadow-sm border-0">
                <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                    <h6 className="mb-0 fw-bold">Invoices ({fees.length})</h6>
                </div>

                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                            <tr>
                                <th style={{ width: "80px" }}>ID</th>
                                <th>Player Details</th>
                                <th>Program</th>
                                <th>Month</th>
                                <th className="text-end">Total Amount</th>
                                <th className="text-end">Paid</th>
                                <th className="text-end">Balance Due</th>
                                <th className="text-center">Status</th>
                                <th>Due Date</th>
                                <th className="text-center" style={{ width: "160px" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="10" className="text-center py-5 text-muted">
                                        <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
                                        Loading fee records...
                                    </td>
                                </tr>
                            ) : fees.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="text-center py-5 text-muted">
                                        No fee invoices found for the selected criteria.
                                    </td>
                                </tr>
                            ) : (
                                fees.map((f) => {
                                    const due = Number(f.due_amount) || 0;
                                    const canPay = due > 0 && f.payment_status !== "Cancelled";

                                    return (
                                        <tr key={f.id}>
                                            <td className="fw-semibold text-muted">#{f.id}</td>
                                            <td>
                                                <div className="fw-semibold text-dark">{f.player_name}</div>
                                                <div className="small text-muted">Adm: {f.admission_no}</div>
                                            </td>
                                            <td>
                                                <span className="badge bg-light text-dark border">
                                                    {f.program_name}
                                                </span>
                                            </td>
                                            <td className="fw-semibold">
                                                {f.fee_month_name || f.fee_month?.slice(0, 7)}
                                            </td>
                                            <td className="text-end fw-semibold">
                                                ₹{Number(f.total_amount).toFixed(2)}
                                            </td>
                                            <td className="text-end text-success fw-semibold">
                                                ₹{Number(f.paid_amount).toFixed(2)}
                                            </td>
                                            <td className="text-end fw-bold">
                                                <span className={due > 0 ? "text-danger" : "text-muted"}>
                                                    ₹{due.toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="text-center">
                                                <span className={`badge ${STATUS_BADGE[f.payment_status] || "bg-secondary"}`}>
                                                    {f.payment_status}
                                                </span>
                                            </td>
                                            <td className="small text-muted">
                                                {f.due_date ? f.due_date.slice(0, 10) : "—"}
                                            </td>
                                            <td>
                                                <div className="d-flex justify-content-center align-items-center gap-1">
                                                    <Link
                                                        href={`/next_panel/player-program-fees/${f.id}`}
                                                        className="btn btn-outline-info btn-sm p-1"
                                                        title="View Invoice"
                                                    >
                                                        <Eye size={16} />
                                                    </Link>

                                                    {canPay && (
                                                        <Link
                                                            href={`/next_panel/player-payments/new?player_program_fee_id=${f.id}`}
                                                            className="btn btn-outline-success btn-sm p-1"
                                                            title="Receive Payment"
                                                        >
                                                            <CreditCard size={16} />
                                                        </Link>
                                                    )}

                                                    <Link
                                                        href={`/next_panel/player-program-fees/${f.id}/edit`}
                                                        className="btn btn-outline-primary btn-sm p-1"
                                                        title="Edit Invoice"
                                                    >
                                                        <Edit size={16} />
                                                    </Link>

                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-danger btn-sm p-1"
                                                        onClick={() => handleDelete(f)}
                                                        title="Delete Invoice"
                                                        disabled={Number(f.paid_amount) > 0}
                                                    >
                                                        <Trash2 size={16} />
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
        </div>
    );
}
