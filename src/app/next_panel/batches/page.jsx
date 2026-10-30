"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
    Layers,
    Plus,
    Search,
    RefreshCw,
    Edit,
    Trash2,
    Eye,
    Clock,
    Calendar,
    Users,
    UserCheck,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Filter,
} from "lucide-react";
import { useUser } from "../components/UserContext";
import BatchNavigationTabs from "../components/BatchNavigationTabs";
import Pagination from "../components/Pagination";

export default function BatchesPage() {
    const { user } = useUser();
    const hasSessionUser = Boolean(user);
    const userAcademyId = user?.academy_id;
    const hasAssignedAcademy =
        userAcademyId !== null && userAcademyId !== undefined && userAcademyId !== "" && Number(userAcademyId) !== 0;

    // Filters
    const [search, setSearch] = useState("");
    const [branchId, setBranchId] = useState("");
    const [programId, setProgramId] = useState("");
    const [ageGroupId, setAgeGroupId] = useState("");
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    // Data lists
    const [batches, setBatches] = useState([]);
    const [branches, setBranches] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [ageGroups, setAgeGroups] = useState([]);

    // Counts for tabs
    const [coachesTotal, setCoachesTotal] = useState(0);
    const [playersTotal, setPlayersTotal] = useState(0);

    // UI state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    // Load filter options (branches, programs, age groups)
    useEffect(() => {
        if (!hasSessionUser) return;

        let cancelled = false;
        (async () => {
            try {
                const branchQuery = hasAssignedAcademy ? `?academy_id=${userAcademyId}` : "";
                const [brRes, prRes, agRes, coachRes, plRes] = await Promise.all([
                    fetch(`/api/branch${branchQuery}`),
                    fetch("/api/programs"),
                    fetch("/api/age-groups?status=1"),
                    fetch("/api/batch-coaches?status=1"),
                    fetch("/api/batch-players?status=Active"),
                ]);

                const [brJson, prJson, agJson, coachJson, plJson] = await Promise.all([
                    brRes.json(),
                    prRes.json(),
                    agRes.json(),
                    coachRes.json(),
                    plRes.json(),
                ]);

                if (!cancelled) {
                    if (brRes.ok && brJson.success) setBranches(brJson.data || []);
                    if (prRes.ok && prJson.success) setPrograms(prJson.data || []);
                    if (agRes.ok && agJson.success) setAgeGroups(agJson.data || []);
                    if (coachRes.ok && coachJson.success) setCoachesTotal(coachJson.total || 0);
                    if (plRes.ok && plJson.success) setPlayersTotal(plJson.total || 0);
                }
            } catch (err) {
                console.error("Filter options load error:", err);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [hasSessionUser, hasAssignedAcademy, userAcademyId]);

    // Load batches list
    const loadBatches = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (hasAssignedAcademy) params.set("academy_id", String(userAcademyId));
            if (branchId) params.set("branch_id", branchId);
            if (programId) params.set("program_id", programId);
            if (ageGroupId) params.set("age_group_id", ageGroupId);
            if (status !== "") params.set("status", status);
            if (search.trim()) params.set("search", search.trim());

            const res = await fetch(`/api/batches?${params.toString()}`);
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to load batches.");
            }

            setBatches(json.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!hasSessionUser) return;
        loadBatches();
    }, [hasSessionUser, branchId, programId, ageGroupId, status]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadBatches();
    };

    const handleReset = () => {
        setSearch("");
        setBranchId("");
        setProgramId("");
        setAgeGroupId("");
        setStatus("");
    };

    const handleDeleteBatch = async (batch) => {
        if (!confirm(`Are you sure you want to delete batch "${batch.batch_name}" (${batch.batch_code})?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/batches?id=${batch.id}`, {
                method: "DELETE",
            });
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to delete batch.");
            }

            setNotice(`Batch "${batch.batch_name}" deleted successfully.`);
            loadBatches();
        } catch (err) {
            setError(err.message);
        }
    };

    // KPI Metrics
    const stats = useMemo(() => {
        const total = batches.length;
        const active = batches.filter((b) => Number(b.status) === 1).length;
        const totalCapacity = batches.reduce((sum, b) => sum + (Number(b.max_players) || 0), 0);
        return { total, active, totalCapacity };
    }, [batches]);

    const totalPages = Math.ceil(batches.length / PAGE_SIZE) || 1;
    const pagedBatches = batches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // Format 24hr time to 12hr AM/PM
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
            {/* Navigation Tabs across Batches, Batch Coaches & Batch Players */}
            <BatchNavigationTabs
                activeCount={stats.active}
                coachesCount={coachesTotal}
                playersCount={playersTotal}
                actionButton={
                    <Link
                        href="/next_panel/batches/new"
                        className="btn btn-primary d-flex align-items-center gap-1 fw-semibold shadow-sm"
                    >
                        <Plus size={16} /> Create Batch
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

            {/* KPI Cards Row */}
            <div className="row g-3 mb-4">
                <div className="col-sm-6 col-xl-3">
                    <div className="card shadow-sm border-0 border-start border-primary border-4 h-100">
                        <div className="card-body">
                            <div className="text-muted small fw-semibold text-uppercase">Total Batches</div>
                            <div className="fs-4 fw-bold text-dark mt-1">{stats.total}</div>
                            <div className="small text-muted mt-1">{stats.active} Active batches</div>
                        </div>
                    </div>
                </div>

                <div className="col-sm-6 col-xl-3">
                    <div className="card shadow-sm border-0 border-start border-success border-4 h-100">
                        <div className="card-body">
                            <div className="text-muted small fw-semibold text-uppercase">Total Training Seats</div>
                            <div className="fs-4 fw-bold text-success mt-1">{stats.totalCapacity}</div>
                            <div className="small text-muted mt-1">Across all active batches</div>
                        </div>
                    </div>
                </div>

                <div className="col-sm-6 col-xl-3">
                    <div className="card shadow-sm border-0 border-start border-info border-4 h-100">
                        <div className="card-body">
                            <div className="text-muted small fw-semibold text-uppercase">Assigned Coaches</div>
                            <div className="fs-4 fw-bold text-info mt-1">{coachesTotal}</div>
                            <div className="small text-muted mt-1">
                                <Link href="/next_panel/batch-coaches" className="text-decoration-none">
                                    Manage coaches &rarr;
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-sm-6 col-xl-3">
                    <div className="card shadow-sm border-0 border-start border-warning border-4 h-100">
                        <div className="card-body">
                            <div className="text-muted small fw-semibold text-uppercase">Assigned Players</div>
                            <div className="fs-4 fw-bold text-warning-emphasis mt-1">{playersTotal}</div>
                            <div className="small text-muted mt-1">
                                <Link href="/next_panel/batch-players" className="text-decoration-none">
                                    View rosters &rarr;
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters Toolbar */}
            <div className="card shadow-sm border-0 mb-4">
                <div className="card-body p-3">
                    <div className="row g-2 align-items-center">
                        <div className="col-md-3">
                            <form onSubmit={handleSearchSubmit} className="input-group input-group-sm">
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Search batch name or code..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                <button type="submit" className="btn btn-primary">
                                    <Search size={14} />
                                </button>
                            </form>
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
                                value={programId}
                                onChange={(e) => setProgramId(e.target.value)}
                            >
                                <option value="">All Programs</option>
                                {programs.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.program_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-2">
                            <select
                                className="form-select form-select-sm"
                                value={ageGroupId}
                                onChange={(e) => setAgeGroupId(e.target.value)}
                            >
                                <option value="">All Age Groups</option>
                                {ageGroups.map((ag) => (
                                    <option key={ag.id} value={ag.id}>
                                        {ag.age_group}
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

            {/* Batches Table Card */}
            <div className="card shadow-sm border-0">
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status" />
                            <div className="text-muted mt-2 small">Loading training batches...</div>
                        </div>
                    ) : batches.length === 0 ? (
                        <div className="text-center py-5">
                            <Layers size={48} className="text-muted mb-2 opacity-50" />
                            <h6 className="fw-bold text-dark">No Batches Found</h6>
                            <p className="text-muted small mb-3">
                                No cricket training batches matched your search/filter criteria.
                            </p>
                            <Link href="/next_panel/batches/new" className="btn btn-sm btn-primary">
                                Create First Batch
                            </Link>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th style={{ width: "40px" }} className="text-center">#</th>
                                        <th style={{ minWidth: "200px" }}>Batch Details</th>
                                        <th style={{ minWidth: "150px" }}>Program & Age</th>
                                        <th style={{ minWidth: "160px" }}>Schedule & Days</th>
                                        <th style={{ minWidth: "130px" }}>Branch</th>
                                        <th style={{ width: "100px" }} className="text-center">Capacity</th>
                                        <th style={{ width: "90px" }} className="text-center">Status</th>
                                        <th style={{ width: "150px" }} className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedBatches.map((batch, index) => {
                                        const days = batch.training_days
                                            ? (Array.isArray(batch.training_days)
                                                  ? batch.training_days
                                                  : String(batch.training_days).split(","))
                                            : [];

                                        return (
                                            <tr key={batch.id}>
                                                <td className="text-center text-muted small">{(page - 1) * PAGE_SIZE + index + 1}</td>
                                                <td>
                                                    <div className="fw-bold text-dark">
                                                        <Link
                                                            href={`/next_panel/batches/${batch.id}`}
                                                            className="text-dark text-decoration-none hover-primary"
                                                        >
                                                            {batch.batch_name}
                                                        </Link>
                                                    </div>
                                                    <div className="mt-1 d-flex align-items-center gap-1">
                                                        <span className="badge bg-secondary-subtle text-secondary font-monospace" style={{ fontSize: "0.72rem" }}>
                                                            {batch.batch_code}
                                                        </span>
                                                        {batch.remarks && (
                                                            <span className="text-muted small text-truncate d-inline-block" style={{ maxWidth: "180px", fontSize: "0.72rem" }}>
                                                                • {batch.remarks}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                <td>
                                                    <span className="badge bg-primary-subtle text-primary border border-primary d-inline-block mb-1">
                                                        {batch.program_name}
                                                    </span>
                                                    <div className="small text-muted" style={{ fontSize: "0.75rem" }}>
                                                        Age: <strong className="text-dark">{batch.age_group_name || batch.age_group}</strong>
                                                    </div>
                                                </td>

                                                <td>
                                                    <div className="d-flex align-items-center gap-1 text-dark small fw-semibold">
                                                        <Clock size={13} className="text-primary" />
                                                        <span>
                                                            {formatTime(batch.start_time)} – {formatTime(batch.end_time)}
                                                        </span>
                                                    </div>
                                                    <div className="d-flex flex-wrap gap-1 mt-1">
                                                        {days.map((d) => (
                                                            <span
                                                                key={d}
                                                                className="badge bg-light text-secondary border px-1"
                                                                style={{ fontSize: "0.68rem" }}
                                                            >
                                                                {d.slice(0, 3)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>

                                                <td>
                                                    <div className="small fw-semibold text-dark">{batch.branch_code}</div>
                                                    <div className="text-muted small" style={{ fontSize: "0.72rem" }}>
                                                        {batch.academy_name}
                                                    </div>
                                                </td>

                                                <td className="text-center">
                                                    <span className="badge bg-info-subtle text-info border border-info fw-bold px-2 py-1">
                                                        {batch.max_players} Seats
                                                    </span>
                                                </td>

                                                <td className="text-center">
                                                    {Number(batch.status) === 1 ? (
                                                        <span className="badge bg-success-subtle text-success border border-success">
                                                            Active
                                                        </span>
                                                    ) : (
                                                        <span className="badge bg-secondary-subtle text-secondary border border-secondary">
                                                            Inactive
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="text-end">
                                                    <div className="d-inline-flex align-items-center gap-1">
                                                        <Link
                                                            href={`/next_panel/batches/${batch.id}`}
                                                            className="btn btn-sm btn-outline-info p-1"
                                                            title="View Roster & Hub"
                                                        >
                                                            <Eye size={14} />
                                                        </Link>
                                                        <Link
                                                            href={`/next_panel/batches/${batch.id}/edit`}
                                                            className="btn btn-sm btn-outline-primary p-1"
                                                            title="Edit Batch"
                                                        >
                                                            <Edit size={14} />
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteBatch(batch)}
                                                            className="btn btn-sm btn-outline-danger p-1"
                                                            title="Delete Batch"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {!loading && batches.length > 0 && (
                        <div className="mt-3">
                            <Pagination
                                page={page}
                                totalPages={totalPages}
                                total={batches.length}
                                onPageChange={setPage}
                                pageSize={PAGE_SIZE}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
