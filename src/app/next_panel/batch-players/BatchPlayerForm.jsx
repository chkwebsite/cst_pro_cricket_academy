"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Users,
    Calendar,
    Save,
    ArrowLeft,
    CheckCircle2,
    AlertCircle,
    Layers,
    Clock,
    UserCheck,
    ArrowRightLeft,
} from "lucide-react";
import { FormError } from "@/app/components/form";

const VALID_STATUSES = ["Active", "Transferred", "Completed", "Left"];

export default function BatchPlayerForm({ id = null, initialBatchId = "" }) {
    const router = useRouter();
    const isEdit = Boolean(id);

    // Form fields
    const [batchId, setBatchId] = useState(initialBatchId);
    const [userProgramId, setUserProgramId] = useState("");
    const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [endDate, setEndDate] = useState("");
    const [status, setStatus] = useState("Active");
    const [remarks, setRemarks] = useState("");

    // Lookups
    const [batches, setBatches] = useState([]);
    const [userPrograms, setUserPrograms] = useState([]);
    const [existingAssignment, setExistingAssignment] = useState(null);

    // UI state
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEdit);
    const [loadingEnrollments, setLoadingEnrollments] = useState(false);
    const [error, setError] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});
    const [successMsg, setSuccessMsg] = useState(null);

    // 1. Load active batches
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/batches?status=1");
                const json = await res.json();
                if (!cancelled && res.ok && json.success) {
                    setBatches(json.data || []);
                }
            } catch (err) {
                console.error("Batches fetch error:", err);
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
                const res = await fetch(`/api/batch-players/${id}`);
                const json = await res.json();
                if (!cancelled && res.ok && json.success && json.data) {
                    const d = json.data;
                    setExistingAssignment(d);
                    setBatchId(d.batch_id || "");
                    setUserProgramId(d.user_program_id || "");
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

    // Selected batch details
    const selectedBatch = useMemo(() => {
        if (!batchId) return null;
        return batches.find((b) => Number(b.id) === Number(batchId)) || null;
    }, [batches, batchId]);

    // 3. Load eligible player program enrollments matching the selected batch
    useEffect(() => {
        if (!batchId || !selectedBatch) return;

        let cancelled = false;
        (async () => {
            setLoadingEnrollments(true);
            try {
                const params = new URLSearchParams();
                params.set("branch_id", String(selectedBatch.branch_id));
                params.set("program_id", String(selectedBatch.program_id));
                params.set("status", "1");
                params.set("limit", "100");

                const res = await fetch(`/api/user-programs?${params.toString()}`);
                const json = await res.json();
                if (!cancelled && res.ok && json.success) {
                    setUserPrograms(json.data || []);
                }
            } catch (err) {
                console.error("Enrollments fetch error:", err);
            } finally {
                if (!cancelled) setLoadingEnrollments(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [batchId, selectedBatch]);

    const validateAll = () => {
        const errs = {};
        if (!batchId) {
            errs.batch_id = "Please select a training batch.";
        }
        if (!userProgramId) {
            errs.user_program_id = "Please select an enrolled player.";
        }
        if (!startDate) {
            errs.start_date = "Please enter assignment start date.";
        }
        if (endDate && startDate && endDate < startDate) {
            errs.end_date = "End date cannot be earlier than start date.";
        }
        if (!status) {
            errs.status = "Please select assignment status.";
        }

        setFieldErrors(errs);
        if (Object.keys(errs).length > 0) {
            const firstKey = Object.keys(errs)[0];
            const el = document.querySelector(`[name="${firstKey}"], #${firstKey}`);
            if (el) {
                el.focus();
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            return false;
        }
        return true;
    };

    const handleBlur = (field) => () => {
        let err = null;
        if (field === "batch_id" && !batchId) err = "Please select a training batch.";
        if (field === "user_program_id" && !userProgramId) err = "Please select an enrolled player.";
        if (field === "start_date" && !startDate) err = "Please enter assignment start date.";
        if (field === "end_date" && endDate && startDate && endDate < startDate) {
            err = "End date cannot be earlier than start date.";
        }
        if (field === "status" && !status) err = "Please select assignment status.";

        if (err) {
            setFieldErrors((prev) => ({ ...prev, [field]: err }));
        } else {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    // Submit handler
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg(null);

        if (!validateAll()) {
            return;
        }

        setLoading(true);
        try {
            const payload = {
                batch_id: Number(batchId),
                user_program_id: Number(userProgramId),
                start_date: startDate,
                end_date: endDate || null,
                status,
                remarks: remarks.trim() || null,
            };

            const url = isEdit ? `/api/batch-players/${id}` : "/api/batch-players";
            const method = isEdit ? "PUT" : "POST";

            if (isEdit) payload.id = id;

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                if (json.errors) {
                    setFieldErrors(json.errors);
                    const firstKey = Object.keys(json.errors)[0];
                    const el = document.querySelector(`[name="${firstKey}"], #${firstKey}`);
                    if (el) {
                        el.focus();
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                }
                throw new Error(json.message || "Failed to save player batch assignment.");
            }

            setSuccessMsg(isEdit ? "Assignment updated successfully!" : "Player assigned to batch successfully!");
            setTimeout(() => {
                router.push(batchId ? `/next_panel/batches/${batchId}` : "/next_panel/batch-players");
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
                <div className="text-muted mt-2">Loading player assignment...</div>
            </div>
        );
    }

    return (
        <div className="card border-0 shadow-sm">
            <div className="card-header bg-white py-3 border-bottom d-flex align-items-center justify-content-between">
                <div>
                    <h5 className="mb-0 fw-bold">{isEdit ? "Edit Player Batch Assignment" : "Assign Player to Training Batch"}</h5>
                    <small className="text-muted">
                        Enroll registered players into their designated timing slot and coaching batch.
                    </small>
                </div>
                <Link
                    href={batchId ? `/next_panel/batches/${batchId}` : "/next_panel/batch-players"}
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
                    {/* Row 1: Batch Selection */}
                    <div className="mb-3">
                        <label className="form-label fw-semibold" htmlFor="batch_id">
                            Training Batch <span className="text-danger">*</span>
                        </label>
                        <select
                            id="batch_id"
                            name="batch_id"
                            className={`form-select ${fieldErrors.batch_id ? "is-invalid border-danger" : ""}`}
                            value={batchId}
                            onChange={(e) => {
                                setBatchId(e.target.value);
                                if (!isEdit) setUserProgramId("");
                                if (fieldErrors.batch_id) {
                                    setFieldErrors((prev) => {
                                        const next = { ...prev };
                                        delete next.batch_id;
                                        return next;
                                    });
                                }
                            }}
                            onBlur={handleBlur("batch_id")}
                        >
                            <option value="">-- Select Training Batch --</option>
                            {batches.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.batch_name} ({b.batch_code}) — {b.program_name} [{b.branch_code}] • Max: {b.max_players} Seats
                                </option>
                            ))}
                        </select>
                        <FormError error={fieldErrors.batch_id} />
                        {selectedBatch && (
                            <div className="form-text d-flex align-items-center gap-3 mt-2 text-muted small">
                                <span>Program: <strong className="text-dark">{selectedBatch.program_name}</strong></span>
                                <span>Branch: <strong className="text-dark">{selectedBatch.branch_code}</strong></span>
                                <span>Age Group: <strong className="text-dark">{selectedBatch.age_group_name || selectedBatch.age_group}</strong></span>
                                <span>Timing: <strong className="text-dark">{selectedBatch.start_time} - {selectedBatch.end_time}</strong></span>
                            </div>
                        )}
                    </div>

                    {/* Row 2: Enrolled Player Selection */}
                    <div className="mb-3">
                        <label className="form-label fw-semibold" htmlFor="user_program_id">
                            Enrolled Player (Matching Branch & Program) <span className="text-danger">*</span>
                        </label>
                        {isEdit && existingAssignment ? (
                            <div className="input-group">
                                <input
                                    type="text"
                                    id="user_program_id"
                                    name="user_program_id"
                                    className="form-control bg-light"
                                    readOnly
                                    value={`${existingAssignment.first_name} ${existingAssignment.last_name} (${existingAssignment.admission_no})`}
                                />
                                <span className="input-group-text bg-light text-muted small">
                                    Enrolled in {existingAssignment.program_name}
                                </span>
                            </div>
                        ) : (
                            <select
                                id="user_program_id"
                                name="user_program_id"
                                className={`form-select ${fieldErrors.user_program_id ? "is-invalid border-danger" : ""}`}
                                value={userProgramId}
                                onChange={(e) => {
                                    setUserProgramId(e.target.value);
                                    if (fieldErrors.user_program_id) {
                                        setFieldErrors((prev) => {
                                            const next = { ...prev };
                                            delete next.user_program_id;
                                            return next;
                                        });
                                    }
                                }}
                                onBlur={handleBlur("user_program_id")}
                                disabled={!batchId || loadingEnrollments}
                            >
                                <option value="">
                                    {loadingEnrollments
                                        ? "Loading eligible players..."
                                        : !batchId
                                        ? "-- Please select a batch first --"
                                        : userPrograms.length === 0
                                        ? "No active player enrollments found for this program & branch"
                                        : "-- Select Enrolled Player --"}
                                </option>
                                {userPrograms.map((up) => (
                                    <option key={up.id} value={up.id}>
                                        {up.first_name} {up.last_name} ({up.admission_no}) — Phone: {up.phone || "N/A"} [{up.program_name}]
                                    </option>
                                ))}
                            </select>
                        )}
                        <FormError error={fieldErrors.user_program_id} />
                        <div className="form-text" style={{ fontSize: "0.75rem" }}>
                            Only players with active enrollment in the same Academy, Branch, and Program are eligible.
                        </div>
                        {selectedBatch && Number(selectedBatch.program_id) === 1 && (
                            <div className="alert alert-info py-2 px-3 mt-2 mb-0 d-flex align-items-center gap-2 small">
                                <UserCheck size={16} className="text-info flex-shrink-0" />
                                <div>
                                    <strong>1:1 Individual Training Program:</strong> Assigning this player will automatically synchronize their session in the Individual Training schedule table.
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Row 3: Status & Dates */}
                    <div className="row g-3 mb-3">
                        <div className="col-md-4">
                            <label className="form-label fw-semibold" htmlFor="status">Assignment Status</label>
                            <select
                                id="status"
                                name="status"
                                className={`form-select ${fieldErrors.status ? "is-invalid border-danger" : ""}`}
                                value={status}
                                onChange={(e) => {
                                    setStatus(e.target.value);
                                    if (fieldErrors.status) {
                                        setFieldErrors((prev) => {
                                            const next = { ...prev };
                                            delete next.status;
                                            return next;
                                        });
                                    }
                                }}
                                onBlur={handleBlur("status")}
                            >
                                {VALID_STATUSES.map((st) => (
                                    <option key={st} value={st}>
                                        {st}
                                    </option>
                                ))}
                            </select>
                            <FormError error={fieldErrors.status} />
                        </div>

                        <div className="col-md-4">
                            <label className="form-label fw-semibold d-flex align-items-center gap-1" htmlFor="start_date">
                                <Calendar size={15} /> Start Date <span className="text-danger">*</span>
                            </label>
                            <input
                                type="date"
                                id="start_date"
                                name="start_date"
                                className={`form-control ${fieldErrors.start_date ? "is-invalid border-danger" : ""}`}
                                value={startDate}
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                    if (fieldErrors.start_date || (fieldErrors.end_date && (!endDate || endDate >= e.target.value))) {
                                        setFieldErrors((prev) => {
                                            const next = { ...prev };
                                            delete next.start_date;
                                            if (next.end_date && (!endDate || endDate >= e.target.value)) {
                                                delete next.end_date;
                                            }
                                            return next;
                                        });
                                    }
                                }}
                                onBlur={handleBlur("start_date")}
                            />
                            <FormError error={fieldErrors.start_date} />
                        </div>

                        <div className="col-md-4">
                            <label className="form-label fw-semibold d-flex align-items-center gap-1" htmlFor="end_date">
                                <Calendar size={15} /> End Date
                            </label>
                            <input
                                type="date"
                                id="end_date"
                                name="end_date"
                                className={`form-control ${fieldErrors.end_date ? "is-invalid border-danger" : ""}`}
                                value={endDate}
                                onChange={(e) => {
                                    setEndDate(e.target.value);
                                    if (fieldErrors.end_date) {
                                        setFieldErrors((prev) => {
                                            const next = { ...prev };
                                            delete next.end_date;
                                            return next;
                                        });
                                    }
                                }}
                                onBlur={handleBlur("end_date")}
                            />
                            <div className="form-text" style={{ fontSize: "0.75rem" }}>
                                Fill if player transferred, completed, or left.
                            </div>
                            <FormError error={fieldErrors.end_date} />
                        </div>
                    </div>

                    {/* Row 4: Remarks */}
                    <div className="mb-4">
                        <label className="form-label fw-semibold" htmlFor="remarks">Remarks / Transfer Notes</label>
                        <textarea
                            id="remarks"
                            name="remarks"
                            className="form-control"
                            rows={3}
                            placeholder="Notes regarding player progress, kit allotment, timing adjustment, or reason for transfer."
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                        />
                    </div>

                    {/* Submit */}
                    <div className="d-flex align-items-center justify-content-end gap-2 pt-3 border-top">
                        <Link
                            href={batchId ? `/next_panel/batches/${batchId}` : "/next_panel/batch-players"}
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
                                    <span>{isEdit ? "Update Assignment" : "Assign Player"}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
