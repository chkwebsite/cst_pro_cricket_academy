"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useUser } from "../components/UserContext";
import { getUserRole, ROLES } from "../../components/lib/rbac-rules";
import {
    Banknote,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Search,
    RefreshCw,
    CreditCard,
    FileText,
    CheckCircle2,
    AlertCircle,
    Building2,
    MapPin,
    ShieldAlert,
    Printer,
    DollarSign,
    Users,
    Clock,
    Loader2,
} from "lucide-react";
import styles from "./staff-salary-payments.module.css";

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export default function StaffSalaryPaymentsPage() {
    const { user } = useUser();
    const role = getUserRole(user);

    const isSuperAdmin = role === ROLES.SUPER_ADMIN;
    const isAcademyAdmin = role === ROLES.ACADEMY_ADMIN;
    const isBranchAdmin = role === ROLES.BRANCH_ADMIN;
    const isAuthorized = isSuperAdmin || isAcademyAdmin || isBranchAdmin;

    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());

    // Tenants & Filters
    const [academies, setAcademies] = useState([]);
    const [branches, setBranches] = useState([]);
    const [selectedAcademy, setSelectedAcademy] = useState(user?.academy_id ? String(user.academy_id) : "");
    const [selectedBranch, setSelectedBranch] = useState(user?.branch_id ? String(user.branch_id) : "");
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");

    // Data State
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [calculating, setCalculating] = useState(false);
    const [error, setError] = useState("");
    const [toast, setToast] = useState(null);

    // Modals
    const [payModalItem, setPayModalItem] = useState(null);
    const [payslipItem, setPayslipItem] = useState(null);
    const [paySubmitting, setPaySubmitting] = useState(false);
    const [payForm, setPayForm] = useState({
        amount: "",
        payment_mode: "Bank Transfer",
        transaction_no: "",
        remarks: "Monthly salary disbursement",
    });

    const showToast = useCallback((msg, type = "success") => {
        setToast({ message: msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    // 1. Load Academies (Super Admin)
    useEffect(() => {
        if (!isSuperAdmin) {
            if (user?.academy_id) setSelectedAcademy(String(user.academy_id));
            return;
        }
        async function fetchAcademies() {
            try {
                const res = await fetch("/api/academies");
                const json = await res.json();
                if (res.ok && json.success) {
                    const list = json.data || [];
                    setAcademies(list);
                    if (list.length > 0 && !selectedAcademy) {
                        setSelectedAcademy(String(list[0].id));
                    }
                }
            } catch (err) {
                console.error("Failed to load academies:", err);
            }
        }
        fetchAcademies();
    }, [isSuperAdmin, user?.academy_id, selectedAcademy]);

    // 2. Load Branches
    useEffect(() => {
        if (isBranchAdmin) {
            if (user?.branch_id) setSelectedBranch(String(user.branch_id));
            if (user?.academy_id) setSelectedAcademy(String(user.academy_id));
            return;
        }

        const effectiveAcad = isSuperAdmin ? selectedAcademy : user?.academy_id;
        if (!effectiveAcad) return;

        async function fetchBranches() {
            try {
                const res = await fetch(`/api/branch?academy_id=${effectiveAcad}`);
                const json = await res.json();
                if (res.ok && json.success) {
                    const list = json.data || [];
                    setBranches(list);
                    if (list.length > 0 && !selectedBranch) {
                        setSelectedBranch(String(list[0].id));
                    }
                }
            } catch (err) {
                console.error("Failed to load branches:", err);
            }
        }
        fetchBranches();
    }, [isSuperAdmin, isBranchAdmin, selectedAcademy, selectedBranch, user?.academy_id, user?.branch_id]);

    // 3. Load Payments for selected period
    const loadPayments = useCallback(async () => {
        if (!isAuthorized) return;
        setLoading(true);
        setError("");

        try {
            const query = new URLSearchParams();
            query.set("month", String(selectedMonth));
            query.set("year", String(selectedYear));
            if (selectedAcademy) query.set("academy_id", selectedAcademy);
            if (selectedBranch) query.set("branch_id", selectedBranch);

            const res = await fetch(`/api/staff-salary-payments?${query.toString()}`);
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to load payroll payments.");
            }
            setPayments(json.data || []);
        } catch (err) {
            console.error("Payment load error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [isAuthorized, selectedMonth, selectedYear, selectedAcademy, selectedBranch]);

    useEffect(() => {
        loadPayments();
    }, [loadPayments]);

    // Bulk Calculate & Generate Attendance-Based Payroll
    const handleBulkCalculate = async () => {
        if (!selectedBranch) {
            showToast("Please select a branch first.", "error");
            return;
        }

        setCalculating(true);
        try {
            const res = await fetch("/api/staff-salary-payments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "generate_bulk",
                    academy_id: Number(selectedAcademy || user?.academy_id),
                    branch_id: Number(selectedBranch || user?.branch_id),
                    month: selectedMonth,
                    year: selectedYear,
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Bulk payroll calculation failed.");
            }

            showToast(json.message || "Attendance-based payroll calculated successfully!", "success");
            loadPayments();
        } catch (err) {
            console.error("Bulk calculation error:", err);
            showToast(err.message, "error");
        } finally {
            setCalculating(false);
        }
    };

    // Single Staff Recalculate
    const handleRecalculateStaff = async (staffId) => {
        try {
            const res = await fetch("/api/staff-salary-payments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    staff_id: staffId,
                    month: selectedMonth,
                    year: selectedYear,
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Recalculation failed.");
            }
            showToast(json.message, "success");
            loadPayments();
        } catch (err) {
            showToast(err.message, "error");
        }
    };

    // Open Pay Modal
    const handleOpenPay = (item) => {
        setPayModalItem(item);
        setPayForm({
            amount: String(item.due_amount > 0 ? item.due_amount : item.net_salary),
            payment_mode: "Bank Transfer",
            transaction_no: "",
            remarks: `Salary payment for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`,
        });
    };

    // Submit Payment Transaction
    const handleSubmitPayment = async (e) => {
        e.preventDefault();
        if (!payModalItem) return;

        setPaySubmitting(true);
        try {
            const res = await fetch("/api/staff-salary-transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    salary_payment_id: payModalItem.id,
                    amount: Number(payForm.amount),
                    payment_mode: payForm.payment_mode,
                    transaction_no: payForm.transaction_no,
                    remarks: payForm.remarks,
                }),
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to record payment transaction.");
            }

            showToast("Payment recorded successfully!", "success");
            setPayModalItem(null);
            loadPayments();
        } catch (err) {
            console.error("Payment error:", err);
            showToast(err.message, "error");
        } finally {
            setPaySubmitting(false);
        }
    };

    // Month Navigation
    const handlePrevMonth = () => {
        if (selectedMonth === 1) {
            setSelectedMonth(12);
            setSelectedYear((y) => y - 1);
        } else {
            setSelectedMonth((m) => m - 1);
        }
    };

    const handleNextMonth = () => {
        if (selectedMonth === 12) {
            setSelectedMonth(1);
            setSelectedYear((y) => y + 1);
        } else {
            setSelectedMonth((m) => m + 1);
        }
    };

    // Filtered list
    const filteredList = useMemo(() => {
        return payments.filter((p) => {
            if (statusFilter !== "All" && p.payment_status !== statusFilter) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const name = `${p.first_name || ""} ${p.last_name || ""}`.toLowerCase();
                const app = String(p.appointment_no || "").toLowerCase();
                const roleName = String(p.role_name || "").toLowerCase();
                return name.includes(q) || app.includes(q) || roleName.includes(q);
            }
            return true;
        });
    }, [payments, statusFilter, searchQuery]);

    // KPI Metrics
    const totalProratedGross = useMemo(() => {
        return filteredList.reduce((acc, curr) => acc + (Number(curr.gross_salary) || 0), 0);
    }, [filteredList]);

    const totalNetPayable = useMemo(() => {
        return filteredList.reduce((acc, curr) => acc + (Number(curr.net_salary) || 0), 0);
    }, [filteredList]);

    const totalDisbursed = useMemo(() => {
        return filteredList.reduce((acc, curr) => acc + (Number(curr.paid_amount) || 0), 0);
    }, [filteredList]);

    const totalPendingDue = useMemo(() => {
        return filteredList.reduce((acc, curr) => acc + (Number(curr.due_amount) || 0), 0);
    }, [filteredList]);

    if (!isAuthorized) {
        return (
            <div className="container py-5 text-center">
                <div className="alert alert-danger d-inline-flex align-items-center gap-2">
                    <ShieldAlert size={20} />
                    <span>Access Denied. Only Administrators can view and disburse salary payments.</span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Toast Alert */}
            {toast && (
                <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 2000 }}>
                    <div className={`alert ${toast.type === "error" ? "alert-danger" : "alert-success"} shadow d-flex align-items-center gap-2 py-2 px-3`}>
                        {toast.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                        <span>{toast.message}</span>
                    </div>
                </div>
            )}

            {/* Header Card */}
            <div className={styles.headerCard}>
                <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
                    <div className={styles.titleArea}>
                        <h1>
                            <Banknote className="text-success" size={26} />
                            Staff Salary Payments &amp; Payroll
                        </h1>
                        <div className={styles.subtitle}>
                            Salary calculation prorated strictly by working days and monthly attendance records.
                        </div>
                    </div>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                        {/* Month Navigation */}
                        <div className={styles.monthNavArea}>
                            <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm p-1"
                                onClick={handlePrevMonth}
                                title="Previous Month"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <div className={styles.monthBadge}>
                                {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                            </div>
                            <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm p-1"
                                onClick={handleNextMonth}
                                title="Next Month"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>

                        {/* Bulk Recalculate Button */}
                        <button
                            type="button"
                            className="btn btn-primary btn-sm d-flex align-items-center gap-2 fw-semibold shadow-sm"
                            onClick={handleBulkCalculate}
                            disabled={calculating}
                        >
                            <RefreshCw size={15} className={calculating ? "spin" : ""} />
                            {calculating ? "Calculating Attendance..." : "Auto-Calculate All Staff"}
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiIcon} style={{ background: "#eff6ff", color: "#2563eb" }}>
                        <Users size={22} />
                    </div>
                    <div>
                        <div className={styles.kpiLabel}>Staff on Payroll</div>
                        <div className={styles.kpiValue}>{filteredList.length}</div>
                    </div>
                </div>

                <div className={styles.kpiCard}>
                    <div className={styles.kpiIcon} style={{ background: "#f0fdf4", color: "#16a34a" }}>
                        <DollarSign size={22} />
                    </div>
                    <div>
                        <div className={styles.kpiLabel}>Prorated Gross Earned</div>
                        <div className={styles.kpiValue}>₹{totalProratedGross.toLocaleString("en-IN")}</div>
                    </div>
                </div>

                <div className={styles.kpiCard}>
                    <div className={styles.kpiIcon} style={{ background: "#f5f3ff", color: "#7c3aed" }}>
                        <Clock size={22} />
                    </div>
                    <div>
                        <div className={styles.kpiLabel}>Total Net Payable</div>
                        <div className={styles.kpiValue}>₹{totalNetPayable.toLocaleString("en-IN")}</div>
                    </div>
                </div>

                <div className={styles.kpiCard}>
                    <div className={styles.kpiIcon} style={{ background: "#ecfdf5", color: "#059669" }}>
                        <CheckCircle2 size={22} />
                    </div>
                    <div>
                        <div className={styles.kpiLabel}>Paid / Disbursed</div>
                        <div className={styles.kpiValue} style={{ color: "#059669" }}>
                            ₹{totalDisbursed.toLocaleString("en-IN")}
                        </div>
                    </div>
                </div>

                <div className={styles.kpiCard}>
                    <div className={styles.kpiIcon} style={{ background: "#fef2f2", color: "#dc2626" }}>
                        <AlertCircle size={22} />
                    </div>
                    <div>
                        <div className={styles.kpiLabel}>Pending Balance Due</div>
                        <div className={styles.kpiValue} style={{ color: "#dc2626" }}>
                            ₹{totalPendingDue.toLocaleString("en-IN")}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tenant and Filter Selector */}
            <div className={styles.filterCard}>
                <div className="row g-3 align-items-center">
                    {/* Academy Selector (Super Admin) */}
                    {isSuperAdmin && (
                        <div className="col-12 col-md-3">
                            <label className="form-label small fw-bold text-muted mb-1 d-flex align-items-center gap-1">
                                <Building2 size={14} /> Academy
                            </label>
                            <select
                                className="form-select form-select-sm"
                                value={selectedAcademy}
                                onChange={(e) => setSelectedAcademy(e.target.value)}
                            >
                                {academies.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.academy_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Branch Selector (Super Admin / Academy Admin) */}
                    {(isSuperAdmin || isAcademyAdmin) && (
                        <div className="col-12 col-md-3">
                            <label className="form-label small fw-bold text-muted mb-1 d-flex align-items-center gap-1">
                                <MapPin size={14} /> Branch
                            </label>
                            <select
                                className="form-select form-select-sm"
                                value={selectedBranch}
                                onChange={(e) => setSelectedBranch(e.target.value)}
                            >
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.branch_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Status Filter */}
                    <div className="col-12 col-md-2">
                        <label className="form-label small fw-bold text-muted mb-1">Status</label>
                        <select
                            className="form-select form-select-sm"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="All">All Statuses</option>
                            <option value="Paid">Paid</option>
                            <option value="Partial">Partial</option>
                            <option value="Pending">Pending</option>
                        </select>
                    </div>

                    {/* Search Input */}
                    <div className="col-12 col-md-4 ms-auto">
                        <label className="form-label small fw-bold text-muted mb-1">Search Staff</label>
                        <div className="input-group input-group-sm">
                            <span className="input-group-text bg-white">
                                <Search size={14} className="text-muted" />
                            </span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Filter by Name, Role, or ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="alert alert-danger d-flex align-items-center gap-2 mb-3">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {/* Table */}
            <div className={styles.tableCard}>
                <div className={styles.tableWrapper}>
                    {loading ? (
                        <div className="text-center py-5">
                            <Loader2 size={32} className="spin text-primary mb-2" />
                            <div className="text-muted fw-semibold">Loading monthly payroll sheet...</div>
                        </div>
                    ) : filteredList.length === 0 ? (
                        <div className="text-center py-5">
                            <Banknote size={40} className="text-muted opacity-50 mb-2" />
                            <h6 className="fw-bold text-dark">No payroll records for this month</h6>
                            <p className="text-muted small mb-3">
                                Click &quot;Auto-Calculate All Staff&quot; to calculate salary based on staff working days and attendance.
                            </p>
                            <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={handleBulkCalculate}
                                disabled={calculating}
                            >
                                <RefreshCw size={14} className="me-1" /> Auto-Calculate Now
                            </button>
                        </div>
                    ) : (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Staff Member</th>
                                    <th>Base Monthly</th>
                                    <th>Working Days vs Attendance</th>
                                    <th>Prorated Gross</th>
                                    <th>PF &amp; Advance Deductions</th>
                                    <th>Net Payable</th>
                                    <th>Paid Amount</th>
                                    <th>Due Balance</th>
                                    <th>Status</th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredList.map((p) => {
                                    const monthDaysCount = Number(p.total_month_days) || new Date(Number(p.salary_year || selectedYear), Number(p.salary_month || selectedMonth), 0).getDate();
                                    const workingDays = Number(p.working_days) || monthDaysCount;
                                    const presentDays = Number(p.present_days) || 0;
                                    const attPercentage = workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0;
                                    const totalDeductions = (Number(p.deductions) || 0) + (Number(p.advance_deduction) || 0);

                                    const absentCount = Number(p.absent_days) || 0;
                                    const lateCount = Number(p.late_days) || 0;
                                    const halfDayCount = Number(p.half_days) || 0;
                                    const leaveCount = Number(p.paid_leaves) || 0;
                                    const totalDeductedDays = (absentCount * 1.0) + (leaveCount * 1.0) + (halfDayCount * 0.5) + (lateCount * 0.25);
                                    const dailyGrossRate = monthDaysCount > 0 ? (Number(p.full_base_salary || p.gross_salary) / monthDaysCount) : 0;

                                    const dojStr = p.date_of_joining ? String(p.date_of_joining).slice(0, 10) : null;
                                    let isJoiningMonth = false;
                                    let joiningDay = 1;
                                    if (dojStr) {
                                        const [y, m, d] = dojStr.split("-").map(Number);
                                        if (Number(selectedYear) === y && Number(selectedMonth) === m) {
                                            isJoiningMonth = true;
                                            joiningDay = d;
                                        }
                                    }

                                    return (
                                        <tr key={p.id}>
                                            <td>
                                                <div className="fw-bold text-dark">{p.first_name} {p.last_name}</div>
                                                <div className="text-muted small">
                                                    #{p.appointment_no} • {p.role_name || "Staff"}
                                                </div>
                                                {dojStr && (
                                                    <div className="d-flex align-items-center gap-1 mt-1 flex-wrap" style={{ fontSize: "0.72rem" }}>
                                                        <span className="text-muted">DOJ:</span>
                                                        <span className="fw-semibold text-dark">{dojStr}</span>
                                                        {isJoiningMonth && (
                                                            <span
                                                                className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle"
                                                                style={{ fontSize: "0.65rem" }}
                                                                title={`Joined on ${dojStr}. Salary calculated starting from day ${joiningDay}.`}
                                                            >
                                                                First Month (From Day {joiningDay})
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <div className="fw-bold text-dark">
                                                    ₹{Number(p.full_base_salary || p.gross_salary).toLocaleString("en-IN")}
                                                </div>
                                                <small className="text-muted">Monthly Rate</small>
                                            </td>
                                            <td>
                                                <div className={styles.attendanceBadgeBox}>
                                                    <span className="text-primary fw-bold" style={{ fontSize: "0.95rem" }}>
                                                        {Number(presentDays.toFixed(2))}
                                                    </span>
                                                    <span className="text-muted mx-1">/</span>
                                                    <span className="text-dark fw-bold">{Number(workingDays.toFixed(2))} Days</span>
                                                    <span
                                                        className={`badge ms-1 ${
                                                            attPercentage >= 90
                                                                ? "bg-success"
                                                                : attPercentage >= 75
                                                                ? "bg-warning text-dark"
                                                                : "bg-danger"
                                                        }`}
                                                        style={{ fontSize: "0.68rem" }}
                                                    >
                                                        {attPercentage}%
                                                    </span>
                                                </div>
                                                <div className="text-muted small mt-1 d-flex flex-wrap gap-1 align-items-center" style={{ fontSize: "0.72rem" }}>
                                                    {isJoiningMonth && (
                                                        <span className="text-primary fw-semibold">From {joiningDay}th • </span>
                                                    )}
                                                    <span>Abs: {absentCount}d</span>
                                                    {lateCount > 0 && <span>• Late: {lateCount} (-{(lateCount * 0.25).toFixed(2)}d)</span>}
                                                    {halfDayCount > 0 && <span>• Half: {halfDayCount} (-{(halfDayCount * 0.5).toFixed(1)}d)</span>}
                                                    {leaveCount > 0 && <span>• Leave: {leaveCount}d</span>}
                                                    {totalDeductedDays === 0 && (
                                                        <span className="text-success fw-semibold">• Full Attendance (Week offs paid)</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="text-success fw-bold">
                                                    ₹{Number(p.gross_salary).toLocaleString("en-IN")}
                                                </div>
                                                <div className="text-muted small" style={{ fontSize: "0.72rem" }}>
                                                    Earned for {Number(presentDays.toFixed(2))} days
                                                    {dailyGrossRate > 0 && <span> (₹{dailyGrossRate.toFixed(2)}/day)</span>}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="text-danger fw-semibold">
                                                    -₹{totalDeductions.toLocaleString("en-IN")}
                                                </div>
                                                <div className="text-muted small" style={{ fontSize: "0.72rem" }}>
                                                    PF: ₹{Number(p.deductions || p.base_pf_deduction || 0).toLocaleString("en-IN")} • Adv: ₹{Number(p.advance_deduction || 0).toLocaleString("en-IN")}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="badge bg-indigo-subtle text-indigo border border-indigo-subtle px-2 py-1 fs-6 fw-bold" style={{ backgroundColor: "#e0e7ff", color: "#4338ca" }}>
                                                    ₹{Number(p.net_salary).toLocaleString("en-IN")}
                                                </div>
                                            </td>
                                            <td>
                                                <span className="text-success fw-bold">
                                                    ₹{Number(p.paid_amount || 0).toLocaleString("en-IN")}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`fw-bold ${Number(p.due_amount || 0) > 0 ? "text-danger" : "text-muted"}`}>
                                                    ₹{Number(p.due_amount || 0).toLocaleString("en-IN")}
                                                </span>
                                            </td>
                                            <td>
                                                <span
                                                    className={`badge ${
                                                        p.payment_status === "Paid"
                                                            ? "bg-success"
                                                            : p.payment_status === "Partial"
                                                            ? "bg-warning text-dark"
                                                            : "bg-danger"
                                                    }`}
                                                >
                                                    {p.payment_status}
                                                </span>
                                            </td>
                                            <td className="text-end">
                                                <div className="d-flex align-items-center justify-content-end gap-1">
                                                    {/* Pay Salary Button */}
                                                    {p.payment_status !== "Paid" && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-success d-inline-flex align-items-center gap-1"
                                                            onClick={() => handleOpenPay(p)}
                                                        >
                                                            <CreditCard size={13} />
                                                            Pay
                                                        </button>
                                                    )}

                                                    {/* Recalculate Button */}
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                                                        onClick={() => handleRecalculateStaff(p.staff_id)}
                                                        title="Recalculate based on latest attendance records"
                                                    >
                                                        <RefreshCw size={13} />
                                                    </button>

                                                    {/* View Payslip Button */}
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                                                        onClick={() => setPayslipItem(p)}
                                                        title="View & Print Salary Slip"
                                                    >
                                                        <FileText size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Pay Salary Disbursement Modal */}
            {payModalItem && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalDialog}>
                        <form onSubmit={handleSubmitPayment}>
                            <div className={styles.modalHeader}>
                                <div className="d-flex align-items-center gap-2">
                                    <CreditCard className="text-success" size={20} />
                                    <h5 className="modal-title fw-bold m-0">Record Salary Payment</h5>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setPayModalItem(null)}
                                />
                            </div>

                            <div className={styles.modalBody}>
                                <div className="p-3 bg-light border rounded-3 mb-3">
                                    <div className="d-flex justify-content-between mb-1">
                                        <span className="text-muted small">Employee:</span>
                                        <strong className="text-dark">{payModalItem.first_name} {payModalItem.last_name} (#{payModalItem.appointment_no})</strong>
                                    </div>
                                    <div className="d-flex justify-content-between mb-1">
                                        <span className="text-muted small">Month &amp; Year:</span>
                                        <strong>{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</strong>
                                    </div>
                                    <div className="d-flex justify-content-between mb-1">
                                        <span className="text-muted small">Net Payable:</span>
                                        <strong className="text-primary">₹{Number(payModalItem.net_salary).toLocaleString("en-IN")}</strong>
                                    </div>
                                    <div className="d-flex justify-content-between">
                                        <span className="text-muted small">Current Balance Due:</span>
                                        <strong className="text-danger">₹{Number(payModalItem.due_amount).toLocaleString("en-IN")}</strong>
                                    </div>
                                </div>

                                <div className="row g-3">
                                    <div className="col-12 col-md-6">
                                        <label className="form-label small fw-bold">Disbursement Amount (₹) *</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-control fw-bold text-success"
                                            value={payForm.amount}
                                            onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="col-12 col-md-6">
                                        <label className="form-label small fw-bold">Payment Method *</label>
                                        <select
                                            className="form-select"
                                            value={payForm.payment_mode}
                                            onChange={(e) => setPayForm({ ...payForm, payment_mode: e.target.value })}
                                        >
                                            <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                                            <option value="UPI">UPI</option>
                                            <option value="Cash">Cash</option>
                                            <option value="Cheque">Cheque</option>
                                            <option value="Card">Card</option>
                                        </select>
                                    </div>

                                    <div className="col-12">
                                        <label className="form-label small fw-bold">Reference / Transaction / UTR No.</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. UTR-99882244 or Cheque #..."
                                            value={payForm.transaction_no}
                                            onChange={(e) => setPayForm({ ...payForm, transaction_no: e.target.value })}
                                        />
                                    </div>

                                    <div className="col-12">
                                        <label className="form-label small fw-bold">Remarks / Notes</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={payForm.remarks}
                                            onChange={(e) => setPayForm({ ...payForm, remarks: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className={styles.modalFooter}>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setPayModalItem(null)}
                                    disabled={paySubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-success btn-sm px-4 fw-semibold"
                                    disabled={paySubmitting}
                                >
                                    {paySubmitting ? "Recording..." : "Confirm & Disburse"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Payslip Modal */}
            {payslipItem && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalDialog} style={{ maxWidth: 740 }}>
                        <div className={styles.modalHeader}>
                            <h5 className="modal-title fw-bold m-0 d-flex align-items-center gap-2">
                                <FileText size={18} className="text-primary" />
                                Salary Slip - {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                            </h5>
                            <div className="d-flex align-items-center gap-2">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                                    onClick={() => window.print()}
                                >
                                    <Printer size={14} /> Print
                                </button>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setPayslipItem(null)}
                                />
                            </div>
                        </div>

                        <div className={styles.modalBody}>
                            <div className={styles.payslipPrintBox}>
                                <div className={styles.payslipHeader}>
                                    <h4 className="fw-bold mb-1">CST CRICKET ACADEMY</h4>
                                    <div className="text-muted small">
                                        Branch: {payslipItem.branch_name || "Main Branch"} • {payslipItem.academy_name}
                                    </div>
                                    <div className="badge bg-primary mt-2">
                                        PAYSLIP FOR {MONTH_NAMES[selectedMonth - 1].toUpperCase()} {selectedYear}
                                    </div>
                                </div>

                                <div className="row g-2 mb-3 pb-3 border-bottom text-dark small">
                                    <div className="col-6"><strong>Staff Name:</strong> {payslipItem.first_name} {payslipItem.last_name}</div>
                                    <div className="col-6"><strong>Appointment ID:</strong> #{payslipItem.appointment_no}</div>
                                    <div className="col-6"><strong>Designation / Role:</strong> {payslipItem.role_name || "Coach"}</div>
                                    <div className="col-6"><strong>Payment Status:</strong> {payslipItem.payment_status}</div>
                                    <div className="col-6"><strong>Base Month Days:</strong> {Number(payslipItem.working_days || payslipItem.total_month_days || 30)} Days (Week offs included)</div>
                                    <div className="col-6"><strong>Effective Payable Days:</strong> {Number(Number(payslipItem.present_days || 0).toFixed(2))} Days</div>
                                    <div className="col-6"><strong>Daily Gross Rate:</strong> ₹{(Number(payslipItem.full_base_salary || payslipItem.gross_salary) / (Number(payslipItem.total_month_days) || Number(payslipItem.working_days) || 30)).toFixed(2)} / day</div>
                                    <div className="col-6">
                                        <strong>Attendance Deductions:</strong>{" "}
                                        {Number(payslipItem.absent_days || 0) > 0 && `Abs: ${payslipItem.absent_days}d (-${payslipItem.absent_days}d) `}
                                        {Number(payslipItem.late_days || 0) > 0 && `Late: ${payslipItem.late_days} (-${(Number(payslipItem.late_days) * 0.25).toFixed(2)}d) `}
                                        {Number(payslipItem.half_days || 0) > 0 && `Half: ${payslipItem.half_days} (-${(Number(payslipItem.half_days) * 0.5).toFixed(1)}d) `}
                                        {Number(payslipItem.paid_leaves || 0) > 0 && `Leave: ${payslipItem.paid_leaves}d (-${payslipItem.paid_leaves}d) `}
                                        {Number(payslipItem.absent_days || 0) === 0 && Number(payslipItem.late_days || 0) === 0 && Number(payslipItem.half_days || 0) === 0 && Number(payslipItem.paid_leaves || 0) === 0 && "0 days deducted"}
                                    </div>
                                    {payslipItem.date_of_joining && (() => {
                                        const pDoj = String(payslipItem.date_of_joining).slice(0, 10);
                                        const [py, pm, pd] = pDoj.split("-").map(Number);
                                        const isFirstMonth = Number(selectedYear) === py && Number(selectedMonth) === pm;
                                        return (
                                            <div className="col-12 mt-1 pt-1 border-top">
                                                <strong>Date of Joining:</strong> {pDoj}
                                                {isFirstMonth && (
                                                    <span className="badge bg-warning-subtle text-warning-emphasis border ms-2">
                                                        ★ First Month Payroll (Attendance &amp; Salary calculated from Day {pd})
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div className={styles.payslipGrid}>
                                    {/* Earnings */}
                                    <div>
                                        <h6 className="fw-bold text-success border-bottom pb-1">EARNINGS</h6>
                                        <div className="d-flex justify-content-between py-1 small">
                                            <span>Basic Salary:</span>
                                            <strong>₹{Number(payslipItem.basic_salary).toLocaleString("en-IN")}</strong>
                                        </div>
                                        <div className="d-flex justify-content-between py-1 small">
                                            <span>Allowances (HRA/Conv/Other):</span>
                                            <strong>₹{Number(payslipItem.allowances).toLocaleString("en-IN")}</strong>
                                        </div>
                                        {Number(payslipItem.bonus) > 0 && (
                                            <div className="d-flex justify-content-between py-1 small">
                                                <span>Bonus:</span>
                                                <strong>₹{Number(payslipItem.bonus).toLocaleString("en-IN")}</strong>
                                            </div>
                                        )}
                                        <div className="d-flex justify-content-between py-2 border-top mt-2 fw-bold text-success">
                                            <span>Gross Earnings:</span>
                                            <span>₹{Number(payslipItem.gross_salary).toLocaleString("en-IN")}</span>
                                        </div>
                                    </div>

                                    {/* Deductions */}
                                    <div>
                                        <h6 className="fw-bold text-danger border-bottom pb-1">DEDUCTIONS</h6>
                                        <div className="d-flex justify-content-between py-1 small">
                                            <span>PF Deduction:</span>
                                            <strong>₹{Number(payslipItem.deductions || payslipItem.base_pf_deduction || 0).toLocaleString("en-IN")}</strong>
                                        </div>
                                        <div className="d-flex justify-content-between py-1 small">
                                            <span>Advance Recovery:</span>
                                            <strong>₹{Number(payslipItem.advance_deduction || 0).toLocaleString("en-IN")}</strong>
                                        </div>
                                        <div className="d-flex justify-content-between py-2 border-top mt-2 fw-bold text-danger">
                                            <span>Total Deductions:</span>
                                            <span>
                                                ₹{(Number(payslipItem.deductions || payslipItem.base_pf_deduction || 0) + Number(payslipItem.advance_deduction || 0)).toLocaleString("en-IN")}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 bg-light border rounded mt-3 d-flex justify-content-between align-items-center">
                                    <div>
                                        <div className="text-muted small fw-bold">NET SALARY (TAKE HOME)</div>
                                        <div className="text-primary fs-4 fw-bold">
                                            ₹{Number(payslipItem.net_salary).toLocaleString("en-IN")}
                                        </div>
                                    </div>
                                    <div className="text-end">
                                        <div className="text-muted small">Paid: ₹{Number(payslipItem.paid_amount || 0).toLocaleString("en-IN")}</div>
                                        <div className="text-muted small">Due: ₹{Number(payslipItem.due_amount || 0).toLocaleString("en-IN")}</div>
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-top d-flex justify-content-between text-muted small">
                                    <div>Prepared by: CST Academy Accounts</div>
                                    <div>Authorized Signature: _____________________</div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.modalFooter}>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setPayslipItem(null)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
