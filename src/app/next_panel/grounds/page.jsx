"use client";

import { Edit, Eye, Search, SearchSlash, Trash2, Trees, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useUser } from "../components/UserContext";
import Pagination from "../components/Pagination";

export default function GroundsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [grounds, setGrounds] = useState([]);

    // Filters (all supported server-side by GET /api/ground)
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [status, setStatus] = useState("");
    const [academyId, setAcademyId] = useState("");
    const [academies, setAcademies] = useState([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const {user} = useUser();
    const hasSessionUser = Boolean(user);
    const userAcademyId = user?.academy_id;
    const hasAssignedAcademy =
        userAcademyId !== null &&
        userAcademyId !== undefined &&
        userAcademyId !== "" &&
        Number(userAcademyId) !== 0;
    const effectiveAcademyId = hasAssignedAcademy ? String(userAcademyId) : academyId;

    // Academies for the filter dropdown
    useEffect(() => {
        if (!hasSessionUser) return;

        const loadAcademies = async () => {
            try {
                const res = await fetch("/api/academies");
                const json = await res.json();
                if (res.ok && json.success) {
                    const academyList = Array.isArray(json.data) ? json.data : [];
                    setAcademies(
                        hasAssignedAcademy
                            ? academyList.filter((academy) => Number(academy.id) === Number(userAcademyId))
                            : academyList
                    );
                }
            } catch {
                /* filter just stays empty */
            }
        };
        loadAcademies();
    }, [hasSessionUser, hasAssignedAcademy, userAcademyId]);

    // Debounced fetch so we don't hit the API on every keystroke
    useEffect(() => {
        if (!hasSessionUser) return;

        const controller = new AbortController();

        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (effectiveAcademyId) params.set("academy_id", effectiveAcademyId);
                if (name.trim()) params.set("name", name.trim());
                if (code.trim()) params.set("code", code.trim());
                if (phone.trim()) params.set("phone", phone.trim());
                if (address.trim()) params.set("address", address.trim());
                if (status !== "") params.set("status", status);

                const query = params.toString();
                const res = await fetch(`/api/ground${query ? `?${query}` : ""}`, {
                    signal: controller.signal,
                });
                const json = await res.json();

                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Unable to load Grounds.");
                }
                setGrounds(json.data || []);
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }, 300);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [hasSessionUser, effectiveAcademyId, name, code, phone, address, status]);

    const handleClear = (e) => {
        e.preventDefault();
        setName("");
        setCode("");
        setPhone("");
        setAddress("");
        setStatus("");
        setAcademyId("");
    };

    const handleDelete = async (id, groundName) => {
        if (!confirm(`Delete ground "${groundName}"?`)) return;
        setError(null);
        try {
            const res = await fetch(`/api/ground/${id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to delete ground");
            }
            setGrounds((current) => current.filter((g) => g.id !== id));
        } catch (err) {
            setError(err.message);
        }
    };

    const facilities = (value) =>
        (value || "")
            .split(",")
            .map((f) => f.trim())
            .filter(Boolean);

    const totalPages = Math.ceil(grounds.length / PAGE_SIZE) || 1;
    const pagedGrounds = grounds.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
        <div className="container-fluid">
            <div className="row g-3">
                {/* Header */}
                <div className="col-sm-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center gap-3">
                            <div>
                                <h3 className="mb-0"><Trees /> Grounds</h3>
                                <p className="text-muted mb-0">Manage grounds, contacts, and facilities.</p>
                            </div>
                            <Link href="/next_panel/grounds/new" className="btn btn-primary px-4">
                                <Trees size={18} /> Add Ground
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="col-sm-12">
                    <div className="d-flex flex-wrap align-items-center gap-3">
                        <select
                            className="form-select"
                            value={effectiveAcademyId}
                            disabled={hasAssignedAcademy}
                            onChange={(e) => setAcademyId(e.target.value)}
                            style={{ maxWidth: "220px" }}
                        >
                            {!hasAssignedAcademy && <option value="">All Academies</option>}
                            {academies.map((a) => (
                                <option key={a.id} value={a.id}>{a.academy_name}</option>
                            ))}
                        </select>

                        <div className="input-group" style={{ maxWidth: "260px" }}>
                            <span className="input-group-text bg-white"><Search size={18} /></span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Ground name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        <input
                            type="text"
                            className="form-control"
                            placeholder="Code"
                            style={{ maxWidth: "150px" }}
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                        />

                        <input
                            type="text"
                            className="form-control"
                            placeholder="Phone"
                            style={{ maxWidth: "170px" }}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />

                        <input
                            type="text"
                            className="form-control"
                            placeholder="Address"
                            style={{ maxWidth: "220px" }}
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                        />

                        <select
                            className="form-select"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            style={{ maxWidth: "180px" }}
                        >
                            <option value="">Choose Status</option>
                            <option value="1">Active</option>
                            <option value="0">Inactive</option>
                        </select>

                        <button
                            type="button"
                            className="btn btn-outline-danger"
                            onClick={handleClear}
                            aria-label="Clear filters"
                        >
                            <SearchSlash />
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="col-sm-12">
                    {error && <div className="alert alert-danger">{error}</div>}

                    {loading ? (
                        <div className="text-center py-5 text-muted">Loading grounds...</div>
                    ) : grounds.length === 0 ? (
                        <div className="text-center py-5 text-muted">No grounds found.</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table align-middle mb-0">
                                <thead className="table-success">
                                    <tr>
                                        <th>#</th>
                                        <th>Academy</th>
                                        <th>Ground</th>
                                        <th>Contact</th>
                                        <th>Address</th>
                                        <th>Facilities</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedGrounds.map((item, idx) => (
                                        <tr key={item.id}>
                                            <th>{(page - 1) * PAGE_SIZE + idx + 1}</th>
                                            <td>{item.academy_name || "—"}</td>
                                            <td>
                                                <div>{item.ground_name}</div>
                                                <small className="text-muted">{item.ground_code}</small>
                                            </td>
                                            <td>
                                                <div>{item.contact_person || "—"}</div>
                                                {item.phone && (
                                                    <small className="text-muted d-block">
                                                        <Phone size={12} className="me-1" />{item.phone}
                                                    </small>
                                                )}
                                                {item.email && (
                                                    <small className="text-muted d-block">{item.email}</small>
                                                )}
                                            </td>
                                            <td style={{ maxWidth: "240px" }}>
                                                <MapPin size={14} className="me-1 text-muted" />
                                                {item.address}
                                            </td>
                                            <td style={{ maxWidth: "240px" }}>
                                                {facilities(item.ground_facility).length === 0 ? (
                                                    "—"
                                                ) : (
                                                    <div className="d-flex flex-wrap gap-1">
                                                        {facilities(item.ground_facility).map((f, i) => (
                                                            <span key={i} className="badge text-bg-light border">{f}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <span className={`badge ${Number(item.status) === 1 ? "bg-success" : "bg-secondary"}`}>
                                                    {Number(item.status) === 1 ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="d-flex justify-content-start gap-2">
                                                    <Link
                                                        href={`/next_panel/grounds/${item.id}`}
                                                        className="btn btn-outline-primary"
                                                        aria-label="View ground details"
                                                    >
                                                        <Eye size={16} />
                                                    </Link>
                                                    <Link
                                                        href={`/next_panel/grounds/${item.id}/edit`}
                                                        className="btn btn-outline-secondary"
                                                        aria-label="Edit ground"
                                                    >
                                                        <Edit size={16} />
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-danger"
                                                        onClick={() => handleDelete(item.id, item.ground_name)}
                                                        aria-label="Delete ground"
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

                    {!loading && grounds.length > 0 && (
                        <div className="mt-3">
                            <Pagination
                                page={page}
                                totalPages={totalPages}
                                total={grounds.length}
                                onPageChange={setPage}
                                pageSize={PAGE_SIZE}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
