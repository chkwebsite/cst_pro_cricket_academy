"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { FormError } from "@/app/components/form";
import { validateEmail, validatePhone, validatePinCode } from "@/app/components/form";
import { useUser } from "../components/UserContext";

const emptyBranch = {
    academy_id: "",
    branch_name: "",
    branch_code: "",
    directions: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pin_code: "",
    status: 1,
};

export function getEmptyBranch() {
    return { ...emptyBranch };
}

// Builds the JSON payload matching the /api/branch route contract.
export function buildBranchPayload(values) {
    return {
        academy_id: Number(values.academy_id),
        branch_name: values.branch_name.trim(),
        branch_code: values.branch_code.trim(),
        directions: values.directions?.trim() || null,
        email: values.email.trim(),
        phone: values.phone.trim(),
        address: values.address.trim(),
        city: values.city?.trim() || null,
        state: values.state?.trim() || null,
        pin_code: values.pin_code?.trim() || null,
        status: Number(values.status),
    };
}

export default function BranchForm({
    formId,
    values,
    onChange,
    onSubmit,
    error,
    loading = false,
    isEdit = false,
    branchId = null,
}) {
    const { user } = useUser() || {};
    const roleStr = String(user?.role || user?.role_name || user?.user_type || "").toLowerCase();
    const isSuper = Boolean(
        user?.isSuperAdmin ||
        roleStr === "super_admin" ||
        roleStr === "super admin" ||
        roleStr === "superadmin" ||
        user?.role === "SUPER_ADMIN" ||
        user?.user_type === "1" ||
        user?.role_id === 1
    );
    const userAcademyId = user?.academy_id ? String(user.academy_id) : "";

    const [academies, setAcademies] = useState([]);
    const [academiesLoading, setAcademiesLoading] = useState(true);
    const [academiesError, setAcademiesError] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});
    const [generatingCode, setGeneratingCode] = useState(false);
    const [manualCode, setManualCode] = useState(false);
    const [academyBranches, setAcademyBranches] = useState([]);
    const [branchesLoading, setBranchesLoading] = useState(false);

    // Auto-select academy for Academy Admin if not yet selected
    useEffect(() => {
        if (!isEdit && !values.academy_id && userAcademyId) {
            onChange({
                ...values,
                academy_id: Number(userAcademyId),
            });
        }
    }, [isEdit, userAcademyId, values.academy_id]);

    // Fetch existing branches under selected academy
    useEffect(() => {
        if (!values.academy_id) {
            setAcademyBranches([]);
            return;
        }

        let isMounted = true;
        setBranchesLoading(true);
        (async () => {
            try {
                const res = await fetch(`/api/branch?academy_id=${values.academy_id}`);
                const json = await res.json();
                if (isMounted && res.ok && json.success) {
                    setAcademyBranches(json.data || []);
                }
            } catch (_) {
                if (isMounted) setAcademyBranches([]);
            } finally {
                if (isMounted) setBranchesLoading(false);
            }
        })();

        return () => {
            isMounted = false;
        };
    }, [values.academy_id]);

    // Map external API / parent errors to inline fields
    useEffect(() => {
        if (!error) return;
        if (typeof error === "object" && error.errors) {
            setFieldErrors((prev) => ({ ...prev, ...error.errors }));
        } else if (typeof error === "string") {
            const lower = error.toLowerCase();
            if (lower.includes("academy")) setFieldErrors((prev) => ({ ...prev, academy_id: error }));
            else if (lower.includes("branch name")) setFieldErrors((prev) => ({ ...prev, branch_name: error }));
            else if (lower.includes("branch code")) setFieldErrors((prev) => ({ ...prev, branch_code: error }));
            else if (lower.includes("email")) setFieldErrors((prev) => ({ ...prev, email: error }));
            else if (lower.includes("phone")) setFieldErrors((prev) => ({ ...prev, phone: error }));
            else if (lower.includes("pin")) setFieldErrors((prev) => ({ ...prev, pin_code: error }));
        }
    }, [error]);

    useEffect(() => {
        async function loadAcademies() {
            setAcademiesLoading(true);
            setAcademiesError(null);

            try {
                const res = await fetch("/api/academies?status=1");
                const json = await res.json();
                if (!res.ok) throw new Error(json.message || "Unable to load academies.");
                const data = json.data || [];
                setAcademies(data);

                // If only 1 academy exists and not set, select it
                if (!isEdit && !values.academy_id && data.length === 1) {
                    onChange({
                        ...values,
                        academy_id: data[0].id,
                    });
                }
            } catch (err) {
                setAcademiesError(err.message);
            } finally {
                setAcademiesLoading(false);
            }
        }

        loadAcademies();
    }, []);

    // Automatically fetch next branch code academy-wise whenever academy changes
    useEffect(() => {
        if (isEdit || !values.academy_id) return;

        const controller = new AbortController();
        const fetchNextCode = async () => {
            try {
                const res = await fetch(`/api/branch/next-code?academy_id=${values.academy_id}`, {
                    signal: controller.signal,
                });
                const result = await res.json();
                if (result.success && result.next_branch_code) {
                    // Auto-fill if user hasn't typed a custom code or if branch_code is empty
                    if (!manualCode || !values.branch_code) {
                        onChange({
                            ...values,
                            branch_code: result.next_branch_code,
                        });
                        setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.branch_code;
                            return next;
                        });
                    }
                }
            } catch (err) {
                if (err.name !== "AbortError") {
                    console.error("Failed to fetch next branch code:", err);
                }
            }
        };

        fetchNextCode();
        return () => controller.abort();
    }, [isEdit, values.academy_id, manualCode]);

    // Manual refresh / regenerate branch code
    const handleGenerateCode = async () => {
        if (!values.academy_id) {
            setFieldErrors((prev) => ({ ...prev, academy_id: "Please select an academy first to generate branch code." }));
            return;
        }
        setGeneratingCode(true);
        try {
            const res = await fetch(`/api/branch/next-code?academy_id=${values.academy_id}`);
            const result = await res.json();
            if (result.success && result.next_branch_code) {
                setManualCode(false);
                onChange({
                    ...values,
                    branch_code: result.next_branch_code,
                });
                setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.branch_code;
                    return next;
                });
            }
        } catch (err) {
            console.error("Failed to generate branch code:", err);
        } finally {
            setGeneratingCode(false);
        }
    };

    const validateAll = () => {
        const errors = {};
        if (!values.academy_id) errors.academy_id = "Please select an academy.";
        if (!values.branch_name?.trim()) {
            errors.branch_name = "Branch name is required.";
        } else if (
            academyBranches.some(
                (b) =>
                    (!isEdit || Number(b.id) !== Number(branchId || values.id)) &&
                    b.branch_name?.trim().toLowerCase() === values.branch_name.trim().toLowerCase()
            )
        ) {
            errors.branch_name = "A branch with this name already exists in this academy.";
        }

        if (!values.branch_code?.trim()) errors.branch_code = "Branch code is required.";

        if (!values.email?.trim()) {
            errors.email = "Email is required.";
        } else if (validateEmail(values.email)) {
            errors.email = validateEmail(values.email);
        }

        if (!values.phone?.trim()) {
            errors.phone = "Phone number is required.";
        } else if (validatePhone(values.phone)) {
            errors.phone = validatePhone(values.phone);
        }

        if (!values.address?.trim()) {
            errors.address = "Address is required.";
        }

        if (values.pin_code && validatePinCode(values.pin_code)) errors.pin_code = validatePinCode(values.pin_code);

        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) {
            const firstKey = Object.keys(errors)[0];
            const el = document.querySelector(`[name="${firstKey}"], #${firstKey}`);
            if (el) {
                el.focus();
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            return false;
        }
        return true;
    };

    const handleFormSubmit = (event) => {
        event.preventDefault();
        if (!validateAll()) return;
        if (onSubmit) onSubmit(event);
    };

    const handleChange = (field) => (event) => {
        const value = field === "status" ? Number(event.target.value) : event.target.value;
        onChange({ ...values, [field]: value });
        if (fieldErrors[field]) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    const handleBlur = (field) => () => {
        let err = null;
        if (field === "academy_id" && !values.academy_id) err = "Please select an academy.";
        if (field === "branch_name") {
            if (!values.branch_name?.trim()) {
                err = "Branch name is required.";
            } else if (
                academyBranches.some(
                    (b) =>
                        (!isEdit || Number(b.id) !== Number(branchId || values.id)) &&
                        b.branch_name?.trim().toLowerCase() === values.branch_name.trim().toLowerCase()
                )
            ) {
                err = "A branch with this name already exists in this academy.";
            }
        }
        if (field === "branch_code" && !values.branch_code?.trim()) err = "Branch code is required.";
        if (field === "email") {
            if (!values.email?.trim()) err = "Email is required.";
            else if (validateEmail(values.email)) err = validateEmail(values.email);
        }
        if (field === "phone") {
            if (!values.phone?.trim()) err = "Phone number is required.";
            else if (validatePhone(values.phone)) err = validatePhone(values.phone);
        }
        if (field === "address" && !values.address?.trim()) err = "Address is required.";
        if (field === "pin_code" && values.pin_code) err = validatePinCode(values.pin_code);

        if (err) {
            setFieldErrors((prev) => ({ ...prev, [field]: err }));
        } else {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    return (
        <form id={formId} onSubmit={handleFormSubmit} noValidate>
            {error && typeof error === "string" && !Object.values(fieldErrors).includes(error) && (
                <div className="alert alert-danger">{error}</div>
            )}
            {academiesError && <div className="alert alert-warning">{academiesError}</div>}

            <div className="row g-3">
                <div className="col-md-6">
                    <label className="form-label" htmlFor="academy_id">Academy <span className="text-danger ms-1">*</span></label>
                    <select
                        id="academy_id"
                        name="academy_id"
                        className={`form-select ${fieldErrors.academy_id ? "is-invalid border-danger" : ""}`}
                        value={values.academy_id}
                        onChange={(e) => {
                            setManualCode(false);
                            handleChange("academy_id")(e);
                        }}
                        onBlur={handleBlur("academy_id")}
                        disabled={loading || academiesLoading || (!isSuper && Boolean(userAcademyId))}
                    >
                        <option value="">{academiesLoading ? "Loading academies..." : "Select an academy"}</option>
                        {academies.map((academy) => (
                            <option key={academy.id} value={academy.id}>
                                {academy.academy_name} ({academy.academy_code})
                            </option>
                        ))}
                    </select>
                    <FormError error={fieldErrors.academy_id} />

                    {values.academy_id ? (
                        <div className="mt-2 p-2 bg-light rounded border">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="small fw-semibold text-secondary">
                                    Existing Branches under Academy ({academyBranches.length})
                                </span>
                                {branchesLoading && (
                                    <span className="spinner-border spinner-border-sm text-primary" style={{ width: 14, height: 14 }} />
                                )}
                            </div>
                            {academyBranches.length === 0 && !branchesLoading ? (
                                <div className="small text-muted">No branches created yet for this academy.</div>
                            ) : (
                                <div className="d-flex flex-wrap gap-1 mt-1">
                                    {academyBranches.map((b) => (
                                        <span key={b.id} className="badge bg-white text-dark border">
                                            {b.branch_name} <span className="text-muted">({b.branch_code})</span>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : isSuper ? (
                        <div className="form-text text-muted">
                            Select an academy to view its existing branches and auto-generate next branch code.
                        </div>
                    ) : null}
                </div>

                <div className="col-md-6">
                    <label className="form-label" htmlFor="branch_name">Branch Name <span className="text-danger ms-1">*</span></label>
                    <input
                        id="branch_name"
                        name="branch_name"
                        className={`form-control ${fieldErrors.branch_name ? "is-invalid border-danger" : ""}`}
                        placeholder="e.g. Main Branch"
                        value={values.branch_name}
                        onChange={handleChange("branch_name")}
                        onBlur={handleBlur("branch_name")}
                        disabled={loading}
                        maxLength="50"
                    />
                    <FormError error={fieldErrors.branch_name} />
                </div>

                <div className="col-md-6">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="form-label mb-0" htmlFor="branch_code">
                            Branch Code <span className="text-danger ms-1">*</span>
                        </label>
                        {!isEdit && (
                            <button
                                type="button"
                                className="btn btn-link btn-sm p-0 text-decoration-none d-flex align-items-center gap-1"
                                style={{ fontSize: "0.78rem" }}
                                onClick={handleGenerateCode}
                                disabled={loading || generatingCode || !values.academy_id}
                                title="Auto-generate next unique branch code for selected academy"
                            >
                                <Sparkles size={12} className={generatingCode ? "spin" : ""} />
                                <span>{generatingCode ? "Generating..." : "Auto-Generate"}</span>
                            </button>
                        )}
                    </div>
                    <div className="input-group">
                        <input
                            id="branch_code"
                            name="branch_code"
                            className={`form-control font-monospace ${fieldErrors.branch_code ? "is-invalid border-danger" : ""}`}
                            placeholder="e.g. BR-001"
                            value={values.branch_code}
                            onChange={(e) => {
                                setManualCode(true);
                                handleChange("branch_code")(e);
                            }}
                            onBlur={handleBlur("branch_code")}
                            disabled={loading}
                        />
                        {!isEdit && (
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={handleGenerateCode}
                                disabled={loading || generatingCode || !values.academy_id}
                                title="Refresh / Auto-generate next branch code"
                            >
                                <RefreshCw size={14} className={generatingCode ? "spin" : ""} />
                            </button>
                        )}
                    </div>
                    <FormError error={fieldErrors.branch_code} />
                    {!isEdit && !fieldErrors.branch_code && (
                        <div className="form-text text-muted" style={{ fontSize: "0.75rem" }}>
                            Auto-generated next code based on selected academy. You can also customize it.
                        </div>
                    )}
                </div>

                <div className="col-md-6">
                    <label className="form-label" htmlFor="status">Status</label>
                    <select id="status" name="status" className="form-select" value={values.status} onChange={handleChange("status")} disabled={loading}>
                        <option value={1}>Active</option>
                        <option value={0}>Inactive</option>
                    </select>
                </div>

                <div className="col-md-6">
                    <label className="form-label" htmlFor="email">Email <span className="text-danger ms-1">*</span></label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        className={`form-control ${fieldErrors.email ? "is-invalid border-danger" : ""}`}
                        placeholder="e.g. branch@cstacademy.com"
                        value={values.email || ""}
                        onChange={handleChange("email")}
                        onBlur={handleBlur("email")}
                        disabled={loading}
                    />
                    <FormError error={fieldErrors.email} />
                </div>

                <div className="col-md-6">
                    <label className="form-label" htmlFor="phone">Phone <span className="text-danger ms-1">*</span></label>
                    <input
                        id="phone"
                        name="phone"
                        className={`form-control ${fieldErrors.phone ? "is-invalid border-danger" : ""}`}
                        placeholder="e.g. 9876543210"
                        value={values.phone || ""}
                        onChange={handleChange("phone")}
                        onBlur={handleBlur("phone")}
                        disabled={loading}
                    />
                    <FormError error={fieldErrors.phone} />
                </div>

                <div className="col-12">
                    <label className="form-label" htmlFor="address">Address <span className="text-danger ms-1">*</span></label>
                    <textarea
                        id="address"
                        name="address"
                        className={`form-control ${fieldErrors.address ? "is-invalid border-danger" : ""}`}
                        rows={3}
                        placeholder="Street address, locality"
                        value={values.address || ""}
                        onChange={handleChange("address")}
                        onBlur={handleBlur("address")}
                        disabled={loading}
                    />
                    <FormError error={fieldErrors.address} />
                </div>

                <div className="col-12">
                    <label className="form-label" htmlFor="directions">Directions (Google Maps Link / Navigation URL)</label>
                    <input
                        type="text"
                        id="directions"
                        name="directions"
                        className="form-control"
                        placeholder="e.g. https://maps.google.com/?q=... or driving directions"
                        value={values.directions || ""}
                        onChange={handleChange("directions")}
                        disabled={loading}
                    />
                    <div className="form-text">
                        Used for the &quot;Directions&quot; action button on the academy website branches section.
                    </div>
                </div>

                <div className="col-md-4">
                    <label className="form-label" htmlFor="city">City</label>
                    <input id="city" name="city" className="form-control" placeholder="e.g. Gurugram" value={values.city || ""} onChange={handleChange("city")} disabled={loading} />
                </div>

                <div className="col-md-4">
                    <label className="form-label" htmlFor="state">State</label>
                    <input id="state" name="state" className="form-control" placeholder="e.g. Haryana" value={values.state || ""} onChange={handleChange("state")} disabled={loading} />
                </div>

                <div className="col-md-4">
                    <label className="form-label" htmlFor="pin_code">Pin Code</label>
                    <input
                        id="pin_code"
                        name="pin_code"
                        className={`form-control ${fieldErrors.pin_code ? "is-invalid border-danger" : ""}`}
                        placeholder="e.g. 122001"
                        value={values.pin_code || ""}
                        onChange={handleChange("pin_code")}
                        onBlur={handleBlur("pin_code")}
                        disabled={loading}
                    />
                    <FormError error={fieldErrors.pin_code} />
                </div>
            </div>
        </form>
    );
}
