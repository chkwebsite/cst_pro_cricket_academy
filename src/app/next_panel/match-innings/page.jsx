"use client";

import {
    ArrowLeft,
    Check,
    Clock,
    FileText,
    Pencil,
    Plus,
    RotateCcw,
    Search,
    Trash2,
    X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Pagination from "../components/Pagination";

// Date formatter: "01 Nov 2026"
function formatMatchHeaderDate(value) {
    if (!value) return "—";
    try {
        const str = String(value).slice(0, 10);
        const [y, m, d] = str.split("-");
        if (y && m && d) {
            const dateObj = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
            const day = String(d).padStart(2, "0");
            const monthStr = dateObj.toLocaleDateString("en-US", {
                month: "short",
                timeZone: "UTC",
            });
            return `${day} ${monthStr} ${y}`;
        }
        return str;
    } catch {
        return String(value).slice(0, 10);
    }
}

// Compute match result text dynamically or from remarks
function getMatchResultText(match, innings) {
    if (match.match_remarks) {
        return match.match_remarks;
    }
    if (match.remarks) {
        return match.remarks;
    }

    const inn1 = innings.find((i) => Number(i.innings_no) === 1);
    const inn2 = innings.find((i) => Number(i.innings_no) === 2);

    if (inn1 && inn2) {
        const r1 = Number(inn1.total_runs) || 0;
        const r2 = Number(inn2.total_runs) || 0;
        const w2 = Number(inn2.total_wickets) || 0;
        const target = inn2.target_runs ? Number(inn2.target_runs) : r1 + 1;

        if (r2 >= target) {
            const wicketsRemaining = Math.max(0, 10 - w2);
            return `${inn2.batting_team_name} won by ${wicketsRemaining} wicket${wicketsRemaining === 1 ? "" : "s"}`;
        }

        const isCompleted =
            inn2.innings_status === "Completed" ||
            match.match_status === "Completed" ||
            match.status === "Completed";

        if (isCompleted) {
            if (r1 > r2) {
                const margin = r1 - r2;
                return `${inn1.batting_team_name} won by ${margin} run${margin === 1 ? "" : "s"}`;
            }
            if (r1 === r2) {
                return "Match tied";
            }
        }

        if (inn2.innings_status === "In Progress") {
            const needed = target - r2;
            return `${inn2.batting_team_name} need ${needed} runs`;
        }
    } else if (inn1) {
        if (inn1.innings_status === "In Progress") {
            return `${inn1.batting_team_name} batting`;
        }
        return `${inn1.batting_team_name}: ${inn1.total_runs}/${inn1.total_wickets}`;
    }

    return "";
}

// Determine correct match status badge
function getMatchStatusBadge(match, innings) {
    const rawStatus = String(match.match_status || "").trim().toLowerCase();

    // If both innings are completed or scores/result exist, match is Completed
    const allInningsCompleted =
        innings.length > 0 &&
        innings.every((i) => i.innings_status === "Completed");

    if (rawStatus === "completed" || allInningsCompleted) {
        return {
            label: "Completed",
            icon: <Check size={13} strokeWidth={2.5} />,
            bg: "#dcfce7",
            color: "#15803d",
        };
    }

    if (rawStatus === "live" || rawStatus === "in progress") {
        return {
            label: "Live",
            icon: (
                <span
                    style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        backgroundColor: "#d97706",
                        display: "inline-block",
                    }}
                />
            ),
            bg: "#fef3c7",
            color: "#b45309",
        };
    }

    if (rawStatus === "cancelled") {
        return {
            label: "Cancelled",
            icon: <X size={13} strokeWidth={2.5} />,
            bg: "#fee2e2",
            color: "#b91c1c",
        };
    }

    if (rawStatus === "postponed") {
        return {
            label: "Postponed",
            icon: null,
            bg: "#ffedd5",
            color: "#c2410c",
        };
    }

    return {
        label: match.match_status || "Scheduled",
        icon: null,
        bg: "#f1f5f9",
        color: "#475569",
    };
}

// Badge style for match type pill (Friendly, Practice, etc.)
function getMatchTypeBadgeStyle(type) {
    const t = String(type || "").toLowerCase();
    if (t === "friendly") {
        return {
            backgroundColor: "#d1eadc",
            color: "#166534",
        };
    }
    if (t === "practice") {
        return {
            backgroundColor: "#fef3c7",
            color: "#92400e",
        };
    }
    if (t === "tournament" || t === "league") {
        return {
            backgroundColor: "#e0e7ff",
            color: "#3730a3",
        };
    }
    return {
        backgroundColor: "#f1f5f9",
        color: "#475569",
    };
}

