"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    Clock,
    Calendar,
    Users,
    UserCheck,
    Layers,
    Plus,
    Edit,
    Trash2,
    CheckCircle2,
    AlertCircle,
    UserPlus,
    Shield,
    Phone,
    Mail,
} from "lucide-react";

export default function BatchDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id;

    const [batch, setBatch] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [activeTab, setActiveTab] = useState("players"); // "players" | "coaches"

    const loadBatchDetail = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/batches/${id}`);
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to load batch details.");
            }
            setBatch(json.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!id) return;
        loadBatchDetail();
    }, [id]);

    const handleRemovePlayer = async (assignmentId, playerName) => {
        if (!confirm(`Mark player "${playerName}" as Left from this batch?`)) return;

        try {
            const res = await fetch(`/api/batch-players?id=${assignmentId}`, {
                method: "DELETE",
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to remove player from batch.");
            }
            setNotice(`Player marked as Left successfully.`);
            loadBatchDetail();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleRemoveCoach = async (assignmentId, coachName) => {
        if (!confirm(`Remove coach "${coachName}" from this batch?`)) return;

        try {
            const res = await fetch(`/api/batch-coaches?id=${assignmentId}`, {
                method: "DELETE",
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to remove coach from batch.");
            }
            setNotice(`Coach assignment deactivated successfully.`);
            loadBatchDetail();
        } catch (err) {
            setError(err.message);
        }
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return "";
        const parts = timeStr.split(":");
        let hour = parseInt(parts[0], 10);
        const minute = parts[1] || "00";
        const ampm = hour >= 12 ? "PM" : "AM";
        hour = hour % 12 || 12;
        return `${hour}:${minute} ${ampm}`;
    };

    if (loading) {
        return (
            <div className="container-fluid py-5 text-center">
                <div className="spinner-border text-primary" role="status" />
                <div className="text-muted mt-2">Loading batch information...</div>
            </div>
        );
    }

    if (!batch) {
        return (
            <div className="container-fluid py-5 text-center">
                <AlertCircle size={48} className="text-danger mb-2" />
                <h5>Batch Not Found</h5>
                <Link href="/next_panel/batches" className="btn btn-primary mt-2">
                    Back to Batches
                </Link>
            </div>
        );
    }

    const days = batch.training_days
        ? (Array.isArray(batch.training_days)
              ? batch.training_days
              : String(batch.training_days).split(","))
        : [];

    const activePlayers = (batch.players || []).filter((p) => p.status === "Active");
    const fillPercent = Math.min(
        100,
        Math.round(((activePlayers.length || 0) / (batch.max_players || 1)) * 100)
    );

    return (
        <div className="container-fluid py-4">
            {/* Header Breadcrumb & Actions */}
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
                <div className="d-flex align-items-center gap-3">
                    <Link href="/next_panel/batches" className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1">
                        <ArrowLeft size={14} /> Batches
                    </Link>
                    <div>
                        <div className="d-flex align-items-center gap-2">
                            <h4 className="mb-0 fw-bold">{batch.batch_name}</h4>
                            <span className="badge bg-secondary-subtle text-secondary font-monospace">
                                {batch.batch_code}
                            </span>
                            {Number(batch.status) === 1 ? (
                                <span className="badge bg-success-subtle text-success border border-success">
                                    Active
                                </span>
                            ) : (
                                <span className="badge bg-secondary-subtle text-secondary border">
                                    Inactive
                                </span>
                            )}
                        </div>
                        <small className="text-muted">
                            {batch.program_name} • Age Category: {batch.age_group_name} ({batch.branch_name})
                        </small>
                    </div>
                </div>

                <div className="d-flex flex-wrap gap-2">
                    <Link
                        href={`/next_panel/batch-players/new?batch_id=${batch.id}`}
                        className="btn btn-success d-flex align-items-center gap-1 fw-semibold"
                    >
                        <UserPlus size={16} /> Assign Player
                    </Link>
                    <Link
                        href={`/next_panel/batch-coaches/new?batch_id=${batch.id}`}
                        className="btn btn-info text-white d-flex align-items-center gap-1 fw-semibold"
                    >
                        <UserCheck size={16} /> Assign Coach
                    </Link>
                    <Link
                        href={`/next_panel/batches/${batch.id}/edit`}
                        className="btn btn-outline-primary d-flex align-items-center gap-1"
                    >
                        <Edit size={16} /> Edit Batch
                    </Link>
                </div>
            </div>

            {/* Notifications */}
            {notice && (
                <div className="alert alert-success alert-dismissible fade show d-flex align-items-center gap-2" role="alert">
                    <CheckCircle2 size={18} />
                    <div>{notice}</div>
                    <button type="button" className="btn-close ms-auto" onClick={() => setNotice(null)} />
                </div>
            )}
            {error && (
                <div className="alert alert-danger alert-dismissible fade show d-flex align-items-center gap-2" role="alert">
                    <AlertCircle size={18} />
                    <div>{error}</div>
                    <button type="button" className="btn-close ms-auto" onClick={() => setError(null)} />
                </div>
            )}

            {/* Batch Info Cards Row */}
            <div className="row g-3 mb-4">
                {/* Schedule & Timing Card */}
                <div className="col-lg-4">
                    <div className="card shadow-sm border-0 h-100">
                        <div className="card-body">
                            <h6 className="fw-bold text-muted text-uppercase small mb-3">Schedule & Timings</h6>
                            <div className="d-flex align-items-center gap-2 mb-2">
                                <Clock size={18} className="text-primary" />
                                <span className="fs-5 fw-bold text-dark">
                                    {formatTime(batch.start_time)} – {formatTime(batch.end_time)}
                                </span>
                            </div>
                            <div className="mb-3">
                                <small className="text-muted d-block mb-1">Training Days:</small>
                                <div className="d-flex flex-wrap gap-1">
                                    {days.map((d) => (
                                        <span key={d} className="badge bg-primary-subtle text-primary border border-primary">
                                            {d}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            {(batch.start_date || batch.end_date) && (
                                <div className="small text-muted border-top pt-2">
                                    <Calendar size={13} className="me-1 inline" />
                                    Period: {batch.start_date ? String(batch.start_date).slice(0, 10) : "Open"} –{" "}
                                    {batch.end_date ? String(batch.end_date).slice(0, 10) : "Ongoing"}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Capacity & Enrolled Players Card */}
                <div className="col-lg-4">
                    <div className="card shadow-sm border-0 h-100">
                        <div className="card-body">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <h6 className="fw-bold text-muted text-uppercase small mb-0">Seat Capacity & Fill</h6>
                                <span className={`badge ${fillPercent >= 100 ? "bg-danger" : fillPercent >= 80 ? "bg-warning text-dark" : "bg-success text-white"}`}>
                                    {fillPercent}% Filled
                                </span>
                            </div>
                            <div className="fs-3 fw-bold text-dark mb-1">
                                {activePlayers.length} <span className="fs-6 text-muted font-normal">/ {batch.max_players} Players</span>
                            </div>
                            <div className="progress mb-2" style={{ height: "8px" }}>
                                <div
                                    className={`progress-bar ${fillPercent >= 100 ? "bg-danger" : fillPercent >= 80 ? "bg-warning" : "bg-success"}`}
                                    style={{ width: `${fillPercent}%` }}
                                />
                            </div>
                            <small className="text-muted">
                                {Math.max(0, batch.max_players - activePlayers.length)} seats remaining for enrollment
                            </small>
                        </div>
                    </div>
                </div>

                {/* Academy & Branch Card */}
                <div className="col-lg-4">
                    <div className="card shadow-sm border-0 h-100">
                        <div className="card-body">
                            <h6 className="fw-bold text-muted text-uppercase small mb-3">Facility Details</h6>
                            <div className="fw-bold text-dark mb-1">{batch.academy_name}</div>
                            <div className="text-muted small mb-2">
                                Branch: <strong className="text-dark">{batch.branch_name}</strong> ({batch.branch_code})
                            </div>
                            <div className="text-muted small">
                                Program: <strong className="text-dark">{batch.program_name}</strong>
                            </div>
                            <div className="text-muted small mt-1">
                                Age Category: <span className="badge bg-secondary-subtle text-secondary">{batch.age_group_name}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Roster & Coaches Tabs Card */}
            <div className="card shadow-sm border-0">
                <div className="card-header bg-white border-bottom p-0">
                    <ul className="nav nav-tabs border-0 px-3 pt-2">
                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link border-0 border-bottom border-3 py-3 px-4 fw-semibold ${
                                    activeTab === "players"
                                        ? "border-primary text-primary active"
                                        : "text-muted border-transparent"
                                }`}
                                onClick={() => setActiveTab("players")}
                            >
                                <Users size={16} className="me-2 inline" />
                                Enrolled Players ({batch.players?.length || 0})
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link border-0 border-bottom border-3 py-3 px-4 fw-semibold ${
                                    activeTab === "coaches"
                                        ? "border-primary text-primary active"
                                        : "text-muted border-transparent"
                                }`}
                                onClick={() => setActiveTab("coaches")}
                            >
                                <UserCheck size={16} className="me-2 inline" />
                                Assigned Coaches ({batch.coaches?.length || 0})
                            </button>
                        </li>
                    </ul>
                </div>

                <div className="card-body p-0">
                    {/* TAB 1: Players Roster */}
                    {activeTab === "players" && (
                        <div>
                            {(batch.players || []).length === 0 ? (
                                <div className="text-center py-5">
                                    <Users size={48} className="text-muted mb-2 opacity-50" />
                                    <h6 className="fw-bold text-dark">No Players Assigned Yet</h6>
                                    <p className="text-muted small mb-3">
                                        Assign active player program enrollments to this training batch.
                                    </p>
                                    <Link
                                        href={`/next_panel/batch-players/new?batch_id=${batch.id}`}
                                        className="btn btn-sm btn-primary"
                                    >
                                        <Plus size={14} /> Assign First Player
                                    </Link>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th style={{ width: "40px" }} className="text-center">#</th>
                                                <th>Player Name</th>
                                                <th>Admission No</th>
                                                <th>Phone / Contact</th>
                                                <th>Assigned Period</th>
                                                <th className="text-center">Status</th>
                                                <th className="text-end">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {batch.players.map((p, idx) => (
                                                <tr key={p.assignment_id}>
                                                    <td className="text-center text-muted small">{idx + 1}</td>
                                                    <td>
                                                        <div className="fw-bold text-dark">
                                                            {p.first_name} {p.last_name}
                                                        </div>
                                                        {p.father_name && (
                                                            <div className="small text-muted" style={{ fontSize: "0.74rem" }}>
                                                                S/O {p.father_name}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <span className="badge bg-secondary-subtle text-secondary font-monospace">
                                                            {p.admission_no}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {p.phone ? (
                                                            <span className="text-dark small d-flex align-items-center gap-1">
                                                                <Phone size={12} className="text-muted" /> {p.phone}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted small">—</span>
                                                        )}
                                                    </td>
                                                    <td className="small text-muted">
                                                        {String(p.start_date).slice(0, 10)}
                                                        {p.end_date ? ` to ${String(p.end_date).slice(0, 10)}` : " – Present"}
                                                    </td>
                                                    <td className="text-center">
                                                        <span
                                                            className={`badge ${
                                                                p.status === "Active"
                                                                    ? "bg-success-subtle text-success border border-success"
                                                                    : p.status === "Transferred"
                                                                    ? "bg-warning-subtle text-warning-emphasis border border-warning"
                                                                    : "bg-secondary-subtle text-secondary border"
                                                            }`}
                                                        >
                                                            {p.status}
                                                        </span>
                                                    </td>
                                                    <td className="text-end">
                                                        <div className="d-inline-flex gap-1">
                                                            <Link
                                                                href={`/next_panel/batch-players/${p.assignment_id}/edit`}
                                                                className="btn btn-sm btn-outline-primary p-1"
                                                                title="Edit Assignment / Transfer"
                                                            >
                                                                <Edit size={13} />
                                                            </Link>
                                                            {p.status === "Active" && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemovePlayer(p.assignment_id, `${p.first_name} ${p.last_name}`)}
                                                                    className="btn btn-sm btn-outline-danger p-1"
                                                                    title="Remove from batch"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: Assigned Coaches */}
                    {activeTab === "coaches" && (
                        <div>
                            {(batch.coaches || []).length === 0 ? (
                                <div className="text-center py-5">
                                    <UserCheck size={48} className="text-muted mb-2 opacity-50" />
                                    <h6 className="fw-bold text-dark">No Coaches Assigned Yet</h6>
                                    <p className="text-muted small mb-3">
                                        Assign Head Coach, Assistant, or Fitness Coach to lead this batch.
                                    </p>
                                    <Link
                                        href={`/next_panel/batch-coaches/new?batch_id=${batch.id}`}
                                        className="btn btn-sm btn-info text-white"
                                    >
                                        <Plus size={14} /> Assign First Coach
                                    </Link>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th style={{ width: "40px" }} className="text-center">#</th>
                                                <th>Coach Name</th>
                                                <th>Assigned Role</th>
                                                <th>Contact Info</th>
                                                <th>Assigned Period</th>
                                                <th className="text-center">Status</th>
                                                <th className="text-end">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {batch.coaches.map((c, idx) => (
                                                <tr key={c.assignment_id}>
                                                    <td className="text-center text-muted small">{idx + 1}</td>
                                                    <td>
                                                        <div className="fw-bold text-dark">
                                                            {c.first_name} {c.last_name}
                                                        </div>
                                                        <div className="small text-muted font-monospace" style={{ fontSize: "0.72rem" }}>
                                                            {c.appointment_no}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="badge bg-primary-subtle text-primary border border-primary">
                                                            {c.coach_role}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {c.phone && (
                                                            <div className="small text-dark d-flex align-items-center gap-1">
                                                                <Phone size={12} className="text-muted" /> {c.phone}
                                                            </div>
                                                        )}
                                                        {c.email && (
                                                            <div className="small text-muted d-flex align-items-center gap-1" style={{ fontSize: "0.74rem" }}>
                                                                <Mail size={12} className="text-muted" /> {c.email}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="small text-muted">
                                                        {String(c.start_date).slice(0, 10)}
                                                        {c.end_date ? ` to ${String(c.end_date).slice(0, 10)}` : " – Present"}
                                                    </td>
                                                    <td className="text-center">
                                                        {Number(c.status) === 1 ? (
                                                            <span className="badge bg-success-subtle text-success border border-success">
                                                                Active
                                                            </span>
                                                        ) : (
                                                            <span className="badge bg-secondary-subtle text-secondary border">
                                                                Inactive
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="text-end">
                                                        <div className="d-inline-flex gap-1">
                                                            <Link
                                                                href={`/next_panel/batch-coaches/${c.assignment_id}/edit`}
                                                                className="btn btn-sm btn-outline-primary p-1"
                                                                title="Edit Coach Role / Dates"
                                                            >
                                                                <Edit size={13} />
                                                            </Link>
                                                            {Number(c.status) === 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveCoach(c.assignment_id, `${c.first_name} ${c.last_name}`)}
                                                                    className="btn btn-sm btn-outline-danger p-1"
                                                                    title="Deactivate Coach Assignment"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
