"use client";

import { ArrowLeft, Check, RefreshCw, Save } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
    calculateEconomy,
    getPlayerDisplayName,
    isValidCricketOvers,
    oversToBalls,
} from "../components/cricketHelpers";

const EMPTY_FORM = {
    match_id: "",
    innings_id: "",
    match_player_id: "",
    overs: 0,
    balls_bowled: 0,
    maidens: 0,
    runs_conceded: 0,
    wickets: 0,
    wides: 0,
    no_balls: 0,
};

export default function MatchBowlingScorecardForm({ id = null, returnTo = "/next_panel/match-bowling-scorecard" }) {
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
    const [bowlingPlayers, setBowlingPlayers] = useState([]);
    const [existingBowling, setExistingBowling] = useState([]);

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEdit);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

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
                const res = await fetch(`/api/match-bowling-scorecard/${id}`, { signal: controller.signal });
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to load bowling scorecard record");
                }
                const d = json.data;
                setFormData({
                    match_id: String(d.match_id || ""),
                    innings_id: String(d.innings_id || ""),
                    match_player_id: String(d.match_player_id || ""),
                    overs: Number(d.overs) || 0,
                    balls_bowled: Number(d.balls_bowled) || 0,
                    maidens: Number(d.maidens) || 0,
                    runs_conceded: Number(d.runs_conceded) || 0,
                    wickets: Number(d.wickets) || 0,
                    wides: Number(d.wides) || 0,
                    no_balls: Number(d.no_balls) || 0,
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

    // Fetch bowling team match players
    useEffect(() => {
        if (!formData.match_id) {
            setBowlingPlayers([]);
            return;
        }

        const currentInnings = inningsList.find((i) => String(i.id) === String(formData.innings_id));

        const controller = new AbortController();
        (async () => {
            try {
                let url = `/api/match-players?match_id=${formData.match_id}`;
                if (currentInnings?.bowling_team_id) {
                    url += `&team_id=${currentInnings.bowling_team_id}`;
                }
                const res = await fetch(url, { signal: controller.signal });
                const json = await res.json();
                if (res.ok && json.success) {
                    setBowlingPlayers(json.data || []);
                }
            } catch {
                /* ignore */
            }
        })();
        return () => controller.abort();
    }, [formData.match_id, formData.innings_id, inningsList]);

    // Fetch existing bowling entries for the selected innings to calculate overs mismatch
    useEffect(() => {
        if (!formData.innings_id) {
            setExistingBowling([]);
            return;
        }
        const controller = new AbortController();
        (async () => {
            try {
                const res = await fetch(`/api/match-bowling-scorecard?innings_id=${formData.innings_id}`, {
                    signal: controller.signal,
                });
                const json = await res.json();
                if (res.ok && json.success) {
                    setExistingBowling(json.data || []);
                }
            } catch {
                /* ignore */
            }
        })();
        return () => controller.abort();
    }, [formData.innings_id]);

    const handleMatchChange = (mId) => {
        setFormData((prev) => ({
            ...prev,
            match_id: mId,
            innings_id: "",
            match_player_id: "",
        }));
    };

    const handleInningsChange = (iId) => {
        setFormData((prev) => ({
            ...prev,
            innings_id: iId,
            match_player_id: "",
        }));
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => {
            const updated = { ...prev, [name]: value };

            // When overs changes, automatically sync balls_bowled
            if (name === "overs") {
                if (isValidCricketOvers(value)) {
                    updated.balls_bowled = oversToBalls(value);
                }
            }

            return updated;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");

        if (!formData.match_id || !formData.innings_id || !formData.match_player_id) {
            setError("Match, Innings and Bowler are required.");
            return;
        }

        if (!isValidCricketOvers(formData.overs)) {
            setError("Invalid cricket overs format. Decimal part must be between 0 and 5 (e.g. 4.0, 3.4).");
            return;
        }

        const balls = oversToBalls(formData.overs);

        if (exceedsMatchLimit) {
            setError(`Overs mismatch! Bowler's overs (${formData.overs}) cannot exceed the match limit of ${matchOvers} overs (${maxMatchBalls} balls).`);
            return;
        }

        if (exceedsInningsLimit) {
            setError(`Overs mismatch! Innings total is ${currentInnings?.total_overs} overs (${inningsTotalBalls} balls). Other bowlers bowled ${otherBowlersBalls} balls. This bowler can bowl at most ${maxAllowedBalls} balls (~${maxAllowedOversFormatted} overs).`);
            return;
        }

        if (widesExceeded) {
            setError(`Wides (wd) mismatch! Innings total wides is ${inningsWides}. Other bowlers bowled ${otherWides} wides. This bowler can have at most ${maxAllowedWides} wide(s).`);
            return;
        }

        if (noBallsExceeded) {
            setError(`No-balls (nb) mismatch! Innings total no-balls is ${inningsNoBalls}. Other bowlers bowled ${otherNoBalls} no-balls. This bowler can have at most ${maxAllowedNoBalls} no-ball(s).`);
            return;
        }

        if (wicketsExceeded) {
            setError(`Wickets (W) mismatch! Innings total wickets is ${inningsWickets}. Other bowlers took ${otherWickets} wickets. This bowler can take at most ${maxAllowedWickets} wicket(s).`);
            return;
        }

        if (extrasExceeded) {
            setError(`Extras mismatch! Total bowler extras (${otherWides + enteredWides + otherNoBalls + enteredNoBalls}) cannot exceed innings total extras (${inningsExtras}).`);
            return;
        }

        const payload = {
            match_id: Number(formData.match_id),
            innings_id: Number(formData.innings_id),
            match_player_id: Number(formData.match_player_id),
            overs: Number(formData.overs),
            balls_bowled: balls,
            maidens: Number(formData.maidens) || 0,
            runs_conceded: Number(formData.runs_conceded) || 0,
            wickets: Number(formData.wickets) || 0,
            wides: Number(formData.wides) || 0,
            no_balls: Number(formData.no_balls) || 0,
        };

        setLoading(true);
        try {
            const url = isEdit ? `/api/match-bowling-scorecard/${id}` : "/api/match-bowling-scorecard";
            const method = isEdit ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to save bowling scorecard");
            }

            setSuccessMsg(isEdit ? "Bowling record updated successfully!" : "Bowling record created successfully!");
            setTimeout(() => {
                router.push(returnTo);
            }, 700);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const selectedMatch = matches.find((m) => String(m.id) === String(formData.match_id));
    const matchOvers = selectedMatch?.overs ? Number(selectedMatch.overs) : 20;
    const maxMatchBalls = matchOvers * 6;

    const currentInnings = inningsList.find((i) => String(i.id) === String(formData.innings_id));
    const rawInningsOvers = Number(currentInnings?.total_overs) || 0;
    const inningsTotalBalls = currentInnings?.total_balls ? Number(currentInnings.total_balls) : oversToBalls(rawInningsOvers);

    const otherBowlersBalls = existingBowling
        .filter((b) => !isEdit || String(b.id) !== String(id))
        .reduce((sum, b) => sum + (Number(b.balls_bowled) || 0), 0);

    const enteredBalls = isValidCricketOvers(formData.overs) ? oversToBalls(formData.overs) : 0;
    const maxAllowedBalls = inningsTotalBalls > 0 ? Math.max(0, inningsTotalBalls - otherBowlersBalls) : maxMatchBalls;
    const maxAllowedOversFormatted = `${Math.floor(maxAllowedBalls / 6)}.${maxAllowedBalls % 6}`;

    const exceedsMatchLimit = enteredBalls > maxMatchBalls;
    const exceedsInningsLimit = inningsTotalBalls > 0 && (otherBowlersBalls + enteredBalls > inningsTotalBalls);
    const oversExceeded = exceedsMatchLimit || exceedsInningsLimit;

    // Extras & Wickets validations
    const inningsWides = Number(currentInnings?.wides) || 0;
    const inningsNoBalls = Number(currentInnings?.no_balls) || 0;
    const inningsWickets = Number(currentInnings?.total_wickets) || 0;
    const inningsExtras = Number(currentInnings?.extras) || 0;

    const otherWides = existingBowling
        .filter((b) => !isEdit || String(b.id) !== String(id))
        .reduce((sum, b) => sum + (Number(b.wides) || 0), 0);

    const otherNoBalls = existingBowling
        .filter((b) => !isEdit || String(b.id) !== String(id))
        .reduce((sum, b) => sum + (Number(b.no_balls) || 0), 0);

    const otherWickets = existingBowling
        .filter((b) => !isEdit || String(b.id) !== String(id))
        .reduce((sum, b) => sum + (Number(b.wickets) || 0), 0);

    const enteredWides = Number(formData.wides) || 0;
    const enteredNoBalls = Number(formData.no_balls) || 0;
    const enteredWickets = Number(formData.wickets) || 0;

    const maxAllowedWides = Math.max(0, inningsWides - otherWides);
    const maxAllowedNoBalls = Math.max(0, inningsNoBalls - otherNoBalls);
    const maxAllowedWickets = Math.max(0, inningsWickets - otherWickets);

    const widesExceeded = currentInnings && (otherWides + enteredWides > inningsWides);
    const noBallsExceeded = currentInnings && (otherNoBalls + enteredNoBalls > inningsNoBalls);
    const wicketsExceeded = currentInnings && (otherWickets + enteredWickets > inningsWickets);
    const extrasExceeded = inningsExtras > 0 && ((otherWides + enteredWides + otherNoBalls + enteredNoBalls) > inningsExtras);

    const hasValidationErrors = oversExceeded || widesExceeded || noBallsExceeded || wicketsExceeded || extrasExceeded;

    const economyPreview = calculateEconomy(formData.runs_conceded, formData.balls_bowled);

    if (fetching) {
        return (
            <div className="text-center py-5">
                <RefreshCw className="spinner-border spinner-border-sm me-2" />
                Loading bowling record...
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-danger">{error}</div>}
            {successMsg && <div className="alert alert-success">{successMsg}</div>}

            <div className="row g-3">
                {/* Match Selection */}
                <div className="col-md-6">
                    <label className="form-label fw-semibold">
                        Match <span className="text-danger">*</span>
                    </label>
                    <select
                        name="match_id"
                        className="form-select"
                        value={formData.match_id}
                        onChange={(e) => handleMatchChange(e.target.value)}
                        disabled={isEdit}
                        required
                    >
                        <option value="">Select a match...</option>
                        {matches.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.match_no ? `Match ${m.match_no}` : `Match #${m.id}`}: {m.team_a_name} vs {m.team_b_name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Innings Selection */}
                <div className="col-md-6">
                    <label className="form-label fw-semibold">
                        Innings <span className="text-danger">*</span>
                    </label>
                    <select
                        name="innings_id"
                        className="form-select"
                        value={formData.innings_id}
                        onChange={(e) => handleInningsChange(e.target.value)}
                        disabled={isEdit || !formData.match_id}
                        required
                    >
                        <option value="">Select an innings...</option>
                        {inningsList.map((i) => (
                            <option key={i.id} value={i.id}>
                                Innings {i.innings_no}: {i.bowling_team_name} (Bowling)
                            </option>
                        ))}
                    </select>
                </div>

                {/* Bowler Selection */}
                <div className="col-md-12">
                    <label className="form-label fw-semibold">
                        Bowler (Bowling Team) <span className="text-danger">*</span>
                    </label>
                    <select
                        name="match_player_id"
                        className="form-select"
                        value={formData.match_player_id}
                        onChange={handleChange}
                        disabled={isEdit || !formData.innings_id}
                        required
                    >
                        <option value="">Select a bowler...</option>
                        {bowlingPlayers.map((p) => (
                            <option key={p.id} value={p.id}>
                                {getPlayerDisplayName(p)} {p.jersey_no ? `(#${p.jersey_no})` : ""} - {p.team_name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Innings Overs, Extras & Wickets Tracker */}
                {(inningsTotalBalls > 0 || selectedMatch) && (
                    <div className="col-12">
                        <div className={`p-3 rounded-3 border ${hasValidationErrors ? "bg-danger-subtle border-danger" : "bg-light border"}`}>
                            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                                <div>
                                    <span className="fw-semibold text-dark me-2">Match Limit:</span>
                                    <span className="badge bg-primary fs-6 me-3">{matchOvers} ov ({maxMatchBalls} balls)</span>
                                    {inningsTotalBalls > 0 && (
                                        <>
                                            <span className="fw-semibold text-dark me-2">Innings Total:</span>
                                            <span className="badge bg-info fs-6">{currentInnings?.total_overs} ov ({inningsTotalBalls} balls)</span>
                                        </>
                                    )}
                                </div>
                                <div className="d-flex flex-wrap gap-3 text-muted small">
                                    <span>Other Bowlers: <strong className="text-dark">{otherBowlersBalls} balls</strong></span>
                                    <span>Max Overs: <strong className={oversExceeded ? "text-danger fw-bold" : "text-success fw-bold"}>~{maxAllowedOversFormatted} ov</strong></span>
                                    <span>Wides Left: <strong className={widesExceeded ? "text-danger fw-bold" : "text-dark"}>{maxAllowedWides} / {inningsWides}</strong></span>
                                    <span>NB Left: <strong className={noBallsExceeded ? "text-danger fw-bold" : "text-dark"}>{maxAllowedNoBalls} / {inningsNoBalls}</strong></span>
                                    <span>Wickets Left: <strong className={wicketsExceeded ? "text-danger fw-bold" : "text-dark"}>{maxAllowedWickets} / {inningsWickets}</strong></span>
                                </div>
                            </div>
                            {oversExceeded && (
                                <div className="text-danger small mt-1 fw-semibold">
                                    ⚠️ Overs Mismatch! {exceedsMatchLimit ? `Entered overs exceeds match limit of ${matchOvers} overs.` : `Entered overs exceeds remaining balls (${maxAllowedBalls}) in this innings.`}
                                </div>
                            )}
                            {widesExceeded && (
                                <div className="text-danger small mt-1 fw-semibold">
                                    ⚠️ Wides Mismatch! Innings total wides is {inningsWides}. Other bowlers bowled {otherWides} wides. Max allowed for this bowler is {maxAllowedWides}.
                                </div>
                            )}
                            {noBallsExceeded && (
                                <div className="text-danger small mt-1 fw-semibold">
                                    ⚠️ No-balls Mismatch! Innings total no-balls is {inningsNoBalls}. Other bowlers bowled {otherNoBalls} no-balls. Max allowed for this bowler is {maxAllowedNoBalls}.
                                </div>
                            )}
                            {wicketsExceeded && (
                                <div className="text-danger small mt-1 fw-semibold">
                                    ⚠️ Wickets Mismatch! Innings total wickets is {inningsWickets}. Other bowlers took {otherWickets} wickets. Max allowed for this bowler is {maxAllowedWickets}.
                                </div>
                            )}
                            {extrasExceeded && !widesExceeded && !noBallsExceeded && (
                                <div className="text-danger small mt-1 fw-semibold">
                                    ⚠️ Extras Mismatch! Bowler extras ({otherWides + enteredWides + otherNoBalls + enteredNoBalls}) cannot exceed innings total extras ({inningsExtras}).
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Bowling Figures Card */}
                <div className="col-12">
                    <div className="card border-0 bg-light-subtle shadow-sm rounded-4 p-3">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6 className="mb-0 fw-semibold">Bowling Figures</h6>
                            <span className="badge bg-primary-subtle text-primary border fs-6">
                                Economy: {economyPreview}
                            </span>
                        </div>
                        <div className="row g-3">
                            <div className="col-md-3 col-6">
                                <label className="form-label small text-muted">
                                    Overs <span className="text-danger">*</span> (e.g. 4.0, 3.2)
                                </label>
                                <input
                                    type="number"
                                    step="0.1"
                                    name="overs"
                                    className={`form-control ${oversExceeded ? "is-invalid" : ""}`}
                                    min="0"
                                    value={formData.overs}
                                    onChange={handleChange}
                                    required
                                />
                                <small className="text-muted d-block mt-1">
                                    Balls bowled: {formData.balls_bowled}
                                </small>
                                {oversExceeded && (
                                    <div className="invalid-feedback">
                                        Max allowed: ~{maxAllowedOversFormatted} ov ({maxAllowedBalls} balls)
                                    </div>
                                )}
                            </div>

                            <div className="col-md-3 col-6">
                                <label className="form-label small text-muted">Maidens (M)</label>
                                <input
                                    type="number"
                                    name="maidens"
                                    className="form-control"
                                    min="0"
                                    value={formData.maidens}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-md-3 col-6">
                                <label className="form-label small text-muted">Runs Conceded (R)</label>
                                <input
                                    type="number"
                                    name="runs_conceded"
                                    className="form-control"
                                    min="0"
                                    value={formData.runs_conceded}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-md-3 col-6">
                                <label className="form-label small text-muted d-flex justify-content-between">
                                    <span>Wickets (W)</span>
                                    {currentInnings && (
                                        <span className="text-muted">Max: {maxAllowedWickets}</span>
                                    )}
                                </label>
                                <input
                                    type="number"
                                    name="wickets"
                                    className={`form-control fw-bold text-danger ${wicketsExceeded ? "is-invalid" : ""}`}
                                    min="0"
                                    value={formData.wickets}
                                    onChange={handleChange}
                                />
                                {wicketsExceeded && (
                                    <div className="invalid-feedback">
                                        Max {maxAllowedWickets} (Innings: {inningsWickets})
                                    </div>
                                )}
                            </div>

                            <div className="col-md-6 col-6">
                                <label className="form-label small text-muted d-flex justify-content-between">
                                    <span>Wides (WD)</span>
                                    {currentInnings && (
                                        <span className="text-muted">Max: {maxAllowedWides}</span>
                                    )}
                                </label>
                                <input
                                    type="number"
                                    name="wides"
                                    className={`form-control ${widesExceeded ? "is-invalid" : ""}`}
                                    min="0"
                                    value={formData.wides}
                                    onChange={handleChange}
                                />
                                {widesExceeded && (
                                    <div className="invalid-feedback">
                                        Max {maxAllowedWides} (Innings: {inningsWides})
                                    </div>
                                )}
                            </div>

                            <div className="col-md-6 col-6">
                                <label className="form-label small text-muted d-flex justify-content-between">
                                    <span>No Balls (NB)</span>
                                    {currentInnings && (
                                        <span className="text-muted">Max: {maxAllowedNoBalls}</span>
                                    )}
                                </label>
                                <input
                                    type="number"
                                    name="no_balls"
                                    className={`form-control ${noBallsExceeded ? "is-invalid" : ""}`}
                                    min="0"
                                    value={formData.no_balls}
                                    onChange={handleChange}
                                />
                                {noBallsExceeded && (
                                    <div className="invalid-feedback">
                                        Max {maxAllowedNoBalls} (Innings: {inningsNoBalls})
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Form Buttons */}
                <div className="col-12 d-flex justify-content-end gap-2 mt-4">
                    <Link href={returnTo} className="btn btn-outline-secondary px-4">
                        Cancel
                    </Link>
                    <button type="submit" className="btn btn-primary px-4" disabled={loading || hasValidationErrors}>
                        {loading ? (
                            <>
                                <RefreshCw className="spinner-border spinner-border-sm me-2" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={16} className="me-2" />
                                {isEdit ? "Update Bowling Record" : "Save Bowling Record"}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </form>
    );
}
