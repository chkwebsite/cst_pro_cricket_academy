"use client";

import { useEffect, useState } from "react";

const emptyMenuPermission = {
    menu_id: "",
    permission_id: "",
};

export function getEmptyMenuPermission() {
    return { ...emptyMenuPermission };
}

export function buildMenuPermissionPayload(values) {
    return {
        menu_id: values.menu_id ? Number(values.menu_id) : null,
        permission_id: values.permission_id
            ? Number(values.permission_id)
            : null,
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

export default function MenuPermissionForm({
    formId,
    values,
    onChange,
    onSubmit,
    error,
    loading = false,
}) {
    const [menus, setMenus] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [optionsError, setOptionsError] = useState(null);

    useEffect(() => {
        async function loadOptions() {
            try {
                const [m, p] = await Promise.all([
                    fetch("/api/menu?limit=500&status=1"),
                    fetch("/api/permissions?status=1"),
                ]);

                const [mj, pj] = await Promise.all([
                    readJson(m),
                    readJson(p),
                ]);

                if (!m.ok) {
                    throw new Error(
                        mj.message || "Unable to load menus."
                    );
                }

                if (!p.ok) {
                    throw new Error(
                        pj.message ||
                        "Unable to load permissions."
                    );
                }

                setMenus(mj.data || []);
                setPermissions(pj.data || []);
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
                        Menu <span className="text-danger">*</span>
                    </label>

                    <select
                        className="form-select"
                        value={values.menu_id}
                        onChange={change("menu_id")}
                        required
                        disabled={loading}
                    >
                        <option value="">Select menu</option>

                        {menus.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.menu_title ||
                                    m.menu_name ||
                                    `Menu #${m.id}`}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="col-md-6">
                    <label className="form-label">
                        Permission <span className="text-danger">*</span>
                    </label>

                    <select
                        className="form-select"
                        value={values.permission_id}
                        onChange={change("permission_id")}
                        required
                        disabled={loading}
                    >
                        <option value="">
                            Select permission
                        </option>

                        {permissions.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.permission_name ||
                                    `Permission #${p.id}`}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </form>
    );
}
