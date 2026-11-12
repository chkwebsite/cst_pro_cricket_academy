"use client";

import { useEffect, useState } from "react";

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
    loading = false,
}) {
    const [users, setUsers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [optionsError, setOptionsError] = useState(null);

    useEffect(() => {
        async function loadOptions() {
            try {
                const [u, b] = await Promise.all([
                    fetch("/api/users?limit=1000"),
                    fetch("/api/branch?status=1"),
                ]);

                const [uj, bj] = await Promise.all([
                    readJson(u),
                    readJson(b),
                ]);

                if (!u.ok) {
                    throw new Error(
                        uj.message || "Unable to load users."
                    );
                }

                if (!b.ok) {
                    throw new Error(
                        bj.message || "Unable to load branches."
                    );
                }

                setUsers(uj.data || []);
                setBranches(bj.data || []);
            } catch (err) {
                setOptionsError(err.message);
            }
        }

        loadOptions();
    }, []);

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
        <form id={formId} onSubmit={onSubmit}>
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
                    <label className="form-label">User</label>

                    <select
                        className="form-select"
                        value={values.user_id}
                        onChange={change("user_id")}
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
                </div>

                <div className="col-md-6">
                    <label className="form-label">
                        Branch <span className="text-danger">*</span>
                    </label>

                    <select
                        className="form-select"
                        value={values.branch_id}
                        onChange={change("branch_id")}
                        required
                        disabled={loading}
                    >
                        <option value="">Select branch</option>

                        {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                                {b.branch_name}
                                {b.branch_code
                                    ? ` (${b.branch_code})`
                                    : ""}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="col-md-6">
                    <label className="form-label">
                        Primary Branch
                    </label>

                    <select
                        className="form-select"
                        value={values.is_primary}
                        onChange={change("is_primary")}
                        disabled={loading}
                    >
                        <option value={0}>Yes</option>
                        <option value={1}>No</option>
                    </select>
                </div>

                <div className="col-md-6">
                    <label className="form-label">Status</label>

                    <select
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
