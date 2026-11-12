"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Clock,
    Calendar,
    Users,
    Layers,
    Save,
    ArrowLeft,
    CheckCircle2,
    AlertCircle,
    Sparkles,
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

export default function BatchForm({ id = null, initialData = null }) {
    const router = useRouter();
    const isEdit = Boolean(id);

    // Form states
    const [academyId, setAcademyId] = useState(initialData?.academy_id || "");
    const [branchId, setBranchId] = useState(initialData?.branch_id || "");
    const [programId, setProgramId] = useState(initialData?.program_id || "");
    const [ageGroupId, setAgeGroupId] = useState(initialData?.age_group_id || "");
    const [batchName, setBatchName] = useState(initialData?.batch_name || "");
    const [batchCode, setBatchCode] = useState(initialData?.batch_code || "");
    const [startTime, setStartTime] = useState(
        initialData?.start_time ? String(initialData.start_time).slice(0, 5) : "06:00"
    );
    const [endTime, setEndTime] = useState(
        initialData?.end_time ? String(initialData.end_time).slice(0, 5) : "08:00"
    );
    const [selectedDays, setSelectedDays] = useState(
        initialData?.training_days
            ? (Array.isArray(initialData.training_days)
                  ? initialData.training_days
                  : String(initialData.training_days).split(","))
            : ["Monday", "Wednesday", "Friday"]
    );
    const [maxPlayers, setMaxPlayers] = useState(initialData?.max_players || 25);
    const [startDate, setStartDate] = useState(
        initialData?.start_date ? String(initialData.start_date).slice(0, 10) : ""
    );
    const [endDate, setEndDate] = useState(
        initialData?.end_date ? String(initialData.end_date).slice(0, 10) : ""
    );
    const [status, setStatus] = useState(initialData?.status !== undefined ? Number(initialData.status) : 1);
    const [remarks, setRemarks] = useState(initialData?.remarks || "");

    // Dropdown lists
    const [academies, setAcademies] = useState([]);
    const [branches, setBranches] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [ageGroups, setAgeGroups] = useState([]);

    // UI state
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEdit && !initialData);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    // 1. Fetch lookup options
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [acadRes, progRes, ageRes] = await Promise.all([
                    fetch("/api/academies"),
                    fetch("/api/programs"),
                    fetch("/api/age-groups?status=1"),
                ]);

                const [acadJson, progJson, ageJson] = await Promise.all([
                    acadRes.json(),
                    progRes.json(),
                    ageRes.json(),
                ]);

                if (!cancelled) {
                    if (acadRes.ok && acadJson.success) setAcademies(acadJson.data || []);
                    if (progRes.ok && progJson.success) setPrograms(progJson.data || []);
                    if (ageRes.ok && ageJson.success) setAgeGroups(ageJson.data || []);
                }
            } catch (err) {
                console.error("Lookup fetch error:", err);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    // 2. Fetch branches when academy is selected
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

    // 3. Fetch initial data if editing and not provided
    useEffect(() => {
        if (!isEdit || initialData) return;

        let cancelled = false;
        (async () => {
            setFetching(true);
            try {
                const res = await fetch(`/api/batches/${id}`);
                const json = await res.json();
                if (!cancelled && res.ok && json.success && json.data) {
                    const d = json.data;
                    setAcademyId(d.academy_id || "");
                    setBranchId(d.branch_id || "");
                    setProgramId(d.program_id || "");
                    setAgeGroupId(d.age_group_id || "");
                    setBatchName(d.batch_name || "");
                    setBatchCode(d.batch_code || "");
                    setStartTime(d.start_time ? String(d.start_time).slice(0, 5) : "06:00");
                    setEndTime(d.end_time ? String(d.end_time).slice(0, 5) : "08:00");
                    setSelectedDays(
                        d.training_days
                            ? (Array.isArray(d.training_days)
                                  ? d.training_days
                                  : String(d.training_days).split(","))
                            : []
                    );
                    setMaxPlayers(d.max_players || 25);
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
    }, [id, isEdit, initialData]);

    // Filter programs applicable to selected academy and branch
    const filteredPrograms = useMemo(() => {
        if (!academyId) return programs;
        return programs.filter(
            (p) =>
                Number(p.academy_id) === Number(academyId) &&
                (!p.branch_id || !branchId || Number(p.branch_id) === Number(branchId))
        );
    }, [programs, academyId, branchId]);

    // Auto-generate batch code
    const handleGenerateCode = () => {
        const branchObj = branches.find((b) => Number(b.id) === Number(branchId));
        const progObj = programs.find((p) => Number(p.id) === Number(programId));
        const ageObj = ageGroups.find((a) => Number(a.id) === Number(ageGroupId));

        const branchCode = branchObj?.branch_code || "BR";
        const progCode = (progObj?.program_name || "PROG").replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
        const ageCode = (ageObj?.age_group || "ALL").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
        const timeSlot = startTime.replace(":", "") || "SLOT";

        const code = `BAT-${branchCode}-${progCode}-${ageCode}-${timeSlot}`.toUpperCase();
        setBatchCode(code);
    };

    // Toggle training day
    const toggleDay = (dayKey) => {
        setSelectedDays((prev) => {
            if (prev.includes(dayKey)) {
                return prev.filter((d) => d !== dayKey);
            } else {
                return [...prev, dayKey];
            }
        });
    };

    const handleSelectAllDays = () => setSelectedDays(ALL_DAYS.map((d) => d.key));
    const handleSelectWeekdays = () => setSelectedDays(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
    const handleSelectWeekends = () => setSelectedDays(["Saturday", "Sunday"]);

    // Form submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg(null);

        // Validation
        if (!academyId) return setError("Please select an academy.");
        if (!branchId) return setError("Please select a branch.");
        if (!programId) return setError("Please select a program.");
        if (!ageGroupId) return setError("Please select an age group.");
        if (!batchName.trim()) return setError("Please enter a batch name.");
        if (!batchCode.trim()) return setError("Please enter a batch code.");
        if (!startTime || !endTime) return setError("Please specify start and end times.");
        if (startTime >= endTime) return setError("End time must be after start time.");
        if (selectedDays.length === 0) return setError("Please select at least one training day.");
        if (Number(maxPlayers) < 1) return setError("Max players must be at least 1.");
        if (startDate && endDate && endDate < startDate) {
            return setError("End date cannot be earlier than start date.");
        }

        setLoading(true);
        try {
            const payload = {
                academy_id: Number(academyId),
                branch_id: Number(branchId),
                program_id: Number(programId),
                age_group_id: Number(ageGroupId),
                batch_name: batchName.trim(),
                batch_code: batchCode.trim(),
                start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
                end_time: endTime.length === 5 ? `${endTime}:00` : endTime,
                training_days: selectedDays.join(","),
                max_players: Number(maxPlayers),
                start_date: startDate || null,
                end_date: endDate || null,
                status: Number(status),
                remarks: remarks.trim() || null,
            };

            const url = isEdit ? `/api/batches/${id}` : "/api/batches";
            const method = isEdit ? "PUT" : "POST";

            if (isEdit) payload.id = id;

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to save batch.");
            }

            setSuccessMsg(isEdit ? "Batch updated successfully!" : "Batch created successfully!");
            setTimeout(() => {
                router.push(isEdit ? `/next_panel/batches/${id}` : "/next_panel/batches");
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
                <div className="text-muted mt-2">Loading batch information...</div>
            </div>
        );
    }

    return (
        <div className="card border-0 shadow-sm">
            <div className="card-header bg-white py-3 border-bottom d-flex align-items-center justify-content-between">
                <div>
                    <h5 className="mb-0 fw-bold">{isEdit ? "Edit Training Batch" : "Create New Training Batch"}</h5>
                    <small className="text-muted">
                        Configure batch schedule, training days, age category, and player capacity.
                    </small>
                </div>
                <Link href={isEdit ? `/next_panel/batches/${id}` : "/next_panel/batches"} className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1">
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
                    {/* Row 1: Academy & Branch */}
                    <div className="row g-3 mb-3">
                        <div className="col-md-6">
                            <label className="form-label fw-semibold">
                                Academy <span className="text-danger">*</span>
                            </label>
                            <select
                                className="form-select"
                                value={academyId}
                                onChange={(e) => {
                                    setAcademyId(e.target.value);
                                    setBranchId("");
                                    setProgramId("");
                                }}
                                required
                            >
                                <option value="">-- Select Academy --</option>
                                {academies.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.academy_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-6">
                            <label className="form-label fw-semibold">
                                Branch <span className="text-danger">*</span>
                            </label>
                            <select
                                className="form-select"
                                value={branchId}
                                onChange={(e) => {
                                    setBranchId(e.target.value);
                                    setProgramId("");
                                }}
                                disabled={!academyId}
                                required
                            >
                                <option value="">-- Select Branch --</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.branch_name} ({b.branch_code})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Row 2: Program & Age Group */}
                    <div className="row g-3 mb-3">
                        <div className="col-md-6">
                            <label className="form-label fw-semibold">
                                Cricket Program <span className="text-danger">*</span>
                            </label>
                            <select
                                className="form-select"
                                value={programId}
                                onChange={(e) => setProgramId(e.target.value)}
                                disabled={!branchId}
                                required
                            >
                                <option value="">-- Select Program --</option>
                                {filteredPrograms.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.program_name} {p.program_fee ? `(₹${p.program_fee}/mo)` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-6">
                            <label className="form-label fw-semibold">
                                Age Group <span className="text-danger">*</span>
                            </label>
                            <select
                                className="form-select"
                                value={ageGroupId}
                                onChange={(e) => setAgeGroupId(e.target.value)}
                                required
                            >
                                <option value="">-- Select Age Group --</option>
                                {ageGroups.map((ag) => (
                                    <option key={ag.id} value={ag.id}>
                                        {ag.age_group} (Ages {ag.min_age} - {ag.max_age})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Row 3: Batch Name & Batch Code */}
                    <div className="row g-3 mb-3">
                        <div className="col-md-6">
                            <label className="form-label fw-semibold">
                                Batch Name <span className="text-danger">*</span>
                            </label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="e.g. Morning Elite U-16 Squad"
                                value={batchName}
                                onChange={(e) => setBatchName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="col-md-6">
                            <div className="d-flex justify-content-between align-items-center">
                                <label className="form-label fw-semibold mb-1">
                                    Batch Code <span className="text-danger">*</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={handleGenerateCode}
                                    className="btn btn-link btn-sm p-0 text-decoration-none d-flex align-items-center gap-1"
                                    style={{ fontSize: "0.78rem" }}
                                    title="Auto generate standard code"
                                >
                                    <Sparkles size={12} /> Auto Generate
                                </button>
                            </div>
                            <input
                                type="text"
                                className="form-control font-monospace"
                                placeholder="e.g. BAT-MAIN-REG-U16-0600"
                                value={batchCode}
                                onChange={(e) => setBatchCode(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* Row 4: Timings & Capacity */}
                    <div className="row g-3 mb-3">
                        <div className="col-md-4">
                            <label className="form-label fw-semibold d-flex align-items-center gap-1">
                                <Clock size={15} /> Start Time <span className="text-danger">*</span>
                            </label>
                            <input
                                type="time"
                                className="form-control"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                required
                            />
                        </div>

                        <div className="col-md-4">
                            <label className="form-label fw-semibold d-flex align-items-center gap-1">
                                <Clock size={15} /> End Time <span className="text-danger">*</span>
                            </label>
                            <input
                                type="time"
                                className="form-control"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                required
                            />
                        </div>

                        <div className="col-md-4">
                            <label className="form-label fw-semibold d-flex align-items-center gap-1">
                                <Users size={15} /> Max Player Capacity <span className="text-danger">*</span>
                            </label>
                            <input
                                type="number"
                                className="form-control"
                                min="1"
                                max="200"
                                value={maxPlayers}
                                onChange={(e) => setMaxPlayers(e.target.value)}
                                required
                            />
                            <div className="form-text" style={{ fontSize: "0.75rem" }}>
                                Batch will reject further assignments once this limit is reached.
                            </div>
                        </div>
                    </div>

                    {/* Row 5: Training Days */}
                    <div className="mb-3 p-3 bg-light rounded border">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                            <label className="form-label fw-semibold mb-0">
                                Training Days <span className="text-danger">*</span>
                            </label>
                            <div className="d-flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleSelectAllDays}
                                    className="btn btn-outline-secondary btn-sm py-0 px-2"
                                    style={{ fontSize: "0.72rem" }}
                                >
                                    All Days
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSelectWeekdays}
                                    className="btn btn-outline-secondary btn-sm py-0 px-2"
                                    style={{ fontSize: "0.72rem" }}
                                >
                                    Weekdays (Mon-Fri)
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSelectWeekends}
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
                                        onClick={() => toggleDay(d.key)}
                                        className={`btn btn-sm px-3 py-1 fw-semibold transition-all ${
                                            isSelected
                                                ? "btn-primary shadow-sm"
                                                : "btn-outline-secondary bg-white"
                                        }`}
                                    >
                                        {d.label} — {d.key}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="small text-muted mt-2" style={{ fontSize: "0.75rem" }}>
                            Selected {selectedDays.length} of 7 days: {selectedDays.join(", ") || "None"}
                        </div>
                    </div>

                    {/* Row 6: Validity Dates & Status */}
                    <div className="row g-3 mb-3">
                        <div className="col-md-4">
                            <label className="form-label fw-semibold d-flex align-items-center gap-1">
                                <Calendar size={15} /> Start Date (Optional)
                            </label>
                            <input
                                type="date"
                                className="form-control"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>

                        <div className="col-md-4">
                            <label className="form-label fw-semibold d-flex align-items-center gap-1">
                                <Calendar size={15} /> End Date (Optional)
                            </label>
                            <input
                                type="date"
                                className="form-control"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>

                        <div className="col-md-4">
                            <label className="form-label fw-semibold">Status</label>
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

                    {/* Row 7: Remarks */}
                    <div className="mb-4">
                        <label className="form-label fw-semibold">Remarks / Coach Notes</label>
                        <textarea
                            className="form-control"
                            rows={3}
                            placeholder="Optional notes regarding ground nets, pitch allotment, equipment, or batch schedule."
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                        />
                    </div>

                    {/* Submit Buttons */}
                    <div className="d-flex align-items-center justify-content-end gap-2 pt-3 border-top">
                        <Link
                            href={isEdit ? `/next_panel/batches/${id}` : "/next_panel/batches"}
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
                                    <span>Saving Batch...</span>
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    <span>{isEdit ? "Update Batch" : "Create Batch"}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
