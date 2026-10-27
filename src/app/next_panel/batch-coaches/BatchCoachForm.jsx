"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    UserCheck,
    Calendar,
    Save,
    ArrowLeft,
    CheckCircle2,
    AlertCircle,
    Layers,
    Shield,
} from "lucide-react";

const COACH_ROLES = [
    "Head Coach",
    "Assistant Coach",
    "Fitness Coach",
    "Specialist Coach",
];

export default function BatchCoachForm({ id = null, initialBatchId = "" }) {
    const router = useRouter();
    const isEdit = Boolean(id);

    // Form fields
    const [batchId, setBatchId] = useState(initialBatchId);
    const [coachUserId, setCoachUserId] = useState("");
    const [coachRole, setCoachRole] = useState("Head Coach");
    const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [endDate, setEndDate] = useState("");
    const [status, setStatus] = useState(1);
    const [remarks, setRemarks] = useState("");

    // Lookups
    const [batches, setBatches] = useState([]);
    const [coaches, setCoaches] = useState([]);

    // UI state
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEdit);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    // 1. Load Batches and Coaches
    // Listed coaches must either have user_type === 'Coach' OR role_id === 5 in api/user-roles
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [batchRes, userRes, userRolesRes] = await Promise.all([
                    fetch("/api/batches?status=1"),
                    fetch("/api/users?status=1"),
                    fetch("/api/user-roles?role_id=5&limit=1000"),
                ]);

                const [batchJson, userJson, userRolesJson] = await Promise.all([
                    batchRes.json().catch(() => ({})),
                    userRes.json().catch(() => ({})),
                    userRolesRes.json().catch(() => ({})),
                ]);

                if (!cancelled) {
                    if (batchRes.ok && batchJson.success) setBatches(batchJson.data || []);

                    // Extract user IDs that have role_id = 5 from /api/user-roles
                    const role5UserIds = new Set(
                        (userRolesJson?.data || [])
                            .filter((ur) => Number(ur.role_id) === 5)
                            .map((ur) => Number(ur.user_id))
                    );

                    // Filter users whose user_type is 'Coach' OR who have role_id = 5 in user-roles
                    const allUsers = (userRes.ok && userJson.success && Array.isArray(userJson.data))
                        ? userJson.data
                        : [];

                    const coachList = allUsers.filter((u) => {
                        const isCoachType = String(u.user_type || "").trim().toLowerCase() === "coach";
                        const hasRole5 = role5UserIds.has(Number(u.id));
                        return isCoachType || hasRole5;
                    });

                    // Ensure any coach user from user-roles (role_id=5) is included if missing from /api/users
                    const existingCoachIds = new Set(coachList.map((c) => Number(c.id)));
                    (userRolesJson?.data || []).forEach((ur) => {
                        if (Number(ur.role_id) === 5 && ur.user_id && !existingCoachIds.has(Number(ur.user_id))) {
                            existingCoachIds.add(Number(ur.user_id));
                            coachList.push({
                                id: ur.user_id,
                                first_name: ur.first_name,
                                last_name: ur.last_name,
                                email: ur.email,
                                user_type: "Coach",
                                role_id: 5,
                            });
                        }
                    });

                    setCoaches(coachList);
                }
            } catch (err) {
                console.error("Lookups error:", err);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    // 2. Load existing assignment if editing
    useEffect(() => {
        if (!isEdit) return;

        let cancelled = false;
        (async () => {
            setFetching(true);
            try {
                const res = await fetch(`/api/batch-coaches/${id}`);
                const json = await res.json();
                if (!cancelled && res.ok && json.success && json.data) {
                    const d = json.data;
                    setBatchId(d.batch_id || "");
                    setCoachUserId(d.coach_user_id || "");
                    setCoachRole(d.coach_role || "Head Coach");
                    setStartDate(d.start_date ? String(d.start_date).slice(0, 10) : "");
                    setEndDate(d.end_date ? String(d.end_date).slice(0, 10) : "");
                    setStatus(d.status !== undefined ? Number(d.status) : 1);
                    setRemarks(d.remarks || "");
                }
            } catch (err) {
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setFetching(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [id, isEdit]);

    // Submit handler
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg(null);

        if (!batchId) return setError("Please select a batch.");
        if (!coachUserId) return setError("Please select a coach.");
        if (!coachRole) return setError("Please select coach role.");
        if (!startDate) return setError("Please select start date.");
        if (endDate && endDate < startDate) {
            return setError("End date cannot be earlier than start date.");
        }

        setLoading(true);
        try {
            const payload = {
                batch_id: Number(batchId),
                coach_user_id: Number(coachUserId),
                coach_role: coachRole,
                start_date: startDate,
                end_date: endDate || null,
                status: Number(status),
                remarks: remarks.trim() || null,
            };

            const url = isEdit ? `/api/batch-coaches/${id}` : "/api/batch-coaches";
            const method = isEdit ? "PUT" : "POST";

            if (isEdit) payload.id = id;

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to save coach assignment.");
            }

            setSuccessMsg(isEdit ? "Coach assignment updated successfully!" : "Coach assigned to batch successfully!");
            setTimeout(() => {
                router.push(batchId ? `/next_panel/batches/${batchId}` : "/next_panel/batch-coaches");
            }, 800);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="card border-0 shadow-sm p-5 text-center">
                <div className="spinner-border text-primary mx-auto" role="status" />
                <div className="text-muted mt-2">Loading coach assignment...</div>
            </div>
        );
    }

    return (
        <div className="card border-0 shadow-sm">
            <div className="card-header bg-white py-3 border-bottom d-flex align-items-center justify-content-between">
                <div>
                    <h5 className="mb-0 fw-bold">{isEdit ? "Edit Coach Assignment" : "Assign Coach to Batch"}</h5>
                    <small className="text-muted">
                        Designate coaching staff, specific training roles, and engagement periods.
                    </small>
                </div>
                <Link
                    href={batchId ? `/next_panel/batches/${batchId}` : "/next_panel/batch-coaches"}
                    className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                >
                    <ArrowLeft size={14} /> Back
                </Link>
            </div>

            <div className="card-body p-4">
                {error && (
                    <div className="alert alert-danger alert-dismissible fade show d-flex align-items-center gap-2" role="alert">
                        <AlertCircle size={18} />
                        <div>{error}</div>
                        <button type="button" className="btn-close ms-auto" onClick={() => setError(null)} />
                    </div>
                )}

                {successMsg && (
                    <div className="alert alert-success alert-dismissible fade show d-flex align-items-center gap-2" role="alert">
                        <CheckCircle2 size={18} />
                        <div>{successMsg}</div>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* Row 1: Batch & Coach */}
                    <div className="row g-3 mb-3">
                        <div className="col-md-6">
                            <label className="form-label fw-semibold">
                                Training Batch <span className="text-danger">*</span>
                            </label>
                            <select
                                className="form-select"
                                value={batchId}
                                onChange={(e) => setBatchId(e.target.value)}
                                required
                            >
                                <option value="">-- Select Training Batch --</option>
                                {batches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.batch_name} ({b.batch_code}) — {b.program_name} [{b.branch_code}]
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-6">
                            <label className="form-label fw-semibold">
                                Coach User <span className="text-danger">*</span>
                            </label>
                            <select
                                className="form-select"
                                value={coachUserId}
                                onChange={(e) => setCoachUserId(e.target.value)}
                                required
                            >
                                <option value="">
                                    {coaches.length === 0
                                        ? "-- No coaches available --"
                                        : "-- Select Coach User --"}
                                </option>
                                {coaches.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.first_name} {c.last_name} ({c.appointment_no || c.email || `ID: ${c.id}`})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Row 2: Coach Role & Status */}
                    <div className="row g-3 mb-3">
                        <div className="col-md-6">
                            <label className="form-label fw-semibold">
                                Coach Role <span className="text-danger">*</span>
                            </label>
                            <select
                                className="form-select"
                                value={coachRole}
                                onChange={(e) => setCoachRole(e.target.value)}
                                required
                            >
                                {COACH_ROLES.map((role) => (
                                    <option key={role} value={role}>
                                        {role}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-6">
                            <label className="form-label fw-semibold">Assignment Status</label>
                            <select
                                className="form-select"
                                value={status}
                                onChange={(e) => setStatus(Number(e.target.value))}
                            >
                                <option value={1}>Active</option>
                                <option value={0}>Inactive</option>
                            </select>
                        </div>
                    </div>

                    {/* Row 3: Dates */}
                    <div className="row g-3 mb-3">
                        <div className="col-md-6">
                            <label className="form-label fw-semibold d-flex align-items-center gap-1">
                                <Calendar size={15} /> Start Date <span className="text-danger">*</span>
                            </label>
                            <input
                                type="date"
                                className="form-control"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                required
                            />
                        </div>

                        <div className="col-md-6">
                            <label className="form-label fw-semibold d-flex align-items-center gap-1">
                                <Calendar size={15} /> End Date (Optional)
                            </label>
                            <input
                                type="date"
                                className="form-control"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                            <div className="form-text" style={{ fontSize: "0.75rem" }}>
                                Leave blank if ongoing/permanent assignment.
                            </div>
                        </div>
                    </div>

                    {/* Row 4: Remarks */}
                    <div className="mb-4">
                        <label className="form-label fw-semibold">Remarks / Responsibilities</label>
                        <textarea
                            className="form-control"
                            rows={3}
                            placeholder="Optional notes regarding training focus (e.g. Batting drills, fast bowling analysis, fielding supervision)."
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                        />
                    </div>

                    {/* Submit */}
                    <div className="d-flex align-items-center justify-content-end gap-2 pt-3 border-top">
                        <Link
                            href={batchId ? `/next_panel/batches/${batchId}` : "/next_panel/batch-coaches"}
                            className="btn btn-outline-secondary"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary d-flex align-items-center gap-2 fw-semibold"
                        >
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm" role="status" />
                                    <span>Saving Assignment...</span>
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    <span>{isEdit ? "Update Assignment" : "Assign Coach"}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
