"use client";

import {
    Briefcase,
    Building2,
    Calendar,
    CheckCircle2,
    Clock,
    Edit,
    Eye,
    GraduationCap,
    Mail,
    MapPin,
    Phone,
    Plus,
    RotateCcw,
    Search,
    Shield,
    Trash2,
    UserCheck,
    Users,
    X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "../components/UserContext";
import Pagination from "../components/Pagination";

const SPECIALIZATION_BADGES = {
    Batting: "bg-danger text-white",
    Bowling: "bg-primary text-white",
    Fielding: "bg-success text-white",
    "Wicket Keeping": "bg-warning text-dark",
    Fitness: "bg-info text-dark",
    "All Rounder": "bg-secondary text-white",
};

export default function CoachesPage() {
    const { user } = useUser();
    const [loading, setLoading] = useState(true);
    const [coaches, setCoaches] = useState([]);
    const [academies, setAcademies] = useState([]);
    const [branches, setBranches] = useState([]);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    // Filters
    const [search, setSearch] = useState("");
    const [academyFilter, setAcademyFilter] = useState("");
    const [branchFilter, setBranchFilter] = useState("");
    const [specializationFilter, setSpecializationFilter] = useState("");
    const [employmentTypeFilter, setEmploymentTypeFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    // Modal
    const [selectedCoach, setSelectedCoach] = useState(null);
    const [deleteConfirmCoach, setDeleteConfirmCoach] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const hasSessionUser = Boolean(user);
    const userAcademyId = user?.academy_id;
    const userBranchId = user?.branch_id;
    const isAcademyAdmin = user?.user_type === "Academy Admin";
    const hasAssignedAcademy =
        userAcademyId !== null &&
        userAcademyId !== undefined &&
        userAcademyId !== "" &&
        Number(userAcademyId) > 0;
    const hasAssignedBranch =
        userBranchId !== null &&
        userBranchId !== undefined &&
        userBranchId !== "" &&
        Number(userBranchId) > 0;
    const isBranchRestricted = hasAssignedAcademy && !isAcademyAdmin;

    // Load Academies and Branches
    useEffect(() => {
        (async () => {
            try {
                const branchUrl = hasAssignedAcademy
                    ? `/api/branch?academy_id=${userAcademyId}`
                    : "/api/branch";
                const [acadRes, branchRes] = await Promise.all([
                    fetch("/api/academies"),
                    fetch(branchUrl),
                ]);
                const acadJson = await acadRes.json();
                const branchJson = await branchRes.json();

                if (acadRes.ok && acadJson.success) {
                    const acadList = acadJson.data || [];
                    setAcademies(
                        hasAssignedAcademy
                            ? acadList.filter((a) => Number(a.id) === Number(userAcademyId))
                            : acadList
                    );
                }
                if (branchRes.ok && branchJson.success) {
                    setBranches(branchJson.data || []);
                }

                if (hasAssignedAcademy) {
                    setAcademyFilter(String(userAcademyId));
                }
                if (isBranchRestricted && hasAssignedBranch) {
                    setBranchFilter(String(userBranchId));
                }
            } catch {
                /* non-fatal */
            }
        })();
    }, [hasAssignedAcademy, userAcademyId, isBranchRestricted, hasAssignedBranch, userBranchId]);

    // Load Coaches
    const fetchCoaches = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set("search", search.trim());
            if (academyFilter) params.set("academy_id", academyFilter);
            if (branchFilter) params.set("branch_id", branchFilter);
            if (statusFilter !== "") params.set("status", statusFilter);
            if (employmentTypeFilter) params.set("employment_type", employmentTypeFilter);

            const res = await fetch(`/api/coaches?${params.toString()}`);
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to load coaches");
            }
            let list = json.data || [];

            // Client-side specialization filter if selected
            if (specializationFilter) {
                list = list.filter((c) =>
                    c.specialization &&
                    c.specialization
                        .split(",")
                        .map((s) => s.trim().toLowerCase())
                        .includes(specializationFilter.toLowerCase())
                );
            }

            setCoaches(list);
            setPage(1);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const totalPages = Math.ceil(coaches.length / PAGE_SIZE) || 1;
    const pagedCoaches = coaches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchCoaches();
        }, 300);
        return () => clearTimeout(timer);
    }, [search, academyFilter, branchFilter, statusFilter, employmentTypeFilter, specializationFilter]);

    // Quick Status Toggle
    const handleToggleStatus = async (coach) => {
        const newStatus = Number(coach.status) === 1 ? 0 : 1;
        try {
            const res = await fetch(`/api/coaches/${coach.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to update status");
            }
            setNotice(`Coach "${coach.coach_name || "Profile"}" status updated.`);
            setCoaches((prev) =>
                prev.map((c) => (c.id === coach.id ? { ...c, status: newStatus } : c))
            );
        } catch (err) {
            setError(err.message);
        }
    };

    // Soft Delete Coach
    const handleDeleteCoach = async () => {
        if (!deleteConfirmCoach) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/coaches/${deleteConfirmCoach.id}`, {
                method: "DELETE",
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to delete coach");
            }
            setNotice(`Coach "${deleteConfirmCoach.coach_name || "Profile"}" deleted successfully.`);
            setDeleteConfirmCoach(null);
            fetchCoaches();
        } catch (err) {
            setError(err.message);
        } finally {
            setDeleting(false);
        }
    };

    // Statistics
    const stats = useMemo(() => {
        const total = coaches.length;
        const active = coaches.filter((c) => Number(c.status) === 1).length;
        const fullTime = coaches.filter((c) => c.employment_type === "Full Time").length;
        const avgExp =
            total > 0
                ? (
                      coaches.reduce((sum, c) => sum + Number(c.experience_years || 0), 0) /
                      total
                  ).toFixed(1)
                : 0;
        return { total, active, fullTime, avgExp };
    }, [coaches]);

    const resetFilters = () => {
        setSearch("");
        if (!hasAssignedAcademy) setAcademyFilter("");
        if (!isBranchRestricted) setBranchFilter("");
        setSpecializationFilter("");
        setEmploymentTypeFilter("");
        setStatusFilter("");
    };

    return (
        <div className="container-fluid py-4">
            {/* Top Header Card */}
            <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                    <div>
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <span className="badge bg-primary-subtle text-primary fw-semibold px-2.5 py-1.5 rounded-pill">
                                Coaches Panel
                            </span>
                            <span className="text-muted small">CST Management</span>
                        </div>
                        <h1 className="h3 fw-bold mb-1">Coaches Management</h1>
                        <p className="text-muted small mb-0">
                            Manage academy cricket coaches, specializations, credentials, and website profiles.
                        </p>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <button
                            type="button"
                            onClick={fetchCoaches}
                            className="btn btn-outline-secondary d-flex align-items-center gap-2"
                            title="Refresh"
                        >
                            <RotateCcw size={16} />
                            <span>Refresh</span>
                        </button>
                        <Link
                            href="/next_panel/coaches/new"
                            className="btn btn-primary d-flex align-items-center gap-2 px-3 py-2"
                        >
                            <Plus size={18} />
                            <span>Add Coach</span>
                        </Link>
                    </div>
                </div>

                {notice && (
                    <div className="alert alert-success alert-dismissible fade show mt-3 mb-0" role="alert">
                        <CheckCircle2 size={16} className="me-2" />
                        {notice}
                        <button
                            type="button"
                            className="btn-close"
                            onClick={() => setNotice(null)}
                            aria-label="Close"
                        ></button>
                    </div>
                )}

                {error && (
                    <div className="alert alert-danger alert-dismissible fade show mt-3 mb-0" role="alert">
                        {error}
                        <button
                            type="button"
                            className="btn-close"
                            onClick={() => setError(null)}
                            aria-label="Close"
                        ></button>
                    </div>
                )}
            </div>

            {/* KPI Stat Cards */}
            <div className="row g-3 mb-4">
                <div className="col-sm-6 col-lg-3">
                    <div className="card border-0 shadow-sm rounded-4 h-100">
                        <div className="card-body d-flex align-items-center gap-3">
                            <div
                                className="rounded-3 p-3 text-primary"
                                style={{ backgroundColor: "rgba(13, 110, 253, 0.1)" }}
                            >
                                <Users size={26} />
                            </div>
                            <div>
                                <div className="text-muted small text-uppercase fw-semibold">
                                    Total Coaches
                                </div>
                                <div className="fs-3 fw-bold">{stats.total}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-sm-6 col-lg-3">
                    <div className="card border-0 shadow-sm rounded-4 h-100">
                        <div className="card-body d-flex align-items-center gap-3">
                            <div
                                className="rounded-3 p-3 text-success"
                                style={{ backgroundColor: "rgba(25, 135, 84, 0.1)" }}
                            >
                                <UserCheck size={26} />
                            </div>
                            <div>
                                <div className="text-muted small text-uppercase fw-semibold">
                                    Active Coaches
                                </div>
                                <div className="fs-3 fw-bold text-success">{stats.active}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-sm-6 col-lg-3">
                    <div className="card border-0 shadow-sm rounded-4 h-100">
                        <div className="card-body d-flex align-items-center gap-3">
                            <div
                                className="rounded-3 p-3 text-info"
                                style={{ backgroundColor: "rgba(13, 202, 240, 0.1)" }}
                            >
                                <Briefcase size={26} />
                            </div>
                            <div>
                                <div className="text-muted small text-uppercase fw-semibold">
                                    Full-Time
                                </div>
                                <div className="fs-3 fw-bold">{stats.fullTime}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-sm-6 col-lg-3">
                    <div className="card border-0 shadow-sm rounded-4 h-100">
                        <div className="card-body d-flex align-items-center gap-3">
                            <div
                                className="rounded-3 p-3 text-warning"
                                style={{ backgroundColor: "rgba(255, 193, 7, 0.15)" }}
                            >
                                <GraduationCap size={26} />
                            </div>
                            <div>
                                <div className="text-muted small text-uppercase fw-semibold">
                                    Avg. Experience
                                </div>
                                <div className="fs-3 fw-bold">{stats.avgExp} yrs</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Section */}
            <div className="card border-0 shadow-sm rounded-4 mb-4">
                <div className="card-body p-3 p-md-4">
                    <div className="row g-2 g-md-3">
                        <div className="col-md-3">
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0">
                                    <Search size={16} className="text-muted" />
                                </span>
                                <input
                                    type="text"
                                    className="form-control bg-light border-start-0"
                                    placeholder="Search name, code, email, qualification..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        {!hasAssignedAcademy && (
                            <div className="col-md-2">
                                <select
                                    className="form-select bg-light"
                                    value={academyFilter}
                                    onChange={(e) => {
                                        setAcademyFilter(e.target.value);
                                        setBranchFilter("");
                                    }}
                                >
                                    <option value="">All Academies</option>
                                    {academies.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.academy_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="col-md-2">
                            <select
                                className="form-select bg-light"
                                value={branchFilter}
                                onChange={(e) => setBranchFilter(e.target.value)}
                                disabled={isBranchRestricted && hasAssignedBranch}
                            >
                                <option value="">All Branches</option>
                                {branches
                                    .filter(
                                        (b) =>
                                            !academyFilter ||
                                            Number(b.academy_id) === Number(academyFilter)
                                    )
                                    .map((b) => (
                                        <option key={b.id} value={b.id}>
                                            {b.branch_name}
                                        </option>
                                    ))}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <select
                                className="form-select bg-light"
                                value={specializationFilter}
                                onChange={(e) => setSpecializationFilter(e.target.value)}
                            >
                                <option value="">All Specializations</option>
                                <option value="Batting">Batting</option>
                                <option value="Bowling">Bowling</option>
                                <option value="Fielding">Fielding</option>
                                <option value="Wicket Keeping">Wicket Keeping</option>
                                <option value="Fitness">Fitness</option>
                                <option value="All Rounder">All Rounder</option>
                            </select>
                        </div>
                        <div className="col-md-2">
                            <select
                                className="form-select bg-light"
                                value={employmentTypeFilter}
                                onChange={(e) => setEmploymentTypeFilter(e.target.value)}
                            >
                                <option value="">All Employment Types</option>
                                <option value="Full Time">Full Time</option>
                                <option value="Part Time">Part Time</option>
                                <option value="Visiting">Visiting</option>
                                <option value="Contract">Contract</option>
                            </select>
                        </div>
                        <div className="col-md-1">
                            <select
                                className="form-select bg-light"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="">Status</option>
                                <option value="1">Active</option>
                                <option value="0">Inactive</option>
                            </select>
                        </div>
                    </div>
                    {(search ||
                        (!hasAssignedAcademy && academyFilter) ||
                        (!isBranchRestricted && branchFilter) ||
                        specializationFilter ||
                        employmentTypeFilter ||
                        statusFilter !== "") && (
                        <div className="d-flex justify-content-end mt-2">
                            <button
                                type="button"
                                className="btn btn-link btn-sm text-decoration-none text-muted"
                                onClick={resetFilters}
                            >
                                Reset Filters
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Coaches Table */}
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light text-uppercase small fw-semibold text-muted">
                            <tr>
                                <th scope="col" className="ps-4">Coach Profile</th>
                                <th scope="col">Academy & Branch</th>
                                <th scope="col">Specialization</th>
                                <th scope="col">Employment</th>
                                <th scope="col">Contact</th>
                                <th scope="col">Status</th>
                                <th scope="col" className="text-end pe-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-5 text-muted">
                                        <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                                        Loading coaches...
                                    </td>
                                </tr>
                            ) : coaches.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-5 text-muted">
                                        <div className="mb-2">
                                            <Users size={36} className="text-muted opacity-50" />
                                        </div>
                                        <div className="fw-semibold">No coaches found</div>
                                        <div className="small">Try adjusting your search or filters.</div>
                                    </td>
                                </tr>
                            ) : (
                                pagedCoaches.map((coach) => {
                                    const specs = coach.specialization
                                        ? coach.specialization.split(",").map((s) => s.trim()).filter(Boolean)
                                        : [];
                                    const initials = (coach.coach_name || "Coach")
                                        .split(" ")
                                        .map((p) => p[0])
                                        .slice(0, 2)
                                        .join("")
                                        .toUpperCase();

                                    return (
                                        <tr key={coach.id}>
                                            <td className="ps-4">
                                                <div className="d-flex align-items-center gap-3">
                                                    {coach.profile_image ? (
                                                        <img
                                                            src={coach.profile_image}
                                                            alt={coach.coach_name || "Coach"}
                                                            className="rounded-circle object-fit-cover shadow-sm"
                                                            style={{ width: "42px", height: "42px" }}
                                                            onError={(e) => {
                                                                e.target.onerror = null;
                                                                e.target.src = "/images/default-avatar.png";
                                                            }}
                                                        />
                                                    ) : (
                                                        <div
                                                            className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-sm"
                                                            style={{
                                                                width: "42px",
                                                                height: "42px",
                                                                background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
                                                                fontSize: "14px",
                                                            }}
                                                        >
                                                            {initials}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="fw-bold text-dark">
                                                            {coach.coach_name || "Unnamed Coach"}
                                                        </div>
                                                        <div className="d-flex align-items-center gap-2 small text-muted">
                                                            {coach.coach_code && (
                                                                <span className="badge bg-light text-secondary border">
                                                                    {coach.coach_code}
                                                                </span>
                                                            )}
                                                            {coach.qualification && (
                                                                <span>{coach.qualification}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="fw-semibold text-dark">
                                                    {coach.academy_name || "N/A"}
                                                </div>
                                                <div className="small text-muted d-flex align-items-center gap-1">
                                                    <MapPin size={12} />
                                                    {coach.branch_name || "All Branches"}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="d-flex flex-wrap gap-1 mb-1">
                                                    {specs.length > 0 ? (
                                                        specs.map((spec, i) => (
                                                            <span
                                                                key={i}
                                                                className={`badge px-2 py-1 rounded-pill small ${
                                                                    SPECIALIZATION_BADGES[spec] || "bg-secondary text-white"
                                                                }`}
                                                            >
                                                                {spec}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-muted small">General Coach</span>
                                                    )}
                                                </div>
                                                <div className="small text-muted">
                                                    {Number(coach.experience_years || 0)} years exp.
                                                </div>
                                            </td>
                                            <td>
                                                <span className="badge bg-light text-dark border px-2 py-1 mb-1">
                                                    {coach.employment_type || "Full Time"}
                                                </span>
                                                {coach.joining_date && (
                                                    <div className="small text-muted d-flex align-items-center gap-1">
                                                        <Calendar size={12} />
                                                        {new Date(coach.joining_date).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                {coach.email && (
                                                    <div className="small d-flex align-items-center gap-1 text-dark">
                                                        <Mail size={12} className="text-muted" />
                                                        <span>{coach.email}</span>
                                                    </div>
                                                )}
                                                {coach.phone && (
                                                    <div className="small text-muted d-flex align-items-center gap-1">
                                                        <Phone size={12} />
                                                        <span>{coach.phone}</span>
                                                    </div>
                                                )}
                                                {!coach.email && !coach.phone && (
                                                    <span className="text-muted small">—</span>
                                                )}
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleStatus(coach)}
                                                    className={`btn btn-sm px-2.5 py-1 rounded-pill border-0 ${
                                                        Number(coach.status) === 1
                                                            ? "bg-success-subtle text-success fw-semibold"
                                                            : "bg-secondary-subtle text-secondary fw-semibold"
                                                    }`}
                                                    title="Click to toggle status"
                                                >
                                                    {Number(coach.status) === 1 ? "Active" : "Inactive"}
                                                </button>
                                            </td>
                                            <td className="text-end pe-4">
                                                <div className="d-flex justify-content-end align-items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedCoach(coach)}
                                                        className="btn btn-sm btn-light border text-muted"
                                                        title="View Details"
                                                    >
                                                        <Eye size={15} />
                                                    </button>
                                                    <Link
                                                        href={`/next_panel/coaches/${coach.id}/edit`}
                                                        className="btn btn-sm btn-light border text-primary"
                                                        title="Edit Coach"
                                                    >
                                                        <Edit size={15} />
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeleteConfirmCoach(coach)}
                                                        className="btn btn-sm btn-light border text-danger"
                                                        title="Delete Coach"
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

            {!loading && coaches.length > 0 && (
                <div className="mt-3">
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        total={coaches.length}
                        onPageChange={setPage}
                        pageSize={PAGE_SIZE}
                    />
                </div>
            )}

            {/* Coach Detail Modal */}
            {selectedCoach && (
                <div
                    className="modal d-block"
                    tabIndex={-1}
                    style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
                    role="dialog"
                >
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content rounded-4 border-0 shadow">
                            <div className="modal-header border-bottom px-4 py-3">
                                <div className="d-flex align-items-center gap-2">
                                    <Shield size={18} className="text-primary" />
                                    <h5 className="modal-title fw-bold mb-0">Coach Profile Details</h5>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setSelectedCoach(null)}
                                ></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="d-flex flex-column flex-sm-row align-items-center gap-4 mb-4 pb-3 border-bottom">
                                    {selectedCoach.profile_image ? (
                                        <img
                                            src={selectedCoach.profile_image}
                                            alt={selectedCoach.coach_name}
                                            className="rounded-circle object-fit-cover shadow"
                                            style={{ width: "90px", height: "90px" }}
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = "/images/default-avatar.png";
                                            }}
                                        />
                                    ) : (
                                        <div
                                            className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow"
                                            style={{
                                                width: "90px",
                                                height: "90px",
                                                background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
                                                fontSize: "28px",
                                            }}
                                        >
                                            {(selectedCoach.coach_name || "Coach")
                                                .split(" ")
                                                .map((p) => p[0])
                                                .slice(0, 2)
                                                .join("")
                                                .toUpperCase()}
                                        </div>
                                    )}
                                    <div className="text-center text-sm-start">
                                        <h4 className="fw-bold mb-1">
                                            {selectedCoach.coach_name || "Unnamed Coach"}
                                        </h4>
                                        <div className="d-flex flex-wrap align-items-center gap-2 justify-content-center justify-content-sm-start mb-2">
                                            {selectedCoach.coach_code && (
                                                <span className="badge bg-light text-dark border">
                                                    Code: {selectedCoach.coach_code}
                                                </span>
                                            )}
                                            <span className="badge bg-primary-subtle text-primary">
                                                {selectedCoach.user_type || "Coach"}
                                            </span>
                                            <span
                                                className={`badge ${
                                                    Number(selectedCoach.status) === 1
                                                        ? "bg-success-subtle text-success"
                                                        : "bg-secondary-subtle text-secondary"
                                                }`}
                                            >
                                                {Number(selectedCoach.status) === 1 ? "Active" : "Inactive"}
                                            </span>
                                        </div>
                                        <div className="text-muted small">
                                            {selectedCoach.academy_name} • {selectedCoach.branch_name || "Main Branch"}
                                        </div>
                                    </div>
                                </div>

                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <div className="p-3 bg-light rounded-3 h-100">
                                            <h6 className="fw-bold text-uppercase small text-muted mb-3">
                                                Professional Information
                                            </h6>
                                            <div className="mb-2">
                                                <span className="text-muted small d-block">Specializations:</span>
                                                <div className="d-flex flex-wrap gap-1 mt-1">
                                                    {(selectedCoach.specialization || "All Rounder")
                                                        .split(",")
                                                        .map((s, idx) => (
                                                            <span
                                                                key={idx}
                                                                className={`badge ${
                                                                    SPECIALIZATION_BADGES[s.trim()] ||
                                                                    "bg-secondary text-white"
                                                                }`}
                                                            >
                                                                {s.trim()}
                                                            </span>
                                                        ))}
                                                </div>
                                            </div>
                                            <div className="mb-2">
                                                <span className="text-muted small d-block">Experience:</span>
                                                <span className="fw-semibold">
                                                    {selectedCoach.experience_years} Years
                                                </span>
                                            </div>
                                            <div className="mb-2">
                                                <span className="text-muted small d-block">Qualification:</span>
                                                <span className="fw-semibold">
                                                    {selectedCoach.qualification || "—"}
                                                </span>
                                            </div>
                                            <div className="mb-2">
                                                <span className="text-muted small d-block">Employment Type:</span>
                                                <span className="fw-semibold">
                                                    {selectedCoach.employment_type || "Full Time"}
                                                </span>
                                            </div>
                                            {selectedCoach.salary && (
                                                <div className="mb-2">
                                                    <span className="text-muted small d-block">Salary:</span>
                                                    <span className="fw-semibold text-success">
                                                        ₹{Number(selectedCoach.salary).toLocaleString()}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="col-md-6">
                                        <div className="p-3 bg-light rounded-3 h-100">
                                            <h6 className="fw-bold text-uppercase small text-muted mb-3">
                                                Personal & Contact Details
                                            </h6>
                                            <div className="mb-2">
                                                <span className="text-muted small d-block">Email:</span>
                                                <span className="fw-semibold">
                                                    {selectedCoach.email || "—"}
                                                </span>
                                            </div>
                                            <div className="mb-2">
                                                <span className="text-muted small d-block">Phone:</span>
                                                <span className="fw-semibold">
                                                    {selectedCoach.phone || "—"}
                                                </span>
                                            </div>
                                            <div className="mb-2">
                                                <span className="text-muted small d-block">Gender & DOB:</span>
                                                <span className="fw-semibold">
                                                    {selectedCoach.gender || "—"} •{" "}
                                                    {selectedCoach.date_of_birth
                                                        ? new Date(selectedCoach.date_of_birth).toLocaleDateString()
                                                        : "—"}
                                                </span>
                                            </div>
                                            <div className="mb-2">
                                                <span className="text-muted small d-block">Previous Academy:</span>
                                                <span className="fw-semibold">
                                                    {selectedCoach.previous_academy || "—"}
                                                </span>
                                            </div>
                                            <div className="mb-2">
                                                <span className="text-muted small d-block">Emergency Contact:</span>
                                                <span className="fw-semibold">
                                                    {selectedCoach.emergency_contact_name
                                                        ? `${selectedCoach.emergency_contact_name} (${selectedCoach.emergency_contact_phone || "No phone"})`
                                                        : "—"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {selectedCoach.certifications && (
                                        <div className="col-12">
                                            <div className="p-3 bg-light rounded-3">
                                                <h6 className="fw-bold text-uppercase small text-muted mb-2">
                                                    Certifications
                                                </h6>
                                                <p className="small mb-0 text-dark">
                                                    {selectedCoach.certifications}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {selectedCoach.bio && (
                                        <div className="col-12">
                                            <div className="p-3 bg-light rounded-3">
                                                <h6 className="fw-bold text-uppercase small text-muted mb-2">
                                                    Biography & Achievements
                                                </h6>
                                                <p className="small mb-0 text-dark" style={{ whiteSpace: "pre-line" }}>
                                                    {selectedCoach.bio}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer border-top px-4 py-3">
                                <Link
                                    href={`/next_panel/coaches/${selectedCoach.id}/edit`}
                                    className="btn btn-primary d-flex align-items-center gap-2"
                                >
                                    <Edit size={16} />
                                    <span>Edit Coach Profile</span>
                                </Link>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setSelectedCoach(null)}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmCoach && (
                <div
                    className="modal d-block"
                    tabIndex={-1}
                    style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
                    role="dialog"
                >
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content rounded-4 border-0 shadow">
                            <div className="modal-body p-4 text-center">
                                <div className="text-danger mb-3">
                                    <Trash2 size={48} />
                                </div>
                                <h5 className="fw-bold mb-2">Delete Coach Profile?</h5>
                                <p className="text-muted small mb-4">
                                    Are you sure you want to remove{" "}
                                    <strong>{deleteConfirmCoach.coach_name || "this coach"}</strong>?
                                    This coach will no longer be listed on the management portal or the academy website.
                                </p>
                                <div className="d-flex justify-content-center gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-light px-4"
                                        onClick={() => setDeleteConfirmCoach(null)}
                                        disabled={deleting}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-danger px-4"
                                        onClick={handleDeleteCoach}
                                        disabled={deleting}
                                    >
                                        {deleting ? "Deleting..." : "Yes, Delete"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
