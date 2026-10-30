"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Edit, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import Pagination from "../components/Pagination";
// import { useAuth } from "@/components/utils/AuthContext";

export default function RolesPage() {
    // const { user: userInfo } = useAuth();
    const [roles, setRoles] = useState([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");

    const loadRoles = async () => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set("search", search.trim());
            if (status) params.set("status", status);

            const query = params.toString();
            const res = await fetch(`/api/roles${query ? `?${query}` : ""}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Unable to load roles.");
            setRoles(json.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRoles();
    }, [status]);

    useEffect(() => {
        setPage(1);
    }, [status, search]);

    const totalPages = Math.ceil(roles.length / PAGE_SIZE) || 1;
    const pagedRoles = roles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleSearch = (event) => {
        event.preventDefault();
        loadRoles();
    };

    const handleClear = () => {
        setSearch("");
        // Reload immediately with the text cleared (status filter, if any, is kept).
        setTimeout(() => loadRoles(), 0);
    };

    const handleDelete = async (role) => {
        if (!confirm(`Delete role "${role.role_name}"?`)) return;

        setDeletingId(role.id);
        setError(null);

        try {
            const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Unable to delete role.");
            setRoles((current) => current.filter((item) => item.id !== role.id));
        } catch (err) {
            setError(err.message);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                            <div>
                                <div className="d-flex align-items-center gap-2 mb-2">
                                    <ShieldCheck size={24} />
                                    <h1 className="h4 mb-0">Roles</h1>
                                </div>
                                <p className="text-muted mb-0">Manage roles and their academy / branch scope.</p>
                            </div>

                            {/* {userInfo.permissions.includes("roles.create") && ( */}
                            <Link href="/next_panel/roles/new" className="btn btn-primary fw-semibold">
                                <Plus size={16} className="me-2" /> New Role
                            </Link>
                            {/* )} */}
                        </div>
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-3">
                        <div className="d-flex flex-column flex-md-row gap-2 mb-3">
                            <form className="flex-grow-1" onSubmit={handleSearch}>
                                <div className="input-group" style={{ maxWidth: 560 }}>
                                    <span className="input-group-text bg-white">
                                        <Search size={16} className="text-muted" />
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Search by role, description, academy, branch..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                    <button className="btn btn-outline-secondary" type="submit">
                                        Search
                                    </button>
                                    <button type="button" className="btn btn-outline-danger" onClick={handleClear}>
                                        Clear
                                    </button>
                                </div>
                            </form>

                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="form-select"
                                style={{ maxWidth: 200 }}
                            >
                                <option value="">All Statuses</option>
                                <option value="1">Active</option>
                                <option value="0">Inactive</option>
                            </select>
                        </div>

                        {error && <div className="alert alert-danger">{error}</div>}

                        {loading ? (
                            <div className="text-center py-5 text-muted">Loading roles...</div>
                        ) : roles.length === 0 ? (
                            <div className="text-center py-5 text-muted">No roles found yet.</div>
                        ) : (
                            <>
                            <div className="table-responsive">
                                <table className="table align-middle mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th scope="col">Role</th>
                                            <th scope="col">Scope</th>
                                            <th scope="col">Description</th>
                                            <th scope="col">Status</th>
                                            <th scope="col" className="text-end">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedRoles.map((role) => (
                                            <tr key={role.id}>
                                                <td>
                                                    <span className="fw-semibold">{role.role_name}</span>
                                                </td>
                                                <td className="text-muted">
                                                    {role.academy_name ? (
                                                        <>
                                                            <div>{role.academy_name}</div>
                                                            {role.branch_name && <small>{role.branch_name}</small>}
                                                        </>
                                                    ) : (
                                                        <span className="badge bg-info-subtle text-info-emphasis">Global</span>
                                                    )}
                                                </td>
                                                <td className="text-muted">{role.role_desc || "No description"}</td>
                                                <td>
                                                    <span className={`badge ${role.status === 1 ? "bg-success" : "bg-secondary"}`}>
                                                        {role.status === 1 ? "Active" : "Inactive"}
                                                    </span>
                                                </td>
                                                <td className="text-end">
                                                    <div className="btn-group btn-group-sm" role="group">
                                                        <Link href={`/next_panel/roles/${role.id}`} className="btn btn-outline-primary" aria-label="View role">
                                                            <ArrowUpRight size={16} />
                                                        </Link>
                                                        {/* {userInfo.permissions.includes("roles.edit") && ( */}
                                                        <Link href={`/next_panel/roles/${role.id}/edit`} className="btn btn-outline-secondary" aria-label="Edit role">
                                                            <Edit size={16} />
                                                        </Link>
                                                        {/* )}
                                                        {userInfo.permissions.includes("roles.delete") && ( */}
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger"
                                                            onClick={() => handleDelete(role)}
                                                            disabled={deletingId === role.id}
                                                            aria-label="Delete role"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                        {/* )} */}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <Pagination
                                page={page}
                                totalPages={totalPages}
                                total={roles.length}
                                onPageChange={setPage}
                                pageSize={PAGE_SIZE}
                            />
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
