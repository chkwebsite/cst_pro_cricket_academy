"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormError, RequiredLabel } from "@/app/components/form";
import {
    Clock,
    Calendar,
    Users,
    UserCheck,
    Save,
    ArrowLeft,
    CheckCircle2,
    AlertCircle,
    Activity,
} from "lucide-react";

const ALL_DAYS = [
    { key: "Monday", label: "Mon" },
    { key: "Tuesday", label: "Tue" },
    { key: "Wednesday", label: "Wed" },
    { key: "Thursday", label: "Thu" },
    { key: "Friday", label: "Fri" },
    { key: "Saturday", label: "Sat" },
    { key: "Sunday", label: "Sun" },
];

const VALID_STATUSES = [
    "Scheduled",
    "Active",
    "On Hold",
    "Completed",
    "Cancelled",
];

export default function IndividualTrainingForm({ id = null, initialUserProgramId = "", initialCoachId = "" }) {
    const router = useRouter();
    const isEdit = Boolean(id);

    // Form fields
    const [academyId, setAcademyId] = useState("");
    const [branchId, setBranchId] = useState("");
    const [userProgramId, setUserProgramId] = useState(initialUserProgramId);
    const [coachUserId, setCoachUserId] = useState(initialCoachId);
    const [selectedDays, setSelectedDays] = useState(["Monday", "Wednesday", "Friday"]);
    const [startTime, setStartTime] = useState("07:00");
    const [endTime, setEndTime] = useState("08:00");
    const [sessionDuration, setSessionDuration] = useState(60);
    const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [endDate, setEndDate] = useState("");
    const [status, setStatus] = useState("Active");
    const [remarks, setRemarks] = useState("");

    // Lookups
    const [academies, setAcademies] = useState([]);
    const [branches, setBranches] = useState([]);
    const [userPrograms, setUserPrograms] = useState([]);
    const [coaches, setCoaches] = useState([]);

    // UI state
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEdit);
    const [loadingEnrollments, setLoadingEnrollments] = useState(false);
    const [error, setError] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});
    const [successMsg, setSuccessMsg] = useState(null);

    const clearError = (field) => {
        if (fieldErrors[field]) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    // 1. Fetch lookups (Academies, Coaches)
    // Listed coaches must either have user_type === 'Coach' OR role_id === 5 in api/user-roles
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [acadRes, userRes, userRolesRes] = await Promise.all([
                    fetch("/api/academies"),
                    fetch("/api/users?status=1"),
                    fetch("/api/user-roles?role_id=5&limit=1000"),
                ]);

                const [acadJson, userJson, userRolesJson] = await Promise.all([
                    acadRes.json().catch(() => ({})),
                    userRes.json().catch(() => ({})),
                    userRolesRes.json().catch(() => ({})),
                ]);

                if (!cancelled) {
                    if (acadRes.ok && acadJson.success) setAcademies(acadJson.data || []);

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
                console.error("Lookups fetch error:", err);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    // 2. Fetch branches when academy changes
    useEffect(() => {
        if (!academyId) {
            setBranches([]);
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/branch?academy_id=${academyId}`);
                const json = await res.json();
                if (!cancelled && res.ok && json.success) {
                    setBranches(json.data || []);
                }
            } catch {
                if (!cancelled) setBranches([]);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [academyId]);

    // 3. Fetch player enrollments when branch changes
    useEffect(() => {
        if (!branchId) {
            setUserPrograms([]);
            return;
        }

        let cancelled = false;
        (async () => {
            setLoadingEnrollments(true);
            try {
                const params = new URLSearchParams();
                params.set("branch_id", branchId);
                params.set("status", "1");
                params.set("limit", "100");

                const res = await fetch(`/api/user-programs?${params.toString()}`);
                const json = await res.json();
                if (!cancelled && res.ok && json.success) {
                    setUserPrograms(json.data || []);
                }
            } catch (err) {
                console.error("Enrollments error:", err);
            } finally {
                if (!cancelled) setLoadingEnrollments(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [branchId]);

    // 4. Load existing training record if editing
    useEffect(() => {
        if (!isEdit) return;

        let cancelled = false;
        (async () => {
            setFetching(true);
            try {
                const res = await fetch(`/api/individual-training/${id}`);
                const json = await res.json();
                if (!cancelled && res.ok && json.success && json.data) {
                    const d = json.data;
                    setAcademyId(d.academy_id || "");
                    setBranchId(d.branch_id || "");
                    setUserProgramId(d.user_program_id || "");
                    setCoachUserId(d.coach_user_id || "");
                    setSelectedDays(
                        d.training_days
                            ? (Array.isArray(d.training_days) ? d.training_days : String(d.training_days).split(","))
                            : []
                    );
                    setStartTime(d.start_time ? String(d.start_time).slice(0, 5) : "07:00");
                    setEndTime(d.end_time ? String(d.end_time).slice(0, 5) : "08:00");
                    setSessionDuration(d.session_duration || 60);
                    setStartDate(d.start_date ? String(d.start_date).slice(0, 10) : "");
                    setEndDate(d.end_date ? String(d.end_date).slice(0, 10) : "");
                    setStatus(d.status || "Active");
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

    // Automatically recalculate duration when start/end times change
    useEffect(() => {
        if (!startTime || !endTime) return;
        const [sh, sm] = startTime.split(":").map(Number);
        const [eh, em] = endTime.split(":").map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;
        if (endMins > startMins) {
            setSessionDuration(endMins - startMins);
        }
    }, [startTime, endTime]);

    // Day toggling
    const toggleDay = (dayKey) => {
        setSelectedDays((prev) =>
            prev.includes(dayKey) ? prev.filter((d) => d !== dayKey) : [...prev, dayKey]
        );
    };

    const handleSelectAllDays = () => setSelectedDays(ALL_DAYS.map((d) => d.key));
    const handleSelectWeekdays = () => setSelectedDays(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
    const handleSelectWeekends = () => setSelectedDays(["Saturday", "Sunday"]);

    // Filter coaches for the selected branch/academy
    const branchCoaches = useMemo(() => {
        if (!branchId) return coaches;
        return coaches.filter(
            (c) =>
                Number(c.id) === Number(coachUserId) ||
                !c.branch_id ||
                Number(c.branch_id) === Number(branchId) ||
                Number(c.academy_id) === Number(academyId)
        );
    }, [coaches, branchId, academyId, coachUserId]);

    const handleBlur = (field) => () => {
        let err = null;
        if (field === "academy_id" && !academyId) err = "Please select an academy.";
        if (field === "branch_id" && !branchId) err = "Please select a branch.";
        if (field === "user_program_id" && !userProgramId) err = "Please select a player program enrollment.";
        if (field === "coach_user_id" && !coachUserId) err = "Please select a personal coach.";
        if (field === "start_time" && !startTime) err = "Please specify start time.";
        if (field === "end_time") {
            if (!endTime) err = "Please specify end time.";
            else if (startTime && startTime >= endTime) err = "End time must be after start time.";
        }
        if (field === "session_duration" && (!sessionDuration || Number(sessionDuration) <= 0)) {
            err = "Duration must be a positive number.";
        }
        if (field === "start_date" && !startDate) err = "Please enter start date.";
        if (field === "end_date" && endDate && startDate && endDate < startDate) {
            err = "End date cannot be earlier than start date.";
        }

        if (err) {
            setFieldErrors((prev) => ({ ...prev, [field]: err }));
        } else {
            clearError(field);
        }
    };

    const validateAll = () => {
        const errors = {};
        if (!academyId) errors.academy_id = "Please select an academy.";
        if (!branchId) errors.branch_id = "Please select a branch.";
        if (!userProgramId) errors.user_program_id = "Please select a player program enrollment.";
        if (!coachUserId) errors.coach_user_id = "Please select a personal coach.";
        if (selectedDays.length === 0) errors.training_days = "Please select at least one training day.";
        if (!startTime) errors.start_time = "Please specify start time.";
        if (!endTime) errors.end_time = "Please specify end time.";
        if (startTime && endTime && startTime >= endTime) {
            errors.end_time = "End time must be after start time.";
        }
        if (!sessionDuration || Number(sessionDuration) <= 0) {
            errors.session_duration = "Duration must be a positive number.";
        }
        if (!startDate) errors.start_date = "Please enter start date.";
        if (endDate && startDate && endDate < startDate) {
            errors.end_date = "End date cannot be earlier than start date.";
        }

        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) {
            const firstKey = Object.keys(errors)[0];
            const el = document.querySelector(`[name="${firstKey}"], #${firstKey}`);
            if (el) {
                el.focus();
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            return false;
        }
        return true;
    };

    // Form submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg(null);

        if (!validateAll()) return;

        setLoading(true);
        try {
            const payload = {
                academy_id: Number(academyId),
                branch_id: Number(branchId),
                user_program_id: Number(userProgramId),
                coach_user_id: Number(coachUserId),
                training_days: selectedDays.join(","),
                start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
                end_time: endTime.length === 5 ? `${endTime}:00` : endTime,
                session_duration: Number(sessionDuration),
                start_date: startDate,
                end_date: endDate || null,
                status,
                remarks: remarks.trim() || null,
            };

            const url = isEdit ? `/api/individual-training/${id}` : "/api/individual-training";
            const method = isEdit ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                if (json.errors && typeof json.errors === "object") {
                    setFieldErrors(json.errors);
                    const firstKey = Object.keys(json.errors)[0];
                    const el = document.querySelector(`[name="${firstKey}"], #${firstKey}`);
                    if (el) {
                        el.focus();
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                }
                throw new Error(json.message || "Failed to save individual training record.");
            }

            setSuccessMsg(isEdit ? "Individual training updated successfully!" : "1:1 Training scheduled successfully!");
            setTimeout(() => {
                router.push(isEdit ? `/next_panel/individual-training/${id}` : "/next_panel/individual-training");
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
                <div className="text-muted mt-2">Loading individual training details...</div>
            </div>
        );
    }

    return (
        <div className="card border-0 shadow-sm">
            <div className="card-header bg-white py-3 border-bottom d-flex align-items-center justify-content-between">
                <div>
                    <h5 className="mb-0 fw-bold">{isEdit ? "Edit 1:1 Individual Training" : "Schedule 1:1 Individual Training"}</h5>
                    <small className="text-muted">
                        Configure dedicated coach allotment, personal session timings, and weekly training schedule.
                    </small>
                </div>
                <Link
                    href={isEdit ? `/next_panel/individual-training/${id}` : "/next_panel/individual-training"}
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

                <form onSubmit={handleSubmit} noValidate>
                    {/* Row 1: Academy & Branch */}
                    <div className="row g-3 mb-3">
                        <div className="col-md-6">
                            <label className="form-label fw-semibold">
                                <RequiredLabel>Academy</RequiredLabel>
                            </label>
                            <select
                                name="academy_id"
                                id="academy_id"
                                className={`form-select ${fieldErrors.academy_id ? "is-invalid border-danger" : ""}`}
                                value={academyId}
                                onChange={(e) => {
                                    setAcademyId(e.target.value);
                                    setBranchId("");
                                    setUserProgramId("");
                                    clearError("academy_id");
                                }}
                                onBlur={handleBlur("academy_id")}
                            >
                                <option value="">-- Select Academy --</option>
                                {academies.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.academy_name}
                                    </option>
                                ))}
                            </select>
                            <FormError error={fieldErrors.academy_id} />
                        </div>

                        <div className="col-md-6">
                            <label className="form-label fw-semibold">
                                <RequiredLabel>Branch</RequiredLabel>
                            </label>
                            <select
                                name="branch_id"
                                id="branch_id"
                                className={`form-select ${fieldErrors.branch_id ? "is-invalid border-danger" : ""}`}
                                value={branchId}
                                onChange={(e) => {
                                    setBranchId(e.target.value);
                                    setUserProgramId("");
                                    clearError("branch_id");
                                }}
                                onBlur={handleBlur("branch_id")}
                                disabled={!academyId}
                            >
                                <option value="">-- Select Branch --</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.branch_name} ({b.branch_code})
                                    </option>
                                ))}
                            </select>
                            <FormError error={fieldErrors.branch_id} />
                        </div>
                    </div>

                    {/* Row 2: Player & Personal Coach */}
                    <div className="row g-3 mb-3">
                        <div className="col-md-6">
                            <label className="form-label fw-semibold">
                                <RequiredLabel>Enrolled Player</RequiredLabel>
                            </label>
                            <select
                                name="user_program_id"
                                id="user_program_id"
                                className={`form-select ${fieldErrors.user_program_id ? "is-invalid border-danger" : ""}`}
                                value={userProgramId}
                                onChange={(e) => {
                                    setUserProgramId(e.target.value);
                                    clearError("user_program_id");
                                }}
                                onBlur={handleBlur("user_program_id")}
                                disabled={!branchId || loadingEnrollments}
                            >
                                <option value="">
                                    {loadingEnrollments
                                        ? "Loading players..."
                                        : !branchId
                                        ? "-- Select branch first --"
                                        : userPrograms.length === 0
                                        ? "No active player enrollments found"
                                        : "-- Select Enrolled Player --"}
                                </option>
                                {userPrograms.map((up) => {
                                    const pName = up.player_name || `${up.first_name || ""} ${up.last_name || ""}`.trim() || `Player #${up.id}`;
                                    const admNo = up.admission_no || up.appointment_no || `ID: ${up.id}`;
                                    return (
                                        <option key={up.id} value={up.id}>
                                            {pName} ({admNo}) — [{up.program_name || `Program #${up.program_id}`}]
                                        </option>
                                    );
                                })}
                            </select>
                            <FormError error={fieldErrors.user_program_id} />
                        </div>

                        <div className="col-md-6">
                            <label className="form-label fw-semibold">
                                <RequiredLabel>Dedicated Coach</RequiredLabel>
                            </label>
                            <select
                                name="coach_user_id"
                                id="coach_user_id"
                                className={`form-select ${fieldErrors.coach_user_id ? "is-invalid border-danger" : ""}`}
                                value={coachUserId}
                                onChange={(e) => {
                                    setCoachUserId(e.target.value);
                                    clearError("coach_user_id");
                                }}
                                onBlur={handleBlur("coach_user_id")}
                            >
                                <option value="">
                                    {branchCoaches.length === 0
                                        ? "-- No coaches available --"
                                        : "-- Select Dedicated Coach --"}
                                </option>
                                {branchCoaches.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.first_name} {c.last_name} ({c.appointment_no || c.email || `ID: ${c.id}`})
                                    </option>
                                ))}
                            </select>
                            <FormError error={fieldErrors.coach_user_id} />
                        </div>
                    </div>

                    {/* Row 3: Timings & Duration */}
                    <div className="row g-3 mb-3">
                        <div className="col-md-4">
                            <label className="form-label fw-semibold d-flex align-items-center gap-1">
                                <Clock size={15} /> <RequiredLabel>Start Time</RequiredLabel>
                            </label>
                            <input
                                type="time"
                                name="start_time"
                                id="start_time"
                                className={`form-control ${fieldErrors.start_time ? "is-invalid border-danger" : ""}`}
                                value={startTime}
                                onChange={(e) => {
                                    setStartTime(e.target.value);
                                    clearError("start_time");
                                }}
                                onBlur={handleBlur("start_time")}
                            />
                            <FormError error={fieldErrors.start_time} />
                        </div>

                        <div className="col-md-4">
                            <label className="form-label fw-semibold d-flex align-items-center gap-1">
                                <Clock size={15} /> <RequiredLabel>End Time</RequiredLabel>
                            </label>
                            <input
                                type="time"
                                name="end_time"
                                id="end_time"
                                className={`form-control ${fieldErrors.end_time ? "is-invalid border-danger" : ""}`}
                                value={endTime}
                                onChange={(e) => {
                                    setEndTime(e.target.value);
                                    clearError("end_time");
                                }}
                                onBlur={handleBlur("end_time")}
                            />
                            <FormError error={fieldErrors.end_time} />
                        </div>

                        <div className="col-md-4">
                            <label className="form-label fw-semibold d-flex align-items-center gap-1">
                                <Activity size={15} /> <RequiredLabel>Duration (Mins)</RequiredLabel>
                            </label>
                            <input
                                type="number"
                                name="session_duration"
                                id="session_duration"
                                className={`form-control ${fieldErrors.session_duration ? "is-invalid border-danger" : ""}`}
                                min="15"
                                max="360"
                                value={sessionDuration}
                                onChange={(e) => {
                                    setSessionDuration(Number(e.target.value));
                                    clearError("session_duration");
                                }}
                                onBlur={handleBlur("session_duration")}
                            />
                            <FormError error={fieldErrors.session_duration} />
                        </div>
                    </div>

                    {/* Row 4: Training Days */}
                    <div className={`mb-3 p-3 bg-light rounded border ${fieldErrors.training_days ? "border-danger" : ""}`}>
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                            <label className="form-label fw-semibold mb-0">
                                <RequiredLabel>Training Days</RequiredLabel>
                            </label>
                            <div className="d-flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleSelectAllDays();
                                        clearError("training_days");
                                    }}
                                    className="btn btn-outline-secondary btn-sm py-0 px-2"
                                    style={{ fontSize: "0.72rem" }}
                                >
                                    All Days
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleSelectWeekdays();
                                        clearError("training_days");
                                    }}
                                    className="btn btn-outline-secondary btn-sm py-0 px-2"
                                    style={{ fontSize: "0.72rem" }}
                                >
                                    Weekdays (Mon-Fri)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleSelectWeekends();
                                        clearError("training_days");
                                    }}
                                    className="btn btn-outline-secondary btn-sm py-0 px-2"
                                    style={{ fontSize: "0.72rem" }}
                                >
                                    Weekends (Sat-Sun)
                                </button>
                            </div>
                        </div>

                        <div className="d-flex flex-wrap gap-2">
                            {ALL_DAYS.map((d) => {
                                const isSelected = selectedDays.includes(d.key);
                                return (
                                    <button
                                        key={d.key}
                                        type="button"
                                        onClick={() => {
                                            toggleDay(d.key);
                                            clearError("training_days");
                                        }}
                                        className={`btn btn-sm px-3 py-1 fw-semibold transition-all ${
                                            isSelected ? "btn-primary shadow-sm" : "btn-outline-secondary bg-white"
                                        }`}
                                    >
                                        {d.label} — {d.key}
                                    </button>
                                );
                            })}
                        </div>
                        <FormError error={fieldErrors.training_days} />
                        <div className="small text-muted mt-2" style={{ fontSize: "0.75rem" }}>
                            Selected days: {selectedDays.join(", ") || "None"}
                        </div>
                    </div>

                    {/* Row 5: Validity Period & Status */}
                    <div className="row g-3 mb-3">
                        <div className="col-md-4">
                            <label className="form-label fw-semibold d-flex align-items-center gap-1">
                                <Calendar size={15} /> <RequiredLabel>Start Date</RequiredLabel>
                            </label>
                            <input
                                type="date"
                                name="start_date"
                                id="start_date"
                                className={`form-control ${fieldErrors.start_date ? "is-invalid border-danger" : ""}`}
                                value={startDate}
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                    clearError("start_date");
                                }}
                                onBlur={handleBlur("start_date")}
                            />
                            <FormError error={fieldErrors.start_date} />
                        </div>

                        <div className="col-md-4">
                            <label className="form-label fw-semibold d-flex align-items-center gap-1">
                                <Calendar size={15} /> End Date
                            </label>
                            <input
                                type="date"
                                name="end_date"
                                id="end_date"
                                className={`form-control ${fieldErrors.end_date ? "is-invalid border-danger" : ""}`}
                                value={endDate}
                                onChange={(e) => {
                                    setEndDate(e.target.value);
                                    clearError("end_date");
                                }}
                                onBlur={handleBlur("end_date")}
                            />
                            <FormError error={fieldErrors.end_date} />
                        </div>

                        <div className="col-md-4">
                            <label className="form-label fw-semibold">Status</label>
                            <select
                                name="status"
                                id="status"
                                className="form-select"
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                            >
                                {VALID_STATUSES.map((st) => (
                                    <option key={st} value={st}>
                                        {st}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Row 6: Remarks */}
                    <div className="mb-4">
                        <label className="form-label fw-semibold">Remarks & Personal Training Goals</label>
                        <textarea
                            className="form-control"
                            rows={3}
                            placeholder="Personalized focus areas (e.g. Front-foot defense, yorker execution, fitness drills, video analysis notes)."
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                        />
                    </div>

                    {/* Submit */}
                    <div className="d-flex align-items-center justify-content-end gap-2 pt-3 border-top">
                        <Link
                            href={isEdit ? `/next_panel/individual-training/${id}` : "/next_panel/individual-training"}
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
                                    <span>Saving Training...</span>
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    <span>{isEdit ? "Update Training" : "Schedule 1:1 Training"}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
