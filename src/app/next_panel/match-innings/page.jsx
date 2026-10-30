"use client";

import {
    ArrowLeft,
    CheckCircle2,
    Clock,
    Edit,
    Layers,
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
    INNINGS_STATUS_BADGE,
    INNINGS_STATUSES,
    formatDate,
} from "../components/cricketHelpers";
import Pagination from "../components/Pagination";

export default function MatchInningsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [inningsList, setInningsList] = useState([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const [matches, setMatches] = useState([]);

    // Filters
    const [search, setSearch] = useState("");
    const [matchId, setMatchId] = useState("");
    const [status, setStatus] = useState("");
    const [reload, setReload] = useState(0);

    // Fetch matches for the dropdown filter
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

    // Fetch innings
    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (matchId) params.set("match_id", matchId);
                if (status) params.set("innings_status", status);

                const query = params.toString();
                const res = await fetch(`/api/match-innings${query ? `?${query}` : ""}`, {
                    signal: controller.signal,
                });
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Unable to load match innings.");
                }
                setInningsList(json.data || []);
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
    }, [matchId, status, reload]);

    // Client-side text filter
    const needle = search.trim().toLowerCase();
    const visibleInnings = useMemo(() => {
        if (!needle) return inningsList;
        return inningsList.filter((item) =>
            [
                item.batting_team_name,
                item.bowling_team_name,
                item.match_type,
                `match #${item.match_id}`,
                `innings ${item.innings_no}`,
            ]
                .filter(Boolean)
                .some((val) => String(val).toLowerCase().includes(needle))
        );
    }, [inningsList, needle]);

    useEffect(() => {
        setPage(1);
    }, [search, matchId, status]);

    const totalPages = Math.ceil(visibleInnings.length / PAGE_SIZE) || 1;
    const pagedInnings = visibleInnings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleClear = (e) => {
        e.preventDefault();
        setSearch("");
        setMatchId("");
        setStatus("");
    };

    const handleDelete = async (item) => {
        const desc = `Innings ${item.innings_no} (${item.batting_team_name} vs ${item.bowling_team_name})`;
        if (!confirm(`Are you sure you want to delete ${desc}? Linked scorecard records must be removed first.`)) {
            return;
        }
        setError(null);
        setNotice(null);
        try {
            const res = await fetch(`/api/match-innings/${item.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to delete match innings.");
            }
            setNotice(`${desc} deleted successfully.`);
            setReload((n) => n + 1);
        } catch (err) {
            setError(err.message);
        }
    };

    // Calculate quick stats
    const stats = useMemo(() => {
        const total = inningsList.length;
        const inProgress = inningsList.filter((i) => i.innings_status === "In Progress").length;
        const completed = inningsList.filter((i) => i.innings_status === "Completed").length;
        const totalRuns = inningsList.reduce((acc, i) => acc + (Number(i.total_runs) || 0), 0);
        return { total, inProgress, completed, totalRuns };
    }, [inningsList]);

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
                                    <Layers className="text-primary" /> Match Innings
                                </h3>
                                <p className="text-muted mb-0">
                                    Track match innings, team scores, overs, wickets, extras, and target runs.
                                </p>
                            </div>
                            <div className="d-flex gap-2">
                                <Link
                                    href={`/next_panel/match-innings/new${matchId ? `?match_id=${matchId}` : ""}`}
                                    className="btn btn-primary px-3"
                                >
                                    <PlusCircle size={18} className="me-1" /> Add Innings
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="col-12">
                    <div className="row g-3">
                        <div className="col-6 col-md-3">
                            <div className="bg-white p-3 rounded-4 shadow-sm border-start border-primary border-4">
                                <div className="text-muted small">Total Innings</div>
                                <div className="fs-4 fw-bold">{stats.total}</div>
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <div className="bg-white p-3 rounded-4 shadow-sm border-start border-warning border-4">
                                <div className="text-muted small">In Progress</div>
                                <div className="fs-4 fw-bold text-warning">{stats.inProgress}</div>
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <div className="bg-white p-3 rounded-4 shadow-sm border-start border-success border-4">
                                <div className="text-muted small">Completed</div>
                                <div className="fs-4 fw-bold text-success">{stats.completed}</div>
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <div className="bg-white p-3 rounded-4 shadow-sm border-start border-info border-4">
                                <div className="text-muted small">Total Runs Scored</div>
                                <div className="fs-4 fw-bold text-info">{stats.totalRuns}</div>
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
                                placeholder="Search teams, match..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <select
                            className="form-select"
                            style={{ maxWidth: "260px" }}
                            value={matchId}
                            onChange={(e) => setMatchId(e.target.value)}
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
                            style={{ maxWidth: "180px" }}
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                        >
                            <option value="">All Statuses</option>
                            {INNINGS_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                    {st}
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

                {/* Innings Table */}
                <div className="col-12">
                    {error && <div className="alert alert-danger">{error}</div>}
                    {notice && <div className="alert alert-success">{notice}</div>}

                    {loading ? (
                        <div className="text-center py-5 text-muted bg-white rounded-4 shadow-sm">
                            <Clock className="spinner-border spinner-border-sm me-2" />
                            Loading match innings...
                        </div>
                    ) : visibleInnings.length === 0 ? (
                        <div className="text-center py-5 text-muted bg-white rounded-4 shadow-sm">
                            <p className="mb-2">No match innings found.</p>
                            <Link
                                href={`/next_panel/match-innings/new${matchId ? `?match_id=${matchId}` : ""}`}
                                className="btn btn-sm btn-primary"
                            >
                                <PlusCircle size={16} className="me-1" /> Create the first innings
                            </Link>
                        </div>
                    ) : (
                        <div className="table-responsive bg-white rounded-4 shadow-sm p-3">
                            <table className="table align-middle table-hover mb-0">
                                <thead className="table-success">
                                    <tr>
                                        <th>Innings</th>
                                        <th>Match &amp; Date</th>
                                        <th>Batting Team</th>
                                        <th>Bowling Team</th>
                                        <th>Score</th>
                                        <th>Extras</th>
                                        <th>Target</th>
                                        <th>Status</th>
                                        <th className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedInnings.map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 fs-6">
                                                    Innings {item.innings_no}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="fw-semibold">
                                                    Match #{item.match_id}
                                                </div>
                                                <small className="text-muted d-block">
                                                    {formatDate(item.match_date)} · {item.match_type}
                                                </small>
                                            </td>
                                            <td>
                                                <span className="fw-semibold text-dark">
                                                    {item.batting_team_name}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="text-secondary">
                                                    {item.bowling_team_name}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="fs-6 fw-bold">
                                                    {item.total_runs}/{item.total_wickets}
                                                </div>
                                                <small className="text-muted">
                                                    {item.total_overs} ov ({item.total_balls} balls)
                                                </small>
                                            </td>
                                            <td>
                                                <span className="fw-medium">{item.extras}</span>
                                                <small className="text-muted d-block" style={{ fontSize: "0.75rem" }}>
                                                    w:{item.wides} nb:{item.no_balls} b:{item.byes} lb:{item.leg_byes}
                                                </small>
                                            </td>
                                            <td>
                                                {item.target_runs !== null && item.target_runs !== undefined ? (
                                                    <span className="badge bg-info-subtle text-info border">
                                                        {item.target_runs} runs
                                                    </span>
                                                ) : (
                                                    "—"
                                                )}
                                            </td>
                                            <td>
                                                <span
                                                    className={`badge ${
                                                        INNINGS_STATUS_BADGE[item.innings_status] || "bg-secondary"
                                                    }`}
                                                >
                                                    {item.innings_status}
                                                </span>
                                            </td>
                                            <td className="text-end">
                                                <div className="d-flex justify-content-end gap-2">
                                                    <Link
                                                        href={`/next_panel/matches/${item.match_id}/scorecard?innings_id=${item.id}`}
                                                        className="btn btn-sm btn-outline-primary"
                                                        title="Full Match Scorecard"
                                                    >
                                                        <Trophy size={14} className="me-1" /> Scorecard
                                                    </Link>
                                                    <Link
                                                        href={`/next_panel/match-innings/${item.id}/edit`}
                                                        className="btn btn-sm btn-outline-secondary"
                                                        title="Edit Innings"
                                                    >
                                                        <Edit size={14} />
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger"
                                                        onClick={() => handleDelete(item)}
                                                        title="Delete Innings"
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
                            total={visibleInnings.length}
                            onPageChange={setPage}
                            pageSize={PAGE_SIZE}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
