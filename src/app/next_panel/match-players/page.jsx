"use client";

import { ArrowLeft, Edit, Search, SearchSlash, Trash2, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const formatDate = (value) => {
    if (!value) return "—";
    const [y, m, d] = String(value).slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
};

const playerName = (p) => {
    if (p.first_name || p.last_name) return `${p.first_name || ""} ${p.last_name || ""}`.trim();
    if (p.outside_player_id) return `Outside player #${p.outside_player_id}`;
    if (p.tournament_team_player_id) return `Tournament player #${p.tournament_team_player_id}`;
    return "—";
};

const playerSource = (p) =>
    p.user_id ? "Registered" : p.outside_player_id ? "Outside" : p.tournament_team_player_id ? "Tournament" : "—";

export default function MatchPlayersPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [players, setPlayers] = useState([]);
    const [matches, setMatches] = useState([]);

    // Filters (all supported server-side by GET /api/match-players)
    const [search, setSearch] = useState("");
    const [matchId, setMatchId] = useState("");
    const [teamId, setTeamId] = useState("");
    const [selection, setSelection] = useState(""); // playing_11 | substitute | captain | vice_captain | wicket_keeper
    const [status, setStatus] = useState("");
    const [reload, setReload] = useState(0);

    // Matches for the filter dropdown
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/matches");
                const json = await res.json();
                if (res.ok && json.success) setMatches(json.data || []);
            } catch {
                /* filter dropdown is optional */
            }
        })();
    }, []);

    const selectedMatch = matches.find((m) => String(m.id) === matchId);

    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (matchId) params.set("match_id", matchId);
                if (teamId) params.set("team_id", teamId);
                if (selection) params.set(selection, "1");
                if (status) params.set("status", status);

                const query = params.toString();
                const res = await fetch(`/api/match-players${query ? `?${query}` : ""}`, { signal: controller.signal });
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.message || "Unable to load match players.");
                setPlayers(json.data || []);
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
    }, [matchId, teamId, selection, status, reload]);

    // The API has no text search, so name/team/match search is applied client-side
    const needle = search.trim().toLowerCase();
    const visible = needle
        ? players.filter((p) =>
              [playerName(p), p.team_name, p.team_code, p.match_no, p.jersey_no]
                  .filter(Boolean)
                  .some((v) => String(v).toLowerCase().includes(needle))
          )
        : players;

    const handleClear = (e) => {
        e.preventDefault();
        setSearch("");
        setMatchId("");
        setTeamId("");
        setSelection("");
        setStatus("");
    };

    const handleDelete = async (item) => {
        if (!confirm(`Remove ${playerName(item)} from ${item.team_name} for this match?`)) return;
        setError(null);
        setNotice(null);
        try {
            const res = await fetch(`/api/match-players/${item.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Unable to remove player");
            setNotice(`${playerName(item)} removed.`);
            setReload((n) => n + 1);
        } catch (err) {
            setError(err.message);
        }
    };

    const roles = (p) => {
        const list = [];
        if (p.captain) list.push(["C", "bg-warning text-dark", "Captain"]);
        if (p.vice_captain) list.push(["VC", "bg-info text-dark", "Vice-captain"]);
        if (p.wicket_keeper) list.push(["WK", "bg-dark", "Wicket-keeper"]);
        return list;
    };

    return (
        <div className="container-fluid">
            <div className="row g-3">
                <div className="col-sm-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center gap-3">
                            <div>
                                <Link href="match-management" className="btn btn-sm btn-outline-secondary mb-3">
                                <ArrowLeft size={16} className="me-2"/> Back to match management
                                </Link>
                                <h3 className="mb-0"><Users /> Match Players</h3>
                                <p className="text-muted mb-0">Pick the playing eleven, substitutes and roles for each match.</p>
                            </div>
                            <Link
                                href={`/next_panel/match-players/new${matchId ? `?match_id=${matchId}` : ""}`}
                                className="btn btn-primary px-4"
                            >
                                <UserPlus size={18} /> Add Match Player
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="col-sm-12">
                    <div className="d-flex flex-wrap align-items-center gap-3">
                        <div className="input-group" style={{ maxWidth: "280px" }}>
                            <span className="input-group-text bg-white"><Search size={18} /></span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Player, team, jersey"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <select
                            className="form-select"
                            value={matchId}
                            onChange={(e) => { setMatchId(e.target.value); setTeamId(""); }}
                            style={{ maxWidth: "260px" }}
                        >
                            <option value="">Choose Match</option>
                            {matches.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.match_no || `Match #${m.id}`} — {m.team_a_name} vs {m.team_b_name}
                                </option>
                            ))}
                        </select>

                        <select
                            className="form-select"
                            value={teamId}
                            onChange={(e) => setTeamId(e.target.value)}
                            disabled={!selectedMatch}
                            style={{ maxWidth: "200px" }}
                        >
                            <option value="">Choose Team</option>
                            {selectedMatch && (
                                <>
                                    <option value={selectedMatch.team_a_id}>{selectedMatch.team_a_name}</option>
                                    <option value={selectedMatch.team_b_id}>{selectedMatch.team_b_name}</option>
                                </>
                            )}
                        </select>

                        <select className="form-select" value={selection} onChange={(e) => setSelection(e.target.value)} style={{ maxWidth: "180px" }}>
                            <option value="">Choose Role</option>
                            <option value="playing_11">Playing 11</option>
                            <option value="substitute">Substitute</option>
                            <option value="captain">Captain</option>
                            <option value="vice_captain">Vice-captain</option>
                            <option value="wicket_keeper">Wicket-keeper</option>
                        </select>

                        <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: "160px" }}>
                            <option value="">Choose Status</option>
                            <option value="1">Active</option>
                            <option value="0">Inactive</option>
                        </select>

                        <button type="button" className="btn btn-outline-danger" onClick={handleClear} aria-label="Clear filters">
                            <SearchSlash />
                        </button>
                    </div>
                </div>

                <div className="col-sm-12">
                    {error && <div className="alert alert-danger">{error}</div>}
                    {notice && <div className="alert alert-success">{notice}</div>}

                    {loading ? (
                        <div className="text-center py-5 text-muted">Loading match players...</div>
                    ) : visible.length === 0 ? (
                        <div className="text-center py-5 text-muted">No match players found.</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table align-middle mb-0">
                                <thead className="table-success">
                                    <tr>
                                        <th>#</th>
                                        <th>Player</th>
                                        <th>Team</th>
                                        <th>Match</th>
                                        <th>Selection</th>
                                        <th>Roles</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visible.map((item, idx) => (
                                        <tr key={item.id}>
                                            <th>{idx + 1}</th>
                                            <td>
                                                <div>
                                                    {playerName(item)}
                                                    {item.jersey_no && <span className="badge text-bg-light border ms-2">#{item.jersey_no}</span>}
                                                </div>
                                                <small className="text-muted">{playerSource(item)}</small>
                                            </td>
                                            <td>
                                                <div>{item.team_name}</div>
                                                {item.team_code && <small className="text-muted">{item.team_code}</small>}
                                            </td>
                                            <td>
                                                <div>{item.match_no || `Match #${item.match_id}`}</div>
                                                <small className="text-muted">{formatDate(item.match_date)}</small>
                                            </td>
                                            <td>
                                                {item.playing_11 ? (
                                                    <span className="badge bg-success">Playing 11</span>
                                                ) : item.substitute ? (
                                                    <span className="badge bg-secondary">Substitute</span>
                                                ) : (
                                                    "—"
                                                )}
                                            </td>
                                            <td>
                                                <div className="d-flex gap-1">
                                                    {roles(item).map(([label, cls, title]) => (
                                                        <span key={label} className={`badge ${cls}`} title={title}>{label}</span>
                                                    ))}
                                                    {roles(item).length === 0 && "—"}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge ${item.status ? "bg-success" : "bg-secondary"}`}>
                                                    {item.status ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="d-flex justify-content-start gap-2">
                                                    <Link href={`/next_panel/match-players/${item.id}/edit`} className="btn btn-outline-secondary" aria-label="Edit match player">
                                                        <Edit size={16} />
                                                    </Link>
                                                    <button type="button" className="btn btn-outline-danger" onClick={() => handleDelete(item)} aria-label="Remove match player">
                                                        <Trash2 size={16} />
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
        </div>
    );
}
