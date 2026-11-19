"use client";

import { ArrowLeft, Award, CheckCircle2, ChevronRight, Layers, RefreshCw, Shield, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import useCurrentUser from "../teams/useCurrentUser";
import useTournamentOptions from "../tournament-teams/useTournamentOptions";

export default function TournamentStandingsPage() {
    const me = useCurrentUser();
    const { tournaments, loading: tournamentsLoading } = useTournamentOptions(me);

    const [selectedTournamentId, setSelectedTournamentId] = useState("");
    const [selectedGroup, setSelectedGroup] = useState("ALL");
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    // Auto-select first active tournament
    useEffect(() => {
        if (!selectedTournamentId && tournaments && tournaments.length > 0) {
            const active = tournaments.find((t) => t.status === "Running" || t.status === "Ongoing") || tournaments[0];
            setSelectedTournamentId(String(active.id));
        }
    }, [tournaments, selectedTournamentId]);

    const loadStandings = async (tournId, isSync = false) => {
        if (!tournId) return;
        if (isSync) setSyncing(true);
        else setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/tournament-standings?tournament_id=${tournId}`);
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to load tournament standings");
            }
            setData(json);
        } catch (err) {
            setError(err.message || "Error loading standings");
        } finally {
            setLoading(false);
            setSyncing(false);
        }
    };

    useEffect(() => {
        if (selectedTournamentId) {
            loadStandings(selectedTournamentId);
            setSelectedGroup("ALL");
        }
    }, [selectedTournamentId]);

    // Active table data (either a specific group or overall)
    const activeStandings = !data
        ? []
        : selectedGroup === "ALL"
        ? data.overall_standings || data.standings || []
        : data.groups?.[selectedGroup] || [];

    const groupNames = data?.group_names || [];
    const leader = data?.overall_standings?.[0] || null;

    return (
        <div className="container-fluid py-4">
            {/* Header & Breadcrumb */}
            <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div>
                        <Link href="/next_panel/tournament-management" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to Tournament Hub
                        </Link>
                        <h3 className="mb-1 d-flex align-items-center gap-2">
                            <Trophy className="text-primary" /> Tournament Points Table &amp; Team Scores
                        </h3>
                        <p className="text-muted mb-0">
                            Live team standings, points, Net Run Rate (NRR), and Group-wise scorecards.
                        </p>
                    </div>

                    {/* Tournament Selector & Refresh */}
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
                            className="btn btn-outline-primary d-flex align-items-center gap-2"
                            onClick={() => loadStandings(selectedTournamentId, true)}
                            disabled={!selectedTournamentId || syncing || loading}
                            title="Recalculate and update points table from match scorecards"
                        >
                            <RefreshCw size={16} className={syncing ? "spinner-border spinner-border-sm" : ""} />
                            <span>{syncing ? "Updating..." : "Recalculate"}</span>
                        </button>

                        <Link href={`/next_panel/tournament-matches?tournament_id=${selectedTournamentId}`} className="btn btn-outline-success d-flex align-items-center gap-2">
                            <Trophy size={16} /> Enter Match Scores
                        </Link>

                        <Link href={`/next_panel/tournament-results?tournament_id=${selectedTournamentId}`} className="btn btn-primary d-flex align-items-center gap-2">
                            <Award size={16} /> Win List &amp; Results
                        </Link>
                    </div>
                </div>
            </div>

            {error && <div className="alert alert-danger mb-4">{error}</div>}

            {/* Tournament Meta & Summary Cards */}
            {data && data.tournament && (
                <div className="row g-3 mb-4">
                    <div className="col-12 col-md-3">
                        <div className="card border-0 rounded-4 shadow-sm p-3 bg-white h-100">
                            <div className="d-flex align-items-center gap-3">
                                <div className="rounded-3 p-3 bg-primary-subtle text-primary">
                                    <Trophy size={24} />
                                </div>
                                <div>
                                    <div className="text-muted small">Tournament Leader</div>
                                    <div className="fs-6 fw-bold text-dark text-truncate" style={{ maxWidth: "160px" }}>
                                        {leader ? leader.team_name : "TBD"}
                                    </div>
                                    <div className="text-success small fw-semibold">
                                        {leader ? `${leader.points} PTS · NRR ${leader.net_run_rate_formatted}` : "—"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-12 col-md-3">
                        <div className="card border-0 rounded-4 shadow-sm p-3 bg-white h-100">
                            <div className="d-flex align-items-center gap-3">
                                <div className="rounded-3 p-3 bg-info-subtle text-info">
                                    <Users size={24} />
                                </div>
                                <div>
                                    <div className="text-muted small">Registered Teams</div>
                                    <div className="fs-4 fw-bold text-dark">{data.total_teams || 0}</div>
                                    <div className="text-muted small">{data.tournament.type || "Tournament"}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-12 col-md-3">
                        <div className="card border-0 rounded-4 shadow-sm p-3 bg-white h-100">
                            <div className="d-flex align-items-center gap-3">
                                <div className="rounded-3 p-3 bg-warning-subtle text-warning">
                                    <Layers size={24} />
                                </div>
                                <div>
                                    <div className="text-muted small">Groups / Pools</div>
                                    <div className="fs-4 fw-bold text-dark">{groupNames.length || 1}</div>
                                    <div className="text-muted small">
                                        {groupNames.join(", ") || "Single Pool"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-12 col-md-3">
                        <div className="card border-0 rounded-4 shadow-sm p-3 bg-white h-100">
                            <div className="d-flex align-items-center gap-3">
                                <div className="rounded-3 p-3 bg-success-subtle text-success">
                                    <CheckCircle2 size={24} />
                                </div>
                                <div>
                                    <div className="text-muted small">Tournament Status</div>
                                    <div className="fs-6 fw-bold text-dark">{data.tournament.status}</div>
                                    <div className="text-muted small">{data.tournament.overs ? `${data.tournament.overs} Overs Match` : "Standard"}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Standings Table Card */}
            <div className="card border-0 rounded-4 shadow-sm bg-white overflow-hidden">
                {/* Group Tabs Navigation */}
                <div className="card-header bg-white border-bottom p-3">
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                        <ul className="nav nav-pills gap-2">
                            <li className="nav-item">
                                <button
                                    type="button"
                                    className={`nav-link px-3 py-2 fw-semibold ${selectedGroup === "ALL" ? "active" : "btn-light"}`}
                                    onClick={() => setSelectedGroup("ALL")}
                                >
                                    <Layers size={16} className="me-1 d-inline" /> Overall Standings
                                </button>
                            </li>
                            {groupNames.map((grp) => (
                                <li className="nav-item" key={grp}>
                                    <button
                                        type="button"
                                        className={`nav-link px-3 py-2 fw-semibold ${selectedGroup === grp ? "active" : "btn-light"}`}
                                        onClick={() => setSelectedGroup(grp)}
                                    >
                                        <Shield size={16} className="me-1 d-inline" /> {grp}
                                        <span className="badge bg-white text-dark ms-2">
                                            {data?.groups?.[grp]?.length || 0}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>

                        <div className="text-muted small">
                            <span className="badge bg-success me-1">Q</span> Top 2/4 qualify for playoffs
                        </div>
                    </div>
                </div>

                {/* Table Body */}
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5 text-muted">
                            <RefreshCw size={24} className="spinner-border spinner-border-sm me-2 text-primary" />
                            Loading points table and team scores...
                        </div>
                    ) : !selectedTournamentId ? (
                        <div className="text-center py-5 text-muted">
                            <Trophy size={40} className="mb-2 text-muted opacity-50" />
                            <p>Please select a tournament to view points table.</p>
                        </div>
                    ) : activeStandings.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                            <p className="mb-0">No teams found for this group or tournament.</p>
                            <Link href="/next_panel/tournament-teams/new" className="btn btn-sm btn-outline-primary mt-3">
                                Register Teams Now
                            </Link>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th style={{ width: "50px" }} className="text-center">#</th>
                                        <th>Team</th>
                                        {selectedGroup === "ALL" && <th>Group</th>}
                                        <th className="text-center" title="Matches Played">P</th>
                                        <th className="text-center text-success" title="Matches Won">W</th>
                                        <th className="text-center text-danger" title="Matches Lost">L</th>
                                        <th className="text-center text-warning" title="Matches Tied">T</th>
                                        <th className="text-center text-secondary" title="No Result / Abandoned">NR</th>
                                        <th className="text-center fw-bold fs-6" title="Total Points" style={{ background: "#F0F9FF" }}>PTS</th>
                                        <th className="text-center fw-bold" title="Net Run Rate">NRR</th>
                                        <th className="text-center text-muted small" title="Runs Scored / Overs Faced">For</th>
                                        <th className="text-center text-muted small" title="Runs Conceded / Overs Bowled">Against</th>
                                        <th className="text-center" title="Recent Form (Last 5 matches)">Recent Form</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeStandings.map((team, idx) => {
                                        const rank = team.group_rank || team.rank || idx + 1;
                                        const isTopQualifier = rank <= 2;
                                        const nrr = Number(team.net_run_rate) || 0;

                                        return (
                                            <tr
                                                key={team.team_id}
                                                style={{
                                                    borderLeft: isTopQualifier ? "4px solid #10B981" : "4px solid transparent",
                                                }}
                                            >
                                                <td className="text-center">
                                                    <span
                                                        className={`badge rounded-circle p-2 ${
                                                            rank === 1
                                                                ? "bg-warning text-dark"
                                                                : rank === 2
                                                                ? "bg-secondary text-white"
                                                                : rank === 3
                                                                ? "bg-dark text-white"
                                                                : "bg-light text-dark border"
                                                        }`}
                                                        style={{ width: "28px", height: "28px", lineHeight: "14px" }}
                                                    >
                                                        {rank}
                                                    </span>
                                                </td>

                                                {/* Team Name */}
                                                <td>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="fw-bold text-dark">{team.team_name}</div>
                                                        {team.team_code && (
                                                            <span className="badge bg-light text-muted border">
                                                                {team.team_code}
                                                            </span>
                                                        )}
                                                        {isTopQualifier && (
                                                            <span className="badge bg-success-subtle text-success border border-success-subtle small py-0 px-1">
                                                                Q
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Group (if overall) */}
                                                {selectedGroup === "ALL" && (
                                                    <td>
                                                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                                            {team.group_name || "Group A"}
                                                        </span>
                                                    </td>
                                                )}

                                                <td className="text-center fw-semibold">{team.played}</td>
                                                <td className="text-center text-success fw-semibold">{team.won}</td>
                                                <td className="text-center text-danger">{team.lost}</td>
                                                <td className="text-center text-warning">{team.tied}</td>
                                                <td className="text-center text-secondary">{team.no_result}</td>

                                                {/* Points */}
                                                <td className="text-center fw-bold fs-5 text-primary" style={{ background: "#F0F9FF" }}>
                                                    {team.points}
                                                </td>

                                                {/* NRR */}
                                                <td
                                                    className={`text-center fw-bold ${
                                                        nrr > 0 ? "text-success" : nrr < 0 ? "text-danger" : "text-muted"
                                                    }`}
                                                >
                                                    {team.net_run_rate_formatted || "0.000"}
                                                </td>

                                                {/* Runs & Overs For */}
                                                <td className="text-center text-muted small">
                                                    {team.runs_for}/{team.overs_for}
                                                </td>

                                                {/* Runs & Overs Against */}
                                                <td className="text-center text-muted small">
                                                    {team.runs_against}/{team.overs_against}
                                                </td>

                                                {/* Form Badges */}
                                                <td className="text-center">
                                                    <div className="d-inline-flex gap-1">
                                                        {team.recent_form && team.recent_form.length > 0 ? (
                                                            team.recent_form.map((res, fIdx) => (
                                                                <span
                                                                    key={fIdx}
                                                                    className={`badge rounded-pill ${
                                                                        res === "W"
                                                                            ? "bg-success text-white"
                                                                            : res === "L"
                                                                            ? "bg-danger text-white"
                                                                            : res === "T"
                                                                            ? "bg-warning text-dark"
                                                                            : "bg-secondary text-white"
                                                                    }`}
                                                                    style={{ fontSize: "10px", width: "18px", height: "18px", padding: "3px 0" }}
                                                                    title={res === "W" ? "Won" : res === "L" ? "Lost" : res === "T" ? "Tied" : "No Result"}
                                                                >
                                                                    {res}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-muted small">—</span>
                                                        )}
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

                {/* Footer Notes */}
                <div className="card-footer bg-light p-3 text-muted small d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <div>
                        <strong>Points Rule:</strong> Win = 2 points, Tie / No Result = 1 point, Loss = 0 points.
                    </div>
                    <div>
                        <strong>Tie-breaker:</strong> Most Points &gt; Higher Net Run Rate (NRR) &gt; Most Wins &gt; Head to Head.
                    </div>
                </div>
            </div>
        </div>
    );
}
