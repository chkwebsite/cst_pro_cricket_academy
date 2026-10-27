"use client";

import { ArrowBigLeft, ArrowLeft, Ban, Edit, MapPin, Search, SearchSlash, Swords, Trophy } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import GroundDetailsModal from "../components/GroundDetailsModal";

const MATCH_TYPES = ["Practice", "Friendly", "League", "Tournament", "Knockout"];
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

// "18:30:00" -> "18:30"
const formatTime = (value) => (value ? String(value).slice(0, 5) : "");

export default function MatchesPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [matches, setMatches] = useState([]);
    const [groundDetailsId, setGroundDetailsId] = useState(null);

    // Filters (all supported server-side by GET /api/matches)
    const [search, setSearch] = useState("");
    const [matchType, setMatchType] = useState("");
    const [status, setStatus] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // Bumped after a cancel so the list is re-fetched from the server
    const [reload, setReload] = useState(0);

    // Debounced fetch so we don't hit the API on every keystroke
    useEffect(() => {
        const controller = new AbortController();

        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (search.trim()) params.set("search", search.trim());
                if (matchType) params.set("match_type", matchType);
                if (status) params.set("status", status);
                if (dateFrom) params.set("date_from", dateFrom);
                if (dateTo) params.set("date_to", dateTo);

                const query = params.toString();
                const res = await fetch(`/api/matches${query ? `?${query}` : ""}`, {
                    signal: controller.signal,
                });
                const json = await res.json();

                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Unable to load Matches.");
                }
                setMatches(json.data || []);
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
    }, [search, matchType, status, dateFrom, dateTo, reload]);

    const handleClear = (e) => {
        e.preventDefault();
        setSearch("");
        setMatchType("");
        setStatus("");
        setDateFrom("");
        setDateTo("");
    };

    // The API does not delete matches: DELETE sets status = 'Cancelled'
    const handleCancel = async (item) => {
        const label = item.match_no || `#${item.id}`;
        if (!confirm(`Cancel match "${label}" (${item.team_a_name} vs ${item.team_b_name})? The match is kept with status Cancelled.`)) return;
        setError(null);
        setNotice(null);
        try {
            const res = await fetch(`/api/matches/${item.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to cancel match");
            }
            setNotice(`Match "${label}" cancelled.`);
            setReload((n) => n + 1);
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="container-fluid">
            <div className="row g-3">
                {/* Header */}
                <div className="col-sm-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center gap-3">
                            <div>
                                <Link href="match-management" className="btn btn-sm btn-outline-secondary mb-3">
                                <ArrowLeft size={16} className="me-2"/> Back to match management
                                </Link>
                                <h3 className="mb-0"><Swords /> Matches</h3>
                                <p className="text-muted mb-0">Schedule matches, set venues, and record toss details.</p>
                            </div>
                            <Link href="/next_panel/matches/new" className="btn btn-primary px-4">
                                <Swords size={18} /> Add Match
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="col-sm-12">
                    <div className="d-flex flex-wrap align-items-center gap-3">
                        <div className="input-group" style={{ maxWidth: "300px" }}>
                            <span className="input-group-text bg-white"><Search size={18} /></span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Match no, team, tournament, ground"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <select
                            className="form-select"
                            value={matchType}
                            onChange={(e) => setMatchType(e.target.value)}
                            style={{ maxWidth: "170px" }}
                        >
                            <option value="">Choose Type</option>
                            {MATCH_TYPES.map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>

                        <select
                            className="form-select"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            style={{ maxWidth: "180px" }}
                        >
                            <option value="">Choose Status</option>
                            {MATCH_STATUSES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>

                        <div className="d-flex align-items-center gap-2">
                            <input
                                type="date"
                                className="form-control"
                                aria-label="Date from"
                                style={{ maxWidth: "165px" }}
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                            />
                            <span className="text-muted">to</span>
                            <input
                                type="date"
                                className="form-control"
                                aria-label="Date to"
                                style={{ maxWidth: "165px" }}
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                            />
                        </div>

                        <button
                            type="button"
                            className="btn btn-outline-danger"
                            onClick={handleClear}
                            aria-label="Clear filters"
                        >
                            <SearchSlash />
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="col-sm-12">
                    {error && <div className="alert alert-danger">{error}</div>}
                    {notice && <div className="alert alert-success">{notice}</div>}

                    {loading ? (
                        <div className="text-center py-5 text-muted">Loading matches...</div>
                    ) : matches.length === 0 ? (
                        <div className="text-center py-5 text-muted">No matches found.</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table align-middle mb-0">
                                <thead className="table-success">
                                    <tr>
                                        <th>#</th>
                                        <th>Match</th>
                                        <th>Teams</th>
                                        <th>Date &amp; Time</th>
                                        <th>Venue</th>
                                        <th>Toss</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {matches.map((item, idx) => {
                                        const closed = item.status === "Completed" || item.status === "Cancelled";
                                        return (
                                            <tr key={item.id}>
                                                <th>{idx + 1}</th>
                                                <td>
                                                    <div>{item.match_no || `Match #${item.id}`}</div>
                                                    <span className="badge text-bg-light border">{item.match_type}</span>
                                                    {item.tournament_name && (
                                                        <small className="text-muted d-block mt-1">
                                                            <Trophy size={12} className="me-1" />{item.tournament_name}
                                                        </small>
                                                    )}
                                                </td>
                                                <td>
                                                    <div>
                                                        {item.team_a_name}
                                                        <span className="text-muted mx-2">vs</span>
                                                        {item.team_b_name}
                                                    </div>
                                                    <small className="text-muted">
                                                        {item.team_a_code} · {item.team_b_code}
                                                    </small>
                                                </td>
                                                <td>
                                                    <div>{formatDate(item.match_date)}</div>
                                                    {item.match_time && (
                                                        <small className="text-muted">{formatTime(item.match_time)}</small>
                                                    )}
                                                </td>
                                                <td style={{ maxWidth: "220px" }}>
                                                    {item.ground_name && item.ground_id ? (
                                                        <button
                                                            type="button"
                                                            className="btn btn-link p-0 text-start text-decoration-none"
                                                            onClick={() => setGroundDetailsId(item.ground_id)}
                                                            aria-label={`View details for ${item.ground_name}`}
                                                        >
                                                            <MapPin size={14} className="me-1 text-muted" />{item.ground_name}
                                                        </button>
                                                    ) : (
                                                        "—"
                                                    )}
                                                    {item.booking_no && (
                                                        <small className="text-muted d-block">Booking {item.booking_no}</small>
                                                    )}
                                                </td>
                                                <td>
                                                    {item.toss_winner_team_name ? (
                                                        <>
                                                            <div>{item.toss_winner_team_name}</div>
                                                            {item.toss_decision && (
                                                                <small className="text-muted">elected to {item.toss_decision}</small>
                                                            )}
                                                        </>
                                                    ) : (
                                                        "—"
                                                    )}
                                                </td>
                                                <td>
                                                    <span className={`badge ${STATUS_BADGE[item.status] || "bg-secondary"}`}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="d-flex justify-content-start gap-2">
                                                        <Link
                                                            href={`/next_panel/matches/${item.id}/scorecard`}
                                                            className="btn btn-outline-primary"
                                                            title="Match Scorecard Center"
                                                            aria-label="Scorecard"
                                                        >
                                                            <Trophy size={16} />
                                                        </Link>
                                                        {item.status === "Cancelled" ? (
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-secondary"
                                                                disabled
                                                                title="Cancelled matches cannot be edited"
                                                                aria-label="Edit match disabled"
                                                            >
                                                                <Edit size={16} />
                                                            </button>
                                                        ) : (
                                                            <Link
                                                                href={`/next_panel/matches/${item.id}/edit`}
                                                                className="btn btn-outline-secondary"
                                                                aria-label="Edit match"
                                                            >
                                                                <Edit size={16} />
                                                            </Link>
                                                        )}
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger"
                                                            onClick={() => handleCancel(item)}
                                                            disabled={closed}
                                                            title={closed ? `A ${item.status.toLowerCase()} match cannot be cancelled` : "Cancel match"}
                                                            aria-label="Cancel match"
                                                        >
                                                            <Ban size={16} />
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
            {groundDetailsId && <GroundDetailsModal groundId={groundDetailsId} onClose={() => setGroundDetailsId(null)} />}
        </div>
    );
}
