"use client";

import { ArrowLeft, Calendar, Check, Lock, RefreshCw, Save } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "../components/UserContext";
import {
    DISMISSAL_TYPES,
    calculateStrikeRate,
    formatDate,
    getPlayerDisplayName,
    isMatchDateInFuture,
    oversToBalls,
} from "../components/cricketHelpers";
import { FormError, RequiredLabel } from "@/app/components/form";

const EMPTY_FORM = {
    match_id: "",
    innings_id: "",
    match_player_id: "",
    batting_position: 1,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    strike_rate: 0,
    dismissal_type: "Not Out",
    dismissed_by_player_id: "",
    fielder_player_id: "",
};

export default function MatchScorecardForm({ id = null, returnTo = "/next_panel/match-scorecard" }) {
    const { user } = useUser();
    const userRole = String(user?.role || user?.user_type || user?.role_name || "").toLowerCase();
    const isSuperAdmin = Boolean(user?.isSuperAdmin || userRole === "super_admin" || userRole === "super admin");
    const isAcademyAdmin = Boolean(user?.isAcademyAdmin || userRole === "academy_admin" || userRole === "academy admin");
    const canEditCompletedInnings = isSuperAdmin || isAcademyAdmin;

    const router = useRouter();
    const searchParams = useSearchParams();
    const isEdit = Boolean(id);

    const [formData, setFormData] = useState({
        ...EMPTY_FORM,
        match_id: searchParams.get("match_id") || "",
        innings_id: searchParams.get("innings_id") || "",
    });

    const [matches, setMatches] = useState([]);
    const [inningsList, setInningsList] = useState([]);
    const [battingPlayers, setBattingPlayers] = useState([]);
    const [bowlingPlayers, setBowlingPlayers] = useState([]);
    const [allMatchPlayers, setAllMatchPlayers] = useState([]);
    const [existingScorecards, setExistingScorecards] = useState([]);

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEdit);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [successMsg, setSuccessMsg] = useState("");

    const clearError = (fieldName) => {
        setFieldErrors((prev) => {
            if (!prev[fieldName]) return prev;
            const updated = { ...prev };
            delete updated[fieldName];
            return updated;
        });
    };

    // Fetch matches
    useEffect(() => {
        const controller = new AbortController();
        (async () => {
            try {
                const res = await fetch("/api/matches", { signal: controller.signal });
                const json = await res.json();
                if (res.ok && json.success) setMatches(json.data || []);
            } catch {
                /* ignore */
            }
        })();
        return () => controller.abort();
    }, []);

    // If Edit mode, fetch current record
    useEffect(() => {
        if (!isEdit) return;
        const controller = new AbortController();
        (async () => {
            setFetching(true);
            setError("");
            try {
                const res = await fetch(`/api/match-scorecard/${id}`, { signal: controller.signal });
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to load batting scorecard record");
                }
                const d = json.data;
                setFormData({
                    match_id: String(d.match_id || ""),
                    innings_id: String(d.innings_id || ""),
                    match_player_id: String(d.match_player_id || ""),
                    batting_position: d.batting_position || 1,
                    runs: Number(d.runs) || 0,
                    balls: Number(d.balls) || 0,
                    fours: Number(d.fours) || 0,
                    sixes: Number(d.sixes) || 0,
                    strike_rate: Number(d.strike_rate) || 0,
                    dismissal_type: d.dismissal_type || "Not Out",
                    dismissed_by_player_id: d.dismissed_by_player_id ? String(d.dismissed_by_player_id) : "",
                    fielder_player_id: d.fielder_player_id ? String(d.fielder_player_id) : "",
                });
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            } finally {
                if (!controller.signal.aborted) setFetching(false);
            }
        })();
        return () => controller.abort();
    }, [id, isEdit]);

    // Fetch innings for selected match
    useEffect(() => {
        if (!formData.match_id) {
            setInningsList([]);
            return;
        }

        const controller = new AbortController();
        (async () => {
            try {
                const res = await fetch(`/api/match-innings?match_id=${formData.match_id}`, {
                    signal: controller.signal,
                });
                const json = await res.json();
                if (res.ok && json.success) {
                    const list = json.data || [];
                    setInningsList(list);
                    if (!isEdit && list.length > 0 && !formData.innings_id) {
                        setFormData((prev) => ({ ...prev, innings_id: String(list[0].id) }));
                    }
                }
            } catch {
                /* ignore */
            }
        })();
        return () => controller.abort();
    }, [formData.match_id, isEdit]);

    // When match & innings are chosen, fetch match players for both teams
    useEffect(() => {
        if (!formData.match_id) {
            setBattingPlayers([]);
            setBowlingPlayers([]);
            setAllMatchPlayers([]);
            return;
        }

        const controller = new AbortController();
        (async () => {
            try {
                const res = await fetch(`/api/match-players?match_id=${formData.match_id}`, {
                    signal: controller.signal,
                });
                const json = await res.json();
                if (res.ok && json.success) {
                    const all = json.data || [];
                    setAllMatchPlayers(all);

                    const currentInnings = inningsList.find((i) => String(i.id) === String(formData.innings_id));
    const isLockedForCurrentUser = currentInnings?.innings_status === "Completed" && !canEditCompletedInnings;
                    if (currentInnings) {
                        const batting = all.filter((p) => Number(p.team_id) === Number(currentInnings.batting_team_id));
                        const bowling = all.filter((p) => Number(p.team_id) === Number(currentInnings.bowling_team_id));

                        setBattingPlayers(batting.length > 0 ? batting : all);
                        if (bowling.length > 0) {
                            setBowlingPlayers(bowling);
                        } else {
                            const otherPlayers = all.filter((p) => Number(p.team_id) !== Number(currentInnings.batting_team_id));
                            setBowlingPlayers(otherPlayers.length > 0 ? otherPlayers : all);
                        }
                    } else {
                        setBattingPlayers(all);
                        setBowlingPlayers(all);
                    }
                }
            } catch {
                /* ignore */
            }
        })();
        return () => controller.abort();
    }, [formData.match_id, formData.innings_id, inningsList]);

    // Fetch existing scorecard entries for selected innings to calculate runs mismatch
    useEffect(() => {
        if (!formData.innings_id) {
            setExistingScorecards([]);
            return;
        }

        const controller = new AbortController();
        (async () => {
            try {
                const res = await fetch(`/api/match-scorecard?innings_id=${formData.innings_id}`, {
                    signal: controller.signal,
                });
                const json = await res.json();
                if (res.ok && json.success) {
                    setExistingScorecards(json.data || []);
                }
            } catch {
                /* ignore */
            }
        })();
        return () => controller.abort();
    }, [formData.innings_id]);

    const selectedMatch = matches.find((m) => String(m.id) === String(formData.match_id));
    const isFutureMatch = Boolean(selectedMatch?.match_date && isMatchDateInFuture(selectedMatch.match_date));
    const matchOvers = selectedMatch?.overs ? Number(selectedMatch.overs) : 20;
    const matchMaxBalls = matchOvers * 6;

    const currentInnings = inningsList.find((i) => String(i.id) === String(formData.innings_id));
    const isLockedForCurrentUser = currentInnings?.innings_status === "Completed" && !canEditCompletedInnings;
    const inningsTotalRuns = Number(currentInnings?.total_runs) || 0;
    const inningsExtras = Number(currentInnings?.extras) || 0;
    const inningsTargetRuns = currentInnings?.target_runs !== null && currentInnings?.target_runs !== undefined && currentInnings?.target_runs !== ""
        ? Number(currentInnings.target_runs)
        : (inningsTotalRuns > 0 ? inningsTotalRuns + inningsExtras : 0);

    const rawInningsOvers = Number(currentInnings?.total_overs) || 0;
    const completeOversInn = Math.floor(rawInningsOvers);
    const remBallsInn = Math.round((rawInningsOvers - completeOversInn) * 10);
    const inningsTotalBalls = currentInnings?.total_balls
        ? Number(currentInnings.total_balls)
        : (rawInningsOvers > 0 ? (completeOversInn * 6 + (remBallsInn >= 0 && remBallsInn <= 5 ? remBallsInn : 0)) : matchMaxBalls);
    const maxBallsForInnings = Math.min(inningsTotalBalls, matchMaxBalls);

    const otherBattersRuns = existingScorecards
        .filter((sc) => !isEdit || String(sc.id) !== String(id))
        .reduce((sum, sc) => sum + (Number(sc.runs) || 0), 0);
    const otherBattersBalls = existingScorecards
        .filter((sc) => !isEdit || String(sc.id) !== String(id))
        .reduce((sum, sc) => sum + (Number(sc.balls) || 0), 0);

    const enteredRuns = Number(formData.runs) || 0;
    const enteredBalls = Number(formData.balls) || 0;
    const enteredFours = Number(formData.fours) || 0;
    const enteredSixes = Number(formData.sixes) || 0;

    const maxByTarget = inningsTargetRuns > 0 ? Math.max(0, inningsTargetRuns - inningsExtras - otherBattersRuns) : Infinity;
    const maxByTotalRuns = inningsTotalRuns > 0 ? Math.max(0, inningsTotalRuns - otherBattersRuns) : Infinity;
    const maxAllowedRuns = Math.min(maxByTarget, maxByTotalRuns);

    const targetExceeded = inningsTargetRuns > 0 && (otherBattersRuns + enteredRuns + inningsExtras > inningsTargetRuns);
    const totalRunsExceeded = inningsTotalRuns > 0 && (otherBattersRuns + enteredRuns > inningsTotalRuns);
    const runsExceeded = targetExceeded || totalRunsExceeded;

    const maxAllowedBalls = Math.max(0, maxBallsForInnings - otherBattersBalls);
    const ballsExceeded = enteredBalls > maxAllowedBalls;

    const boundaryRunsExceeded = (enteredFours * 4 + enteredSixes * 6) > enteredRuns;
    const boundaryCountExceeded = enteredBalls > 0 && (enteredFours + enteredSixes > enteredBalls);

    const hasValidationErrors = runsExceeded || ballsExceeded || boundaryRunsExceeded || boundaryCountExceeded;

    const isNotOut = formData.dismissal_type === "Not Out" || formData.dismissal_type === "Retired Hurt";
    const needsFielder = ["Caught", "Run Out", "Stumped"].includes(formData.dismissal_type);
    const needsBowler = [
        "Bowled",
        "Caught",
        "LBW",
        "Run Out",
        "Stumped",
        "Hit Wicket",
    ].includes(formData.dismissal_type);

    const validateField = (name, value) => {
        let err = "";
        if (name === "match_id") {
            if (!value) err = "Please select a match.";
        } else if (name === "innings_id") {
            if (!value) err = "Please select an innings.";
        } else if (name === "match_player_id") {
            if (!value) err = "Please select a batter.";
        } else if (name === "runs") {
            if (runsExceeded) {
                err = `Runs (${enteredRuns}) exceeds maximum allowed (${maxAllowedRuns}).`;
            }
        } else if (name === "balls") {
            if (ballsExceeded) {
                err = `Balls faced (${enteredBalls}) exceeds maximum allowed (${maxAllowedBalls}).`;
            }
        } else if (name === "fours" || name === "sixes") {
            if (boundaryRunsExceeded) {
                err = "Boundary runs cannot exceed total runs.";
            } else if (boundaryCountExceeded) {
                err = "Total boundaries cannot exceed balls faced.";
            }
        } else if (name === "dismissed_by_player_id") {
            if (value && Number(value) === Number(formData.match_player_id)) {
                err = "A batter cannot be their own dismissed_by bowler.";
            }
        }
        return err;
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        const err = validateField(name, value);
        if (err) {
            setFieldErrors((prev) => ({ ...prev, [name]: err }));
        }
    };

    const validateAll = () => {
        const errors = {};
        if (!formData.match_id) errors.match_id = "Please select a match.";
        if (!formData.innings_id) errors.innings_id = "Please select an innings.";
        if (!formData.match_player_id) errors.match_player_id = "Please select a batter.";
        if (runsExceeded) errors.runs = `Runs cannot exceed ${maxAllowedRuns}.`;
        if (ballsExceeded) errors.balls = `Balls faced cannot exceed ${maxAllowedBalls}.`;
        if (boundaryRunsExceeded) errors.fours = "Boundary runs cannot exceed total runs.";
        if (boundaryCountExceeded) errors.fours = "Total boundaries cannot exceed balls faced.";
        if (formData.dismissed_by_player_id && Number(formData.dismissed_by_player_id) === Number(formData.match_player_id)) {
            errors.dismissed_by_player_id = "A batter cannot be their own dismissed_by bowler.";
        }
        return errors;
    };

    const handleMatchChange = (mId) => {
        setFormData((prev) => ({
            ...prev,
            match_id: mId,
            innings_id: "",
            match_player_id: "",
            dismissed_by_player_id: "",
            fielder_player_id: "",
        }));
        clearError("match_id");
        clearError("innings_id");
        clearError("match_player_id");
    };

    const handleInningsChange = (iId) => {
        setFormData((prev) => ({
            ...prev,
            innings_id: iId,
            match_player_id: "",
        }));
        clearError("innings_id");
        clearError("match_player_id");
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        clearError(name);
        if (name === "runs" || name === "balls") {
            clearError("fours");
            clearError("sixes");
        }
        setFormData((prev) => {
            const updated = { ...prev, [name]: value };

            // Real-time Strike Rate calculation
            if (name === "runs" || name === "balls") {
                const r = Number(name === "runs" ? value : prev.runs) || 0;
                const b = Number(name === "balls" ? value : prev.balls) || 0;
                updated.strike_rate = b > 0 ? Number(((r / b) * 100).toFixed(2)) : 0;
            }

            // Reset bowler/fielder if Not Out or not applicable to the dismissal type
            if (name === "dismissal_type") {
                const nextNeedsBowler = [
                    "Bowled",
                    "Caught",
                    "LBW",
                    "Run Out",
                    "Stumped",
                    "Hit Wicket",
                ].includes(value);
                const nextNeedsFielder = ["Caught", "Run Out", "Stumped"].includes(value);

                if (!nextNeedsBowler || value === "Not Out" || value === "Retired Hurt") {
                    updated.dismissed_by_player_id = "";
                }
                if (!nextNeedsFielder || value === "Not Out" || value === "Retired Hurt") {
                    updated.fielder_player_id = "";
                }
            }

            return updated;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");

        if (isLockedForCurrentUser) {
            setError("This innings is completed. Only Super Admin and Academy Admin can add or edit player scores.");
            return;
        }

        if (isFutureMatch) {
            setError(`Batting scores cannot be added or updated before the scheduled match date (${formatDate(selectedMatch?.match_date)}).`);
            return;
        }

        const clientErrors = validateAll();
        if (Object.keys(clientErrors).length > 0) {
            setFieldErrors(clientErrors);
            const firstKey = Object.keys(clientErrors)[0];
            const el = document.querySelector(`[name="${firstKey}"], #${firstKey}`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.focus();
            }
            return;
        }

        const payload = {
            match_id: Number(formData.match_id),
            innings_id: Number(formData.innings_id),
            match_player_id: Number(formData.match_player_id),
            batting_position: formData.batting_position ? Number(formData.batting_position) : null,
            runs: Number(formData.runs) || 0,
            balls: Number(formData.balls) || 0,
            fours: Number(formData.fours) || 0,
            sixes: Number(formData.sixes) || 0,
            strike_rate: Number(formData.strike_rate) || 0,
            dismissal_type: formData.dismissal_type,
            dismissed_by_player_id: formData.dismissed_by_player_id ? Number(formData.dismissed_by_player_id) : null,
            fielder_player_id: formData.fielder_player_id ? Number(formData.fielder_player_id) : null,
        };

        setLoading(true);
        try {
            const url = isEdit ? `/api/match-scorecard/${id}` : "/api/match-scorecard";
            const method = isEdit ? "PUT" : "POST";

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
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                        el.focus();
                    }
                }
                throw new Error(json.message || "Failed to save batting scorecard");
            }

            setSuccessMsg(isEdit ? "Scorecard entry updated successfully!" : "Scorecard entry created successfully!");
            setTimeout(() => {
                router.push(returnTo);
            }, 700);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="text-center py-5">
                <RefreshCw className="spinner-border spinner-border-sm me-2" />
                Loading scorecard record...
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} noValidate>
            {error && <div className="alert alert-danger">{error}</div>}
            {successMsg && <div className="alert alert-success">{successMsg}</div>}

            <div className="row g-3">
                {/* Future Match Locked Alert */}
                {isFutureMatch && (
                    <div className="col-12">
                        <div className="alert alert-warning border border-warning-subtle d-flex align-items-center gap-2 mb-0 shadow-sm">
                            <Calendar size={18} className="text-warning flex-shrink-0" />
                            <span>
                                <strong>Upcoming Match ({formatDate(selectedMatch?.match_date)}):</strong> Batting scores cannot be added or updated before the scheduled match date.
                            </span>
                        </div>
                    </div>
                )}

                {/* Innings Completed Locked Alert */}
                {isLockedForCurrentUser && (
                    <div className="col-12">
                        <div className="alert alert-warning border border-warning-subtle d-flex align-items-center gap-2 mb-0">
                            <Lock size={18} className="text-warning flex-shrink-0" />
                            <span>This innings is completed and locked. Only Super Admin and Academy Admin have permission to add or edit player scores.</span>
                        </div>
                    </div>
                )}

                {/* Match Selection */}
                <div className="col-md-6">
                    <label className="form-label fw-semibold">
                        Match <RequiredLabel />
                    </label>
                    <select
                        name="match_id"
                        id="match_id"
                        className={`form-select ${fieldErrors.match_id ? "is-invalid border-danger" : ""}`}
                        value={formData.match_id}
                        onChange={(e) => handleMatchChange(e.target.value)}
                        onBlur={handleBlur}
                        disabled={isEdit}
                    >
                        <option value="">Select a match...</option>
                        {matches.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.match_no ? `Match ${m.match_no}` : `Match #${m.id}`}: {m.team_a_name} vs {m.team_b_name}
                            </option>
                        ))}
                    </select>
                    <FormError error={fieldErrors.match_id} />
                </div>

                {/* Innings Selection */}
                <div className="col-md-6">
                    <label className="form-label fw-semibold">
                        Innings <RequiredLabel />
                    </label>
                    <select
                        name="innings_id"
                        id="innings_id"
                        className={`form-select ${fieldErrors.innings_id ? "is-invalid border-danger" : ""}`}
                        value={formData.innings_id}
                        onChange={(e) => handleInningsChange(e.target.value)}
                        onBlur={handleBlur}
                        disabled={isEdit || !formData.match_id}
                    >
                        <option value="">Select an innings...</option>
                        {inningsList.map((i) => (
                            <option key={i.id} value={i.id}>
                                Innings {i.innings_no}: {i.batting_team_name} (Batting)
                            </option>
                        ))}
                    </select>
                    <FormError error={fieldErrors.innings_id} />
                </div>

                {/* Batter & Position */}
                <div className="col-md-8">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="form-label fw-semibold mb-0">
                            Batter (Batting Team) <RequiredLabel />
                        </label>
                        {formData.innings_id && (
                            <Link
                                href={`/next_panel/match-players/new?match_id=${formData.match_id}&team_id=${currentInnings?.batting_team_id}&returnTo=${encodeURIComponent(`/next_panel/match-scorecard/new?match_id=${formData.match_id}&innings_id=${formData.innings_id}`)}`}
                                className="small text-primary text-decoration-none fw-semibold"
                            >
                                + Add Player to Squad
                            </Link>
                        )}
                    </div>
                    <select
                        name="match_player_id"
                        id="match_player_id"
                        className={`form-select ${fieldErrors.match_player_id ? "is-invalid border-danger" : ""}`}
                        value={formData.match_player_id}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        disabled={isEdit || !formData.innings_id}
                    >
                        <option value="">
                            {battingPlayers.length === 0 && formData.innings_id
                                ? `No squad players found for ${currentInnings?.batting_team_name || "batting team"}`
                                : "Select a player..."}
                        </option>
                        {battingPlayers.map((p) => (
                            <option key={p.id} value={p.id}>
                                {getPlayerDisplayName(p)} {p.jersey_no ? `(#${p.jersey_no})` : ""} - {p.team_name}
                            </option>
                        ))}
                    </select>
                    <FormError error={fieldErrors.match_player_id} />
                    {formData.innings_id && battingPlayers.length === 0 && (
                        <div className="alert alert-warning py-2 px-3 mt-2 small d-flex flex-wrap align-items-center justify-content-between gap-2 rounded-3">
                            <span>
                                No players found in match squad for <strong>{currentInnings?.batting_team_name}</strong>.
                            </span>
                            <Link
                                href={`/next_panel/match-players/new?match_id=${formData.match_id}&team_id=${currentInnings?.batting_team_id}&returnTo=${encodeURIComponent(`/next_panel/match-scorecard/new?match_id=${formData.match_id}&innings_id=${formData.innings_id}`)}`}
                                className="btn btn-sm btn-primary text-white py-1 px-2"
                            >
                                + Add Player to Squad
                            </Link>
                        </div>
                    )}
                </div>

                <div className="col-md-4">
                    <label className="form-label fw-semibold">Batting Position</label>
                    <input
                        type="number"
                        name="batting_position"
                        id="batting_position"
                        className="form-control"
                        min="1"
                        max="20"
                        value={formData.batting_position}
                        onChange={handleChange}
                        placeholder="e.g. 1 (Opener)"
                    />
                </div>

                {/* Innings Runs & Balls Tracker */}
                {(inningsTargetRuns > 0 || inningsTotalRuns > 0 || currentInnings) && (
                    <div className="col-12">
                        <div className={`p-3 rounded-3 border ${hasValidationErrors ? "bg-danger-subtle border-danger" : "bg-light border"}`}>
                            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                                <div>
                                    <span className="fw-semibold text-dark me-2">Innings Target:</span>
                                    <span className="badge bg-primary fs-6 me-2">{inningsTargetRuns} runs</span>
                                    <span className="badge bg-secondary-subtle text-secondary border">
                                        {matchOvers} ov ({matchMaxBalls} balls max)
                                    </span>
                                </div>
                                <div className="d-flex flex-wrap gap-3 text-muted small">
                                    <span>Extras: <strong className="text-dark">{inningsExtras}</strong></span>
                                    <span>Other Batters Scored: <strong className="text-dark">{otherBattersRuns} r</strong></span>
                                    <span>Max Runs Allowed: <strong className={runsExceeded ? "text-danger fw-bold" : "text-success fw-bold"}>{maxAllowedRuns}</strong></span>
                                    <span>Other Balls Faced: <strong className="text-dark">{otherBattersBalls} b</strong></span>
                                    <span>Max Balls Allowed: <strong className={ballsExceeded ? "text-danger fw-bold" : "text-success fw-bold"}>{maxAllowedBalls}</strong></span>
                                </div>
                            </div>
                            {runsExceeded && (
                                <div className="text-danger small mt-2 fw-semibold">
                                    ⚠️ Target Runs Mismatch! Entered runs ({enteredRuns}) exceeds the remaining available runs ({maxAllowedRuns}) for this innings.
                                </div>
                            )}
                            {ballsExceeded && (
                                <div className="text-danger small mt-2 fw-semibold">
                                    ⚠️ Balls Faced Mismatch! Match is {matchOvers} overs ({matchMaxBalls} balls). Other batters faced {otherBattersBalls} balls. This batter can face at most {maxAllowedBalls} ball(s), but {enteredBalls} was entered.
                                </div>
                            )}
                            {boundaryRunsExceeded && (
                                <div className="text-danger small mt-2 fw-semibold">
                                    ⚠️ Boundary Runs Mismatch! {enteredFours} fours and {enteredSixes} sixes equal {enteredFours * 4 + enteredSixes * 6} runs, which cannot exceed total runs ({enteredRuns}).
                                </div>
                            )}
                            {boundaryCountExceeded && (
                                <div className="text-danger small mt-2 fw-semibold">
                                    ⚠️ Boundary Count Mismatch! Total boundaries ({enteredFours + enteredSixes}) cannot exceed balls faced ({enteredBalls}).
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Runs, Balls, 4s, 6s, SR */}
                <div className="col-md-2 col-6">
                    <label className="form-label fw-semibold">Runs</label>
                    <input
                        type="number"
                        name="runs"
                        id="runs"
                        className={`form-control ${fieldErrors.runs || runsExceeded ? "is-invalid border-danger" : ""}`}
                        min="0"
                        value={formData.runs}
                        onChange={handleChange}
                        onBlur={handleBlur}
                    />
                    <FormError error={fieldErrors.runs} />
                </div>

                <div className="col-md-2 col-6">
                    <label className="form-label fw-semibold d-flex justify-content-between align-items-center">
                        <span>Balls Faced</span>
                        {currentInnings && (
                            <span className="text-muted small">Max: {maxAllowedBalls}</span>
                        )}
                    </label>
                    <input
                        type="number"
                        name="balls"
                        id="balls"
                        className={`form-control ${fieldErrors.balls || ballsExceeded ? "is-invalid border-danger" : ""}`}
                        min="0"
                        max={maxAllowedBalls}
                        value={formData.balls}
                        onChange={handleChange}
                        onBlur={handleBlur}
                    />
                    <FormError error={fieldErrors.balls} />
                </div>

                <div className="col-md-2 col-4">
                    <label className="form-label fw-semibold">Fours (4s)</label>
                    <input
                        type="number"
                        name="fours"
                        id="fours"
                        className={`form-control ${fieldErrors.fours || boundaryRunsExceeded || boundaryCountExceeded ? "is-invalid border-danger" : ""}`}
                        min="0"
                        value={formData.fours}
                        onChange={handleChange}
                        onBlur={handleBlur}
                    />
                    <FormError error={fieldErrors.fours} />
                </div>

                <div className="col-md-2 col-4">
                    <label className="form-label fw-semibold">Sixes (6s)</label>
                    <input
                        type="number"
                        name="sixes"
                        id="sixes"
                        className={`form-control ${fieldErrors.sixes || boundaryRunsExceeded || boundaryCountExceeded ? "is-invalid border-danger" : ""}`}
                        min="0"
                        value={formData.sixes}
                        onChange={handleChange}
                        onBlur={handleBlur}
                    />
                    <FormError error={fieldErrors.sixes} />
                </div>

                <div className="col-md-4 col-4">
                    <label className="form-label fw-semibold">
                        Strike Rate <small className="text-muted">(auto)</small>
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        name="strike_rate"
                        id="strike_rate"
                        className="form-control bg-light"
                        value={formData.strike_rate}
                        onChange={handleChange}
                    />
                </div>

                {/* Dismissal Section */}
                <div className="col-12">
                    <div className="p-3 bg-light rounded-4 border">
                        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                            <h6 className="fw-semibold mb-0">Dismissal Details</h6>
                            {currentInnings && (
                                <span className="small text-muted">
                                    Bowling Team: <strong>{currentInnings.bowling_team_name || "Opponent"}</strong>
                                </span>
                            )}
                        </div>

                        {formData.innings_id && bowlingPlayers.length === 0 && (
                            <div className="alert alert-warning py-2 px-3 small mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                                <span>
                                    No match players found for bowling team (<strong>{currentInnings?.bowling_team_name || "Opponent"}</strong>). Please register players for this team in Match Players.
                                </span>
                                <Link
                                    href={`/next_panel/match-players/new?match_id=${formData.match_id}`}
                                    className="btn btn-sm btn-outline-dark text-nowrap"
                                    target="_blank"
                                >
                                    Add Players
                                </Link>
                            </div>
                        )}

                        <div className="row g-3">
                            <div className="col-md-4">
                                <label className="form-label text-muted small">
                                    Dismissal Type <RequiredLabel />
                                </label>
                                <select
                                    name="dismissal_type"
                                    id="dismissal_type"
                                    className="form-select"
                                    value={formData.dismissal_type}
                                    onChange={handleChange}
                                >
                                    {DISMISSAL_TYPES.map((dt) => (
                                        <option key={dt} value={dt}>
                                            {dt}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-md-4">
                                <label className="form-label text-muted small">
                                    Dismissed By (Bowler)
                                </label>
                                <select
                                    name="dismissed_by_player_id"
                                    id="dismissed_by_player_id"
                                    className={`form-select ${fieldErrors.dismissed_by_player_id ? "is-invalid border-danger" : ""}`}
                                    value={formData.dismissed_by_player_id}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    disabled={isNotOut || !needsBowler}
                                >
                                    <option value="">
                                        {isNotOut || !needsBowler
                                            ? `Not applicable (${formData.dismissal_type})`
                                            : bowlingPlayers.length === 0
                                            ? "No bowlers available"
                                            : "Select bowler..."}
                                    </option>
                                    {bowlingPlayers
                                        .filter((p) => Number(p.id) !== Number(formData.match_player_id))
                                        .map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {getPlayerDisplayName(p)} {p.jersey_no ? `(#${p.jersey_no})` : ""} {p.team_name ? `- ${p.team_name}` : ""}
                                            </option>
                                        ))}
                                </select>
                                <FormError error={fieldErrors.dismissed_by_player_id} />
                            </div>

                            <div className="col-md-4">
                                <label className="form-label text-muted small">
                                    Fielder / Wicket-keeper
                                </label>
                                <select
                                    name="fielder_player_id"
                                    id="fielder_player_id"
                                    className="form-select"
                                    value={formData.fielder_player_id}
                                    onChange={handleChange}
                                    disabled={isNotOut || !needsFielder}
                                >
                                    <option value="">
                                        {isNotOut || !needsFielder
                                            ? `Not applicable (${formData.dismissal_type})`
                                            : bowlingPlayers.length === 0
                                            ? "No fielders available"
                                            : "Select fielder..."}
                                    </option>
                                    {bowlingPlayers.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {getPlayerDisplayName(p)} {p.jersey_no ? `(#${p.jersey_no})` : ""} {p.team_name ? `- ${p.team_name}` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Buttons */}
                <div className="col-12 d-flex justify-content-end gap-2 mt-4">
                    <Link href={returnTo} className="btn btn-outline-secondary px-4">
                        Cancel
                    </Link>
                    <button type="submit" className="btn btn-primary px-4" disabled={loading || hasValidationErrors || isLockedForCurrentUser || isFutureMatch}>
                        {loading ? (
                            <>
                                <RefreshCw className="spinner-border spinner-border-sm me-2" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={16} className="me-2" />
                                {isEdit ? "Update Batting Record" : "Save Batting Record"}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </form>
    );
}
