"use client";

import { useEffect, useMemo, useState } from "react";

// NOTE: apna actual endpoint yahan set karein (list + create dono ke liye)
const MENU_PERMISSION_API = "/api/menu-permissions";

const emptyMenuPermission = {
    menu_id: "",
    permission_id: "", // single (edit mode / backward compatible)
    permission_ids: [], // multiple (create mode)
};

export function getEmptyMenuPermission() {
    return { ...emptyMenuPermission, permission_ids: [] };
}

// Single payload (edit mode, or old single-submit flow)
export function buildMenuPermissionPayload(values) {
    return {
        menu_id: values.menu_id ? Number(values.menu_id) : null,
        permission_id: values.permission_id
            ? Number(values.permission_id)
            : null,
    };
}

// One payload per selected permission (create mode)
export function buildMenuPermissionPayloads(values) {
    const menu_id = values.menu_id ? Number(values.menu_id) : null;
    const ids = values.permission_ids?.length
        ? values.permission_ids
        : values.permission_id
            ? [values.permission_id]
            : [];
    return ids.map((pid) => ({ menu_id, permission_id: Number(pid) }));
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

// Parent ke handleSubmit me call karein (create mode):
//   const { succeeded, failed } = await createMenuPermissions(values);
// Saare selected permissions ek saath POST hote hain.
export async function createMenuPermissions(values, url = MENU_PERMISSION_API) {
    const payloads = buildMenuPermissionPayloads(values);

    const results = await Promise.allSettled(
        payloads.map(async (payload) => {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await readJson(res);
            if (!res.ok || json.success === false) {
                throw new Error(json.message || "Something went wrong");
            }
            return payload.permission_id;
        })
    );

    const succeeded = [];
    const failed = [];
    results.forEach((r, i) => {
        if (r.status === "fulfilled") succeeded.push(payloads[i].permission_id);
        else
            failed.push({
                permission_id: payloads[i].permission_id,
                message: r.reason?.message,
            });
    });
    return { succeeded, failed };
}

export default function MenuPermissionForm({
    formId,
    values,
    onChange,
    onSubmit,
    error,
    loading = false,
    isEdit = false, // true => single select (radio), false => multi select
}) {
    const [menus, setMenus] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [assignedIds, setAssignedIds] = useState([]);
    const [search, setSearch] = useState("");
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
                    throw new Error(mj.message || "Unable to load menus.");
                }

                if (!p.ok) {
                    throw new Error(pj.message || "Unable to load permissions.");
                }

                setMenus(mj.data || []);
                setPermissions(pj.data || []);
            } catch (err) {
                setOptionsError(err.message);
            }
        }

        loadOptions();
    }, []);

    // Create mode: jab menu select ho, uski already-assigned permissions dhundo
    useEffect(() => {
        if (isEdit || !values.menu_id) {
            setAssignedIds([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                // API paginated hai (max 100/page) aur menu_id filter support karti hai
                const ids = [];
                let page = 1;
                let totalPages = 1;
                do {
                    const res = await fetch(
                        `${MENU_PERMISSION_API}?menu_id=${values.menu_id}&limit=100&page=${page}`
                    );
                    const json = await readJson(res);
                    if (!res.ok || json.success === false) return;
                    (json.data || []).forEach((i) => {
                        if (i.permission_id) ids.push(Number(i.permission_id));
                    });
                    totalPages = json.pagination?.totalPages || 1;
                    page += 1;
                } while (page <= totalPages && !cancelled);
                if (!cancelled) setAssignedIds(ids);
            } catch {
                // non-critical: server duplicate ko reject karega
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [values.menu_id, isEdit]);

    // Currently selected ids (permission_ids, ya fallback single permission_id)
    const selectedIds = useMemo(() => {
        if (values.permission_ids?.length) return values.permission_ids.map(Number);
        if (values.permission_id) return [Number(values.permission_id)];
        return [];
    }, [values.permission_ids, values.permission_id]);

    const isSelected = (pid) => selectedIds.includes(Number(pid));
    const isAssigned = (pid) => assignedIds.includes(Number(pid));

    const setSelected = (ids) => {
        onChange({
            ...values,
            permission_ids: ids,
            permission_id: ids[0] ?? "", // single-submit flow ke saath compatible
        });
    };

    const togglePermission = (pid) => {
        pid = Number(pid);
        if (loading || isAssigned(pid)) return;
        if (isEdit) {
            setSelected([pid]);
            return;
        }
        setSelected(
            selectedIds.includes(pid)
                ? selectedIds.filter((x) => x !== pid)
                : [...selectedIds, pid]
        );
    };

    const groupedPermissions = useMemo(() => {
        const term = search.trim().toLowerCase();
        const groups = {};
        permissions
            .filter(
                (p) =>
                    !term ||
                    p.module_name?.toLowerCase().includes(term) ||
                    p.permission_name?.toLowerCase().includes(term)
            )
            .forEach((p) => {
                const key = p.module_name || "Other";
                (groups[key] ||= []).push(p);
            });
        return groups;
    }, [permissions, search]);

    const selectableIds = (list) =>
        list.filter((p) => !isAssigned(p.id)).map((p) => Number(p.id));

    const toggleModule = (list) => {
        const ids = selectableIds(list);
        const all = ids.length > 0 && ids.every((x) => selectedIds.includes(x));
        setSelected(
            all
                ? selectedIds.filter((x) => !ids.includes(x))
                : Array.from(new Set([...selectedIds, ...ids]))
        );
    };

    const visibleSelectable = selectableIds(Object.values(groupedPermissions).flat());
    const allVisibleSelected =
        visibleSelectable.length > 0 &&
        visibleSelectable.every((x) => selectedIds.includes(x));

    const toggleAllVisible = () =>
        setSelected(
            allVisibleSelected
                ? selectedIds.filter((x) => !visibleSelectable.includes(x))
                : Array.from(new Set([...selectedIds, ...visibleSelectable]))
        );

    const moduleNames = Object.keys(groupedPermissions);

    return (
        <form id={formId} onSubmit={onSubmit}>
            {error && <div className="alert alert-danger">{error}</div>}

            {optionsError && (
                <div className="alert alert-warning">{optionsError}</div>
            )}

            {/* Menu */}
            <div className="mb-4" style={{ maxWidth: 420 }}>
                <label className="form-label fw-semibold">
                    Menu <span className="text-danger">*</span>
                </label>

                <select
                    className="form-select"
                    value={values.menu_id}
                    onChange={(e) =>
                        onChange({
                            ...values,
                            menu_id: e.target.value,
                            ...(isEdit ? {} : { permission_id: "", permission_ids: [] }),
                        })
                    }
                    required
                    disabled={loading}
                >
                    <option value="">Select menu</option>

                    {menus.map((m) => (
                        <option key={m.id} value={m.id}>
                            {m.menu_title || m.menu_name || `Menu #${m.id}`}
                        </option>
                    ))}
                </select>
            </div>

            {/* Toolbar */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-3">
                <div>
                    <label className="form-label fw-semibold mb-0">
                        Permissions <span className="text-danger">*</span>
                        <span className="badge text-bg-primary ms-2">
                            {selectedIds.length} selected
                        </span>
                    </label>
                    {!isEdit && !values.menu_id && (
                        <div className="form-text">
                            Pehle menu select karein, phir permissions choose karein.
                        </div>
                    )}
                </div>

                <div className="d-flex gap-2 flex-wrap">
                    <input
                        type="text"
                        className="form-control"
                        style={{ minWidth: 220 }}
                        placeholder="Search module or permission"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {!isEdit && (
                        <>
                            <button
                                type="button"
                                className="btn btn-outline-primary text-nowrap"
                                onClick={toggleAllVisible}
                                disabled={loading || visibleSelectable.length === 0}
                            >
                                {allVisibleSelected ? "Deselect All" : "Select All"}
                            </button>
                            {selectedIds.length > 0 && (
                                <button
                                    type="button"
                                    className="btn btn-outline-danger text-nowrap"
                                    onClick={() => setSelected([])}
                                    disabled={loading}
                                >
                                    Clear
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Permission cards grouped by module */}
            {moduleNames.length === 0 ? (
                <div className="text-center text-muted py-4">
                    No permissions found.
                </div>
            ) : (
                moduleNames.map((moduleName) => {
                    const list = groupedPermissions[moduleName];
                    const ids = selectableIds(list);
                    const moduleAll =
                        ids.length > 0 && ids.every((x) => selectedIds.includes(x));

                    return (
                        <div key={moduleName} className="mb-4">
                            <div className="d-flex align-items-center justify-content-between border-bottom pb-2 mb-3">
                                <h6 className="mb-0 text-uppercase text-muted">
                                    {moduleName}{" "}
                                    <span className="badge text-bg-light border">
                                        {list.length}
                                    </span>
                                </h6>
                                {!isEdit && (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-link text-decoration-none"
                                        onClick={() => toggleModule(list)}
                                        disabled={loading || ids.length === 0}
                                    >
                                        {moduleAll ? "Deselect module" : "Select module"}
                                    </button>
                                )}
                            </div>

                            <div className="row g-3">
                                {list.map((p) => {
                                    const selected = isSelected(p.id);
                                    const assigned = isAssigned(p.id);

                                    return (
                                        <div
                                            key={p.id}
                                            className="col-12 col-sm-6 col-lg-4 col-xl-3"
                                        >
                                            <div
                                                role={isEdit ? "radio" : "checkbox"}
                                                aria-checked={selected}
                                                aria-disabled={assigned}
                                                tabIndex={assigned ? -1 : 0}
                                                onClick={() => togglePermission(p.id)}
                                                onKeyDown={(e) => {
                                                    if (e.key === " " || e.key === "Enter") {
                                                        e.preventDefault();
                                                        togglePermission(p.id);
                                                    }
                                                }}
                                                className={`card h-100 ${selected
                                                        ? "border-primary bg-primary-subtle"
                                                        : "border"
                                                    }`}
                                                style={{
                                                    cursor: assigned ? "not-allowed" : "pointer",
                                                    opacity: assigned ? 0.55 : 1,
                                                    userSelect: "none",
                                                }}
                                            >
                                                <div className="card-body py-3 d-flex align-items-start gap-2">
                                                    <input
                                                        type={isEdit ? "radio" : "checkbox"}
                                                        className="form-check-input mt-1 flex-shrink-0"
                                                        checked={selected || assigned}
                                                        disabled={assigned}
                                                        readOnly
                                                        tabIndex={-1}
                                                        style={{ pointerEvents: "none" }}
                                                    />
                                                    <div>
                                                        <div className="fw-semibold">
                                                            {p.permission_name || `Permission #${p.id}`}
                                                        </div>
                                                        {p.module_name && (
                                                            <div className="small text-muted">
                                                                {p.module_name}
                                                            </div>
                                                        )}
                                                        {assigned && (
                                                            <span className="badge text-bg-success mt-1">
                                                                Already assigned
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })
            )}
        </form>
    );
}
