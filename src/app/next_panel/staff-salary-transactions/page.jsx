"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useUser } from "../components/UserContext";
import { getUserRole, ROLES } from "../../components/lib/rbac-rules";
import {
    Receipt,
    Search,
    Printer,
    Building2,
    MapPin,
    ShieldAlert,
    CheckCircle2,
    AlertCircle,
    Loader2,
} from "lucide-react";
import styles from "./staff-salary-transactions.module.css";

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export default function StaffSalaryTransactionsPage() {
    const { user } = useUser();
    const role = getUserRole(user);

    const isSuperAdmin = role === ROLES.SUPER_ADMIN;
    const isAcademyAdmin = role === ROLES.ACADEMY_ADMIN;
    const isBranchAdmin = role === ROLES.BRANCH_ADMIN;
    const isAuthorized = isSuperAdmin || isAcademyAdmin || isBranchAdmin;

    // Filters and Tenant State
    const [academies, setAcademies] = useState([]);
    const [branches, setBranches] = useState([]);
    const [selectedAcademy, setSelectedAcademy] = useState(user?.academy_id ? String(user.academy_id) : "");
    const [selectedBranch, setSelectedBranch] = useState(user?.branch_id ? String(user.branch_id) : "");
    const [paymentModeFilter, setPaymentModeFilter] = useState("All");
    const [searchQuery, setSearchQuery] = useState("");

    // Data State
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [voucherItem, setVoucherItem] = useState(null);

    // 1. Load Academies
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

    // 3. Load Transactions
    const loadTransactions = useCallback(async () => {
        if (!isAuthorized) return;
        setLoading(true);
        setError("");

        try {
            const query = new URLSearchParams();
            if (selectedAcademy) query.set("academy_id", selectedAcademy);
            if (selectedBranch) query.set("branch_id", selectedBranch);
            if (paymentModeFilter !== "All") query.set("payment_mode", paymentModeFilter);

            const res = await fetch(`/api/staff-salary-transactions?${query.toString()}`);
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to load transactions.");
            }
            setTransactions(json.data || []);
        } catch (err) {
            console.error("Transactions load error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [isAuthorized, selectedAcademy, selectedBranch, paymentModeFilter]);

    useEffect(() => {
        loadTransactions();
    }, [loadTransactions]);

    // Filtered Transactions
    const filteredList = useMemo(() => {
        return transactions.filter((t) => {
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const txNo = String(t.transaction_no || "").toLowerCase();
                const name = `${t.first_name || ""} ${t.last_name || ""}`.toLowerCase();
                const app = String(t.appointment_no || "").toLowerCase();
                return txNo.includes(q) || name.includes(q) || app.includes(q);
            }
            return true;
        });
    }, [transactions, searchQuery]);

    const totalDisbursed = useMemo(() => {
        return filteredList.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    }, [filteredList]);

    if (!isAuthorized) {
        return (
            <div className="container py-5 text-center">
                <div className="alert alert-danger d-inline-flex align-items-center gap-2">
                    <ShieldAlert size={20} />
                    <span>Access Denied. Only Administrators can view salary disbursement vouchers.</span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Header Card */}
            <div className={styles.headerCard}>
                <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
                    <div className={styles.titleArea}>
                        <h1>
                            <Receipt className="text-primary" size={26} />
                            Staff Salary Disbursement Transactions
                        </h1>
                        <div className={styles.subtitle}>
                            Audit trail of all recorded salary payout transactions, vouchers, and bank transfers.
                        </div>
                    </div>
                    <div className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 fs-6 fw-bold">
                        Total Disbursed: ₹{totalDisbursed.toLocaleString("en-IN")}
                    </div>
                </div>
            </div>

            {/* Filters */}
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

                    {/* Payment Mode Filter */}
                    <div className="col-12 col-md-2">
                        <label className="form-label small fw-bold text-muted mb-1">Payment Mode</label>
                        <select
                            className="form-select form-select-sm"
                            value={paymentModeFilter}
                            onChange={(e) => setPaymentModeFilter(e.target.value)}
                        >
                            <option value="All">All Modes</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="UPI">UPI</option>
                            <option value="Cash">Cash</option>
                            <option value="Cheque">Cheque</option>
                        </select>
                    </div>

                    {/* Search */}
                    <div className="col-12 col-md-4 ms-auto">
                        <label className="form-label small fw-bold text-muted mb-1">Search Vouchers</label>
                        <div className="input-group input-group-sm">
                            <span className="input-group-text bg-white">
                                <Search size={14} className="text-muted" />
                            </span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Txn No, Staff Name, or ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Error */}
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
                            <div className="text-muted fw-semibold">Loading transactions...</div>
                        </div>
                    ) : filteredList.length === 0 ? (
                        <div className="text-center py-5">
                            <Receipt size={40} className="text-muted opacity-50 mb-2" />
                            <h6 className="fw-bold text-dark">No transaction vouchers found</h6>
                            <p className="text-muted small mb-0">Disbursed salary payments will show up here automatically.</p>
                        </div>
                    ) : (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Transaction Voucher</th>
                                    <th>Staff Member</th>
                                    <th>Payroll Period</th>
                                    <th>Amount Paid</th>
                                    <th>Payment Mode</th>
                                    <th>Payment Date</th>
                                    <th>Remarks</th>
                                    <th className="text-end">Voucher</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredList.map((t) => (
                                    <tr key={t.id}>
                                        <td>
                                            <div className="fw-bold text-primary font-monospace">{t.transaction_no}</div>
                                            <div className="text-muted small">ID: #{t.id}</div>
                                        </td>
                                        <td>
                                            <div className="fw-bold text-dark">{t.first_name} {t.last_name}</div>
                                            <div className="text-muted small">
                                                #{t.appointment_no} • {t.role_name || "Staff"}
                                            </div>
                                        </td>
                                        <td>
                                            <span className="badge bg-light text-dark border">
                                                {MONTH_NAMES[(t.salary_month || 1) - 1]} {t.salary_year}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="text-success fw-bold fs-6">
                                                ₹{Number(t.amount).toLocaleString("en-IN")}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="badge bg-secondary-subtle text-secondary border">
                                                {t.payment_mode}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="text-dark small">
                                                {t.payment_date ? String(t.payment_date).slice(0, 10) : "-"}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="text-muted small" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {t.remarks || "-"}
                                            </div>
                                        </td>
                                        <td className="text-end">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                                                onClick={() => setVoucherItem(t)}
                                                title="Print Voucher Receipt"
                                            >
                                                <Printer size={13} />
                                                Voucher
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Voucher Modal */}
            {voucherItem && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalDialog}>
                        <div className={styles.modalHeader}>
                            <h5 className="modal-title fw-bold m-0 d-flex align-items-center gap-2">
                                <Receipt size={18} className="text-primary" />
                                Payment Voucher
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
                                    onClick={() => setVoucherItem(null)}
                                />
                            </div>
                        </div>

                        <div className={styles.modalBody}>
                            <div className={styles.voucherBox}>
                                <div className="text-center pb-3 border-bottom mb-3">
                                    <h4 className="fw-bold mb-1">CST CRICKET ACADEMY</h4>
                                    <div className="text-muted small">SALARY DISBURSEMENT RECEIPT VOUCHER</div>
                                    <div className="badge bg-success mt-2">PAYMENT SUCCESS</div>
                                </div>

                                <div className="row g-2 text-dark small mb-3">
                                    <div className="col-6"><strong>Voucher No:</strong> {voucherItem.transaction_no}</div>
                                    <div className="col-6"><strong>Date:</strong> {voucherItem.payment_date ? String(voucherItem.payment_date).slice(0, 19).replace("T", " ") : "-"}</div>
                                    <div className="col-6"><strong>Staff Name:</strong> {voucherItem.first_name} {voucherItem.last_name}</div>
                                    <div className="col-6"><strong>Appointment ID:</strong> #{voucherItem.appointment_no}</div>
                                    <div className="col-6"><strong>Designation:</strong> {voucherItem.role_name || "Staff"}</div>
                                    <div className="col-6"><strong>Salary Period:</strong> {MONTH_NAMES[(voucherItem.salary_month || 1) - 1]} {voucherItem.salary_year}</div>
                                    <div className="col-6"><strong>Payment Mode:</strong> {voucherItem.payment_mode}</div>
                                    <div className="col-6"><strong>Remarks:</strong> {voucherItem.remarks || "Salary Payout"}</div>
                                </div>

                                <div className="p-3 bg-light border rounded text-center my-3">
                                    <div className="text-muted small fw-bold">TOTAL DISBURSED AMOUNT</div>
                                    <div className="text-success fs-2 fw-bold">
                                        ₹{Number(voucherItem.amount).toLocaleString("en-IN")}
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-top d-flex justify-content-between text-muted small">
                                    <div>Receiver Signature: __________________</div>
                                    <div>Authorized By: __________________</div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.modalFooter}>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setVoucherItem(null)}
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
