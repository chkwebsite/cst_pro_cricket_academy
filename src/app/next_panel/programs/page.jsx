"use client";

import { Edit, Search, SearchSlash, Trash2, GraduationCap } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import Pagination from "../components/Pagination";

export default function ProgramsPage() {
    // STATES
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [programs, setPrograms] = useState([]);
    const [academies, setAcademies] = useState([]);
    const [branches, setBranches] = useState([]);

    const [search, setSearch] = useState("");
    const [academyId, setAcademyId] = useState("");
    const [branchId, setBranchId] = useState("");
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    // LOAD ACADEMIES (once)
    useEffect(() => {
        const loadAcademies = async () => {
            try {
                const res = await fetch("/api/academies");
                const json = await res.json();
                if (res.ok && json.success)
                    setAcademies(json.data || []);
            } catch {
                // non-fatal for the page — filters just won't populate
            }
        };
        loadAcademies();
    }, []);

    // LOAD BRANCHES WHEN ACADEMY FILTER CHANGES
    useEffect(() => {
        if (!academyId) {
            setBranches([]);
            setBranchId("");
            return;
        }
        const loadBranches = async () => {
            try {
                const res = await fetch(`/api/branch?academy_id=${academyId}`);
                const json = await res.json();
                if (res.ok && json.success) setBranches(json.data || []);
            } catch {
                // non-fatal
            }
        };
        loadBranches();
    }, [academyId]);

    const loadPrograms = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (academyId) params.set("academy_id", academyId);
            if (branchId) params.set("branch_id", branchId);
            if (status !== "") params.set("status", status);

            const query = params.toString();
            const res = await fetch(`/api/programs${query ? `?${query}` : ""}`);
            const json = await res.json();

            if (!res.ok || !json.success) throw new Error(json.message || "Unable to load Programs.");

            setPrograms(json.data || []);
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPrograms();
        setPage(1);
    }, [academyId, branchId, status]);

    // Client-side text filter — the API has no text search param, so we filter
    // the already-fetched list by program name / code.
    const filteredPrograms = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return programs;
        return programs.filter((item) =>
            item.program_name?.toLowerCase().includes(term) ||
            item.program_code?.toLowerCase().includes(term) ||
            item.program_features?.toLowerCase().includes(term)
        );
    }, [search, programs]);

    const totalPages = Math.ceil(filteredPrograms.length / PAGE_SIZE) || 1;
    const pagedPrograms = filteredPrograms.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleClear = (e) => {
        e.preventDefault();
        setSearch("");
        setAcademyId("");
        setBranchId("");
        setStatus("");
        setPage(1);
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete program "${name}"?`)) return;
        setError(null);
        try {
            const res = await fetch(`/api/programs/${id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Unable to delete program");
            setPrograms((current) => current.filter((p) => p.id !== id));
        } catch (error) {
            setError(error.message);
        }
    };

    const formatFee = (value) => {
        const num = Number(value ?? 0);
        return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <div className="container-fluid">
            <div className="row g-3">
                <div className="col-sm-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center gap-3">
                            <div className="">
                                <h3 className="mb-0"><GraduationCap /> Programs</h3>
                                <p className="text-muted mb-0">Manage academy programs, fees, and branch assignments.</p>
                            </div>
                            <Link href="/next_panel/programs/new" className="btn btn-primary px-4">
                                <GraduationCap size={18} /> Add Program
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
                                placeholder="Search by name or code"
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
                            value={academyId}
                            onChange={(e) => setAcademyId(e.target.value)}
                            style={{ maxWidth: '220px' }}
                        >
                            <option value="">All Academies</option>
                            {academies.map((a) => (
                                <option key={a.id} value={a.id}>{a.academy_name}</option>
                            ))}
                        </select>

                        <select
                            className="form-select"
                            value={branchId}
                            onChange={(e) => setBranchId(e.target.value)}
                            disabled={!academyId}
                            style={{ maxWidth: '220px' }}
                        >
                            <option value="">All Branches</option>
                            {branches.map((b) => (
                                <option key={b.id} value={b.id}>{b.branch_name}</option>
                            ))}
                        </select>

                        <select
                            className="form-select"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            style={{ maxWidth: '180px' }}
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
                        <div className="text-center py-5 text-muted">Loading programs...</div>
                    ) : (
                        filteredPrograms.length === 0 ? (
                            <div className="text-center py-5 text-muted">No programs found yet.</div>
                        ) : (
                            <>
                            <div className="table-responsive">
                                <table className="table align-middle mb-0">
                                    <thead className="table-success">
                                        <tr>
                                            <th>#</th>
                                            <th>Program</th>
                                            <th>Academy</th>
                                            <th>Branch</th>
                                            <th>Program Fee</th>
                                            <th>Reg. Fee</th>
                                            <th>Daily Fee</th>
                                            <th>Kit Fee</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedPrograms.map((item, idx) => (
                                            <tr key={item.id}>
                                                <th>{(page - 1) * PAGE_SIZE + idx + 1}</th>
                                                <td>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div
                                                            className="d-flex align-items-center justify-content-center bg-light rounded-3 border overflow-hidden flex-shrink-0"
                                                            style={{ width: 44, height: 44 }}
                                                        >
                                                            {item.program_image ? (
                                                                <img
                                                                    src={item.program_image.startsWith("/") ? item.program_image : `/images/uploads/programs/${item.program_image}`}
                                                                    alt={item.program_name}
                                                                    className="w-100 h-100"
                                                                    style={{ objectFit: "cover" }}
                                                                />
                                                            ) : (
                                                                <GraduationCap size={20} className="text-muted" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="fw-semibold">{item.program_name}</div>
                                                            {item.program_code && (
                                                                <small className="text-muted d-block">{item.program_code}</small>
                                                            )}
                                                            {item.program_features && (
                                                                <small className="text-muted d-block text-truncate mt-1" style={{ maxWidth: 220 }} title={item.program_features}>
                                                                    <span className="badge bg-light text-secondary border me-1">Features</span>
                                                                    {item.program_features}
                                                                </small>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>{item.academy_name}</td>
                                                <td>{item.branch_name || "—"}</td>
                                                <td>{formatFee(item.program_fee)}</td>
                                                <td>{formatFee(item.registration_fee)}</td>
                                                <td>{formatFee(item.daily_fee)}</td>
                                                <td>{formatFee(item.kit_fee)}</td>
                                                <td>
                                                    <span className={`badge ${item.status === 1 ? "bg-success" : "bg-secondary"}`}>
                                                        {item.status === 1 ? "Active" : "Inactive"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="d-flex justify-content-start gap-2">
                                                        <Link
                                                            href={`/next_panel/programs/${item.id}/edit`}
                                                            className="btn btn-outline-secondary"
                                                            aria-label="Edit program"
                                                        >
                                                            <Edit size={16} />
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger"
                                                            onClick={() => handleDelete(item.id, item.program_name)}
                                                            aria-label="Delete program"
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
                                    total={filteredPrograms.length}
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
