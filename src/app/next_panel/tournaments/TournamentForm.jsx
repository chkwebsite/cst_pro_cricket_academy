"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Save } from "lucide-react";
import { useUser } from "../components/UserContext";
import {
    BASE,
    STATUSES,
    STATUS_BADGE,
    formatDate,
    formatFee,
    toDateInput,
} from "./shared";

const STEPS = [
    { key: "basics", label: "Basic details" },
    { key: "schedule", label: "Schedule" },
    { key: "teams", label: "Teams and fee" },
    { key: "review", label: "Review" },
];

// Used by both the "new" and "edit" pages.
export default function TournamentForm({ initial, tournamentId, returnTo, returnLabel }) {
    const router = useRouter();
    const returnPath = returnTo || BASE;
    const backLabel = returnLabel || "Back to tournaments";
    const { user: userInfo } = useUser();
    const isEdit = !!tournamentId;
    const userRole = String(userInfo?.user_type || "")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ");
    const isSuperAdmin = ["super admin", "superadmin", "admin"].includes(userRole);
    const isAcademyAdmin = userRole === "academy admin";
    const canCreate = isSuperAdmin || isAcademyAdmin;

    const [step, setStep] = useState(0);
    // Furthest step the person has reached; earlier steps stay clickable.
    const [reached, setReached] = useState(isEdit ? STEPS.length - 1 : 0);

    const [form, setForm] = useState({
        branch_id: initial?.branch_id ? String(initial.branch_id) : "",
        tournament_name: initial?.tournament_name || "",
        tournament_code: initial?.tournament_code || "",
        tournament_type: initial?.tournament_type || "",
        category: initial?.category || "",
        age_group: initial?.age_group || "",
        description: initial?.description || "",
        start_date: toDateInput(initial?.start_date),
        end_date: toDateInput(initial?.end_date),
        registration_start: toDateInput(initial?.registration_start),
        registration_end: toDateInput(initial?.registration_end),
        team_fee: initial?.team_fee != null ? String(initial.team_fee) : "0",
        max_teams: initial?.max_teams != null ? String(initial.max_teams) : "",
        max_players_per_team: initial?.max_players_per_team != null ? String(initial.max_players_per_team) : "",
        status: initial?.status || "Draft",
    });

    const [branches, setBranches] = useState([]);
    const [matchTypes, setMatchTypes] = useState([]);
    const [ageGroups, setAgeGroups] = useState([]);
    const [branchesFailed, setBranchesFailed] = useState(false);
    const [optionsLoading, setOptionsLoading] = useState(true);
    const [optionsError, setOptionsError] = useState(null);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

    useEffect(() => {
        if (!userInfo || (!isEdit && !canCreate)) return;

        let cancelled = false;

        const fetchOptions = async (url) => {
            const res = await fetch(url, { cache: "no-store" });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to load form options.");
            }
            return json.data || [];
        };

        const loadOptions = async () => {
            setOptionsLoading(true);
            setOptionsError(null);
            try {
                const branchParams = new URLSearchParams({ status: "1" });
                const branchAcademyId = isEdit
                    ? initial?.academy_id || userInfo.academy_id
                    : userInfo.academy_id;

                if (!isSuperAdmin) {
                    if (!branchAcademyId) {
                        throw new Error("No academy is assigned to this account.");
                    }
                    branchParams.set("academy_id", String(branchAcademyId));
                }

                const results = await Promise.allSettled([
                    fetchOptions(`/api/branch?${branchParams.toString()}`),
                    fetchOptions("/api/match-types?status=1"),
                    fetchOptions("/api/age-groups?status=1"),
                ]);

                if (cancelled) return;

                const [branchResult, matchTypeResult, ageGroupResult] = results;
                const failures = [];

                if (branchResult.status === "fulfilled") {
                    setBranches(branchResult.value);
                    setBranchesFailed(false);
                } else {
                    setBranches([]);
                    setBranchesFailed(true);
                    failures.push("branches");
                }

                if (matchTypeResult.status === "fulfilled") {
                    setMatchTypes(matchTypeResult.value);
                } else {
                    setMatchTypes([]);
                    failures.push("formats");
                }

                if (ageGroupResult.status === "fulfilled") {
                    setAgeGroups(ageGroupResult.value);
                } else {
                    setAgeGroups([]);
                    failures.push("age groups");
                }

                if (failures.length) {
                    setOptionsError(`Could not load ${failures.join(", ")}. Please retry.`);
                }
            } finally {
                if (!cancelled) setOptionsLoading(false);
            }

        };

        loadOptions();
        return () => { cancelled = true; };
    }, [userInfo, isEdit, canCreate, isSuperAdmin, initial?.academy_id]);

    // Mirrors the API's validation so mistakes are caught on the step they happen.
    const validate = (index) => {
        if (index === 0) {
            if (!form.branch_id) return "Select a branch";
            if (!form.tournament_name.trim()) return "Tournament name is required";
            if (!form.tournament_code.trim()) return "Tournament code is required";
        }
        if (index === 1) {
            if (!form.start_date) return "Start date is required";
            if (form.end_date && form.end_date < form.start_date) return "End date cannot be before start date";
            if (form.registration_start && form.registration_end && form.registration_end < form.registration_start) {
                return "Registration end date cannot be before registration start date";
            }
        }
        if (index === 2) {
            if (form.team_fee !== "" && Number(form.team_fee) < 0) return "Team fee cannot be negative";
            if (form.max_teams !== "" && Number(form.max_teams) < 1) return "Maximum teams must be at least 1";
            if (form.max_players_per_team !== "" && Number(form.max_players_per_team) < 1) {
                return "Maximum players per team must be at least 1";
            }
        }
        return null;
    };

    const goTo = (target) => {
        if (target > step) {
            for (let i = step; i < target; i++) {
                const problem = validate(i);
                if (problem) {
                    setError(problem);
                    setStep(i);
                    return;
                }
            }
        }
        setError(null);
        setStep(target);
        setReached((r) => Math.max(r, target));
    };

    const save = async () => {
        if (!isEdit && !canCreate) {
            setError("Only Academy Admins and Super Admins can create tournaments.");
            return;
        }

        for (let i = 0; i < STEPS.length - 1; i++) {
            const problem = validate(i);
            if (problem) {
                setError(problem);
                setStep(i);
                return;
            }
        }

        setSaving(true);
        setError(null);
        try {
            const payload = {
                branch_id: Number(form.branch_id),
                tournament_name: form.tournament_name.trim(),
                tournament_code: form.tournament_code.trim(),
                tournament_type: form.tournament_type,
                category: form.category.trim() || null,
                age_group: form.age_group.trim() || null,
                description: form.description.trim() || null,
                start_date: form.start_date,
                end_date: form.end_date || null,
                registration_start: form.registration_start || null,
                registration_end: form.registration_end || null,
                team_fee: form.team_fee === "" ? 0 : Number(form.team_fee),
                max_teams: form.max_teams === "" ? null : Number(form.max_teams),
                max_players_per_team: form.max_players_per_team === "" ? null : Number(form.max_players_per_team),
                status: form.status,
                // Preserve the original creator on edit; fall back to the context user if missing.
                created_by: initial?.created_by ?? userInfo?.id ?? null,
            };

            const res = await fetch(isEdit ? `/api/tournaments/${tournamentId}` : "/api/tournaments", {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.success) {
                const message = json.message || "Failed to save tournament";
                const detail = process.env.NODE_ENV === "development" ? json.error : null;
                throw new Error(detail ? `${message}: ${detail}` : message);
            }

            router.push(returnPath);
            router.refresh();
        } catch (err) {
            setError(err.message);
            setSaving(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (step < STEPS.length - 1) goTo(step + 1);
        else save();
    };

    const isLast = step === STEPS.length - 1;
    const branchName = branches.find((b) => String(b.id) === form.branch_id)?.branch_name || initial?.branch_name;

    const reviewRows = [
        ["Branch", branchName || `Branch #${form.branch_id}`],
        ["Name", form.tournament_name.trim()],
        ["Code", form.tournament_code.trim().toUpperCase()],
        ["Format", form.tournament_type],
        ["Category", form.category.trim() || "-"],
        ["Age group", form.age_group.trim() || "-"],
        ["Dates", `${formatDate(form.start_date)} to ${form.end_date ? formatDate(form.end_date) : "not set"}`],
        [
            "Registration",
            form.registration_start || form.registration_end
                ? `${form.registration_start ? formatDate(form.registration_start) : "not set"} to ${form.registration_end ? formatDate(form.registration_end) : "not set"}`
                : "Not set",
        ],
        ["Team fee", formatFee(form.team_fee)],
        ["Maximum teams", form.max_teams || "No limit"],
        ["Players per team", form.max_players_per_team || "No limit"],
    ];

    if (!userInfo) {
        return <div className="container-fluid"><div className="alert alert-info">Checking signed-in user...</div></div>;
    }

    if (!isEdit && !canCreate) {
        return (
            <div className="container-fluid">
                <div className="alert alert-danger" role="alert">
                    Only Academy Admins and Super Admins can create tournaments.
                </div>
                <Link href={returnPath} className="btn btn-outline-secondary">{backLabel}</Link>
            </div>
        );
    }

    return (
        <div className="container-fluid">
            <div className="bg-white rounded-4 shadow-sm p-4" style={{ maxWidth: 820 }}>
                <Link href={returnPath} className="btn btn-sm btn-outline-secondary mb-3">
                    <ArrowLeft size={16} className="me-2" /> {backLabel}
                </Link>
                <h1 className="h4 mb-4">{isEdit ? "Edit tournament" : "Add tournament"}</h1>

                {/* Step indicator */}
                <ol className="list-unstyled d-flex flex-wrap gap-2 mb-4 p-0">
                    {STEPS.map((s, i) => {
                        const active = i === step;
                        const done = i < step || (isEdit && i !== step);
                        const clickable = i <= reached;
                        return (
                            <li key={s.key}>
                                <button
                                    type="button"
                                    disabled={!clickable}
                                    onClick={() => goTo(i)}
                                    aria-current={active ? "step" : undefined}
                                    className={`btn btn-sm d-flex align-items-center gap-2 ${active ? "btn-primary" : done ? "btn-outline-primary" : "btn-outline-secondary"}`}
                                >
                                    <span
                                        className="d-inline-flex align-items-center justify-content-center rounded-circle border"
                                        style={{ width: 20, height: 20, fontSize: 11 }}
                                    >
                                        {done && !active ? <Check size={12} /> : i + 1}
                                    </span>
                                    {s.label}
                                </button>
                            </li>
                        );
                    })}
                </ol>

                {error && <div className="alert alert-danger" role="alert">{error}</div>}
                {optionsError && <div className="alert alert-warning" role="alert">{optionsError}</div>}

                <form onSubmit={handleSubmit} noValidate>
                    {step === 0 && (
                        <div className="row g-3">
                            <div className="col-12 col-md-6">
                                <label htmlFor="t-branch" className="form-label">Branch <span className="text-danger">*</span></label>
                                <select
                                    id="t-branch"
                                    className="form-select"
                                    value={form.branch_id}
                                    onChange={(e) => setField("branch_id", e.target.value)}
                                    disabled={optionsLoading || branchesFailed}
                                >
                                    <option value="">{optionsLoading ? "Loading branches..." : "Select branch"}</option>
                                    {branches.map((branch) => (
                                        <option key={branch.id} value={branch.id}>{branch.branch_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-12 col-md-6">
                                <label htmlFor="t-type" className="form-label">Format</label>
                                <select
                                    id="t-type"
                                    className="form-select"
                                    value={form.tournament_type}
                                    onChange={(e) => setField("tournament_type", e.target.value)}
                                    disabled={optionsLoading || matchTypes.length === 0}
                                >
                                    <option value="">{optionsLoading ? "Loading formats..." : "Select format"}</option>
                                    {form.tournament_type && !matchTypes.some((item) => item.name === form.tournament_type) && (
                                        <option value={form.tournament_type}>{form.tournament_type} (current)</option>
                                    )}
                                    {matchTypes.map((item) => (
                                        <option key={item.id} value={item.name}>{item.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-12 col-md-8">
                                <label htmlFor="t-name" className="form-label">Name <span className="text-danger">*</span></label>
                                <input
                                    id="t-name"
                                    className="form-control"
                                    value={form.tournament_name}
                                    onChange={(e) => setField("tournament_name", e.target.value)}
                                    placeholder="e.g. Summer Cup 2026"
                                    autoFocus
                                />
                            </div>

                            <div className="col-12 col-md-4">
                                <label htmlFor="t-code" className="form-label">Code <span className="text-danger">*</span></label>
                                <input
                                    id="t-code"
                                    className="form-control text-uppercase"
                                    value={form.tournament_code}
                                    onChange={(e) => setField("tournament_code", e.target.value)}
                                    placeholder="e.g. SC26"
                                />
                                <div className="form-text">Unique within the academy.</div>
                            </div>

                            <div className="col-12 col-md-6">
                                <label htmlFor="t-cat" className="form-label">Category</label>
                                <input
                                    id="t-cat"
                                    className="form-control"
                                    value={form.category}
                                    onChange={(e) => setField("category", e.target.value)}
                                    placeholder="e.g. Boys"
                                />
                            </div>

                            <div className="col-12 col-md-6">
                                <label htmlFor="t-age" className="form-label">Age group</label>
                                <select
                                    id="t-age"
                                    className="form-select"
                                    value={form.age_group}
                                    onChange={(e) => setField("age_group", e.target.value)}
                                    disabled={optionsLoading || ageGroups.length === 0}
                                >
                                    <option value="">{optionsLoading ? "Loading age groups..." : "Select age group"}</option>
                                    {form.age_group && !ageGroups.some((item) => item.age_group === form.age_group) && (
                                        <option value={form.age_group}>{form.age_group} (current)</option>
                                    )}
                                    {ageGroups.map((item) => (
                                        <option key={item.id} value={item.age_group}>{item.age_group}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-12">
                                <label htmlFor="t-desc" className="form-label">Description</label>
                                <textarea
                                    id="t-desc"
                                    className="form-control"
                                    rows={3}
                                    value={form.description}
                                    onChange={(e) => setField("description", e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="row g-3">
                            <div className="col-12 col-md-6">
                                <label htmlFor="t-start" className="form-label">Start date <span className="text-danger">*</span></label>
                                <input
                                    id="t-start"
                                    type="date"
                                    className="form-control"
                                    value={form.start_date}
                                    onChange={(e) => setField("start_date", e.target.value)}
                                />
                            </div>
                            <div className="col-12 col-md-6">
                                <label htmlFor="t-end" className="form-label">End date</label>
                                <input
                                    id="t-end"
                                    type="date"
                                    className="form-control"
                                    min={form.start_date || undefined}
                                    value={form.end_date}
                                    onChange={(e) => setField("end_date", e.target.value)}
                                />
                            </div>
                            <div className="col-12 col-md-6">
                                <label htmlFor="t-rs" className="form-label">Registration opens</label>
                                <input
                                    id="t-rs"
                                    type="date"
                                    className="form-control"
                                    value={form.registration_start}
                                    onChange={(e) => setField("registration_start", e.target.value)}
                                />
                            </div>
                            <div className="col-12 col-md-6">
                                <label htmlFor="t-re" className="form-label">Registration closes</label>
                                <input
                                    id="t-re"
                                    type="date"
                                    className="form-control"
                                    min={form.registration_start || undefined}
                                    value={form.registration_end}
                                    onChange={(e) => setField("registration_end", e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="row g-3">
                            <div className="col-12 col-md-4">
                                <label htmlFor="t-fee" className="form-label">Fee per team (₹)</label>
                                <input
                                    id="t-fee"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="form-control"
                                    value={form.team_fee}
                                    onChange={(e) => setField("team_fee", e.target.value)}
                                />
                                <div className="form-text">Enter 0 for a free tournament.</div>
                            </div>
                            <div className="col-12 col-md-4">
                                <label htmlFor="t-mt" className="form-label">Maximum teams</label>
                                <input
                                    id="t-mt"
                                    type="number"
                                    min="1"
                                    className="form-control"
                                    value={form.max_teams}
                                    onChange={(e) => setField("max_teams", e.target.value)}
                                    placeholder="No limit"
                                />
                            </div>
                            <div className="col-12 col-md-4">
                                <label htmlFor="t-mp" className="form-label">Players per team</label>
                                <input
                                    id="t-mp"
                                    type="number"
                                    min="1"
                                    className="form-control"
                                    value={form.max_players_per_team}
                                    onChange={(e) => setField("max_players_per_team", e.target.value)}
                                    placeholder="No limit"
                                />
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <>
                            <dl className="row mb-4">
                                {reviewRows.map(([label, value]) => (
                                    <div key={label} className="col-12 col-md-6 mb-2">
                                        <dt className="small text-muted fw-normal">{label}</dt>
                                        <dd className="mb-0 fw-semibold">{value}</dd>
                                    </div>
                                ))}
                            </dl>

                            <div className="mb-2" style={{ maxWidth: 280 }}>
                                <label htmlFor="t-status" className="form-label">Status</label>
                                <select
                                    id="t-status"
                                    className="form-select"
                                    value={form.status}
                                    onChange={(e) => setField("status", e.target.value)}
                                >
                                    {!STATUSES.includes(form.status) && (
                                        <option value={form.status}>{form.status} (current)</option>
                                    )}
                                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <div className="form-text">
                                    Saving as <span className={`badge ${STATUS_BADGE[form.status] || "bg-secondary"}`}>{form.status}</span>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="d-flex justify-content-between mt-4 pt-3 border-top">
                        <button
                            type="button"
                            className="btn btn-outline-secondary"
                            disabled={step === 0 || saving}
                            onClick={() => goTo(step - 1)}
                        >
                            <ArrowLeft size={16} className="me-2" /> Previous
                        </button>

                        {isLast ? (
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                <Save size={16} className="me-2" />
                                {saving ? "Saving..." : isEdit ? "Save changes" : "Create tournament"}
                            </button>
                        ) : (
                            <button type="submit" className="btn btn-primary">
                                Next <ArrowRight size={16} className="ms-2" />
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
