"use client";

import {
    Activity,
    ArrowLeft,
    Clock,
    Edit,
    PlusCircle,
    RotateCcw,
    Search,
    SearchSlash,
    Trash2,
    Trophy,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
    calculateEconomy,
    getPlayerDisplayName,
} from "../components/cricketHelpers";
import Pagination from "../components/Pagination";

export default function MatchBowlingScorecardPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [bowlingList, setBowlingList] = useState([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const [matches, setMatches] = useState([]);
    const [inningsList, setInningsList] = useState([]);

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

    // Fetch innings for dropdown when match is selected
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

    // Fetch bowling scorecard records
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
                const res = await fetch(`/api/match-bowling-scorecard${query ? `?${query}` : ""}`, {
                    signal: controller.signal,
                });
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Unable to load bowling scorecard.");
                }
                setBowlingList(json.data || []);
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

    // Client-side text filter
    const needle = search.trim().toLowerCase();
    const visibleBowling = useMemo(() => {
        if (!needle) return bowlingList;
        return bowlingList.filter((item) =>
            [item.player_name, `match #${item.match_id}`, `innings #${item.innings_id}`]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(needle))
        );
    }, [bowlingList, needle]);

    useEffect(() => {
        setPage(1);
    }, [search, matchId, inningsId]);

    const totalPages = Math.ceil(visibleBowling.length / PAGE_SIZE) || 1;
    const pagedBowling = visibleBowling.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleClear = (e) => {
        e.preventDefault();
        setSearch("");
        setMatchId("");
        setInningsId("");
    };

    const handleDelete = async (item) => {
        const name = item.player_name || `Bowler #${item.match_player_id}`;
        if (!confirm(`Delete bowling record for ${name}?`)) return;
        setError(null);
        setNotice(null);
        try {
            const res = await fetch(`/api/match-bowling-scorecard/${item.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to delete bowling record.");
            }
            setNotice(`Bowling record for ${name} deleted.`);
            setReload((n) => n + 1);
        } catch (err) {
            setError(err.message);
        }
    };

    // Calculate aggregate bowling stats
    const stats = useMemo(() => {
        const totalBowlers = bowlingList.length;
        const totalWickets = bowlingList.reduce((acc, b) => acc + (Number(b.wickets) || 0), 0);
        const totalRunsConceded = bowlingList.reduce((acc, b) => acc + (Number(b.runs_conceded) || 0), 0);
        const totalBalls = bowlingList.reduce((acc, b) => acc + (Number(b.balls_bowled) || 0), 0);
        const avgEconomy = totalBalls > 0 ? ((totalRunsConceded * 6) / totalBalls).toFixed(2) : "0.00";
        return { totalBowlers, totalWickets, totalRunsConceded, avgEconomy };
    }, [bowlingList]);

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
                                    <Activity className="text-primary" /> Bowling Scorecard
                                </h3>
                                <p className="text-muted mb-0">
                                    Record bowling figures, overs, balls bowled, maidens, runs conceded, wickets, economy, and extras conceded.
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
                                    href={`/next_panel/match-bowling-scorecard/new${matchId ? `?match_id=${matchId}` : ""}${inningsId ? `&innings_id=${inningsId}` : ""}`}
                                    className="btn btn-primary px-3"
                                >
                                    <PlusCircle size={18} className="me-1" /> Add Bowling Record
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
                                <div className="text-muted small">Bowlers Used</div>
                                <div className="fs-4 fw-bold">{stats.totalBowlers}</div>
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <div className="bg-white p-3 rounded-4 shadow-sm border-start border-danger border-4">
                                <div className="text-muted small">Total Wickets Taken</div>
                                <div className="fs-4 fw-bold text-danger">{stats.totalWickets}</div>
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <div className="bg-white p-3 rounded-4 shadow-sm border-start border-warning border-4">
                                <div className="text-muted small">Runs Conceded</div>
                                <div className="fs-4 fw-bold text-warning">{stats.totalRunsConceded}</div>
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <div className="bg-white p-3 rounded-4 shadow-sm border-start border-success border-4">
                                <div className="text-muted small">Avg Economy</div>
                                <div className="fs-4 fw-bold text-success">{stats.avgEconomy}</div>
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
                                placeholder="Search bowler..."
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
                            Loading bowling records...
                        </div>
                    ) : visibleBowling.length === 0 ? (
                        <div className="text-center py-5 text-muted bg-white rounded-4 shadow-sm">
                            <p className="mb-2">No bowling records found.</p>
                            <Link
                                href={`/next_panel/match-bowling-scorecard/new${matchId ? `?match_id=${matchId}` : ""}${inningsId ? `&innings_id=${inningsId}` : ""}`}
                                className="btn btn-sm btn-primary"
                            >
                                <PlusCircle size={16} className="me-1" /> Add the first bowling record
                            </Link>
                        </div>
                    ) : (
                        <>
                        <div className="table-responsive bg-white rounded-4 shadow-sm p-3">
                            <table className="table align-middle table-hover mb-0">
                                <thead className="table-success">
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
                                    {pagedBowling.map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <div className="fw-bold text-dark">
                                                    {item.player_name || `Bowler #${item.match_player_id}`}
                                                </div>
                                                <small className="text-muted">
                                                    Innings {item.innings_no} · Match #{item.match_id}
                                                </small>
                                            </td>
                                            <td className="text-center fw-semibold">{item.overs}</td>
                                            <td className="text-center text-muted">{item.balls_bowled}</td>
                                            <td className="text-center">{item.maidens}</td>
                                            <td className="text-center">{item.runs_conceded}</td>
                                            <td className="text-center">
                                                <span
                                                    className={`badge fs-6 ${
                                                        item.wickets >= 5
                                                            ? "bg-danger"
                                                            : item.wickets >= 3
                                                            ? "bg-primary"
                                                            : "bg-light text-dark border"
                                                    }`}
                                                >
                                                    {item.wickets}
                                                </span>
                                            </td>
                                            <td className="text-center">
                                                <span
                                                    className={`fw-semibold ${
                                                        Number(item.economy) <= 6.0
                                                            ? "text-success"
                                                            : Number(item.economy) >= 10.0
                                                            ? "text-danger"
                                                            : "text-dark"
                                                    }`}
                                                >
                                                    {Number(item.economy || 0).toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="text-center text-muted">{item.wides}</td>
                                            <td className="text-center text-muted">{item.no_balls}</td>
                                            <td className="text-end">
                                                <div className="d-flex justify-content-end gap-2">
                                                    <Link
                                                        href={`/next_panel/match-bowling-scorecard/${item.id}/edit`}
                                                        className="btn btn-sm btn-outline-secondary"
                                                        title="Edit Bowling Record"
                                                    >
                                                        <Edit size={14} />
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger"
                                                        onClick={() => handleDelete(item)}
                                                        title="Delete Bowling Record"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination
                            page={page}
                            totalPages={totalPages}
                            total={visibleBowling.length}
                            onPageChange={setPage}
                            pageSize={PAGE_SIZE}
                        />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
