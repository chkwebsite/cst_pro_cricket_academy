"use client";

import { ArrowUpRight, Edit, Search, SearchSlash, Trash2, UserShield } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import Pagination from "../components/Pagination";

export default function PermissionsPage() {
    // STATES
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [permissions, setPermissions] = useState([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const [search, setSearch] = useState("");
    const [module_name, setModule_name] = useState("");
    const [status, setStatus] = useState("");

    const loadPermission = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();

            if (search.trim()) params.set("search", search.trim());
            if (module_name.trim()) params.set("module_name", module_name.trim());
            if (status !== "") params.set("status", status);

            const query = params.toString();
            const res = await fetch(`/api/permissions${query ? `?${query}` : ""}`);
            const json = await res.json();

            if (!res.ok || !json.success) throw new Error(json.message || "Unable to load Permissions.");

            setPermissions(json.data || []);
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPermission();
    }, [status]);

    useEffect(() => {
        setPage(1);
    }, [status, search, module_name]);

    const totalPages = Math.ceil(permissions.length / PAGE_SIZE) || 1;
    const pagedPermissions = permissions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleSearch = (e) => {
        e.preventDefault();
        loadPermission();
    };

    const handleClear = (e) => {
        e.preventDefault();
        setSearch("");
        setStatus("");
        loadPermission();
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete Permission "${name}"?`)) return;
        setError(null);
        setSuccess(null);
        try {
            const res = await fetch(`/api/permissions/${id}`, { method: "DELETE" });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.message || "Unable to delete permission");
            setPermissions((current) => current.filter((p) => p.id !== id));
            setSuccess(json.message || "Permission deleted successfully");
            setTimeout(() => setSuccess(null), 3000);
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
                                <h3 className="mb-0"><UserShield /> Permissions</h3>
                                <p className="text-muted mb-0">Manage Permissions and their academy / roles.</p>
                            </div>
                            <Link href="/next_panel/permissions/new" className="btn btn-primary px-4"><UserShield size={18} /> Add Permission</Link>
                        </div>
                    </div>
                </div>
                <div className="col-sm-12">
                    <div className="d-flex justify-content-between align-items-center gap-3">
                        <div className="input-group" style={{ maxWidth: '512px' }}>
                            <span className="input-group-text bg-white"> <Search /></span>
                            <input type="text" className="form-control" value={search} onChange={(e) => setSearch(e.target.value)}></input>
                            <button type="button" className="btn btn-outline-secondary" onClick={handleSearch}><Search /></button>
                            <button type="button" className="btn btn-outline-danger" onClick={handleClear}><SearchSlash /></button>
                        </div>
                        <select
                            className="form-select"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            style={{ maxWidth: '220px' }}
                        >
                            <option value="">Choose Status</option>
                            <option value="1">Active</option>
                            <option value="0">Inactive</option>
                        </select>
                    </div>
                </div>
                <div className="col-sm-12">
                    {success && <div className="alert alert-success">{success}</div>}
                    {error && <div className="alert alert-danger">{error}</div>}
                    {loading ? (<div className="text-center py-5 text-muted">Loading permissions...</div>) :
                        (permissions.length === 0 ? (<div className="text-center py-5 text-muted">No permissions found yet.</div>) : (
                            <div className="table-responsive">
                                <table className="table align-middle mb-0">
                                    <thead className="table-success">
                                        <tr>
                                            <th>#</th>
                                            <th>Module name</th>
                                            <th>Permission name</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.isArray(pagedPermissions) && pagedPermissions.map((item, idx) => {
                                            return (
                                                <tr key={item.id ?? idx}>
                                                    <th>{(page - 1) * PAGE_SIZE + idx + 1}</th>
                                                    <td>{item.module_name}</td>
                                                    <td>{item.permission_name}</td>
                                                    <td>
                                                        <span className={`badge ${item.status === 1 ? "bg-success" : "bg-secondary"}`}>
                                                             {item.status === 1 ? "Active" : "Inactive"}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="d-flex justify-content-start gap-2">
                                                            {/* <Link href={`/next_panel/permissions/${item.id}`} className="btn btn-outline-primary" aria-label="View permission">
                                                            <ArrowUpRight size={16} />
                                                        </Link> */}
                                                            <Link href={`/next_panel/permissions/${item.id}/edit`} className="btn btn-outline-secondary" aria-label="Edit permission">
                                                                <Edit size={16} />
                                                            </Link>
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-danger"
                                                                onClick={() => handleDelete(item.id, item.permission_name)}
                                                                aria-label="Delete permission"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <Pagination
                                page={page}
                                totalPages={totalPages}
                                total={permissions.length}
                                onPageChange={setPage}
                                pageSize={PAGE_SIZE}
                            />
                        ))}
                </div>
            </div>
        </div>
    );
}
