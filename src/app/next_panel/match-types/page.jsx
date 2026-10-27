"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";

const BASE = "/next_panel/match-types";

export default function MatchTypesPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [busyId, setBusyId] = useState(null);

    const [filters, setFilters] = useState({ name: "", code: "", status: "" });
    // Filters are applied to the API after a short pause in typing.
    const [applied, setApplied] = useState(filters);

    useEffect(() => {
        const t = setTimeout(() => setApplied(filters), 350);
        return () => clearTimeout(t);
    }, [filters]);

    const load = useCallback(async (signal) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (applied.name.trim()) params.set("name", applied.name.trim());
            if (applied.code.trim()) params.set("code", applied.code.trim());
            if (applied.status !== "") params.set("status", applied.status);

            const res = await fetch(`/api/match-types?${params.toString()}`, { signal });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch match types");
            setRows(json.data || []);
        } catch (err) {
            if (err.name !== "AbortError") setError(err.message);
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [applied]);

    useEffect(() => {
        const controller = new AbortController();
        void Promise.resolve().then(() => load(controller.signal));
        return () => controller.abort();
    }, [load]);

    const toggleStatus = async (row) => {
        setBusyId(row.id);
        setError(null);
        try {
            // The API's PUT expects the full record, so send it all back.
            const res = await fetch(`/api/match-types/${row.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: row.name,
                    code: row.code,
                    description: row.description,
                    status: row.status ? 0 : 1,
                }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to update status");
            setRows((list) => list.map((r) => (r.id === row.id ? { ...r, status: row.status ? 0 : 1 } : r)));
        } catch (err) {
            setError(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const remove = async (row) => {
        if (!window.confirm(`Delete match type "${row.name}"?`)) return;
        setBusyId(row.id);
        setError(null);
        try {
            const res = await fetch(`/api/match-types/${row.id}`, { method: "DELETE" });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete match type");
            setRows((list) => list.filter((r) => r.id !== row.id));
        } catch (err) {
            setError(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const hasFilters = filters.name || filters.code || filters.status !== "";

    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 d-flex flex-wrap justify-content-between align-items-center gap-3">
                        <div>
                            <h1 className="h4 mb-1">Match types</h1>
                            <p className="text-muted mb-0">Formats such as T20 or Test that matches can be set up with.</p>
                        </div>
                        <Link href={`${BASE}/new`} className="btn btn-primary">
                            <Plus size={16} className="me-2" /> Add match type
                        </Link>
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-3">
                        <div className="row g-3 align-items-end">
                            <div className="col-12 col-md-4">
                                <label htmlFor="f-name" className="form-label small text-muted mb-1">Name</label>
                                <div className="input-group">
                                    <span className="input-group-text"><Search size={14} /></span>
                                    <input
                                        id="f-name"
                                        className="form-control"
                                        value={filters.name}
                                        onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))}
                                        placeholder="Search by name"
                                    />
                                </div>
                            </div>
                            <div className="col-6 col-md-3">
                                <label htmlFor="f-code" className="form-label small text-muted mb-1">Code</label>
                                <input
                                    id="f-code"
                                    className="form-control"
                                    value={filters.code}
                                    onChange={(e) => setFilters((f) => ({ ...f, code: e.target.value }))}
                                    placeholder="Search by code"
                                />
                            </div>
                            <div className="col-6 col-md-3">
                                <label htmlFor="f-status" className="form-label small text-muted mb-1">Status</label>
                                <select
                                    id="f-status"
                                    className="form-select"
                                    value={filters.status}
                                    onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                                >
                                    <option value="">All</option>
                                    <option value="1">Active</option>
                                    <option value="0">Inactive</option>
                                </select>
                            </div>
                            <div className="col-12 col-md-2">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary w-100"
                                    disabled={!hasFilters}
                                    onClick={() => setFilters({ name: "", code: "", status: "" })}
                                >
                                    Clear filters
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="col-12">
                        <div className="alert alert-danger mb-0" role="alert">{error}</div>
                    </div>
                )}

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-3">
                        <div className="table-responsive">
                            <table className="table align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Code</th>
                                        <th>Description</th>
                                        <th>Status</th>
                                        <th>Updated</th>
                                        <th className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={6} className="text-center text-muted py-5">Loading match types...</td></tr>
                                    ) : rows.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center text-muted py-5">
                                                {hasFilters
                                                    ? "No match types match these filters."
                                                    : "No match types yet. Add one to get started."}
                                            </td>
                                        </tr>
                                    ) : (
                                        rows.map((row) => (
                                            <tr key={row.id}>
                                                <td className="fw-semibold">{row.name}</td>
                                                <td><span className="badge bg-light text-dark border">{row.code}</span></td>
                                                <td className="text-muted" style={{ maxWidth: 280 }}>
                                                    <div className="text-truncate" title={row.description || ""}>
                                                        {row.description || "-"}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="form-check form-switch m-0">
                                                        <input
                                                            className="form-check-input"
                                                            type="checkbox"
                                                            role="switch"
                                                            id={`status-${row.id}`}
                                                            checked={!!row.status}
                                                            disabled={busyId === row.id}
                                                            onChange={() => toggleStatus(row)}
                                                            aria-label={`${row.name} is ${row.status ? "active" : "inactive"}`}
                                                        />
                                                        <label className="form-check-label small" htmlFor={`status-${row.id}`}>
                                                            {row.status ? "Active" : "Inactive"}
                                                        </label>
                                                    </div>
                                                </td>
                                                <td className="text-muted small">
                                                    {row.updated_at ? new Date(row.updated_at).toLocaleDateString() : "-"}
                                                </td>
                                                <td className="text-end">
                                                    <div className="d-inline-flex gap-2">
                                                        <Link
                                                            href={`${BASE}/${row.id}/edit`}
                                                            className="btn btn-sm btn-outline-primary"
                                                            aria-label={`Edit ${row.name}`}
                                                        >
                                                            <Pencil size={14} />
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-danger"
                                                            disabled={busyId === row.id}
                                                            onClick={() => remove(row)}
                                                            aria-label={`Delete ${row.name}`}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
