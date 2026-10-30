"use client";

import { ArrowLeft, Edit, MapPin, Search, SearchSlash, Swords, Trash2, Trophy } from "lucide-react";
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
    const [status, setStatus] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [reload, setReload] = useState(0);

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

                        <select className="form-select" value={roundType} onChange={(e) => setRoundType(e.target.value)} style={{ maxWidth: "170px" }}>
                            <option value="">Choose Round</option>
                            {ROUND_TYPES.map((r) => (
                                <option key={r} value={r}>{r}</option>
                            ))}
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
                                                <span className="badge text-bg-light border">{item.round_type}</span>
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
                                                    {item.team_a_name || "TBD"}
                                                    <span className="text-muted mx-2">vs</span>
                                                    {item.team_b_name || "TBD"}
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
                                            <td>{item.winner_team_name || "—"}</td>
                                            <td>
                                                <span className={`badge ${STATUS_BADGE[item.status] || "bg-secondary"}`}>{item.status}</span>
                                            </td>
                                            <td>
                                                <div className="d-flex justify-content-start gap-2">
                                                    <Link href={`/next_panel/tournament-matches/${item.id}/edit`} className="btn btn-outline-secondary" aria-label="Edit tournament match">
                                                        <Edit size={16} />
                                                    </Link>
                                                    <button type="button" className="btn btn-outline-danger" onClick={() => handleDelete(item)} aria-label="Delete tournament match">
                                                        <Trash2 size={16} />
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
                    )}
                </div>
            </div>
            {groundDetailsId && <GroundDetailsModal groundId={groundDetailsId} onClose={() => setGroundDetailsId(null)} />}
        </div>
    );
}
