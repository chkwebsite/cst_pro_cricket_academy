"use client";

import {
    ArrowLeft,
    Calendar,
    Clock,
    Edit,
    ExternalLink,
    MessageSquare,
    PhoneCall,
    RotateCcw,
    Search,
    SearchSlash,
    Trash2,
    Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
    FOLLOWUP_STATUSES,
    STATUS_BADGE,
    formatDate,
    formatDateTime,
} from "../student-enquiries/enquiryHelpers";
import Pagination from "../components/Pagination";

export default function StudentEnquiriesFlowupPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [followups, setFollowups] = useState([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    // Filters
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [reload, setReload] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (statusFilter) params.set("enquiry_status", statusFilter);

                const query = params.toString();
                const res = await fetch(`/api/student-enquiries-flowup${query ? `?${query}` : ""}`, {
                    signal: controller.signal,
                });
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.message || "Failed to load follow-ups");
                setFollowups(json.data || []);
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
    }, [statusFilter, reload]);

    // Client-side text filter (student name, phone, email, remarks)
    const needle = search.trim().toLowerCase();
    const visibleFollowups = useMemo(() => {
        if (!needle) return followups;
        return followups.filter((f) =>
            [f.student_name, f.phone, f.email, f.remarks, `enquiry #${f.enquiry_id}`]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(needle))
        );
    }, [followups, needle]);

    useEffect(() => {
        setPage(1);
    }, [search, statusFilter]);

    const totalPages = Math.ceil(visibleFollowups.length / PAGE_SIZE) || 1;
    const pagedFollowups = visibleFollowups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleClear = (e) => {
        e.preventDefault();
        setSearch("");
        setStatusFilter("");
    };

    const handleDelete = async (item) => {
        if (!confirm(`Delete follow-up #${item.follow_up_no} for ${item.student_name}? Parent enquiry will be re-synchronized.`)) {
            return;
        }

        setError(null);
        setNotice(null);
        try {
            const res = await fetch(`/api/student-enquiries-flowup/${item.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete follow-up");
            setNotice(`Follow-up removed successfully.`);
            setReload((n) => n + 1);
        } catch (err) {
            setError(err.message);
        }
    };

    // Quick Stats
    const stats = useMemo(() => {
        const total = followups.length;
        const converted = followups.filter((f) => f.enquiry_status === "Converted").length;
        const interested = followups.filter((f) => f.enquiry_status === "Interested").length;
        const scheduled = followups.filter((f) => Boolean(f.next_follow_up_date)).length;
        return { total, converted, interested, scheduled };
    }, [followups]);

    return (
        <div className="container-fluid">
            <div className="row g-3">
                {/* Header */}
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-2">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <div>
                                <Link href="/next_panel/student-enquiries" className="btn btn-sm btn-outline-secondary mb-3">
                                    <ArrowLeft size={16} className="me-2" /> Back to Student Enquiries
                                </Link>
                                <h3 className="mb-1 d-flex align-items-center gap-2">
                                    <Clock className="text-primary" /> Enquiry Follow-ups Log
                                </h3>
                                <p className="text-muted mb-0">
                                    Central activity log of all follow-up calls, trial bookings, and conversation updates.
                                </p>
                            </div>
                            <div className="d-flex gap-2">
                                <Link href="/next_panel/student-enquiries" className="btn btn-primary px-3">
                                    <MessageSquare size={16} className="me-1" /> View All Enquiries
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="col-12">
                    <div className="row g-3">
                        <div className="col-6 col-md-3">
                            <div className="bg-white p-3 rounded-4 shadow-sm border-start border-primary border-4">
                                <div className="text-muted small">Total Follow-ups Logged</div>
                                <div className="fs-4 fw-bold">{stats.total}</div>
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <div className="bg-white p-3 rounded-4 shadow-sm border-start border-success border-4">
                                <div className="text-muted small">Converted via Follow-up</div>
                                <div className="fs-4 fw-bold text-success">{stats.converted}</div>
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <div className="bg-white p-3 rounded-4 shadow-sm border-start border-info border-4">
                                <div className="text-muted small">Interested Students</div>
                                <div className="fs-4 fw-bold text-primary">{stats.interested}</div>
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <div className="bg-white p-3 rounded-4 shadow-sm border-start border-warning border-4">
                                <div className="text-muted small">Next Scheduled Calls</div>
                                <div className="fs-4 fw-bold text-warning">{stats.scheduled}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="col-12">
                    <div className="d-flex flex-wrap align-items-center gap-2">
                        <div className="input-group" style={{ maxWidth: "260px" }}>
                            <span className="input-group-text bg-light border-end-0">
                                <Search size={15} />
                            </span>
                            <input
                                type="text"
                                className="form-control border-start-0"
                                placeholder="Student, phone, remarks..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <select
                            className="form-select"
                            style={{ maxWidth: "180px" }}
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">All Statuses</option>
                            {FOLLOWUP_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                    {st}
                                </option>
                            ))}
                        </select>

                        <button
                            type="button"
                            className="btn btn-outline-danger"
                            onClick={handleClear}
                            title="Clear Filters"
                        >
                            <SearchSlash size={16} />
                        </button>

                        <button
                            type="button"
                            className="btn btn-outline-secondary ms-auto"
                            onClick={() => setReload((n) => n + 1)}
                            title="Refresh"
                        >
                            <RotateCcw size={16} />
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="col-12">
                    {error && <div className="alert alert-danger">{error}</div>}
                    {notice && <div className="alert alert-success">{notice}</div>}

                    {loading ? (
                        <div className="text-center py-5 text-muted bg-white rounded-4 shadow-sm">
                            <Clock className="spinner-border spinner-border-sm me-2" /> Loading follow-ups...
                        </div>
                    ) : visibleFollowups.length === 0 ? (
                        <div className="text-center py-5 text-muted bg-white rounded-4 shadow-sm">
                            <p className="mb-2">No follow-up records found.</p>
                            <Link href="/next_panel/student-enquiries" className="btn btn-sm btn-primary">
                                Go to Student Enquiries to log follow-up
                            </Link>
                        </div>
                    ) : (
                        <div className="table-responsive bg-white rounded-4 shadow-sm p-3">
                            <table className="table align-middle table-hover mb-0">
                                <thead className="table-success">
                                    <tr>
                                        <th>Enquiry &amp; Student</th>
                                        <th>Attempt</th>
                                        <th>Status Updated To</th>
                                        <th>Discussion Remarks</th>
                                        <th>Logged Date</th>
                                        <th>Next Call Date</th>
                                        <th>Staff</th>
                                        <th className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedFollowups.map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <div className="fw-bold text-dark">{item.student_name}</div>
                                                <small className="text-muted d-block">
                                                    Enquiry #{item.enquiry_id} · {item.phone}
                                                </small>
                                            </td>
                                            <td>
                                                <span className="badge bg-primary px-2 py-1">
                                                    #{item.follow_up_no} / 5
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge ${STATUS_BADGE[item.enquiry_status]}`}>
                                                    {item.enquiry_status}
                                                </span>
                                            </td>
                                            <td style={{ maxWidth: "320px" }}>
                                                <span className="text-dark small" style={{ whiteSpace: "pre-wrap" }}>
                                                    {item.remarks || "—"}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="small text-muted">
                                                    {formatDateTime(item.follow_up_date)}
                                                </span>
                                            </td>
                                            <td>
                                                {item.next_follow_up_date ? (
                                                    <span className="fw-semibold text-danger small">
                                                        {formatDate(item.next_follow_up_date)}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted">—</span>
                                                )}
                                            </td>
                                            <td>
                                                <span className="small text-muted">{item.created_by_name || "—"}</span>
                                            </td>
                                            <td className="text-end">
                                                <div className="d-flex justify-content-end gap-1">
                                                    <Link
                                                        href={`/next_panel/student-enquiries/${item.enquiry_id}/followup`}
                                                        className="btn btn-sm btn-outline-primary"
                                                        title="Open Timeline"
                                                    >
                                                        <ExternalLink size={14} />
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger"
                                                        onClick={() => handleDelete(item)}
                                                        title="Delete"
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
                        <Pagination
                            page={page}
                            totalPages={totalPages}
                            total={visibleFollowups.length}
                            onPageChange={setPage}
                            pageSize={PAGE_SIZE}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
