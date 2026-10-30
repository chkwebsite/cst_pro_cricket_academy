"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
    Calendar,
    CheckCircle2,
    Clock,
    AlertCircle,
    Receipt,
    Plus,
    Search,
    RefreshCw,
    Filter,
    DollarSign,
    CreditCard,
    ArrowRight,
    Users,
    TrendingUp,
    ChevronRight,
} from "lucide-react";
import { useUser } from "../components/UserContext";
import Pagination from "../components/Pagination";

const STATUS_CONFIG = {
    Paid: {
        badgeClass: "border-success text-success bg-success-subtle",
        dotClass: "bg-success",
        label: "Paid",
        icon: CheckCircle2,
    },
    Partial: {
        badgeClass: "border-warning text-warning-emphasis bg-warning-subtle",
        dotClass: "bg-warning",
        label: "Partial",
        icon: AlertCircle,
    },
    Pending: {
        badgeClass: "border-danger text-danger bg-danger-subtle",
        dotClass: "bg-danger",
        label: "Pending",
        icon: Clock,
    },
};

export default function PlayerFeesMatrixPage() {
    const { user } = useUser();
    const hasSessionUser = Boolean(user);
    const userAcademyId = user?.academy_id;
    const hasAssignedAcademy =
        userAcademyId !== null && userAcademyId !== undefined && userAcademyId !== "" && Number(userAcademyId) !== 0;

    // Filters
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [search, setSearch] = useState("");
    const [programId, setProgramId] = useState("");
    const [paymentStatus, setPaymentStatus] = useState("");

    // Data state
    const [programs, setPrograms] = useState([]);
    const [matrixPayload, setMatrixPayload] = useState(null);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 15;
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Available years: 2 years back to 2 years ahead
    const availableYears = useMemo(() => {
        const years = [];
        for (let y = currentYear - 1; y <= currentYear + 2; y++) {
            years.push(y);
        }
        return years;
    }, [currentYear]);

    // Load programs for dropdown
    useEffect(() => {
        if (!hasSessionUser) return;
        (async () => {
            try {
                const res = await fetch("/api/programs");
                const json = await res.json();
                if (res.ok && json.success) {
                    setPrograms(json.data || []);
                }
            } catch {
                /* ignore */
            }
        })();
    }, [hasSessionUser]);

    // Load matrix data
    const loadMatrixData = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.set("year", String(selectedYear));
            if (hasAssignedAcademy) params.set("academy_id", String(userAcademyId));
            if (programId) params.set("program_id", programId);
            if (paymentStatus) params.set("payment_status", paymentStatus);
            if (search.trim()) params.set("search", search.trim());

            const res = await fetch(`/api/player-program-fees/matrix?${params.toString()}`);
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to load yearly fees matrix.");
            }
            setMatrixPayload(json);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!hasSessionUser) return;
        loadMatrixData();
    }, [hasSessionUser, selectedYear, programId, paymentStatus]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadMatrixData();
    };

    const handleReset = () => {
        setSearch("");
        setProgramId("");
        setPaymentStatus("");
        setSelectedYear(currentYear);
    };

    const months = matrixPayload?.months || [
        { key: "01", name: "Jan" },
        { key: "02", name: "Feb" },
        { key: "03", name: "Mar" },
        { key: "04", name: "Apr" },
        { key: "05", name: "May" },
        { key: "06", name: "Jun" },
        { key: "07", name: "Jul" },
        { key: "08", name: "Aug" },
        { key: "09", name: "Sep" },
        { key: "10", name: "Oct" },
        { key: "11", name: "Nov" },
        { key: "12", name: "Dec" },
    ];

    const stats = matrixPayload?.stats || {
        totalYearInvoiced: 0,
        totalYearPaid: 0,
        totalYearDue: 0,
        paidCount: 0,
        partialCount: 0,
        pendingCount: 0,
    };

    const monthlyStats = matrixPayload?.monthlyStats || [];
    const rows = matrixPayload?.data || [];

    useEffect(() => {
        setPage(1);
    }, [selectedYear, search, programId, paymentStatus]);

    const totalPages = Math.ceil(rows.length / PAGE_SIZE) || 1;
    const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const collectionRate = stats.totalYearInvoiced > 0
        ? ((stats.totalYearPaid / stats.totalYearInvoiced) * 100).toFixed(1)
        : "0.0";

    return (
        <div className="container-fluid py-4">
            {/* Header */}
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
                <div>
                    <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-primary p-2">
                            <Calendar size={20} className="text-white" />
                        </span>
                        <div>
                            <h4 className="mb-0 fw-bold">Player Fees Matrix (Jan – Dec)</h4>
                            <small className="text-muted">
                                Comprehensive annual sheet of monthly fees. Click on any month status (Paid, Partial, Pending) to view invoice payments.
                            </small>
                        </div>
                    </div>
                </div>

                <div className="d-flex flex-wrap gap-2">
                    <Link
                        href="/next_panel/player-program-fees"
                        className="btn btn-outline-primary d-flex align-items-center gap-1"
                    >
                        <Receipt size={16} /> Fee Invoices
                    </Link>
                    <Link
                        href="/next_panel/player-payments"
                        className="btn btn-outline-secondary d-flex align-items-center gap-1"
                    >
                        <CreditCard size={16} /> Payment Receipts
                    </Link>
                    <Link
                        href="/next_panel/player-payments/new"
                        className="btn btn-success d-flex align-items-center gap-1 fw-semibold"
                    >
                        <Plus size={16} /> Record Payment
                    </Link>
                </div>
            </div>

            {/* Error Notice */}
            {error && (
                <div className="alert alert-danger alert-dismissible fade show d-flex align-items-center gap-2" role="alert">
                    <AlertCircle size={18} />
                    <div>{error}</div>
                    <button type="button" className="btn-close ms-auto" onClick={() => setError(null)} />
                </div>
            )}

            {/* KPI Cards Row */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card shadow-sm border-0 border-start border-primary border-4 h-100">
                        <div className="card-body">
                            <div className="d-flex justify-content-between align-items-center">
                                <span className="text-muted small fw-semibold text-uppercase">Yearly Invoiced</span>
                                <span className="badge bg-primary-subtle text-primary">{selectedYear}</span>
                            </div>
                            <div className="fs-4 fw-bold text-dark mt-2">
                                ₹{Number(stats.totalYearInvoiced || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </div>
                            <div className="small text-muted mt-1">
                                Across {rows.length} player enrollments
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card shadow-sm border-0 border-start border-success border-4 h-100">
                        <div className="card-body">
                            <div className="d-flex justify-content-between align-items-center">
                                <span className="text-muted small fw-semibold text-uppercase">Yearly Collected</span>
                                <span className="badge bg-success-subtle text-success">{collectionRate}% Paid</span>
                            </div>
                            <div className="fs-4 fw-bold text-success mt-2">
                                ₹{Number(stats.totalYearPaid || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </div>
                            <div className="small text-muted mt-1">
                                {stats.paidCount} full • {stats.partialCount} partial
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card shadow-sm border-0 border-start border-danger border-4 h-100">
                        <div className="card-body">
                            <div className="d-flex justify-content-between align-items-center">
                                <span className="text-muted small fw-semibold text-uppercase">Outstanding Due</span>
                                <span className="badge bg-danger-subtle text-danger">{stats.pendingCount} Pending</span>
                            </div>
                            <div className="fs-4 fw-bold text-danger mt-2">
                                ₹{Number(stats.totalYearDue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </div>
                            <div className="small text-muted mt-1">
                                Total balance pending collection
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card shadow-sm border-0 border-start border-info border-4 h-100">
                        <div className="card-body">
                            <div className="d-flex justify-content-between align-items-center">
                                <span className="text-muted small fw-semibold text-uppercase">Invoice Statuses</span>
                                <span className="badge bg-info-subtle text-info">Year Total</span>
                            </div>
                            <div className="d-flex align-items-center gap-2 mt-2">
                                <span className="badge bg-success-subtle text-success border border-success py-1 px-2">
                                    ✓ {stats.paidCount} Paid
                                </span>
                                <span className="badge bg-warning-subtle text-warning-emphasis border border-warning py-1 px-2">
                                    ⚠ {stats.partialCount} Partial
                                </span>
                                <span className="badge bg-danger-subtle text-danger border border-danger py-1 px-2">
                                    ⌛ {stats.pendingCount} Pending
                                </span>
                            </div>
                            <div className="small text-muted mt-2">
                                Total {stats.paidCount + stats.partialCount + stats.pendingCount} billed months
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="card shadow-sm border-0 mb-4">
                <div className="card-body p-3">
                    <div className="row g-2 align-items-center">
                        {/* Year Selector */}
                        <div className="col-12 col-sm-auto">
                            <div className="input-group input-group-sm">
                                <span className="input-group-text bg-light fw-bold text-muted">
                                    <Calendar size={14} className="me-1" /> Year:
                                </span>
                                <select
                                    className="form-select form-select-sm fw-bold border-primary"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                                    style={{ minWidth: "100px" }}
                                >
                                    {availableYears.map((yr) => (
                                        <option key={yr} value={yr}>
                                            {yr}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Search Input */}
                        <div className="col-12 col-sm-6 col-md-3">
                            <form onSubmit={handleSearchSubmit} className="input-group input-group-sm">
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Search player, admission no..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                <button type="submit" className="btn btn-primary">
                                    <Search size={14} />
                                </button>
                            </form>
                        </div>

                        {/* Program Dropdown */}
                        <div className="col-12 col-sm-6 col-md-3">
                            <select
                                className="form-select form-select-sm"
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

                        {/* Status Filter */}
                        <div className="col-12 col-sm-6 col-md-2">
                            <select
                                className="form-select form-select-sm"
                                value={paymentStatus}
                                onChange={(e) => setPaymentStatus(e.target.value)}
                            >
                                <option value="">All Statuses</option>
                                <option value="Paid">Has Paid Months</option>
                                <option value="Partial">Has Partial Months</option>
                                <option value="Pending">Has Pending Months</option>
                            </select>
                        </div>

                        {/* Actions */}
                        <div className="col-12 col-sm-auto ms-sm-auto d-flex gap-2">
                            <button
                                type="button"
                                onClick={handleReset}
                                className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                                title="Reset all filters"
                            >
                                <RefreshCw size={13} /> Reset
                            </button>
                        </div>
                    </div>

                    {/* Legend Bar */}
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3 pt-2 border-top small text-muted">
                        <div className="d-flex flex-wrap align-items-center gap-3">
                            <span className="fw-semibold text-dark">Status Legend (Click cell to view payments):</span>
                            <span className="badge border border-success text-success bg-success-subtle px-2 py-1">
                                <CheckCircle2 size={12} className="me-1 inline" /> Paid (Fully Settled)
                            </span>
                            <span className="badge border border-warning text-warning-emphasis bg-warning-subtle px-2 py-1">
                                <AlertCircle size={12} className="me-1 inline" /> Partial (Balance Remaining)
                            </span>
                            <span className="badge border border-danger text-danger bg-danger-subtle px-2 py-1">
                                <Clock size={12} className="me-1 inline" /> Pending (Unpaid)
                            </span>
                            <span className="badge border border-secondary text-secondary bg-light px-2 py-1">
                                — Not Enrolled / Outside Period
                            </span>
                        </div>
                        <div className="text-muted fst-italic">
                            Showing {rows.length} player enrollments for {selectedYear}
                        </div>
                    </div>
                </div>
            </div>

            {/* Matrix Sheet Table */}
            <div className="card shadow-sm border-0">
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status" />
                            <div className="text-muted mt-2 small">Loading {selectedYear} fee matrix data...</div>
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="text-center py-5">
                            <Users size={48} className="text-muted mb-2 opacity-50" />
                            <h6 className="fw-bold text-dark">No Player Fee Records Found</h6>
                            <p className="text-muted small mb-3">
                                No active player program enrollments matched your filter criteria for {selectedYear}.
                            </p>
                            <button onClick={handleReset} className="btn btn-sm btn-outline-primary">
                                Clear All Filters
                            </button>
                        </div>
                    ) : (
                        <>
                        <div className="table-responsive" style={{ maxHeight: "72vh" }}>
                            <table className="table table-hover table-bordered align-middle mb-0 matrix-table">
                                <thead className="table-light sticky-top" style={{ zIndex: 3 }}>
                                    <tr>
                                        <th
                                            className="text-center sticky-col sticky-col-num bg-light text-muted"
                                            style={{ width: "40px" }}
                                        >
                                            #
                                        </th>
                                        <th
                                            className="sticky-col sticky-col-player bg-light"
                                            style={{ minWidth: "220px", width: "220px" }}
                                        >
                                            Player Details
                                        </th>
                                        <th
                                            className="sticky-col sticky-col-prog bg-light"
                                            style={{ minWidth: "160px", width: "160px" }}
                                        >
                                            Program & Branch
                                        </th>

                                        {/* 12 Months: Jan to Dec */}
                                        {months.map((m) => (
                                            <th
                                                key={m.key}
                                                className="text-center text-uppercase fw-bold text-secondary month-header-cell"
                                                style={{ minWidth: "90px" }}
                                            >
                                                <div className="month-title">{m.name}</div>
                                                <div className="month-sub text-muted fw-normal" style={{ fontSize: "0.68rem" }}>
                                                    {selectedYear}
                                                </div>
                                            </th>
                                        ))}

                                        <th className="text-end bg-light text-dark" style={{ minWidth: "110px" }}>
                                            Invoiced
                                        </th>
                                        <th className="text-end bg-light text-success" style={{ minWidth: "110px" }}>
                                            Paid
                                        </th>
                                        <th className="text-end bg-light text-danger" style={{ minWidth: "110px" }}>
                                            Due
                                        </th>
                                        <th className="text-center bg-light" style={{ width: "80px" }}>
                                            Payments
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedRows.map((row, index) => {
                                        return (
                                            <tr key={`${row.user_program_id}-${index}`}>
                                                {/* Row Index */}
                                                <td className="text-center sticky-col sticky-col-num bg-white text-muted small">
                                                    {(page - 1) * PAGE_SIZE + index + 1}
                                                </td>

                                                {/* Player Info */}
                                                <td className="sticky-col sticky-col-player bg-white">
                                                    <div className="fw-bold text-dark text-truncate" style={{ maxWidth: "200px" }}>
                                                        {row.player_name}
                                                    </div>
                                                    <div className="d-flex align-items-center gap-1 mt-1 small">
                                                        <span className="badge bg-secondary-subtle text-secondary font-monospace" style={{ fontSize: "0.72rem" }}>
                                                            {row.admission_no}
                                                        </span>
                                                        {row.player_phone && (
                                                            <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                                                                • {row.player_phone}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Program & Branch */}
                                                <td className="sticky-col sticky-col-prog bg-white">
                                                    <span className="badge bg-primary-subtle text-primary border border-primary text-truncate d-block text-start mb-1" style={{ maxWidth: "150px" }}>
                                                        {row.program_name}
                                                    </span>
                                                    <div className="small text-muted text-truncate" style={{ maxWidth: "150px", fontSize: "0.72rem" }}>
                                                        {row.branch_name}
                                                    </div>
                                                    <div className="small text-muted mt-1" style={{ fontSize: "0.68rem" }}>
                                                        {row.start_date ? String(row.start_date).slice(0, 7) : "Start"} → {row.end_date ? String(row.end_date).slice(0, 7) : "Ongoing"}
                                                    </div>
                                                </td>

                                                {/* 12 Months Cells */}
                                                {months.map((m) => {
                                                    const cell = row.months ? row.months[m.key] : null;

                                                    if (!cell) {
                                                        return (
                                                            <td
                                                                key={m.key}
                                                                className="text-center text-muted p-1"
                                                                style={{ backgroundColor: "#fafbfc" }}
                                                                title={`Not enrolled / outside period for ${m.name} ${selectedYear}`}
                                                            >
                                                                <span className="text-black-50 small">—</span>
                                                            </td>
                                                        );
                                                    }

                                                    const status = cell.payment_status || "Pending";
                                                    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Pending;
                                                    const IconComponent = cfg.icon;

                                                    const cellLink = cell.fee_id
                                                        ? `/next_panel/player-payments?player_program_fee_id=${cell.fee_id}`
                                                        : `/next_panel/player-payments?admission_players_id=${row.admission_players_id}`;

                                                    const cellTooltip = cell.fee_id
                                                        ? `${m.name} ${selectedYear} [Invoice #${cell.fee_id}]\nStatus: ${status}\nTotal: ₹${Number(cell.total_amount).toFixed(2)}\nPaid: ₹${Number(cell.paid_amount).toFixed(2)}\nDue: ₹${Number(cell.due_amount).toFixed(2)}\nClick to view receipt & payments`
                                                        : `${m.name} ${selectedYear} [Enrolled - Program Fee]\nStatus: ${status}\nMonthly Fee: ₹${Number(cell.total_amount).toFixed(2)}\nDue: ₹${Number(cell.due_amount).toFixed(2)}\nClick to view or record payment`;

                                                    return (
                                                        <td key={m.key} className="p-1 text-center align-middle">
                                                            <Link
                                                                href={cellLink}
                                                                className={`matrix-cell-badge d-block text-decoration-none border rounded p-1 shadow-sm transition-all ${cfg.badgeClass}`}
                                                                title={cellTooltip}
                                                            >
                                                                <div className="d-flex align-items-center justify-content-center gap-1 fw-bold" style={{ fontSize: "0.74rem" }}>
                                                                    <IconComponent size={11} />
                                                                    <span>{cfg.label}</span>
                                                                </div>
                                                                <div className="text-truncate fw-semibold mt-1" style={{ fontSize: "0.69rem" }}>
                                                                    {status === "Paid" ? (
                                                                        <span>₹{Math.round(cell.paid_amount)}</span>
                                                                    ) : status === "Partial" ? (
                                                                        <span className="text-danger">Due ₹{Math.round(cell.due_amount)}</span>
                                                                    ) : (
                                                                        <span>₹{Math.round(cell.total_amount)}</span>
                                                                    )}
                                                                </div>
                                                            </Link>
                                                        </td>
                                                    );
                                                })}

                                                {/* Row Summaries */}
                                                <td className="text-end small fw-semibold text-dark">
                                                    ₹{Number(row.rowStats?.totalInvoiced || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                                                </td>
                                                <td className="text-end small fw-semibold text-success">
                                                    ₹{Number(row.rowStats?.totalPaid || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                                                </td>
                                                <td className="text-end small fw-semibold">
                                                    {row.rowStats?.totalDue > 0 ? (
                                                        <span className="text-danger fw-bold">
                                                            ₹{Number(row.rowStats.totalDue).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted">₹0</span>
                                                    )}
                                                </td>

                                                {/* Player Payments Landing Link */}
                                                <td className="text-center">
                                                    <Link
                                                        href={`/next_panel/player-payments?admission_players_id=${row.admission_players_id}`}
                                                        className="btn btn-sm btn-outline-primary py-0 px-2 d-inline-flex align-items-center gap-1"
                                                        style={{ fontSize: "0.72rem" }}
                                                        title="View all payments for this player"
                                                    >
                                                        View <ChevronRight size={12} />
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>

                                {/* Table Footer: Monthly Totals Aggregations */}
                                <tfoot className="table-light sticky-bottom fw-bold" style={{ zIndex: 2 }}>
                                    {/* Monthly Invoiced Row */}
                                    <tr className="border-top border-2">
                                        <td colSpan={3} className="sticky-col sticky-col-totals bg-light text-end text-muted small py-2">
                                            Monthly Invoiced:
                                        </td>
                                        {months.map((m) => {
                                            const mStat = monthlyStats.find((s) => s.key === m.key);
                                            const inv = mStat ? mStat.invoiced : 0;
                                            return (
                                                <td key={m.key} className="text-center text-dark small py-2" style={{ fontSize: "0.74rem" }}>
                                                    {inv > 0 ? `₹${Math.round(inv).toLocaleString("en-IN")}` : "—"}
                                                </td>
                                            );
                                        })}
                                        <td className="text-end text-dark small py-2">
                                            ₹{Math.round(stats.totalYearInvoiced || 0).toLocaleString("en-IN")}
                                        </td>
                                        <td colSpan={3} className="bg-light"></td>
                                    </tr>

                                    {/* Monthly Collected Row */}
                                    <tr>
                                        <td colSpan={3} className="sticky-col sticky-col-totals bg-light text-end text-success small py-2">
                                            Monthly Collected:
                                        </td>
                                        {months.map((m) => {
                                            const mStat = monthlyStats.find((s) => s.key === m.key);
                                            const pd = mStat ? mStat.paid : 0;
                                            return (
                                                <td key={m.key} className="text-center text-success small py-2" style={{ fontSize: "0.74rem" }}>
                                                    {pd > 0 ? `₹${Math.round(pd).toLocaleString("en-IN")}` : "—"}
                                                </td>
                                            );
                                        })}
                                        <td className="bg-light"></td>
                                        <td className="text-end text-success small py-2">
                                            ₹{Math.round(stats.totalYearPaid || 0).toLocaleString("en-IN")}
                                        </td>
                                        <td colSpan={2} className="bg-light"></td>
                                    </tr>

                                    {/* Monthly Due Row */}
                                    <tr>
                                        <td colSpan={3} className="sticky-col sticky-col-totals bg-light text-end text-danger small py-2">
                                            Monthly Outstanding Due:
                                        </td>
                                        {months.map((m) => {
                                            const mStat = monthlyStats.find((s) => s.key === m.key);
                                            const du = mStat ? mStat.due : 0;
                                            return (
                                                <td key={m.key} className="text-center text-danger small py-2" style={{ fontSize: "0.74rem" }}>
                                                    {du > 0 ? `₹${Math.round(du).toLocaleString("en-IN")}` : "—"}
                                                </td>
                                            );
                                        })}
                                        <td colSpan={2} className="bg-light"></td>
                                        <td className="text-end text-danger small py-2">
                                            ₹{Math.round(stats.totalYearDue || 0).toLocaleString("en-IN")}
                                        </td>
                                        <td className="bg-light"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div className="p-3 border-top">
                            <Pagination
                                page={page}
                                totalPages={totalPages}
                                total={rows.length}
                                onPageChange={setPage}
                                pageSize={PAGE_SIZE}
                            />
                        </div>
                        </>
                    )}
                </div>
            </div>

            {/* Custom Styles for Sticky Columns and Matrix Badges */}
            <style jsx>{`
                .matrix-table {
                    border-collapse: separate;
                    border-spacing: 0;
                }
                .sticky-col {
                    position: sticky;
                    z-index: 1;
                }
                .sticky-col-num {
                    left: 0;
                    border-right: 1px solid #dee2e6;
                }
                .sticky-col-player {
                    left: 40px;
                    border-right: 1px solid #dee2e6;
                }
                .sticky-col-prog {
                    left: 260px;
                    border-right: 2px solid #dee2e6;
                }
                .sticky-col-totals {
                    left: 0;
                    border-right: 2px solid #dee2e6;
                }
                .matrix-cell-badge {
                    cursor: pointer;
                    transition: transform 0.15s ease, box-shadow 0.15s ease;
                }
                .matrix-cell-badge:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12) !important;
                    filter: brightness(0.97);
                }
                .month-header-cell {
                    background-color: #f8f9fa;
                    border-bottom: 2px solid #062f38 !important;
                }
                @media (max-width: 768px) {
                    .sticky-col {
                        position: static !important;
                    }
                    .table-responsive {
                        max-height: 60vh !important;
                    }
                }
            `}</style>
        </div>
    );
}
