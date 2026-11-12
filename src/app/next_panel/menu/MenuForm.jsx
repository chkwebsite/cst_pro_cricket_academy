"use client";

import { useEffect, useState } from "react";

const emptyMenu = {
    parent_id: "",
    menu_key: "",
    menu_name: "",
    menu_title: "",
    menu_icon: "",
    menu_url: "",
    menu_type: "module",
    menu_order: 0,
    is_sidebar: 1,
    is_active: 1,
    status: 1,
};

export function getEmptyMenu() {
    return { ...emptyMenu };
}

export function buildMenuPayload(values) {
    return {
        parent_id: values.parent_id ? Number(values.parent_id) : null,
        menu_key: values.menu_key.trim(),
        menu_name: values.menu_name.trim(),
        menu_title: values.menu_title.trim(),
        menu_icon: values.menu_icon ? values.menu_icon.trim() : null,
        menu_url: values.menu_url ? values.menu_url.trim() : null,
        menu_type: values.menu_type,
        menu_order: Number(values.menu_order) || 0,
        is_sidebar: Number(values.is_sidebar) ? 1 : 0,
        is_active: Number(values.is_active) ? 1 : 0,
        status: Number(values.status) ? 1 : 0,
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

export default function MenuForm({
    formId,
    values,
    onChange,
    onSubmit,
    error,
    loading = false,
    excludeId = null,
}) {
    const [parents, setParents] = useState([]);
    const [optionsError, setOptionsError] = useState(null);

    useEffect(() => {
        async function loadOptions() {
            try {
                const res = await fetch(
                    "/api/menu?limit=200&status=1"
                );

                const json = await readJson(res);

                if (!res.ok) {
                    throw new Error(
                        json.message ||
                        "Unable to load parent menus."
                    );
                }

                const list = json.data || [];

                setParents(
                    excludeId
                        ? list.filter(
                            (m) =>
                                Number(m.id) !==
                                Number(excludeId)
                        )
                        : list
                );
            } catch (err) {
                setOptionsError(err.message);
            }
        }

        loadOptions();
    }, [excludeId]);

    const change = (field) => (e) => {
        const raw = e.target.value;

        const numericFields = [
            "menu_order",
            "is_sidebar",
            "is_active",
            "status",
        ];

        onChange({
            ...values,
            [field]: numericFields.includes(field)
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
                    <label className="form-label">
                        Menu Key <span className="text-danger">*</span>
                    </label>

                    <input
                        type="text"
                        className="form-control"
                        value={values.menu_key}
                        onChange={change("menu_key")}
                        placeholder="e.g. dashboard, user_management"
                        required
                        disabled={loading}
                    />
                </div>

                <div className="col-md-6">
                    <label className="form-label">
                        Parent Menu
                    </label>

                    <select
                        className="form-select"
                        value={values.parent_id}
                        onChange={change("parent_id")}
                        disabled={loading}
                    >
                        <option value="">
                            No parent (top level)
                        </option>

                        {parents.map((m) => (
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
                        Menu Name <span className="text-danger">*</span>
                    </label>

                    <input
                        type="text"
                        className="form-control"
                        value={values.menu_name}
                        onChange={change("menu_name")}
                        required
                        disabled={loading}
                    />
                </div>

                <div className="col-md-6">
                    <label className="form-label">
                        Menu Title <span className="text-danger">*</span>
                    </label>

                    <input
                        type="text"
                        className="form-control"
                        value={values.menu_title}
                        onChange={change("menu_title")}
                        placeholder="Label shown in the UI"
                        required
                        disabled={loading}
                    />
                </div>

                <div className="col-md-4">
                    <label className="form-label">
                        Menu Type <span className="text-danger">*</span>
                    </label>

                    <select
                        className="form-select"
                        value={values.menu_type}
                        onChange={change("menu_type")}
                        disabled={loading}
                    >
                        <option value="module">Module</option>
                        <option value="link">Link</option>
                        <option value="heading">Heading</option>
                    </select>
                </div>

                <div className="col-md-4">
                    <label className="form-label">
                        Menu Icon
                    </label>

                    <input
                        type="text"
                        className="form-control"
                        value={values.menu_icon || ""}
                        onChange={change("menu_icon")}
                        placeholder="e.g. layout-dashboard"
                        disabled={loading}
                    />
                </div>

                <div className="col-md-4">
                    <label className="form-label">
                        Menu Order
                    </label>

                    <input
                        type="number"
                        className="form-control"
                        value={values.menu_order}
                        onChange={change("menu_order")}
                        disabled={loading}
                    />
                </div>

                <div className="col-md-12">
                    <label className="form-label">
                        Menu URL
                    </label>

                    <input
                        type="text"
                        className="form-control"
                        value={values.menu_url || ""}
                        onChange={change("menu_url")}
                        placeholder="/next_panel/example"
                        disabled={loading}
                    />
                </div>

                <div className="col-md-4">
                    <label className="form-label">
                        Show In Sidebar
                    </label>

                    <select
                        className="form-select"
                        value={values.is_sidebar}
                        onChange={change("is_sidebar")}
                        disabled={loading}
                    >
                        <option value={1}>Yes</option>
                        <option value={0}>No</option>
                    </select>
                </div>

                <div className="col-md-4">
                    <label className="form-label">
                        Active
                    </label>

                    <select
                        className="form-select"
                        value={values.is_active}
                        onChange={change("is_active")}
                        disabled={loading}
                    >
                        <option value={1}>Yes</option>
                        <option value={0}>No</option>
                    </select>
                </div>

                <div className="col-md-4">
                    <label className="form-label">
                        Status
                    </label>

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
