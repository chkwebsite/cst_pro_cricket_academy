"use client";

import { Edit, Search, SearchSlash, Trash2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import Pagination from "../components/Pagination";

export default function RolePermissionsPage() {
    // STATES
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [rolePermissions, setRolePermissions] = useState([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const [search, setSearch] = useState("");

    const loadRolePermissions = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/role-permissions`);
            const json = await res.json();

            if (!res.ok || !json.success) throw new Error(json.message || "Unable to load Role Permissions.");

            setRolePermissions(json.data || []);
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRolePermissions();
    }, []);

    // Client-side filter — the API doesn't support search params, so we filter
    // the already-fetched list by role / module / permission name.
    const filteredRolePermissions = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return rolePermissions;
        return rolePermissions.filter((item) =>
            item.role_name?.toLowerCase().includes(term) ||
            item.module_name?.toLowerCase().includes(term) ||
            item.permission_name?.toLowerCase().includes(term)
        );
    }, [search, rolePermissions]);

    useEffect(() => {
        setPage(1);
    }, [search]);

    const totalPages = Math.ceil(filteredRolePermissions.length / PAGE_SIZE) || 1;
    const pagedRolePermissions = filteredRolePermissions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleSearch = (e) => {
        e.preventDefault();
        // filtering is already reactive via useMemo; kept for consistency with the
        // permissions page's search/clear button pattern
    };

    const handleClear = (e) => {
        e.preventDefault();
        setSearch("");
    };

    const handleDelete = async (id, label) => {
        if (!confirm(`Remove permission "${label}" from this role?`)) return;
        setError(null);
        try {
            const res = await fetch(`/api/role-permissions/${id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Unable to delete role permission");
            setRolePermissions((current) => current.filter((p) => p.id !== id));
        } catch (error) {
            setError(error.message);
        }
    };

    return (
        <div className="container-fluid">
            <div className="row g-3">
                <div className="col-sm-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center gap-3">
                            <div className="">
                                <h3 className="mb-0"><ShieldCheck /> Role Permissions</h3>
                                <p className="text-muted mb-0">Manage which permissions are assigned to each role.</p>
                            </div>
                            <Link href="/next_panel/role-permissions/new" className="btn btn-primary px-4">
                                <ShieldCheck size={18} /> Assign Permission
                            </Link>
                        </div>
                    </div>
                </div>
                <div className="col-sm-12">
                    <div className="d-flex justify-content-between align-items-center gap-3">
                        <div className="input-group" style={{ maxWidth: '512px' }}>
                            <span className="input-group-text bg-white"> <Search /></span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Search by role, module or permission"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <button type="button" className="btn btn-outline-secondary" onClick={handleSearch}><Search /></button>
                            <button type="button" className="btn btn-outline-danger" onClick={handleClear}><SearchSlash /></button>
                        </div>
                    </div>
                </div>
                <div className="col-sm-12">
                    {error && <div className="alert alert-danger">{error}</div>}
                    {loading ? (
                        <div className="text-center py-5 text-muted">Loading role permissions...</div>
                    ) : (
                        filteredRolePermissions.length === 0 ? (
                            <div className="text-center py-5 text-muted">No role permissions found yet.</div>
                        ) : (
                            <>
                            <div className="table-responsive">
                                <table className="table align-middle mb-0">
                                    <thead className="table-success">
                                        <tr>
                                            <th>#</th>
                                            <th>Role</th>
                                            <th>Module</th>
                                            <th>Permission</th>
                                            <th>Assigned On</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedRolePermissions.map((item, idx) => (
                                            <tr key={item.id}>
                                                <th>{(page - 1) * PAGE_SIZE + idx + 1}</th>
                                                <td>{item.role_name}</td>
                                                <td>{item.module_name}</td>
                                                <td>{item.permission_name}</td>
                                                <td>
                                                    {item.created_at
                                                        ? new Date(item.created_at).toLocaleDateString()
                                                        : "—"}
                                                </td>
                                                <td>
                                                    <div className="d-flex justify-content-start gap-2">
                                                        <Link
                                                            href={`/next_panel/role-permissions/${item.id}/edit`}
                                                            className="btn btn-outline-secondary"
                                                            aria-label="Edit role permission"
                                                        >
                                                            <Edit size={16} />
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger"
                                                            onClick={() => handleDelete(item.id, `${item.module_name} - ${item.permission_name}`)}
                                                            aria-label="Delete role permission"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
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
                                total={filteredRolePermissions.length}
                                onPageChange={setPage}
                                pageSize={PAGE_SIZE}
                            />
                            </>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
