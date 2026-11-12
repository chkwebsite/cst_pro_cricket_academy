"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useUser } from "../components/UserContext";
import { getUserRole, ROLES } from "../../components/lib/rbac-rules";
import {
    CreditCard,
    Plus,
    Search,
    Edit2,
    DollarSign,
    Users,
    TrendingUp,
    ShieldAlert,
    CheckCircle2,
    AlertCircle,
    X,
    Building2,
    MapPin,
    Calculator,
    ArrowRight,
    Loader2,
} from "lucide-react";
import styles from "./staff-salary.module.css";

export default function StaffSalaryStructurePage() {
    const { user } = useUser();
    const role = getUserRole(user);

    const isSuperAdmin = role === ROLES.SUPER_ADMIN;
    const isAcademyAdmin = role === ROLES.ACADEMY_ADMIN;
    const isBranchAdmin = role === ROLES.BRANCH_ADMIN;
    const isAuthorized = isSuperAdmin || isAcademyAdmin || isBranchAdmin;
    const canEdit = isSuperAdmin || isAcademyAdmin; // Branch Admin cannot edit salary structures

    // Filters and Tenant State
    const [academies, setAcademies] = useState([]);
    const [branches, setBranches] = useState([]);
    const [selectedAcademy, setSelectedAcademy] = useState(user?.academy_id ? String(user.academy_id) : "");
    const [selectedBranch, setSelectedBranch] = useState(user?.branch_id ? String(user.branch_id) : "");
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");

    // Data State
    const [salaries, setSalaries] = useState([]);
    const [staffOptions, setStaffOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [toast, setToast] = useState(null);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState("create"); // "create" | "edit"
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        id: null,
        staff_id: "",
        monthly_salary: "",
        basic_salary: "",
        hra: "",
        da: "0",
        conveyance: "",
        other_allowance: "",
        pf_deduction: "",
        advance_deduction: "0",
        esi_deduction: "0",
        professional_tax: "0",
        other_deduction: "0",
        gross_salary: "0",
        net_salary: "0",
        effective_from: new Date().toISOString().slice(0, 10),
        status: "Active",
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

    // 3. Load Salary List
    const loadSalaries = useCallback(async () => {
        if (!isAuthorized) return;
        setLoading(true);
        setError("");

        try {
            const query = new URLSearchParams();
            if (selectedAcademy) query.set("academy_id", selectedAcademy);
            if (selectedBranch) query.set("branch_id", selectedBranch);

            const res = await fetch(`/api/staff-salary?${query.toString()}`);
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to load salary structures.");
            }
            setSalaries(json.data || []);
        } catch (err) {
            console.error("Salary fetch error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [isAuthorized, selectedAcademy, selectedBranch]);

    useEffect(() => {
        loadSalaries();
    }, [loadSalaries]);

    // 4. Load Staff list for dropdown (staff in selected branch)
    useEffect(() => {
        if (!selectedBranch) return;
        async function fetchStaff() {
            try {
                const res = await fetch(`/api/staff?branch_id=${selectedBranch}&limit=100`);
                const json = await res.json();
                if (res.ok && json.success) {
                    setStaffOptions(json.data || []);
                }
            } catch (err) {
                console.error("Failed to load staff list:", err);
            }
        }
        fetchStaff();
    }, [selectedBranch]);

    // 5. Staff already having a salary structure in this academy/branch
    const configuredStaffIds = useMemo(() => {
        return new Set(salaries.map((s) => Number(s.staff_id)));
    }, [salaries]);

    // Unconfigured staff: strictly only staff who do NOT have a salary structure yet
    const unconfiguredStaffOptions = useMemo(() => {
        return staffOptions.filter((st) => !configuredStaffIds.has(Number(st.id)));
    }, [staffOptions, configuredStaffIds]);

    // Modal Staff Options:
    // In "create" mode: strictly only unconfigured staff members
    // In "edit" mode: all staff (edited staff will be selected and disabled)
    const modalStaffOptions = useMemo(() => {
        if (modalMode === "edit") {
            return staffOptions;
        }
        return unconfiguredStaffOptions;
    }, [modalMode, staffOptions, unconfiguredStaffOptions]);

    // Real-Time Component Auto-Calculation
    // Auto-calculates standard 60/20/8/12 split on monthly input
    const handleMonthlySalaryChange = (val) => {
        const monthly = Number(val) || 0;
        if (monthly <= 0) {
            setFormData((prev) => ({
                ...prev,
                monthly_salary: val,
                basic_salary: "0",
                hra: "0",
                conveyance: "0",
                other_allowance: "0",
                pf_deduction: "0",
                gross_salary: "0",
                net_salary: "0",
            }));
            return;
        }

        // Standard Indian Academy Breakdown:
        // Basic: 60%, HRA: 20%, Conveyance: 8%, Other Allowance: 12%
        const basic = Math.round(monthly * 0.60 * 100) / 100;
        const hra = Math.round(monthly * 0.20 * 100) / 100;
        const conv = Math.round(monthly * 0.08 * 100) / 100;
        const otherA = Math.round((monthly - basic - hra - conv) * 100) / 100;
        const gross = monthly;

        // PF: 12% of basic
        const pf = Math.round(basic * 0.12 * 100) / 100;
        const adv = Number(formData.advance_deduction) || 0;
        const otherD = Number(formData.other_deduction) || 0;
        const totalDeductions = pf + adv + otherD;
        const net = Math.max(0, Math.round((gross - totalDeductions) * 100) / 100);

        setFormData((prev) => ({
            ...prev,
            monthly_salary: val,
            basic_salary: String(basic),
            hra: String(hra),
            conveyance: String(conv),
            other_allowance: String(otherA),
            pf_deduction: String(pf),
            gross_salary: String(gross),
            net_salary: String(net),
        }));
    };

    // Live Recomputation when individual inputs are manually tweaked
    const recomputeLive = useCallback((updated) => {
        const b = Number(updated.basic_salary) || 0;
        const h = Number(updated.hra) || 0;
        const da = Number(updated.da) || 0;
        const c = Number(updated.conveyance) || 0;
        const oa = Number(updated.other_allowance) || 0;

        const gross = Math.round((b + h + da + c + oa) * 100) / 100;

        const pf = Number(updated.pf_deduction) || 0;
        const adv = Number(updated.advance_deduction) || 0;
        const od = Number(updated.other_deduction) || 0;
        const esi = Number(updated.esi_deduction) || 0;
        const pt = Number(updated.professional_tax) || 0;

        const totalDeductions = pf + adv + od + esi + pt;
        const net = Math.max(0, Math.round((gross - totalDeductions) * 100) / 100);

        setFormData({
            ...updated,
            gross_salary: String(gross),
            net_salary: String(net),
        });
    }, []);

    // Handle Staff Member selection: fetch current_salary from /api/staff and auto-fill monthly_salary
    const handleStaffSelect = async (staffId) => {
        if (!staffId) {
            setFormData((prev) => ({
                ...prev,
                staff_id: "",
                monthly_salary: "",
                basic_salary: "0",
                hra: "0",
                conveyance: "0",
                other_allowance: "0",
                pf_deduction: "0",
                gross_salary: "0",
                net_salary: "0",
            }));
            return;
        }

        let salaryVal = 0;
        const selected = staffOptions.find((s) => String(s.id) === String(staffId));
        if (selected && Number(selected.current_salary) > 0) {
            salaryVal = Number(selected.current_salary);
        } else {
            try {
                const res = await fetch(`/api/staff/${staffId}`);
                const json = await res.json();
                if (res.ok && json.success && json.data) {
                    if (Number(json.data.current_salary) > 0) {
                        salaryVal = Number(json.data.current_salary);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch staff record for current salary:", err);
            }
        }

        if (salaryVal <= 0) {
            const existingSal = salaries.find((s) => String(s.staff_id) === String(staffId));
            if (existingSal && Number(existingSal.gross_salary) > 0) {
                salaryVal = Number(existingSal.gross_salary);
            }
        }

        if (salaryVal <= 0) {
            salaryVal = 25000;
        }

        const monthly = salaryVal;
        const basic = Math.round(monthly * 0.60 * 100) / 100;
        const hra = Math.round(monthly * 0.20 * 100) / 100;
        const conv = Math.round(monthly * 0.08 * 100) / 100;
        const otherA = Math.round((monthly - basic - hra - conv) * 100) / 100;
        const gross = monthly;
        const pf = Math.round(basic * 0.12 * 100) / 100;
        const adv = Number(formData.advance_deduction) || 2000;
        const net = Math.max(0, Math.round((gross - pf - adv) * 100) / 100);

        setFormData((prev) => ({
            ...prev,
            staff_id: String(staffId),
            monthly_salary: String(monthly),
            basic_salary: String(basic),
            hra: String(hra),
            conveyance: String(conv),
            other_allowance: String(otherA),
            pf_deduction: String(pf),
            gross_salary: String(gross),
            net_salary: String(net),
        }));
    };

    // Open Modal for New Salary
    const handleOpenCreate = () => {
        if (unconfiguredStaffOptions.length === 0) {
            showToast("All staff members in this branch already have salary structures configured.", "info");
            return;
        }

        setModalMode("create");
        const defaultStaff = unconfiguredStaffOptions[0];
        const defaultStaffId = defaultStaff?.id ? String(defaultStaff.id) : "";
        const defaultSalary = defaultStaff?.current_salary && Number(defaultStaff.current_salary) > 0
            ? Number(defaultStaff.current_salary)
            : 25000;

        const basic = Math.round(defaultSalary * 0.60 * 100) / 100;
        const hra = Math.round(defaultSalary * 0.20 * 100) / 100;
        const conv = Math.round(defaultSalary * 0.08 * 100) / 100;
        const otherA = Math.round((defaultSalary - basic - hra - conv) * 100) / 100;
        const pf = Math.round(basic * 0.12 * 100) / 100;
        const adv = 2000;
        const net = Math.max(0, Math.round((defaultSalary - pf - adv) * 100) / 100);

        setFormData({
            id: null,
            staff_id: defaultStaffId,
            monthly_salary: String(defaultSalary),
            basic_salary: String(basic),
            hra: String(hra),
            da: "0",
            conveyance: String(conv),
            other_allowance: String(otherA),
            pf_deduction: String(pf),
            advance_deduction: String(adv),
            esi_deduction: "0",
            professional_tax: "0",
            other_deduction: "0",
            gross_salary: String(defaultSalary),
            net_salary: String(net),
            effective_from: new Date().toISOString().slice(0, 10),
            status: "Active",
        });
        setShowModal(true);
    };

    // Open Modal to Edit
    const handleOpenEdit = (item) => {
        if (!canEdit) {
            showToast("Branch Admin cannot edit salary structures. Only Academy Admin and Super Admin have permission to edit.", "error");
            return;
        }
        setModalMode("edit");
        setFormData({
            id: item.id,
            staff_id: String(item.staff_id),
            monthly_salary: String(item.gross_salary),
            basic_salary: String(item.basic_salary),
            hra: String(item.hra),
            da: String(item.da || 0),
            conveyance: String(item.conveyance_allowance),
            other_allowance: String(item.other_allowance),
            pf_deduction: String(item.pf_deduction),
            advance_deduction: String(item.advance_deduction || 0),
            esi_deduction: String(item.esi_deduction || 0),
            professional_tax: String(item.professional_tax || 0),
            other_deduction: String(item.other_deduction || 0),
            gross_salary: String(item.gross_salary),
            net_salary: String(item.net_salary),
            effective_from: item.effective_from ? item.effective_from.slice(0, 10) : new Date().toISOString().slice(0, 10),
            status: item.status || "Active",
        });
        setShowModal(true);
    };

    // Save Salary Form
    const handleSaveSalary = async (e) => {
        e.preventDefault();
        if (!formData.staff_id) {
            showToast("Please select a staff member.", "error");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                staff_id: Number(formData.staff_id),
                academy_id: Number(selectedAcademy || user?.academy_id),
                branch_id: Number(selectedBranch || user?.branch_id),
                basic_salary: Number(formData.basic_salary),
                hra: Number(formData.hra),
                da: Number(formData.da || 0),
                conveyance_allowance: Number(formData.conveyance),
                other_allowance: Number(formData.other_allowance),
                pf_deduction: Number(formData.pf_deduction),
                advance_deduction: Number(formData.advance_deduction),
                esi_deduction: Number(formData.esi_deduction || 0),
                professional_tax: Number(formData.professional_tax || 0),
                other_deduction: Number(formData.other_deduction || 0),
                effective_from: formData.effective_from,
                status: formData.status,
            };

            const url = modalMode === "edit" ? `/api/staff-salary/${formData.id}` : "/api/staff-salary";
            const method = modalMode === "edit" ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to save salary structure.");
            }

            showToast(modalMode === "edit" ? "Salary structure updated!" : "Salary structure created!", "success");
            setShowModal(false);
            loadSalaries();
        } catch (err) {
            console.error("Save error:", err);
            showToast(err.message, "error");
        } finally {
            setSubmitting(false);
        }
    };

    // Filtered list
    const filteredList = useMemo(() => {
        return salaries.filter((s) => {
            if (statusFilter !== "All" && s.status !== statusFilter) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const name = `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase();
                const app = String(s.appointment_no || "").toLowerCase();
                const roleName = String(s.role_name || "").toLowerCase();
                return name.includes(q) || app.includes(q) || roleName.includes(q);
            }
            return true;
        });
    }, [salaries, statusFilter, searchQuery]);

    // KPI Metrics
    const totalMonthlyBudget = useMemo(() => {
        return filteredList.reduce((acc, curr) => acc + (Number(curr.gross_salary) || 0), 0);
    }, [filteredList]);

    const totalNetDisbursement = useMemo(() => {
        return filteredList.reduce((acc, curr) => acc + (Number(curr.net_salary) || 0), 0);
    }, [filteredList]);

    if (!isAuthorized) {
        return (
            <div className="container py-5 text-center">
                <div className="alert alert-danger d-inline-flex align-items-center gap-2">
                    <ShieldAlert size={20} />
                    <span>Access Denied. Only Super Admin, Academy Admin, and Branch Admin can manage salaries.</span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Toast */}
            {toast && (
                <div
                    className={`position-fixed top-0 end-0 p-3`}
                    style={{ zIndex: 2000 }}
                >
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
                            <CreditCard className="text-primary" size={26} />
                            Staff Salary Structure
                        </h1>
                        <div className={styles.subtitle}>
                            Configure monthly salary packages, allowances, PF, and advance deductions for coaching and academy staff.
                        </div>
                    </div>
                    <div>
                        <button
                            type="button"
                            className="btn btn-primary d-flex align-items-center gap-2 fw-semibold shadow-sm"
                            onClick={handleOpenCreate}
                            title={unconfiguredStaffOptions.length === 0 ? "All staff members already have a salary structure" : "Configure Salary Package"}
                        >
                            <Plus size={18} />
                            Configure Salary
                            {unconfiguredStaffOptions.length > 0 && (
                                <span className="badge bg-white text-primary ms-1" style={{ fontSize: "0.72rem" }}>
                                    {unconfiguredStaffOptions.length} new
                                </span>
                            )}
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
                        <div className={styles.kpiLabel}>Staff Configured</div>
                        <div className={styles.kpiValue}>{filteredList.length}</div>
                    </div>
                </div>

                <div className={styles.kpiCard}>
                    <div className={styles.kpiIcon} style={{ background: "#ecfdf5", color: "#059669" }}>
                        <TrendingUp size={22} />
                    </div>
                    <div>
                        <div className={styles.kpiLabel}>Monthly Gross Budget</div>
                        <div className={styles.kpiValue}>₹{totalMonthlyBudget.toLocaleString("en-IN")}</div>
                    </div>
                </div>

                <div className={styles.kpiCard}>
                    <div className={styles.kpiIcon} style={{ background: "#f5f3ff", color: "#7c3aed" }}>
                        <DollarSign size={22} />
                    </div>
                    <div>
                        <div className={styles.kpiLabel}>Net In-Hand Payroll</div>
                        <div className={styles.kpiValue}>₹{totalNetDisbursement.toLocaleString("en-IN")}</div>
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
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
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
                                placeholder="Name, Role, or Appointment No..."
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
                            <div className="text-muted fw-semibold">Loading salary structures...</div>
                        </div>
                    ) : filteredList.length === 0 ? (
                        <div className="text-center py-5">
                            <CreditCard size={40} className="text-muted opacity-50 mb-2" />
                            <h6 className="fw-bold text-dark">No salary structures configured</h6>
                            <p className="text-muted small mb-3">Click &quot;Configure Salary&quot; to set up salary components for your staff.</p>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={handleOpenCreate}
                            >
                                <Plus size={14} className="me-1" /> Configure First Staff
                            </button>
                        </div>
                    ) : (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Staff Member</th>
                                    <th>Role &amp; Branch</th>
                                    <th>Monthly Gross</th>
                                    <th>Basic Salary</th>
                                    <th>Allowances (HRA+Conv+Other)</th>
                                    <th>PF Deduction</th>
                                    <th>Advance Deduct</th>
                                    <th>Net Salary (In-Hand)</th>
                                    <th>Status</th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredList.map((item) => {
                                    const allowancesSum = (Number(item.hra) || 0) + (Number(item.conveyance_allowance) || 0) + (Number(item.other_allowance) || 0);
                                    return (
                                        <tr key={item.id}>
                                            <td>
                                                <div className="fw-bold text-dark">{item.first_name} {item.last_name}</div>
                                                <div className="text-muted small">#{item.appointment_no}</div>
                                            </td>
                                            <td>
                                                <span className="badge bg-light text-dark border me-1">
                                                    {item.role_name || "Staff"}
                                                </span>
                                                <span className="text-muted small d-block mt-1">
                                                    {item.branch_name}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="fw-bold text-dark">
                                                    ₹{Number(item.gross_salary).toLocaleString("en-IN")}
                                                </div>
                                            </td>
                                            <td>
                                                <span className="text-dark">₹{Number(item.basic_salary).toLocaleString("en-IN")}</span>
                                                <span className="text-muted small ms-1">(60%)</span>
                                            </td>
                                            <td>
                                                <div className="text-dark fw-semibold">₹{allowancesSum.toLocaleString("en-IN")}</div>
                                                <div className="text-muted small" style={{ fontSize: "0.72rem" }}>
                                                    HRA: ₹{Number(item.hra).toLocaleString("en-IN")} • Conv: ₹{Number(item.conveyance_allowance).toLocaleString("en-IN")}
                                                </div>
                                            </td>
                                            <td>
                                                <span className="text-danger fw-semibold">
                                                    -₹{Number(item.pf_deduction).toLocaleString("en-IN")}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="text-danger fw-semibold">
                                                    -₹{Number(item.advance_deduction || 0).toLocaleString("en-IN")}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 fs-6 fw-bold">
                                                    ₹{Number(item.net_salary).toLocaleString("en-IN")}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge ${item.status === "Active" ? "bg-success" : "bg-secondary"}`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="text-end">
                                                {canEdit ? (
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                                                        onClick={() => handleOpenEdit(item)}
                                                        title="Edit Salary Structure"
                                                    >
                                                        <Edit2 size={13} />
                                                        Edit
                                                    </button>
                                                ) : (
                                                    <span
                                                        className="badge bg-light text-muted border py-1 px-2"
                                                        title="Branch Admin cannot edit salary structures. Only Academy Admin and Super Admin have edit permission."
                                                    >
                                                        View Only
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Configure / Edit Salary Modal */}
            {showModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalDialog}>
                        <form onSubmit={handleSaveSalary}>
                            <div className={styles.modalHeader}>
                                <div className="d-flex align-items-center gap-2">
                                    <Calculator className="text-primary" size={20} />
                                    <h5 className="modal-title fw-bold m-0">
                                        {modalMode === "edit" ? "Edit Staff Salary Structure" : "Configure Staff Salary Package"}
                                    </h5>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setShowModal(false)}
                                />
                            </div>

                            <div className={styles.modalBody}>
                                {/* Auto-Calc Banner */}
                                <div className={styles.autoCalcBanner}>
                                    <Calculator size={18} className="flex-shrink-0" />
                                    <span>
                                        Type the <strong>Monthly Salary</strong> below: Basic (60%), HRA (20%), Conveyance (8%), Other Allowance (12%), and PF Deduction (12% of Basic) auto-fill instantly!
                                    </span>
                                </div>

                                <div className="row g-3">
                                    {/* Staff Selection */}
                                    <div className="col-12">
                                        <label className="form-label fw-bold small">Staff Member *</label>
                                        <select
                                            className="form-select"
                                            value={formData.staff_id}
                                            onChange={(e) => handleStaffSelect(e.target.value)}
                                            disabled={modalMode === "edit"}
                                            required
                                        >
                                            {modalMode === "create" && unconfiguredStaffOptions.length === 0 ? (
                                                <option value="">-- All staff members already have salary structures configured --</option>
                                            ) : (
                                                <>
                                                    <option value="">-- Select Staff Member --</option>
                                                    {modalStaffOptions.map((st) => (
                                                        <option key={st.id} value={st.id}>
                                                            {st.first_name} {st.last_name} ({st.appointment_no}) - {st.role_name || "Staff"}
                                                        </option>
                                                    ))}
                                                </>
                                            )}
                                        </select>
                                        {modalMode === "create" && unconfiguredStaffOptions.length === 0 && (
                                            <div className="alert alert-info py-2 px-3 small mt-2 mb-0 d-flex align-items-center gap-2">
                                                <CheckCircle2 size={16} className="text-success flex-shrink-0" />
                                                <span>All staff members in this branch already have an active salary structure.</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Monthly Salary Input (Master Trigger) */}
                                    <div className="col-12">
                                        <div className="p-3 bg-light border rounded-3">
                                            <label className="form-label fw-bold text-primary mb-1 d-flex align-items-center justify-content-between">
                                                <span>Monthly Salary (Gross Package) *</span>
                                                <span className="badge bg-primary">Auto-Calculator</span>
                                            </label>
                                            <div className="input-group">
                                                <span className="input-group-text bg-white fw-bold">₹</span>
                                                <input
                                                    type="number"
                                                    className="form-control form-control-lg fw-bold text-primary"
                                                    placeholder="e.g. 25000"
                                                    value={formData.monthly_salary}
                                                    onChange={(e) => handleMonthlySalaryChange(e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <small className="text-muted mt-1 d-block">
                                                Example: Enter ₹25,000 for standard Coach salary package.
                                            </small>
                                        </div>
                                    </div>

                                    {/* Earnings Breakdown */}
                                    <div className="col-12">
                                        <h6 className="fw-bold text-success border-bottom pb-1 mb-2 d-flex align-items-center gap-1">
                                            <ArrowRight size={14} /> Earnings Components
                                        </h6>
                                    </div>

                                    <div className="col-12 col-md-6">
                                        <label className="form-label small fw-semibold text-muted">Basic Salary (60%) *</label>
                                        <div className="input-group input-group-sm">
                                            <span className="input-group-text">₹</span>
                                            <input
                                                type="number"
                                                className="form-control fw-semibold"
                                                value={formData.basic_salary}
                                                onChange={(e) => recomputeLive({ ...formData, basic_salary: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="col-12 col-md-6">
                                        <label className="form-label small fw-semibold text-muted">HRA (20%) *</label>
                                        <div className="input-group input-group-sm">
                                            <span className="input-group-text">₹</span>
                                            <input
                                                type="number"
                                                className="form-control fw-semibold"
                                                value={formData.hra}
                                                onChange={(e) => recomputeLive({ ...formData, hra: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="col-12 col-md-6">
                                        <label className="form-label small fw-semibold text-muted">Conveyance Allowance (8%) *</label>
                                        <div className="input-group input-group-sm">
                                            <span className="input-group-text">₹</span>
                                            <input
                                                type="number"
                                                className="form-control fw-semibold"
                                                value={formData.conveyance}
                                                onChange={(e) => recomputeLive({ ...formData, conveyance: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="col-12 col-md-6">
                                        <label className="form-label small fw-semibold text-muted">Other Allowance (12%) *</label>
                                        <div className="input-group input-group-sm">
                                            <span className="input-group-text">₹</span>
                                            <input
                                                type="number"
                                                className="form-control fw-semibold"
                                                value={formData.other_allowance}
                                                onChange={(e) => recomputeLive({ ...formData, other_allowance: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Deductions Breakdown */}
                                    <div className="col-12 mt-3">
                                        <h6 className="fw-bold text-danger border-bottom pb-1 mb-2 d-flex align-items-center gap-1">
                                            <ArrowRight size={14} /> Deductions Components
                                        </h6>
                                    </div>

                                    <div className="col-12 col-md-6">
                                        <label className="form-label small fw-semibold text-muted">PF Deduction (12% of Basic) *</label>
                                        <div className="input-group input-group-sm">
                                            <span className="input-group-text">₹</span>
                                            <input
                                                type="number"
                                                className="form-control text-danger fw-semibold"
                                                value={formData.pf_deduction}
                                                onChange={(e) => recomputeLive({ ...formData, pf_deduction: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="col-12 col-md-6">
                                        <label className="form-label small fw-semibold text-muted">Advance Deduction *</label>
                                        <div className="input-group input-group-sm">
                                            <span className="input-group-text">₹</span>
                                            <input
                                                type="number"
                                                className="form-control text-danger fw-semibold"
                                                value={formData.advance_deduction}
                                                onChange={(e) => recomputeLive({ ...formData, advance_deduction: e.target.value })}
                                            />
                                        </div>
                                        <small className="text-muted" style={{ fontSize: "0.72rem" }}>
                                            Monthly recovery installment towards advances.
                                        </small>
                                    </div>

                                    {/* Effective Date & Status */}
                                    <div className="col-12 col-md-6">
                                        <label className="form-label small fw-semibold text-muted">Effective Date</label>
                                        <input
                                            type="date"
                                            className="form-control form-control-sm"
                                            value={formData.effective_from}
                                            onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="col-12 col-md-6">
                                        <label className="form-label small fw-semibold text-muted">Status</label>
                                        <select
                                            className="form-select form-select-sm"
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        >
                                            <option value="Active">Active</option>
                                            <option value="Inactive">Inactive</option>
                                        </select>
                                    </div>

                                    {/* Summary Calculation Preview Box */}
                                    <div className="col-12">
                                        <div className={styles.salaryBreakdownBox}>
                                            <div className={styles.componentRow}>
                                                <span className="text-muted">Gross Salary (Total Earnings):</span>
                                                <span className={styles.earningText}>
                                                    ₹{Number(formData.gross_salary || 0).toLocaleString("en-IN")}
                                                </span>
                                            </div>
                                            <div className={styles.componentRow}>
                                                <span className="text-muted">Total Deductions (PF + Advance):</span>
                                                <span className={styles.deductionText}>
                                                    -₹{(Number(formData.pf_deduction || 0) + Number(formData.advance_deduction || 0)).toLocaleString("en-IN")}
                                                </span>
                                            </div>
                                            <div className={styles.netHighlight}>
                                                <span>Net Salary (Take Home / In-Hand):</span>
                                                <span>₹{Number(formData.net_salary || 0).toLocaleString("en-IN")}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.modalFooter}>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setShowModal(false)}
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary btn-sm px-4 fw-semibold"
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 size={14} className="spin me-1" /> Saving...
                                        </>
                                    ) : (
                                        "Save Salary Structure"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
