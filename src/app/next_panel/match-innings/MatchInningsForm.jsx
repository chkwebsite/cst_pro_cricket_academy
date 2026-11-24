"use client";

import { ArrowLeft, ArrowUpDown, Calendar, Check, Lock, RefreshCw, Save } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "../components/UserContext";
import {
    INNINGS_STATUSES,
    formatDate,
    isMatchDateInFuture,
    isValidCricketOvers,
    oversToBalls,
} from "../components/cricketHelpers";
import { FormError, RequiredLabel } from "@/app/components/form";

const EMPTY_FORM = {
    match_id: "",
    innings_no: 1,
    batting_team_id: "",
    bowling_team_id: "",
    total_runs: 0,
    total_wickets: 0,
    total_overs: 0,
    total_balls: 0,
    extras: 0,
    wides: 0,
    no_balls: 0,
    byes: 0,
    leg_byes: 0,
    penalty_runs: 0,
    target_runs: "",
    innings_status: "In Progress",
};

export default function MatchInningsForm({ id = null, returnTo = "/next_panel/match-innings" }) {
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
    });
    const [matches, setMatches] = useState([]);

    // Match / Tournament selection states
    const [selectedType, setSelectedType] = useState("Match"); // "Match" | "Tournament"
    const [tournaments, setTournaments] = useState([]);
    const [tournamentsLoading, setTournamentsLoading] = useState(false);
    const [selectedTournamentId, setSelectedTournamentId] = useState("");
    const [tournamentMatches, setTournamentMatches] = useState([]);
    const [tournamentMatchesLoading, setTournamentMatchesLoading] = useState(false);
    const [initializingFixture, setInitializingFixture] = useState(false);

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEdit);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [successMsg, setSuccessMsg] = useState("");
    const [autoSumExtras, setAutoSumExtras] = useState(true);

    const clearError = (fieldName) => {
        setFieldErrors((prev) => {
            if (!prev[fieldName]) return prev;
            const updated = { ...prev };
            delete updated[fieldName];
            return updated;
        });
    };

    const isLockedForCurrentUser = isEdit && formData.innings_status === "Completed" && !canEditCompletedInnings;

    // Fetch matches list for selection
    const fetchMatchesList = async () => {
        try {
            const res = await fetch("/api/matches");
            const json = await res.json();
            if (res.ok && json.success) {
                setMatches(json.data || []);
                return json.data || [];
            }
        } catch {
            /* matches dropdown */
        }
        return [];
    };

    useEffect(() => {
        fetchMatchesList();
    }, []);

    // Fetch tournaments list
    useEffect(() => {
        const controller = new AbortController();
        (async () => {
            try {
                setTournamentsLoading(true);
                const res = await fetch("/api/tournaments", { signal: controller.signal });
                const json = await res.json();
                if (res.ok && json.success) {
                    setTournaments(json.data || []);
                }
            } catch {
                /* tournaments dropdown */
            } finally {
                setTournamentsLoading(false);
            }
        })();
        return () => controller.abort();
    }, []);

    // Load tournament matches when Tournament type is active
    useEffect(() => {
        if (selectedType !== "Tournament") {
            setTournamentMatches([]);
            return;
        }

        const controller = new AbortController();
        (async () => {
            try {
                setTournamentMatchesLoading(true);
                const query = selectedTournamentId ? `?tournament_id=${selectedTournamentId}` : "";
                const res = await fetch(`/api/tournament-matches${query}`, { signal: controller.signal });
                const json = await res.json();
                if (res.ok && json.success) {
                    setTournamentMatches(json.data || []);
                }
            } catch (err) {
                if (err.name !== "AbortError") {
                    console.error("Failed to load tournament matches", err);
                }
            } finally {
                setTournamentMatchesLoading(false);
            }
        })();
        return () => controller.abort();
    }, [selectedType, selectedTournamentId]);

    // If Edit mode, fetch the existing innings data
    useEffect(() => {
        if (!isEdit) return;
        const controller = new AbortController();
        (async () => {
            setFetching(true);
            setError("");
            try {
                const res = await fetch(`/api/match-innings/${id}`, { signal: controller.signal });
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to load innings record");
                }
                const d = json.data;
                setFormData({
                    match_id: String(d.match_id || ""),
                    innings_no: Number(d.innings_no) || 1,
                    batting_team_id: String(d.batting_team_id || ""),
                    bowling_team_id: String(d.bowling_team_id || ""),
                    total_runs: Number(d.total_runs) || 0,
                    total_wickets: Number(d.total_wickets) || 0,
                    total_overs: Number(d.total_overs) || 0,
                    total_balls: Number(d.total_balls) || 0,
                    extras: Number(d.extras) || 0,
                    wides: Number(d.wides) || 0,
                    no_balls: Number(d.no_balls) || 0,
                    byes: Number(d.byes) || 0,
                    leg_byes: Number(d.leg_byes) || 0,
                    penalty_runs: Number(d.penalty_runs) || 0,
                    target_runs: d.target_runs !== null && d.target_runs !== undefined ? String(d.target_runs) : "",
                    innings_status: d.innings_status || "In Progress",
                });
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            } finally {
                if (!controller.signal.aborted) setFetching(false);
            }
        })();
        return () => controller.abort();
    }, [id, isEdit]);

    // Auto-detect whether match is a Tournament match or regular Match
    useEffect(() => {
        if (!formData.match_id || matches.length === 0) return;
        const m = matches.find((item) => String(item.id) === String(formData.match_id));
        if (m && m.tournament_id) {
            setSelectedType("Tournament");
            setSelectedTournamentId(String(m.tournament_id));
        }
    }, [formData.match_id, matches]);

    // Regular matches (excluding tournament-linked matches for clean separation)
    const regularMatches = useMemo(() => {
        const reg = matches.filter((m) => !m.tournament_id);
        return reg.length > 0 ? reg : matches;
    }, [matches]);

    // Current selected match object
    const selectedMatch = matches.find((m) => String(m.id) === String(formData.match_id));
    const isFutureMatch = Boolean(selectedMatch?.match_date && isMatchDateInFuture(selectedMatch.match_date));
    const matchOvers = selectedMatch?.overs ? Number(selectedMatch.overs) : 20;

    // Auto-fill total_overs from selected match when match changes or loads in New mode
    useEffect(() => {
        if (!isEdit && selectedMatch) {
            const mOvers = selectedMatch.overs ? Number(selectedMatch.overs) : 20;
            setFormData((prev) => ({
                ...prev,
                total_overs: prev.total_overs || mOvers,
                total_balls: prev.total_balls || oversToBalls(mOvers),
            }));
        }
    }, [selectedMatch, isEdit]);

    // When a match is selected in New mode, auto-set batting & bowling teams and match overs
    const handleMatchChange = async (newMatchId) => {
        if (!newMatchId) {
            setFormData((prev) => ({
                ...prev,
                match_id: "",
                batting_team_id: "",
                bowling_team_id: "",
            }));
            return;
        }

        let targetMatch = matches.find((m) => String(m.id) === String(newMatchId));
        if (!targetMatch) {
            try {
                const res = await fetch(`/api/matches/${newMatchId}`);
                const json = await res.json();
                if (res.ok && json.success && json.data) {
                    targetMatch = json.data;
                    setMatches((prev) => {
                        if (prev.some((item) => String(item.id) === String(newMatchId))) return prev;
                        return [...prev, targetMatch];
                    });
                }
            } catch {
                /* ignore */
            }
        }

        const mOvers = targetMatch?.overs ? Number(targetMatch.overs) : 20;

        setFormData((prev) => ({
            ...prev,
            match_id: newMatchId,
            batting_team_id: targetMatch?.team_a_id ? String(targetMatch.team_a_id) : "",
            bowling_team_id: targetMatch?.team_b_id ? String(targetMatch.team_b_id) : "",
            total_overs: mOvers,
            total_balls: oversToBalls(mOvers),
        }));

        // Ensure match teams are initialized via /api/match-teams
        try {
            const res = await fetch(`/api/match-teams?match_id=${newMatchId}`);
            const json = await res.json();
            if (json.success && json.data) {
                const teamA = json.data.find((t) => t.team_side === "A");
                const teamB = json.data.find((t) => t.team_side === "B");
                if (teamA && teamB) {
                    setFormData((prev) => ({
                        ...prev,
                        match_id: newMatchId,
                        batting_team_id: String(teamA.team_id),
                        bowling_team_id: String(teamB.team_id),
                        total_overs: mOvers,
                        total_balls: oversToBalls(mOvers),
                    }));
                }
            }
        } catch {
            /* ignore */
        }
    };

    // When switching between Match and Tournament types
    const handleTypeChange = (newType) => {
        setSelectedType(newType);
        setError("");
        setFormData((prev) => ({
            ...prev,
            match_id: "",
            batting_team_id: "",
            bowling_team_id: "",
        }));
    };

    // When switching tournament filter
    const handleTournamentChange = (tId) => {
        setSelectedTournamentId(tId);
        setError("");
        setFormData((prev) => ({
            ...prev,
            match_id: "",
            batting_team_id: "",
            bowling_team_id: "",
        }));
    };

    // When selecting a tournament fixture
    const handleTournamentMatchSelect = async (e) => {
        const val = e.target.value;
        if (!val) {
            handleMatchChange("");
            return;
        }

        const fixtureId = val.startsWith("tm_") ? Number(val.replace("tm_", "")) : Number(val);
        const fixture = tournamentMatches.find((tm) => Number(tm.id) === fixtureId);

        if (!fixture) {
            handleMatchChange(val);
            return;
        }

        // Rule: Match date validation
        if (isMatchDateInFuture(fixture.scheduled_date)) {
            setError(`Tournament match ${fixture.match_no} (${fixture.team_a_name || "Team A"} vs ${fixture.team_b_name || "Team B"}) is scheduled for ${formatDate(fixture.scheduled_date)}. Innings cannot be created before the scheduled match date.`);
            return;
        }

        // If fixture already has match_id linked in cst_matches
        if (fixture.match_id) {
            await handleMatchChange(String(fixture.match_id));
            return;
        }

        // If not yet linked, initialize fixture scorecard
        setInitializingFixture(true);
        setError("");
        try {
            const res = await fetch(`/api/tournament-matches/${fixture.id}/scorecard`, {
                method: "POST",
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || "Failed to initialize tournament scorecard");
            }

            // Update fixture's match_id in tournamentMatches
            setTournamentMatches((prev) =>
                prev.map((item) => (item.id === fixture.id ? { ...item, match_id: data.match_id } : item))
            );

            // Refresh regular/all matches
            await fetchMatchesList();

            // Bind match and teams
            await handleMatchChange(String(data.match_id));
        } catch (err) {
            setError(err.message || "Unable to initialize tournament match scorecard");
        } finally {
            setInitializingFixture(false);
        }
    };

    // Swap batting and bowling teams
    const handleSwapTeams = () => {
        setFormData((prev) => ({
            ...prev,
            batting_team_id: prev.bowling_team_id,
            bowling_team_id: prev.batting_team_id,
        }));
        clearError("batting_team_id");
        clearError("bowling_team_id");
    };

    const validateField = (name, value, currentFormData = formData) => {
        let err = "";
        if (name === "match_id") {
            if (!value) err = "Please select a match.";
        } else if (name === "batting_team_id") {
            if (!value) err = "Please select a batting team.";
            else if (currentFormData.bowling_team_id && Number(value) === Number(currentFormData.bowling_team_id)) {
                err = "Batting team and bowling team must be different.";
            }
        } else if (name === "bowling_team_id") {
            if (!value) err = "Please select a bowling team.";
            else if (currentFormData.batting_team_id && Number(value) === Number(currentFormData.batting_team_id)) {
                err = "Bowling team and batting team must be different.";
            }
        } else if (name === "innings_no") {
            if (!value) err = "Please select an innings number.";
        } else if (name === "total_runs") {
            if (value === "" || value === null || Number(value) < 0) {
                err = "Total runs must be a non-negative number.";
            }
        } else if (name === "total_wickets") {
            if (value === "" || value === null || Number(value) < 0 || Number(value) > 10) {
                err = "Total wickets must be between 0 and 10.";
            }
        } else if (name === "total_overs") {
            if (value === "" || value === null) {
                err = "Total overs is required.";
            } else if (!isValidCricketOvers(value)) {
                err = "Invalid overs format. Decimal part must be between .0 and .5 (e.g. 19.4).";
            } else {
                const enteredBalls = oversToBalls(value);
                const maxBalls = matchOvers * 6;
                if (maxBalls > 0 && enteredBalls > maxBalls) {
                    err = `Overs mismatch! Total overs (${value}) exceeds match limit of ${matchOvers} overs.`;
                }
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
        const fields = ["match_id", "innings_no", "batting_team_id", "bowling_team_id", "total_runs", "total_wickets", "total_overs"];
        fields.forEach((f) => {
            const err = validateField(f, formData[f]);
            if (err) errors[f] = err;
        });
        return errors;
    };

    // Handle input change
    const handleChange = (e) => {
        const { name, value } = e.target;
        clearError(name);
        if (name === "batting_team_id") clearError("bowling_team_id");
        if (name === "bowling_team_id") clearError("batting_team_id");

        setFormData((prev) => {
            const updated = { ...prev, [name]: value };

            // If overs changed, auto-calculate total balls
            if (name === "total_overs") {
                if (isValidCricketOvers(value)) {
                    updated.total_balls = oversToBalls(value);
                }
            }

            // If any extra changed and autoSum is active, update extras
            if (autoSumExtras && ["wides", "no_balls", "byes", "leg_byes", "penalty_runs"].includes(name)) {
                const w = Number(name === "wides" ? value : prev.wides) || 0;
                const nb = Number(name === "no_balls" ? value : prev.no_balls) || 0;
                const b = Number(name === "byes" ? value : prev.byes) || 0;
                const lb = Number(name === "leg_byes" ? value : prev.leg_byes) || 0;
                const pen = Number(name === "penalty_runs" ? value : prev.penalty_runs) || 0;
                updated.extras = w + nb + b + lb + pen;
            }

            // Auto-calculate Target Runs = Total Runs + Total Extras
            if (["total_runs", "extras", "wides", "no_balls", "byes", "leg_byes", "penalty_runs"].includes(name)) {
                const tr = Number(name === "total_runs" ? value : prev.total_runs) || 0;
                const ex = Number(updated.extras !== undefined ? updated.extras : prev.extras) || 0;
                updated.target_runs = String(tr + ex);
            }

            return updated;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");

        if (isLockedForCurrentUser) {
            setError("This innings is marked as Completed and is locked. Only Super Admin or Academy Admin can edit it.");
            return;
        }

        if (isFutureMatch) {
            setError(`Innings cannot be created or updated before the scheduled match date (${formatDate(selectedMatch?.match_date)}).`);
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

        const enteredBalls = oversToBalls(formData.total_overs);
        const maxBalls = matchOvers * 6;

        let calculatedStatus = formData.innings_status;
        if (
            Number(formData.total_wickets) >= 10 ||
            (maxBalls > 0 && enteredBalls >= maxBalls) ||
            (matchOvers > 0 && Number(formData.total_overs) >= matchOvers)
        ) {
            calculatedStatus = "Completed";
        }

        const payload = {
            match_id: Number(formData.match_id),
            innings_no: Number(formData.innings_no),
            batting_team_id: Number(formData.batting_team_id),
            bowling_team_id: Number(formData.bowling_team_id),
            total_runs: Number(formData.total_runs) || 0,
            total_wickets: Number(formData.total_wickets) || 0,
            total_overs: Number(formData.total_overs) || 0,
            total_balls: enteredBalls,
            extras: Number(formData.extras) || 0,
            wides: Number(formData.wides) || 0,
            no_balls: Number(formData.no_balls) || 0,
            byes: Number(formData.byes) || 0,
            leg_byes: Number(formData.leg_byes) || 0,
            penalty_runs: Number(formData.penalty_runs) || 0,
            target_runs: formData.target_runs !== "" && formData.target_runs !== null ? Number(formData.target_runs) : null,
            innings_status: calculatedStatus,
        };

        setLoading(true);

        try {
            const url = isEdit ? `/api/match-innings/${id}` : "/api/match-innings";
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
                throw new Error(json.message || "Failed to save match innings");
            }

            setSuccessMsg(isEdit ? "Match innings updated successfully!" : "Match innings created successfully!");
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
                Loading innings data...
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} noValidate>
            {error && <div className="alert alert-danger">{error}</div>}
            {successMsg && <div className="alert alert-success">{successMsg}</div>}
            {isFutureMatch && (
                <div className="alert alert-warning border border-warning-subtle d-flex align-items-center gap-2 mb-3 shadow-sm">
                    <Calendar size={18} className="text-warning flex-shrink-0" />
                    <div>
                        <strong>Upcoming Match ({formatDate(selectedMatch?.match_date)}):</strong> Innings cannot be created or updated before the scheduled match date.
                    </div>
                </div>
            )}
            {isLockedForCurrentUser && (
                <div className="alert alert-warning d-flex align-items-center gap-2 mb-3">
                    <Lock size={18} className="text-warning flex-shrink-0" />
                    <div>
                        <strong>Innings Completed (Locked):</strong> This innings has ended (all out or overs limit reached). Player scores and innings details can only be edited by a Super Admin or Academy Admin.
                    </div>
                </div>
            )}

            <div className="row g-3">
                {/* 1. Match Type Dropdown: Match vs Tournament */}
                <div className="col-md-3">
                    <label className="form-label fw-semibold">
                        Type <RequiredLabel />
                    </label>
                    <select
                        className="form-select fw-semibold"
                        value={selectedType}
                        onChange={(e) => handleTypeChange(e.target.value)}
                        disabled={isEdit}
                    >
                        <option value="Match">Match</option>
                        <option value="Tournament">Tournament</option>
                    </select>
                </div>

                {/* 2. Tournament Selection (Visible when Tournament is selected) */}
                {selectedType === "Tournament" && (
                    <div className="col-md-4">
                        <label className="form-label fw-semibold">
                            Tournament
                        </label>
                        <select
                            className="form-select"
                            value={selectedTournamentId}
                            onChange={(e) => handleTournamentChange(e.target.value)}
                            disabled={isEdit || tournamentsLoading}
                        >
                            <option value="">All Tournaments</option>
                            {tournaments.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.tournament_name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* 3. Match Selection Dropdown (Binds based on Type and Tournament selection) */}
                <div className={selectedType === "Tournament" ? "col-md-5" : "col-md-9"}>
                    <label className="form-label fw-semibold">
                        {selectedType === "Tournament" ? "Tournament Match" : "Match"}{" "}
                        <RequiredLabel />
                    </label>
                    {selectedType === "Tournament" ? (
                        <>
                            <select
                                name="match_id"
                                id="match_id"
                                className={`form-select ${fieldErrors.match_id ? "is-invalid border-danger" : ""}`}
                                value={(() => {
                                    const fixture = tournamentMatches.find(
                                        (tm) => tm.match_id && String(tm.match_id) === String(formData.match_id)
                                    );
                                    if (fixture) return `tm_${fixture.id}`;
                                    return "";
                                })()}
                                onChange={handleTournamentMatchSelect}
                                onBlur={handleBlur}
                                disabled={isEdit || tournamentMatchesLoading || initializingFixture}
                            >
                                <option value="">
                                    {tournamentMatchesLoading
                                        ? "Loading tournament matches..."
                                        : initializingFixture
                                        ? "Initializing fixture scorecard..."
                                        : tournamentMatches.length === 0
                                        ? "No matches found in tournament"
                                        : "Select a tournament match..."}
                                </option>
                                {tournamentMatches.map((tm) => {
                                    const effStatus = tm.status || "Scheduled";
                                    return (
                                        <option key={tm.id} value={`tm_${tm.id}`}>
                                            Match {tm.match_no}: {tm.team_a_name || "TBD"} vs {tm.team_b_name || "TBD"}{" "}
                                            {tm.group_name ? `(${tm.group_name})` : ""} · [{effStatus}]
                                        </option>
                                    );
                                })}
                            </select>
                            <FormError error={fieldErrors.match_id} />
                        </>
                    ) : (
                        <>
                            <select
                                name="match_id"
                                id="match_id"
                                className={`form-select ${fieldErrors.match_id ? "is-invalid border-danger" : ""}`}
                                value={formData.match_id}
                                onChange={(e) => {
                                    handleMatchChange(e.target.value);
                                    clearError("match_id");
                                }}
                                onBlur={handleBlur}
                                disabled={isEdit}
                            >
                                <option value="">Select a match...</option>
                                {regularMatches.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.match_no ? `Match ${m.match_no}` : `Match #${m.id}`}: {m.team_a_name} vs {m.team_b_name}
                                    </option>
                                ))}
                            </select>
                            <FormError error={fieldErrors.match_id} />
                        </>
                    )}
                </div>

                {/* Innings No & Status */}
                <div className="col-md-6">
                    <label className="form-label fw-semibold">
                        Innings No <RequiredLabel />
                    </label>
                    <select
                        name="innings_no"
                        id="innings_no"
                        className={`form-select ${fieldErrors.innings_no ? "is-invalid border-danger" : ""}`}
                        value={formData.innings_no}
                        onChange={handleChange}
                        onBlur={handleBlur}
                    >
                        <option value="1">1st Innings</option>
                        <option value="2">2nd Innings</option>
                        <option value="3">3rd Innings (Super Over / Multi-day)</option>
                        <option value="4">4th Innings (Super Over / Multi-day)</option>
                    </select>
                    <FormError error={fieldErrors.innings_no} />
                </div>

                <div className="col-md-6">
                    <label className="form-label fw-semibold">
                        Innings Status <RequiredLabel />
                    </label>
                    <select
                        name="innings_status"
                        id="innings_status"
                        className={`form-select ${fieldErrors.innings_status ? "is-invalid border-danger" : ""}`}
                        value={formData.innings_status}
                        onChange={handleChange}
                        onBlur={handleBlur}
                    >
                        {INNINGS_STATUSES.map((st) => (
                            <option key={st} value={st}>
                                {st}
                            </option>
                        ))}
                    </select>
                    <FormError error={fieldErrors.innings_status} />
                </div>

                {/* Batting & Bowling Teams */}
                <div className="col-12">
                    <div className="p-3 bg-light rounded-3 border">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="fw-semibold text-dark">Teams Assignment</span>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={handleSwapTeams}
                                title="Swap Batting and Bowling Teams"
                            >
                                <ArrowUpDown size={14} className="me-1" /> Swap Batting / Bowling
                            </button>
                        </div>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label className="form-label text-muted small">
                                    Batting Team <RequiredLabel />
                                </label>
                                {selectedMatch ? (
                                    <>
                                        <select
                                            name="batting_team_id"
                                            id="batting_team_id"
                                            className={`form-select ${fieldErrors.batting_team_id ? "is-invalid border-danger" : ""}`}
                                            value={formData.batting_team_id}
                                            onChange={handleChange}
                                            onBlur={handleBlur}
                                        >
                                            <option value="">Select Batting Team</option>
                                            <option value={selectedMatch.team_a_id}>{selectedMatch.team_a_name}</option>
                                            <option value={selectedMatch.team_b_id}>{selectedMatch.team_b_name}</option>
                                        </select>
                                        <FormError error={fieldErrors.batting_team_id} />
                                    </>
                                ) : (
                                    <>
                                        <input
                                            type="number"
                                            name="batting_team_id"
                                            id="batting_team_id"
                                            className={`form-control ${fieldErrors.batting_team_id ? "is-invalid border-danger" : ""}`}
                                            placeholder="Batting Team ID"
                                            value={formData.batting_team_id}
                                            onChange={handleChange}
                                            onBlur={handleBlur}
                                        />
                                        <FormError error={fieldErrors.batting_team_id} />
                                    </>
                                )}
                            </div>
                            <div className="col-md-6">
                                <label className="form-label text-muted small">
                                    Bowling Team <RequiredLabel />
                                </label>
                                {selectedMatch ? (
                                    <>
                                        <select
                                            name="bowling_team_id"
                                            id="bowling_team_id"
                                            className={`form-select ${fieldErrors.bowling_team_id ? "is-invalid border-danger" : ""}`}
                                            value={formData.bowling_team_id}
                                            onChange={handleChange}
                                            onBlur={handleBlur}
                                        >
                                            <option value="">Select Bowling Team</option>
                                            <option value={selectedMatch.team_a_id}>{selectedMatch.team_a_name}</option>
                                            <option value={selectedMatch.team_b_id}>{selectedMatch.team_b_name}</option>
                                        </select>
                                        <FormError error={fieldErrors.bowling_team_id} />
                                    </>
                                ) : (
                                    <>
                                        <input
                                            type="number"
                                            name="bowling_team_id"
                                            id="bowling_team_id"
                                            className={`form-control ${fieldErrors.bowling_team_id ? "is-invalid border-danger" : ""}`}
                                            placeholder="Bowling Team ID"
                                            value={formData.bowling_team_id}
                                            onChange={handleChange}
                                            onBlur={handleBlur}
                                        />
                                        <FormError error={fieldErrors.bowling_team_id} />
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Score & Overs */}
                <div className="col-md-3">
                    <label className="form-label fw-semibold">
                        Total Runs <RequiredLabel />
                    </label>
                    <input
                        type="number"
                        name="total_runs"
                        id="total_runs"
                        className={`form-control ${fieldErrors.total_runs ? "is-invalid border-danger" : ""}`}
                        min="0"
                        placeholder="e.g. 175"
                        value={formData.total_runs}
                        onChange={handleChange}
                        onBlur={handleBlur}
                    />
                    <FormError error={fieldErrors.total_runs} />
                </div>

                <div className="col-md-3">
                    <label className="form-label fw-semibold">
                        Total Wickets <RequiredLabel />
                    </label>
                    <input
                        type="number"
                        name="total_wickets"
                        id="total_wickets"
                        className={`form-control ${fieldErrors.total_wickets ? "is-invalid border-danger" : ""}`}
                        min="0"
                        max="10"
                        placeholder="0-10"
                        value={formData.total_wickets}
                        onChange={handleChange}
                        onBlur={handleBlur}
                    />
                    <FormError error={fieldErrors.total_wickets} />
                </div>

                <div className="col-md-3">
                    <label className="form-label fw-semibold">
                        Total Overs <RequiredLabel />
                    </label>
                    <input
                        type="number"
                        step="0.1"
                        name="total_overs"
                        id="total_overs"
                        className={`form-control ${fieldErrors.total_overs ? "is-invalid border-danger" : ""}`}
                        min="0"
                        placeholder="e.g. 19.4"
                        value={formData.total_overs}
                        onChange={handleChange}
                        onBlur={handleBlur}
                    />
                    <FormError error={fieldErrors.total_overs} />
                    <small className="form-text text-muted">
                        Max allowed: {matchOvers} overs ({matchOvers * 6} balls)
                    </small>
                </div>

                <div className="col-md-3">
                    <label className="form-label fw-semibold">Target Runs</label>
                    <input
                        type="number"
                        name="target_runs"
                        className="form-control"
                        min="0"
                        placeholder="Auto-calculated from Total Runs + Extras"
                        value={formData.target_runs}
                        onChange={handleChange}
                    />
                    <small className="form-text text-muted">
                        Auto-calculated from Total Runs + Extras
                    </small>
                </div>

                {/* Extras Breakdown */}
                <div className="col-12">
                    <div className="p-3 bg-light rounded-3 border">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="fw-semibold text-dark">Extras Breakdown</span>
                            <div className="form-check form-switch mb-0">
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id="autoSumSwitch"
                                    checked={autoSumExtras}
                                    onChange={(e) => setAutoSumExtras(e.target.checked)}
                                />
                                <label className="form-check-label small text-muted" htmlFor="autoSumSwitch">
                                    Auto-sum extras
                                </label>
                            </div>
                        </div>
                        <div className="row g-2">
                            <div className="col-4 col-md-2">
                                <label className="form-label small text-muted">Total Extras</label>
                                <input
                                    type="number"
                                    name="extras"
                                    className="form-control fw-bold"
                                    min="0"
                                    value={formData.extras}
                                    onChange={handleChange}
                                    readOnly={autoSumExtras}
                                />
                            </div>
                            <div className="col-4 col-md-2">
                                <label className="form-label small text-muted">Wides (wd)</label>
                                <input
                                    type="number"
                                    name="wides"
                                    className="form-control"
                                    min="0"
                                    value={formData.wides}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="col-4 col-md-2">
                                <label className="form-label small text-muted">No Balls (nb)</label>
                                <input
                                    type="number"
                                    name="no_balls"
                                    className="form-control"
                                    min="0"
                                    value={formData.no_balls}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="col-4 col-md-2">
                                <label className="form-label small text-muted">Byes (b)</label>
                                <input
                                    type="number"
                                    name="byes"
                                    className="form-control"
                                    min="0"
                                    value={formData.byes}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="col-4 col-md-2">
                                <label className="form-label small text-muted">Leg Byes (lb)</label>
                                <input
                                    type="number"
                                    name="leg_byes"
                                    className="form-control"
                                    min="0"
                                    value={formData.leg_byes}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="col-4 col-md-2">
                                <label className="form-label small text-muted">Penalty (pen)</label>
                                <input
                                    type="number"
                                    name="penalty_runs"
                                    className="form-control"
                                    min="0"
                                    value={formData.penalty_runs}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Form Buttons */}
                <div className="col-12 d-flex justify-content-end gap-2 mt-4">
                    <Link href={returnTo} className="btn btn-outline-secondary px-4">
                        Cancel
                    </Link>
                    <button type="submit" className="btn btn-primary px-4" disabled={loading || isLockedForCurrentUser || isFutureMatch}>
                        {loading ? (
                            <>
                                <RefreshCw className="spinner-border spinner-border-sm me-2" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={16} className="me-2" />
                                {isEdit ? "Update Innings" : "Create Innings"}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </form>
    );
}
