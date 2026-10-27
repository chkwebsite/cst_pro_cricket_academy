"use client";

import {
    Activity,
    ArrowLeft,
    CheckCircle2,
    Clock,
    Edit,
    ExternalLink,
    Layers,
    MapPin,
    PlusCircle,
    RefreshCw,
    Trash2,
    Trophy,
    UserPlus,
    Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
    DISMISSAL_TYPES,
    INNINGS_STATUS_BADGE,
    INNINGS_STATUSES,
    ballsToOvers,
    calculateEconomy,
    calculateStrikeRate,
    formatDate,
    getPlayerDisplayName,
    isValidCricketOvers,
    oversToBalls,
} from "./cricketHelpers";

export default function MatchCenterView({ initialMatchId = null }) {
    const [matches, setMatches] = useState([]);
    const [selectedMatchId, setSelectedMatchId] = useState(initialMatchId ? String(initialMatchId) : "");
    const [matchDetails, setMatchDetails] = useState(null);
    const [inningsList, setInningsList] = useState([]);
    const [activeInningsId, setActiveInningsId] = useState("");
    const [battingScores, setBattingScores] = useState([]);
    const [bowlingScores, setBowlingScores] = useState([]);
    const [matchPlayers, setMatchPlayers] = useState([]);

    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    // Modals
    const [showBatterModal, setShowBatterModal] = useState(false);
    const [editingBatter, setEditingBatter] = useState(null);
    const [showBowlerModal, setShowBowlerModal] = useState(false);
    const [editingBowler, setEditingBowler] = useState(null);

    // Fetch matches list
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/matches");
                const json = await res.json();
                if (res.ok && json.success) {
                    setMatches(json.data || []);
                    if (!selectedMatchId && json.data?.length > 0) {
                        setSelectedMatchId(String(json.data[0].id));
                    }
                }
            } catch {
                /* ignore */
            }
        })();
    }, []);

    // Load full match data whenever selectedMatchId changes
    const loadMatchData = async (mId) => {
        if (!mId) return;
        setLoading(true);
        setError("");
        try {
            // 1. Fetch match details
            const mRes = await fetch(`/api/matches/${mId}`);
            const mJson = await mRes.json();
            if (mRes.ok && mJson.success) {
                setMatchDetails(mJson.data);
            }

            // 2. Fetch match players
            const pRes = await fetch(`/api/match-players?match_id=${mId}`);
            const pJson = await pRes.json();
            if (pRes.ok && pJson.success) {
                setMatchPlayers(pJson.data || []);
            }

            // 3. Fetch innings
            const iRes = await fetch(`/api/match-innings?match_id=${mId}`);
            const iJson = await iRes.json();
            if (iRes.ok && iJson.success) {
                const list = iJson.data || [];
                setInningsList(list);
                if (list.length > 0) {
                    setActiveInningsId((prev) => {
                        const exists = list.some((i) => String(i.id) === String(prev));
                        return exists ? prev : String(list[0].id);
                    });
                } else {
                    setActiveInningsId("");
                }
            }
        } catch (err) {
            setError(err.message || "Failed to load match center data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedMatchId) {
            loadMatchData(selectedMatchId);
        }
    }, [selectedMatchId]);

    // Load scorecards whenever activeInningsId changes
    const loadInningsScorecards = async (iId) => {
        if (!iId || !selectedMatchId) {
            setBattingScores([]);
            setBowlingScores([]);
            return;
        }

        try {
            const [batRes, bowlRes] = await Promise.all([
                fetch(`/api/match-scorecard?match_id=${selectedMatchId}&innings_id=${iId}`),
                fetch(`/api/match-bowling-scorecard?match_id=${selectedMatchId}&innings_id=${iId}`),
            ]);

            const batJson = await batRes.json();
            const bowlJson = await bowlRes.json();

            if (batRes.ok && batJson.success) setBattingScores(batJson.data || []);
            if (bowlRes.ok && bowlJson.success) setBowlingScores(bowlJson.data || []);
        } catch (err) {
            setError("Failed to load innings scorecard");
        }
    };

    useEffect(() => {
        if (activeInningsId) {
            loadInningsScorecards(activeInningsId);
        }
    }, [activeInningsId, selectedMatchId]);

    const activeInnings = inningsList.find((i) => String(i.id) === String(activeInningsId));

    // Player lookup helper
    const getPlayerName = (pId) => {
        if (!pId) return null;
        const p = matchPlayers.find((m) => Number(m.id) === Number(pId));
        return p ? getPlayerDisplayName(p) : `Player #${pId}`;
    };

    // Filter batting team players & bowling team players
    const battingPlayers = useMemo(() => {
        if (!activeInnings) return matchPlayers;
        return matchPlayers.filter((p) => Number(p.team_id) === Number(activeInnings.batting_team_id));
    }, [matchPlayers, activeInnings]);

    const bowlingPlayers = useMemo(() => {
        if (!activeInnings) return matchPlayers;
        return matchPlayers.filter((p) => Number(p.team_id) === Number(activeInnings.bowling_team_id));
    }, [matchPlayers, activeInnings]);

    // Handle delete batter record
    const handleDeleteBatter = async (item) => {
        if (!confirm(`Remove ${item.player_name || `Batter #${item.match_player_id}`} from scorecard?`)) return;
        try {
            const res = await fetch(`/api/match-scorecard/${item.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message);
            setNotice("Batter record removed.");
            loadInningsScorecards(activeInningsId);
        } catch (err) {
            setError(err.message);
        }
    };

    // Handle delete bowler record
    const handleDeleteBowler = async (item) => {
        if (!confirm(`Remove ${item.player_name || `Bowler #${item.match_player_id}`} from bowling scorecard?`)) return;
        try {
            const res = await fetch(`/api/match-bowling-scorecard/${item.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message);
            setNotice("Bowler record removed.");
            loadInningsScorecards(activeInningsId);
        } catch (err) {
            setError(err.message);
        }
    };

    // Auto-Sync Innings Totals from Scorecard
    const handleSyncTotals = async () => {
        if (!activeInnings) return;
        setSyncing(true);
        setError("");
        setNotice("");

        try {
            // Batting runs + innings extras
            const batRuns = battingScores.reduce((sum, b) => sum + (Number(b.runs) || 0), 0);
            const totalRuns = batRuns + (Number(activeInnings.extras) || 0);

            // Total dismissals where dismissal_type !== 'Not Out' & !== 'Retired Hurt'
            const totalWickets = battingScores.filter(
                (b) => b.dismissal_type !== "Not Out" && b.dismissal_type !== "Retired Hurt"
            ).length;

            // Total balls bowled by all bowlers
            const totalBallsBowled = bowlingScores.reduce((sum, b) => sum + (Number(b.balls_bowled) || 0), 0);
            const totalOvers = ballsToOvers(totalBallsBowled);

            const payload = {
                total_runs: totalRuns,
                total_wickets: totalWickets,
                total_overs: totalOvers,
                total_balls: totalBallsBowled,
            };

            const res = await fetch(`/api/match-innings/${activeInnings.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message);

            setNotice("Innings totals successfully synced with scorecard calculations!");
            loadMatchData(selectedMatchId);
        } catch (err) {
            setError(err.message || "Failed to sync innings totals");
        } finally {
            setSyncing(false);
        }
    };

    // Calculated Run Rate
    const crr = useMemo(() => {
        if (!activeInnings) return "0.00";
        const balls = Number(activeInnings.total_balls) || 0;
        const runs = Number(activeInnings.total_runs) || 0;
        if (balls <= 0) return "0.00";
        return ((runs * 6) / balls).toFixed(2);
    }, [activeInnings]);

    return (
        <div className="container-fluid">
            <div className="row g-3">
                {/* Header & Match Selector */}
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-2">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <div>
                                <Link href="/next_panel/match-management" className="btn btn-sm btn-outline-secondary mb-3">
                                    <ArrowLeft size={16} className="me-2" /> Back to Match Management
                                </Link>
                                <h3 className="mb-1 d-flex align-items-center gap-2">
                                    <Trophy className="text-primary" /> Match Scorecard Center
                                </h3>
                                <p className="text-muted mb-0">
                                    Comprehensive live scorecard management for innings, batting, and bowling.
                                </p>
                            </div>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                <select
                                    className="form-select"
                                    style={{ minWidth: "280px" }}
                                    value={selectedMatchId}
                                    onChange={(e) => setSelectedMatchId(e.target.value)}
                                >
                                    <option value="">Select a Match...</option>
                                    {matches.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.match_no ? `Match ${m.match_no}` : `Match #${m.id}`}: {m.team_a_name} vs {m.team_b_name}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={() => loadMatchData(selectedMatchId)}
                                    title="Refresh"
                                >
                                    <RefreshCw size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="col-12">
                        <div className="alert alert-danger mb-0">{error}</div>
                    </div>
                )}
                {notice && (
                    <div className="col-12">
                        <div className="alert alert-success mb-0">{notice}</div>
                    </div>
                )}

                {/* Match Details Banner */}
                {matchDetails && (
                    <div className="col-12">
                        <div className="card border-0 rounded-4 shadow-sm p-4 bg-dark text-white">
                            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                                <div>
                                    <div className="badge bg-primary px-3 py-1 mb-2">
                                        {matchDetails.match_type} Match · {matchDetails.match_no ? `Match ${matchDetails.match_no}` : `#${matchDetails.id}`}
                                    </div>
                                    <h2 className="fs-3 fw-bold mb-1">
                                        {matchDetails.team_a_name} <span className="text-warning">vs</span> {matchDetails.team_b_name}
                                    </h2>
                                    <div className="text-secondary small d-flex flex-wrap gap-3">
                                        <span>Date: {formatDate(matchDetails.match_date)}</span>
                                        {matchDetails.ground_name && <span>Venue: {matchDetails.ground_name}</span>}
                                        {matchDetails.toss_winner_team_name && (
                                            <span>
                                                Toss: {matchDetails.toss_winner_team_name} ({matchDetails.toss_decision || "opted to bat"})
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-end">
                                    <span className="badge bg-secondary fs-6 px-3 py-2">
                                        Status: {matchDetails.status}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Innings Tabs */}
                <div className="col-12">
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 border-bottom pb-2">
                        <ul className="nav nav-pills gap-2">
                            {inningsList.map((i) => (
                                <li className="nav-item" key={i.id}>
                                    <button
                                        type="button"
                                        className={`nav-link rounded-pill px-4 ${
                                            String(i.id) === String(activeInningsId)
                                                ? "active bg-primary fw-bold"
                                                : "bg-white text-dark shadow-sm border"
                                        }`}
                                        onClick={() => setActiveInningsId(String(i.id))}
                                    >
                                        Innings {i.innings_no}: {i.batting_team_name}{" "}
                                        <span className="ms-2 opacity-75">
                                            ({i.total_runs}/{i.total_wickets})
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>

                        <div className="d-flex gap-2">
                            <Link
                                href={`/next_panel/match-innings/new${selectedMatchId ? `?match_id=${selectedMatchId}` : ""}`}
                                className="btn btn-sm btn-outline-primary"
                            >
                                <PlusCircle size={15} className="me-1" /> Add Innings
                            </Link>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="col-12 text-center py-5 text-muted">
                        <RefreshCw className="spinner-border spinner-border-sm me-2" /> Loading match data...
                    </div>
                ) : !activeInnings ? (
                    <div className="col-12">
                        <div className="bg-white rounded-4 shadow-sm p-5 text-center text-muted">
                            <Layers size={48} className="text-secondary opacity-50 mb-3" />
                            <h5>No Innings Found For This Match</h5>
                            <p>To begin scoring, start by creating the first innings for this match.</p>
                            <Link
                                href={`/next_panel/match-innings/new${selectedMatchId ? `?match_id=${selectedMatchId}` : ""}`}
                                className="btn btn-primary"
                            >
                                <PlusCircle size={16} className="me-1" /> Create 1st Innings
                            </Link>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Innings Overview Banner */}
                        <div className="col-12">
                            <div className="bg-white rounded-4 shadow-sm p-4 border">
                                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                                    <div>
                                        <div className="d-flex align-items-baseline gap-3">
                                            <span className="fs-2 fw-bold text-dark">
                                                {activeInnings.total_runs}/{activeInnings.total_wickets}
                                            </span>
                                            <span className="fs-5 text-muted">
                                                ({activeInnings.total_overs} ov, {activeInnings.total_balls} balls)
                                            </span>
                                            <span
                                                className={`badge ${
                                                    INNINGS_STATUS_BADGE[activeInnings.innings_status] || "bg-secondary"
                                                }`}
                                            >
                                                {activeInnings.innings_status}
                                            </span>
                                        </div>
                                        <div className="mt-2 text-muted small d-flex flex-wrap gap-4">
                                            <span>
                                                <strong>Batting:</strong> {activeInnings.batting_team_name}
                                            </span>
                                            <span>
                                                <strong>Bowling:</strong> {activeInnings.bowling_team_name}
                                            </span>
                                            <span>
                                                <strong>CRR:</strong> {crr}
                                            </span>
                                            {activeInnings.target_runs && (
                                                <span className="text-primary fw-bold">
                                                    Target: {activeInnings.target_runs} runs
                                                </span>
                                            )}
                                            <span>
                                                <strong>Extras:</strong> {activeInnings.extras} (w {activeInnings.wides}, nb {activeInnings.no_balls}, b {activeInnings.byes}, lb {activeInnings.leg_byes})
                                            </span>
                                        </div>
                                    </div>
                                    <div className="d-flex gap-2">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-success"
                                            onClick={handleSyncTotals}
                                            disabled={syncing}
                                            title="Tally batting runs, wickets and bowler overs automatically"
                                        >
                                            {syncing ? (
                                                <>
                                                    <RefreshCw className="spinner-border spinner-border-sm me-1" /> Syncing...
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle2 size={15} className="me-1" /> Sync Totals
                                                </>
                                            )}
                                        </button>
                                        <Link
                                            href={`/next_panel/match-innings/${activeInnings.id}/edit`}
                                            className="btn btn-sm btn-outline-secondary"
                                        >
                                            <Edit size={14} className="me-1" /> Edit Innings
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Batting Scorecard Section */}
                        <div className="col-12">
                            <div className="bg-white rounded-4 shadow-sm p-4">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                                        <Trophy size={18} className="text-primary" /> Batting - {activeInnings.batting_team_name}
                                    </h5>
                                    <Link
                                        href={`/next_panel/match-scorecard/new?match_id=${selectedMatchId}&innings_id=${activeInnings.id}`}
                                        className="btn btn-sm btn-primary"
                                    >
                                        <PlusCircle size={15} className="me-1" /> Add Batter
                                    </Link>
                                </div>

                                {battingScores.length === 0 ? (
                                    <div className="text-center py-4 text-muted bg-light rounded-3">
                                        No batters recorded yet.
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table align-middle table-hover mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th style={{ width: "50px" }}>Pos</th>
                                                    <th>Batter</th>
                                                    <th>Dismissal</th>
                                                    <th className="text-center">R</th>
                                                    <th className="text-center">B</th>
                                                    <th className="text-center">4s</th>
                                                    <th className="text-center">6s</th>
                                                    <th className="text-center">SR</th>
                                                    <th className="text-end">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {battingScores.map((b) => {
                                                    const bowler = getPlayerName(b.dismissed_by_player_id);
                                                    const fielder = getPlayerName(b.fielder_player_id);

                                                    let dismissalStr = b.dismissal_type;
                                                    if (b.dismissal_type === "Not Out") dismissalStr = "not out";
                                                    else if (b.dismissal_type === "Bowled") dismissalStr = `b ${bowler || "Bowler"}`;
                                                    else if (b.dismissal_type === "LBW") dismissalStr = `lbw b ${bowler || "Bowler"}`;
                                                    else if (b.dismissal_type === "Caught") {
                                                        dismissalStr = fielder && bowler ? `c ${fielder} b ${bowler}` : bowler ? `c & b ${bowler}` : "caught";
                                                    } else if (b.dismissal_type === "Run Out") {
                                                        dismissalStr = fielder ? `run out (${fielder})` : "run out";
                                                    } else if (b.dismissal_type === "Stumped") {
                                                        dismissalStr = fielder && bowler ? `st ${fielder} b ${bowler}` : "stumped";
                                                    }

                                                    return (
                                                        <tr key={b.id}>
                                                            <td>
                                                                <span className="badge bg-light text-dark border">
                                                                    {b.batting_position || "—"}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className="fw-bold">{b.player_name || `Player #${b.match_player_id}`}</span>
                                                            </td>
                                                            <td>
                                                                <span className={b.dismissal_type === "Not Out" ? "text-success fw-medium" : "text-muted small"}>
                                                                    {dismissalStr}
                                                                </span>
                                                            </td>
                                                            <td className="text-center fw-bold">{b.runs}</td>
                                                            <td className="text-center text-muted">{b.balls}</td>
                                                            <td className="text-center">{b.fours}</td>
                                                            <td className="text-center">{b.sixes}</td>
                                                            <td className="text-center">{Number(b.strike_rate || 0).toFixed(2)}</td>
                                                            <td className="text-end">
                                                                <div className="d-flex justify-content-end gap-1">
                                                                    <Link
                                                                        href={`/next_panel/match-scorecard/${b.id}/edit`}
                                                                        className="btn btn-sm btn-outline-secondary py-0 px-2"
                                                                    >
                                                                        <Edit size={13} />
                                                                    </Link>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-outline-danger py-0 px-2"
                                                                        onClick={() => handleDeleteBatter(b)}
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {/* Extras and Total Footer Rows */}
                                                <tr className="table-light fw-medium">
                                                    <td colSpan={3}>
                                                        Extras: {activeInnings.extras} (b {activeInnings.byes}, lb {activeInnings.leg_byes}, w {activeInnings.wides}, nb {activeInnings.no_balls}, p {activeInnings.penalty_runs})
                                                    </td>
                                                    <td className="text-center" colSpan={6}>
                                                        —
                                                    </td>
                                                </tr>
                                                <tr className="table-secondary fw-bold">
                                                    <td colSpan={3}>
                                                        Total: {activeInnings.total_runs}/{activeInnings.total_wickets} ({activeInnings.total_overs} Overs, RR: {crr})
                                                    </td>
                                                    <td className="text-center" colSpan={6}>
                                                        —
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bowling Scorecard Section */}
                        <div className="col-12">
                            <div className="bg-white rounded-4 shadow-sm p-4">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                                        <Activity size={18} className="text-primary" /> Bowling - {activeInnings.bowling_team_name}
                                    </h5>
                                    <Link
                                        href={`/next_panel/match-bowling-scorecard/new?match_id=${selectedMatchId}&innings_id=${activeInnings.id}`}
                                        className="btn btn-sm btn-primary"
                                    >
                                        <PlusCircle size={15} className="me-1" /> Add Bowler
                                    </Link>
                                </div>

                                {bowlingScores.length === 0 ? (
                                    <div className="text-center py-4 text-muted bg-light rounded-3">
                                        No bowlers recorded yet.
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table align-middle table-hover mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Bowler</th>
                                                    <th className="text-center">O</th>
                                                    <th className="text-center">Balls</th>
                                                    <th className="text-center">M</th>
                                                    <th className="text-center">R</th>
                                                    <th className="text-center">W</th>
                                                    <th className="text-center">Econ</th>
                                                    <th className="text-center">WD</th>
                                                    <th className="text-center">NB</th>
                                                    <th className="text-end">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {bowlingScores.map((bw) => (
                                                    <tr key={bw.id}>
                                                        <td>
                                                            <span className="fw-bold">{bw.player_name || `Bowler #${bw.match_player_id}`}</span>
                                                        </td>
                                                        <td className="text-center fw-semibold">{bw.overs}</td>
                                                        <td className="text-center text-muted">{bw.balls_bowled}</td>
                                                        <td className="text-center">{bw.maidens}</td>
                                                        <td className="text-center">{bw.runs_conceded}</td>
                                                        <td className="text-center fw-bold text-danger">{bw.wickets}</td>
                                                        <td className="text-center fw-semibold">{Number(bw.economy || 0).toFixed(2)}</td>
                                                        <td className="text-center text-muted">{bw.wides}</td>
                                                        <td className="text-center text-muted">{bw.no_balls}</td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end gap-1">
                                                                <Link
                                                                    href={`/next_panel/match-bowling-scorecard/${bw.id}/edit`}
                                                                    className="btn btn-sm btn-outline-secondary py-0 px-2"
                                                                >
                                                                    <Edit size={13} />
                                                                </Link>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-outline-danger py-0 px-2"
                                                                    onClick={() => handleDeleteBowler(bw)}
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
