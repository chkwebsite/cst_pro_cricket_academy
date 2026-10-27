"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Building2, Edit, MapPin, Plus, Search, Trash2 } from "lucide-react";

export default function BranchesPage() {
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");

    const loadBranches = async () => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set("search", search.trim());
            if (status) params.set("status", status);

            const query = params.toString();
            const res = await fetch(`/api/branch${query ? `?${query}` : ""}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Unable to load branches.");
            setBranches(json.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBranches();
    }, [status]);

    const handleSearch = (event) => {
        event.preventDefault();
        loadBranches();
    };

    const handleClear = () => {
        setSearch("");
        setTimeout(() => loadBranches(), 0);
    };

    const handleDelete = async (branch) => {
        if (!confirm(`Delete branch "${branch.branch_name}"?`)) return;

        setDeletingId(branch.id);
        setError(null);

        try {
            const res = await fetch(`/api/branch/${branch.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Unable to delete branch.");
            setBranches((current) => current.filter((item) => item.id !== branch.id));
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
                                    <Building2 size={24} />
                                    <h1 className="h4 mb-0">Branches</h1>
                                </div>
                                <p className="text-muted mb-0">Manage academy branches, location details, and directions.</p>
                            </div>

                            <Link href="/next_panel/branches/new" className="btn btn-primary fw-semibold">
                                <Plus size={16} className="me-2" /> New Branch
                            </Link>
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
                                        placeholder="Search by branch, code, city, academy..."
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
                            <div className="text-center py-5 text-muted">Loading branches...</div>
                        ) : branches.length === 0 ? (
                            <div className="text-center py-5 text-muted">No branches found yet.</div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table align-middle mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th scope="col">Branch</th>
                                            <th scope="col">Academy</th>
                                            <th scope="col">Contact</th>
                                            <th scope="col">Location &amp; Directions</th>
                                            <th scope="col">Status</th>
                                            <th scope="col" className="text-end">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {branches.map((branch) => (
                                            <tr key={branch.id}>
                                                <td>
                                                    <div className="fw-semibold">{branch.branch_name}</div>
                                                    <small className="text-muted">{branch.branch_code}</small>
                                                </td>
                                                <td>
                                                    <div>{branch.academy_name}</div>
                                                    <small className="text-muted">{branch.academy_code}</small>
                                                </td>
                                                <td>
                                                    <div>{branch.phone || "No phone"}</div>
                                                    <small className="text-muted">{branch.email || "No email"}</small>
                                                </td>
                                                <td className="text-muted">
                                                    <div>{[branch.city, branch.state].filter(Boolean).join(", ") || "No location"}</div>
                                                    {branch.directions && (
                                                        <small className="text-success d-inline-flex align-items-center gap-1 mt-1">
                                                            <MapPin size={12} /> Directions available
                                                        </small>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className={`badge ${branch.status === 1 ? "bg-success" : "bg-secondary"}`}>
                                                        {branch.status === 1 ? "Active" : "Inactive"}
                                                    </span>
                                                </td>
                                                <td className="text-end">
                                                    <div className="btn-group btn-group-sm" role="group">
                                                        <Link href={`/next_panel/branches/${branch.id}`} className="btn btn-outline-primary" aria-label="View branch">
                                                            <ArrowUpRight size={16} />
                                                        </Link>
                                                        <Link href={`/next_panel/branches/${branch.id}/edit`} className="btn btn-outline-secondary" aria-label="Edit branch">
                                                            <Edit size={16} />
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger"
                                                            onClick={() => handleDelete(branch)}
                                                            disabled={deletingId === branch.id}
                                                            aria-label="Delete branch"
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
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
