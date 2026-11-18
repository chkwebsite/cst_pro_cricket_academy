"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    TrendingUp,
    TrendingDown,
    Calendar,
    Users,
    Trees,
    UserCheck,
    CreditCard,
    DollarSign,
    RefreshCw,
    Printer,
    Building2,
    Swords,
    CheckCircle2,
    Clock,
    AlertCircle,
    ArrowUpRight,
    ArrowDownRight,
    Search
} from "lucide-react";
import { useUser } from "../components/UserContext";

const MONTHS = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
];

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const YEARS = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);

const formatPrice = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "₹0";
    return `₹${Math.round(n).toLocaleString("en-IN")}`;
};

const formatPriceExact = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "₹0.00";
    return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (v) => {
    if (!v) return "—";
    const [y, m, d] = String(v).slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
};

export default function FinancialSummaryPage() {
    const { user } = useUser();

    const [month, setMonth] = useState(currentMonth);
    const [year, setYear] = useState(currentYear);
    const [selectedAcademy, setSelectedAcademy] = useState("");
    const [selectedBranch, setSelectedBranch] = useState("");

    // Tabs: 'overview', 'match-fees', 'player-fees', 'ground-rentals', 'staff-salaries', 'umpire-fees'
    const [activeTab, setActiveTab] = useState("overview");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    // Search filters within tabs
    const [matchSearch, setMatchSearch] = useState("");
    const [playerSearch, setPlayerSearch] = useState("");
    const [staffSearch, setStaffSearch] = useState("");
    const [umpireSearch, setUmpireSearch] = useState("");

    // Fetch Financial Summary
    const loadSummary = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.set("month", String(month));
            params.set("year", String(year));
            if (selectedAcademy) params.set("academy_id", selectedAcademy);
            if (selectedBranch) params.set("branch_id", selectedBranch);

            const res = await fetch(`/api/financial-summary?${params.toString()}`);
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to load financial summary data.");
            }

            setData(json.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSummary();
    }, [month, year, selectedAcademy, selectedBranch]);

    const totals = data?.totals || {
        totalInflowExpected: 0,
        totalInflowReceived: 0,
        totalInflowDue: 0,
        totalOutflowPayable: 0,
        totalOutflowPaid: 0,
        totalOutflowDue: 0,
        netCashFlow: 0,
        isCashPositive: true,
        netAccruedProfit: 0,
        isAccruedProfitable: true,
        playerFeesExpected: 0,
        playerFeesReceived: 0,
        playerFeesDue: 0,
        matchFeesExpected: 0,
        matchFeesReceived: 0,
        matchFeesDue: 0,
        groundRentalsExpected: 0,
        groundRentalsReceived: 0,
        groundRentalsDue: 0,
        staffSalariesPayable: 0,
        staffSalariesPaid: 0,
        staffSalariesDue: 0,
        umpireFeesPayable: 0,
        umpireFeesPaid: 0,
        umpireFeesDue: 0,
        totalMatchesCount: 0,
        totalGroundBookingsCount: 0,
        totalPaidStaffCount: 0,
        totalUmpireDutiesCount: 0,
        totalUniquePlayers: 0,
    };

    const scope = data?.scope || {};
    const filters = data?.filters || { academies: [], branches: [] };
    const playerFees = data?.playerFees || { programsSummary: [], records: [], payments: [] };
    const matchFees = data?.matchFees || { matches: [] };
    const groundRentals = data?.groundRentals || { groundsSummary: [], bookings: [], payments: [] };
    const staffSalaries = data?.staffSalaries || { salaries: [] };
    const umpireFees = data?.umpireFees || { duties: [], payments: [] };

    const selectedMonthName = MONTHS.find((m) => m.value === Number(month))?.label || "";

    const handlePrint = () => {
        if (typeof window !== "undefined") {
            window.print();
        }
    };

    // Filtered lists for tabs
    const filteredMatches = (matchFees.matches || []).filter((m) => {
        if (!matchSearch.trim()) return true;
        const q = matchSearch.toLowerCase();
        return (
            (m.match_no && m.match_no.toLowerCase().includes(q)) ||
            (m.team_a_name && m.team_a_name.toLowerCase().includes(q)) ||
            (m.team_b_name && m.team_b_name.toLowerCase().includes(q)) ||
            (m.ground_name && m.ground_name.toLowerCase().includes(q)) ||
            (m.match_type && m.match_type.toLowerCase().includes(q))
        );
    });

    const filteredPlayers = (playerFees.records || []).filter((p) => {
        if (!playerSearch.trim()) return true;
        const q = playerSearch.toLowerCase();
        return (
            (p.player_name && p.player_name.toLowerCase().includes(q)) ||
            (p.admission_no && p.admission_no.toLowerCase().includes(q)) ||
            (p.program_name && p.program_name.toLowerCase().includes(q)) ||
            (p.player_phone && p.player_phone.toLowerCase().includes(q))
        );
    });

    const filteredStaff = (staffSalaries.salaries || []).filter((s) => {
        if (!staffSearch.trim()) return true;
        const q = staffSearch.toLowerCase();
        return (
            (s.staff_name && s.staff_name.toLowerCase().includes(q)) ||
            (s.appointment_no && s.appointment_no.toLowerCase().includes(q)) ||
            (s.designation && s.designation.toLowerCase().includes(q)) ||
            (s.speciality && s.speciality.toLowerCase().includes(q))
        );
    });

    const filteredUmpires = (umpireFees.duties || []).filter((u) => {
        if (!umpireSearch.trim()) return true;
        const q = umpireSearch.toLowerCase();
        return (
            (u.umpire_name && u.umpire_name.toLowerCase().includes(q)) ||
            (u.reference_no && u.reference_no.toLowerCase().includes(q)) ||
            (u.duty_type && u.duty_type.toLowerCase().includes(q)) ||
            (u.ground_name && u.ground_name.toLowerCase().includes(q))
        );
    });

    return (
        <div className="container-fluid">
            <div className="row g-3">
                {/* Header */}
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-3">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <div>
                                <h3 className="mb-1 d-flex align-items-center gap-2">
                                    <DollarSign className="text-success" size={28} />
                                    <span className="fw-bold">Monthly Financial Summary &amp; Expected vs Actual</span>
                                </h3>
                                <p className="text-muted mb-0">
                                    Comparative breakdown of Expected Demand &amp; Payables vs. Actual Collections &amp; Disbursements across all operational streams.
                                </p>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary d-inline-flex align-items-center gap-1"
                                    onClick={loadSummary}
                                    title="Refresh Data"
                                >
                                    <RefreshCw size={15} /> Refresh
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-outline-dark d-inline-flex align-items-center gap-1"
                                    onClick={handlePrint}
                                    title="Print Statement"
                                >
                                    <Printer size={15} /> Print Statement
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters Bar */}
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-3 mb-2">
                        <div className="row g-3 align-items-center">
                            {/* Month Selector */}
                            <div className="col-sm-6 col-md-3">
                                <label className="form-label small text-muted fw-semibold mb-1">Select Month</label>
                                <select
                                    className="form-select"
                                    value={month}
                                    onChange={(e) => setMonth(Number(e.target.value))}
                                >
                                    {MONTHS.map((m) => (
                                        <option key={m.value} value={m.value}>
                                            {m.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Year Selector */}
                            <div className="col-sm-6 col-md-2">
                                <label className="form-label small text-muted fw-semibold mb-1">Select Year</label>
                                <select
                                    className="form-select"
                                    value={year}
                                    onChange={(e) => setYear(Number(e.target.value))}
                                >
                                    {YEARS.map((y) => (
                                        <option key={y} value={y}>
                                            {y}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Super Admin Academy Filter */}
                            {scope.isSuperAdmin && (
                                <div className="col-sm-6 col-md-3">
                                    <label className="form-label small text-muted fw-semibold mb-1">Academy</label>
                                    <select
                                        className="form-select"
                                        value={selectedAcademy}
                                        onChange={(e) => {
                                            setSelectedAcademy(e.target.value);
                                            setSelectedBranch("");
                                        }}
                                    >
                                        <option value="">All Academies</option>
                                        {filters.academies.map((a) => (
                                            <option key={a.id} value={a.id}>
                                                {a.academy_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Branch Filter (for Super Admin & Academy Admin) */}
                            {(scope.isSuperAdmin || scope.isAcademyAdmin) && (
                                <div className="col-sm-6 col-md-3">
                                    <label className="form-label small text-muted fw-semibold mb-1">Branch</label>
                                    <select
                                        className="form-select"
                                        value={selectedBranch}
                                        onChange={(e) => setSelectedBranch(e.target.value)}
                                    >
                                        <option value="">All Branches</option>
                                        {filters.branches.map((b) => (
                                            <option key={b.id} value={b.id}>
                                                {b.branch_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Branch Admin Locked Badge */}
                            {scope.isBranchAdmin && (
                                <div className="col-sm-6 col-md-4">
                                    <label className="form-label small text-muted fw-semibold mb-1">Branch Scope</label>
                                    <div>
                                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-2 fw-semibold">
                                            <Building2 size={13} className="me-1" /> Branch Admin ({user?.branch_name || "My Branch"})
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="col-12">
                        <div className="alert alert-danger">{error}</div>
                    </div>
                )}

                {/* Top 3 Executive Overview Hero Cards */}
                <div className="col-12">
                    <div className="row g-3 mb-2">
                        {/* 1. NET CASH IN HAND / REALIZED RESULT */}
                        <div className="col-lg-4 col-md-6">
                            <div
                                className="card border-0 shadow-sm rounded-4 h-100 p-4 text-white position-relative overflow-hidden"
                                style={{
                                    background: totals.isCashPositive
                                        ? "linear-gradient(135deg, #064e3b 0%, #059669 100%)"
                                        : "linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)",
                                }}
                            >
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className="badge bg-white bg-opacity-25 text-white px-3 py-1">
                                        {selectedMonthName} {year} · Cash Operating Position
                                    </span>
                                    <span className="p-2 rounded-circle bg-white bg-opacity-20 text-white">
                                        {totals.isCashPositive ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
                                    </span>
                                </div>
                                <h2 className="display-6 fw-bold mb-1">
                                    {totals.netCashFlow < 0 ? `-` : `+`}
                                    {formatPrice(Math.abs(totals.netCashFlow))}
                                </h2>
                                <div className="d-flex align-items-center gap-2 mt-2">
                                    <span className="badge bg-white text-dark fw-bold px-2 py-1">
                                        {totals.isCashPositive ? "SURPLUS CASH" : "NET CASH DEFICIT"}
                                    </span>
                                    <small className="opacity-90">
                                        (Actual Inflow - Actual Outflow)
                                    </small>
                                </div>
                                <div className="mt-3 border-top border-white border-opacity-25 pt-2 small opacity-90 d-flex justify-content-between">
                                    <span>Projected Accrued Profit:</span>
                                    <strong>{totals.netAccruedProfit < 0 ? "-" : "+"}{formatPrice(Math.abs(totals.netAccruedProfit))}</strong>
                                </div>
                            </div>
                        </div>

                        {/* 2. TOTAL INFLOW: Expected vs Received vs Due */}
                        <div className="col-lg-4 col-md-6">
                            <div className="card border-0 shadow-sm rounded-4 h-100 p-4 bg-white">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <div>
                                        <small className="text-success fw-bold text-uppercase">Total Inflow (Collections)</small>
                                        <h3 className="fw-bold text-success mt-1 mb-0">{formatPrice(totals.totalInflowReceived)}</h3>
                                        <small className="text-muted">Actual Amount Received</small>
                                    </div>
                                    <div className="p-3 bg-success-subtle text-success rounded-4">
                                        <ArrowUpRight size={26} />
                                    </div>
                                </div>
                                <div className="border-top pt-2 mt-2">
                                    <div className="d-flex justify-content-between text-muted small py-1">
                                        <span>Demand:</span>
                                        <strong className="text-dark">{formatPrice(totals.totalInflowExpected)}</strong>
                                    </div>
                                    <div className="d-flex justify-content-between text-muted small py-1">
                                        <span>Due Balance:</span>
                                        <strong className="text-danger fw-bold">{formatPrice(totals.totalInflowDue)}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. TOTAL OUTFLOW: Payable vs Paid vs Due */}
                        <div className="col-lg-4 col-md-12">
                            <div className="card border-0 shadow-sm rounded-4 h-100 p-4 bg-white">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <div>
                                        <small className="text-danger fw-bold text-uppercase">Total Outflow (Disbursements)</small>
                                        <h3 className="fw-bold text-danger mt-1 mb-0">{formatPrice(totals.totalOutflowPaid)}</h3>
                                        <small className="text-muted">Actual Amount Paid</small>
                                    </div>
                                    <div className="p-3 bg-danger-subtle text-danger rounded-4">
                                        <ArrowDownRight size={26} />
                                    </div>
                                </div>
                                <div className="border-top pt-2 mt-2">
                                    <div className="d-flex justify-content-between text-muted small py-1">
                                        <span>Total Payable:</span>
                                        <strong className="text-dark">{formatPrice(totals.totalOutflowPayable)}</strong>
                                    </div>
                                    <div className="d-flex justify-content-between text-muted small py-1">
                                        <span>Pending Outflow (Due):</span>
                                        <strong className="text-danger fw-bold">{formatPrice(totals.totalOutflowDue)}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 5-Stream Executive Cards Row */}
                <div className="col-12">
                    <div className="row g-3 mb-2">
                        {/* Card 1: Player Program Fees */}
                        <div className="col-md">
                            <div
                                className={`card border-0 shadow-sm rounded-4 p-3 bg-white h-100 cursor-pointer ${
                                    activeTab === "player-fees" ? "border border-primary border-2" : ""
                                }`}
                                onClick={() => setActiveTab("player-fees")}
                                role="button"
                            >
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                    <small className="text-muted fw-bold">Player Fees</small>
                                    <Users size={16} className="text-primary" />
                                </div>
                                <div className="small text-muted">Expected Demand: <strong className="text-dark">{formatPrice(totals.playerFeesExpected)}</strong></div>
                                <h6 className="fw-bold text-success mb-1 mt-1">Received: {formatPrice(totals.playerFeesReceived)}</h6>
                                <div className="small text-muted">Balance Due: <strong className={totals.playerFeesDue > 0 ? "text-danger" : "text-muted"}>{formatPrice(totals.playerFeesDue)}</strong></div>
                            </div>
                        </div>

                        {/* Card 2: Match Fees */}
                        <div className="col-md">
                            <div
                                className={`card border-0 shadow-sm rounded-4 p-3 bg-white h-100 cursor-pointer ${
                                    activeTab === "match-fees" ? "border border-primary border-2" : ""
                                }`}
                                onClick={() => setActiveTab("match-fees")}
                                role="button"
                            >
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                    <small className="text-muted fw-bold">Match Fees (Match-Wise)</small>
                                    <Swords size={16} className="text-warning-emphasis" />
                                </div>
                                <div className="small text-muted">Expected Demand: <strong className="text-dark">{formatPrice(totals.matchFeesExpected)}</strong></div>
                                <h6 className="fw-bold text-success mb-1 mt-1">Received: {formatPrice(totals.matchFeesReceived)}</h6>
                                <div className="small text-muted">Balance Due: <strong className={totals.matchFeesDue > 0 ? "text-danger" : "text-muted"}>{formatPrice(totals.matchFeesDue)}</strong></div>
                            </div>
                        </div>

                        {/* Card 3: Ground Booking Rentals */}
                        <div className="col-md">
                            <div
                                className={`card border-0 shadow-sm rounded-4 p-3 bg-white h-100 cursor-pointer ${
                                    activeTab === "ground-rentals" ? "border border-primary border-2" : ""
                                }`}
                                onClick={() => setActiveTab("ground-rentals")}
                                role="button"
                            >
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                    <small className="text-muted fw-bold">Ground Rentals</small>
                                    <Trees size={16} className="text-success" />
                                </div>
                                <div className="small text-muted">Expected Demand: <strong className="text-dark">{formatPrice(totals.groundRentalsExpected)}</strong></div>
                                <h6 className="fw-bold text-success mb-1 mt-1">Received: {formatPrice(totals.groundRentalsReceived)}</h6>
                                <div className="small text-muted">Balance Due: <strong className={totals.groundRentalsDue > 0 ? "text-danger" : "text-muted"}>{formatPrice(totals.groundRentalsDue)}</strong></div>
                            </div>
                        </div>

                        {/* Card 4: Staff & Coach Salaries */}
                        <div className="col-md">
                            <div
                                className={`card border-0 shadow-sm rounded-4 p-3 bg-white h-100 cursor-pointer ${
                                    activeTab === "staff-salaries" ? "border border-primary border-2" : ""
                                }`}
                                onClick={() => setActiveTab("staff-salaries")}
                                role="button"
                            >
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                    <small className="text-muted fw-bold">Staff Salaries</small>
                                    <CreditCard size={16} className="text-danger" />
                                </div>
                                <div className="small text-muted">Total Payable: <strong className="text-dark">{formatPrice(totals.staffSalariesPayable)}</strong></div>
                                <h6 className="fw-bold text-danger mb-1 mt-1">Disbursed (Paid): {formatPrice(totals.staffSalariesPaid)}</h6>
                                <div className="small text-muted">Balance Due: <strong className={totals.staffSalariesDue > 0 ? "text-danger" : "text-muted"}>{formatPrice(totals.staffSalariesDue)}</strong></div>
                            </div>
                        </div>

                        {/* Card 5: Umpire Fees */}
                        <div className="col-md">
                            <div
                                className={`card border-0 shadow-sm rounded-4 p-3 bg-white h-100 cursor-pointer ${
                                    activeTab === "umpire-fees" ? "border border-primary border-2" : ""
                                }`}
                                onClick={() => setActiveTab("umpire-fees")}
                                role="button"
                            >
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                    <small className="text-muted fw-bold">Umpire Remuneration</small>
                                    <UserCheck size={16} className="text-info" />
                                </div>
                                <div className="small text-muted">Total Payable: <strong className="text-dark">{formatPrice(totals.umpireFeesPayable)}</strong></div>
                                <h6 className="fw-bold text-danger mb-1 mt-1">Disbursed (Paid): {formatPrice(totals.umpireFeesPaid)}</h6>
                                <div className="small text-muted">Balance Due: <strong className={totals.umpireFeesDue > 0 ? "text-danger" : "text-muted"}>{formatPrice(totals.umpireFeesDue)}</strong></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="col-12">
                    <ul className="nav nav-pills bg-white p-2 rounded-4 shadow-sm flex-nowrap overflow-auto">
                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link fw-semibold px-4 py-2 text-nowrap ${activeTab === "overview" ? "active" : ""}`}
                                onClick={() => setActiveTab("overview")}
                            >
                                <DollarSign size={16} className="me-2" />
                                Executive Ledger
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link fw-semibold px-4 py-2 text-nowrap ${activeTab === "match-fees" ? "active" : ""}`}
                                onClick={() => setActiveTab("match-fees")}
                            >
                                <Swords size={16} className="me-2 text-warning-emphasis" />
                                Match Fees ({matchFees.matches.length})
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link fw-semibold px-4 py-2 text-nowrap ${activeTab === "player-fees" ? "active" : ""}`}
                                onClick={() => setActiveTab("player-fees")}
                            >
                                <Users size={16} className="me-2 text-primary" />
                                Player Program Fees ({playerFees.records.length})
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link fw-semibold px-4 py-2 text-nowrap ${activeTab === "ground-rentals" ? "active" : ""}`}
                                onClick={() => setActiveTab("ground-rentals")}
                            >
                                <Trees size={16} className="me-2 text-success" />
                                Ground Rentals ({groundRentals.bookings.length})
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link fw-semibold px-4 py-2 text-nowrap ${activeTab === "staff-salaries" ? "active" : ""}`}
                                onClick={() => setActiveTab("staff-salaries")}
                            >
                                <CreditCard size={16} className="me-2 text-danger" />
                                Staff Salaries ({staffSalaries.salaries.length})
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link fw-semibold px-4 py-2 text-nowrap ${activeTab === "umpire-fees" ? "active" : ""}`}
                                onClick={() => setActiveTab("umpire-fees")}
                            >
                                <UserCheck size={16} className="me-2 text-info" />
                                Umpire Fees ({umpireFees.duties.length})
                            </button>
                        </li>
                    </ul>
                </div>

                {/* Tab Contents */}
                <div className="col-12">
                    {loading ? (
                        <div className="bg-white rounded-4 shadow-sm text-center py-5 text-muted">
                            <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
                            Calculating monthly financials for {selectedMonthName} {year}...
                        </div>
                    ) : (
                        <>
                            {/* TAB 1: EXECUTIVE COMPARATIVE LEDGER */}
                            {activeTab === "overview" && (
                                <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white p-4">
                                    <div className="d-flex justify-content-between align-items-center mb-4">
                                        <div>
                                            <h5 className="fw-bold mb-1">
                                                Monthly Financial Ledger &amp; Stream Balance ({selectedMonthName} {year})
                                            </h5>
                                            <p className="text-muted small mb-0">
                                                Comparative summary of Expected vs Actual Collected / Disbursed with remaining balance.
                                            </p>
                                        </div>
                                        <span className="badge bg-light text-dark border px-3 py-2">
                                            Period: {data?.period?.startDate} to {data?.period?.endDate}
                                        </span>
                                    </div>

                                    {/* Comparative Table: All 5 Streams */}
                                    <div className="table-responsive mb-4">
                                        <table className="table table-bordered align-middle">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Category &amp; Stream</th>
                                                    <th>Scope / Type</th>
                                                    <th className="text-end">Expected Demand / Payable (₹)</th>
                                                    <th className="text-end">Actual Received / Paid (₹)</th>
                                                    <th className="text-end">Outstanding Balance Due (₹)</th>
                                                    <th>Status / Recovery</th>
                                                    <th className="text-center">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {/* Header: INFLOW */}
                                                <tr className="table-success bg-opacity-25">
                                                    <th colSpan="7" className="text-success text-uppercase small fw-bold">
                                                        Revenue Streams (Inflow / Collections)
                                                    </th>
                                                </tr>

                                                {/* Stream 1: Player Fees */}
                                                <tr>
                                                    <td>
                                                        <div className="fw-bold d-flex align-items-center gap-2">
                                                            <Users size={16} className="text-primary" />
                                                            <span>Player Program Fees</span>
                                                        </div>
                                                        <small className="text-muted">{totals.totalUniquePlayers} students enrolled</small>
                                                    </td>
                                                    <td>Monthly Academy Training</td>
                                                    <td className="text-end fw-semibold">{formatPriceExact(totals.playerFeesExpected)}</td>
                                                    <td className="text-end fw-bold text-success">{formatPriceExact(totals.playerFeesReceived)}</td>
                                                    <td className="text-end fw-bold text-danger">
                                                        {Number(totals.playerFeesDue) > 0 ? formatPriceExact(totals.playerFeesDue) : "₹0.00"}
                                                    </td>
                                                    <td>
                                                        {totals.playerFeesExpected > 0 ? (
                                                            <div className="d-flex align-items-center gap-2">
                                                                <div className="progress flex-grow-1" style={{ height: "6px" }}>
                                                                    <div
                                                                        className="progress-bar bg-success"
                                                                        style={{
                                                                            width: `${Math.min(100, (totals.playerFeesReceived / totals.playerFeesExpected) * 100)}%`,
                                                                        }}
                                                                    />
                                                                </div>
                                                                <small className="text-muted fw-bold">
                                                                    {Math.round((totals.playerFeesReceived / totals.playerFeesExpected) * 100)}%
                                                                </small>
                                                            </div>
                                                        ) : (
                                                            <span className="badge bg-light text-muted border">No Demand</span>
                                                        )}
                                                    </td>
                                                    <td className="text-center">
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-primary"
                                                            onClick={() => setActiveTab("player-fees")}
                                                        >
                                                            View Details
                                                        </button>
                                                    </td>
                                                </tr>

                                                {/* Stream 2: Match Fees */}
                                                <tr>
                                                    <td>
                                                        <div className="fw-bold d-flex align-items-center gap-2">
                                                            <Swords size={16} className="text-warning-emphasis" />
                                                            <span>Match Fees (Match-Wise)</span>
                                                        </div>
                                                        <small className="text-muted">{totals.totalMatchesCount} matches scheduled</small>
                                                    </td>
                                                    <td>Player/Team Match Fees</td>
                                                    <td className="text-end fw-semibold">{formatPriceExact(totals.matchFeesExpected)}</td>
                                                    <td className="text-end fw-bold text-success">{formatPriceExact(totals.matchFeesReceived)}</td>
                                                    <td className="text-end fw-bold text-danger">
                                                        {Number(totals.matchFeesDue) > 0 ? formatPriceExact(totals.matchFeesDue) : "₹0.00"}
                                                    </td>
                                                    <td>
                                                        {totals.matchFeesExpected > 0 ? (
                                                            <div className="d-flex align-items-center gap-2">
                                                                <div className="progress flex-grow-1" style={{ height: "6px" }}>
                                                                    <div
                                                                        className="progress-bar bg-success"
                                                                        style={{
                                                                            width: `${Math.min(100, (totals.matchFeesReceived / totals.matchFeesExpected) * 100)}%`,
                                                                        }}
                                                                    />
                                                                </div>
                                                                <small className="text-muted fw-bold">
                                                                    {Math.round((totals.matchFeesReceived / totals.matchFeesExpected) * 100)}%
                                                                </small>
                                                            </div>
                                                        ) : (
                                                            <span className="badge bg-light text-muted border">No Matches</span>
                                                        )}
                                                    </td>
                                                    <td className="text-center">
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-primary"
                                                            onClick={() => setActiveTab("match-fees")}
                                                        >
                                                            View Details
                                                        </button>
                                                    </td>
                                                </tr>

                                                {/* Stream 3: Ground Rentals */}
                                                <tr>
                                                    <td>
                                                        <div className="fw-bold d-flex align-items-center gap-2">
                                                            <Trees size={16} className="text-success" />
                                                            <span>Ground Booking Rentals</span>
                                                        </div>
                                                        <small className="text-muted">{totals.totalGroundBookingsCount} bookings in month</small>
                                                    </td>
                                                    <td>Slot &amp; Ground Lease</td>
                                                    <td className="text-end fw-semibold">{formatPriceExact(totals.groundRentalsExpected)}</td>
                                                    <td className="text-end fw-bold text-success">{formatPriceExact(totals.groundRentalsReceived)}</td>
                                                    <td className="text-end fw-bold text-danger">
                                                        {Number(totals.groundRentalsDue) > 0 ? formatPriceExact(totals.groundRentalsDue) : "₹0.00"}
                                                    </td>
                                                    <td>
                                                        {totals.groundRentalsExpected > 0 ? (
                                                            <div className="d-flex align-items-center gap-2">
                                                                <div className="progress flex-grow-1" style={{ height: "6px" }}>
                                                                    <div
                                                                        className="progress-bar bg-success"
                                                                        style={{
                                                                            width: `${Math.min(100, (totals.groundRentalsReceived / totals.groundRentalsExpected) * 100)}%`,
                                                                        }}
                                                                    />
                                                                </div>
                                                                <small className="text-muted fw-bold">
                                                                    {Math.round((totals.groundRentalsReceived / totals.groundRentalsExpected) * 100)}%
                                                                </small>
                                                            </div>
                                                        ) : (
                                                            <span className="badge bg-light text-muted border">No Bookings</span>
                                                        )}
                                                    </td>
                                                    <td className="text-center">
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-primary"
                                                            onClick={() => setActiveTab("ground-rentals")}
                                                        >
                                                            View Details
                                                        </button>
                                                    </td>
                                                </tr>

                                                {/* SUB-TOTAL INFLOW */}
                                                <tr className="table-light border-2">
                                                    <th colSpan="2" className="text-success">TOTAL MONTHLY INFLOW</th>
                                                    <th className="text-end fw-bold text-dark">{formatPriceExact(totals.totalInflowExpected)}</th>
                                                    <th className="text-end fw-bold text-success">{formatPriceExact(totals.totalInflowReceived)}</th>
                                                    <th className="text-end fw-bold text-danger">{formatPriceExact(totals.totalInflowDue)}</th>
                                                    <th colSpan="2">
                                                        <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                                                            Collected: {totals.totalInflowExpected > 0 ? Math.round((totals.totalInflowReceived / totals.totalInflowExpected) * 100) : 0}%
                                                        </span>
                                                    </th>
                                                </tr>

                                                {/* Header: OUTFLOW */}
                                                <tr className="table-danger bg-opacity-25">
                                                    <th colSpan="7" className="text-danger text-uppercase small fw-bold">
                                                        Expense Streams (Outflow / Remuneration)
                                                    </th>
                                                </tr>

                                                {/* Stream 4: Staff Salaries */}
                                                <tr>
                                                    <td>
                                                        <div className="fw-bold d-flex align-items-center gap-2">
                                                            <CreditCard size={16} className="text-danger" />
                                                            <span>Staff &amp; Coach Salaries</span>
                                                        </div>
                                                        <small className="text-muted">{staffSalaries.salaries.length} staff records</small>
                                                    </td>
                                                    <td>Monthly Payroll</td>
                                                    <td className="text-end fw-semibold">{formatPriceExact(totals.staffSalariesPayable)}</td>
                                                    <td className="text-end fw-bold text-danger">{formatPriceExact(totals.staffSalariesPaid)}</td>
                                                    <td className="text-end fw-bold text-danger">
                                                        {Number(totals.staffSalariesDue) > 0 ? formatPriceExact(totals.staffSalariesDue) : "₹0.00"}
                                                    </td>
                                                    <td>
                                                        <span
                                                            className={`badge ${
                                                                totals.staffSalariesDue <= 0 && totals.staffSalariesPayable > 0
                                                                    ? "bg-success"
                                                                    : totals.staffSalariesPaid > 0
                                                                    ? "bg-info"
                                                                    : "bg-warning text-dark"
                                                            }`}
                                                        >
                                                            {totals.staffSalariesDue <= 0 && totals.staffSalariesPayable > 0
                                                                ? "Fully Disbursed"
                                                                : totals.staffSalariesPaid > 0
                                                                ? "Partially Disbursed"
                                                                : "Pending"}
                                                        </span>
                                                    </td>
                                                    <td className="text-center">
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-danger"
                                                            onClick={() => setActiveTab("staff-salaries")}
                                                        >
                                                            View Details
                                                        </button>
                                                    </td>
                                                </tr>

                                                {/* Stream 5: Umpire Fees */}
                                                <tr>
                                                    <td>
                                                        <div className="fw-bold d-flex align-items-center gap-2">
                                                            <UserCheck size={16} className="text-info" />
                                                            <span>Umpire Remuneration</span>
                                                        </div>
                                                        <small className="text-muted">{totals.totalUmpireDutiesCount} match/booking duties</small>
                                                    </td>
                                                    <td>Officiating Fees</td>
                                                    <td className="text-end fw-semibold">{formatPriceExact(totals.umpireFeesPayable)}</td>
                                                    <td className="text-end fw-bold text-danger">{formatPriceExact(totals.umpireFeesPaid)}</td>
                                                    <td className="text-end fw-bold text-danger">
                                                        {Number(totals.umpireFeesDue) > 0 ? formatPriceExact(totals.umpireFeesDue) : "₹0.00"}
                                                    </td>
                                                    <td>
                                                        <span
                                                            className={`badge ${
                                                                totals.umpireFeesDue <= 0 && totals.umpireFeesPayable > 0
                                                                    ? "bg-success"
                                                                    : totals.umpireFeesPaid > 0
                                                                    ? "bg-info"
                                                                    : "bg-warning text-dark"
                                                            }`}
                                                        >
                                                            {totals.umpireFeesDue <= 0 && totals.umpireFeesPayable > 0
                                                                ? "Fully Paid"
                                                                : totals.umpireFeesPaid > 0
                                                                ? "Partially Paid"
                                                                : "Pending Payment"}
                                                        </span>
                                                    </td>
                                                    <td className="text-center">
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-info"
                                                            onClick={() => setActiveTab("umpire-fees")}
                                                        >
                                                            View Details
                                                        </button>
                                                    </td>
                                                </tr>

                                                {/* SUB-TOTAL OUTFLOW */}
                                                <tr className="table-light border-2">
                                                    <th colSpan="2" className="text-danger">TOTAL MONTHLY OUTFLOW</th>
                                                    <th className="text-end fw-bold text-dark">{formatPriceExact(totals.totalOutflowPayable)}</th>
                                                    <th className="text-end fw-bold text-danger">{formatPriceExact(totals.totalOutflowPaid)}</th>
                                                    <th className="text-end fw-bold text-danger">{formatPriceExact(totals.totalOutflowDue)}</th>
                                                    <th colSpan="2">
                                                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1">
                                                            Paid: {totals.totalOutflowPayable > 0 ? Math.round((totals.totalOutflowPaid / totals.totalOutflowPayable) * 100) : 0}%
                                                        </span>
                                                    </th>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Final Net Surplus Balance Box */}
                                    <div
                                        className={`p-4 rounded-4 text-center ${
                                            totals.isCashPositive
                                                ? "bg-success-subtle border border-success"
                                                : "bg-danger-subtle border border-danger"
                                        }`}
                                    >
                                        <small className="fw-bold text-uppercase d-block mb-1">
                                            Final Net Operating Cash Position for {selectedMonthName} {year}
                                        </small>
                                        <h2 className={`fw-bold mb-1 ${totals.isCashPositive ? "text-success" : "text-danger"}`}>
                                            {totals.netCashFlow < 0 ? "-" : "+"}
                                            {formatPriceExact(Math.abs(totals.netCashFlow))}
                                        </h2>
                                        <p className="mb-0 text-muted small">
                                            {totals.isCashPositive
                                                ? `The academy has an operational net surplus cash in hand of ${formatPriceExact(totals.netCashFlow)} (Received: ${formatPrice(totals.totalInflowReceived)} - Paid: ${formatPrice(totals.totalOutflowPaid)}).`
                                                : `The academy operated with an operational cash deficit of ${formatPriceExact(Math.abs(totals.netCashFlow))}.`}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: MATCH FEES (MATCH-WISE BREAKDOWN) */}
                            {activeTab === "match-fees" && (
                                <div className="space-y-4">
                                    {/* Match KPI Summary */}
                                    <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white">
                                        <div className="row g-3 align-items-center">
                                            <div className="col-md-3">
                                                <small className="text-muted fw-semibold">Total Match Fee Demand</small>
                                                <h4 className="fw-bold text-dark mt-1 mb-0">{formatPrice(totals.matchFeesExpected)}</h4>
                                                <small className="text-muted">Total Match Fee Demand</small>
                                            </div>
                                            <div className="col-md-3">
                                                <small className="text-muted fw-semibold">Total Fees Received</small>
                                                <h4 className="fw-bold text-success mt-1 mb-0">{formatPrice(totals.matchFeesReceived)}</h4>
                                                <small className="text-muted">Match Fees Collected</small>
                                            </div>
                                            <div className="col-md-3">
                                                <small className="text-muted fw-semibold">Total Balance Due</small>
                                                <h4 className="fw-bold text-danger mt-1 mb-0">{formatPrice(totals.matchFeesDue)}</h4>
                                                <small className="text-muted">Balance Due</small>
                                            </div>
                                            <div className="col-md-3 text-md-end">
                                                <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-3 py-2 fw-semibold">
                                                    <Swords size={14} className="me-1" /> {matchFees.matches.length} Matches in {selectedMonthName}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Match-Wise List */}
                                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                                            <div>
                                                <h5 className="fw-bold mb-0">Match-Wise Fee Collection Breakdown</h5>
                                                <small className="text-muted">Match-wise fee demand vs. collected revenue</small>
                                            </div>
                                            <div style={{ maxWidth: "260px" }}>
                                                <div className="input-group input-group-sm">
                                                    <span className="input-group-text bg-light border-end-0">
                                                        <Search size={14} />
                                                    </span>
                                                    <input
                                                        type="text"
                                                        className="form-control border-start-0"
                                                        placeholder="Search match #, team, ground..."
                                                        value={matchSearch}
                                                        onChange={(e) => setMatchSearch(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {filteredMatches.length === 0 ? (
                                            <div className="text-center py-5 text-muted">
                                                <Swords size={40} className="mb-2 opacity-50" />
                                                <h5>No Matches Found</h5>
                                                <p className="small mb-0">No matches found for {selectedMonthName} {year}.</p>
                                            </div>
                                        ) : (
                                            <div className="table-responsive">
                                                <table className="table table-hover align-middle mb-0">
                                                    <thead className="table-light">
                                                        <tr>
                                                            <th>#</th>
                                                            <th>Match #</th>
                                                            <th>Date &amp; Time</th>
                                                            <th>Teams</th>
                                                            <th>Venue / Ground</th>
                                                            <th>Type</th>
                                                            <th className="text-end">Expected Demand (₹)</th>
                                                            <th className="text-end">Amount Received (₹)</th>
                                                            <th className="text-end">Balance Due (₹)</th>
                                                            <th className="text-center">Fee Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredMatches.map((m, idx) => (
                                                            <tr key={m.match_id}>
                                                                <th>{idx + 1}</th>
                                                                <td>
                                                                    <div className="fw-bold text-primary">{m.match_no}</div>
                                                                    {m.branch_name && <small className="text-muted">{m.branch_name}</small>}
                                                                </td>
                                                                <td>
                                                                    <div>{formatDate(m.match_date)}</div>
                                                                    {m.match_time && <small className="text-muted">{m.match_time}</small>}
                                                                </td>
                                                                <td>
                                                                    <div className="fw-semibold">
                                                                        {m.team_a_name} <span className="text-muted fw-normal">vs</span> {m.team_b_name}
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <span className="badge bg-light text-dark border">
                                                                        {m.ground_name}
                                                                    </span>
                                                                </td>
                                                                <td>
                                                                    <span className="badge bg-secondary-subtle text-secondary">
                                                                        {m.match_type}
                                                                    </span>
                                                                </td>
                                                                <td className="text-end fw-bold text-dark">
                                                                    {formatPriceExact(m.expected_fee)}
                                                                    {m.player_fee_records > 0 && (
                                                                        <small className="text-muted d-block font-monospace">
                                                                            ({m.player_fee_records} players)
                                                                        </small>
                                                                    )}
                                                                </td>
                                                                <td className="text-end fw-bold text-success">
                                                                    {formatPriceExact(m.received_fee)}
                                                                </td>
                                                                <td className="text-end fw-bold text-danger">
                                                                    {Number(m.due_fee) > 0 ? formatPriceExact(m.due_fee) : "₹0.00"}
                                                                </td>
                                                                <td className="text-center">
                                                                    <span
                                                                        className={`badge ${
                                                                            m.fee_payment_status === "Paid"
                                                                                ? "bg-success"
                                                                                : m.fee_payment_status === "Partial"
                                                                                ? "bg-info"
                                                                                : m.fee_payment_status === "Pending"
                                                                                ? "bg-warning text-dark"
                                                                                : "bg-light text-muted border"
                                                                        }`}
                                                                    >
                                                                        {m.fee_payment_status}
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
                            )}

                            {/* TAB 3: PLAYER PROGRAM FEES */}
                            {activeTab === "player-fees" && (
                                <div className="space-y-4">
                                    {/* Program KPI Summary */}
                                    <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white">
                                        <div className="row g-3 align-items-center">
                                            <div className="col-md-3">
                                                <small className="text-muted fw-semibold">Total Program Fee Demand</small>
                                                <h4 className="fw-bold text-dark mt-1 mb-0">{formatPrice(totals.playerFeesExpected)}</h4>
                                                <small className="text-muted">Total Program Fee Demand</small>
                                            </div>
                                            <div className="col-md-3">
                                                <small className="text-muted fw-semibold">Total Fees Received</small>
                                                <h4 className="fw-bold text-success mt-1 mb-0">{formatPrice(totals.playerFeesReceived)}</h4>
                                                <small className="text-muted">Fees Collected</small>
                                            </div>
                                            <div className="col-md-3">
                                                <small className="text-muted fw-semibold">Pending Due Balance</small>
                                                <h4 className="fw-bold text-danger mt-1 mb-0">{formatPrice(totals.playerFeesDue)}</h4>
                                                <small className="text-muted">Pending Balance</small>
                                            </div>
                                            <div className="col-md-3 text-md-end">
                                                <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-2 fw-semibold">
                                                    <Users size={14} className="me-1" /> {totals.totalUniquePlayers} Students Enrolled
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Program-Wise Demand vs Collection */}
                                    <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white">
                                        <h5 className="fw-bold mb-3">Program-Wise Fee Demand vs Received</h5>
                                        {playerFees.programsSummary.length === 0 ? (
                                            <div className="text-center py-4 text-muted">No program fee records in this month.</div>
                                        ) : (
                                            <div className="table-responsive">
                                                <table className="table table-hover align-middle mb-0">
                                                    <thead className="table-light">
                                                        <tr>
                                                            <th>#</th>
                                                            <th>Program Name</th>
                                                            <th>Program Code</th>
                                                            <th>Enrolled Students</th>
                                                            <th className="text-end">Expected Demand (₹)</th>
                                                            <th className="text-end">Amount Received (₹)</th>
                                                            <th className="text-end">Balance Due (₹)</th>
                                                            <th>Recovery %</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {playerFees.programsSummary.map((prog, idx) => (
                                                            <tr key={prog.program_id || idx}>
                                                                <th>{idx + 1}</th>
                                                                <td className="fw-bold">{prog.program_name}</td>
                                                                <td>
                                                                    <span className="badge bg-light text-dark border">
                                                                        {prog.program_code || "—"}
                                                                    </span>
                                                                </td>
                                                                <td>
                                                                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                                                        {prog.total_students} Students
                                                                    </span>
                                                                </td>
                                                                <td className="text-end fw-bold text-dark">
                                                                    {formatPriceExact(prog.expected_demand)}
                                                                </td>
                                                                <td className="text-end fw-bold text-success">
                                                                    {formatPriceExact(prog.received_amount)}
                                                                </td>
                                                                <td className="text-end fw-bold text-danger">
                                                                    {Number(prog.due_amount) > 0 ? formatPriceExact(prog.due_amount) : "₹0.00"}
                                                                </td>
                                                                <td>
                                                                    {prog.expected_demand > 0 ? (
                                                                        <div className="d-flex align-items-center gap-2">
                                                                            <div className="progress flex-grow-1" style={{ height: "6px" }}>
                                                                                <div
                                                                                    className="progress-bar bg-success"
                                                                                    style={{
                                                                                        width: `${Math.min(100, (prog.received_amount / prog.expected_demand) * 100)}%`,
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                            <small className="text-muted fw-bold">
                                                                                {Math.round((prog.received_amount / prog.expected_demand) * 100)}%
                                                                            </small>
                                                                        </div>
                                                                    ) : (
                                                                        "—"
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Student-wise Records */}
                                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                                            <h5 className="fw-bold mb-0">Player Program Fee Records ({filteredPlayers.length})</h5>
                                            <div style={{ maxWidth: "260px" }}>
                                                <div className="input-group input-group-sm">
                                                    <span className="input-group-text bg-light border-end-0">
                                                        <Search size={14} />
                                                    </span>
                                                    <input
                                                        type="text"
                                                        className="form-control border-start-0"
                                                        placeholder="Search player, admission #..."
                                                        value={playerSearch}
                                                        onChange={(e) => setPlayerSearch(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {filteredPlayers.length === 0 ? (
                                            <div className="text-center py-4 text-muted">No student records found.</div>
                                        ) : (
                                            <div className="table-responsive">
                                                <table className="table table-hover align-middle mb-0">
                                                    <thead className="table-light">
                                                        <tr>
                                                            <th>Admission #</th>
                                                            <th>Player Name</th>
                                                            <th>Program</th>
                                                            <th>Branch</th>
                                                            <th className="text-end">Fee Demand (₹)</th>
                                                            <th className="text-end">Amount Received (₹)</th>
                                                            <th className="text-end">Balance Due (₹)</th>
                                                            <th className="text-center">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredPlayers.map((p) => (
                                                            <tr key={p.id}>
                                                                <td className="fw-bold text-primary">{p.admission_no || `#${p.id}`}</td>
                                                                <td>
                                                                    <div className="fw-semibold">{p.player_name}</div>
                                                                    {p.player_phone && <small className="text-muted">{p.player_phone}</small>}
                                                                </td>
                                                                <td>
                                                                    <span className="badge bg-light text-dark border">
                                                                        {p.program_name || "General"}
                                                                    </span>
                                                                </td>
                                                                <td>{p.branch_name || "—"}</td>
                                                                <td className="text-end fw-semibold">{formatPriceExact(p.total_amount)}</td>
                                                                <td className="text-end fw-bold text-success">{formatPriceExact(p.paid_amount)}</td>
                                                                <td className="text-end fw-bold text-danger">
                                                                    {Number(p.due_amount) > 0 ? formatPriceExact(p.due_amount) : "₹0.00"}
                                                                </td>
                                                                <td className="text-center">
                                                                    <span
                                                                        className={`badge ${
                                                                            p.payment_status === "Paid"
                                                                                ? "bg-success"
                                                                                : p.payment_status === "Partial"
                                                                                ? "bg-info"
                                                                                : "bg-warning text-dark"
                                                                        }`}
                                                                    >
                                                                        {p.payment_status}
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
                            )}

                            {/* TAB 4: GROUND BOOKING RENTALS */}
                            {activeTab === "ground-rentals" && (
                                <div className="space-y-4">
                                    {/* Ground Rental KPI Summary */}
                                    <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white">
                                        <div className="row g-3 align-items-center">
                                            <div className="col-md-3">
                                                <small className="text-muted fw-semibold">Total Rental Demand</small>
                                                <h4 className="fw-bold text-dark mt-1 mb-0">{formatPrice(totals.groundRentalsExpected)}</h4>
                                                <small className="text-muted">Total Bookings Rental Demand</small>
                                            </div>
                                            <div className="col-md-3">
                                                <small className="text-muted fw-semibold">Rentals Received</small>
                                                <h4 className="fw-bold text-success mt-1 mb-0">{formatPrice(totals.groundRentalsReceived)}</h4>
                                                <small className="text-muted">Rentals Collected</small>
                                            </div>
                                            <div className="col-md-3">
                                                <small className="text-muted fw-semibold">Pending Due Balance</small>
                                                <h4 className="fw-bold text-danger mt-1 mb-0">{formatPrice(totals.groundRentalsDue)}</h4>
                                                <small className="text-muted">Pending Balance</small>
                                            </div>
                                            <div className="col-md-3 text-md-end">
                                                <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 fw-semibold">
                                                    <Trees size={14} className="me-1" /> {groundRentals.bookings.length} Bookings in {selectedMonthName}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Ground-Wise Summary */}
                                    <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white">
                                        <h5 className="fw-bold mb-3">Ground-Wise Rental Demand vs Received</h5>
                                        {groundRentals.groundsSummary.length === 0 ? (
                                            <div className="text-center py-4 text-muted">No ground rentals in this month.</div>
                                        ) : (
                                            <div className="table-responsive">
                                                <table className="table table-hover align-middle mb-0">
                                                    <thead className="table-light">
                                                        <tr>
                                                            <th>#</th>
                                                            <th>Ground Name</th>
                                                            <th>Ground Code</th>
                                                            <th>Bookings Count</th>
                                                            <th className="text-end">Expected Demand (₹)</th>
                                                            <th className="text-end">Amount Received (₹)</th>
                                                            <th className="text-end">Balance Due (₹)</th>
                                                            <th>Recovery %</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {groundRentals.groundsSummary.map((g, idx) => (
                                                            <tr key={g.ground_id || idx}>
                                                                <th>{idx + 1}</th>
                                                                <td className="fw-bold">{g.ground_name}</td>
                                                                <td>
                                                                    <span className="badge bg-light text-dark border">
                                                                        {g.ground_code || "—"}
                                                                    </span>
                                                                </td>
                                                                <td>{g.bookings_count} bookings</td>
                                                                <td className="text-end fw-bold text-dark">{formatPriceExact(g.expected_rental)}</td>
                                                                <td className="text-end fw-bold text-success">{formatPriceExact(g.received_rental)}</td>
                                                                <td className="text-end fw-bold text-danger">
                                                                    {Number(g.due_rental) > 0 ? formatPriceExact(g.due_rental) : "₹0.00"}
                                                                </td>
                                                                <td>
                                                                    {g.expected_rental > 0 ? (
                                                                        <div className="d-flex align-items-center gap-2">
                                                                            <div className="progress flex-grow-1" style={{ height: "6px" }}>
                                                                                <div
                                                                                    className="progress-bar bg-success"
                                                                                    style={{
                                                                                        width: `${Math.min(100, (g.received_rental / g.expected_rental) * 100)}%`,
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                            <small className="text-muted fw-bold">
                                                                                {Math.round((g.received_rental / g.expected_rental) * 100)}%
                                                                            </small>
                                                                        </div>
                                                                    ) : (
                                                                        "—"
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Individual Bookings List */}
                                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                                        <h5 className="fw-bold mb-3">All Ground Bookings in {selectedMonthName} {year}</h5>
                                        {groundRentals.bookings.length === 0 ? (
                                            <div className="text-center py-4 text-muted">No bookings recorded.</div>
                                        ) : (
                                            <div className="table-responsive">
                                                <table className="table table-hover align-middle mb-0">
                                                    <thead className="table-light">
                                                        <tr>
                                                            <th>Booking #</th>
                                                            <th>Ground</th>
                                                            <th>Customer</th>
                                                            <th>Booking Date</th>
                                                            <th>Purpose</th>
                                                            <th className="text-end">Booking Demand (₹)</th>
                                                            <th className="text-end">Amount Received (₹)</th>
                                                            <th className="text-end">Balance Due (₹)</th>
                                                            <th className="text-center">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {groundRentals.bookings.map((gb) => (
                                                            <tr key={gb.booking_id}>
                                                                <td className="fw-bold text-primary">{gb.booking_no}</td>
                                                                <td>
                                                                    <div className="fw-semibold">{gb.ground_name}</div>
                                                                    {gb.branch_name && <small className="text-muted">{gb.branch_name}</small>}
                                                                </td>
                                                                <td>
                                                                    <div>{gb.customer_name}</div>
                                                                    <small className="text-muted">{gb.customer_phone}</small>
                                                                </td>
                                                                <td>{formatDate(gb.booking_date)}</td>
                                                                <td>
                                                                    <span className="badge bg-light text-dark border">
                                                                        {gb.purpose}
                                                                    </span>
                                                                </td>
                                                                <td className="text-end fw-semibold">{formatPriceExact(gb.total_amount)}</td>
                                                                <td className="text-end fw-bold text-success">{formatPriceExact(gb.paid_amount)}</td>
                                                                <td className="text-end fw-bold text-danger">
                                                                    {Number(gb.balance_amount) > 0 ? formatPriceExact(gb.balance_amount) : "₹0.00"}
                                                                </td>
                                                                <td className="text-center">
                                                                    <span
                                                                        className={`badge ${
                                                                            gb.payment_status === "Paid"
                                                                                ? "bg-success"
                                                                                : gb.payment_status === "Partial"
                                                                                ? "bg-info"
                                                                                : "bg-warning text-dark"
                                                                        }`}
                                                                    >
                                                                        {gb.payment_status}
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
                            )}

                            {/* TAB 5: STAFF & COACH SALARIES */}
                            {activeTab === "staff-salaries" && (
                                <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                                        <div>
                                            <h5 className="fw-bold mb-0">Staff &amp; Coach Payroll Summary</h5>
                                            <small className="text-muted">Monthly payroll breakdown by staff member</small>
                                        </div>
                                        <div style={{ maxWidth: "260px" }}>
                                            <div className="input-group input-group-sm">
                                                <span className="input-group-text bg-light border-end-0">
                                                    <Search size={14} />
                                                </span>
                                                <input
                                                    type="text"
                                                    className="form-control border-start-0"
                                                    placeholder="Search staff, appointment #..."
                                                    value={staffSearch}
                                                    onChange={(e) => setStaffSearch(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Staff KPI Row */}
                                    <div className="row g-3 mb-4">
                                        <div className="col-md-3">
                                            <div className="p-3 bg-light rounded-4">
                                                <small className="text-muted fw-semibold">Total Salary Payable</small>
                                                <h4 className="fw-bold text-dark mt-1 mb-0">{formatPrice(totals.staffSalariesPayable)}</h4>
                                                <small className="text-muted">Total Net Salary Payable</small>
                                            </div>
                                        </div>
                                        <div className="col-md-3">
                                            <div className="p-3 bg-danger-subtle rounded-4">
                                                <small className="text-danger fw-semibold">Total Salary Paid</small>
                                                <h4 className="fw-bold text-danger mt-1 mb-0">{formatPrice(totals.staffSalariesPaid)}</h4>
                                                <small className="text-muted">Total Salary Disbursed</small>
                                            </div>
                                        </div>
                                        <div className="col-md-3">
                                            <div className="p-3 bg-warning-subtle rounded-4">
                                                <small className="text-warning-emphasis fw-semibold">Salary Balance Due</small>
                                                <h4 className="fw-bold text-danger mt-1 mb-0">{formatPrice(totals.staffSalariesDue)}</h4>
                                                <small className="text-muted">Balance Due</small>
                                            </div>
                                        </div>
                                        <div className="col-md-3">
                                            <div className="p-3 bg-primary-subtle rounded-4">
                                                <small className="text-primary fw-semibold">Staff Count</small>
                                                <h4 className="fw-bold text-primary mt-1 mb-0">{totals.totalPaidStaffCount} / {staffSalaries.salaries.length}</h4>
                                                <small className="text-muted">Staff Disbursed</small>
                                            </div>
                                        </div>
                                    </div>

                                    {filteredStaff.length === 0 ? (
                                        <div className="text-center py-5 text-muted">
                                            <CreditCard size={40} className="mb-2 opacity-50" />
                                            <h5>No Salary Records Found</h5>
                                            <p className="small mb-0">No salary records found for {selectedMonthName} {year}.</p>
                                        </div>
                                    ) : (
                                        <div className="table-responsive">
                                            <table className="table table-hover align-middle mb-0">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>Appt #</th>
                                                        <th>Staff Name</th>
                                                        <th>Role / Designation</th>
                                                        <th>Branch</th>
                                                        <th className="text-end">Net Salary Payable (₹)</th>
                                                        <th className="text-end">Amount Paid (₹)</th>
                                                        <th className="text-end">Balance Due (₹)</th>
                                                        <th>Payment Date</th>
                                                        <th className="text-center">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredStaff.map((s) => (
                                                        <tr key={s.id}>
                                                            <td className="fw-bold text-dark">{s.appointment_no || `#${s.staff_id}`}</td>
                                                            <td>
                                                                <div className="fw-semibold">{s.staff_name}</div>
                                                                {s.speciality && <small className="text-muted">{s.speciality}</small>}
                                                            </td>
                                                            <td>
                                                                <span className="badge bg-light text-dark border">
                                                                    {s.designation || "Staff"}
                                                                </span>
                                                            </td>
                                                            <td>{s.branch_name || "—"}</td>
                                                            <td className="text-end fw-semibold">{formatPriceExact(s.net_salary)}</td>
                                                            <td className="text-end fw-bold text-danger">
                                                                {formatPriceExact(s.paid_amount)}
                                                            </td>
                                                            <td className="text-end fw-bold text-danger">
                                                                {Number(s.due_amount) > 0 ? (
                                                                    formatPriceExact(s.due_amount)
                                                                ) : (
                                                                    <span className="text-muted">₹0.00</span>
                                                                )}
                                                            </td>
                                                            <td>{formatDate(s.payment_date)}</td>
                                                            <td className="text-center">
                                                                <span
                                                                    className={`badge ${
                                                                        s.payment_status === "Paid"
                                                                            ? "bg-success"
                                                                            : s.payment_status === "Partial"
                                                                            ? "bg-info"
                                                                            : "bg-warning text-dark"
                                                                    }`}
                                                                >
                                                                    {s.payment_status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 6: UMPIRE REMUNERATION */}
                            {activeTab === "umpire-fees" && (
                                <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                                        <div>
                                            <h5 className="fw-bold mb-0">Umpire Officiating Remuneration</h5>
                                            <small className="text-muted">Officiating duties in Ground Bookings and Matches with fee payable vs paid</small>
                                        </div>
                                        <div className="d-flex align-items-center gap-2">
                                            <Link
                                                href="/next_panel/umpire-payments/new"
                                                className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1"
                                            >
                                                + Pay Umpire Fee
                                            </Link>
                                        </div>
                                    </div>

                                    {/* Umpire KPI Row */}
                                    <div className="row g-3 mb-4">
                                        <div className="col-md-3">
                                            <div className="p-3 bg-light rounded-4">
                                                <small className="text-muted fw-semibold">Total Remuneration Payable</small>
                                                <h4 className="fw-bold text-dark mt-1 mb-0">{formatPrice(totals.umpireFeesPayable)}</h4>
                                                <small className="text-muted">Total Remuneration Payable</small>
                                            </div>
                                        </div>
                                        <div className="col-md-3">
                                            <div className="p-3 bg-danger-subtle rounded-4">
                                                <small className="text-danger fw-semibold">Total Remuneration Paid</small>
                                                <h4 className="fw-bold text-danger mt-1 mb-0">{formatPrice(totals.umpireFeesPaid)}</h4>
                                                <small className="text-muted">Remuneration Disbursed</small>
                                            </div>
                                        </div>
                                        <div className="col-md-3">
                                            <div className="p-3 bg-warning-subtle rounded-4">
                                                <small className="text-warning-emphasis fw-semibold">Remuneration Balance Due</small>
                                                <h4 className="fw-bold text-danger mt-1 mb-0">{formatPrice(totals.umpireFeesDue)}</h4>
                                                <small className="text-muted">Pending Balance</small>
                                            </div>
                                        </div>
                                        <div className="col-md-3">
                                            <div className="p-3 bg-info-subtle rounded-4">
                                                <small className="text-info fw-semibold">Total Duties</small>
                                                <h4 className="fw-bold text-dark mt-1 mb-0">{totals.totalUmpireDutiesCount}</h4>
                                                <small className="text-muted">Assigned Matches &amp; Bookings</small>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Duties List */}
                                    {filteredUmpires.length === 0 ? (
                                        <div className="text-center py-5 text-muted">
                                            <UserCheck size={40} className="mb-2 opacity-50" />
                                            <h5>No Umpire Assignments in This Month</h5>
                                            <p className="small mb-0">No umpire officiating duties recorded for {selectedMonthName} {year}.</p>
                                        </div>
                                    ) : (
                                        <div className="table-responsive">
                                            <table className="table table-hover align-middle mb-0">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>Event Date</th>
                                                        <th>Umpire Name</th>
                                                        <th>Duty Type</th>
                                                        <th>Reference #</th>
                                                        <th>Venue / Ground</th>
                                                        <th>Branch</th>
                                                        <th className="text-end">Total Payable (₹)</th>
                                                        <th className="text-end">Amount Paid (₹)</th>
                                                        <th className="text-end">Balance Due (₹)</th>
                                                        <th className="text-center">Status</th>
                                                        <th className="text-center">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredUmpires.map((u, idx) => (
                                                        <tr key={idx}>
                                                            <td>{formatDate(u.event_date)}</td>
                                                            <td>
                                                                <div className="fw-semibold">{u.umpire_name}</div>
                                                                <small className="text-muted">{u.mobile}</small>
                                                            </td>
                                                            <td>
                                                                <span
                                                                    className={`badge ${
                                                                        u.duty_type === "Match"
                                                                            ? "bg-warning-subtle text-warning-emphasis"
                                                                            : "bg-info-subtle text-info"
                                                                    }`}
                                                                >
                                                                    {u.duty_type}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className="fw-bold text-primary">{u.reference_no}</span>
                                                            </td>
                                                            <td>{u.ground_name}</td>
                                                            <td>{u.branch_name || "—"}</td>
                                                            <td className="text-end fw-semibold">{formatPriceExact(u.fee_payable)}</td>
                                                            <td className="text-end fw-bold text-danger">{formatPriceExact(u.fee_paid)}</td>
                                                            <td className="text-end fw-bold text-danger">
                                                                {Number(u.fee_due) > 0 ? (
                                                                    formatPriceExact(u.fee_due)
                                                                ) : (
                                                                    <span className="text-muted">₹0.00</span>
                                                                )}
                                                            </td>
                                                            <td className="text-center">
                                                                <span
                                                                    className={`badge ${
                                                                        u.payment_status === "Paid"
                                                                            ? "bg-success"
                                                                            : u.payment_status === "Partial"
                                                                            ? "bg-info"
                                                                            : "bg-warning text-dark"
                                                                    }`}
                                                                >
                                                                    {u.payment_status}
                                                                </span>
                                                            </td>
                                                            <td className="text-center">
                                                                {Number(u.fee_due) > 0 ? (
                                                                    <Link
                                                                        href={`/next_panel/umpire-payments/new?umpire_id=${u.umpire_id}${
                                                                            u.booking_id ? `&booking_id=${u.booking_id}` : ""
                                                                        }${u.match_id ? `&match_id=${u.match_id}` : ""}`}
                                                                        className="btn btn-sm btn-outline-success py-0 px-2"
                                                                    >
                                                                        Pay
                                                                    </Link>
                                                                ) : (
                                                                    <span className="text-success small fw-semibold">Settled</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
