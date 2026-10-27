"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useUser } from "../components/UserContext";
import { BASE, STATUSES, STATUS_BADGE, formatDate, formatFee } from "./shared";

const EMPTY_FILTERS = { tournament_name: "", tournament_code: "", tournament_type: "", status: "" };

export default function TournamentsPage() {
    const { user } = useUser();
    const hasSessionUser = Boolean(user);
    const userRole = String(user?.user_type || "")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ");
    const isSuperAdmin = ["super admin", "superadmin", "admin"].includes(userRole);
    const isBranchAdmin = userRole === "branch admin";
    const isAcademyAdmin = userRole === "academy admin";
    const userAcademyId = user?.academy_id && Number(user.academy_id) !== 0
        ? String(user.academy_id)
        : "";
    const userBranchId = user?.branch_id && Number(user.branch_id) !== 0
        ? String(user.branch_id)
        : "";
    const [rows, setRows] = useState([]);
    const [matchTypes, setMatchTypes] = useState([]);
    const [matchTypesLoading, setMatchTypesLoading] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [busyId, setBusyId] = useState(null);

    const [filters, setFilters] = useState(EMPTY_FILTERS);
    // Filters are sent to the API after a short pause in typing.
    const [applied, setApplied] = useState(EMPTY_FILTERS);

    useEffect(() => {
        const t = setTimeout(() => setApplied(filters), 350);
        return () => clearTimeout(t);
    }, [filters]);

    useEffect(() => {
        const controller = new AbortController();

        const loadMatchTypes = async () => {
            try {
                const res = await fetch("/api/match-types?status=1", {
                    cache: "no-store",
                    signal: controller.signal,
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to load match types");
                }
                if (!controller.signal.aborted) setMatchTypes(json.data || []);
            } catch (err) {
                if (err.name !== "AbortError") console.error("LOAD TOURNAMENT FORMATS ERROR:", err);
            } finally {
                if (!controller.signal.aborted) setMatchTypesLoading(false);
            }
        };

        loadMatchTypes();
        return () => controller.abort();
    }, []);

    const load = useCallback(async (signal) => {
        if (!hasSessionUser) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (!isSuperAdmin) {
                if (isBranchAdmin) {
                    if (!userBranchId) throw new Error("Your account is not assigned to a branch.");
                    params.set("branch_id", userBranchId);
                } else if (isAcademyAdmin) {
                    if (!userAcademyId) throw new Error("Your account is not assigned to an academy.");
                    params.set("academy_id", userAcademyId);
                } else {
                    if (userAcademyId) params.set("academy_id", userAcademyId);
                    if (userBranchId) params.set("branch_id", userBranchId);
                    if (!userAcademyId && !userBranchId) {
                        throw new Error("Your account does not have an academy or branch assignment.");
                    }
                }
            }
            Object.entries(applied).forEach(([key, value]) => {
                if (value.trim()) params.set(key, value.trim());
            });

            const res = await fetch(`/api/tournaments?${params.toString()}`, { signal });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch tournaments");
            setRows(json.data || []);
        } catch (err) {
            if (err.name !== "AbortError") setError(err.message);
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [applied, hasSessionUser, isSuperAdmin, isBranchAdmin, isAcademyAdmin, userAcademyId, userBranchId]);

    useEffect(() => {
        const controller = new AbortController();
        void Promise.resolve().then(() => load(controller.signal));
        return () => controller.abort();
    }, [load]);

    const remove = async (row) => {
        if (!window.confirm(`Delete tournament "${row.tournament_name}"?`)) return;
        setBusyId(row.id);
        setError(null);
        try {
            const res = await fetch(`/api/tournaments/${row.id}`, { method: "DELETE" });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete tournament");
            setRows((list) => list.filter((r) => r.id !== row.id));
        } catch (err) {
            setError(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
    const hasFilters = Object.values(filters).some(Boolean);

    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 d-flex flex-wrap justify-content-between align-items-center gap-3">
                        <div>
                            <Link href="tournament-management" className="btn btn-sm btn-outline-secondary mb-3">
                                <ArrowLeft size={16} className="me-2"/> Back to match management
                                </Link>
                            <h1 className="h4 mb-1">Tournaments</h1>
                            <p className="text-muted mb-0">Create tournaments and manage their dates, teams and fees.</p>
                        </div>
                        <Link href={`${BASE}/new`} className="btn btn-primary">
                            <Plus size={16} className="me-2" /> Add tournament
                        </Link>
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-3">
                        <div className="row g-3 align-items-end">
                            <div className="col-12 col-md-3">
                                <label htmlFor="f-name" className="form-label small text-muted mb-1">Name</label>
                                <div className="input-group">
                                    <span className="input-group-text"><Search size={14} /></span>
                                    <input
                                        id="f-name"
                                        className="form-control"
                                        value={filters.tournament_name}
                                        onChange={(e) => setFilter("tournament_name", e.target.value)}
                                        placeholder="Search by name"
                                    />
                                </div>
                            </div>
                            <div className="col-6 col-md-2">
                                <label htmlFor="f-code" className="form-label small text-muted mb-1">Code</label>
                                <input
                                    id="f-code"
                                    className="form-control"
                                    value={filters.tournament_code}
                                    onChange={(e) => setFilter("tournament_code", e.target.value)}
                                    placeholder="Code"
                                />
                            </div>
                            <div className="col-6 col-md-2">
                                <label htmlFor="f-type" className="form-label small text-muted mb-1">Format</label>
                                <select
                                    id="f-type"
                                    className="form-select"
                                    value={filters.tournament_type}
                                    onChange={(e) => setFilter("tournament_type", e.target.value)}
                                >
                                    <option value="">{matchTypesLoading ? "Loading formats..." : "All"}</option>
                                    {matchTypes.map((matchType) => (
                                        <option key={matchType.id} value={matchType.name}>{matchType.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-6 col-md-3">
                                <label htmlFor="f-status" className="form-label small text-muted mb-1">Status</label>
                                <select
                                    id="f-status"
                                    className="form-select"
                                    value={filters.status}
                                    onChange={(e) => setFilter("status", e.target.value)}
                                >
                                    <option value="">All</option>
                                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="col-6 col-md-2">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary w-100"
                                    disabled={!hasFilters}
                                    onClick={() => setFilters(EMPTY_FILTERS)}
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
                                        <th>Tournament</th>
                                        <th>Branch</th>
                                        <th>Format</th>
                                        <th>Dates</th>
                                        <th>Teams</th>
                                        <th>Fee</th>
                                        <th>Status</th>
                                        <th className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={8} className="text-center text-muted py-5">Loading tournaments...</td></tr>
                                    ) : rows.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="text-center text-muted py-5">
                                                {hasFilters
                                                    ? "No tournaments match these filters."
                                                    : "No tournaments yet. Add one to get started."}
                                            </td>
                                        </tr>
                                    ) : (
                                        rows.map((row) => (
                                            <tr key={row.id}>
                                                <td>
                                                    <div className="fw-semibold">{row.tournament_name}</div>
                                                    <div className="small text-muted">
                                                        {row.tournament_code}
                                                        {row.age_group ? ` - ${row.age_group}` : ""}
                                                        {row.category ? ` - ${row.category}` : ""}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div>{row.branch_name || "-"}</div>
                                                    {row.academy_name && <div className="small text-muted">{row.academy_name}</div>}
                                                </td>
                                                <td>{row.tournament_type}</td>
                                                <td className="small">
                                                    <div>{formatDate(row.start_date)}</div>
                                                    <div className="text-muted">to {formatDate(row.end_date)}</div>
                                                </td>
                                                <td>{row.max_teams ?? "No limit"}</td>
                                                <td>{formatFee(row.team_fee)}</td>
                                                <td>
                                                    <span className={`badge ${STATUS_BADGE[row.status] || "bg-secondary"}`}>{row.status}</span>
                                                </td>
                                                <td className="text-end">
                                                    <div className="d-inline-flex gap-2">
                                                        <Link
                                                            href={`${BASE}/${row.id}/edit`}
                                                            className="btn btn-sm btn-outline-primary"
                                                            aria-label={`Edit ${row.tournament_name}`}
                                                        >
                                                            <Pencil size={14} />
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-danger"
                                                            disabled={busyId === row.id}
                                                            onClick={() => remove(row)}
                                                            aria-label={`Delete ${row.tournament_name}`}
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
