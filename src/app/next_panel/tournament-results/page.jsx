"use client";

import {
    ArrowLeft,
    Award,
    Calendar,
    CheckCircle2,
    Clock,
    ExternalLink,
    Filter,
    Layers,
    MapPin,
    RefreshCw,
    SearchSlash,
    Shield,
    Swords,
    Trophy,
    Users,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import useCurrentUser from "../teams/useCurrentUser";
import useTournamentOptions from "../tournament-teams/useTournamentOptions";

const ROUND_TYPES = ["League", "Round Robin", "Quarter Final", "Semi Final", "Final", "Qualifier", "Eliminator", "Custom"];
const STATUS_BADGE = {
    Completed: "bg-success",
    Live: "bg-danger",
    Scheduled: "bg-primary",
    Cancelled: "bg-secondary",
    Postponed: "bg-warning text-dark",
};

const formatDate = (val) => {
    if (!val) return "—";
    const [y, m, d] = String(val).slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
};

function TournamentResultsContent() {
    const searchParams = useSearchParams();
    const me = useCurrentUser();
    const { tournaments, loading: tournamentsLoading } = useTournamentOptions(me);

    const [selectedTournamentId, setSelectedTournamentId] = useState(searchParams.get("tournament_id") || "");
    const [roundType, setRoundType] = useState("");
    const [groupName, setGroupName] = useState("");
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    // Auto-select first active tournament if not in URL
    useEffect(() => {
        if (!selectedTournamentId && tournaments && tournaments.length > 0) {
            const active = tournaments.find((t) => t.status === "Running" || t.status === "Ongoing") || tournaments[0];
            setSelectedTournamentId(String(active.id));
        }
    }, [tournaments, selectedTournamentId]);

    const loadResults = async (tournId) => {
        if (!tournId) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ tournament_id: tournId });
            if (roundType) params.set("round_type", roundType);
            if (groupName) params.set("group_name", groupName);
            if (status) params.set("status", status);

            const res = await fetch(`/api/tournament-results?${params.toString()}`);
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to load tournament results");
            }
            setData(json);
        } catch (err) {
            setError(err.message || "Error fetching tournament results");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedTournamentId) {
            loadResults(selectedTournamentId);
        }
    }, [selectedTournamentId, roundType, groupName, status]);

    const handleClear = () => {
        setRoundType("");
        setGroupName("");
        setStatus("");
    };

    const matches = data?.matches || [];
    const summary = data?.summary || {};
    const winLeaderboard = data?.win_leaderboard || [];

    return (
        <div className="container-fluid py-4">
            {/* Header & Controls */}
            <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div>
                        <Link href="/next_panel/tournament-management" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to Tournament Hub
                        </Link>
                        <h3 className="mb-1 d-flex align-items-center gap-2">
                            <Award className="text-primary" /> Tournament Match Results &amp; Win List
                        </h3>
                        <p className="text-muted mb-0">
                            Comprehensive record of tournament fixtures, winners, scores, margins, and leaderboards.
                        </p>
                    </div>

                    <div className="d-flex flex-wrap align-items-center gap-2">
                        <select
                            className="form-select"
                            style={{ minWidth: "260px" }}
                            value={selectedTournamentId}
                            onChange={(e) => setSelectedTournamentId(e.target.value)}
                            disabled={loading || tournamentsLoading}
                        >
                            <option value="">Choose Tournament...</option>
                            {tournaments.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.tournament_name} ({t.status || "Draft"})
                                </option>
                            ))}
                        </select>

                        <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => loadResults(selectedTournamentId)}
                            title="Refresh"
                            disabled={!selectedTournamentId || loading}
                        >
                            <RefreshCw size={16} className={loading ? "spinner-border spinner-border-sm" : ""} />
                        </button>

                        <Link href={`/next_panel/tournament-standings?tournament_id=${selectedTournamentId}`} className="btn btn-primary d-flex align-items-center gap-2">
                            <Trophy size={16} /> Points Table
                        </Link>
                    </div>
                </div>

                {/* Filter Row */}
                <div className="row g-2 align-items-center mt-3 pt-3 border-top">
                    <div className="col-auto">
                        <span className="text-muted small fw-semibold">
                            <Filter size={14} className="me-1" /> Filter Matches:
                        </span>
                    </div>
                    <div className="col-auto">
                        <select className="form-select form-select-sm" value={roundType} onChange={(e) => setRoundType(e.target.value)}>
                            <option value="">All Rounds</option>
                            {ROUND_TYPES.map((r) => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>
                    <div className="col-auto">
                        <select className="form-select form-select-sm" value={groupName} onChange={(e) => setGroupName(e.target.value)}>
                            <option value="">All Groups</option>
                            <option value="Group A">Group A</option>
                            <option value="Group B">Group B</option>
                            <option value="Group C">Group C</option>
                            <option value="Group D">Group D</option>
                            <option value="Pool 1">Pool 1</option>
                            <option value="Pool 2">Pool 2</option>
                        </select>
                    </div>
                    <div className="col-auto">
                        <select className="form-select form-select-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                            <option value="">All Statuses</option>
                            <option value="Completed">Completed Only</option>
                            <option value="Live">Live Only</option>
                            <option value="Scheduled">Scheduled Only</option>
                        </select>
                    </div>
                    {(roundType || groupName || status) && (
                        <div className="col-auto">
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={handleClear}>
                                <SearchSlash size={14} className="me-1" /> Clear
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {error && <div className="alert alert-danger mb-4">{error}</div>}

            {/* Quick Metrics Bar */}
            {data && (
                <div className="row g-3 mb-4">
                    <div className="col-6 col-md-3">
                        <div className="card border-0 rounded-4 shadow-sm p-3 bg-white text-center">
                            <div className="text-muted small">Total Fixtures</div>
                            <div className="fs-3 fw-bold text-dark">{summary.total_matches || 0}</div>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="card border-0 rounded-4 shadow-sm p-3 bg-white text-center">
                            <div className="text-muted small">Matches Decided (Won)</div>
                            <div className="fs-3 fw-bold text-success">{summary.completed_matches || 0}</div>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="card border-0 rounded-4 shadow-sm p-3 bg-white text-center">
                            <div className="text-muted small">Live Matches</div>
                            <div className="fs-3 fw-bold text-danger">{summary.live_matches || 0}</div>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="card border-0 rounded-4 shadow-sm p-3 bg-white text-center">
                            <div className="text-muted small">Leading Team (Most Wins)</div>
                            <div className="fs-6 fw-bold text-primary text-truncate">
                                {summary.top_winning_team ? `${summary.top_winning_team.team_name} (${summary.top_winning_team.wins} Wins)` : "TBD"}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="row g-4">
                {/* Main Results List */}
                <div className="col-12 col-lg-8">
                    <div className="card border-0 rounded-4 shadow-sm bg-white overflow-hidden">
                        <div className="card-header bg-white border-bottom p-3 d-flex justify-content-between align-items-center">
                            <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                                <Swords className="text-primary" size={20} /> Match Results &amp; Win List
                            </h5>
                            <span className="badge bg-light text-dark border">
                                {matches.length} Matches
                            </span>
                        </div>

                        <div className="card-body p-3">
                            {loading ? (
                                <div className="text-center py-5 text-muted">
                                    <RefreshCw size={24} className="spinner-border spinner-border-sm me-2 text-primary" />
                                    Loading match results...
                                </div>
                            ) : matches.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    <Trophy size={40} className="mb-2 text-muted opacity-50" />
                                    <p className="mb-0">No matches found for this filter.</p>
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-3">
                                    {matches.map((match) => {
                                        const isCompleted = String(match.status).toLowerCase() === "completed";
                                        const isLive = String(match.status).toLowerCase() === "live";
                                        const winnerA = match.winner_team_id && Number(match.winner_team_id) === Number(match.team_a_id);
                                        const winnerB = match.winner_team_id && Number(match.winner_team_id) === Number(match.team_b_id);

                                        return (
                                            <div
                                                key={match.id}
                                                className="border rounded-4 p-3 position-relative transition"
                                                style={{
                                                    background: isCompleted ? "#FAFAFA" : "#FFFFFF",
                                                    borderLeft: isCompleted
                                                        ? "6px solid #10B981"
                                                        : isLive
                                                        ? "6px solid #EF4444"
                                                        : "6px solid #3B82F6",
                                                }}
                                            >
                                                {/* Match Header Info */}
                                                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 pb-2 mb-2 border-bottom">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className="fw-bold text-dark">
                                                            Match {match.match_no}
                                                        </span>
                                                        <span className="badge text-bg-light border">
                                                            {match.round_type}
                                                        </span>
                                                        {match.group_name && (
                                                            <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                                                {match.group_name}
                                                            </span>
                                                        )}
                                                        {match.round_name && (
                                                            <small className="text-muted">· {match.round_name}</small>
                                                        )}
                                                    </div>

                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className={`badge ${STATUS_BADGE[match.status] || "bg-secondary"}`}>
                                                            {match.status}
                                                        </span>
                                                        {match.match_id && (
                                                            <Link
                                                                href={`/next_panel/match-scorecard/center?match_id=${match.match_id}`}
                                                                className="btn btn-sm btn-outline-primary py-0 px-2 small d-inline-flex align-items-center gap-1"
                                                                title="View Scorecard in Match Center"
                                                            >
                                                                <span>Scorecard</span>
                                                                <ExternalLink size={12} />
                                                            </Link>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Teams & Scores Row */}
                                                <div className="row align-items-center g-2 my-2">
                                                    {/* Team A */}
                                                    <div className="col-5">
                                                        <div className="d-flex align-items-center justify-content-between gap-2">
                                                            <div>
                                                                <div className={`fs-6 ${winnerA ? "fw-bold text-success" : "fw-semibold text-dark"}`}>
                                                                    {match.team_a_name || "Team A"}
                                                                </div>
                                                                <small className="text-muted">{match.team_a_code || "—"}</small>
                                                            </div>
                                                            {match.team_a_score && (
                                                                <div className="text-end">
                                                                    <span className="badge bg-light text-dark border fs-6">
                                                                        {match.team_a_score}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* VS separator */}
                                                    <div className="col-2 text-center text-muted fw-bold small">
                                                        VS
                                                    </div>

                                                    {/* Team B */}
                                                    <div className="col-5">
                                                        <div className="d-flex align-items-center justify-content-between gap-2">
                                                            {match.team_b_score && (
                                                                <div className="text-start">
                                                                    <span className="badge bg-light text-dark border fs-6">
                                                                        {match.team_b_score}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div className="text-end ms-auto">
                                                                <div className={`fs-6 ${winnerB ? "fw-bold text-success" : "fw-semibold text-dark"}`}>
                                                                    {match.team_b_name || "Team B"}
                                                                </div>
                                                                <small className="text-muted">{match.team_b_code || "—"}</small>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Outcome & Win Banner */}
                                                {isCompleted && (
                                                    <div className="bg-success-subtle text-success p-2 rounded-3 mt-2 d-flex flex-wrap align-items-center justify-content-between gap-2 border border-success-subtle">
                                                        <div className="d-flex align-items-center gap-2">
                                                            <Trophy size={16} className="text-success flex-shrink-0" />
                                                            <span className="fw-bold">
                                                                {match.outcome_text || (match.winner_team_name ? `${match.winner_team_name} Won` : "Match Concluded")}
                                                            </span>
                                                        </div>
                                                        {match.man_of_the_match_name && (
                                                            <div className="small text-dark">
                                                                <strong>Player of Match:</strong> {match.man_of_the_match_name}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Match Meta Footer */}
                                                <div className="d-flex flex-wrap align-items-center gap-3 mt-2 pt-2 text-muted small">
                                                    <span className="d-inline-flex align-items-center gap-1">
                                                        <Calendar size={13} /> {formatDate(match.scheduled_date)}
                                                    </span>
                                                    {match.scheduled_time && (
                                                        <span className="d-inline-flex align-items-center gap-1">
                                                            <Clock size={13} /> {String(match.scheduled_time).slice(0, 5)}
                                                        </span>
                                                    )}
                                                    {match.ground_name && (
                                                        <span className="d-inline-flex align-items-center gap-1">
                                                            <MapPin size={13} /> {match.ground_name}
                                                        </span>
                                                    )}
                                                    {match.overs && <span>({match.overs} overs)</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar: Tournament Win Leaderboard */}
                <div className="col-12 col-lg-4">
                    <div className="card border-0 rounded-4 shadow-sm bg-white p-3 mb-4">
                        <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                            <Trophy className="text-warning" size={18} /> Most Wins Leaderboard
                        </h6>
                        {winLeaderboard.length === 0 ? (
                            <div className="text-muted small py-3 text-center">
                                No completed matches yet to determine team wins.
                            </div>
                        ) : (
                            <div className="d-flex flex-column gap-2">
                                {winLeaderboard.map((w, idx) => (
                                    <div
                                        key={w.team_id}
                                        className="d-flex align-items-center justify-content-between p-2 rounded-3 bg-light"
                                    >
                                        <div className="d-flex align-items-center gap-2">
                                            <span
                                                className={`badge rounded-circle ${
                                                    idx === 0
                                                        ? "bg-warning text-dark"
                                                        : idx === 1
                                                        ? "bg-secondary text-white"
                                                        : "bg-dark text-white"
                                                }`}
                                                style={{ width: "24px", height: "24px", lineHeight: "14px" }}
                                            >
                                                {idx + 1}
                                            </span>
                                            <div className="fw-semibold text-dark text-truncate" style={{ maxWidth: "160px" }}>
                                                {w.team_name}
                                            </div>
                                        </div>
                                        <div className="d-flex align-items-center gap-2">
                                            <span className="badge bg-success px-2 py-1 fs-6">
                                                {w.wins} {w.wins === 1 ? "Win" : "Wins"}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Quick Navigation Card */}
                    <div className="card border-0 rounded-4 shadow-sm bg-white p-3">
                        <h6 className="fw-bold mb-2">Tournament Management Links</h6>
                        <ul className="list-unstyled mb-0 d-flex flex-column gap-2">
                            <li>
                                <Link
                                    href="/next_panel/tournament-matches/new"
                                    className="d-flex align-items-center justify-content-between p-2 rounded-2 text-decoration-none text-dark bg-light hover-primary"
                                >
                                    <span>+ Schedule Tournament Match</span>
                                    <ExternalLink size={14} className="text-muted" />
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href={`/next_panel/tournament-standings?tournament_id=${selectedTournamentId}`}
                                    className="d-flex align-items-center justify-content-between p-2 rounded-2 text-decoration-none text-dark bg-light hover-primary"
                                >
                                    <span>View Tournament Points Table</span>
                                    <ExternalLink size={14} className="text-muted" />
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/next_panel/tournament-teams"
                                    className="d-flex align-items-center justify-content-between p-2 rounded-2 text-decoration-none text-dark bg-light hover-primary"
                                >
                                    <span>Manage Teams &amp; Groups</span>
                                    <ExternalLink size={14} className="text-muted" />
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function TournamentResultsPage() {
    return (
        <Suspense fallback={<div className="container-fluid py-5 text-center text-muted">Loading tournament results...</div>}>
            <TournamentResultsContent />
        </Suspense>
    );
}
