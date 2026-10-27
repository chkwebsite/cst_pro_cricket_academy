"use client";

import {
    ArrowLeft,
    Clock,
    Edit,
    PlusCircle,
    RotateCcw,
    Search,
    SearchSlash,
    Trash2,
    Trophy,
    User,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
    calculateStrikeRate,
    getPlayerDisplayName,
} from "../components/cricketHelpers";

export default function MatchScorecardPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [scorecards, setScorecards] = useState([]);
    const [matches, setMatches] = useState([]);
    const [inningsList, setInningsList] = useState([]);
    const [matchPlayers, setMatchPlayers] = useState([]);

    // Filters
    const [search, setSearch] = useState("");
    const [matchId, setMatchId] = useState("");
    const [inningsId, setInningsId] = useState("");
    const [reload, setReload] = useState(0);

    // Fetch matches for dropdown
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/matches");
                const json = await res.json();
                if (res.ok && json.success) setMatches(json.data || []);
            } catch {
                /* optional dropdown */
            }
        })();
    }, []);

    // Fetch innings for dropdown when match is selected (or all innings if none selected)
    useEffect(() => {
        (async () => {
            try {
                const query = matchId ? `?match_id=${matchId}` : "";
                const res = await fetch(`/api/match-innings${query}`);
                const json = await res.json();
                if (res.ok && json.success) {
                    setInningsList(json.data || []);
                    if (matchId && json.data?.length > 0 && !inningsId) {
                        setInningsId(String(json.data[0].id));
                    }
                }
            } catch {
                /* optional dropdown */
            }
        })();
    }, [matchId]);

    // Fetch match players to resolve bowler & fielder names
    useEffect(() => {
        if (!matchId) return;
        (async () => {
            try {
                const res = await fetch(`/api/match-players?match_id=${matchId}`);
                const json = await res.json();
                if (res.ok && json.success) {
                    setMatchPlayers(json.data || []);
                }
            } catch {
                /* ignore */
            }
        })();
    }, [matchId]);

    // Fetch scorecard records
    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (matchId) params.set("match_id", matchId);
                if (inningsId) params.set("innings_id", inningsId);

                const query = params.toString();
                const res = await fetch(`/api/match-scorecard${query ? `?${query}` : ""}`, {
                    signal: controller.signal,
                });
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Unable to load batting scorecards.");
                }
                setScorecards(json.data || []);
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }, 300);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [matchId, inningsId, reload]);

    // Map match player IDs to names
    const getPlayerNameById = (pId) => {
        if (!pId) return null;
        const mp = matchPlayers.find((p) => Number(p.id) === Number(pId));
        return mp ? getPlayerDisplayName(mp) : `Player #${pId}`;
    };

    // Client-side text filter
    const needle = search.trim().toLowerCase();
    const visibleScorecards = useMemo(() => {
        if (!needle) return scorecards;
        return scorecards.filter((sc) =>
            [sc.player_name, sc.dismissal_type, `match #${sc.match_id}`, `innings #${sc.innings_id}`]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(needle))
        );
    }, [scorecards, needle]);

    const handleClear = (e) => {
        e.preventDefault();
        setSearch("");
        setMatchId("");
        setInningsId("");
    };

    const handleDelete = async (item) => {
        const name = item.player_name || `Player #${item.match_player_id}`;
        if (!confirm(`Delete scorecard entry for ${name}?`)) return;
        setError(null);
        setNotice(null);
        try {
            const res = await fetch(`/api/match-scorecard/${item.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to delete scorecard entry.");
            }
            setNotice(`Scorecard entry for ${name} deleted.`);
            setReload((n) => n + 1);
        } catch (err) {
            setError(err.message);
        }
    };

    // Aggregate stats
    const stats = useMemo(() => {
        const totalBatters = scorecards.length;
        const totalRuns = scorecards.reduce((acc, sc) => acc + (Number(sc.runs) || 0), 0);
        const totalFours = scorecards.reduce((acc, sc) => acc + (Number(sc.fours) || 0), 0);
        const totalSixes = scorecards.reduce((acc, sc) => acc + (Number(sc.sixes) || 0), 0);
        return { totalBatters, totalRuns, totalFours, totalSixes };
    }, [scorecards]);

    return (
        <div className="container-fluid">
            <div className="row g-3">
                {/* Header */}
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-2">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <div>
                                <Link
                                    href="/next_panel/match-management"
                                    className="btn btn-sm btn-outline-secondary mb-3"
                                >
                                    <ArrowLeft size={16} className="me-2" /> Back to Match Management
                                </Link>
                                <h3 className="mb-1 d-flex align-items-center gap-2">
                                    <Trophy className="text-primary" /> Batting Scorecard
                                </h3>
                                <p className="text-muted mb-0">
                                    Record individual batting performances, runs, balls faced, boundaries, dismissals, and strike rates.
                                </p>
                            </div>
                            <div className="d-flex gap-2">
                                {matchId && (
                                    <Link
                                        href={`/next_panel/matches/${matchId}/scorecard`}
                                        className="btn btn-outline-primary"
                                    >
                                        <Trophy size={16} className="me-1" /> View Full Scorecard
                                    </Link>
                                )}
                                <Link
                                    href={`/next_panel/match-scorecard/new${matchId ? `?match_id=${matchId}` : ""}${inningsId ? `&innings_id=${inningsId}` : ""}`}
                                    className="btn btn-primary px-3"
                                >
                                    <PlusCircle size={18} className="me-1" /> Add Batting Record
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Tiles */}
                <div className="col-12">
                    <div className="row g-3">
                        <div className="col-6 col-md-3">
                            <div className="bg-white p-3 rounded-4 shadow-sm border-start border-primary border-4">
                                <div className="text-muted small">Batters Recorded</div>
                                <div className="fs-4 fw-bold">{stats.totalBatters}</div>
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <div className="bg-white p-3 rounded-4 shadow-sm border-start border-success border-4">
                                <div className="text-muted small">Total Batting Runs</div>
                                <div className="fs-4 fw-bold text-success">{stats.totalRuns}</div>
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <div className="bg-white p-3 rounded-4 shadow-sm border-start border-warning border-4">
                                <div className="text-muted small">Fours (4s)</div>
                                <div className="fs-4 fw-bold text-warning">{stats.totalFours}</div>
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <div className="bg-white p-3 rounded-4 shadow-sm border-start border-danger border-4">
                                <div className="text-muted small">Sixes (6s)</div>
                                <div className="fs-4 fw-bold text-danger">{stats.totalSixes}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="col-12">
                    <div className="d-flex flex-wrap align-items-center gap-3">
                        <div className="input-group" style={{ maxWidth: "260px" }}>
                            <span className="input-group-text bg-light border-end-0">
                                <Search size={16} />
                            </span>
                            <input
                                type="text"
                                className="form-control border-start-0"
                                placeholder="Search batter, dismissal..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <select
                            className="form-select"
                            style={{ maxWidth: "260px" }}
                            value={matchId}
                            onChange={(e) => {
                                setMatchId(e.target.value);
                                setInningsId("");
                            }}
                        >
                            <option value="">All Matches</option>
                            {matches.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.match_no ? `Match ${m.match_no}` : `Match #${m.id}`}: {m.team_a_name} vs {m.team_b_name}
                                </option>
                            ))}
                        </select>

                        <select
                            className="form-select"
                            style={{ maxWidth: "220px" }}
                            value={inningsId}
                            onChange={(e) => setInningsId(e.target.value)}
                        >
                            <option value="">All Innings</option>
                            {inningsList.map((i) => (
                                <option key={i.id} value={i.id}>
                                    Innings {i.innings_no} ({i.batting_team_name})
                                </option>
                            ))}
                        </select>

                        <button
                            type="button"
                            className="btn btn-outline-danger"
                            onClick={handleClear}
                            title="Clear Filters"
                        >
                            <SearchSlash size={16} />
                        </button>

                        <button
                            type="button"
                            className="btn btn-outline-secondary ms-auto"
                            onClick={() => setReload((n) => n + 1)}
                            title="Refresh"
                        >
                            <RotateCcw size={16} />
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="col-12">
                    {error && <div className="alert alert-danger">{error}</div>}
                    {notice && <div className="alert alert-success">{notice}</div>}

                    {loading ? (
                        <div className="text-center py-5 text-muted bg-white rounded-4 shadow-sm">
                            <Clock className="spinner-border spinner-border-sm me-2" />
                            Loading scorecard records...
                        </div>
                    ) : visibleScorecards.length === 0 ? (
                        <div className="text-center py-5 text-muted bg-white rounded-4 shadow-sm">
                            <p className="mb-2">No batting scorecard records found.</p>
                            <Link
                                href={`/next_panel/match-scorecard/new${matchId ? `?match_id=${matchId}` : ""}${inningsId ? `&innings_id=${inningsId}` : ""}`}
                                className="btn btn-sm btn-primary"
                            >
                                <PlusCircle size={16} className="me-1" /> Add the first batting entry
                            </Link>
                        </div>
                    ) : (
                        <div className="table-responsive bg-white rounded-4 shadow-sm p-3">
                            <table className="table align-middle table-hover mb-0">
                                <thead className="table-success">
                                    <tr>
                                        <th style={{ width: "60px" }}>Pos</th>
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
                                    {visibleScorecards.map((item) => {
                                        const bowlerName = getPlayerNameById(item.dismissed_by_player_id);
                                        const fielderName = getPlayerNameById(item.fielder_player_id);

                                        let dismissalText = item.dismissal_type;
                                        if (item.dismissal_type === "Not Out") {
                                            dismissalText = "not out";
                                        } else if (item.dismissal_type === "Bowled" && bowlerName) {
                                            dismissalText = `b ${bowlerName}`;
                                        } else if (item.dismissal_type === "LBW" && bowlerName) {
                                            dismissalText = `lbw b ${bowlerName}`;
                                        } else if (item.dismissal_type === "Caught") {
                                            if (fielderName && bowlerName) {
                                                dismissalText = `c ${fielderName} b ${bowlerName}`;
                                            } else if (bowlerName) {
                                                dismissalText = `c & b ${bowlerName}`;
                                            }
                                        } else if (item.dismissal_type === "Run Out") {
                                            dismissalText = fielderName ? `run out (${fielderName})` : "run out";
                                        } else if (item.dismissal_type === "Stumped") {
                                            dismissalText = fielderName && bowlerName ? `st ${fielderName} b ${bowlerName}` : "stumped";
                                        }

                                        return (
                                            <tr key={item.id}>
                                                <td>
                                                    <span className="badge bg-light text-dark border">
                                                        #{item.batting_position || "—"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="fw-bold text-dark">
                                                        {item.player_name || `Player #${item.match_player_id}`}
                                                    </div>
                                                    <small className="text-muted">
                                                        Innings {item.innings_no} · Match #{item.match_id}
                                                    </small>
                                                </td>
                                                <td>
                                                    <span className={item.dismissal_type === "Not Out" ? "fw-semibold text-success" : "text-secondary"}>
                                                        {dismissalText}
                                                    </span>
                                                </td>
                                                <td className="text-center">
                                                    <span
                                                        className={`fs-6 fw-bold ${
                                                            item.runs >= 100
                                                                ? "badge bg-danger-subtle text-danger border"
                                                                : item.runs >= 50
                                                                ? "badge bg-warning-subtle text-warning-emphasis border"
                                                                : ""
                                                        }`}
                                                    >
                                                        {item.runs}
                                                    </span>
                                                </td>
                                                <td className="text-center text-muted">{item.balls}</td>
                                                <td className="text-center">{item.fours}</td>
                                                <td className="text-center">{item.sixes}</td>
                                                <td className="text-center fw-medium">
                                                    {Number(item.strike_rate || 0).toFixed(2)}
                                                </td>
                                                <td className="text-end">
                                                    <div className="d-flex justify-content-end gap-2">
                                                        <Link
                                                            href={`/next_panel/match-scorecard/${item.id}/edit`}
                                                            className="btn btn-sm btn-outline-secondary"
                                                            title="Edit Batting Record"
                                                        >
                                                            <Edit size={14} />
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-danger"
                                                            onClick={() => handleDelete(item)}
                                                            title="Delete Batting Record"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