export default function MatchInningsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [inningsList, setInningsList] = useState([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    // Filters
    const [selectedType, setSelectedType] = useState("ALL");
    const [search, setSearch] = useState("");
    const [reload, setReload] = useState(0);

    // Fetch innings
    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch("/api/match-innings", {
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
        }, 200);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [reload]);

    // Group innings by match
    const groupedMatches = useMemo(() => {
        const map = new Map();
        for (const item of inningsList) {
            const mId = item.match_id;
            if (!map.has(mId)) {
                map.set(mId, {
                    match_id: mId,
                    match_no: item.match_no,
                    match_date: item.match_date,
                    match_type: item.match_type,
                    match_status: item.match_status,
                    match_remarks: item.match_remarks,
                    innings: [],
                });
            }
            map.get(mId).innings.push(item);
        }

        // Sort innings inside each match by innings_no
        for (const m of map.values()) {
            m.innings.sort((a, b) => Number(a.innings_no) - Number(b.innings_no));
        }

        return Array.from(map.values());
    }, [inningsList]);

    // Available match types for filter pills
    const availableTypes = useMemo(() => {
        const types = new Set(["Friendly", "Practice"]);
        for (const m of groupedMatches) {
            if (m.match_type) types.add(m.match_type);
        }
        return Array.from(types);
    }, [groupedMatches]);

    // Filtered matches by type and search query
    const filteredMatches = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return groupedMatches.filter((m) => {
            if (selectedType !== "ALL") {
                if (String(m.match_type || "").toLowerCase() !== selectedType.toLowerCase()) {
                    return false;
                }
            }

            if (!needle) return true;

            const matchStr = `match #${m.match_no || m.match_id}`.toLowerCase();
            const typeStr = String(m.match_type || "").toLowerCase();
            const dateStr = formatMatchHeaderDate(m.match_date).toLowerCase();
            const remarksStr = String(m.match_remarks || "").toLowerCase();
            const teamFound = m.innings.some((inn) =>
                [inn.batting_team_name, inn.bowling_team_name]
                    .filter(Boolean)
                    .some((t) => String(t).toLowerCase().includes(needle))
            );

            return (
                matchStr.includes(needle) ||
                typeStr.includes(needle) ||
                dateStr.includes(needle) ||
                remarksStr.includes(needle) ||
                teamFound
            );
        });
    }, [groupedMatches, selectedType, search]);

    const handleTypeSelect = (type) => {
        setSelectedType(type);
        setPage(1);
    };

    const handleSearchChange = (val) => {
        setSearch(val);
        setPage(1);
    };

    // Total counts based on filtered matches
    const totalFilteredInningsCount = useMemo(() => {
        return filteredMatches.reduce((acc, m) => acc + m.innings.length, 0);
    }, [filteredMatches]);

    const totalPages = Math.ceil(filteredMatches.length / PAGE_SIZE) || 1;
    const pagedMatches = filteredMatches.slice(
        (page - 1) * PAGE_SIZE,
        page * PAGE_SIZE
    );

    const handleDelete = async (item) => {
        const desc = `Innings ${item.innings_no} (${item.batting_team_name} vs ${item.bowling_team_name})`;
        if (
            !confirm(
                `Are you sure you want to delete ${desc}? Linked scorecard records must be removed first.`
            )
        ) {
            return;
        }
        setError(null);
        setNotice(null);
        try {
            const res = await fetch(`/api/match-innings/${item.id}`, {
                method: "DELETE",
            });
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

    return (
        <div className="w-100 pb-4">
            {/* Top Header & Filter Pills */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                    <h1
                        className="fw-bold mb-1"
                        style={{
                            fontSize: "1.9rem",
                            color: "#0f172a",
                            letterSpacing: "-0.02em",
                        }}
                    >
                        Innings
                    </h1>
                    <div style={{ color: "#64748b", fontSize: "0.875rem" }}>
                        {filteredMatches.length}{" "}
                        {filteredMatches.length === 1 ? "match" : "matches"} ·{" "}
                        {totalFilteredInningsCount}{" "}
                        {totalFilteredInningsCount === 1 ? "innings" : "innings"}
                    </div>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2">
                    {/* All matches pill */}
                    <button
                        type="button"
                        onClick={() => handleTypeSelect("ALL")}
                        className="btn btn-sm rounded-pill"
                        style={{
                            backgroundColor: selectedType === "ALL" ? "#0e5f59" : "#ffffff",
                            color: selectedType === "ALL" ? "#ffffff" : "#334155",
                            border: selectedType === "ALL" ? "none" : "1px solid #e2e8f0",
                            padding: "7px 20px",
                            fontSize: "0.85rem",
                            fontWeight: 500,
                            boxShadow: "none",
                            transition: "all 0.15s ease",
                        }}
                    >
                        All matches
                    </button>

                    {/* Match Type Pills (Friendly, Practice, etc.) */}
                    {availableTypes.map((type) => {
                        const isSelected =
                            selectedType.toLowerCase() === type.toLowerCase();
                        return (
                            <button
                                key={type}
                                type="button"
                                onClick={() => handleTypeSelect(type)}
                                className="btn btn-sm rounded-pill"
                                style={{
                                    backgroundColor: isSelected ? "#0e5f59" : "#ffffff",
                                    color: isSelected ? "#ffffff" : "#334155",
                                    border: isSelected ? "none" : "1px solid #e2e8f0",
                                    padding: "7px 18px",
                                    fontSize: "0.85rem",
                                    fontWeight: 500,
                                    boxShadow: "none",
                                    transition: "all 0.15s ease",
                                }}
                            >
                                {type}
                            </button>
                        );
                    })}

                    {/* Add Innings Action */}
                    <Link
                        href="/next_panel/match-innings/new"
                        className="btn btn-sm rounded-pill ms-2 d-inline-flex align-items-center gap-1.5"
                        style={{
                            backgroundColor: "#062f38",
                            color: "#ffffff",
                            padding: "7px 18px",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            boxShadow: "none",
                        }}
                    >
                        <Plus size={16} /> Add Innings
                    </Link>
                </div>
            </div>

            {/* Quick search and back navigation */}
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                <Link
                    href="/next_panel/match-management"
                    className="text-muted text-decoration-none d-inline-flex align-items-center gap-1"
                    style={{ fontSize: "0.825rem", fontWeight: 500 }}
                >
                    <ArrowLeft size={14} /> Back to Match Management
                </Link>

                <div className="d-flex align-items-center gap-2">
                    <div className="input-group input-group-sm" style={{ width: "220px" }}>
                        <span className="input-group-text bg-white border-end-0 text-muted">
                            <Search size={14} />
                        </span>
                        <input
                            type="text"
                            className="form-control border-start-0 ps-0"
                            placeholder="Search team or match..."
                            value={search}
                            onChange={(e) => handleSearchChange(e.target.value)}
                        />
                        {search && (
                            <button
                                className="btn btn-white border border-start-0 text-muted"
                                type="button"
                                onClick={() => handleSearchChange("")}
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setReload((n) => n + 1)}
                        title="Refresh"
                        style={{ borderRadius: "8px" }}
                    >
                        <RotateCcw size={14} />
                    </button>
                </div>
            </div>

            {/* Alerts */}
            {error && (
                <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
                    {error}
                    <button
                        type="button"
                        className="btn-close"
                        onClick={() => setError(null)}
                    ></button>
                </div>
            )}
            {notice && (
                <div className="alert alert-success alert-dismissible fade show mb-4" role="alert">
                    {notice}
                    <button
                        type="button"
                        className="btn-close"
                        onClick={() => setNotice(null)}
                    ></button>
                </div>
            )}

            {/* Main Content Area */}
            {loading ? (
                <div
                    className="text-center py-5 bg-white text-muted shadow-sm"
                    style={{ borderRadius: "14px" }}
                >
                    <Clock className="spinner-border spinner-border-sm me-2" />
                    Loading match innings...
                </div>
            ) : filteredMatches.length === 0 ? (
                <div
                    className="text-center py-5 bg-white text-muted shadow-sm"
                    style={{ borderRadius: "14px" }}
                >
                    <p className="mb-2 fs-6">No match innings found.</p>
                    <Link
                        href="/next_panel/match-innings/new"
                        className="btn btn-sm text-white"
                        style={{
                            backgroundColor: "#062f38",
                            borderRadius: "8px",
                            padding: "6px 16px",
                        }}
                    >
                        <Plus size={16} className="me-1" /> Create the first innings
                    </Link>
                </div>
            ) : (
                <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                    <div style={{ minWidth: "860px" }}>
                        {/* Table Header Labels */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns:
                                    "85px minmax(160px, 1.8fr) 85px 85px 125px 85px 170px",
                                gap: "12px",
                                padding: "0 20px",
                                marginBottom: "10px",
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                color: "#64748b",
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                            }}
                        >
                            <div>INNINGS</div>
                            <div>BATTING VS BOWLING</div>
                            <div>SCORE</div>
                            <div>OVERS</div>
                            <div>EXTRAS</div>
                            <div>TARGET</div>
                            <div className="text-end">ACTIONS</div>
                        </div>

                        {/* Match Cards */}
                        {pagedMatches.map((group) => {
                            const resultText = getMatchResultText(group, group.innings);
                            const statusInfo = getMatchStatusBadge(group, group.innings);

                            return (
                                <div
                                    key={group.match_id}
                                    className="bg-white mb-4"
                                    style={{
                                        borderRadius: "14px",
                                        border: "1px solid #e5e7eb",
                                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
                                        overflow: "hidden",
                                    }}
                                >
                                    {/* Match Card Header Banner */}
                                    <div
                                        className="d-flex flex-wrap align-items-center justify-content-between gap-2"
                                        style={{
                                            backgroundColor: "#e8f3ee",
                                            padding: "10px 20px",
                                            borderBottom: "1px solid rgba(0, 0, 0, 0.03)",
                                        }}
                                    >
                                        {/* Left Side: Match #, Match Type Badge, Date */}
                                        <div className="d-flex align-items-center gap-2 flex-wrap">
                                            <span
                                                style={{
                                                    fontSize: "0.95rem",
                                                    fontWeight: 700,
                                                    color: "#0f172a",
                                                }}
                                            >
                                                Match #{group.match_no || group.match_id}
                                            </span>

                                            {group.match_type && (
                                                <span
                                                    className="badge rounded-pill"
                                                    style={{
                                                        ...getMatchTypeBadgeStyle(group.match_type),
                                                        fontSize: "0.72rem",
                                                        fontWeight: 600,
                                                        padding: "3px 10px",
                                                    }}
                                                >
                                                    {group.match_type}
                                                </span>
                                            )}

                                            <span
                                                style={{
                                                    fontSize: "0.825rem",
                                                    color: "#64748b",
                                                    fontWeight: 500,
                                                }}
                                            >
                                                {formatMatchHeaderDate(group.match_date)}
                                            </span>
                                        </div>

                                        {/* Right Side: Result text, Status Badge */}
                                        <div className="d-flex align-items-center gap-3 flex-wrap">
                                            {resultText && (
                                                <span
                                                    style={{
                                                        fontSize: "0.875rem",
                                                        fontWeight: 600,
                                                        color: "#1e293b",
                                                    }}
                                                >
                                                    {resultText}
                                                </span>
                                            )}

                                            <span
                                                className="badge rounded-pill d-inline-flex align-items-center gap-1"
                                                style={{
                                                    backgroundColor: statusInfo.bg,
                                                    color: statusInfo.color,
                                                    fontSize: "0.78rem",
                                                    fontWeight: 600,
                                                    padding: "4px 12px",
                                                }}
                                            >
                                                {statusInfo.icon}
                                                <span>{statusInfo.label}</span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Innings Rows */}
                                    {group.innings.map((item, idx) => (
                                        <div
                                            key={item.id}
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns:
                                                    "85px minmax(160px, 1.8fr) 85px 85px 125px 85px 170px",
                                                gap: "12px",
                                                alignItems: "center",
                                                padding: "16px 20px",
                                                borderTop: idx > 0 ? "1px solid #f1f5f9" : "none",
                                            }}
                                        >
                                            {/* Col 1: Innings Badge */}
                                            <div>
                                                <span
                                                    className="badge rounded-pill"
                                                    style={{
                                                        backgroundColor: "#e0edff",
                                                        color: "#2563eb",
                                                        fontWeight: 600,
                                                        fontSize: "0.75rem",
                                                        padding: "4px 10px",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    Innings {item.innings_no}
                                                </span>
                                            </div>

                                            {/* Col 2: Batting vs Bowling */}
                                            <div>
                                                <div
                                                    style={{
                                                        fontWeight: 700,
                                                        color: "#0f172a",
                                                        fontSize: "0.92rem",
                                                        lineHeight: 1.25,
                                                    }}
                                                >
                                                    {item.batting_team_name}
                                                </div>
                                                <div
                                                    style={{
                                                        color: "#64748b",
                                                        fontSize: "0.78rem",
                                                        marginTop: "2px",
                                                    }}
                                                >
                                                    vs {item.bowling_team_name}
                                                </div>
                                            </div>

                                            {/* Col 3: Score */}
                                            <div>
                                                <div
                                                    style={{
                                                        fontSize: "1.3rem",
                                                        fontWeight: 800,
                                                        color: "#0f172a",
                                                        letterSpacing: "-0.02em",
                                                        lineHeight: 1.1,
                                                    }}
                                                >
                                                    {item.total_runs}/{item.total_wickets}
                                                </div>
                                            </div>

                                            {/* Col 4: Overs */}
                                            <div>
                                                <div
                                                    style={{
                                                        fontWeight: 700,
                                                        color: "#0f172a",
                                                        fontSize: "0.9rem",
                                                    }}
                                                >
                                                    {Number(item.total_overs || 0).toFixed(1)} ov
                                                </div>
                                                <div
                                                    style={{
                                                        color: "#64748b",
                                                        fontSize: "0.75rem",
                                                        marginTop: "1px",
                                                    }}
                                                >
                                                    {item.total_balls || 0} balls
                                                </div>
                                            </div>

                                            {/* Col 5: Extras */}
                                            <div>
                                                <div
                                                    style={{
                                                        fontWeight: 700,
                                                        color: "#0f172a",
                                                        fontSize: "0.9rem",
                                                    }}
                                                >
                                                    {item.extras || 0}
                                                </div>
                                                <div
                                                    style={{
                                                        color: "#64748b",
                                                        fontSize: "0.73rem",
                                                        marginTop: "1px",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    w {item.wides ?? 0} · nb {item.no_balls ?? 0} · b {item.byes ?? 0} · lb {item.leg_byes ?? 0}
                                                </div>
                                            </div>

                                            {/* Col 6: Target */}
                                            <div>
                                                {item.target_runs ? (
                                                    <span
                                                        className="badge rounded-pill"
                                                        style={{
                                                            backgroundColor: "#e0f2fe",
                                                            color: "#0284c7",
                                                            fontWeight: 600,
                                                            fontSize: "0.75rem",
                                                            padding: "4px 12px",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        {item.target_runs} runs
                                                    </span>
                                                ) : (
                                                    <span style={{ color: "#94a3b8", fontSize: "1.1rem" }}>
                                                        —
                                                    </span>
                                                )}
                                            </div>

                                            {/* Col 7: Actions */}
                                            <div
                                                className="d-flex align-items-center justify-content-end gap-1.5"
                                                style={{ flexShrink: 0, whiteSpace: "nowrap" }}
                                            >
                                                <Link
                                                    href={`/next_panel/matches/${item.match_id}/scorecard?innings_id=${item.id}`}
                                                    className="btn btn-sm d-inline-flex align-items-center gap-1.5"
                                                    style={{
                                                        backgroundColor: "#ffffff",
                                                        border: "1px solid #cbd5e1",
                                                        borderRadius: "8px",
                                                        padding: "5px 12px",
                                                        color: "#334155",
                                                        fontWeight: 600,
                                                        fontSize: "0.8rem",
                                                        whiteSpace: "nowrap",
                                                        flexShrink: 0,
                                                        transition: "all 0.15s ease",
                                                    }}
                                                    title="Full Match Scorecard"
                                                >
                                                    <FileText size={14} style={{ color: "#475569" }} />
                                                    <span>Scorecard</span>
                                                </Link>
                                                <Link
                                                    href={`/next_panel/match-innings/${item.id}/edit`}
                                                    className="btn btn-sm d-inline-flex align-items-center justify-content-center"
                                                    style={{
                                                        backgroundColor: "#ffffff",
                                                        border: "1px solid #cbd5e1",
                                                        borderRadius: "8px",
                                                        width: "32px",
                                                        height: "32px",
                                                        minWidth: "32px",
                                                        flexShrink: 0,
                                                        padding: 0,
                                                        color: "#475569",
                                                        transition: "all 0.15s ease",
                                                    }}
                                                    title="Edit Innings"
                                                >
                                                    <Pencil size={13} />
                                                </Link>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm d-inline-flex align-items-center justify-content-center"
                                                    style={{
                                                        backgroundColor: "#ffffff",
                                                        border: "1px solid #fecdd3",
                                                        borderRadius: "8px",
                                                        width: "32px",
                                                        height: "32px",
                                                        minWidth: "32px",
                                                        flexShrink: 0,
                                                        padding: 0,
                                                        color: "#e11d48",
                                                        transition: "all 0.15s ease",
                                                    }}
                                                    onClick={() => handleDelete(item)}
                                                    title="Delete Innings"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="mt-3">
                                <Pagination
                                    page={page}
                                    totalPages={totalPages}
                                    total={filteredMatches.length}
                                    onPageChange={setPage}
                                    pageSize={PAGE_SIZE}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
