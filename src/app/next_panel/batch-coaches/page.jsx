"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
    UserCheck,
    Plus,
    Search,
    RefreshCw,
    Edit,
    Trash2,
    Clock,
    Phone,
    Mail,
    CheckCircle2,
    AlertCircle,
    Layers,
    Users,
} from "lucide-react";
import { useUser } from "../components/UserContext";
import BatchNavigationTabs from "../components/BatchNavigationTabs";
import Pagination from "../components/Pagination";

const ROLE_BADGE = {
    "Head Coach": "bg-primary text-white",
    "Assistant Coach": "bg-info text-white",
    "Fitness Coach": "bg-success text-white",
    "Specialist Coach": "bg-warning text-dark",
};

export default function BatchCoachesPage() {
    const { user } = useUser();
    const hasSessionUser = Boolean(user);
    const userAcademyId = user?.academy_id;
    const hasAssignedAcademy =
        userAcademyId !== null && userAcademyId !== undefined && userAcademyId !== "" && Number(userAcademyId) !== 0;

    // Filters
    const [search, setSearch] = useState("");
    const [batchId, setBatchId] = useState("");
    const [coachRole, setCoachRole] = useState("");
    const [status, setStatus] = useState("");

    // Data lists
    const [assignments, setAssignments] = useState([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const [batches, setBatches] = useState([]);
    const [batchesCount, setBatchesCount] = useState(0);
    const [playersCount, setPlayersCount] = useState(0);

    // UI state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    // Load Batches for filter dropdown and count
    useEffect(() => {
        if (!hasSessionUser) return;

        let cancelled = false;
        (async () => {
            try {
                const params = new URLSearchParams();
                if (hasAssignedAcademy) params.set("academy_id", String(userAcademyId));

                const [batchRes, plRes] = await Promise.all([
                    fetch(`/api/batches?${params.toString()}`),
                    fetch("/api/batch-players?status=Active"),
                ]);

                const [batchJson, plJson] = await Promise.all([
                    batchRes.json(),
                    plRes.json(),
                ]);

                if (!cancelled) {
                    if (batchRes.ok && batchJson.success) {
                        setBatches(batchJson.data || []);
                        setBatchesCount(batchJson.total || 0);
                    }
                    if (plRes.ok && plJson.success) {
                        setPlayersCount(plJson.total || 0);
                    }
                }
            } catch (err) {
                console.error("Lookup error:", err);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [hasSessionUser, hasAssignedAcademy, userAcademyId]);

    // Load coach assignments
    const loadAssignments = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (hasAssignedAcademy) params.set("academy_id", String(userAcademyId));
            if (batchId) params.set("batch_id", batchId);
            if (coachRole) params.set("coach_role", coachRole);
            if (status !== "") params.set("status", status);
            if (search.trim()) params.set("search", search.trim());

            const res = await fetch(`/api/batch-coaches?${params.toString()}`);
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to load coach assignments.");
            }

            setAssignments(json.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!hasSessionUser) return;
        loadAssignments();
    }, [hasSessionUser, batchId, coachRole, status]);

    useEffect(() => {
        setPage(1);
    }, [search, batchId, coachRole, status]);

    const totalPages = Math.ceil(assignments.length / PAGE_SIZE) || 1;
    const pagedAssignments = assignments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadAssignments();
    };

    const handleReset = () => {
        setSearch("");
        setBatchId("");
        setCoachRole("");
        setStatus("");
    };

    const handleDelete = async (item) => {
        if (!confirm(`Are you sure you want to remove coach "${item.coach_first_name} ${item.coach_last_name}" from "${item.batch_name}"?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/batch-coaches?id=${item.id}`, {
                method: "DELETE",
            });
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to delete coach assignment.");
            }

            setNotice("Coach assignment removed successfully.");
            loadAssignments();
        } catch (err) {
            setError(err.message);
        }
    };

    // Summary KPIs
    const stats = useMemo(() => {
        const total = assignments.length;
        const active = assignments.filter((a) => Number(a.status) === 1).length;
        const headCoaches = assignments.filter((a) => a.coach_role === "Head Coach" && Number(a.status) === 1).length;
        const specialists = assignments.filter((a) => a.coach_role !== "Head Coach" && Number(a.status) === 1).length;
        return { total, active, headCoaches, specialists };
    }, [assignments]);

    return (
        <div className="container-fluid py-4">
            {/* Unified Navigation Tabs */}
            <BatchNavigationTabs
                activeCount={batchesCount}
                coachesCount={stats.active}
                playersCount={playersCount}
                actionButton={
                    <Link
                        href="/next_panel/batch-coaches/new"
                        className="btn btn-primary d-flex align-items-center gap-1 fw-semibold shadow-sm"
                    >
                        <Plus size={16} /> Assign Coach
                    </Link>
                }
            />

            {/* Notifications */}
            {notice && (
                <div className="alert alert-success alert-dismissible fade show d-flex align-items-center gap-2" role="alert">
                    <CheckCircle2 size={18} />
                    <div>{notice}</div>
                    <button type="button" className="btn-close ms-auto" onClick={() => setNotice(null)} />
                </div>
            )}
            {error && (
                <div className="alert alert-danger alert-dismissible fade show d-flex align-items-center gap-2" role="alert">
                    <AlertCircle size={18} />
                    <div>{error}</div>
                    <button type="button" className="btn-close ms-auto" onClick={() => setError(null)} />
                </div>
            )}

            {/* KPI Cards */}
            <div className="row g-3 mb-4">
                <div className="col-sm-6 col-xl-3">
                    <div className="card shadow-sm border-0 border-start border-primary border-4 h-100">
                        <div className="card-body">
                            <div className="text-muted small fw-semibold text-uppercase">Total Coach Assignments</div>
                            <div className="fs-4 fw-bold text-dark mt-1">{stats.total}</div>
                            <div className="small text-muted mt-1">{stats.active} Currently active</div>
                        </div>
                    </div>
                </div>

                <div className="col-sm-6 col-xl-3">
                    <div className="card shadow-sm border-0 border-start border-success border-4 h-100">
                        <div className="card-body">
                            <div className="text-muted small fw-semibold text-uppercase">Head Coaches</div>
                            <div className="fs-4 fw-bold text-success mt-1">{stats.headCoaches}</div>
                            <div className="small text-muted mt-1">Leading training batches</div>
                        </div>
                    </div>
                </div>

                <div className="col-sm-6 col-xl-3">
                    <div className="card shadow-sm border-0 border-start border-warning border-4 h-100">
                        <div className="card-body">
                            <div className="text-muted small fw-semibold text-uppercase">Assistants & Specialists</div>
                            <div className="fs-4 fw-bold text-warning-emphasis mt-1">{stats.specialists}</div>
                            <div className="small text-muted mt-1">Fitness, bowling, batting specialists</div>
                        </div>
                    </div>
                </div>

                <div className="col-sm-6 col-xl-3">
                    <div className="card shadow-sm border-0 border-start border-info border-4 h-100">
                        <div className="card-body">
                            <div className="text-muted small fw-semibold text-uppercase">Batches Covered</div>
                            <div className="fs-4 fw-bold text-info mt-1">{batchesCount}</div>
                            <div className="small text-muted mt-1">
                                <Link href="/next_panel/batches" className="text-decoration-none">
                                    View all batches &rarr;
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="card shadow-sm border-0 mb-4">
                <div className="card-body p-3">
                    <div className="row g-2 align-items-center">
                        <div className="col-md-3">
                            <form onSubmit={handleSearchSubmit} className="input-group input-group-sm">
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Search coach, batch, email..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                <button type="submit" className="btn btn-primary">
                                    <Search size={14} />
                                </button>
                            </form>
                        </div>

                        <div className="col-md-3">
                            <select
                                className="form-select form-select-sm"
                                value={batchId}
                                onChange={(e) => setBatchId(e.target.value)}
                            >
                                <option value="">All Batches</option>
                                {batches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.batch_name} ({b.batch_code})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-2">
                            <select
                                className="form-select form-select-sm"
                                value={coachRole}
                                onChange={(e) => setCoachRole(e.target.value)}
                            >
                                <option value="">All Roles</option>
                                <option value="Head Coach">Head Coach</option>
                                <option value="Assistant Coach">Assistant Coach</option>
                                <option value="Fitness Coach">Fitness Coach</option>
                                <option value="Specialist Coach">Specialist Coach</option>
                            </select>
                        </div>

                        <div className="col-md-2">
                            <select
                                className="form-select form-select-sm"
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                            >
                                <option value="">All Statuses</option>
                                <option value="1">Active</option>
                                <option value="0">Inactive</option>
                            </select>
                        </div>

                        <div className="col-auto ms-auto">
                            <button
                                type="button"
                                onClick={handleReset}
                                className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                                title="Reset filters"
                            >
                                <RefreshCw size={13} /> Reset
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Assignments Table */}
            <div className="card shadow-sm border-0">
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status" />
                            <div className="text-muted mt-2 small">Loading coach assignments...</div>
                        </div>
                    ) : assignments.length === 0 ? (
                        <div className="text-center py-5">
                            <UserCheck size={48} className="text-muted mb-2 opacity-50" />
                            <h6 className="fw-bold text-dark">No Coach Assignments Found</h6>
                            <p className="text-muted small mb-3">
                                No coach assignments matched your filter criteria.
                            </p>
                            <Link href="/next_panel/batch-coaches/new" className="btn btn-sm btn-primary">
                                Assign Coach to Batch
                            </Link>
                        </div>
                    ) : (
                        <>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th style={{ width: "40px" }} className="text-center">#</th>
                                        <th>Coach Details</th>
                                        <th>Training Batch</th>
                                        <th>Role</th>
                                        <th>Period</th>
                                        <th style={{ width: "90px" }} className="text-center">Status</th>
                                        <th style={{ width: "100px" }} className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedAssignments.map((item, index) => (
                                        <tr key={item.id}>
                                            <td className="text-center text-muted small">{(page - 1) * PAGE_SIZE + index + 1}</td>
                                            <td>
                                                <div className="fw-bold text-dark">
                                                    {item.coach_first_name} {item.coach_last_name}
                                                </div>
                                                <div className="d-flex align-items-center gap-2 mt-1 small">
                                                    <span className="badge bg-secondary-subtle text-secondary font-monospace" style={{ fontSize: "0.72rem" }}>
                                                        {item.appointment_no || `ID: ${item.coach_user_id}`}
                                                    </span>
                                                    {item.coach_phone && (
                                                        <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                                                            • {item.coach_phone}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td>
                                                <div className="fw-semibold text-dark">
                                                    <Link
                                                        href={`/next_panel/batches/${item.batch_id}`}
                                                        className="text-dark text-decoration-none hover-primary"
                                                    >
                                                        {item.batch_name}
                                                    </Link>
                                                </div>
                                                <div className="small text-muted font-monospace" style={{ fontSize: "0.72rem" }}>
                                                    {item.batch_code}
                                                </div>
                                            </td>

                                            <td>
                                                <span className={`badge ${ROLE_BADGE[item.coach_role] || "bg-primary text-white"}`}>
                                                    {item.coach_role}
                                                </span>
                                            </td>

                                            <td className="small text-muted">
                                                {String(item.start_date).slice(0, 10)}
                                                {item.end_date ? ` to ${String(item.end_date).slice(0, 10)}` : " – Present"}
                                            </td>

                                            <td className="text-center">
                                                {Number(item.status) === 1 ? (
                                                    <span className="badge bg-success-subtle text-success border border-success">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="badge bg-secondary-subtle text-secondary border">
                                                        Inactive
                                                    </span>
                                                )}
                                            </td>

                                            <td className="text-end">
                                                <div className="d-inline-flex gap-1">
                                                    <Link
                                                        href={`/next_panel/batch-coaches/${item.id}/edit`}
                                                        className="btn btn-sm btn-outline-primary p-1"
                                                        title="Edit Role / Dates"
                                                    >
                                                        <Edit size={14} />
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(item)}
                                                        className="btn btn-sm btn-outline-danger p-1"
                                                        title="Remove Coach"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-3 border-top">
                            <Pagination
                                page={page}
                                totalPages={totalPages}
                                total={assignments.length}
                                onPageChange={setPage}
                                pageSize={PAGE_SIZE}
                            />
                        </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
