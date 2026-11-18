"use client";

import { ArrowBigLeft, ArrowLeft, Ban, Edit, MapPin, Search, SearchSlash, Swords, Trophy } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import GroundDetailsModal from "../components/GroundDetailsModal";
import Pagination from "../components/Pagination";
import { useUser } from "../components/UserContext";

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

const isPastMatch = (dateStr) => {
    if (!dateStr) return false;
    const d = String(dateStr).slice(0, 10);
    let todayIST = "";
    try {
        todayIST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    } catch {
        todayIST = "";
    }
    const todayLocal = new Date().toLocaleDateString("en-CA");
    const cmpDate = todayIST || todayLocal;
    return Boolean(d && cmpDate && d < cmpDate);
};

const getEffectiveStatus = (item) => {
    const raw = String(item?.status || "").trim();
    const lower = raw.toLowerCase();
    if (lower === "cancelled") {
        return "Cancelled";
    }
    if (lower === "completed") {
        return "Completed";
    }
    if (isTodayMatch(item?.match_date)) {
        return "Live";
    }
    if (isPastMatch(item?.match_date)) {
        return "Completed";
    }
    return raw || "Scheduled";
};

export default function MatchesPage() {
    const { user } = useUser();
    const isUmpire = Boolean(
        user?.isUmpire ||
        String(user?.user_type || user?.role || user?.role_name || "").toLowerCase().includes("umpire")
    );
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [matches, setMatches] = useState([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
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
            setPage(1);
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

    const totalPages = Math.ceil(matches.length / PAGE_SIZE) || 1;
    const pagedMatches = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
        <div className="container-fluid">
            <div className="row g-3">
                {/* Header */}
                <div className="col-sm-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center gap-3">
                            <div>
                                {!isUmpire ? (
                                    <Link href="match-management" className="btn btn-sm btn-outline-secondary mb-3">
                                        <ArrowLeft size={16} className="me-2"/> Back to match management
                                    </Link>
                                ) : (
                                    <Link href="/next_panel/dashboard" className="btn btn-sm btn-outline-secondary mb-3">
                                        <ArrowLeft size={16} className="me-2"/> Back to Dashboard
                                    </Link>
                                )}
                                <h3 className="mb-0"><Swords /> {isUmpire ? "My Assigned Matches" : "Matches"}</h3>
                                <p className="text-muted mb-0">
                                    {isUmpire
                                        ? "View matches assigned to you, your fee remuneration status, and access live match scorecards."
                                        : "Schedule matches, set venues, and record toss details."}
                                </p>
                            </div>
                            {!isUmpire && (
                                <Link href="/next_panel/matches/new" className="btn btn-primary px-4">
                                    <Swords size={18} /> Add Match
                                </Link>
                            )}
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
                        <>
                        <div className="table-responsive">
                            <table className="table align-middle mb-0">
                                <thead className="table-success">
                                    <tr>
                                        <th>#</th>
                                        <th>Match</th>
                                        <th>Teams</th>
                                        <th>Date &amp; Time</th>
                                        <th>Venue</th>
                                        {isUmpire ? <th>Umpire Fee &amp; Status</th> : <th>Toss</th>}
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedMatches.map((item, idx) => {
                                        const effStatus = getEffectiveStatus(item);
                                        const closed = effStatus === "Completed" || effStatus === "Cancelled";
                                        const isPast = isPastMatch(item.match_date);
                                        const hasScoreboard = item.has_scoreboard !== undefined
                                            ? Boolean(item.has_scoreboard)
                                            : (Number(item.innings_count) > 0 || Number(item.scorecard_count) > 0 || Boolean(item.team_a_score || item.team_b_score));
                                        const showWaitNotice = (effStatus === "Completed" || isPast) && !hasScoreboard;
                                        return (
                                            <tr key={item.id}>
                                                <th>{(page - 1) * PAGE_SIZE + idx + 1}</th>
                                                <td>
                                                    <div>{item.match_no || `Match #${item.id}`}</div>
                                                    <span className="badge text-bg-light border">{item.match_type}</span>
                                                    {item.overs && (
                                                        <span className="badge bg-secondary ms-1">{item.overs} Ov</span>
                                                    )}
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
                                                    {(item.team_a_score || item.team_b_score) ? (
                                                        <div className="small text-primary mt-1">
                                                            {item.team_a_score && <span>{item.team_a_code}: {item.team_a_score}</span>}
                                                            {item.team_a_score && item.team_b_score && <span className="mx-1">|</span>}
                                                            {item.team_b_score && <span>{item.team_b_code}: {item.team_b_score}</span>}
                                                        </div>
                                                    ) : showWaitNotice ? (
                                                        <div className="mt-1">
                                                            <span className="badge bg-warning text-dark border border-warning-subtle">
                                                                Wait to update records
                                                            </span>
                                                        </div>
                                                    ) : null}
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
                                                {isUmpire ? (
                                                    <td>
                                                        <div className="fw-semibold text-dark">
                                                            ₹{Number(item.umpire_match_fee || item.umpire_booking_fee || 0).toLocaleString("en-IN")}
                                                        </div>
                                                        <div className="d-flex flex-wrap align-items-center gap-1 mt-1">
                                                            {(() => {
                                                                const pStatus = item.umpire_payment_status || "Pending";
                                                                const isPaid = pStatus.toLowerCase() === "paid";
                                                                const isPartial = pStatus.toLowerCase() === "partial";
                                                                const badgeCls = isPaid
                                                                    ? "bg-success-subtle text-success border border-success-subtle"
                                                                    : isPartial
                                                                    ? "bg-info-subtle text-info border border-info-subtle"
                                                                    : "bg-warning-subtle text-warning border border-warning-subtle";
                                                                return (
                                                                    <span className={`badge ${badgeCls}`}>
                                                                        {pStatus}
                                                                    </span>
                                                                );
                                                            })()}
                                                            {item.umpire_role && (
                                                                <span className="badge bg-light text-secondary border">
                                                                    {item.umpire_role}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                ) : (
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
                                                )}
                                                <td>
                                                    <span className={`badge ${STATUS_BADGE[effStatus] || "bg-secondary"} ${effStatus === 'Live' ? 'd-inline-flex align-items-center gap-1' : ''}`}>
                                                        {effStatus === 'Live' && <span className="spinner-grow spinner-grow-sm" style={{ width: "6px", height: "6px" }} />}
                                                        {effStatus}
                                                    </span>
                                                    {showWaitNotice && (
                                                        <div className="mt-1">
                                                            <span className="badge bg-warning text-dark border border-warning-subtle">
                                                                Wait to update records
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="d-flex justify-content-start gap-2">
                                                        <Link
                                                            href={`/next_panel/matches/${item.id}/scorecard`}
                                                            className={`btn ${showWaitNotice ? "btn-warning text-dark" : "btn-outline-primary"}`}
                                                            title={showWaitNotice ? "Scorecard pending - Wait to update records" : "Match Scorecard Center"}
                                                            aria-label="Scorecard"
                                                        >
                                                            <Trophy size={16} />
                                                        </Link>
                                                        {!isUmpire && (
                                                            <>
                                                                {effStatus === "Cancelled" ? (
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
                                                                    title={closed ? `A ${effStatus.toLowerCase()} match cannot be cancelled` : "Cancel match"}
                                                                    aria-label="Cancel match"
                                                                >
                                                                    <Ban size={16} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <Pagination
                            page={page}
                            totalPages={totalPages}
                            total={matches.length}
                            onPageChange={setPage}
                            pageSize={PAGE_SIZE}
                        />
                        </>
                    )}
                </div>
            </div>
            {groundDetailsId && <GroundDetailsModal groundId={groundDetailsId} onClose={() => setGroundDetailsId(null)} />}
        </div>
    );
}
