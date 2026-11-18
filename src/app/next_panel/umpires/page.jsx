"use client";

import {
    AlertCircle,
    Building2,
    Calendar,
    CheckCircle2,
    DollarSign,
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
    X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "../components/UserContext";
import Pagination from "../components/Pagination";

export default function UmpiresPage() {
    const { user } = useUser();
    const [loading, setLoading] = useState(true);
    const [umpires, setUmpires] = useState([]);
    const [academies, setAcademies] = useState([]);
    const [branches, setBranches] = useState([]);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    // Filters
    const [search, setSearch] = useState("");
    const [academyFilter, setAcademyFilter] = useState("");
    const [branchFilter, setBranchFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    // Modals
    const [selectedUmpire, setSelectedUmpire] = useState(null);
    const [deleteConfirmUmpire, setDeleteConfirmUmpire] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const userRole = String(user?.user_type || "").trim().toLowerCase();
    const isSuperAdmin = ["super admin", "superadmin", "admin"].includes(userRole);
    const isAcademyAdmin = userRole === "academy admin";
    const isBranchAdmin = userRole === "branch admin";
    const userAcademyId = user?.academy_id;
    const userBranchId = user?.branch_id;

    // Load Academies and Branches
    useEffect(() => {
        (async () => {
            try {
                const branchUrl = userAcademyId
                    ? `/api/branch?academy_id=${userAcademyId}`
                    : "/api/branch";

                const [acadRes, branchRes] = await Promise.all([
                    fetch("/api/academies"),
                    fetch(branchUrl),
                ]);
                const acadJson = await acadRes.json();
                const branchJson = await branchRes.json();

                if (acadRes.ok && acadJson.success) {
                    const list = acadJson.data || [];
                    setAcademies(
                        !isSuperAdmin && userAcademyId
                            ? list.filter((a) => Number(a.id) === Number(userAcademyId))
                            : list
                    );
                }
                if (branchRes.ok && branchJson.success) {
                    setBranches(branchJson.data || []);
                }

                if (!isSuperAdmin && userAcademyId) {
                    setAcademyFilter(String(userAcademyId));
                }
                if (isBranchAdmin && userBranchId) {
                    setBranchFilter(String(userBranchId));
                }
            } catch {
                /* non-fatal */
            }
        })();
    }, [isSuperAdmin, userAcademyId, isBranchAdmin, userBranchId]);

    // Fetch Umpires
    const fetchUmpires = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.append("search", search.trim());
            if (academyFilter) params.append("academy_id", academyFilter);
            if (branchFilter) params.append("branch_id", branchFilter);
            if (statusFilter !== "") params.append("status", statusFilter);

            const res = await fetch(`/api/umpires?${params.toString()}`);
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to load umpires");
            }

            setUmpires(json.data || []);
            setPage(1);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUmpires();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [academyFilter, branchFilter, statusFilter]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchUmpires();
    };

    const handleReset = () => {
        setSearch("");
        if (isSuperAdmin) {
            setAcademyFilter("");
            setBranchFilter("");
        } else if (!isBranchAdmin) {
            setBranchFilter("");
        }
        setStatusFilter("");
    };

    // Filter branches when academy filter changes
    const filteredBranches = useMemo(() => {
        if (!academyFilter) return branches;
        return branches.filter((b) => String(b.academy_id) === String(academyFilter));
    }, [branches, academyFilter]);

    // Pagination
    const totalPages = Math.ceil(umpires.length / PAGE_SIZE) || 1;
    const paginatedUmpires = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return umpires.slice(start, start + PAGE_SIZE);
    }, [umpires, page]);

    // Delete handler
    const handleDelete = async () => {
        if (!deleteConfirmUmpire) return;
        setDeleting(true);
        setError(null);
        try {
            const res = await fetch(`/api/umpires/${deleteConfirmUmpire.id}`, {
                method: "DELETE",
            });
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to delete umpire");
            }

            setNotice(`Umpire "${deleteConfirmUmpire.umpire_name}" deleted successfully.`);
            setDeleteConfirmUmpire(null);
            fetchUmpires();
        } catch (err) {
            setError(err.message);
            setDeleteConfirmUmpire(null);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="container-fluid py-4">
            {/* Header */}
            <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div>
                        <h1 className="h4 fw-bold mb-1 d-flex align-items-center gap-2">
                            <UserCheck className="text-primary" size={24} /> Umpire Management
                        </h1>
                        <p className="text-muted small mb-0">
                            Register and manage official match umpires, match formats, and fee structures.
                        </p>
                    </div>

                    <Link
                        href="/next_panel/umpires/new"
                        className="btn btn-primary d-inline-flex align-items-center gap-2 px-3 py-2"
                    >
                        <Plus size={18} /> Add New Umpire
                    </Link>
                </div>
            </div>

            {/* Alerts */}
            {notice && (
                <div className="alert alert-success alert-dismissible fade show d-flex align-items-center gap-2 mb-4">
                    <CheckCircle2 size={18} />
                    <div>{notice}</div>
                    <button
                        type="button"
                        className="btn-close"
                        onClick={() => setNotice(null)}
                        aria-label="Close"
                    ></button>
                </div>
            )}

            {error && (
                <div className="alert alert-danger alert-dismissible fade show d-flex align-items-center gap-2 mb-4">
                    <AlertCircle size={18} />
                    <div>{error}</div>
                    <button
                        type="button"
                        className="btn-close"
                        onClick={() => setError(null)}
                        aria-label="Close"
                    ></button>
                </div>
            )}

            {/* Filters */}
            <div className="card border-0 shadow-sm rounded-4 mb-4">
                <div className="card-body p-3">
                    <form onSubmit={handleSearchSubmit} className="row g-2 align-items-center">
                        <div className="col-lg-3 col-md-6">
                            <div className="input-group">
                                <span className="input-group-text bg-white">
                                    <Search size={16} className="text-muted" />
                                </span>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Search name, phone, email..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Academy Filter */}
                        <div className="col-lg-3 col-md-6">
                            <select
                                className="form-select"
                                value={academyFilter}
                                onChange={(e) => {
                                    setAcademyFilter(e.target.value);
                                    setBranchFilter("");
                                }}
                                disabled={!isSuperAdmin && Boolean(userAcademyId)}
                            >
                                <option value="">All Academies</option>
                                {academies.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.academy_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Branch Filter */}
                        <div className="col-lg-2 col-md-4">
                            <select
                                className="form-select"
                                value={branchFilter}
                                onChange={(e) => setBranchFilter(e.target.value)}
                                disabled={isBranchAdmin && Boolean(userBranchId)}
                            >
                                <option value="">All Branches</option>
                                {filteredBranches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.branch_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Status Filter */}
                        <div className="col-lg-2 col-md-4">
                            <select
                                className="form-select"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="">All Status</option>
                                <option value="1">Active</option>
                                <option value="0">Inactive</option>
                            </select>
                        </div>

                        {/* Filter Actions */}
                        <div className="col-lg-2 col-md-4 d-flex gap-2">
                            <button type="submit" className="btn btn-dark w-100">
                                Filter
                            </button>
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={handleReset}
                                title="Reset Filters"
                            >
                                <RotateCcw size={16} />
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Umpires Table */}
            <div className="card border-0 shadow-sm rounded-4">
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                            <div className="text-muted mt-2">Loading umpires...</div>
                        </div>
                    ) : umpires.length === 0 ? (
                        <div className="text-center py-5">
                            <UserCheck size={48} className="text-muted mb-2 opacity-50" />
                            <h5 className="fw-semibold">No Umpires Found</h5>
                            <p className="text-muted small">
                                {search || academyFilter || branchFilter || statusFilter
                                    ? "Try adjusting your search or filter options."
                                    : "Get started by adding your first umpire to the panel."}
                            </p>
                            <Link href="/next_panel/umpires/new" className="btn btn-sm btn-primary">
                                <Plus size={16} className="me-1" /> Add Umpire
                            </Link>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th style={{ width: "4%" }}>#</th>
                                        <th style={{ width: "20%" }}>Umpire</th>
                                        <th style={{ width: "16%" }}>Contact</th>
                                        <th style={{ width: "16%" }}>Branch / Academy</th>
                                        <th style={{ width: "14%" }}>Experience</th>
                                        <th style={{ width: "18%" }}>Standard Fees</th>
                                        <th style={{ width: "6%" }}>Status</th>
                                        <th style={{ width: "6%" }} className="text-end pe-3">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedUmpires.map((umpire, idx) => (
                                        <tr key={umpire.id}>
                                            <td className="text-muted small">
                                                {(page - 1) * PAGE_SIZE + idx + 1}
                                            </td>

                                            {/* Umpire Name & Qualification */}
                                            <td>
                                                <div className="fw-bold">{umpire.umpire_name}</div>
                                                {umpire.qualification && (
                                                    <small className="text-muted d-block">
                                                        <GraduationCap size={12} className="me-1" />
                                                        {umpire.qualification}
                                                    </small>
                                                )}
                                            </td>

                                            {/* Contact */}
                                            <td>
                                                <div className="small">
                                                    <Phone size={12} className="me-1 text-primary" />
                                                    {umpire.mobile}
                                                </div>
                                                {umpire.email && (
                                                    <div className="small text-muted text-truncate" style={{ maxWidth: 180 }}>
                                                        <Mail size={12} className="me-1" />
                                                        {umpire.email}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Academy / Branch */}
                                            <td>
                                                <div className="small fw-semibold">{umpire.academy_name}</div>
                                                <small className="text-muted d-block">
                                                    {umpire.branch_name ? (
                                                        <>
                                                            <MapPin size={11} className="me-1" />
                                                            {umpire.branch_name}
                                                        </>
                                                    ) : (
                                                        "Academy-wide"
                                                    )}
                                                </small>
                                            </td>

                                            {/* Experience */}
                                            <td>
                                                <span className="badge bg-light text-dark border">
                                                    {umpire.experience_years
                                                        ? `${umpire.experience_years} Years`
                                                        : "Fresher"}
                                                </span>
                                            </td>

                                            {/* Match Fees */}
                                            <td>
                                                <div className="d-flex flex-wrap gap-1">
                                                    {umpire.t20_fee !== null ? (
                                                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle" title="T20 Fee">
                                                            T20: ₹{Number(umpire.t20_fee).toLocaleString("en-IN")}
                                                        </span>
                                                    ) : null}
                                                    {umpire.odi_fee !== null ? (
                                                        <span className="badge bg-success-subtle text-success border border-success-subtle" title="ODI Fee">
                                                            ODI: ₹{Number(umpire.odi_fee).toLocaleString("en-IN")}
                                                        </span>
                                                    ) : null}
                                                    {umpire.test_fee !== null ? (
                                                        <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle" title="Test Fee">
                                                            Test: ₹{Number(umpire.test_fee).toLocaleString("en-IN")}
                                                        </span>
                                                    ) : null}
                                                    {umpire.t20_fee === null && umpire.odi_fee === null && umpire.test_fee === null && (
                                                        <span className="text-muted small">
                                                            {umpire.fees?.length > 0
                                                                ? `${umpire.fees.length} formats configured`
                                                                : "Not configured"}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td>
                                                <span
                                                    className={`badge ${
                                                        umpire.status === 1
                                                            ? "bg-success"
                                                            : "bg-secondary"
                                                    }`}
                                                >
                                                    {umpire.status === 1 ? "Active" : "Inactive"}
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td className="text-end pe-3">
                                                <div className="d-inline-flex gap-1">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-info"
                                                        title="Quick View"
                                                        onClick={() => setSelectedUmpire(umpire)}
                                                    >
                                                        <Eye size={14} />
                                                    </button>

                                                    <Link
                                                        href={`/next_panel/umpires/${umpire.id}/edit`}
                                                        className="btn btn-sm btn-outline-primary"
                                                        title="Edit Umpire"
                                                    >
                                                        <Edit size={14} />
                                                    </Link>

                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger"
                                                        title="Delete Umpire"
                                                        onClick={() => setDeleteConfirmUmpire(umpire)}
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
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="p-3 border-top d-flex justify-content-between align-items-center">
                            <small className="text-muted">
                                Showing {(page - 1) * PAGE_SIZE + 1} to{" "}
                                {Math.min(page * PAGE_SIZE, umpires.length)} of {umpires.length} umpires
                            </small>
                            <Pagination
                                currentPage={page}
                                totalPages={totalPages}
                                onPageChange={setPage}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Quick View Details Modal */}
            {selectedUmpire && (
                <div
                    className="modal show d-block"
                    tabIndex="-1"
                    style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
                >
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content rounded-4 border-0 shadow">
                            <div className="modal-header border-0 pb-0">
                                <div className="d-flex align-items-center gap-2">
                                    <div className="p-2 rounded-3 bg-primary-subtle text-primary">
                                        <UserCheck size={20} />
                                    </div>
                                    <div>
                                        <h5 className="modal-title fw-bold">
                                            {selectedUmpire.umpire_name}
                                        </h5>
                                        <small className="text-muted">
                                            {selectedUmpire.academy_name} •{" "}
                                            {selectedUmpire.branch_name || "Academy-wide"}
                                        </small>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setSelectedUmpire(null)}
                                ></button>
                            </div>

                            <div className="modal-body p-4">
                                <div className="row g-3 mb-4">
                                    <div className="col-md-6">
                                        <div className="p-3 rounded-3 bg-light">
                                            <small className="text-muted d-block">Phone Number</small>
                                            <span className="fw-medium">{selectedUmpire.mobile}</span>
                                            {selectedUmpire.alternate_mobile && (
                                                <small className="text-muted d-block">
                                                    Alt: {selectedUmpire.alternate_mobile}
                                                </small>
                                            )}
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="p-3 rounded-3 bg-light">
                                            <small className="text-muted d-block">Email</small>
                                            <span className="fw-medium">
                                                {selectedUmpire.email || "Not specified"}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="p-3 rounded-3 bg-light">
                                            <small className="text-muted d-block">
                                                Experience & Qualification
                                            </small>
                                            <span className="fw-medium">
                                                {selectedUmpire.experience_years} Years
                                            </span>
                                            {selectedUmpire.qualification && (
                                                <small className="text-muted d-block">
                                                    {selectedUmpire.qualification}
                                                </small>
                                            )}
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="p-3 rounded-3 bg-light">
                                            <small className="text-muted d-block">Status</small>
                                            <span
                                                className={`badge ${
                                                    selectedUmpire.status === 1
                                                        ? "bg-success"
                                                        : "bg-secondary"
                                                }`}
                                            >
                                                {selectedUmpire.status === 1 ? "Active" : "Inactive"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <h6 className="fw-bold mb-3">Configured Match Fees</h6>
                                {selectedUmpire.fees && selectedUmpire.fees.length > 0 ? (
                                    <div className="table-responsive">
                                        <table className="table table-sm table-bordered align-middle">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Match Format</th>
                                                    <th>Fee Amount</th>
                                                    <th>Billing Type</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedUmpire.fees.map((f) => (
                                                    <tr key={f.id || f.match_type}>
                                                        <td className="fw-semibold">{f.match_type}</td>
                                                        <td className="fw-bold text-success">
                                                            ₹{Number(f.fee_amount).toLocaleString("en-IN")}
                                                        </td>
                                                        <td>{f.payment_type}</td>
                                                        <td>
                                                            <span
                                                                className={`badge ${
                                                                    f.status === 1
                                                                        ? "bg-success-subtle text-success"
                                                                        : "bg-secondary-subtle text-secondary"
                                                                }`}
                                                            >
                                                                {f.status === 1 ? "Active" : "Inactive"}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-muted small">No specific fees configured yet.</p>
                                )}
                            </div>

                            <div className="modal-footer border-0 pt-0">
                                <Link
                                    href={`/next_panel/umpires/${selectedUmpire.id}`}
                                    className="btn btn-outline-primary"
                                    onClick={() => setSelectedUmpire(null)}
                                >
                                    Full Detail Page
                                </Link>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setSelectedUmpire(null)}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmUmpire && (
                <div
                    className="modal show d-block"
                    tabIndex="-1"
                    style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
                >
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content rounded-4 border-0 shadow">
                            <div className="modal-header border-0 pb-0">
                                <h5 className="modal-title fw-bold text-danger">Delete Umpire</h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setDeleteConfirmUmpire(null)}
                                    disabled={deleting}
                                ></button>
                            </div>

                            <div className="modal-body p-4">
                                <p className="mb-2">
                                    Are you sure you want to delete umpire{" "}
                                    <strong>{deleteConfirmUmpire.umpire_name}</strong>?
                                </p>
                                <p className="small text-muted mb-0">
                                    This will soft-delete the umpire record. The operation will fail if the umpire is assigned to any active ground bookings or matches.
                                </p>
                            </div>

                            <div className="modal-footer border-0 pt-0">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={() => setDeleteConfirmUmpire(null)}
                                    disabled={deleting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                >
                                    {deleting ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2"></span>
                                            Deleting...
                                        </>
                                    ) : (
                                        "Confirm Delete"
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
