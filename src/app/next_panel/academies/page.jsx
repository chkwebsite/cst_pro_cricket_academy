"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Edit, GraduationCap, Image as ImageIcon, Plus, Search, Trash2 } from "lucide-react";
import Pagination from "../components/Pagination";
// import { useAuth } from "@/components/utils/AuthContext";

export default function AcademiesPage() {
    // const { user: userInfo } = useAuth();
    const [academies, setAcademies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    const loadAcademies = async () => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set("search", search.trim());
            if (status) params.set("status", status);

            const query = params.toString();
            const res = await fetch(`/api/academies${query ? `?${query}` : ""}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Unable to load academies.");
            setAcademies(json.data || []);
            setPage(1);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAcademies();
    }, [status]);

    const handleSearch = (event) => {
        event.preventDefault();
        loadAcademies();
    };

    const handleClear = () => {
        setSearch("");
        // Reload immediately with the text cleared (status filter, if any, is kept).
        setTimeout(() => loadAcademies(), 0);
    };

    const handleDelete = async (academy) => {
        if (!confirm(`Delete academy "${academy.academy_name}"?`)) return;

        setDeletingId(academy.id);
        setError(null);

        try {
            const res = await fetch(`/api/academies/${academy.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Unable to delete academy.");
            setAcademies((current) => current.filter((item) => item.id !== academy.id));
        } catch (err) {
            setError(err.message);
        } finally {
            setDeletingId(null);
        }
    };

    const totalPages = Math.ceil(academies.length / PAGE_SIZE) || 1;
    const pagedAcademies = academies.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                            <div>
                                <div className="d-flex align-items-center gap-2 mb-2">
                                    <GraduationCap size={24} />
                                    <h1 className="h4 mb-0">Academies</h1>
                                </div>
                                <p className="text-muted mb-0">Manage partner academies and their profile details.</p>
                            </div>

                            {/* {userInfo.permissions.includes("academies.create") && ( */}
                            <Link href="/next_panel/academies/new" className="btn btn-primary fw-semibold">
                                <Plus size={16} className="me-2" /> New Academy
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
                                        placeholder="Search by name, phone, email, city..."
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
                            <div className="text-center py-5 text-muted">Loading academies...</div>
                        ) : academies.length === 0 ? (
                            <div className="text-center py-5 text-muted">No academies found yet.</div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table align-middle mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th scope="col">Academy</th>
                                            <th scope="col">Code</th>
                                            <th scope="col">Contact</th>
                                            <th scope="col">Location</th>
                                            <th scope="col">Status</th>
                                            <th scope="col" className="text-end">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedAcademies.map((academy) => (
                                            <tr key={academy.id}>
                                                <td>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div
                                                            className="d-flex align-items-center justify-content-center bg-light rounded-3 border overflow-hidden flex-shrink-0"
                                                            style={{ width: 40, height: 40 }}
                                                        >
                                                            {academy.logo ? (
                                                                <img
                                                                    src={academy.logo.startsWith("/") ? academy.logo : `/images/uploads/academy/${academy.logo}`}
                                                                    alt={academy.academy_name}
                                                                    className="w-100 h-100"
                                                                    style={{ objectFit: "cover" }}
                                                                />
                                                            ) : (
                                                                <ImageIcon size={16} className="text-muted" />
                                                            )}
                                                        </div>
                                                        <span className="fw-semibold">{academy.academy_name}</span>
                                                    </div>
                                                </td>
                                                <td>{academy.academy_code}</td>
                                                <td>
                                                    <div>{academy.contact_person || "No contact person"}</div>
                                                    <small className="text-muted">{academy.phone || academy.email || "No contact info"}</small>
                                                </td>
                                                <td className="text-muted">
                                                    {[academy.city, academy.state].filter(Boolean).join(", ") || "No location"}
                                                </td>
                                                <td>
                                                    <span className={`badge ${academy.status === 1 ? "bg-success" : "bg-secondary"}`}>
                                                        {academy.status === 1 ? "Active" : "Inactive"}
                                                    </span>
                                                </td>
                                                <td className="text-end">
                                                    <div className="btn-group btn-group-sm" role="group">
                                                        <Link href={`/next_panel/academies/${academy.id}`} className="btn btn-outline-primary" aria-label="View academy">
                                                            <ArrowUpRight size={16} />
                                                        </Link>
                                                        {/* {userInfo.permissions.includes("academies.edit") && ( */}
                                                        <Link href={`/next_panel/academies/${academy.id}/edit`} className="btn btn-outline-secondary" aria-label="Edit academy">
                                                            <Edit size={16} />
                                                        </Link>
                                                        {/* )}
                                                        {userInfo.permissions.includes("academies.delete") && ( */}
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger"
                                                            onClick={() => handleDelete(academy)}
                                                            disabled={deletingId === academy.id}
                                                            aria-label="Delete academy"
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
                            <div className="mt-3">
                                <Pagination
                                    page={page}
                                    totalPages={totalPages}
                                    total={academies.length}
                                    onPageChange={setPage}
                                    pageSize={PAGE_SIZE}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}