"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    Activity,
    ArrowLeft,
    Clock,
    Calendar,
    Phone,
    UserCheck,
    Users,
    Edit,
    Trash2,
    CheckCircle2,
    AlertCircle,
    Building2,
    Shield,
    Sparkles,
    CreditCard,
    FileText,
} from "lucide-react";

const STATUS_BADGE = {
    Active: "bg-success-subtle text-success border border-success",
    Scheduled: "bg-primary-subtle text-primary border border-primary",
    "On Hold": "bg-warning-subtle text-warning-emphasis border border-warning",
    Completed: "bg-info-subtle text-info border border-info",
    Cancelled: "bg-secondary-subtle text-secondary border",
};

const DAY_ABBR = {
    Monday: "Mon",
    Tuesday: "Tue",
    Wednesday: "Wed",
    Thursday: "Thu",
    Friday: "Fri",
    Saturday: "Sat",
    Sunday: "Sun",
};

export default function IndividualTrainingDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id;

    const [training, setTraining] = useState(null);
    const [loading, setLoading] = useState(true);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    const loadDetail = async () => {
        if (!id) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/individual-training/${id}`);
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to load individual training details.");
            }
            setTraining(json.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDetail();
    }, [id]);

    const handleQuickStatusChange = async (newStatus) => {
        if (!training || training.status === newStatus) return;
        setUpdatingStatus(true);
        setError(null);
        try {
            const res = await fetch(`/api/individual-training/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to update status.");
            }
            setNotice(`Status updated to ${newStatus}.`);
            setTraining((prev) => ({ ...prev, status: newStatus }));
        } catch (err) {
            setError(err.message);
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this individual training session?")) {
            return;
        }
        try {
            const res = await fetch(`/api/individual-training/${id}`, {
                method: "DELETE",
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to delete session.");
            }
            router.push("/next_panel/individual-training");
        } catch (err) {
            setError(err.message);
        }
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return "";
        const parts = String(timeStr).split(":");
        let hour = parseInt(parts[0], 10);
        const minute = parts[1] || "00";
        const ampm = hour >= 12 ? "PM" : "AM";
        hour = hour % 12 || 12;
        return `${hour}:${minute} ${ampm}`;
    };

    const parseDaysList = (daysStr) => {
        if (!daysStr) return [];
        if (Array.isArray(daysStr)) return daysStr;
        return String(daysStr).split(",").map((d) => d.trim()).filter(Boolean);
    };

    if (loading) {
        return (
            <div className="container-fluid py-5 text-center">
                <div className="spinner-border text-primary" role="status" />
                <div className="text-muted mt-2">Loading session details...</div>
            </div>
        );
    }

    if (!training) {
        return (
            <div className="container-fluid py-5">
                <div className="alert alert-warning text-center">
                    <h5>Training session not found</h5>
                    <Link href="/next_panel/individual-training" className="btn btn-outline-primary btn-sm mt-2">
                        Back to List
                    </Link>
                </div>
            </div>
        );
    }

    const playerName =
        `${training.player_first_name || ""} ${training.player_last_name || ""}`.trim() ||
        `Player #${training.user_program_id}`;
    const coachName =
        `${training.coach_first_name || ""} ${training.coach_last_name || ""}`.trim() ||
        `Coach #${training.coach_user_id}`;
    const daysList = parseDaysList(training.training_days);

    return (
        <div className="container-fluid py-4">
            {/* Header */}
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
                <div className="d-flex align-items-center gap-3">
                    <Link
                        href="/next_panel/individual-training"
                        className="btn btn-outline-secondary btn-sm p-2 rounded-circle"
                        title="Back to Training Sessions"
                    >
                        <ArrowLeft size={18} />
                    </Link>
                    <div>
                        <div className="d-flex align-items-center gap-2">
                            <h4 className="fw-bold mb-0 text-dark">1:1 Session #{training.id}</h4>
                            <span className={`badge ${STATUS_BADGE[training.status] || "bg-secondary"}`}>
                                {training.status}
                            </span>
                        </div>
                        <p className="text-muted small mb-0 mt-1">
                            {playerName} &bull; Coach: {coachName}
                        </p>
                    </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <Link
                        href={`/next_panel/individual-training/${training.id}/edit`}
                        className="btn btn-outline-primary d-flex align-items-center gap-1 shadow-sm"
                    >
                        <Edit size={16} /> Edit Session
                    </Link>
                    <button
                        type="button"
                        className="btn btn-outline-danger d-flex align-items-center gap-1 shadow-sm"
                        onClick={handleDelete}
                    >
                        <Trash2 size={16} /> Delete
                    </button>
                </div>
            </div>

            {error && (
                <div className="alert alert-danger alert-dismissible fade show d-flex align-items-center gap-2 mb-4" role="alert">
                    <AlertCircle size={18} />
                    <div>{error}</div>
                    <button type="button" className="btn-close ms-auto" onClick={() => setError(null)} />
                </div>
            )}

            {notice && (
                <div className="alert alert-success alert-dismissible fade show d-flex align-items-center gap-2 mb-4" role="alert">
                    <CheckCircle2 size={18} />
                    <div>{notice}</div>
                    <button type="button" className="btn-close ms-auto" onClick={() => setNotice(null)} />
                </div>
            )}

            {/* Quick Status Bar */}
            <div className="card border-0 shadow-sm mb-4">
                <div className="card-body p-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
                    <div className="small fw-semibold text-muted text-uppercase">Quick Status Transition:</div>
                    <div className="btn-group btn-group-sm flex-wrap" role="group">
                        {["Scheduled", "Active", "On Hold", "Completed", "Cancelled"].map((st) => (
                            <button
                                key={st}
                                type="button"
                                className={`btn ${training.status === st ? "btn-primary active fw-bold" : "btn-outline-secondary"}`}
                                disabled={updatingStatus || training.status === st}
                                onClick={() => handleQuickStatusChange(st)}
                            >
                                {st}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="row g-4">
                {/* Left Column: Player & Coach Profiles */}
                <div className="col-lg-6">
                    {/* Player Info Card */}
                    <div className="card border-0 shadow-sm mb-4 h-100">
                        <div className="card-header bg-white py-3 border-bottom d-flex align-items-center justify-content-between">
                            <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                                <Users size={18} className="text-primary" /> Enrolled Player Profile
                            </h6>
                            <span className="badge bg-light text-secondary border">
                                Adm: {training.admission_no || "N/A"}
                            </span>
                        </div>
                        <div className="card-body p-4">
                            <div className="d-flex align-items-center gap-3 mb-4">
                                <div
                                    className="rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center fw-bold"
                                    style={{ width: "52px", height: "52px", fontSize: "20px" }}
                                >
                                    {(training.player_first_name?.[0] || "P").toUpperCase()}
                                </div>
                                <div>
                                    <h5 className="fw-bold mb-1 text-dark">{playerName}</h5>
                                    <div className="text-muted small">
                                        Program: <strong>{training.program_name || "One-on-One (1:1)"}</strong>
                                    </div>
                                </div>
                            </div>

                            <div className="row g-3">
                                <div className="col-sm-6">
                                    <div className="small text-muted">Phone Number</div>
                                    <div className="fw-medium text-dark d-flex align-items-center gap-1 mt-1">
                                        <Phone size={14} className="text-secondary" />
                                        {training.player_phone || "Not recorded"}
                                    </div>
                                </div>
                                <div className="col-sm-6">
                                    <div className="small text-muted">User Program ID</div>
                                    <div className="fw-medium text-dark mt-1">#{training.user_program_id}</div>
                                </div>
                                <div className="col-sm-6">
                                    <div className="small text-muted">Branch</div>
                                    <div className="fw-medium text-dark mt-1">
                                        {training.branch_code || `Branch #${training.branch_id}`}
                                    </div>
                                </div>
                                <div className="col-sm-6">
                                    <div className="small text-muted">Academy</div>
                                    <div className="fw-medium text-dark mt-1">
                                        {training.academy_name || `Academy #${training.academy_id}`}
                                    </div>
                                </div>
                            </div>

                            <hr className="my-3 text-muted" />

                            <div className="d-flex gap-2 flex-wrap">
                                <Link
                                    href={`/next_panel/player-payments?search=${encodeURIComponent(training.admission_no || "")}`}
                                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                                >
                                    <CreditCard size={14} /> View Payments
                                </Link>
                                <Link
                                    href={`/next_panel/player-attendance?search=${encodeURIComponent(training.admission_no || "")}`}
                                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                                >
                                    <Calendar size={14} /> View Attendance
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Coach & Training Schedule */}
                <div className="col-lg-6">
                    {/* Dedicated Coach Card */}
                    <div className="card border-0 shadow-sm mb-4">
                        <div className="card-header bg-white py-3 border-bottom">
                            <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                                <UserCheck size={18} className="text-success" /> Assigned Personal Coach
                            </h6>
                        </div>
                        <div className="card-body p-4">
                            <div className="d-flex align-items-center gap-3">
                                <div
                                    className="rounded-circle bg-success-subtle text-success d-flex align-items-center justify-content-center fw-bold"
                                    style={{ width: "48px", height: "48px", fontSize: "18px" }}
                                >
                                    {(training.coach_first_name?.[0] || "C").toUpperCase()}
                                </div>
                                <div>
                                    <h5 className="fw-bold mb-1 text-dark">{coachName}</h5>
                                    <div className="text-muted small">
                                        Appointment No: <strong>{training.coach_appointment_no || "N/A"}</strong> &bull; User ID: #{training.coach_user_id}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Weekly Schedule Details */}
                    <div className="card border-0 shadow-sm mb-4">
                        <div className="card-header bg-white py-3 border-bottom">
                            <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                                <Clock size={18} className="text-primary" /> Training Slot & Timings
                            </h6>
                        </div>
                        <div className="card-body p-4">
                            <div className="mb-3">
                                <div className="small text-muted mb-2">Training Days Allotted:</div>
                                <div className="d-flex flex-wrap gap-2">
                                    {daysList.map((day) => (
                                        <span key={day} className="badge bg-primary text-white px-2 py-1">
                                            {day} ({DAY_ABBR[day] || day})
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="row g-3">
                                <div className="col-sm-6">
                                    <div className="small text-muted">Session Time</div>
                                    <div className="fw-bold text-dark mt-1">
                                        {formatTime(training.start_time)} - {formatTime(training.end_time)}
                                    </div>
                                </div>
                                <div className="col-sm-6">
                                    <div className="small text-muted">Duration per Session</div>
                                    <div className="fw-bold text-dark mt-1">
                                        {training.session_duration} Minutes
                                    </div>
                                </div>
                                <div className="col-sm-6">
                                    <div className="small text-muted">Start Date</div>
                                    <div className="fw-medium text-dark mt-1">
                                        {training.start_date ? String(training.start_date).slice(0, 10) : "Immediate"}
                                    </div>
                                </div>
                                <div className="col-sm-6">
                                    <div className="small text-muted">End Date</div>
                                    <div className="fw-medium text-dark mt-1">
                                        {training.end_date ? String(training.end_date).slice(0, 10) : "Open-ended (Ongoing)"}
                                    </div>
                                </div>
                            </div>

                            {training.remarks && (
                                <div className="mt-3 p-3 bg-light rounded-3 small">
                                    <strong>Notes / Remarks:</strong>
                                    <div className="text-muted mt-1">{training.remarks}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
