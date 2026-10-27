"use client";

import { ArrowLeft, ArrowUpDown, Check, RefreshCw, Save } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
    INNINGS_STATUSES,
    isValidCricketOvers,
    oversToBalls,
} from "../components/cricketHelpers";

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
    const router = useRouter();
    const searchParams = useSearchParams();
    const isEdit = Boolean(id);

    const [formData, setFormData] = useState({
        ...EMPTY_FORM,
        match_id: searchParams.get("match_id") || "",
    });
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEdit);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    const [autoSumExtras, setAutoSumExtras] = useState(true);

    // Fetch matches list for selection
    useEffect(() => {
        const controller = new AbortController();
        (async () => {
            try {
                const res = await fetch("/api/matches", { signal: controller.signal });
                const json = await res.json();
                if (res.ok && json.success) {
                    setMatches(json.data || []);
                }
            } catch {
                /* matches dropdown */
            }
        })();
        return () => controller.abort();
    }, []);

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

    // Current selected match object
    const selectedMatch = matches.find((m) => String(m.id) === String(formData.match_id));

    // When a match is selected in New mode, auto-set batting & bowling teams if available
    const handleMatchChange = async (newMatchId) => {
        setFormData((prev) => ({
            ...prev,
            match_id: newMatchId,
            batting_team_id: "",
            bowling_team_id: "",
        }));

        if (!newMatchId) return;

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
                    }));
                }
            }
        } catch {
            /* ignore */
        }
    };

    // Swap batting and bowling teams
    const handleSwapTeams = () => {
        setFormData((prev) => ({
            ...prev,
            batting_team_id: prev.bowling_team_id,
            bowling_team_id: prev.batting_team_id,
        }));
    };

    // Handle input change
    const handleChange = (e) => {
        const { name, value } = e.target;
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

            return updated;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");

        if (!formData.match_id) {
            setError("Please select a match.");
            return;
        }

        if (!formData.batting_team_id || !formData.bowling_team_id) {
            setError("Please select both batting and bowling teams.");
            return;
        }

        if (Number(formData.batting_team_id) === Number(formData.bowling_team_id)) {
            setError("Batting team and Bowling team must be different.");
            return;
        }

        if (!isValidCricketOvers(formData.total_overs)) {
            setError("Invalid overs format. Decimal part must be between 0 and 5 (e.g. 19.4).");
            return;
        }

        const payload = {
            match_id: Number(formData.match_id),
            innings_no: Number(formData.innings_no),
            batting_team_id: Number(formData.batting_team_id),
            bowling_team_id: Number(formData.bowling_team_id),
            total_runs: Number(formData.total_runs) || 0,
            total_wickets: Number(formData.total_wickets) || 0,
            total_overs: Number(formData.total_overs) || 0,
            total_balls: oversToBalls(formData.total_overs),
            extras: Number(formData.extras) || 0,
            wides: Number(formData.wides) || 0,
            no_balls: Number(formData.no_balls) || 0,
            byes: Number(formData.byes) || 0,
            leg_byes: Number(formData.leg_byes) || 0,
            penalty_runs: Number(formData.penalty_runs) || 0,
            target_runs: formData.target_runs !== "" && formData.target_runs !== null ? Number(formData.target_runs) : null,
            innings_status: formData.innings_status,
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

                {/* Innings No & Status */}
                <div className="col-md-3">
                    <label className="form-label fw-semibold">
                        Innings No <span className="text-danger">*</span>
                    </label>
                    <select
                        name="innings_no"
                        className="form-select"
                        value={formData.innings_no}
                        onChange={handleChange}
                        required
                    >
                        <option value="1">1st Innings</option>
                        <option value="2">2nd Innings</option>
                        <option value="3">3rd Innings (Super Over / Multi-day)</option>
                        <option value="4">4th Innings (Super Over / Multi-day)</option>
                    </select>
                </div>

                <div className="col-md-3">
                    <label className="form-label fw-semibold">
                        Innings Status <span className="text-danger">*</span>
                    </label>
                    <select
                        name="innings_status"
                        className="form-select"
                        value={formData.innings_status}
                        onChange={handleChange}
                        required
                    >
                        {INNINGS_STATUSES.map((st) => (
                            <option key={st} value={st}>
                                {st}
                            </option>
                        ))}
                    </select>
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
                                    Batting Team <span className="text-danger">*</span>
                                </label>
                                {selectedMatch ? (
                                    <select
                                        name="batting_team_id"
                                        className="form-select"
                                        value={formData.batting_team_id}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">Select Batting Team</option>
                                        <option value={selectedMatch.team_a_id}>{selectedMatch.team_a_name}</option>
                                        <option value={selectedMatch.team_b_id}>{selectedMatch.team_b_name}</option>
                                    </select>
                                ) : (
                                    <input
                                        type="number"
                                        name="batting_team_id"
                                        className="form-control"
                                        placeholder="Batting Team ID"
                                        value={formData.batting_team_id}
                                        onChange={handleChange}
                                        required
                                    />
                                )}
                            </div>
                            <div className="col-md-6">
                                <label className="form-label text-muted small">
                                    Bowling Team <span className="text-danger">*</span>
                                </label>
                                {selectedMatch ? (
                                    <select
                                        name="bowling_team_id"
                                        className="form-select"
                                        value={formData.bowling_team_id}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">Select Bowling Team</option>
                                        <option value={selectedMatch.team_a_id}>{selectedMatch.team_a_name}</option>
                                        <option value={selectedMatch.team_b_id}>{selectedMatch.team_b_name}</option>
                                    </select>
                                ) : (
                                    <input
                                        type="number"
                                        name="bowling_team_id"
                                        className="form-control"
                                        placeholder="Bowling Team ID"
                                        value={formData.bowling_team_id}
                                        onChange={handleChange}
                                        required
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Score & Overs */}
                <div className="col-md-3">
                    <label className="form-label fw-semibold">Total Runs</label>
                    <input
                        type="number"
                        name="total_runs"
                        className="form-control"
                        min="0"
                        value={formData.total_runs}
                        onChange={handleChange}
                    />
                </div>

                <div className="col-md-3">
                    <label className="form-label fw-semibold">Total Wickets</label>
                    <input
                        type="number"
                        name="total_wickets"
                        className="form-control"
                        min="0"
                        max="10"
                        value={formData.total_wickets}
                        onChange={handleChange}
                    />
                </div>

                <div className="col-md-3">
                    <label className="form-label fw-semibold">
                        Total Overs <small className="text-muted">(e.g. 20.0, 18.4)</small>
                    </label>
                    <input
                        type="number"
                        step="0.1"
                        name="total_overs"
                        className="form-control"
                        min="0"
                        value={formData.total_overs}
                        onChange={handleChange}
                    />
                    <small className="text-muted d-block mt-1">
                        Balls bowled: {formData.total_balls}
                    </small>
                </div>

                <div className="col-md-3">
                    <label className="form-label fw-semibold">Target Runs</label>
                    <input
                        type="number"
                        name="target_runs"
                        className="form-control"
                        placeholder="e.g. 185 (optional)"
                        min="0"
                        value={formData.target_runs}
                        onChange={handleChange}
                    />
                </div>

                {/* Extras Details Card */}
                <div className="col-12">
                    <div className="card border-0 bg-light-subtle shadow-sm rounded-4 p-3">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6 className="mb-0 fw-semibold">Extras Breakdown</h6>
                            <div className="form-check form-switch mb-0">
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id="autoSumSwitch"
                                    checked={autoSumExtras}
                                    onChange={(e) => setAutoSumExtras(e.target.checked)}
                                />
                                <label className="form-check-label small" htmlFor="autoSumSwitch">
                                    Auto-calculate Total Extras
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
                    <button type="submit" className="btn btn-primary px-4" disabled={loading}>
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
