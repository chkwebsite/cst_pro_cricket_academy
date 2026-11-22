"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    CheckCircle2,
    DollarSign,
    Save,
    UserCheck,
    AlertCircle,
    Building2,
    MapPin,
    Shield,
    Key
} from "lucide-react";
import { useUser } from "../components/UserContext";
import { FormError, RequiredLabel } from "@/app/components/form";

const MATCH_TYPES = [
    { type: "T20", defaultPayment: "Per Match", desc: "20-over matches" },
    { type: "ODI", defaultPayment: "Per Match", desc: "50-over matches" },
    { type: "Test", defaultPayment: "Per Day", desc: "Multi-day test matches" },
    { type: "Practice", defaultPayment: "Per Hour", desc: "Practice & net sessions" },
    { type: "Friendly", defaultPayment: "Per Match", desc: "Club & friendly games" },
    { type: "Tournament", defaultPayment: "Per Match", desc: "Tournament tournament matches" },
];

const PAYMENT_TYPES = ["Per Match", "Per Day", "Per Hour"];

export default function UmpireForm({ id = null }) {
    const router = useRouter();
    const isEdit = Boolean(id);
    const { user } = useUser();

    const userRole = String(user?.user_type || "").trim().toLowerCase();
    const isSuperAdmin = ["super admin", "superadmin", "admin"].includes(userRole);
    const isAcademyAdmin = userRole === "academy admin";
    const isBranchAdmin = userRole === "branch admin";
    const userAcademyId = user?.academy_id;
    const userBranchId = user?.branch_id;

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEdit);
    const [error, setError] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});
    const [successMsg, setSuccessMsg] = useState(null);

    const [academies, setAcademies] = useState([]);
    const [branches, setBranches] = useState([]);

    // Profile state
    const [formData, setFormData] = useState({
        academy_id: userAcademyId ? String(userAcademyId) : "",
        branch_id: userBranchId ? String(userBranchId) : "",
        umpire_name: "",
        email: "",
        mobile: "",
        alternate_mobile: "",
        experience_years: 0,
        qualification: "",
        address: "",
        status: 1,
        password: "",
    });

    // Match fees state
    const [fees, setFees] = useState(
        MATCH_TYPES.map((m) => ({
            match_type: m.type,
            fee_amount: 0,
            payment_type: m.defaultPayment,
            status: 1,
            enabled: true,
        }))
    );

    // Load Academies and Branches
    useEffect(() => {
        (async () => {
            try {
                const [acadRes, branchRes] = await Promise.all([
                    fetch("/api/academies"),
                    fetch(formData.academy_id ? `/api/branch?academy_id=${formData.academy_id}` : "/api/branch"),
                ]);
                const acadJson = await acadRes.json();
                const branchJson = await branchRes.json();

                if (acadRes.ok && acadJson.success) {
                    const list = acadJson.data || [];
                    setAcademies(
                        !isSuperAdmin && userAcademyId
                            ? list.filter((a) => Number(a.id) === Number(userAcademyId))
                            : list
                    );
                }
                if (branchRes.ok && branchJson.success) {
                    setBranches(branchJson.data || []);
                }
            } catch (err) {
                console.error("Failed to load academies/branches:", err);
            }
        })();
    }, [isSuperAdmin, userAcademyId, formData.academy_id]);

    // Reload branches when academy changes
    const handleAcademyChange = async (e) => {
        const selectedAcad = e.target.value;
        if (fieldErrors.academy_id) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.academy_id;
                return next;
            });
        }
        setFormData((prev) => ({ ...prev, academy_id: selectedAcad, branch_id: "" }));
        if (selectedAcad) {
            try {
                const res = await fetch(`/api/branch?academy_id=${selectedAcad}`);
                const json = await res.json();
                if (res.ok && json.success) setBranches(json.data || []);
            } catch {
                setBranches([]);
            }
        } else {
            setBranches([]);
        }
    };

    // Load existing Umpire in Edit mode
    useEffect(() => {
        if (!id) return;

        (async () => {
            try {
                setFetching(true);
                setError(null);
                const res = await fetch(`/api/umpires/${id}`);
                const json = await res.json();

                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to load umpire details");
                }

                const d = json.data;
                setFormData({
                    academy_id: d.academy_id ? String(d.academy_id) : "",
                    branch_id: d.branch_id ? String(d.branch_id) : "",
                    umpire_name: d.umpire_name || "",
                    email: d.email || "",
                    mobile: d.mobile || "",
                    alternate_mobile: d.alternate_mobile || "",
                    experience_years: d.experience_years ?? 0,
                    qualification: d.qualification || "",
                    address: d.address || "",
                    status: d.status ?? 1,
                });

                // Map existing fees
                const existingFeeMap = new Map();
                (d.fees || []).forEach((f) => {
                    existingFeeMap.set(f.match_type, f);
                });

                setFees(
                    MATCH_TYPES.map((m) => {
                        const existing = existingFeeMap.get(m.type);
                        if (existing) {
                            return {
                                id: existing.id,
                                match_type: m.type,
                                fee_amount: Number(existing.fee_amount) || 0,
                                payment_type: existing.payment_type || m.defaultPayment,
                                status: existing.status ?? 1,
                                enabled: true,
                            };
                        }
                        return {
                            match_type: m.type,
                            fee_amount: 0,
                            payment_type: m.defaultPayment,
                            status: 1,
                            enabled: false,
                        };
                    })
                );
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        })();
    }, [id]);

    const handleProfileChange = (e) => {
        const { name, value } = e.target;
        if (fieldErrors[name]) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        if (name === "academy_id" && !value) {
            setFieldErrors((prev) => ({ ...prev, academy_id: "Please select an academy." }));
        }
        if (name === "umpire_name" && !value?.trim()) {
            setFieldErrors((prev) => ({ ...prev, umpire_name: "Umpire name is required." }));
        }
        if (name === "mobile") {
            if (!value?.trim()) {
                setFieldErrors((prev) => ({ ...prev, mobile: "Mobile number is required." }));
            } else if (value.trim().length < 7 || value.trim().length > 20) {
                setFieldErrors((prev) => ({ ...prev, mobile: "Please provide a valid mobile number (7-20 digits)." }));
            }
        }
        if (name === "email" && value?.trim() && !/^\S+@\S+\.\S+$/.test(value.trim())) {
            setFieldErrors((prev) => ({ ...prev, email: "Please enter a valid email address." }));
        }
    };

    const handleFeeChange = (index, field, value) => {
        setFees((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg(null);

        const errs = {};
        if (!formData.academy_id) {
            errs.academy_id = "Please select an academy.";
        }

        if (!formData.umpire_name.trim()) {
            errs.umpire_name = "Umpire name is required.";
        }

        if (!formData.mobile.trim()) {
            errs.mobile = "Mobile number is required.";
        } else {
            const cleanMobile = formData.mobile.trim();
            if (cleanMobile.length < 7 || cleanMobile.length > 20) {
                errs.mobile = "Please provide a valid mobile number (7-20 digits).";
            }
        }

        if (formData.email && formData.email.trim() && !/^\S+@\S+\.\S+$/.test(formData.email.trim())) {
            errs.email = "Please enter a valid email address.";
        }

        if (Object.keys(errs).length > 0) {
            setFieldErrors(errs);
            const firstKey = Object.keys(errs)[0];
            const el = document.querySelector(`[name="${firstKey}"]`);
            if (el) {
                el.focus();
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            return;
        }

        const cleanMobile = formData.mobile.trim();

        // Prepare fees payload
        const feesPayload = fees
            .filter((f) => f.enabled || Number(f.fee_amount) > 0)
            .map((f) => ({
                id: f.id || undefined,
                match_type: f.match_type,
                fee_amount: Number(f.fee_amount) || 0,
                payment_type: f.payment_type || "Per Match",
                status: Number(f.status) === 0 ? 0 : 1,
            }));

        const payload = {
            academy_id: Number(formData.academy_id),
            branch_id: formData.branch_id ? Number(formData.branch_id) : null,
            umpire_name: formData.umpire_name.trim(),
            email: formData.email ? formData.email.trim() : null,
            mobile: cleanMobile,
            alternate_mobile: formData.alternate_mobile ? formData.alternate_mobile.trim() : null,
            experience_years: parseInt(formData.experience_years, 10) || 0,
            qualification: formData.qualification ? formData.qualification.trim() : null,
            address: formData.address ? formData.address.trim() : null,
            status: Number(formData.status) === 0 ? 0 : 1,
            password: formData.password && formData.password.trim() ? formData.password.trim() : undefined,
            fees: feesPayload,
        };

        try {
            setLoading(true);
            setFieldErrors({});
            const url = isEdit ? `/api/umpires/${id}` : "/api/umpires";
            const method = isEdit ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json();

            if (!res.ok || !json.success) {
                if (json.errors) {
                    setFieldErrors(json.errors);
                    const firstKey = Object.keys(json.errors)[0];
                    const el = document.querySelector(`[name="${firstKey}"]`);
                    if (el) {
                        el.focus();
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                }
                throw new Error(json.message || "Failed to save umpire");
            }

            setSuccessMsg(isEdit ? "Umpire updated successfully!" : "Umpire created successfully!");
            setTimeout(() => {
                router.push("/next_panel/umpires");
            }, 1000);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
                <div className="text-muted mt-2">Loading umpire information...</div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} noValidate>
            {error && (
                <div className="alert alert-danger d-flex align-items-center gap-2 mb-4" role="alert">
                    <AlertCircle size={18} className="flex-shrink-0" />
                    <div>{error}</div>
                </div>
            )}

            {successMsg && (
                <div className="alert alert-success d-flex align-items-center gap-2 mb-4" role="alert">
                    <CheckCircle2 size={18} className="flex-shrink-0" />
                    <div>{successMsg}</div>
                </div>
            )}

            {/* Profile Section */}
            <div className="card border-0 shadow-sm rounded-4 mb-4">
                <div className="card-header bg-white border-0 pt-4 px-4 pb-0">
                    <div className="d-flex align-items-center gap-2">
                        <div className="p-2 rounded-3 bg-primary-subtle text-primary">
                            <UserCheck size={20} />
                        </div>
                        <div>
                            <h5 className="mb-0 fw-bold">Basic Information</h5>
                            <small className="text-muted">Enter umpire identity and contact details</small>
                        </div>
                    </div>
                </div>

                <div className="card-body p-4">
                    <div className="row g-3">
                        {/* Academy */}
                        <div className="col-md-6">
                            <label className="form-label fw-semibold">
                                Academy <span style={{ color: "#dc3545" }}>*</span>
                            </label>
                            <select
                                className={`form-select ${fieldErrors.academy_id ? "is-invalid border-danger" : ""}`}
                                name="academy_id"
                                value={formData.academy_id}
                                onChange={handleAcademyChange}
                                onBlur={handleBlur}
                                disabled={!isSuperAdmin && Boolean(userAcademyId)}
                            >
                                <option value="">Select Academy</option>
                                {academies.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.academy_name}
                                    </option>
                                ))}
                            </select>
                            <FormError error={fieldErrors.academy_id} />
                        </div>

                        {/* Branch */}
                        <div className="col-md-6">
                            <label className="form-label fw-semibold">
                                Branch <span className="text-muted fw-normal">(Leave empty for Academy-wide)</span>
                            </label>
                            <select
                                className="form-select"
                                name="branch_id"
                                value={formData.branch_id}
                                onChange={handleProfileChange}
                                disabled={isBranchAdmin && Boolean(userBranchId)}
                            >
                                <option value="">All Branches (Academy-wide)</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.branch_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Umpire Name */}
                        <div className="col-md-6">
                            <label className="form-label fw-semibold">
                                Umpire Name <span style={{ color: "#dc3545" }}>*</span>
                            </label>
                            <input
                                type="text"
                                className={`form-control ${fieldErrors.umpire_name ? "is-invalid border-danger" : ""}`}
                                name="umpire_name"
                                placeholder="e.g. Anil Chaudhary"
                                value={formData.umpire_name}
                                onChange={handleProfileChange}
                                onBlur={handleBlur}
                            />
                            <FormError error={fieldErrors.umpire_name} />
                        </div>

                        {/* Mobile */}
                        <div className="col-md-6">
                            <label className="form-label fw-semibold">
                                Mobile Number <span style={{ color: "#dc3545" }}>*</span>
                            </label>
                            <input
                                type="tel"
                                className={`form-control ${fieldErrors.mobile ? "is-invalid border-danger" : ""}`}
                                name="mobile"
                                placeholder="10-digit mobile number"
                                value={formData.mobile}
                                onChange={handleProfileChange}
                                onBlur={handleBlur}
                            />
                            <FormError error={fieldErrors.mobile} />
                        </div>

                        {/* Email */}
                        <div className="col-md-6">
                            <label className="form-label fw-semibold">Email Address</label>
                            <input
                                type="email"
                                className={`form-control ${fieldErrors.email ? "is-invalid border-danger" : ""}`}
                                name="email"
                                placeholder="umpire@example.com"
                                value={formData.email}
                                onChange={handleProfileChange}
                                onBlur={handleBlur}
                            />
                            <FormError error={fieldErrors.email} />
                        </div>

                        {/* Alternate Mobile */}
                        <div className="col-md-6">
                            <label className="form-label fw-semibold">Alternate Mobile</label>
                            <input
                                type="tel"
                                className="form-control"
                                name="alternate_mobile"
                                placeholder="Secondary contact number"
                                value={formData.alternate_mobile}
                                onChange={handleProfileChange}
                            />
                        </div>

                        {/* Experience Years */}
                        <div className="col-md-4">
                            <label className="form-label fw-semibold">Experience (Years)</label>
                            <input
                                type="number"
                                min="0"
                                max="50"
                                className="form-control"
                                name="experience_years"
                                value={formData.experience_years}
                                onChange={handleProfileChange}
                            />
                        </div>

                        {/* Qualification */}
                        <div className="col-md-4">
                            <label className="form-label fw-semibold">Certification / Level</label>
                            <input
                                type="text"
                                className="form-control"
                                name="qualification"
                                placeholder="e.g. BCCI Level 1, State Panel"
                                value={formData.qualification}
                                onChange={handleProfileChange}
                            />
                        </div>

                        {/* Status */}
                        <div className="col-md-4">
                            <label className="form-label fw-semibold">Status</label>
                            <select
                                className="form-select"
                                name="status"
                                value={formData.status}
                                onChange={handleProfileChange}
                            >
                                <option value={1}>Active</option>
                                <option value={0}>Inactive</option>
                            </select>
                        </div>

                        {/* Address */}
                        <div className="col-12">
                            <label className="form-label fw-semibold">Residential / Office Address</label>
                            <textarea
                                className="form-control"
                                rows="2"
                                name="address"
                                placeholder="Enter address..."
                                value={formData.address}
                                onChange={handleProfileChange}
                            ></textarea>
                        </div>

                        {/* Login Credentials Section */}
                        <div className="col-12 mt-4 pt-3 border-top">
                            <h6 className="fw-bold mb-1 d-flex align-items-center gap-2 text-primary">
                                <Key size={16} /> Portal Login Credentials
                            </h6>
                            <p className="text-muted small mb-3">
                                The umpire can sign in to the panel using their registered <strong>Mobile Number</strong> or <strong>Email Address</strong>.
                            </p>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">
                                        {isEdit ? "Update Password (leave empty to keep current)" : "Set Login Password"}
                                    </label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        name="password"
                                        placeholder={isEdit ? "Enter new password if changing" : "Default: 123456"}
                                        value={formData.password}
                                        onChange={handleProfileChange}
                                    />
                                    <small className="text-muted">
                                        {isEdit
                                            ? "Leave blank to preserve existing password."
                                            : "If left blank, default password will be 123456."}
                                    </small>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">Login Identifier</label>
                                    <input
                                        type="text"
                                        className="form-control bg-light"
                                        value={formData.mobile || formData.email || "Enter mobile or email above"}
                                        disabled
                                    />
                                    <small className="text-muted">
                                        Umpire can log in directly at the CST Academy login screen using their mobile or email.
                                    </small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Match Fee Configuration Section */}
            <div className="card border-0 shadow-sm rounded-4 mb-4">
                <div className="card-header bg-white border-0 pt-4 px-4 pb-0">
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <div className="d-flex align-items-center gap-2">
                            <div className="p-2 rounded-3 bg-success-subtle text-success">
                                <DollarSign size={20} />
                            </div>
                            <div>
                                <h5 className="mb-0 fw-bold">Match-Wise Fee Configuration</h5>
                                <small className="text-muted">Define match remuneration and billing rate for each match format</small>
                            </div>
                        </div>

                        <span className="badge bg-light text-dark border">
                            Auto-applied during Ground Booking & Match Scheduling
                        </span>
                    </div>
                </div>

                <div className="card-body p-4">
                    <div className="table-responsive">
                        <table className="table align-middle table-hover">
                            <thead className="table-light">
                                <tr>
                                    <th style={{ width: "20%" }}>Match Format</th>
                                    <th style={{ width: "30%" }}>Fee Amount (₹)</th>
                                    <th style={{ width: "25%" }}>Payment Type</th>
                                    <th style={{ width: "15%" }}>Status</th>
                                    <th style={{ width: "10%" }}>Enabled</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fees.map((fee, idx) => (
                                    <tr key={fee.match_type} className={!fee.enabled ? "opacity-50" : ""}>
                                        <td>
                                            <div className="fw-bold">{fee.match_type}</div>
                                            <small className="text-muted">
                                                {MATCH_TYPES.find((m) => m.type === fee.match_type)?.desc}
                                            </small>
                                        </td>
                                        <td>
                                            <div className="input-group">
                                                <span className="input-group-text bg-white">₹</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="50"
                                                    className="form-control"
                                                    value={fee.fee_amount}
                                                    disabled={!fee.enabled}
                                                    onChange={(e) =>
                                                        handleFeeChange(idx, "fee_amount", e.target.value)
                                                    }
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </td>
                                        <td>
                                            <select
                                                className="form-select"
                                                value={fee.payment_type}
                                                disabled={!fee.enabled}
                                                onChange={(e) =>
                                                    handleFeeChange(idx, "payment_type", e.target.value)
                                                }
                                            >
                                                {PAYMENT_TYPES.map((pt) => (
                                                    <option key={pt} value={pt}>
                                                        {pt}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <select
                                                className="form-select form-select-sm"
                                                value={fee.status}
                                                disabled={!fee.enabled}
                                                onChange={(e) =>
                                                    handleFeeChange(idx, "status", Number(e.target.value))
                                                }
                                            >
                                                <option value={1}>Active</option>
                                                <option value={0}>Inactive</option>
                                            </select>
                                        </td>
                                        <td className="text-center">
                                            <div className="form-check form-switch d-inline-block">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    role="switch"
                                                    checked={fee.enabled}
                                                    onChange={(e) =>
                                                        handleFeeChange(idx, "enabled", e.target.checked)
                                                    }
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Form Actions */}
            <div className="d-flex align-items-center justify-content-between gap-3 mb-5">
                <Link href="/next_panel/umpires" className="btn btn-outline-secondary px-4">
                    Cancel
                </Link>

                <button
                    type="submit"
                    className="btn btn-primary d-inline-flex align-items-center gap-2 px-4 py-2"
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <span className="spinner-border spinner-border-sm" role="status"></span>
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save size={18} />
                            {isEdit ? "Update Umpire" : "Save Umpire"}
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
