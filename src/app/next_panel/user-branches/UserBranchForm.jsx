"use client";

import { useEffect, useState } from "react";
import { FormError, RequiredLabel } from "@/app/components/form";
import { useUser } from "../components/UserContext";

const emptyUserBranch = {
    user_id: "",
    branch_id: "",
    is_primary: 0,
    status: 1,
};

export function getEmptyUserBranch() {
    return { ...emptyUserBranch };
}

export function buildUserBranchPayload(values) {
    return {
        user_id: values.user_id ? Number(values.user_id) : null,
        branch_id: Number(values.branch_id),
        is_primary: Number(values.is_primary) ? 1 : 0,
        status: Number(values.status),
    };
}

async function readJson(res) {
    const text = await res.text();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        return { message: text };
    }
}

export default function UserBranchForm({
    formId,
    values,
    onChange,
    onSubmit,
    error,
    fieldErrors = {},
    onBlur = () => () => {},
    loading = false,
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

    const [users, setUsers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [academies, setAcademies] = useState([]);
    const [selectedAcademy, setSelectedAcademy] = useState(
        !isSuper && userAcademyId ? userAcademyId : ""
    );
    const [optionsError, setOptionsError] = useState(null);
    const [branchesLoading, setBranchesLoading] = useState(false);

    // Auto-select academy for Academy Admin
    useEffect(() => {
        if (!isSuper && userAcademyId && !selectedAcademy) {
            setSelectedAcademy(userAcademyId);
        }
    }, [isSuper, userAcademyId, selectedAcademy]);

    useEffect(() => {
        async function loadOptions() {
            try {
                const [u, a] = await Promise.all([
                    fetch("/api/users?limit=1000"),
                    fetch("/api/academies?status=1"),
                ]);

                const [uj, aj] = await Promise.all([
                    readJson(u),
                    readJson(a),
                ]);

                if (!u.ok) {
                    throw new Error(
                        uj.message || "Unable to load users."
                    );
                }

                setUsers(uj.data || []);
                if (a.ok && aj.success) {
                    const acads = aj.data || [];
                    setAcademies(acads);
                    if (!isSuper && userAcademyId) {
                        setSelectedAcademy(userAcademyId);
                    }
                }
            } catch (err) {
                setOptionsError(err.message);
            }
        }

        loadOptions();
    }, [isSuper, userAcademyId]);

    // Load branches whenever selectedAcademy changes
    useEffect(() => {
        const effectiveAcademy = isSuper ? selectedAcademy : (userAcademyId || selectedAcademy);
        if (!effectiveAcademy) {
            setBranches([]);
            return;
        }

        let isMounted = true;
        setBranchesLoading(true);

        (async () => {
            try {
                const res = await fetch(`/api/branch?academy_id=${effectiveAcademy}&status=1`);
                const json = await readJson(res);
                if (isMounted && res.ok && json.data) {
                    setBranches(json.data || []);
                }
            } catch (err) {
                if (isMounted) setBranches([]);
            } finally {
                if (isMounted) setBranchesLoading(false);
            }
        })();

        return () => {
            isMounted = false;
        };
    }, [isSuper, selectedAcademy, userAcademyId]);

    // Sync selected academy when editing an existing user-branch
    useEffect(() => {
        if (values.branch_id && !selectedAcademy) {
            (async () => {
                try {
                    const res = await fetch(`/api/branch/${values.branch_id}`);
                    const json = await readJson(res);
                    if (res.ok && json.data && json.data.academy_id) {
                        setSelectedAcademy(String(json.data.academy_id));
                    }
                } catch (_) {}
            })();
        }
    }, [values.branch_id, selectedAcademy]);

    const change = (field) => (e) => {
        const raw = e.target.value;

        onChange({
            ...values,
            [field]:
                field === "status" || field === "is_primary"
                    ? Number(raw)
                    : raw,
        });
    };

    return (
        <form id={formId} onSubmit={onSubmit} noValidate>
            {error && (
                <div className="alert alert-danger">{error}</div>
            )}

            {optionsError && (
                <div className="alert alert-warning">
                    {optionsError}
                </div>
            )}

            <div className="row g-3">
                <div className="col-md-6">
                    <label className="form-label fw-semibold">
                        User <span style={{ color: "#dc3545" }}>*</span>
                    </label>

                    <select
                        name="user_id"
                        className={`form-select ${fieldErrors.user_id ? "is-invalid border-danger" : ""}`}
                        value={values.user_id}
                        onChange={change("user_id")}
                        onBlur={onBlur("user_id")}
                        disabled={loading}
                    >
                        <option value="">Select user</option>

                        {users.map((u) => (
                            <option key={u.id} value={u.id}>
                                {[u.first_name, u.last_name]
                                    .filter(Boolean)
                                    .join(" ") ||
                                    `User #${u.id}`}{" "}
                                ({u.email || u.id})
                            </option>
                        ))}
                    </select>
                    <FormError error={fieldErrors.user_id} />
                </div>

                <div className="col-md-6">
                    <label className="form-label fw-semibold">
                        Academy <span style={{ color: "#dc3545" }}>*</span>
                    </label>
                    <select
                        className="form-select"
                        value={selectedAcademy}
                        onChange={(e) => {
                            const newAcademy = e.target.value;
                            setSelectedAcademy(newAcademy);
                            onChange({ ...values, branch_id: "" });
                        }}
                        disabled={loading || (!isSuper && Boolean(userAcademyId))}
                    >
                        {isSuper && <option value="">-- Select Academy --</option>}
                        {academies.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.academy_name} {a.academy_code ? `(${a.academy_code})` : ""}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="col-md-6">
                    <label className="form-label fw-semibold">
                        Branch <span style={{ color: "#dc3545" }}>*</span>
                    </label>

                    <select
                        name="branch_id"
                        className={`form-select ${fieldErrors.branch_id ? "is-invalid border-danger" : ""}`}
                        value={values.branch_id}
                        onChange={change("branch_id")}
                        onBlur={onBlur("branch_id")}
                        disabled={loading || (isSuper && !selectedAcademy) || branchesLoading}
                    >
                        <option value="">
                            {branchesLoading
                                ? "Loading branches..."
                                : isSuper && !selectedAcademy
                                ? "-- Please select an academy first --"
                                : branches.length === 0
                                ? "No branches available under selected academy"
                                : "Select branch"}
                        </option>

                        {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                                {b.branch_name}
                                {b.branch_code
                                    ? ` (${b.branch_code})`
                                    : ""}
                                {b.academy_name ? ` - ${b.academy_name}` : ""}
                            </option>
                        ))}
                    </select>
                    <FormError error={fieldErrors.branch_id} />
                </div>

                <div className="col-md-6">
                    <label className="form-label fw-semibold">
                        Primary Branch
                    </label>

                    <select
                        name="is_primary"
                        className="form-select"
                        value={values.is_primary}
                        onChange={change("is_primary")}
                        disabled={loading}
                    >
                        <option value={1}>Yes</option>
                        <option value={0}>No</option>
                    </select>
                </div>

                <div className="col-md-6">
                    <label className="form-label fw-semibold">Status</label>

                    <select
                        name="status"
                        className="form-select"
                        value={values.status}
                        onChange={change("status")}
                        disabled={loading}
                    >
                        <option value={1}>Active</option>
                        <option value={0}>Inactive</option>
                    </select>
                </div>
            </div>
        </form>
    );
}
