"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    CalendarCheck,
    CheckCircle2,
    Clock,
    Edit,
    Filter,
    Plus,
    Search,
    Trash2,
    UserCheck,
    UserX,
    XCircle,
} from "lucide-react";
import { useUser } from "../components/UserContext";

const STATUS_BADGE = {
    Present: "bg-success text-white",
    Absent: "bg-danger text-white",
    Late: "bg-warning text-dark",
    Leave: "bg-info text-dark",
};

export default function PlayerAttendancePage() {
    const { user } = useUser();
    const hasSessionUser = Boolean(user);
    const userAcademyId = user?.academy_id;
    const hasAssignedAcademy =
        userAcademyId !== null && userAcademyId !== undefined && userAcademyId !== "" && Number(userAcademyId) !== 0;

    const [attendanceList, setAttendanceList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    // Filters
    const [search, setSearch] = useState("");
    const [attendanceDate, setAttendanceDate] = useState("");
    const [month, setMonth] = useState("");
    const [status, setStatus] = useState("");
    const [programId, setProgramId] = useState("");
    const [programs, setPrograms] = useState([]);

    // Load programs for filter dropdown
    useEffect(() => {
        if (!hasSessionUser) return;
        (async () => {
            try {
                const res = await fetch("/api/programs");
                const json = await res.json();
                if (res.ok && json.success) setPrograms(json.data || []);
            } catch {
                /* ignore */
            }
        })();
    }, [hasSessionUser]);

    // Fetch attendance records
    const loadAttendance = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (hasAssignedAcademy) params.set("academy_id", String(userAcademyId));
            if (attendanceDate) params.set("attendance_date", attendanceDate);
            if (month) params.set("month", month);
            if (status) params.set("attendance_status", status);
            if (programId) params.set("program_id", programId);
            if (search.trim()) params.set("search", search.trim());

            const res = await fetch(`/api/player-attendance?${params.toString()}`);
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch attendance.");
            setAttendanceList(json.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!hasSessionUser) return;
        loadAttendance();
    }, [hasSessionUser, attendanceDate, month, status, programId]);

    const handleSearch = (e) => {
        e.preventDefault();
        loadAttendance();
    };

    const handleClear = () => {
        setSearch("");
        setAttendanceDate("");
        setMonth("");
        setStatus("");
        setProgramId("");
        setTimeout(loadAttendance, 0);
    };

    const handleDelete = async (item) => {
        if (!confirm(`Delete attendance record for ${item.player_name} on ${item.attendance_date}?`)) return;
        setError(null);
        setNotice(null);
        try {
            const res = await fetch(`/api/player-attendance/${item.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete record.");
            setAttendanceList((prev) => prev.filter((r) => r.id !== item.id));
            setNotice("Attendance record deleted successfully.");
        } catch (err) {
            setError(err.message);
        }
    };

    // Summary counts
    const counts = attendanceList.reduce(
        (acc, item) => {
            acc.total += 1;
            if (item.attendance_status === "Present") acc.present += 1;
            if (item.attendance_status === "Absent") acc.absent += 1;
            if (item.attendance_status === "Late") acc.late += 1;
            if (item.attendance_status === "Leave") acc.leave += 1;
            return acc;
        },
        { total: 0, present: 0, absent: 0, late: 0, leave: 0 }
    );

    return (
        <div className="container-fluid py-4">
            {/* Header */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                    <h1 className="h4 mb-1 d-flex align-items-center gap-2">
                        <CalendarCheck className="text-primary" size={26} />
                        Player Attendance
                    </h1>
                    <p className="text-muted small mb-0">Track and manage player daily attendance across training programs.</p>
                </div>
                <Link href="/next_panel/player-attendance/new" className="btn btn-primary d-flex align-items-center gap-2">
                    <Plus size={18} /> Mark Attendance
                </Link>
            </div>

            {notice && <div className="alert alert-success alert-dismissible fade show">{notice}</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            {/* Statistics Row */}
            <div className="row g-3 mb-4">
                <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 border-start border-primary border-4">
                        <div className="card-body p-3">
                            <div className="text-muted small">Total Marked</div>
                            <div className="h4 fw-bold mb-0 text-dark">{counts.total}</div>
                        </div>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 border-start border-success border-4">
                        <div className="card-body p-3">
                            <div className="text-muted small d-flex align-items-center gap-1">
                                <UserCheck size={14} className="text-success" /> Present
                            </div>
                            <div className="h4 fw-bold mb-0 text-success">{counts.present}</div>
                        </div>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 border-start border-danger border-4">
                        <div className="card-body p-3">
                            <div className="text-muted small d-flex align-items-center gap-1">
                                <UserX size={14} className="text-danger" /> Absent
                            </div>
                            <div className="h4 fw-bold mb-0 text-danger">{counts.absent}</div>
                        </div>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 border-start border-warning border-4">
                        <div className="card-body p-3">
                            <div className="text-muted small d-flex align-items-center gap-1">
                                <Clock size={14} className="text-warning" /> Late / Leave
                            </div>
                            <div className="h4 fw-bold mb-0 text-warning">{counts.late + counts.leave}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="card shadow-sm border-0 mb-4">
                <div className="card-body">
                    <form onSubmit={handleSearch} className="row g-3 align-items-end">
                        <div className="col-md-3">
                            <label className="form-label small fw-semibold">Search Player</label>
                            <div className="input-group">
                                <span className="input-group-text bg-white">
                                    <Search size={16} />
                                </span>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Name, admission no..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="col-md-2">
                            <label className="form-label small fw-semibold">Date</label>
                            <input
                                type="date"
                                className="form-control"
                                value={attendanceDate}
                                onChange={(e) => setAttendanceDate(e.target.value)}
                            />
                        </div>

                        <div className="col-md-2">
                            <label className="form-label small fw-semibold">Month</label>
                            <input
                                type="month"
                                className="form-control"
                                value={month}
                                onChange={(e) => setMonth(e.target.value)}
                            />
                        </div>

                        <div className="col-md-2">
                            <label className="form-label small fw-semibold">Status</label>
                            <select
                                className="form-select"
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                            >
                                <option value="">All Statuses</option>
                                <option value="Present">Present</option>
                                <option value="Absent">Absent</option>
                                <option value="Late">Late</option>
                                <option value="Leave">Leave</option>
                            </select>
                        </div>

                        <div className="col-md-2">
                            <label className="form-label small fw-semibold">Program</label>
                            <select
                                className="form-select"
                                value={programId}
                                onChange={(e) => setProgramId(e.target.value)}
                            >
                                <option value="">All Programs</option>
                                {programs.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.program_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-1 d-flex gap-1">
                            <button type="submit" className="btn btn-primary w-100" title="Apply Search">
                                <Search size={16} />
                            </button>
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={handleClear}
                                title="Clear Filters"
                            >
                                <XCircle size={16} />
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Attendance Table */}
            <div className="card shadow-sm border-0">
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th className="ps-3">Date</th>
                                    <th>Player</th>
                                    <th>Admission No</th>
                                    <th>Program</th>
                                    <th>Status</th>
                                    <th>Marked By</th>
                                    <th>Remarks</th>
                                    <th className="text-end pe-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="8" className="text-center py-5 text-muted">
                                            Loading attendance records...
                                        </td>
                                    </tr>
                                ) : attendanceList.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="text-center py-5 text-muted">
                                            No attendance records found. Click <strong>Mark Attendance</strong> to record one.
                                        </td>
                                    </tr>
                                ) : (
                                    attendanceList.map((item) => (
                                        <tr key={item.id}>
                                            <td className="ps-3 fw-medium">
                                                {item.attendance_date ? item.attendance_date.slice(0, 10) : "—"}
                                            </td>
                                            <td>
                                                <div className="fw-semibold text-dark">{item.player_name || "—"}</div>
                                            </td>
                                            <td>
                                                <span className="badge bg-light text-dark border">
                                                    {item.admission_no || `ID #${item.admission_players_id}`}
                                                </span>
                                            </td>
                                            <td>{item.program_name || "—"}</td>
                                            <td>
                                                <span className={`badge ${STATUS_BADGE[item.attendance_status] || "bg-secondary"}`}>
                                                    {item.attendance_status}
                                                </span>
                                            </td>
                                            <td className="text-muted small">{item.marked_by_name || "—"}</td>
                                            <td className="text-muted small" style={{ maxWidth: 220 }}>
                                                {item.remarks || "—"}
                                            </td>
                                            <td className="text-end pe-3">
                                                <div className="d-flex justify-content-end gap-1">
                                                    <Link
                                                        href={`/next_panel/player-attendance/${item.id}/edit`}
                                                        className="btn btn-sm btn-outline-primary p-1"
                                                        title="Edit Attendance"
                                                    >
                                                        <Edit size={16} />
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger p-1"
                                                        onClick={() => handleDelete(item)}
                                                        title="Delete Record"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
