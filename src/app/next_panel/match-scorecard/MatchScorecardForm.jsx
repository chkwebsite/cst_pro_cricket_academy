"use client";

import { ArrowLeft, Check, RefreshCw, Save } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
    DISMISSAL_TYPES,
    calculateStrikeRate,
    getPlayerDisplayName,
} from "../components/cricketHelpers";

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
                    if (currentInnings) {
                        setBattingPlayers(all.filter((p) => Number(p.team_id) === Number(currentInnings.batting_team_id)));
                        setBowlingPlayers(all.filter((p) => Number(p.team_id) === Number(currentInnings.bowling_team_id)));
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

    const handleMatchChange = (mId) => {
        setFormData((prev) => ({
            ...prev,
            match_id: mId,
            innings_id: "",
            match_player_id: "",
            dismissed_by_player_id: "",
            fielder_player_id: "",
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

            // Real-time Strike Rate calculation
            if (name === "runs" || name === "balls") {
                const r = Number(name === "runs" ? value : prev.runs) || 0;
                const b = Number(name === "balls" ? value : prev.balls) || 0;
                updated.strike_rate = b > 0 ? Number(((r / b) * 100).toFixed(2)) : 0;
            }

            // Reset bowler/fielder if Not Out
            if (name === "dismissal_type" && (value === "Not Out" || value === "Retired Hurt")) {
                updated.dismissed_by_player_id = "";
                updated.fielder_player_id = "";
            }

            return updated;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");

        if (!formData.match_id || !formData.innings_id || !formData.match_player_id) {
            setError("Match, Innings and Batter are required.");
            return;
        }

        if (
            formData.dismissed_by_player_id &&
            Number(formData.dismissed_by_player_id) === Number(formData.match_player_id)
        ) {
            setError("A batter cannot be their own dismissed_by bowler.");
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

    const isNotOut = formData.dismissal_type === "Not Out" || formData.dismissal_type === "Retired Hurt";
    const needsFielder = ["Caught", "Run Out", "Stumped"].includes(formData.dismissal_type);
    const needsBowler = [
        "Bowled",
        "Caught",
        "LBW",
        "Stumped",
        "Hit Wicket",
    ].includes(formData.dismissal_type);

    if (fetching) {
        return (
            <div className="text-center py-5">
                <RefreshCw className="spinner-border spinner-border-sm me-2" />
                Loading scorecard record...
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
                                Innings {i.innings_no}: {i.batting_team_name} (Batting)
                            </option>
                        ))}
                    </select>
                </div>

                {/* Batter & Position */}
                <div className="col-md-8">
                    <label className="form-label fw-semibold">
                        Batter (Batting Team) <span className="text-danger">*</span>
                    </label>
                    <select
                        name="match_player_id"
                        className="form-select"
                        value={formData.match_player_id}
                        onChange={handleChange}
                        disabled={isEdit || !formData.innings_id}
                        required
                    >
                        <option value="">Select a player...</option>
                        {battingPlayers.map((p) => (
                            <option key={p.id} value={p.id}>
                                {getPlayerDisplayName(p)} {p.jersey_no ? `(#${p.jersey_no})` : ""} - {p.team_name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="col-md-4">
                    <label className="form-label fw-semibold">Batting Position</label>
                    <input
                        type="number"
                        name="batting_position"
                        className="form-control"
                        min="1"
                        max="20"
                        value={formData.batting_position}
                        onChange={handleChange}
                        placeholder="e.g. 1 (Opener)"
                    />
                </div>

                {/* Runs, Balls, 4s, 6s, SR */}
                <div className="col-md-2 col-6">
                    <label className="form-label fw-semibold">Runs</label>
                    <input
                        type="number"
                        name="runs"
                        className="form-control"
                        min="0"
                        value={formData.runs}
                        onChange={handleChange}
                    />
                </div>

                <div className="col-md-2 col-6">
                    <label className="form-label fw-semibold">Balls Faced</label>
                    <input
                        type="number"
                        name="balls"
                        className="form-control"
                        min="0"
                        value={formData.balls}
                        onChange={handleChange}
                    />
                </div>

                <div className="col-md-2 col-4">
                    <label className="form-label fw-semibold">Fours (4s)</label>
                    <input
                        type="number"
                        name="fours"
                        className="form-control"
                        min="0"
                        value={formData.fours}
                        onChange={handleChange}
                    />
                </div>

                <div className="col-md-2 col-4">
                    <label className="form-label fw-semibold">Sixes (6s)</label>
                    <input
                        type="number"
                        name="sixes"
                        className="form-control"
                        min="0"
                        value={formData.sixes}
                        onChange={handleChange}
                    />
                </div>

                <div className="col-md-4 col-4">
                    <label className="form-label fw-semibold">
                        Strike Rate <small className="text-muted">(auto)</small>
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        name="strike_rate"
                        className="form-control bg-light"
                        value={formData.strike_rate}
                        onChange={handleChange}
                    />
                </div>

                {/* Dismissal Section */}
                <div className="col-12">
                    <div className="p-3 bg-light rounded-4 border">
                        <h6 className="fw-semibold mb-3">Dismissal Details</h6>
                        <div className="row g-3">
                            <div className="col-md-4">
                                <label className="form-label text-muted small">
                                    Dismissal Type <span className="text-danger">*</span>
                                </label>
                                <select
                                    name="dismissal_type"
                                    className="form-select"
                                    value={formData.dismissal_type}
                                    onChange={handleChange}
                                    required
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
                                    className="form-select"
                                    value={formData.dismissed_by_player_id}
                                    onChange={handleChange}
                                    disabled={isNotOut || !needsBowler}
                                >
                                    <option value="">Select bowler...</option>
                                    {bowlingPlayers.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {getPlayerDisplayName(p)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-md-4">
                                <label className="form-label text-muted small">
                                    Fielder / Wicket-keeper
                                </label>
                                <select
                                    name="fielder_player_id"
                                    className="form-select"
                                    value={formData.fielder_player_id}
                                    onChange={handleChange}
                                    disabled={isNotOut || !needsFielder}
                                >
                                    <option value="">Select fielder...</option>
                                    {bowlingPlayers.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {getPlayerDisplayName(p)}
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
                    <button type="submit" className="btn btn-primary px-4" disabled={loading}>
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
