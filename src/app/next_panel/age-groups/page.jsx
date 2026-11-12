"use client";

import { Edit, Search, SearchSlash, Trash2, Baby } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import Pagination from "../components/Pagination";

export default function AgeGroupsPage() {
    // STATES
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [ageGroups, setAgeGroups] = useState([]);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    const loadAgeGroups = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (status !== "") params.set("status", status);

            const query = params.toString();
            const res = await fetch(`/api/age-groups${query ? `?${query}` : ""}`);
            const json = await res.json();

            if (!res.ok || !json.success) throw new Error(json.message || "Unable to load Age Groups.");

            setAgeGroups(json.data || []);
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAgeGroups();
    }, [status]);

    // Client-side text filter — the API has no text search param, so we filter
    // the already-fetched list by age group name.
    const filteredAgeGroups = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return ageGroups;
        return ageGroups.filter((item) =>
            item.age_group?.toLowerCase().includes(term)
        );
    }, [search, ageGroups]);

    const totalPages = Math.ceil(filteredAgeGroups.length / PAGE_SIZE) || 1;
    const pagedAgeGroups = filteredAgeGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleClear = (e) => {
        e.preventDefault();
        setSearch("");
        setStatus("");
        setPage(1);
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete age group "${name}"?`)) return;
        setError(null);
        try {
            const res = await fetch(`/api/age-groups/${id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Unable to delete age group");
            setAgeGroups((current) => current.filter((a) => a.id !== id));
        } catch (error) {
            setError(error.message);
        }
    };

    const formatAgeRange = (item) => {
        if (item.min_age == null && item.max_age == null) return "—";
        if (item.min_age != null && item.max_age != null) return `${item.min_age} - ${item.max_age} yrs`;
        if (item.min_age != null) return `${item.min_age}+ yrs`;
        return `Up to ${item.max_age} yrs`;
    };

    return (
        <div className="container-fluid">
            <div className="row g-3">
                <div className="col-sm-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center gap-3">
                            <div className="">
                                <h3 className="mb-0"><Baby /> Age Groups</h3>
                                <p className="text-muted mb-0">Manage age groups used across programs.</p>
                            </div>
                            <Link href="/next_panel/age-groups/new" className="btn btn-primary px-4">
                                <Baby size={18} /> Add Age Group
                            </Link>
                        </div>
                    </div>
                </div>
                <div className="col-sm-12">
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                        <div className="input-group" style={{ maxWidth: '360px' }}>
                            <span className="input-group-text bg-white"> <Search /></span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Search by age group name"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <button
                                type="button"
                                className="btn btn-outline-danger"
                                onClick={handleClear}
                                aria-label="Clear filters"
                            >
                                <SearchSlash />
                            </button>
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
                    {error && <div className="alert alert-danger">{error}</div>}
                    {loading ? (
                        <div className="text-center py-5 text-muted">Loading age groups...</div>
                    ) : (
                        filteredAgeGroups.length === 0 ? (
                            <div className="text-center py-5 text-muted">No age groups found yet.</div>
                        ) : (
                            <>
                            <div className="table-responsive">
                                <table className="table align-middle mb-0">
                                    <thead className="table-success">
                                        <tr>
                                            <th>#</th>
                                            <th>Age Group</th>
                                            <th>Age Range</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedAgeGroups.map((item, idx) => (
                                            <tr key={item.id}>
                                                <th>{(page - 1) * PAGE_SIZE + idx + 1}</th>
                                                <td>{item.age_group}</td>
                                                <td>{formatAgeRange(item)}</td>
                                                <td>
                                                    <span className={`badge ${item.status === 1 ? "bg-success" : "bg-secondary"}`}>
                                                        {item.status === 1 ? "Active" : "Inactive"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="d-flex justify-content-start gap-2">
                                                        <Link
                                                            href={`/next_panel/age-groups/${item.id}/edit`}
                                                            className="btn btn-outline-secondary"
                                                            aria-label="Edit age group"
                                                        >
                                                            <Edit size={16} />
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger"
                                                            onClick={() => handleDelete(item.id, item.age_group)}
                                                            aria-label="Delete age group"
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
                            <div className="mt-3">
                                <Pagination
                                    page={page}
                                    totalPages={totalPages}
                                    total={filteredAgeGroups.length}
                                    onPageChange={setPage}
                                    pageSize={PAGE_SIZE}
                                />
                            </div>
                            </>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
