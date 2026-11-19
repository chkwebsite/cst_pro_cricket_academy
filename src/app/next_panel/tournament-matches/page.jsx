"use client";

import { Activity, ArrowLeft, Edit, ExternalLink, MapPin, Plus, Search, SearchSlash, Swords, Trash2, Trophy, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import GroundDetailsModal from "../components/GroundDetailsModal";
import useCurrentUser from "../teams/useCurrentUser";
import useTournamentOptions from "../tournament-teams/useTournamentOptions";
import Pagination from "../components/Pagination";

const ROUND_TYPES = ["League", "Round Robin", "Quarter Final", "Semi Final", "Final", "Qualifier", "Eliminator", "Custom"];
const MATCH_STATUSES = ["Scheduled", "Live", "Completed", "Cancelled", "Postponed"];

const STATUS_BADGE = {
    Scheduled: "bg-primary",
    Live: "bg-danger",
    Completed: "bg-success",
    Cancelled: "bg-secondary",
    Postponed: "bg-warning text-dark",
};

const formatDate = (value) => {
    if (!value) return "—";
    const [y, m, d] = String(value).slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
};
const formatTime = (value) => (value ? String(value).slice(0, 5) : "");

const isTodayMatch = (dateStr) => {
    if (!dateStr) return false;
    const d = String(dateStr).slice(0, 10);
    let todayIST = "";
    try {
        todayIST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    } catch {
        todayIST = "";
    }
    const todayLocal = new Date().toLocaleDateString("en-CA");
    return d === todayIST || d === todayLocal;
};

const getEffectiveStatus = (item) => {
    const raw = String(item?.status || "").trim();
    const lower = raw.toLowerCase();
    if (lower === "completed" || lower === "cancelled") {
        return raw || "Completed";
    }
    if (isTodayMatch(item?.scheduled_date || item?.match_date)) {
        return "Live";
    }
    return raw || "Scheduled";
};

export default function TournamentMatchesPage() {
    const me = useCurrentUser();
    const { tournaments } = useTournamentOptions(me);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [rows, setRows] = useState([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const [groundDetailsId, setGroundDetailsId] = useState(null);

    const [search, setSearch] = useState("");
    const [tournamentId, setTournamentId] = useState("");
    const [roundType, setRoundType] = useState("");
    const [groupName, setGroupName] = useState("");
    const [status, setStatus] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [reload, setReload] = useState(0);

    // Score Entry Modal State
    const [scoreModalMatch, setScoreModalMatch] = useState(null);
    const [scoreForm, setScoreForm] = useState({
        team_a_runs: "",
        team_a_wickets: "",
        team_a_overs: "",
        team_b_runs: "",
        team_b_wickets: "",
        team_b_overs: "",
        winner_team_id: "",
        win_margin: "",
        result_summary: "",
        status: "Completed",
    });
    const [savingScore, setSavingScore] = useState(false);
    const [openingScorecardId, setOpeningScorecardId] = useState(null);
    const [scoreError, setScoreError] = useState("");

    const handleOpenScorecard = async (fixture) => {
        if (!fixture) return;
        setOpeningScorecardId(fixture.id);
        setScoreError("");
        try {
            const res = await fetch(`/api/tournament-matches/${fixture.id}/scorecard`, {
                method: "POST",
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || "Failed to initialize tournament scorecard");
            }
            if (scoreModalMatch && Number(scoreModalMatch.id) === Number(fixture.id)) {
                setScoreModalMatch((prev) => ({ ...prev, match_id: data.match_id }));
            }
            setReload((r) => r + 1);
            window.open(data.redirect_url, "_blank");
        } catch (err) {
            setScoreError(err.message || "Unable to open scorecard center");
            alert(err.message || "Unable to open scorecard center");
        } finally {
            setOpeningScorecardId(null);
        }
    };

    const openScoreModal = (match) => {
        setScoreModalMatch(match);
        setScoreError("");
        setScoreForm({
            team_a_runs: match.team_a_runs ?? "",
            team_a_wickets: match.team_a_wickets ?? "",
            team_a_overs: match.team_a_overs || String(match.overs || 20),
            team_b_runs: match.team_b_runs ?? "",
            team_b_wickets: match.team_b_wickets ?? "",
            team_b_overs: match.team_b_overs || String(match.overs || 20),
            winner_team_id: match.winner_team_id ? String(match.winner_team_id) : "",
            win_margin: match.win_margin || "",
            result_summary: match.result_summary || "",
            status: match.status === "Scheduled" ? "Completed" : match.status,
        });
    };

    const handleScoreChange = (field, val) => {
        setScoreForm((prev) => {
            const next = { ...prev, [field]: val };
            const runsA = next.team_a_runs !== "" ? Number(next.team_a_runs) : null;
            const runsB = next.team_b_runs !== "" ? Number(next.team_b_runs) : null;
            const wktsB = next.team_b_wickets !== "" ? Number(next.team_b_wickets) : 0;

            if (runsA !== null && runsB !== null && scoreModalMatch) {
                if (runsA > runsB) {
                    next.winner_team_id = String(scoreModalMatch.team_a_id);
                    next.win_margin = `by ${runsA - runsB} runs`;
                    next.result_summary = `${scoreModalMatch.team_a_name || "Team A"} won by ${runsA - runsB} runs`;
                } else if (runsB > runsA) {
                    next.winner_team_id = String(scoreModalMatch.team_b_id);
                    const wRem = Math.max(1, 10 - wktsB);
                    next.win_margin = `by ${wRem} ${wRem === 1 ? "wicket" : "wickets"}`;
                    next.result_summary = `${scoreModalMatch.team_b_name || "Team B"} won by ${wRem} ${wRem === 1 ? "wicket" : "wickets"}`;
                } else if (runsA === runsB) {
                    next.winner_team_id = "";
                    next.win_margin = "Match Tied";
                    next.result_summary = "Match Tied";
                }
            }
            return next;
        });
    };

    const handleSaveScore = async (e) => {
        e.preventDefault();
        if (!scoreModalMatch) return;
        setSavingScore(true);
        setScoreError("");
        try {
            const payload = {
                team_a_runs: scoreForm.team_a_runs !== "" ? Number(scoreForm.team_a_runs) : null,
                team_a_wickets: scoreForm.team_a_wickets !== "" ? Number(scoreForm.team_a_wickets) : null,
                team_a_overs: scoreForm.team_a_overs.trim() || null,
                team_b_runs: scoreForm.team_b_runs !== "" ? Number(scoreForm.team_b_runs) : null,
                team_b_wickets: scoreForm.team_b_wickets !== "" ? Number(scoreForm.team_b_wickets) : null,
                team_b_overs: scoreForm.team_b_overs.trim() || null,
                winner_team_id: scoreForm.winner_team_id ? Number(scoreForm.winner_team_id) : null,
                win_margin: scoreForm.win_margin.trim() || null,
                result_summary: scoreForm.result_summary.trim() || null,
                status: scoreForm.status,
            };
            const res = await fetch(`/api/tournament-matches/${scoreModalMatch.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to update match score");
            setNotice("Match score and result updated successfully!");
            setScoreModalMatch(null);
            setReload((r) => r + 1);
        } catch (err) {
            setScoreError(err.message);
        } finally {
            setSavingScore(false);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            setPage(1);
            try {
                const params = new URLSearchParams();
                if (search.trim()) params.set("search", search.trim());
                if (tournamentId) params.set("tournament_id", tournamentId);
                if (roundType) params.set("round_type", roundType);
                if (groupName) params.set("group_name", groupName);
                if (status) params.set("status", status);
                if (dateFrom) params.set("date_from", dateFrom);
                if (dateTo) params.set("date_to", dateTo);

                const query = params.toString();
                const res = await fetch(`/api/tournament-matches${query ? `?${query}` : ""}`, { signal: controller.signal });
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.message || "Unable to load tournament matches.");
                setRows(json.data || []);
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
    }, [search, tournamentId, roundType, status, dateFrom, dateTo, reload]);

    const handleClear = (e) => {
        e.preventDefault();
        setSearch("");
        setTournamentId("");
        setRoundType("");
        setGroupName("");
        setStatus("");
        setDateFrom("");
        setDateTo("");
    };

    // API performs a real DELETE (409 if another record references the row)
    const handleDelete = async (item) => {
        const label = `#${item.match_no} (${item.team_a_name || "TBD"} vs ${item.team_b_name || "TBD"})`;
        if (!confirm(`Delete tournament match ${label}? This cannot be undone.`)) return;
        setError(null);
        setNotice(null);
        try {
            const res = await fetch(`/api/tournament-matches/${item.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Unable to delete tournament match");
            setNotice(`Tournament match ${label} deleted.`);
            setReload((n) => n + 1);
        } catch (err) {
            setError(err.message);
        }
    };

    const totalPages = Math.ceil(rows.length / PAGE_SIZE) || 1;
    const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
        <div className="container-fluid">
            <div className="row g-3">
                <div className="col-sm-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center gap-3">
                            <div>
                                <Link href="tournament-management" className="btn btn-sm btn-outline-secondary mb-3">
                                <ArrowLeft size={16} className="me-2"/> Back to match management
                                </Link>
                                <h3 className="mb-0"><Trophy /> Tournament Matches</h3>
                                <p className="text-muted mb-0">Build the fixture list for each tournament and track results.</p>
                            </div>
                            <Link href="/next_panel/tournament-matches/new" className="btn btn-primary px-4">
                                <Swords size={18} /> Add Tournament Match
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="col-sm-12">
                    <div className="d-flex flex-wrap align-items-center gap-3">
                        <div className="input-group" style={{ maxWidth: "300px" }}>
                            <span className="input-group-text bg-white"><Search size={18} /></span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Round, team, tournament, ground"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <select className="form-select" value={tournamentId} onChange={(e) => setTournamentId(e.target.value)} style={{ maxWidth: "220px" }}>
                            <option value="">Choose Tournament</option>
                            {tournaments.map((t) => (
                                <option key={t.id} value={t.id}>{t.tournament_name}</option>
                            ))}
                        </select>

                        <select className="form-select" value={roundType} onChange={(e) => setRoundType(e.target.value)} style={{ maxWidth: "150px" }}>
                            <option value="">Choose Round</option>
                            {ROUND_TYPES.map((r) => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>

                        <select className="form-select" value={groupName} onChange={(e) => setGroupName(e.target.value)} style={{ maxWidth: "140px" }}>
                            <option value="">All Groups</option>
                            <option value="Group A">Group A</option>
                            <option value="Group B">Group B</option>
                            <option value="Group C">Group C</option>
                            <option value="Group D">Group D</option>
                            <option value="Pool 1">Pool 1</option>
                            <option value="Pool 2">Pool 2</option>
                        </select>

                        <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: "180px" }}>
                            <option value="">Choose Status</option>
                            {MATCH_STATUSES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>

                        <div className="d-flex align-items-center gap-2">
                            <input type="date" className="form-control" aria-label="Date from" style={{ maxWidth: "165px" }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                            <span className="text-muted">to</span>
                            <input type="date" className="form-control" aria-label="Date to" style={{ maxWidth: "165px" }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                        </div>

                        <button type="button" className="btn btn-outline-danger" onClick={handleClear} aria-label="Clear filters">
                            <SearchSlash />
                        </button>
                    </div>
                </div>

                <div className="col-sm-12">
                    {error && <div className="alert alert-danger">{error}</div>}
                    {notice && <div className="alert alert-success">{notice}</div>}

                    {loading ? (
                        <div className="text-center py-5 text-muted">Loading tournament matches...</div>
                    ) : rows.length === 0 ? (
                        <div className="text-center py-5 text-muted">No tournament matches found.</div>
                    ) : (
                        <>
                        <div className="table-responsive">
                            <table className="table align-middle mb-0">
                                <thead className="table-success">
                                    <tr>
                                        <th>#</th>
                                        <th>Match</th>
                                        <th>Teams</th>
                                        <th>Schedule</th>
                                        <th>Venue</th>
                                        <th>Winner</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedRows.map((item, idx) => (
                                        <tr key={item.id}>
                                            <th>{(page - 1) * PAGE_SIZE + idx + 1}</th>
                                            <td>
                                                <div>Match {item.match_no}{item.round_name ? ` · ${item.round_name}` : ""}</div>
                                                <div className="d-flex align-items-center gap-1 mt-1">
                                                    <span className="badge text-bg-light border">{item.round_type}</span>
                                                    {item.group_name && (
                                                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                                            {item.group_name}
                                                        </span>
                                                    )}
                                                </div>
                                                {item.tournament_name && (
                                                    <small className="text-muted d-block mt-1">
                                                        <Trophy size={12} className="me-1" />{item.tournament_name}
                                                    </small>
                                                )}
                                                {item.match_id && (
                                                    <small className="text-muted d-block">Linked: {item.actual_match_no || `#${item.match_id}`}</small>
                                                )}
                                            </td>
                                            <td>
                                                <div>
                                                    <span className={item.winner_team_id && Number(item.winner_team_id) === Number(item.team_a_id) ? "fw-bold text-success" : ""}>
                                                        {item.team_a_name || "TBD"}
                                                    </span>
                                                    {item.team_a_score && <span className="badge bg-light text-dark border ms-1">{item.team_a_score}</span>}
                                                    <span className="text-muted mx-2">vs</span>
                                                    <span className={item.winner_team_id && Number(item.winner_team_id) === Number(item.team_b_id) ? "fw-bold text-success" : ""}>
                                                        {item.team_b_name || "TBD"}
                                                    </span>
                                                    {item.team_b_score && <span className="badge bg-light text-dark border ms-1">{item.team_b_score}</span>}
                                                </div>
                                                <small className="text-muted">{item.team_a_code || "—"} · {item.team_b_code || "—"}</small>
                                            </td>
                                            <td>
                                                <div>{formatDate(item.scheduled_date)}</div>
                                                {item.scheduled_time && <small className="text-muted">{formatTime(item.scheduled_time)}</small>}
                                            </td>
                                            <td>
                                                {item.ground_name && item.ground_id ? (
                                                    <button
                                                        type="button"
                                                        className="btn btn-link p-0 text-start text-decoration-none"
                                                        onClick={() => setGroundDetailsId(item.ground_id)}
                                                        aria-label={`View details for ${item.ground_name}`}
                                                    >
                                                        <MapPin size={14} className="me-1 text-muted" />{item.ground_name}
                                                    </button>
                                                ) : "—"}
                                            </td>
                                            <td>
                                                {item.winner_team_name ? (
                                                    <div>
                                                        <span className="badge bg-success-subtle text-success border border-success-subtle fw-bold">
                                                            <Trophy size={12} className="me-1" />
                                                            {item.winner_team_name}
                                                        </span>
                                                        {(item.win_margin || item.result_summary) && (
                                                            <small className="text-muted d-block mt-1">
                                                                {item.win_margin || item.result_summary}
                                                            </small>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted">—</span>
                                                )}
                                            </td>
                                            <td>
                                                {(() => {
                                                    const effStatus = getEffectiveStatus(item);
                                                    return (
                                                        <span className={`badge ${STATUS_BADGE[effStatus] || "bg-secondary"} ${effStatus === 'Live' ? 'd-inline-flex align-items-center gap-1' : ''}`}>
                                                            {effStatus === 'Live' && <span className="spinner-grow spinner-grow-sm" style={{ width: "6px", height: "6px" }} />}
                                                            {effStatus}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td>
                                                <div className="d-flex justify-content-start gap-1">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-info d-inline-flex align-items-center gap-1"
                                                        onClick={() => handleOpenScorecard(item)}
                                                        disabled={openingScorecardId === item.id}
                                                        title="Open Player Scorecard Center (Batters & Bowlers)"
                                                    >
                                                        {openingScorecardId === item.id ? (
                                                            <span className="spinner-border spinner-border-sm" />
                                                        ) : (
                                                            <Activity size={13} />
                                                        )}
                                                        <span>Scorecard</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1"
                                                        onClick={() => openScoreModal(item)}
                                                        title="Enter or update match score"
                                                    >
                                                        <Trophy size={14} />
                                                        <span>Quick Score</span>
                                                    </button>
                                                    <Link href={`/next_panel/tournament-matches/${item.id}/edit`} className="btn btn-sm btn-outline-secondary" aria-label="Edit tournament match">
                                                        <Edit size={14} />
                                                    </Link>
                                                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(item)} aria-label="Delete tournament match">
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
                            total={rows.length}
                            onPageChange={setPage}
                            pageSize={PAGE_SIZE}
                        />
                        </>
                    )}
                </div>
            </div>
            {/* Quick Score Entry Modal */}
            {scoreModalMatch && (
                <div className="modal d-block" role="dialog" aria-modal="true" style={{ background: "rgba(0,0,0,0.5)" }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
                            <div className="modal-header bg-dark text-white p-3">
                                <div>
                                    <h5 className="modal-title mb-0 d-flex align-items-center gap-2">
                                        <Trophy size={18} className="text-warning" />
                                        Record Match Score &amp; Result
                                    </h5>
                                    <small className="text-white-50">
                                        Match {scoreModalMatch.match_no} · {scoreModalMatch.round_type} {scoreModalMatch.group_name ? `(${scoreModalMatch.group_name})` : ""} · {scoreModalMatch.tournament_name}
                                    </small>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    onClick={() => setScoreModalMatch(null)}
                                    aria-label="Close"
                                />
                            </div>

                            <form onSubmit={handleSaveScore}>
                                <div className="modal-body p-4">
                                    {scoreError && <div className="alert alert-danger mb-3">{scoreError}</div>}

                                    <div className="alert alert-info d-flex flex-wrap align-items-center justify-content-between gap-2 p-3 mb-3 rounded-3">
                                        <div>
                                            <div className="fw-semibold">
                                                🏏 Player-by-Player Scorecard Center
                                            </div>
                                            <div className="small text-muted">
                                                Insert individual runs, balls, 4s, 6s, and bowling figures for tournament squad players.
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1"
                                            disabled={openingScorecardId === scoreModalMatch.id}
                                            onClick={() => handleOpenScorecard(scoreModalMatch)}
                                        >
                                            {openingScorecardId === scoreModalMatch.id ? (
                                                <span className="spinner-border spinner-border-sm me-1" />
                                            ) : (
                                                <ExternalLink size={13} />
                                            )}
                                            <span>Open Match Scorecard Center</span>
                                        </button>
                                    </div>

                                    <div className="row g-3">
                                        {/* Team A Score Card */}
                                        <div className="col-12 col-md-6">
                                            <div className="card bg-light border p-3 rounded-3 h-100">
                                                <div className="d-flex align-items-center justify-content-between mb-2">
                                                    <span className="fw-bold text-dark fs-6">
                                                        {scoreModalMatch.team_a_name || "Team A"}
                                                    </span>
                                                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                                        {scoreModalMatch.team_a_code || "Team A"}
                                                    </span>
                                                </div>
                                                <div className="row g-2">
                                                    <div className="col-4">
                                                        <label className="form-label small text-muted">Runs</label>
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            placeholder="175"
                                                            value={scoreForm.team_a_runs}
                                                            onChange={(e) => handleScoreChange("team_a_runs", e.target.value)}
                                                            required
                                                        />
                                                    </div>
                                                    <div className="col-4">
                                                        <label className="form-label small text-muted">Wickets</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="10"
                                                            className="form-control"
                                                            placeholder="6"
                                                            value={scoreForm.team_a_wickets}
                                                            onChange={(e) => handleScoreChange("team_a_wickets", e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="col-4">
                                                        <label className="form-label small text-muted">Overs</label>
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            placeholder="20.0"
                                                            value={scoreForm.team_a_overs}
                                                            onChange={(e) => handleScoreChange("team_a_overs", e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Team B Score Card */}
                                        <div className="col-12 col-md-6">
                                            <div className="card bg-light border p-3 rounded-3 h-100">
                                                <div className="d-flex align-items-center justify-content-between mb-2">
                                                    <span className="fw-bold text-dark fs-6">
                                                        {scoreModalMatch.team_b_name || "Team B"}
                                                    </span>
                                                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                                        {scoreModalMatch.team_b_code || "Team B"}
                                                    </span>
                                                </div>
                                                <div className="row g-2">
                                                    <div className="col-4">
                                                        <label className="form-label small text-muted">Runs</label>
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            placeholder="145"
                                                            value={scoreForm.team_b_runs}
                                                            onChange={(e) => handleScoreChange("team_b_runs", e.target.value)}
                                                            required
                                                        />
                                                    </div>
                                                    <div className="col-4">
                                                        <label className="form-label small text-muted">Wickets</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="10"
                                                            className="form-control"
                                                            placeholder="10"
                                                            value={scoreForm.team_b_wickets}
                                                            onChange={(e) => handleScoreChange("team_b_wickets", e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="col-4">
                                                        <label className="form-label small text-muted">Overs</label>
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            placeholder="19.2"
                                                            value={scoreForm.team_b_overs}
                                                            onChange={(e) => handleScoreChange("team_b_overs", e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Winner & Result */}
                                        <div className="col-12 col-md-6">
                                            <label className="form-label fw-semibold">Winner Team</label>
                                            <select
                                                className="form-select"
                                                value={scoreForm.winner_team_id}
                                                onChange={(e) => setScoreForm((prev) => ({ ...prev, winner_team_id: e.target.value }))}
                                            >
                                                <option value="">No result / Tie</option>
                                                {scoreModalMatch.team_a_id && (
                                                    <option value={scoreModalMatch.team_a_id}>
                                                        {scoreModalMatch.team_a_name}
                                                    </option>
                                                )}
                                                {scoreModalMatch.team_b_id && (
                                                    <option value={scoreModalMatch.team_b_id}>
                                                        {scoreModalMatch.team_b_name}
                                                    </option>
                                                )}
                                            </select>
                                        </div>

                                        <div className="col-12 col-md-6">
                                            <label className="form-label fw-semibold">Win Margin</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="e.g. by 30 runs, by 4 wickets"
                                                value={scoreForm.win_margin}
                                                onChange={(e) => setScoreForm((prev) => ({ ...prev, win_margin: e.target.value }))}
                                            />
                                        </div>

                                        <div className="col-12">
                                            <label className="form-label fw-semibold">Result Summary Text</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="e.g. CST Lions won by 30 runs"
                                                value={scoreForm.result_summary}
                                                onChange={(e) => setScoreForm((prev) => ({ ...prev, result_summary: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="modal-footer bg-light p-3">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => setScoreModalMatch(null)}
                                        disabled={savingScore}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-success d-inline-flex align-items-center gap-2"
                                        disabled={savingScore}
                                    >
                                        <Trophy size={16} />
                                        <span>{savingScore ? "Saving..." : "Save Score & Update Points Table"}</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {groundDetailsId && <GroundDetailsModal groundId={groundDetailsId} onClose={() => setGroundDetailsId(null)} />}
        </div>
    );
}
