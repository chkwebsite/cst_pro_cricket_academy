"use client";

import {
    Calendar,
    CheckCircle2,
    Clock,
    Edit,
    Eye,
    MessageSquare,
    PhoneCall,
    Plus,
    PlusCircle,
    RotateCcw,
    Search,
    SearchSlash,
    Trash2,
    UserCheck,
    Users,
    X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
    ENQUIRY_SOURCES,
    ENQUIRY_STATUSES,
    FOLLOWUP_STATUSES,
    SOURCE_BADGE,
    STATUS_BADGE,
    formatDate,
    formatDateTime,
} from "./enquiryHelpers";

export default function StudentEnquiriesPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [enquiries, setEnquiries] = useState([]);
    const [branches, setBranches] = useState([]);
    const [programs, setPrograms] = useState([]);

    // Filters
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [sourceFilter, setSourceFilter] = useState("");
    const [branchFilter, setBranchFilter] = useState("");
    const [programFilter, setProgramFilter] = useState("");
    const [reload, setReload] = useState(0);

    // Detail Modal State
    const [selectedEnquiry, setSelectedEnquiry] = useState(null);

    // Quick Follow-up Modal State
    const [followupModalEnquiry, setFollowupModalEnquiry] = useState(null);
    const [followupsList, setFollowupsList] = useState([]);
    const [loadingFollowups, setLoadingFollowups] = useState(false);
    const [newFollowupStatus, setNewFollowupStatus] = useState("Contacted");
    const [newFollowupRemarks, setNewFollowupRemarks] = useState("");
    const [newNextDate, setNewNextDate] = useState("");
    const [savingFollowup, setSavingFollowup] = useState(false);
    const [followupError, setFollowupError] = useState("");
    const [followupNotice, setFollowupNotice] = useState("");

    // Load branch and program options
    useEffect(() => {
        (async () => {
            try {
                const [bRes, pRes] = await Promise.all([
                    fetch("/api/branch"),
                    fetch("/api/programs"),
                ]);
                const bJson = await bRes.json();
                const pJson = await pRes.json();
                if (bRes.ok && bJson.success) setBranches(bJson.data || []);
                if (pRes.ok && pJson.success) setPrograms(pJson.data || []);
            } catch {
                /* non-fatal */
            }
        })();
    }, []);

    // Load enquiries
    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (search.trim()) params.set("search", search.trim());
                if (statusFilter) params.set("enquiry_status", statusFilter);
                if (sourceFilter) params.set("enquiry_source", sourceFilter);
                if (branchFilter) params.set("branch_id", branchFilter);
                if (programFilter) params.set("program_id", programFilter);

                const query = params.toString();
                const res = await fetch(`/api/student-enquiries${query ? `?${query}` : ""}`, {
                    signal: controller.signal,
                });
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to load enquiries");
                }
                setEnquiries(json.data || []);
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
    }, [search, statusFilter, sourceFilter, branchFilter, programFilter, reload]);

    const handleClear = (e) => {
        e.preventDefault();
        setSearch("");
        setStatusFilter("");
        setSourceFilter("");
        setBranchFilter("");
        setProgramFilter("");
    };

    const handleDelete = async (item) => {
        if (!confirm(`Are you sure you want to delete enquiry for "${item.student_name}"?`)) return;
        setError(null);
        setNotice(null);
        try {
            const res = await fetch(`/api/student-enquiries/${item.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete enquiry");
            setNotice(`Enquiry for "${item.student_name}" deleted successfully.`);
            setReload((n) => n + 1);
        } catch (err) {
            setError(err.message);
        }
    };

    // Open Quick Follow-up Modal
    const handleOpenFollowupModal = async (enquiry) => {
        setFollowupModalEnquiry(enquiry);
        setFollowupError("");
        setFollowupNotice("");
        setNewFollowupRemarks("");
        setNewNextDate("");
        setNewFollowupStatus(
            ["Converted", "Not Interested", "Closed"].includes(enquiry.enquiry_status)
                ? "Contacted"
                : enquiry.enquiry_status === "New"
                ? "Contacted"
                : enquiry.enquiry_status
        );

        setLoadingFollowups(true);
        try {
            const res = await fetch(`/api/student-enquiries-flowup?enquiry_id=${enquiry.id}`);
            const json = await res.json();
            if (res.ok && json.success) {
                setFollowupsList(json.data || []);
            }
        } catch (err) {
            setFollowupError("Failed to load follow-up history");
        } finally {
            setLoadingFollowups(false);
        }
    };

    // Save New Follow-up
    const handleAddFollowup = async (e) => {
        e.preventDefault();
        if (!followupModalEnquiry) return;

        setFollowupError("");
        setFollowupNotice("");

        if (!newFollowupRemarks.trim()) {
            setFollowupError("Please enter follow-up remarks / call notes.");
            return;
        }

        setSavingFollowup(true);
        try {
            const payload = {
                enquiry_id: followupModalEnquiry.id,
                follow_up_date: new Date().toISOString().slice(0, 19).replace("T", " "),
                enquiry_status: newFollowupStatus,
                remarks: newFollowupRemarks.trim(),
                next_follow_up_date: newNextDate ? newNextDate : null,
            };

            const res = await fetch("/api/student-enquiries-flowup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to save follow-up");
            }

            setFollowupNotice(`Follow-up #${json.follow_up_no} recorded successfully!`);
            setNewFollowupRemarks("");
            setNewNextDate("");

            // Refresh followups list
            const refreshRes = await fetch(`/api/student-enquiries-flowup?enquiry_id=${followupModalEnquiry.id}`);
            const refreshJson = await refreshRes.json();
            if (refreshJson.success) {
                setFollowupsList(refreshJson.data || []);
            }

            // Refresh main table
            setReload((n) => n + 1);

            // Update modal enquiry's cached total
            setFollowupModalEnquiry((prev) => ({
                ...prev,
                total_followups: json.total_followups,
                enquiry_status: newFollowupStatus,
            }));
        } catch (err) {
            setFollowupError(err.message);
        } finally {
            setSavingFollowup(false);
        }
    };

    // Aggregate Stats
    const stats = useMemo(() => {
        const total = enquiries.length;
        const newEnq = enquiries.filter((e) => e.enquiry_status === "New").length;
        const activeFollowup = enquiries.filter((e) => ["Contacted", "Follow-up", "Interested"].includes(e.enquiry_status)).length;
        const converted = enquiries.filter((e) => e.enquiry_status === "Converted").length;
        return { total, newEnq, activeFollowup, converted };
    }, [enquiries]);

    return (
        <div className="container-fluid">
            <div className="row g-3">
                {/* Header */}
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-2">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <div>
                                <h3 className="mb-1 d-flex align-items-center gap-2">
                                    <MessageSquare className="text-primary" /> Student Enquiries
                                </h3>
                                <p className="text-muted mb-0">
                                    Manage admission inquiries, web leads, trial requests, and follow-up tracking.
                                </p>
                            </div>
                            <div className="d-flex gap-2">
                                <Link
                                    href="/next_panel/student-enquiries-flowup"
                                    className="btn btn-outline-secondary px-3"
                                >
                                    <Clock size={16} className="me-1" /> All Follow-ups
                                </Link>
                                <Link
                                    href="/next_panel/student-enquiries/new"
                                    className="btn btn-primary px-3"
                                >
                                    <PlusCircle size={18} className="me-1" /> Add Enquiry
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Tiles */}
                <div className="col-12">
                    <div className="row g-3">
                        <div className="col-6 col-md-3">
                            <div className="bg-white p-3 rounded-4 shadow-sm border-start border-primary border-4">
                                <div className="text-muted small">Total Enquiries</div>
                                <div className="fs-4 fw-bold">{stats.total}</div>
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <div className="bg-white p-3 rounded-4 shadow-sm border-start border-info border-4">
                                <div className="text-muted small">New Leads</div>
                                <div className="fs-4 fw-bold text-primary">{stats.newEnq}</div>
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <div className="bg-white p-3 rounded-4 shadow-sm border-start border-warning border-4">
                                <div className="text-muted small">In Follow-up</div>
                                <div className="fs-4 fw-bold text-warning">{stats.activeFollowup}</div>
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <div className="bg-white p-3 rounded-4 shadow-sm border-start border-success border-4">
                                <div className="text-muted small">Converted</div>
                                <div className="fs-4 fw-bold text-success">{stats.converted}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="col-12">
                    <div className="d-flex flex-wrap align-items-center gap-2">
                        <div className="input-group" style={{ maxWidth: "240px" }}>
                            <span className="input-group-text bg-light border-end-0">
                                <Search size={15} />
                            </span>
                            <input
                                type="text"
                                className="form-control border-start-0"
                                placeholder="Name, phone, email..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <select
                            className="form-select"
                            style={{ maxWidth: "160px" }}
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">All Statuses</option>
                            {ENQUIRY_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                    {st}
                                </option>
                            ))}
                        </select>

                        <select
                            className="form-select"
                            style={{ maxWidth: "150px" }}
                            value={sourceFilter}
                            onChange={(e) => setSourceFilter(e.target.value)}
                        >
                            <option value="">All Sources</option>
                            {ENQUIRY_SOURCES.map((src) => (
                                <option key={src} value={src}>
                                    {src}
                                </option>
                            ))}
                        </select>

                        <select
                            className="form-select"
                            style={{ maxWidth: "200px" }}
                            value={branchFilter}
                            onChange={(e) => setBranchFilter(e.target.value)}
                        >
                            <option value="">All Branches</option>
                            {branches.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.branch_name}
                                </option>
                            ))}
                        </select>

                        <select
                            className="form-select"
                            style={{ maxWidth: "180px" }}
                            value={programFilter}
                            onChange={(e) => setProgramFilter(e.target.value)}
                        >
                            <option value="">All Programs</option>
                            {programs.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.program_name}
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
                            <Clock className="spinner-border spinner-border-sm me-2" /> Loading student enquiries...
                        </div>
                    ) : enquiries.length === 0 ? (
                        <div className="text-center py-5 text-muted bg-white rounded-4 shadow-sm">
                            <p className="mb-2">No student enquiries found.</p>
                            <Link href="/next_panel/student-enquiries/new" className="btn btn-sm btn-primary">
                                <PlusCircle size={15} className="me-1" /> Add Enquiry
                            </Link>
                        </div>
                    ) : (
                        <div className="table-responsive bg-white rounded-4 shadow-sm p-3">
                            <table className="table align-middle table-hover mb-0">
                                <thead className="table-success">
                                    <tr>
                                        <th>#</th>
                                        <th>Student</th>
                                        <th>Contact</th>
                                        <th>Branch &amp; Program</th>
                                        <th>Source</th>
                                        <th>Status</th>
                                        <th>Follow-ups</th>
                                        <th className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {enquiries.map((item) => {
                                        const followupsDone = Number(item.total_followups) || 0;
                                        const isClosed = ["Converted", "Not Interested", "Closed"].includes(item.enquiry_status);
                                        const isMaxFollowups = followupsDone >= 5;

                                        return (
                                            <tr key={item.id}>
                                                <td>
                                                    <span className="badge bg-light text-dark border">
                                                        #{item.id}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="fw-bold text-dark">{item.student_name}</div>
                                                    {item.age && (
                                                        <small className="text-muted d-block">
                                                            Age: {item.age} yrs
                                                        </small>
                                                    )}
                                                </td>
                                                <td>
                                                    <a
                                                        href={`tel:${item.phone}`}
                                                        className="text-decoration-none fw-semibold text-primary d-block"
                                                    >
                                                        <PhoneCall size={12} className="me-1" />
                                                        {item.phone}
                                                    </a>
                                                    {item.email && (
                                                        <small className="text-muted">{item.email}</small>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="fw-medium text-dark">
                                                        {item.branch_name || "Any Branch"}
                                                    </div>
                                                    <small className="text-muted">
                                                        {item.program_name || "General Enquiry"}
                                                    </small>
                                                </td>
                                                <td>
                                                    <span className={`badge ${SOURCE_BADGE[item.enquiry_source] || "bg-light text-dark border"}`}>
                                                        {item.enquiry_source}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`badge ${STATUS_BADGE[item.enquiry_status] || "bg-secondary"}`}>
                                                        {item.enquiry_status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span
                                                            className={`badge ${
                                                                followupsDone >= 5
                                                                    ? "bg-danger"
                                                                    : followupsDone > 0
                                                                    ? "bg-warning text-dark"
                                                                    : "bg-light text-muted border"
                                                            }`}
                                                        >
                                                            {followupsDone} / 5
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-primary py-0 px-2"
                                                            style={{ fontSize: "0.75rem" }}
                                                            onClick={() => handleOpenFollowupModal(item)}
                                                            title="View / Add Follow-ups"
                                                        >
                                                            <PhoneCall size={11} className="me-1" /> Follow-up
                                                        </button>
                                                    </div>
                                                    {item.next_follow_up_date && !isClosed && (
                                                        <small className="text-danger d-block mt-1" style={{ fontSize: "0.72rem" }}>
                                                            Next: {formatDate(item.next_follow_up_date)}
                                                        </small>
                                                    )}
                                                </td>
                                                <td className="text-end">
                                                    <div className="d-flex justify-content-end gap-1">
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-info"
                                                            onClick={() => setSelectedEnquiry(item)}
                                                            title="View Details"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        <Link
                                                            href={`/next_panel/student-enquiries/${item.id}/edit`}
                                                            className="btn btn-sm btn-outline-secondary"
                                                            title="Edit Enquiry"
                                                        >
                                                            <Edit size={14} />
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-danger"
                                                            onClick={() => handleDelete(item)}
                                                            title="Delete Enquiry"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* View Details Modal */}
            {selectedEnquiry && (
                <div
                    className="modal fade show d-block"
                    tabIndex="-1"
                    style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
                >
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content rounded-4 border-0 shadow">
                            <div className="modal-header border-bottom">
                                <h5 className="modal-title fw-bold">
                                    Enquiry #{selectedEnquiry.id} - {selectedEnquiry.student_name}
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setSelectedEnquiry(null)}
                                ></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <div className="p-3 bg-light rounded-3">
                                            <div className="text-muted small">Student Name</div>
                                            <div className="fw-bold fs-6">{selectedEnquiry.student_name}</div>
                                            {selectedEnquiry.age && (
                                                <div className="text-muted small mt-1">Age: {selectedEnquiry.age} years</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="p-3 bg-light rounded-3">
                                            <div className="text-muted small">Contact Details</div>
                                            <div className="fw-bold">{selectedEnquiry.phone}</div>
                                            <div className="text-muted small">{selectedEnquiry.email || "No email provided"}</div>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="p-3 bg-light rounded-3">
                                            <div className="text-muted small">Branch &amp; Program</div>
                                            <div className="fw-semibold">{selectedEnquiry.branch_name || "Any Branch"}</div>
                                            <div className="text-muted small">{selectedEnquiry.program_name || "General Enquiry"}</div>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="p-3 bg-light rounded-3">
                                            <div className="text-muted small">Status &amp; Source</div>
                                            <div className="d-flex gap-2 mt-1">
                                                <span className={`badge ${STATUS_BADGE[selectedEnquiry.enquiry_status]}`}>
                                                    {selectedEnquiry.enquiry_status}
                                                </span>
                                                <span className={`badge ${SOURCE_BADGE[selectedEnquiry.enquiry_source]}`}>
                                                    {selectedEnquiry.enquiry_source}
                                                </span>
                                            </div>
                                            <div className="text-muted small mt-2">
                                                Follow-ups: {selectedEnquiry.total_followups} / 5
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-12">
                                        <div className="p-3 bg-light rounded-3">
                                            <div className="text-muted small mb-1">Message / Questions</div>
                                            <div className="text-dark" style={{ whiteSpace: "pre-wrap" }}>
                                                {selectedEnquiry.message || "No message provided."}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-12">
                                        <div className="text-muted small d-flex flex-wrap gap-4">
                                            <span>Created: {formatDateTime(selectedEnquiry.created_at)}</span>
                                            {selectedEnquiry.assigned_to_name && (
                                                <span>Assigned to: {selectedEnquiry.assigned_to_name}</span>
                                            )}
                                            {selectedEnquiry.last_follow_up_date && (
                                                <span>Last Follow-up: {formatDateTime(selectedEnquiry.last_follow_up_date)}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer border-top">
                                <Link
                                    href={`/next_panel/student-enquiries/${selectedEnquiry.id}/followup`}
                                    className="btn btn-outline-primary"
                                    onClick={() => setSelectedEnquiry(null)}
                                >
                                    <Clock size={16} className="me-1" /> View Full Follow-up Timeline
                                </Link>
                                <Link
                                    href={`/next_panel/student-enquiries/${selectedEnquiry.id}/edit`}
                                    className="btn btn-primary"
                                    onClick={() => setSelectedEnquiry(null)}
                                >
                                    <Edit size={16} className="me-1" /> Edit Enquiry
                                </Link>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setSelectedEnquiry(null)}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Follow-up Modal */}
            {followupModalEnquiry && (
                <div
                    className="modal fade show d-block"
                    tabIndex="-1"
                    style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
                >
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content rounded-4 border-0 shadow">
                            <div className="modal-header border-bottom">
                                <div>
                                    <h5 className="modal-title fw-bold mb-0">
                                        Follow-ups: {followupModalEnquiry.student_name}
                                    </h5>
                                    <small className="text-muted">
                                        Enquiry #{followupModalEnquiry.id} · Phone: {followupModalEnquiry.phone} · Current Status:{" "}
                                        <span className={`badge ${STATUS_BADGE[followupModalEnquiry.enquiry_status]}`}>
                                            {followupModalEnquiry.enquiry_status}
                                        </span>
                                    </small>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setFollowupModalEnquiry(null)}
                                ></button>
                            </div>
                            <div className="modal-body p-4">
                                {followupError && <div className="alert alert-danger">{followupError}</div>}
                                {followupNotice && <div className="alert alert-success">{followupNotice}</div>}

                                {/* Quota Banner */}
                                <div className="p-3 mb-4 rounded-3 border bg-light d-flex justify-content-between align-items-center">
                                    <div>
                                        <span className="fw-semibold text-dark">Follow-up Quota:</span>{" "}
                                        <span className="fw-bold text-primary">
                                            {followupsList.length} of 5 used
                                        </span>{" "}
                                        ({5 - followupsList.length} remaining)
                                    </div>
                                    <div>
                                        <Link
                                            href={`/next_panel/student-enquiries/${followupModalEnquiry.id}/followup`}
                                            className="btn btn-sm btn-outline-secondary"
                                            onClick={() => setFollowupModalEnquiry(null)}
                                        >
                                            Open Full Page <Clock size={12} className="ms-1" />
                                        </Link>
                                    </div>
                                </div>

                                {/* Previous Follow-ups Timeline */}
                                <h6 className="fw-bold mb-3">Follow-up History</h6>
                                {loadingFollowups ? (
                                    <div className="text-center py-3 text-muted">Loading follow-ups...</div>
                                ) : followupsList.length === 0 ? (
                                    <div className="text-center py-3 text-muted bg-light rounded-3 mb-4">
                                        No follow-ups recorded yet. Record your first interaction below.
                                    </div>
                                ) : (
                                    <div className="list-group mb-4">
                                        {followupsList.map((f) => (
                                            <div
                                                key={f.id}
                                                className="list-group-item p-3 border rounded-3 mb-2 shadow-sm"
                                            >
                                                <div className="d-flex justify-content-between align-items-start mb-1">
                                                    <span className="badge bg-primary px-2 py-1">
                                                        Follow-up #{f.follow_up_no}
                                                    </span>
                                                    <span className={`badge ${STATUS_BADGE[f.enquiry_status]}`}>
                                                        {f.enquiry_status}
                                                    </span>
                                                </div>
                                                <div className="text-dark mt-2 mb-2" style={{ whiteSpace: "pre-wrap" }}>
                                                    {f.remarks}
                                                </div>
                                                <div className="text-muted small d-flex flex-wrap gap-3">
                                                    <span>Date: {formatDateTime(f.follow_up_date)}</span>
                                                    {f.next_follow_up_date && (
                                                        <span className="text-danger fw-semibold">
                                                            Next Scheduled: {formatDate(f.next_follow_up_date)}
                                                        </span>
                                                    )}
                                                    {f.created_by_name && (
                                                        <span>Logged by: {f.created_by_name}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add Follow-up Form */}
                                {followupsList.length >= 5 ? (
                                    <div className="alert alert-warning mb-0">
                                        <i className="bi bi-info-circle-fill me-2"></i>
                                        <strong>Maximum limit reached:</strong> A maximum of 5 follow-ups is allowed for each enquiry.
                                    </div>
                                ) : ["Converted", "Not Interested", "Closed"].includes(followupModalEnquiry.enquiry_status) ? (
                                    <div className="alert alert-secondary mb-0">
                                        Cannot add new follow-ups because this enquiry is already marked as{" "}
                                        <strong>{followupModalEnquiry.enquiry_status}</strong>.
                                    </div>
                                ) : (
                                    <form onSubmit={handleAddFollowup} className="p-3 bg-light rounded-4 border">
                                        <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                                            <Plus size={16} className="text-primary" /> Record Follow-up #{followupsList.length + 1}
                                        </h6>
                                        <div className="row g-3">
                                            <div className="col-md-6">
                                                <label className="form-label small fw-semibold">
                                                    Updated Enquiry Status <span className="text-danger">*</span>
                                                </label>
                                                <select
                                                    className="form-select"
                                                    value={newFollowupStatus}
                                                    onChange={(e) => setNewFollowupStatus(e.target.value)}
                                                    required
                                                >
                                                    {FOLLOWUP_STATUSES.map((st) => (
                                                        <option key={st} value={st}>
                                                            {st}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label small fw-semibold">
                                                    Next Follow-up Date (Optional)
                                                </label>
                                                <input
                                                    type="date"
                                                    className="form-control"
                                                    value={newNextDate}
                                                    onChange={(e) => setNewNextDate(e.target.value)}
                                                />
                                            </div>
                                            <div className="col-12">
                                                <label className="form-label small fw-semibold">
                                                    Discussion Remarks / Call Notes <span className="text-danger">*</span>
                                                </label>
                                                <textarea
                                                    className="form-control"
                                                    rows={3}
                                                    placeholder="Enter details of conversation with parent/student..."
                                                    value={newFollowupRemarks}
                                                    onChange={(e) => setNewFollowupRemarks(e.target.value)}
                                                    required
                                                ></textarea>
                                            </div>
                                            <div className="col-12 d-flex justify-content-end">
                                                <button
                                                    type="submit"
                                                    className="btn btn-primary px-4"
                                                    disabled={savingFollowup}
                                                >
                                                    {savingFollowup ? "Saving Follow-up..." : "Save Follow-up"}
                                                </button>
                                            </div>
                                        </div>
                                    </form>
                                )}
                            </div>
                            <div className="modal-footer border-top">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setFollowupModalEnquiry(null)}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
