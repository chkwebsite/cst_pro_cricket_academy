"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "../components/UserContext";

const STATUS_OPTIONS = [
    { value: "Present", label: "Present", badge: "bg-success" },
    { value: "Absent", label: "Absent", badge: "bg-danger" },
    { value: "Late", label: "Late", badge: "bg-warning text-dark" },
    { value: "Leave", label: "Leave", badge: "bg-info text-dark" },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function PlayerAttendanceForm({ id = null }) {
    const router = useRouter();
    const isEdit = Boolean(id);
    const { user } = useUser();

    const userAcademyId = user?.academy_id;
    const hasAssignedAcademy =
        userAcademyId !== null && userAcademyId !== undefined && userAcademyId !== "" && Number(userAcademyId) !== 0;

    const [formData, setFormData] = useState({
        user_program_id: "",
        attendance_date: today(),
        attendance_status: "Present",
        remarks: "",
    });

    const [enrollments, setEnrollments] = useState([]);
    const [loadingEnrollments, setLoadingEnrollments] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState("");
    const [existingRecord, setExistingRecord] = useState(null);

    // Fetch active enrollments
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoadingEnrollments(true);
                const params = new URLSearchParams({ limit: "100" });
                if (hasAssignedAcademy) params.set("academy_id", String(userAcademyId));
                const res = await fetch(`/api/user-programs?${params.toString()}`);
                const json = await res.json();
                if (!cancelled && res.ok && json.success) {
                    setEnrollments(Array.isArray(json.data) ? json.data : []);
                }
            } catch {
                if (!cancelled) setEnrollments([]);
            } finally {
                if (!cancelled) setLoadingEnrollments(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [hasAssignedAcademy, userAcademyId]);

    // Fetch existing attendance record in edit mode
    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/player-attendance/${id}`);
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.message || "Failed to load attendance record.");

                const d = json.data;
                setExistingRecord(d);
                setFormData({
                    user_program_id: String(d.user_program_id || ""),
                    attendance_date: d.attendance_date ? d.attendance_date.slice(0, 10) : today(),
                    attendance_status: d.attendance_status || "Present",
                    remarks: d.remarks || "",
                });
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        })();
    }, [id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!formData.user_program_id) {
            return setError("Please select a player enrollment.");
        }
        if (!formData.attendance_date) {
            return setError("Please select an attendance date.");
        }

        try {
            setLoading(true);
            const payload = isEdit
                ? {
                      id: Number(id),
                      attendance_date: formData.attendance_date,
                      attendance_status: formData.attendance_status,
                      remarks: formData.remarks.trim() || null,
                  }
                : {
                      user_program_id: Number(formData.user_program_id),
                      attendance_date: formData.attendance_date,
                      attendance_status: formData.attendance_status,
                      remarks: formData.remarks.trim() || null,
                      marked_by: user?.id || null,
                  };

            const res = await fetch(isEdit ? `/api/player-attendance/${id}` : "/api/player-attendance", {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to save attendance.");
            }

            alert(isEdit ? "Attendance updated successfully." : "Attendance marked successfully.");
            router.push("/next_panel/player-attendance");
            router.refresh();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) return <div className="text-center py-5">Loading attendance details...</div>;

    const selectedEnrollment = enrollments.find((e) => String(e.id) === String(formData.user_program_id));

    return (
        <div className="card shadow-sm">
            <div className="card-header bg-white py-3">
                <h5 className="mb-0">{isEdit ? "Edit Attendance" : "Mark Player Attendance"}</h5>
            </div>

            <div className="card-body p-4">
                {error && <div className="alert alert-danger">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="row g-3">
                        <div className="col-md-6">
                            <label className="form-label fw-semibold">
                                Player Enrollment <span className="text-danger">*</span>
                            </label>
                            {isEdit ? (
                                <input
                                    type="text"
                                    className="form-control bg-light"
                                    value={
                                        existingRecord
                                            ? `${existingRecord.player_name} (${existingRecord.admission_no}) — ${existingRecord.program_name}`
                                            : `Enrollment #${formData.user_program_id}`
                                    }
                                    readOnly
                                />
                            ) : (
                                <select
                                    name="user_program_id"
                                    className="form-select"
                                    value={formData.user_program_id}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="">
                                        {loadingEnrollments ? "Loading player enrollments..." : "Choose Player & Program"}
                                    </option>
                                    {enrollments.map((item) => {
                                        const pName =
                                            item.player_name ||
                                            [item.player_first_name, item.player_last_name].filter(Boolean).join(" ") ||
                                            [item.first_name, item.last_name].filter(Boolean).join(" ") ||
                                            `Player #${item.admission_players_id || item.user_id}`;
                                        const adm = item.admission_no ? `[${item.admission_no}]` : "";
                                        const prog = item.program_name || `Program #${item.program_id}`;
                                        return (
                                            <option key={item.id} value={item.id}>
                                                {pName} {adm} — {prog}
                                            </option>
                                        );
                                    })}
                                </select>
                            )}
                            <div className="form-text">
                                {selectedEnrollment
                                    ? `Branch: ${selectedEnrollment.branch_name || "Main"} · Start: ${selectedEnrollment.start_date || "—"}`
                                    : "Select an active player enrolled in a program."}
                            </div>
                        </div>

                        <div className="col-md-6">
                            <label className="form-label fw-semibold">
                                Attendance Date <span className="text-danger">*</span>
                            </label>
                            <input
                                type="date"
                                name="attendance_date"
                                className="form-control"
                                value={formData.attendance_date}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="col-12">
                            <label className="form-label fw-semibold">
                                Attendance Status <span className="text-danger">*</span>
                            </label>
                            <div className="d-flex flex-wrap gap-3">
                                {STATUS_OPTIONS.map((opt) => (
                                    <label
                                        key={opt.value}
                                        className={`btn ${
                                            formData.attendance_status === opt.value
                                                ? "btn-primary"
                                                : "btn-outline-secondary"
                                        } px-4 py-2 d-flex align-items-center gap-2`}
                                        style={{ cursor: "pointer" }}
                                    >
                                        <input
                                            type="radio"
                                            name="attendance_status"
                                            value={opt.value}
                                            checked={formData.attendance_status === opt.value}
                                            onChange={handleChange}
                                            className="d-none"
                                        />
                                        <span className={`badge ${opt.badge}`}>{opt.value}</span>
                                        <span>{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="col-12">
                            <label className="form-label fw-semibold">Remarks (optional)</label>
                            <textarea
                                name="remarks"
                                rows="3"
                                className="form-control"
                                placeholder="e.g. Arrived 15 minutes late, approved leave, injury, etc."
                                value={formData.remarks}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="d-flex gap-2 mt-4">
                        <button type="submit" className="btn btn-primary px-4" disabled={loading}>
                            {loading ? "Saving..." : isEdit ? "Update Attendance" : "Mark Attendance"}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary px-4"
                            onClick={() => router.push("/next_panel/player-attendance")}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
