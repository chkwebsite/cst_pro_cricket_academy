"use client";

import { useEffect, useState } from "react";
import { FormError } from "@/app/components/form";

const emptyUserRole = {
    user_id: "",
    role_id: "",
};

export function getEmptyUserRole() {
    return { ...emptyUserRole };
}

export function buildUserRolePayload(values) {
    return {
        user_id: values.user_id ? Number(values.user_id) : null,
        role_id: values.role_id ? Number(values.role_id) : null,
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

export default function UserRoleForm({
    formId,
    values,
    onChange,
    onSubmit,
    error,
    fieldErrors = {},
    onBlur = null,
    loading = false,
}) {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [optionsError, setOptionsError] = useState(null);

    useEffect(() => {
        async function loadOptions() {
            try {
                const [u, r] = await Promise.all([
                    fetch("/api/users?limit=1000"),
                    fetch("/api/roles?status=1"),
                ]);

                const [uj, rj] = await Promise.all([
                    readJson(u),
                    readJson(r),
                ]);

                if (!u.ok) {
                    throw new Error(
                        uj.message || "Unable to load users."
                    );
                }

                if (!r.ok) {
                    throw new Error(
                        rj.message || "Unable to load roles."
                    );
                }

                setUsers(uj.data || []);
                setRoles(rj.data || []);
            } catch (err) {
                setOptionsError(err.message);
            }
        }

        loadOptions();
    }, []);

    const change = (field) => (e) => {
        onChange({
            ...values,
            [field]: e.target.value,
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
                    <label className="form-label">
                        User <span className="text-danger">*</span>
                    </label>

                    <select
                        name="user_id"
                        className={`form-select ${fieldErrors.user_id ? "is-invalid border-danger" : ""}`}
                        value={values.user_id}
                        onChange={change("user_id")}
                        onBlur={onBlur ? onBlur("user_id") : undefined}
                        required
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
                    <label className="form-label">
                        Role <span className="text-danger">*</span>
                    </label>

                    <select
                        name="role_id"
                        className={`form-select ${fieldErrors.role_id ? "is-invalid border-danger" : ""}`}
                        value={values.role_id}
                        onChange={change("role_id")}
                        onBlur={onBlur ? onBlur("role_id") : undefined}
                        required
                        disabled={loading}
                    >
                        <option value="">Select role</option>

                        {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.role_name || `Role #${r.id}`}
                            </option>
                        ))}
                    </select>
                    <FormError error={fieldErrors.role_id} />
                </div>
            </div>
        </form>
    );
}
