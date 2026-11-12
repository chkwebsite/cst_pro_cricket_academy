"use client";

import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Clock,
    Edit,
    MessageSquare,
    Phone,
    PhoneCall,
    Plus,
    RefreshCw,
    Trash2,
    User,
    X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
    FOLLOWUP_STATUSES,
    STATUS_BADGE,
    formatDate,
    formatDateTime,
} from "../../enquiryHelpers";

export default function StudentEnquiryFollowupPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id;

    const [enquiry, setEnquiry] = useState(null);
    const [followups, setFollowups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    // New Follow-up Form
    const [newStatus, setNewStatus] = useState("Contacted");
    const [newRemarks, setNewRemarks] = useState("");
    const [newNextDate, setNewNextDate] = useState("");
    const [saving, setSaving] = useState(false);

    // Editing Existing Follow-up State
    const [editingFollowup, setEditingFollowup] = useState(null);
    const [editStatus, setEditStatus] = useState("");
    const [editRemarks, setEditRemarks] = useState("");
    const [editNextDate, setEditNextDate] = useState("");
    const [savingEdit, setSavingEdit] = useState(false);

    const loadData = async () => {
        if (!id) return;
        setLoading(true);
        setError("");
        try {
            const [eRes, fRes] = await Promise.all([
                fetch(`/api/student-enquiries/${id}`),
                fetch(`/api/student-enquiries-flowup?enquiry_id=${id}`),
            ]);

            const eJson = await eRes.json();
            const fJson = await fRes.json();

            if (!eRes.ok || !eJson.success) throw new Error(eJson.message || "Failed to load enquiry");
            setEnquiry(eJson.data);

            if (fRes.ok && fJson.success) {
                setFollowups(fJson.data || []);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    const handleCreateFollowup = async (e) => {
        e.preventDefault();
        setError("");
        setNotice("");

        if (!newRemarks.trim()) {
            setError("Please enter conversation remarks / follow-up notes.");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                enquiry_id: Number(id),
                follow_up_date: new Date().toISOString().slice(0, 19).replace("T", " "),
                enquiry_status: newStatus,
                remarks: newRemarks.trim(),
                next_follow_up_date: newNextDate ? newNextDate : null,
            };

            const res = await fetch("/api/student-enquiries-flowup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to add follow-up");
            }

            setNotice(`Follow-up #${json.follow_up_no} added and student enquiry updated!`);
            setNewRemarks("");
            setNewNextDate("");
            loadData();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleOpenEdit = (f) => {
        setEditingFollowup(f);
        setEditStatus(f.enquiry_status);
        setEditRemarks(f.remarks || "");
        setEditNextDate(f.next_follow_up_date ? String(f.next_follow_up_date).slice(0, 10) : "");
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        if (!editingFollowup) return;
        setError("");
        setNotice("");
        setSavingEdit(true);

        try {
            const payload = {
                enquiry_status: editStatus,
                remarks: editRemarks.trim(),
                next_follow_up_date: editNextDate ? editNextDate : null,
            };

            const res = await fetch(`/api/student-enquiries-flowup/${editingFollowup.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to update follow-up");

            setNotice("Follow-up updated successfully and parent enquiry synced!");
            setEditingFollowup(null);
            loadData();
        } catch (err) {
            setError(err.message);
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDeleteFollowup = async (fId) => {
        if (!confirm("Are you sure you want to delete this follow-up record? Remaining follow-ups will be re-sequenced and parent enquiry re-synced.")) {
            return;
        }

        setError("");
        setNotice("");
        try {
            const res = await fetch(`/api/student-enquiries-flowup/${fId}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete follow-up");

            setNotice("Follow-up removed and enquiry synchronized.");
            loadData();
        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) {
        return (
            <div className="container-fluid py-5 text-center text-muted">
                <RefreshCw className="spinner-border spinner-border-sm me-2" /> Loading follow-up details...
            </div>
        );
    }

    if (!enquiry) {
        return (
            <div className="container-fluid py-4">
                <div className="alert alert-danger">
                    Enquiry not found.{" "}
                    <Link href="/next_panel/student-enquiries" className="alert-link">
                        Back to Enquiries
                    </Link>
                </div>
            </div>
        );
    }

    const followupsCount = followups.length;
    const isMax = followupsCount >= 5;
    const isClosed = ["Converted", "Not Interested", "Closed"].includes(enquiry.enquiry_status);

    return (
        <div className="container-fluid">
            <div className="row g-3">
                {/* Top Nav */}
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-2">
                        <Link href="/next_panel/student-enquiries" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to Student Enquiries
                        </Link>
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <div>
                                <h3 className="mb-1 d-flex align-items-center gap-2">
                                    <PhoneCall className="text-primary" /> Follow-up Timeline: {enquiry.student_name}
                                </h3>
                                <p className="text-muted mb-0">
                                    Track interaction calls, notes, status progressions, and schedule future follow-ups.
                                </p>
                            </div>
                            <span className={`badge fs-6 px-3 py-2 ${STATUS_BADGE[enquiry.enquiry_status]}`}>
                                Status: {enquiry.enquiry_status}
                            </span>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="col-12">
                        <div className="alert alert-danger">{error}</div>
                    </div>
                )}
                {notice && (
                    <div className="col-12">
                        <div className="alert alert-success">{notice}</div>
                    </div>
                )}

                {/* Enquiry Profile Card */}
                <div className="col-12">
                    <div className="card border-0 rounded-4 shadow-sm p-4 bg-white">
                        <div className="row g-3">
                            <div className="col-md-3 col-6">
                                <div className="text-muted small">Student Name</div>
                                <div className="fw-bold fs-6">{enquiry.student_name}</div>
                                {enquiry.age && <small className="text-muted">Age: {enquiry.age} yrs</small>}
                            </div>
                            <div className="col-md-3 col-6">
                                <div className="text-muted small">Phone Number</div>
                                <a href={`tel:${enquiry.phone}`} className="fw-bold text-primary text-decoration-none">
                                    {enquiry.phone}
                                </a>
                                {enquiry.email && <div className="text-muted small">{enquiry.email}</div>}
                            </div>
                            <div className="col-md-3 col-6">
                                <div className="text-muted small">Branch &amp; Program</div>
                                <div className="fw-semibold">{enquiry.branch_name || "Any Branch"}</div>
                                <small className="text-muted">{enquiry.program_name || "General Enquiry"}</small>
                            </div>
                            <div className="col-md-3 col-6">
                                <div className="text-muted small">Follow-up Quota</div>
                                <div className="fs-5 fw-bold text-dark">
                                    {followupsCount} / 5 used
                                </div>
                                <div className="progress mt-1" style={{ height: "6px" }}>
                                    <div
                                        className={`progress-bar ${followupsCount >= 5 ? "bg-danger" : "bg-primary"}`}
                                        style={{ width: `${(followupsCount / 5) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                            {enquiry.message && (
                                <div className="col-12 pt-2 border-top">
                                    <span className="text-muted small fw-semibold me-2">Original Inquiry:</span>
                                    <span className="text-secondary small">{enquiry.message}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Timeline and Add Form */}
                <div className="col-lg-7">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <h5 className="fw-bold mb-4 d-flex align-items-center gap-2">
                            <Clock size={18} className="text-primary" /> Follow-up Interactions ({followups.length})
                        </h5>

                        {followups.length === 0 ? (
                            <div className="text-center py-5 text-muted bg-light rounded-4">
                                <PhoneCall size={40} className="text-secondary opacity-50 mb-2" />
                                <p className="mb-0">No follow-ups recorded yet. Log the first contact below.</p>
                            </div>
                        ) : (
                            <div className="position-relative ps-4 border-start border-2 border-primary-subtle ms-3">
                                {followups.map((f, idx) => (
                                    <div key={f.id} className="position-relative mb-4">
                                        {/* Dot on timeline */}
                                        <div
                                            className="position-absolute rounded-circle bg-primary"
                                            style={{
                                                width: "14px",
                                                height: "14px",
                                                left: "-23px",
                                                top: "6px",
                                                border: "3px solid #fff",
                                            }}
                                        ></div>

                                        <div className="card border rounded-4 shadow-sm p-3">
                                            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className="badge bg-primary px-2 py-1">
                                                        Follow-up #{f.follow_up_no}
                                                    </span>
                                                    <span className={`badge ${STATUS_BADGE[f.enquiry_status]}`}>
                                                        {f.enquiry_status}
                                                    </span>
                                                </div>
                                                <div className="d-flex gap-1">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-secondary py-0 px-2"
                                                        onClick={() => handleOpenEdit(f)}
                                                        title="Edit this follow-up"
                                                    >
                                                        <Edit size={12} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger py-0 px-2"
                                                        onClick={() => handleDeleteFollowup(f.id)}
                                                        title="Delete this follow-up"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="text-dark my-2" style={{ whiteSpace: "pre-wrap" }}>
                                                {f.remarks}
                                            </div>

                                            <div className="text-muted small d-flex flex-wrap gap-3 pt-2 border-top">
                                                <span>Logged: {formatDateTime(f.follow_up_date)}</span>
                                                {f.next_follow_up_date && (
                                                    <span className="text-danger fw-semibold">
                                                        Next Call: {formatDate(f.next_follow_up_date)}
                                                    </span>
                                                )}
                                                {f.created_by_name && <span>By: {f.created_by_name}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Form: Record New Follow-up or Edit */}
                <div className="col-lg-5">
                    {editingFollowup ? (
                        <div className="card border-0 rounded-4 shadow-sm p-4 bg-white">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h5 className="fw-bold mb-0">Edit Follow-up #{editingFollowup.follow_up_no}</h5>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-close"
                                    onClick={() => setEditingFollowup(null)}
                                ></button>
                            </div>
                            <form onSubmit={handleSaveEdit}>
                                <div className="mb-3">
                                    <label className="form-label fw-semibold small">Enquiry Status</label>
                                    <select
                                        className="form-select"
                                        value={editStatus}
                                        onChange={(e) => setEditStatus(e.target.value)}
                                        required
                                    >
                                        {FOLLOWUP_STATUSES.map((st) => (
                                            <option key={st} value={st}>
                                                {st}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="mb-3">
                                    <label className="form-label fw-semibold small">Next Follow-up Date</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={editNextDate}
                                        onChange={(e) => setEditNextDate(e.target.value)}
                                    />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label fw-semibold small">Discussion Remarks</label>
                                    <textarea
                                        className="form-control"
                                        rows={4}
                                        value={editRemarks}
                                        onChange={(e) => setEditRemarks(e.target.value)}
                                        required
                                    ></textarea>
                                </div>
                                <div className="d-flex justify-content-end gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        onClick={() => setEditingFollowup(null)}
                                    >
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                                        {savingEdit ? "Saving..." : "Update Follow-up"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        <div className="card border-0 rounded-4 shadow-sm p-4 bg-white">
                            <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
                                <Plus size={18} className="text-primary" /> Record Follow-up #{followupsCount + 1}
                            </h5>

                            {isMax ? (
                                <div className="alert alert-warning mb-0">
                                    <AlertCircle className="me-2" size={18} />
                                    <strong>Quota Reached:</strong> Maximum 5 follow-ups have been logged for this enquiry.
                                </div>
                            ) : isClosed ? (
                                <div className="alert alert-secondary mb-0">
                                    This enquiry is marked as <strong>{enquiry.enquiry_status}</strong>. Follow-ups are closed.
                                </div>
                            ) : (
                                <form onSubmit={handleCreateFollowup}>
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small">
                                            Update Enquiry Status <span className="text-danger">*</span>
                                        </label>
                                        <select
                                            className="form-select"
                                            value={newStatus}
                                            onChange={(e) => setNewStatus(e.target.value)}
                                            required
                                        >
                                            {FOLLOWUP_STATUSES.map((st) => (
                                                <option key={st} value={st}>
                                                    {st}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small">
                                            Next Follow-up Date (Optional)
                                        </label>
                                        <input
                                            type="date"
                                            className="form-control"
                                            value={newNextDate}
                                            onChange={(e) => setNewNextDate(e.target.value)}
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small">
                                            Follow-up Remarks / Conversation Notes <span className="text-danger">*</span>
                                        </label>
                                        <textarea
                                            className="form-control"
                                            rows={4}
                                            placeholder="Notes on parent call, academy visit outcome, fee discussion, trial date agreed..."
                                            value={newRemarks}
                                            onChange={(e) => setNewRemarks(e.target.value)}
                                            required
                                        ></textarea>
                                    </div>

                                    <button
                                        type="submit"
                                        className="btn btn-primary w-100 py-2"
                                        disabled={saving}
                                    >
                                        {saving ? (
                                            <>
                                                <RefreshCw className="spinner-border spinner-border-sm me-2" /> Saving...
                                            </>
                                        ) : (
                                            "Save Follow-up & Update Enquiry"
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
