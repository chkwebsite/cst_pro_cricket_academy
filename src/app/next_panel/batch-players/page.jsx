"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
    Users,
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
    UserCheck,
} from "lucide-react";
import { useUser } from "../components/UserContext";
import BatchNavigationTabs from "../components/BatchNavigationTabs";
import Pagination from "../components/Pagination";

const STATUS_BADGE = {
    Active: "bg-success-subtle text-success border border-success",
    Transferred: "bg-warning-subtle text-warning-emphasis border border-warning",
    Completed: "bg-info-subtle text-info border border-info",
    Left: "bg-secondary-subtle text-secondary border",
};

export default function BatchPlayersPage() {
    const { user } = useUser();
    const hasSessionUser = Boolean(user);
    const userAcademyId = user?.academy_id;
    const hasAssignedAcademy =
        userAcademyId !== null && userAcademyId !== undefined && userAcademyId !== "" && Number(userAcademyId) !== 0;

    // Filters
    const [search, setSearch] = useState("");
    const [batchId, setBatchId] = useState("");
    const [branchId, setBranchId] = useState("");
    const [programId, setProgramId] = useState("");
    const [status, setStatus] = useState("");

    // Data lists
    const [assignments, setAssignments] = useState([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const [batches, setBatches] = useState([]);
    const [branches, setBranches] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [batchesCount, setBatchesCount] = useState(0);
    const [coachesCount, setCoachesCount] = useState(0);

    // UI state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    // Load filter dropdowns
    useEffect(() => {
        if (!hasSessionUser) return;

        let cancelled = false;
        (async () => {
            try {
                const branchQuery = hasAssignedAcademy ? `?academy_id=${userAcademyId}` : "";
                const [batchRes, brRes, prRes, coachRes] = await Promise.all([
                    fetch("/api/batches?status=1"),
                    fetch(`/api/branch${branchQuery}`),
                    fetch("/api/programs"),
                    fetch("/api/batch-coaches?status=1"),
                ]);

                const [batchJson, brJson, prJson, coachJson] = await Promise.all([
                    batchRes.json(),
                    brRes.json(),
                    prRes.json(),
                    coachRes.json(),
                ]);

                if (!cancelled) {
                    if (batchRes.ok && batchJson.success) {
                        setBatches(batchJson.data || []);
                        setBatchesCount(batchJson.total || 0);
                    }
                    if (brRes.ok && brJson.success) setBranches(brJson.data || []);
                    if (prRes.ok && prJson.success) setPrograms(prJson.data || []);
                    if (coachRes.ok && coachJson.success) setCoachesCount(coachJson.total || 0);
                }
            } catch (err) {
                console.error("Filter lookups error:", err);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [hasSessionUser, hasAssignedAcademy, userAcademyId]);

    // Load assignments
    const loadAssignments = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (hasAssignedAcademy) params.set("academy_id", String(userAcademyId));
            if (batchId) params.set("batch_id", batchId);
            if (branchId) params.set("branch_id", branchId);
            if (programId) params.set("program_id", programId);
            if (status) params.set("status", status);
            if (search.trim()) params.set("search", search.trim());

            const res = await fetch(`/api/batch-players?${params.toString()}`);
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to load batch players.");
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
    }, [hasSessionUser, batchId, branchId, programId, status]);

    useEffect(() => {
        setPage(1);
    }, [search, batchId, branchId, programId, status]);

    const totalPages = Math.ceil(assignments.length / PAGE_SIZE) || 1;
    const pagedAssignments = assignments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadAssignments();
    };

    const handleReset = () => {
        setSearch("");
        setBatchId("");
        setBranchId("");
        setProgramId("");
        setStatus("");
    };

    const handleDelete = async (item) => {
        if (!confirm(`Mark player "${item.first_name} ${item.last_name}" as Left from batch "${item.batch_name}"?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/batch-players?id=${item.id}`, {
                method: "DELETE",
            });
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to update player status.");
            }

            setNotice(`Player marked as Left successfully.`);
            loadAssignments();
        } catch (err) {
            setError(err.message);
        }
    };

    // Summary KPIs
    const stats = useMemo(() => {
        const total = assignments.length;
        const active = assignments.filter((a) => a.status === "Active").length;
        const transferred = assignments.filter((a) => a.status === "Transferred").length;
        const completed = assignments.filter((a) => a.status === "Completed").length;
        const left = assignments.filter((a) => a.status === "Left").length;
        return { total, active, transferred, completed, left };
    }, [assignments]);

    // Format 24hr time
    const formatTime = (timeStr) => {
        if (!timeStr) return "";
        const parts = timeStr.split(":");
        let hour = parseInt(parts[0], 10);
        const minute = parts[1] || "00";
        const ampm = hour >= 12 ? "PM" : "AM";
        hour = hour % 12 || 12;
        return `${hour}:${minute} ${ampm}`;
    };

    return (
        <div className="container-fluid py-4">
            {/* Unified Navigation Tabs */}
            <BatchNavigationTabs
                activeCount={batchesCount}
                coachesCount={coachesCount}
                playersCount={stats.active}
                actionButton={
                    <Link
                        href="/next_panel/batch-players/new"
                        className="btn btn-primary d-flex align-items-center gap-1 fw-semibold shadow-sm"
                    >
                        <Plus size={16} /> Assign Player
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
                            <div className="text-muted small fw-semibold text-uppercase">Total Player Records</div>
                            <div className="fs-4 fw-bold text-dark mt-1">{stats.total}</div>
                            <div className="small text-muted mt-1">{stats.active} Currently active in batches</div>
                        </div>
                    </div>
                </div>

                <div className="col-sm-6 col-xl-3">
                    <div className="card shadow-sm border-0 border-start border-success border-4 h-100">
                        <div className="card-body">
                            <div className="text-muted small fw-semibold text-uppercase">Active Enrolled</div>
                            <div className="fs-4 fw-bold text-success mt-1">{stats.active}</div>
                            <div className="small text-muted mt-1">Attending regular training sessions</div>
                        </div>
                    </div>
                </div>

                <div className="col-sm-6 col-xl-3">
                    <div className="card shadow-sm border-0 border-start border-warning border-4 h-100">
                        <div className="card-body">
                            <div className="text-muted small fw-semibold text-uppercase">Transferred / Completed</div>
                            <div className="fs-4 fw-bold text-warning-emphasis mt-1">
                                {stats.transferred + stats.completed}
                            </div>
                            <div className="small text-muted mt-1">
                                {stats.transferred} Transferred • {stats.completed} Graduated
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-sm-6 col-xl-3">
                    <div className="card shadow-sm border-0 border-start border-danger border-4 h-100">
                        <div className="card-body">
                            <div className="text-muted small fw-semibold text-uppercase">Withdrawn / Left</div>
                            <div className="fs-4 fw-bold text-danger mt-1">{stats.left}</div>
                            <div className="small text-muted mt-1">Vacated seats returned to batch</div>
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
                                    placeholder="Search player, admission no, batch..."
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
                                value={branchId}
                                onChange={(e) => setBranchId(e.target.value)}
                            >
                                <option value="">All Branches</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.branch_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-2">
                            <select
                                className="form-select form-select-sm"
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                            >
                                <option value="">All Statuses</option>
                                <option value="Active">Active</option>
                                <option value="Transferred">Transferred</option>
                                <option value="Completed">Completed</option>
                                <option value="Left">Left</option>
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
                            <div className="text-muted mt-2 small">Loading player batch assignments...</div>
                        </div>
                    ) : assignments.length === 0 ? (
                        <div className="text-center py-5">
                            <Users size={48} className="text-muted mb-2 opacity-50" />
                            <h6 className="fw-bold text-dark">No Batch Players Found</h6>
                            <p className="text-muted small mb-3">
                                No player assignments matched your filter criteria.
                            </p>
                            <Link href="/next_panel/batch-players/new" className="btn btn-sm btn-primary">
                                Assign Player to Batch
                            </Link>
                        </div>
                    ) : (
                        <>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th style={{ width: "40px" }} className="text-center">#</th>
                                        <th>Player Details</th>
                                        <th>Training Batch</th>
                                        <th>Program & Branch</th>
                                        <th>Period</th>
                                        <th style={{ width: "100px" }} className="text-center">Status</th>
                                        <th style={{ width: "100px" }} className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedAssignments.map((item, index) => (
                                        <tr key={item.id}>
                                            <td className="text-center text-muted small">{(page - 1) * PAGE_SIZE + index + 1}</td>
                                            <td>
                                                <div className="fw-bold text-dark">
                                                    {item.first_name} {item.last_name}
                                                </div>
                                                <div className="d-flex align-items-center gap-2 mt-1 small">
                                                    <span className="badge bg-secondary-subtle text-secondary font-monospace" style={{ fontSize: "0.72rem" }}>
                                                        {item.admission_no}
                                                    </span>
                                                    {item.phone && (
                                                        <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                                                            • {item.phone}
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
                                                    {item.batch_code} • {formatTime(item.start_time)} – {formatTime(item.end_time)}
                                                </div>
                                            </td>

                                            <td>
                                                <span className="badge bg-primary-subtle text-primary border border-primary d-inline-block mb-1">
                                                    {item.program_name}
                                                </span>
                                                <div className="small text-muted" style={{ fontSize: "0.74rem" }}>
                                                    {item.branch_code}
                                                </div>
                                            </td>

                                            <td className="small text-muted">
                                                {String(item.start_date).slice(0, 10)}
                                                {item.end_date ? ` to ${String(item.end_date).slice(0, 10)}` : " – Present"}
                                            </td>

                                            <td className="text-center">
                                                <span className={`badge ${STATUS_BADGE[item.status] || "bg-secondary text-white"}`}>
                                                    {item.status}
                                                </span>
                                            </td>

                                            <td className="text-end">
                                                <div className="d-inline-flex gap-1">
                                                    <Link
                                                        href={`/next_panel/batch-players/${item.id}/edit`}
                                                        className="btn btn-sm btn-outline-primary p-1"
                                                        title="Edit Assignment / Transfer"
                                                    >
                                                        <Edit size={14} />
                                                    </Link>
                                                    {item.status === "Active" && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(item)}
                                                            className="btn btn-sm btn-outline-danger p-1"
                                                            title="Mark as Left"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
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
