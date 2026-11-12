"use client";

import {
    Calendar,
    CheckCircle2,
    Edit,
    Eye,
    Globe,
    Mail,
    Phone,
    Plus,
    RefreshCw,
    Search,
    SearchSlash,
    Shield,
    Trash2,
    UserCheck,
    UserCircle,
    Users as UsersIcon,
    X,
    XCircle,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import Pagination from "../components/Pagination";

export default function PublicUsersPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, today: 0 });

    // Filter states
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [reloadCount, setReloadCount] = useState(0);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    // Modal states
    const [viewUser, setViewUser] = useState(null);
    const [editUser, setEditUser] = useState(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Form states (Create / Edit)
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        status: 1,
    });
    const [formSaving, setFormSaving] = useState(false);
    const [formError, setFormError] = useState("");

    // Load users from API
    useEffect(() => {
        let isCancelled = false;

        async function fetchUsers() {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (search.trim()) params.set("search", search.trim());
                if (statusFilter !== "") params.set("status", statusFilter);

                const res = await fetch(`/api/public-users?${params.toString()}`);
                const json = await res.json();

                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Unable to fetch public users.");
                }

                if (!isCancelled) {
                    setUsers(json.data || []);
                    if (json.stats) setStats(json.stats);
                    setPage(1);
                }
            } catch (err) {
                if (!isCancelled) setError(err.message);
            } finally {
                if (!isCancelled) setLoading(false);
            }
        }

        fetchUsers();

        return () => {
            isCancelled = true;
        };
    }, [search, statusFilter, reloadCount]);

    // Handle Search trigger
    const handleSearch = (e) => {
        e.preventDefault();
        setReloadCount((c) => c + 1);
    };

    // Handle Clear Filters
    const handleClear = () => {
        setSearch("");
        setStatusFilter("");
        setReloadCount((c) => c + 1);
    };

    // Quick Status Toggle
    const handleToggleStatus = async (user) => {
        const newStatus = Number(user.status) === 1 ? 0 : 1;
        const actionLabel = newStatus === 1 ? "activate" : "deactivate";

        if (!confirm(`Are you sure you want to ${actionLabel} account for "${user.name}"?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/public-users/${user.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to update status.");
            }

            setNotice(`User "${user.name}" is now ${newStatus === 1 ? "Active" : "Inactive"}.`);
            setTimeout(() => setNotice(null), 3500);
            setReloadCount((c) => c + 1);
        } catch (err) {
            alert(err.message);
        }
    };

    // Delete Public User
    const handleDelete = async (user) => {
        if (!confirm(`Are you sure you want to permanently delete user "${user.name}" (${user.email || user.phone})?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/public-users/${user.id}`, { method: "DELETE" });
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to delete user.");
            }

            setNotice(`User "${user.name}" deleted successfully.`);
            setTimeout(() => setNotice(null), 3500);
            setUsers((prev) => prev.filter((u) => u.id !== user.id));
            setReloadCount((c) => c + 1);
        } catch (err) {
            alert(err.message);
        }
    };

    // Open Edit Modal
    const handleOpenEdit = (user) => {
        setEditUser(user);
        setFormData({
            name: user.name || "",
            email: user.email || "",
            phone: user.phone || "",
            password: "",
            status: user.status !== undefined ? Number(user.status) : 1,
        });
        setFormError("");
    };

    // Open Create Modal
    const handleOpenCreate = () => {
        setIsCreateOpen(true);
        setFormData({
            name: "",
            email: "",
            phone: "",
            password: "",
            status: 1,
        });
        setFormError("");
    };

    // Save Form (Create or Edit)
    const handleSaveForm = async (e) => {
        e.preventDefault();
        setFormSaving(true);
        setFormError("");

        try {
            const isEdit = Boolean(editUser);
            const url = isEdit ? `/api/public-users/${editUser.id}` : "/api/public-users";
            const method = isEdit ? "PUT" : "POST";

            const payload = {
                name: formData.name.trim(),
                email: formData.email.trim(),
                phone: formData.phone.trim(),
                status: Number(formData.status),
            };

            if (formData.password.trim()) {
                payload.password = formData.password.trim();
            }

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to save user.");
            }

            setNotice(isEdit ? "User updated successfully." : "New public user created successfully.");
            setTimeout(() => setNotice(null), 3500);
            setEditUser(null);
            setIsCreateOpen(false);
            setReloadCount((c) => c + 1);
        } catch (err) {
            setFormError(err.message);
        } finally {
            setFormSaving(false);
        }
    };

    const totalPages = Math.ceil(users.length / PAGE_SIZE) || 1;
    const pagedUsers = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
        <div className="container-fluid py-2">
            {/* Page Header Banner */}
            <div className="bg-white rounded-4 shadow-sm p-4 mb-4 border">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div>
                        <div className="d-flex align-items-center gap-2">
                            <div
                                className="rounded-3 d-inline-flex align-items-center justify-content-center p-2"
                                style={{ background: "#e8f5e9", color: "#2e7d32" }}
                            >
                                <Globe size={24} />
                            </div>
                            <div>
                                <h3 className="mb-0 fw-bold text-dark">Public Users</h3>
                                <p className="text-muted small mb-0">
                                    Manage registered website public users, ground bookings accounts, and credentials.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <button
                            type="button"
                            className="btn btn-outline-secondary d-flex align-items-center gap-1"
                            onClick={() => setReloadCount((c) => c + 1)}
                            title="Refresh users list"
                        >
                            <RefreshCw size={16} />
                            <span>Refresh</span>
                        </button>
                        <button
                            type="button"
                            className="btn btn-success d-flex align-items-center gap-1 px-3"
                            onClick={handleOpenCreate}
                        >
                            <Plus size={18} />
                            <span>Add Public User</span>
                        </button>
                    </div>
                </div>

                {/* KPI Metrics */}
                <div className="row g-3 mt-3 pt-3 border-top">
                    <div className="col-6 col-md-3">
                        <div className="p-3 rounded-3 bg-light border d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small fw-medium">Total Registered</div>
                                <div className="fs-4 fw-bold text-dark">{stats.total}</div>
                            </div>
                            <UsersIcon className="text-primary opacity-75" size={28} />
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="p-3 rounded-3 bg-light border d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small fw-medium">Active Accounts</div>
                                <div className="fs-4 fw-bold text-success">{stats.active}</div>
                            </div>
                            <UserCheck className="text-success opacity-75" size={28} />
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="p-3 rounded-3 bg-light border d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small fw-medium">Inactive Accounts</div>
                                <div className="fs-4 fw-bold text-secondary">{stats.inactive}</div>
                            </div>
                            <XCircle className="text-secondary opacity-75" size={28} />
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="p-3 rounded-3 bg-light border d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small fw-medium">Registered Today</div>
                                <div className="fs-4 fw-bold text-teal" style={{ color: "#00796b" }}>{stats.today}</div>
                            </div>
                            <Calendar className="text-info opacity-75" size={28} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Notification alert */}
            {notice && (
                <div className="alert alert-success alert-dismissible fade show d-flex align-items-center gap-2" role="alert">
                    <CheckCircle2 size={18} />
                    <span>{notice}</span>
                    <button type="button" className="btn-close" onClick={() => setNotice(null)} aria-label="Close" />
                </div>
            )}

            {/* Error alert */}
            {error && (
                <div className="alert alert-danger d-flex align-items-center gap-2" role="alert">
                    <XCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {/* Filter and Search Bar */}
            <div className="bg-white rounded-4 shadow-sm p-3 mb-3 border">
                <form onSubmit={handleSearch} className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                    <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
                        <div className="input-group" style={{ maxWidth: "340px" }}>
                            <span className="input-group-text bg-light border-end-0">
                                <Search size={16} className="text-muted" />
                            </span>
                            <input
                                type="text"
                                className="form-control border-start-0"
                                placeholder="Search by name, email, or phone..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <select
                            className="form-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{ maxWidth: "160px" }}
                        >
                            <option value="">All Statuses</option>
                            <option value="1">Active Only</option>
                            <option value="0">Inactive Only</option>
                        </select>

                        <button type="submit" className="btn btn-primary d-flex align-items-center gap-1">
                            <Search size={16} />
                            <span>Filter</span>
                        </button>

                        {(search || statusFilter !== "") && (
                            <button
                                type="button"
                                className="btn btn-outline-secondary d-flex align-items-center gap-1"
                                onClick={handleClear}
                                title="Clear filters"
                            >
                                <SearchSlash size={16} />
                                <span>Reset</span>
                            </button>
                        )}
                    </div>

                    <div className="text-muted small">
                        Showing <strong>{users.length}</strong> {users.length === 1 ? "user" : "users"}
                    </div>
                </form>
            </div>

            {/* Main Users Table */}
            <div className="bg-white rounded-4 shadow-sm border overflow-hidden">
                {loading ? (
                    <div className="text-center py-5">
                        <div className="spinner-border text-success" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="text-muted small mt-2 mb-0">Loading public users list...</p>
                    </div>
                ) : users.length === 0 ? (
                    <div className="text-center py-5">
                        <UsersIcon size={48} className="text-muted opacity-50 mb-2" />
                        <h5 className="fw-semibold text-secondary">No Public Users Found</h5>
                        <p className="text-muted small mb-3">
                            {search || statusFilter !== ""
                                ? "Try adjusting your search filters to find what you are looking for."
                                : "Public users registered on the website will automatically appear here."}
                        </p>
                        <button type="button" className="btn btn-outline-success btn-sm" onClick={handleOpenCreate}>
                            <Plus size={16} className="me-1" />
                            Add First Public User
                        </button>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table align-middle table-hover mb-0">
                            <thead className="table-light text-secondary small text-uppercase">
                                <tr>
                                    <th style={{ width: "50px" }} className="text-center">#</th>
                                    <th>User Info</th>
                                    <th>Email</th>
                                    <th>Phone</th>
                                    <th>Role / Type</th>
                                    <th className="text-center">Status</th>
                                    <th>Registered On</th>
                                    <th style={{ width: "140px" }} className="text-end pe-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedUsers.map((item, idx) => (
                                    <tr key={item.id}>
                                        <td className="text-center text-muted small fw-medium">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                {item.profile_image ? (
                                                    <img
                                                        src={item.profile_image}
                                                        alt={item.name}
                                                        width={38}
                                                        height={38}
                                                        className="rounded-circle object-fit-cover border"
                                                    />
                                                ) : (
                                                    <div
                                                        className="rounded-circle d-inline-flex align-items-center justify-content-center fw-bold shadow-sm flex-shrink-0"
                                                        style={{
                                                            width: "38px",
                                                            height: "38px",
                                                            background: "#062f38",
                                                            color: "#a4ff00",
                                                            fontSize: "0.9rem",
                                                        }}
                                                    >
                                                        {(item.name?.[0] || "U").toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="fw-bold text-dark text-truncate" style={{ maxWidth: "200px" }}>
                                                        {item.name}
                                                    </div>
                                                    <span className="badge bg-light text-muted border" style={{ fontSize: "0.68rem" }}>
                                                        ID: #{item.id}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            {item.email ? (
                                                <a
                                                    href={`mailto:${item.email}`}
                                                    className="d-inline-flex align-items-center gap-1 text-decoration-none text-dark small hover-underline"
                                                >
                                                    <Mail size={13} className="text-muted" />
                                                    <span>{item.email}</span>
                                                </a>
                                            ) : (
                                                <span className="text-muted small">—</span>
                                            )}
                                        </td>
                                        <td>
                                            {item.phone ? (
                                                <a
                                                    href={`tel:${item.phone}`}
                                                    className="d-inline-flex align-items-center gap-1 text-decoration-none text-dark small"
                                                >
                                                    <Phone size={13} className="text-muted" />
                                                    <span>{item.phone}</span>
                                                </a>
                                            ) : (
                                                <span className="text-muted small">—</span>
                                            )}
                                        </td>
                                        <td>
                                            <span
                                                className="badge px-2 py-1"
                                                style={{
                                                    background: "#e0f2f1",
                                                    color: "#004d40",
                                                    fontSize: "0.74rem",
                                                    fontWeight: 600,
                                                    borderRadius: "50px",
                                                }}
                                            >
                                                {item.user_type || "Public User"}
                                            </span>
                                        </td>
                                        <td className="text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleStatus(item)}
                                                className={`badge border-0 px-2 py-1 cursor-pointer transition ${
                                                    Number(item.status) === 1 ? "bg-success" : "bg-secondary"
                                                }`}
                                                style={{ fontSize: "0.75rem", cursor: "pointer" }}
                                                title="Click to toggle status"
                                            >
                                                {Number(item.status) === 1 ? "Active" : "Inactive"}
                                            </button>
                                        </td>
                                        <td className="text-muted small">
                                            {item.created_at
                                                ? new Date(item.created_at).toLocaleDateString("en-IN", {
                                                      day: "2-digit",
                                                      month: "short",
                                                      year: "numeric",
                                                      hour: "2-digit",
                                                      minute: "2-digit",
                                                  })
                                                : "—"}
                                        </td>
                                        <td className="text-end pe-3">
                                            <div className="btn-group btn-group-sm" role="group">
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-info"
                                                    onClick={() => setViewUser(item)}
                                                    title="View Details"
                                                >
                                                    <Eye size={15} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-secondary"
                                                    onClick={() => handleOpenEdit(item)}
                                                    title="Edit User"
                                                >
                                                    <Edit size={15} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-danger"
                                                    onClick={() => handleDelete(item)}
                                                    title="Delete User"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && users.length > 0 && (
                    <div className="p-3 border-top">
                        <Pagination
                            page={page}
                            totalPages={totalPages}
                            total={users.length}
                            onPageChange={setPage}
                            pageSize={PAGE_SIZE}
                        />
                    </div>
                )}
            </div>

            {/* MODAL 1: VIEW DETAILS */}
            {viewUser && (
                <div
                    className="modal fade show d-block"
                    tabIndex="-1"
                    style={{ background: "rgba(0,0,0,0.5)" }}
                    onClick={() => setViewUser(null)}
                >
                    <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
                            <div className="modal-header bg-light border-bottom">
                                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                                    <UserCircle size={22} className="text-success" />
                                    <span>Public User Details</span>
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setViewUser(null)} />
                            </div>
                            <div className="modal-body p-4">
                                <div className="text-center mb-4">
                                    {viewUser.profile_image ? (
                                        <img
                                            src={viewUser.profile_image}
                                            alt={viewUser.name}
                                            width={72}
                                            height={72}
                                            className="rounded-circle object-fit-cover border mb-2 shadow-sm"
                                        />
                                    ) : (
                                        <div
                                            className="rounded-circle d-inline-flex align-items-center justify-content-center fw-bold shadow mb-2"
                                            style={{
                                                width: "72px",
                                                height: "72px",
                                                background: "#062f38",
                                                color: "#a4ff00",
                                                fontSize: "1.75rem",
                                            }}
                                        >
                                            {(viewUser.name?.[0] || "U").toUpperCase()}
                                        </div>
                                    )}
                                    <h4 className="fw-bold mb-1 text-dark">{viewUser.name}</h4>
                                    <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-1 rounded-pill">
                                        {viewUser.user_type || "Public User"}
                                    </span>
                                </div>

                                <div className="list-group list-group-flush border rounded-3 overflow-hidden">
                                    <div className="list-group-item d-flex justify-content-between align-items-center py-2">
                                        <span className="text-muted small">Account ID</span>
                                        <span className="fw-semibold">#{viewUser.id}</span>
                                    </div>
                                    <div className="list-group-item d-flex justify-content-between align-items-center py-2">
                                        <span className="text-muted small">Email Address</span>
                                        <span className="fw-semibold">{viewUser.email || "—"}</span>
                                    </div>
                                    <div className="list-group-item d-flex justify-content-between align-items-center py-2">
                                        <span className="text-muted small">Mobile Number</span>
                                        <span className="fw-semibold">{viewUser.phone || "—"}</span>
                                    </div>
                                    <div className="list-group-item d-flex justify-content-between align-items-center py-2">
                                        <span className="text-muted small">Account Status</span>
                                        <span className={`badge ${Number(viewUser.status) === 1 ? "bg-success" : "bg-secondary"}`}>
                                            {Number(viewUser.status) === 1 ? "Active" : "Inactive"}
                                        </span>
                                    </div>
                                    <div className="list-group-item d-flex justify-content-between align-items-center py-2">
                                        <span className="text-muted small">Registered At</span>
                                        <span className="small text-dark">
                                            {viewUser.created_at
                                                ? new Date(viewUser.created_at).toLocaleString("en-IN")
                                                : "—"}
                                        </span>
                                    </div>
                                    <div className="list-group-item d-flex justify-content-between align-items-center py-2">
                                        <span className="text-muted small">Last Profile Update</span>
                                        <span className="small text-dark">
                                            {viewUser.updated_at
                                                ? new Date(viewUser.updated_at).toLocaleString("en-IN")
                                                : "—"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer bg-light border-top">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary px-4"
                                    onClick={() => setViewUser(null)}
                                >
                                    Close
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary px-4 d-flex align-items-center gap-1"
                                    onClick={() => {
                                        const userToEdit = viewUser;
                                        setViewUser(null);
                                        handleOpenEdit(userToEdit);
                                    }}
                                >
                                    <Edit size={16} />
                                    <span>Edit User</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2: CREATE / EDIT PUBLIC USER */}
            {(isCreateOpen || editUser) && (
                <div
                    className="modal fade show d-block"
                    tabIndex="-1"
                    style={{ background: "rgba(0,0,0,0.5)" }}
                    onClick={() => {
                        setIsCreateOpen(false);
                        setEditUser(null);
                    }}
                >
                    <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
                            <form onSubmit={handleSaveForm}>
                                <div className="modal-header bg-light border-bottom">
                                    <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                                        {editUser ? <Edit size={20} className="text-primary" /> : <Plus size={20} className="text-success" />}
                                        <span>{editUser ? `Edit User: ${editUser.name}` : "Create New Public User"}</span>
                                    </h5>
                                    <button
                                        type="button"
                                        className="btn-close"
                                        onClick={() => {
                                            setIsCreateOpen(false);
                                            setEditUser(null);
                                        }}
                                    />
                                </div>

                                <div className="modal-body p-4">
                                    {formError && (
                                        <div className="alert alert-danger py-2 small mb-3">
                                            {formError}
                                        </div>
                                    )}

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-secondary">Full Name *</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. John Doe"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-secondary">Email Address *</label>
                                        <input
                                            type="email"
                                            className="form-control"
                                            placeholder="e.g. john@example.com"
                                            required
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-secondary">Phone Number *</label>
                                        <input
                                            type="tel"
                                            className="form-control"
                                            placeholder="10 digit mobile number"
                                            required
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-secondary">
                                            {editUser ? "New Password (leave blank to keep current)" : "Password *"}
                                        </label>
                                        <input
                                            type="password"
                                            className="form-control"
                                            placeholder={editUser ? "Enter only if resetting password" : "At least 6 characters"}
                                            required={!editUser}
                                            minLength={6}
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-secondary">Account Status</label>
                                        <select
                                            className="form-select"
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: Number(e.target.value) })}
                                        >
                                            <option value={1}>Active</option>
                                            <option value={0}>Inactive</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="modal-footer bg-light border-top">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary px-4"
                                        onClick={() => {
                                            setIsCreateOpen(false);
                                            setEditUser(null);
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-success px-4"
                                        disabled={formSaving}
                                    >
                                        {formSaving ? "Saving..." : editUser ? "Update User" : "Create User"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
