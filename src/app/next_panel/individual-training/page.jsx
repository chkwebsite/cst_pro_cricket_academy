"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
    Activity,
    Plus,
    Search,
    RefreshCw,
    Edit,
    Trash2,
    Clock,
    Calendar,
    Phone,
    UserCheck,
    Users,
    CheckCircle2,
    AlertCircle,
    Eye,
    Shield,
    Sparkles,
    SlidersHorizontal,
    Award,
} from "lucide-react";
import { useUser } from "../components/UserContext";

const STATUS_BADGE = {
    Active: "bg-success-subtle text-success border border-success",
    Scheduled: "bg-primary-subtle text-primary border border-primary",
    "On Hold": "bg-warning-subtle text-warning-emphasis border border-warning",
    Completed: "bg-info-subtle text-info border border-info",
    Cancelled: "bg-secondary-subtle text-secondary border",
};

const DAY_ABBR = {
    Monday: "Mon",
    Tuesday: "Tue",
    Wednesday: "Wed",
    Thursday: "Thu",
    Friday: "Fri",
    Saturday: "Sat",
    Sunday: "Sun",
};

export default function IndividualTrainingPage() {
    const { user } = useUser();
    const hasSessionUser = Boolean(user);
    const userAcademyId = user?.academy_id;
    const hasAssignedAcademy =
        userAcademyId !== null && userAcademyId !== undefined && userAcademyId !== "" && Number(userAcademyId) !== 0;

    // Filter states
    const [search, setSearch] = useState("");
    const [branchId, setBranchId] = useState("");
    const [coachId, setCoachId] = useState("");
    const [trainingDay, setTrainingDay] = useState("");
    const [status, setStatus] = useState("");

    // Data lists
    const [trainings, setTrainings] = useState([]);
    const [branches, setBranches] = useState([]);
    const [coaches, setCoaches] = useState([]);

    // UI states
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    // Load filter dropdowns
    useEffect(() => {
        if (!hasSessionUser) return;

        let cancelled = false;
        (async () => {
            try {
                const branchQuery = hasAssignedAcademy ? `?academy_id=${userAcademyId}` : "";
                const [brRes, coachRes, userRolesRes] = await Promise.all([
                    fetch(`/api/branch${branchQuery}`),
                    fetch("/api/users?status=1"),
                    fetch("/api/user-roles?role_id=5&limit=1000"),
                ]);

                const [brJson, coachJson, userRolesJson] = await Promise.all([
                    brRes.json().catch(() => ({})),
                    coachRes.json().catch(() => ({})),
                    userRolesRes.json().catch(() => ({})),
                ]);

                if (!cancelled) {
                    if (brRes.ok && brJson.success) setBranches(brJson.data || []);

                    // Extract user IDs that have role_id = 5 from /api/user-roles
                    const role5UserIds = new Set(
                        (userRolesJson?.data || [])
                            .filter((ur) => Number(ur.role_id) === 5)
                            .map((ur) => Number(ur.user_id))
                    );

                    // Filter users whose user_type is 'Coach' OR who have role_id = 5 in user-roles
                    const allUsers = (coachRes.ok && coachJson.success && Array.isArray(coachJson.data))
                        ? coachJson.data
                        : [];

                    const coachList = allUsers.filter((u) => {
                        const isCoachType = String(u.user_type || "").trim().toLowerCase() === "coach";
                        const hasRole5 = role5UserIds.has(Number(u.id));
                        return isCoachType || hasRole5;
                    });

                    // Ensure any user from user-roles (role_id=5) is included if missing
                    const existingCoachIds = new Set(coachList.map((c) => Number(c.id)));
                    (userRolesJson?.data || []).forEach((ur) => {
                        if (Number(ur.role_id) === 5 && ur.user_id && !existingCoachIds.has(Number(ur.user_id))) {
                            existingCoachIds.add(Number(ur.user_id));
                            coachList.push({
                                id: ur.user_id,
                                first_name: ur.first_name,
                                last_name: ur.last_name,
                                email: ur.email,
                                user_type: "Coach",
                                role_id: 5,
                            });
                        }
                    });

                    setCoaches(coachList);
                }
            } catch (err) {
                console.error("Lookups load error:", err);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [hasSessionUser, hasAssignedAcademy, userAcademyId]);

    // Fetch individual training records
    const loadTrainings = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (hasAssignedAcademy) params.set("academy_id", String(userAcademyId));
            if (branchId) params.set("branch_id", branchId);
            if (coachId) params.set("coach_user_id", coachId);
            if (trainingDay) params.set("training_day", trainingDay);
            if (status) params.set("status", status);
            if (search.trim()) params.set("search", search.trim());

            const res = await fetch(`/api/individual-training?${params.toString()}`);
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to load individual training records.");
            }

            setTrainings(json.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!hasSessionUser) return;
        loadTrainings();
    }, [hasSessionUser, branchId, coachId, trainingDay, status]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadTrainings();
    };

    const handleReset = () => {
        setSearch("");
        setBranchId("");
        setCoachId("");
        setTrainingDay("");
        setStatus("");
    };

    const handleDelete = async (item) => {
        const playerName = `${item.player_first_name || ""} ${item.player_last_name || ""}`.trim() || `Player #${item.user_program_id}`;
        if (!confirm(`Are you sure you want to delete the 1:1 training session for "${playerName}"?`)) {
            return;
        }

        setDeletingId(item.id);
        try {
            const res = await fetch(`/api/individual-training/${item.id}`, {
                method: "DELETE",
            });
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to delete training record.");
            }

            setNotice(`Training session #${item.id} deleted successfully.`);
            loadTrainings();
        } catch (err) {
            setError(err.message);
        } finally {
            setDeletingId(null);
        }
    };

    // Summary statistics
    const stats = useMemo(() => {
        const total = trainings.length;
        const active = trainings.filter((t) => t.status === "Active").length;
        const scheduled = trainings.filter((t) => t.status === "Scheduled").length;
        const onHold = trainings.filter((t) => t.status === "On Hold").length;
        const completed = trainings.filter((t) => t.status === "Completed").length;
        const cancelled = trainings.filter((t) => t.status === "Cancelled").length;
        return { total, active, scheduled, onHold, completed, cancelled };
    }, [trainings]);

    // Format 24hr time string to 12hr AM/PM
    const formatTime = (timeStr) => {
        if (!timeStr) return "";
        const parts = String(timeStr).split(":");
        let hour = parseInt(parts[0], 10);
        const minute = parts[1] || "00";
        const ampm = hour >= 12 ? "PM" : "AM";
        hour = hour % 12 || 12;
        return `${hour}:${minute} ${ampm}`;
    };

    const parseDaysList = (daysStr) => {
        if (!daysStr) return [];
        if (Array.isArray(daysStr)) return daysStr;
        return String(daysStr).split(",").map((d) => d.trim()).filter(Boolean);
    };

    return (
        <div className="container-fluid py-4">
            {/* Header */}
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
                <div>
                    <h4 className="fw-bold mb-1 text-dark d-flex align-items-center gap-2">
                        <Activity className="text-primary" size={26} /> Individual Training (1:1 Sessions)
                    </h4>
                    <p className="text-muted small mb-0">
                        Manage dedicated personal cricket training, coach schedules, session slots, and player progression.
                    </p>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <button
                        onClick={loadTrainings}
                        className="btn btn-outline-secondary d-flex align-items-center gap-1 shadow-sm"
                        disabled={loading}
                        title="Refresh training list"
                    >
                        <RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh
                    </button>
                    <Link
                        href="/next_panel/individual-training/new"
                        className="btn btn-primary d-flex align-items-center gap-1 fw-semibold shadow-sm"
                    >
                        <Plus size={16} /> Schedule 1:1 Session
                    </Link>
                </div>
            </div>

            {/* Auto-Sync Information Banner */}
            <div className="alert alert-info border-0 shadow-sm d-flex align-items-start gap-3 py-3 mb-4">
                <Sparkles className="text-info mt-1 flex-shrink-0" size={20} />
                <div className="small">
                    <strong>Auto-Synchronization Flow:</strong> When a player is enrolled with the{" "}
                    <span className="badge bg-primary text-white">One-on-One (1:1)</span> program in{" "}
                    <Link href="/next_panel/admission-players" className="alert-link text-decoration-underline">
                        Admission Players
                    </Link>{" "}
                    or{" "}
                    <Link href="/next_panel/batch-players" className="alert-link text-decoration-underline">
                        Batch Players
                    </Link>
                    , an individual training record is automatically provisioned and linked with an assigned personal coach.
                </div>
            </div>

            {/* KPI Cards */}
            <div className="row g-3 mb-4">
                <div className="col-sm-6 col-lg-3">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small text-uppercase fw-semibold">Total Sessions</div>
                                <div className="h3 fw-bold mb-0 mt-1">{stats.total}</div>
                                <small className="text-muted">{trainings.length} tracked records</small>
                            </div>
                            <div className="p-3 bg-primary-subtle text-primary rounded-3">
                                <Activity size={24} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-sm-6 col-lg-3">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small text-uppercase fw-semibold">Active 1:1</div>
                                <div className="h3 fw-bold mb-0 mt-1 text-success">{stats.active}</div>
                                <small className="text-success fw-medium">Currently training</small>
                            </div>
                            <div className="p-3 bg-success-subtle text-success rounded-3">
                                <CheckCircle2 size={24} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-sm-6 col-lg-3">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small text-uppercase fw-semibold">Scheduled</div>
                                <div className="h3 fw-bold mb-0 mt-1 text-primary">{stats.scheduled}</div>
                                <small className="text-muted">Upcoming start</small>
                            </div>
                            <div className="p-3 bg-info-subtle text-info rounded-3">
                                <Calendar size={24} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-sm-6 col-lg-3">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small text-uppercase fw-semibold">On Hold / Done</div>
                                <div className="h3 fw-bold mb-0 mt-1 text-secondary">
                                    {stats.onHold + stats.completed}
                                </div>
                                <small className="text-muted">
                                    {stats.onHold} on hold, {stats.completed} completed
                                </small>
                            </div>
                            <div className="p-3 bg-warning-subtle text-warning-emphasis rounded-3">
                                <Clock size={24} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error / Notice Banners */}
            {error && (
                <div className="alert alert-danger alert-dismissible fade show d-flex align-items-center gap-2" role="alert">
                    <AlertCircle size={18} />
                    <div>{error}</div>
                    <button type="button" className="btn-close ms-auto" onClick={() => setError(null)} />
                </div>
            )}

            {notice && (
                <div className="alert alert-success alert-dismissible fade show d-flex align-items-center gap-2" role="alert">
                    <CheckCircle2 size={18} />
                    <div>{notice}</div>
                    <button type="button" className="btn-close ms-auto" onClick={() => setNotice(null)} />
                </div>
            )}

            {/* Filter Toolbar */}
            <div className="card border-0 shadow-sm mb-4">
                <div className="card-body p-3">
                    <form onSubmit={handleSearchSubmit}>
                        <div className="row g-2 align-items-center">
                            {/* Search */}
                            <div className="col-lg-3 col-md-6">
                                <div className="input-group">
                                    <span className="input-group-text bg-light border-end-0">
                                        <Search size={16} className="text-muted" />
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control bg-light border-start-0"
                                        placeholder="Player name, coach, adm no..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Branch */}
                            <div className="col-lg-2 col-md-3 col-sm-6">
                                <select
                                    className="form-select bg-light"
                                    value={branchId}
                                    onChange={(e) => setBranchId(e.target.value)}
                                >
                                    <option value="">All Branches</option>
                                    {branches.map((b) => (
                                        <option key={b.id} value={b.id}>
                                            {b.branch_name} ({b.branch_code})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Coach */}
                            <div className="col-lg-2 col-md-3 col-sm-6">
                                <select
                                    className="form-select bg-light"
                                    value={coachId}
                                    onChange={(e) => setCoachId(e.target.value)}
                                >
                                    <option value="">All Coaches</option>
                                    {coaches.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.first_name} {c.last_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Day of Week */}
                            <div className="col-lg-2 col-md-3 col-sm-6">
                                <select
                                    className="form-select bg-light"
                                    value={trainingDay}
                                    onChange={(e) => setTrainingDay(e.target.value)}
                                >
                                    <option value="">Any Training Day</option>
                                    {Object.keys(DAY_ABBR).map((d) => (
                                        <option key={d} value={d}>
                                            {d}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Status */}
                            <div className="col-lg-2 col-md-3 col-sm-6">
                                <select
                                    className="form-select bg-light"
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                >
                                    <option value="">All Statuses</option>
                                    <option value="Active">Active</option>
                                    <option value="Scheduled">Scheduled</option>
                                    <option value="On Hold">On Hold</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Cancelled">Cancelled</option>
                                </select>
                            </div>

                            {/* Buttons */}
                            <div className="col-lg-1 col-md-12 d-flex gap-2">
                                <button type="submit" className="btn btn-primary flex-fill" title="Apply Search">
                                    <Search size={16} />
                                </button>
                                {(search || branchId || coachId || trainingDay || status) && (
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        onClick={handleReset}
                                        title="Reset Filters"
                                    >
                                        <RefreshCw size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            {/* Data Table */}
            <div className="card border-0 shadow-sm">
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="table-light border-bottom text-muted small text-uppercase">
                                <tr>
                                    <th style={{ width: "60px" }} className="ps-3">ID</th>
                                    <th>Player Info</th>
                                    <th>Dedicated Coach</th>
                                    <th>Branch / Academy</th>
                                    <th>Weekly Days & Timing</th>
                                    <th>Schedule Duration</th>
                                    <th style={{ width: "110px" }}>Status</th>
                                    <th style={{ width: "130px" }} className="text-end pe-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="8" className="text-center py-5">
                                            <div className="spinner-border text-primary spinner-border-sm me-2" role="status" />
                                            <span className="text-muted">Loading individual training sessions...</span>
                                        </td>
                                    </tr>
                                ) : trainings.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="text-center py-5">
                                            <div className="text-muted mb-2">No individual training sessions found.</div>
                                            <Link
                                                href="/next_panel/individual-training/new"
                                                className="btn btn-sm btn-primary"
                                            >
                                                <Plus size={14} className="me-1" /> Schedule New Session
                                            </Link>
                                        </td>
                                    </tr>
                                ) : (
                                    trainings.map((item) => {
                                        const playerName =
                                            `${item.player_first_name || ""} ${item.player_last_name || ""}`.trim() ||
                                            `Player #${item.user_program_id}`;
                                        const coachName =
                                            `${item.coach_first_name || ""} ${item.coach_last_name || ""}`.trim() ||
                                            `Coach #${item.coach_user_id}`;
                                        const daysList = parseDaysList(item.training_days);

                                        return (
                                            <tr key={item.id}>
                                                <td className="ps-3 fw-bold text-muted small">#{item.id}</td>

                                                {/* Player */}
                                                <td>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div
                                                            className="rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center fw-bold"
                                                            style={{ width: "36px", height: "36px", fontSize: "14px" }}
                                                        >
                                                            {(item.player_first_name?.[0] || "P").toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="fw-semibold text-dark">
                                                                <Link
                                                                    href={`/next_panel/individual-training/${item.id}`}
                                                                    className="text-decoration-none text-dark hover-primary"
                                                                >
                                                                    {playerName}
                                                                </Link>
                                                            </div>
                                                            <div className="small text-muted d-flex align-items-center gap-2 flex-wrap">
                                                                <span className="badge bg-light text-secondary border">
                                                                    Adm: {item.admission_no || "N/A"}
                                                                </span>
                                                                {item.player_phone && (
                                                                    <span className="d-inline-flex align-items-center gap-1">
                                                                        <Phone size={12} /> {item.player_phone}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Coach */}
                                                <td>
                                                    <div className="fw-semibold text-dark d-flex align-items-center gap-1">
                                                        <UserCheck size={15} className="text-primary flex-shrink-0" />
                                                        <span>{coachName}</span>
                                                    </div>
                                                    <div className="small text-muted">
                                                        {item.coach_appointment_no ? `Appt: ${item.coach_appointment_no}` : `ID: ${item.coach_user_id}`}
                                                    </div>
                                                </td>

                                                {/* Branch */}
                                                <td>
                                                    <div className="fw-medium text-dark">{item.branch_code || `Branch #${item.branch_id}`}</div>
                                                    <div className="small text-muted">{item.academy_name || `Academy #${item.academy_id}`}</div>
                                                </td>

                                                {/* Timing & Days */}
                                                <td>
                                                    <div className="d-flex align-items-center gap-1 mb-1 flex-wrap">
                                                        {daysList.map((d) => (
                                                            <span
                                                                key={d}
                                                                className="badge bg-light text-dark border fw-medium"
                                                                style={{ fontSize: "11px" }}
                                                            >
                                                                {DAY_ABBR[d] || d}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <div className="small text-muted d-flex align-items-center gap-1">
                                                        <Clock size={13} className="text-secondary" />
                                                        <span>
                                                            {formatTime(item.start_time)} - {formatTime(item.end_time)}
                                                        </span>
                                                        <span className="badge bg-secondary-subtle text-secondary ms-1">
                                                            {item.session_duration}m
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Date Range */}
                                                <td>
                                                    <div className="small fw-medium text-dark">
                                                        {item.start_date ? String(item.start_date).slice(0, 10) : "Immediate"}
                                                    </div>
                                                    <div className="small text-muted">
                                                        to {item.end_date ? String(item.end_date).slice(0, 10) : "Ongoing"}
                                                    </div>
                                                </td>

                                                {/* Status */}
                                                <td>
                                                    <span className={`badge ${STATUS_BADGE[item.status] || "bg-secondary"}`}>
                                                        {item.status}
                                                    </span>
                                                </td>

                                                {/* Actions */}
                                                <td className="text-end pe-3">
                                                    <div className="d-flex align-items-center justify-content-end gap-1">
                                                        <Link
                                                            href={`/next_panel/individual-training/${item.id}`}
                                                            className="btn btn-sm btn-outline-info p-1 px-2"
                                                            title="View Session Details"
                                                        >
                                                            <Eye size={15} />
                                                        </Link>
                                                        <Link
                                                            href={`/next_panel/individual-training/${item.id}/edit`}
                                                            className="btn btn-sm btn-outline-primary p-1 px-2"
                                                            title="Edit Session"
                                                        >
                                                            <Edit size={15} />
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-danger p-1 px-2"
                                                            onClick={() => handleDelete(item)}
                                                            disabled={deletingId === item.id}
                                                            title="Delete Session"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="card-footer bg-white border-top py-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <small className="text-muted">
                        Showing <strong>{trainings.length}</strong> individual training session{trainings.length === 1 ? "" : "s"}
                    </small>
                    <div className="small text-muted">
                        Programs linked: <strong>One-on-One (1:1) Specialized Coaching</strong>
                    </div>
                </div>
            </div>
        </div>
    );
}
