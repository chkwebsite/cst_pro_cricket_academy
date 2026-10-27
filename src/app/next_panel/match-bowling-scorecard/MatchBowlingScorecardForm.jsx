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
                                    className="form-control"
                                    min="0"
                                    value={formData.overs}
                                    onChange={handleChange}
                                    required
                                />
                                <small className="text-muted d-block mt-1">
                                    Balls bowled: {formData.balls_bowled}
                                </small>
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
                                <label className="form-label small text-muted">Wickets (W)</label>
                                <input
                                    type="number"
                                    name="wickets"
                                    className="form-control fw-bold text-danger"
                                    min="0"
                                    max="10"
                                    value={formData.wickets}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-md-6 col-6">
                                <label className="form-label small text-muted">Wides (WD)</label>
                                <input
                                    type="number"
                                    name="wides"
                                    className="form-control"
                                    min="0"
                                    value={formData.wides}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="col-md-6 col-6">
                                <label className="form-label small text-muted">No Balls (NB)</label>
                                <input
                                    type="number"
                                    name="no_balls"
                                    className="form-control"
                                    min="0"
                                    value={formData.no_balls}
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
                    <button type="submit" className="btn btn-primary px-4" disabled={loading}>
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
