"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function RolePermissionForm({ id = null }) {
    const router = useRouter();
    const isEdit = Boolean(id);

    const [roleId, setRoleId] = useState("");
    const [selectedIds, setSelectedIds] = useState([]); // selected permission ids
    const [assignedIds, setAssignedIds] = useState([]); // already assigned to chosen role (create mode)
    const [search, setSearch] = useState("");

    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [optionsLoading, setOptionsLoading] = useState(true);
    const [error, setError] = useState("");

    // LOAD ROLES + PERMISSIONS
    useEffect(() => {
        const loadOptions = async () => {
            setOptionsLoading(true);
            try {
                const [rolesRes, permissionsRes] = await Promise.all([
                    fetch("/api/roles"),
                    fetch("/api/permissions"),
                ]);

                const rolesJson = await rolesRes.json();
                const permissionsJson = await permissionsRes.json();

                if (!rolesRes.ok || !rolesJson.success) {
                    throw new Error(rolesJson.message || "Failed to load roles");
                }
                if (!permissionsRes.ok || !permissionsJson.success) {
                    throw new Error(permissionsJson.message || "Failed to load permissions");
                }

                setRoles(rolesJson.data || []);
                setPermissions(permissionsJson.data || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setOptionsLoading(false);
            }
        };
        loadOptions();
    }, []);

    // EDIT MODE: load single role-permission
    useEffect(() => {
        if (!id) return;
        const getRolePermission = async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/role-permissions/${id}`);
                const result = await res.json();
                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Failed to fetch Role Permission");
                }
                const data = result.data;
                setRoleId(data.role_id ?? "");
                setSelectedIds(data.permission_id ? [Number(data.permission_id)] : []);
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        };
        getRolePermission();
    }, [id]);

    // CREATE MODE: when a role is picked, find permissions it already has
    // (so those cards show as "Assigned" and can't be picked twice)
    useEffect(() => {
        if (isEdit) return;
        if (!roleId) {
            setAssignedIds([]);
            return;
        }
        let cancelled = false;
        const loadAssigned = async () => {
            try {
                const res = await fetch("/api/role-permissions");
                const json = await res.json();
                if (!res.ok || !json.success) return;
                const ids = (json.data || [])
                    .filter((item) => Number(item.role_id) === Number(roleId))
                    .map((item) => Number(item.permission_id))
                    .filter(Boolean);
                if (cancelled) return;
                setAssignedIds(ids);
                setSelectedIds((prev) => prev.filter((pid) => !ids.includes(pid)));
            } catch {
                // non-critical: server will still reject duplicates
            }
        };
        loadAssigned();
        return () => {
            cancelled = true;
        };
    }, [roleId, isEdit]);

    // GROUP PERMISSIONS BY MODULE (with search filter)
    const groupedPermissions = useMemo(() => {
        const term = search.trim().toLowerCase();
        const filtered = permissions.filter(
            (p) =>
                !term ||
                p.module_name?.toLowerCase().includes(term) ||
                p.permission_name?.toLowerCase().includes(term)
        );
        const groups = {};
        filtered.forEach((p) => {
            const key = p.module_name || "Other";
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        });
        return groups;
    }, [permissions, search]);

    const isAssigned = (pid) => assignedIds.includes(Number(pid));
    const isSelected = (pid) => selectedIds.includes(Number(pid));

    // Permissions that can actually be selected (not already assigned)
    const selectableIds = (list) =>
        list.filter((p) => !isAssigned(p.id)).map((p) => Number(p.id));

    const togglePermission = (pid) => {
        pid = Number(pid);
        if (isAssigned(pid)) return;
        if (isEdit) {
            // edit = one record, so single select
            setSelectedIds([pid]);
            return;
        }
        setSelectedIds((prev) =>
            prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid]
        );
    };

    const toggleModule = (list) => {
        const ids = selectableIds(list);
        const allSelected = ids.length > 0 && ids.every((pid) => selectedIds.includes(pid));
        setSelectedIds((prev) =>
            allSelected
                ? prev.filter((pid) => !ids.includes(pid))
                : Array.from(new Set([...prev, ...ids]))
        );
    };

    const visiblePermissions = Object.values(groupedPermissions).flat();
    const visibleSelectableIds = selectableIds(visiblePermissions);
    const allVisibleSelected =
        visibleSelectableIds.length > 0 &&
        visibleSelectableIds.every((pid) => selectedIds.includes(pid));

    const toggleAllVisible = () => {
        setSelectedIds((prev) =>
            allVisibleSelected
                ? prev.filter((pid) => !visibleSelectableIds.includes(pid))
                : Array.from(new Set([...prev, ...visibleSelectableIds]))
        );
    };

    // SUBMIT
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!roleId) {
            setError("Please select a role");
            return;
        }
        if (selectedIds.length === 0) {
            setError("Please select at least one permission");
            return;
        }

        try {
            setLoading(true);
            setError("");

            // EDIT: single PUT as before
            if (isEdit) {
                const res = await fetch(`/api/role-permissions/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        role_id: Number(roleId),
                        permission_id: selectedIds[0],
                    }),
                });
                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.message || "Something went wrong");
                }
                alert("Role permission updated successfully");
                router.push("/next_panel/role-permissions");
                router.refresh();
                return;
            }

            // CREATE: one POST per selected permission, all in one go
            const results = await Promise.allSettled(
                selectedIds.map(async (permission_id) => {
                    const res = await fetch("/api/role-permissions", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            role_id: Number(roleId),
                            permission_id,
                        }),
                    });
                    const data = await res.json();
                    if (!res.ok || !data.success) {
                        throw new Error(data.message || "Something went wrong");
                    }
                    return permission_id;
                })
            );

            const succeeded = [];
            const failed = [];
            results.forEach((r, i) => {
                if (r.status === "fulfilled") succeeded.push(selectedIds[i]);
                else failed.push({ id: selectedIds[i], message: r.reason?.message });
            });

            if (failed.length === 0) {
                alert(`${succeeded.length} permission(s) assigned to role successfully`);
                router.push("/next_panel/role-permissions");
                router.refresh();
                return;
            }

            // partial failure: keep only the failed ones selected so user can retry
            setAssignedIds((prev) => [...prev, ...succeeded]);
            setSelectedIds(failed.map((f) => f.id));
            const names = failed.map((f) => {
                const p = permissions.find((x) => Number(x.id) === f.id);
                return p ? `${p.module_name} - ${p.permission_name}` : `#${f.id}`;
            });
            setError(
                `${succeeded.length} assigned, ${failed.length} failed: ${names.join(", ")}. ` +
                `(${failed[0].message})`
            );
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching || optionsLoading) {
        return <div className="text-center py-5">Loading...</div>;
    }

    const moduleNames = Object.keys(groupedPermissions);

    return (
        <div className="card shadow-sm">
            <div className="card-header">
                <h5 className="mb-0">
                    {isEdit ? "Edit Role Permission" : "Assign Permissions to Role"}
                </h5>
            </div>

            <div className="card-body">
                {error && <div className="alert alert-danger">{error}</div>}

                <form onSubmit={handleSubmit}>
                    {/* Role */}
                    <div className="mb-4" style={{ maxWidth: 420 }}>
                        <label className="form-label fw-semibold">Role</label>
                        <select
                            className="form-select"
                            value={roleId}
                            onChange={(e) => {
                                setRoleId(e.target.value === "" ? "" : Number(e.target.value));
                                if (!isEdit) setSelectedIds([]);
                            }}
                            required
                        >
                            <option value="">Select Role</option>
                            {roles.map((role) => (
                                <option key={role.id} value={role.id}>
                                    {role.role_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Permissions toolbar */}
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-3">
                        <div>
                            <label className="form-label fw-semibold mb-0">
                                Permissions{" "}
                                <span className="badge text-bg-primary ms-1">
                                    {selectedIds.length} selected
                                </span>
                            </label>
                            {!isEdit && !roleId && (
                                <div className="form-text">Pehle role select karein, phir permissions choose karein.</div>
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
                                        disabled={visibleSelectableIds.length === 0}
                                    >
                                        {allVisibleSelected ? "Deselect All" : "Select All"}
                                    </button>
                                    {selectedIds.length > 0 && (
                                        <button
                                            type="button"
                                            className="btn btn-outline-danger text-nowrap"
                                            onClick={() => setSelectedIds([])}
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
                        <div className="text-center text-muted py-4">No permissions found.</div>
                    ) : (
                        moduleNames.map((moduleName) => {
                            const list = groupedPermissions[moduleName];
                            const ids = selectableIds(list);
                            const moduleAllSelected =
                                ids.length > 0 && ids.every((pid) => selectedIds.includes(pid));

                            return (
                                <div key={moduleName} className="mb-4">
                                    <div className="d-flex align-items-center justify-content-between border-bottom pb-2 mb-3">
                                        <h6 className="mb-0 text-uppercase text-muted">
                                            {moduleName}{" "}
                                            <span className="badge text-bg-light border">{list.length}</span>
                                        </h6>
                                        {!isEdit && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-link text-decoration-none"
                                                onClick={() => toggleModule(list)}
                                                disabled={ids.length === 0}
                                            >
                                                {moduleAllSelected ? "Deselect module" : "Select module"}
                                            </button>
                                        )}
                                    </div>

                                    <div className="row g-3">
                                        {list.map((permission) => {
                                            const selected = isSelected(permission.id);
                                            const assigned = isAssigned(permission.id);

                                            return (
                                                <div
                                                    key={permission.id}
                                                    className="col-12 col-sm-6 col-lg-4 col-xl-3"
                                                >
                                                    <div
                                                        role={isEdit ? "radio" : "checkbox"}
                                                        aria-checked={selected}
                                                        aria-disabled={assigned}
                                                        tabIndex={assigned ? -1 : 0}
                                                        onClick={() => togglePermission(permission.id)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === " " || e.key === "Enter") {
                                                                e.preventDefault();
                                                                togglePermission(permission.id);
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
                                                            <div className="min-w-0">
                                                                <div className="fw-semibold">
                                                                    {permission.permission_name}
                                                                </div>
                                                                <div className="small text-muted">
                                                                    {permission.module_name}
                                                                </div>
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

                    {/* Buttons */}
                    <div className="d-flex gap-2 pt-2">
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading || !roleId || selectedIds.length === 0}
                        >
                            {loading
                                ? "Saving..."
                                : isEdit
                                    ? "Update Role Permission"
                                    : `Assign Permission${selectedIds.length > 1 ? "s" : ""}${selectedIds.length ? ` (${selectedIds.length})` : ""
                                    }`}
                        </button>

                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => router.push("/next_panel/role-permissions")}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
