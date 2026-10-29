"use client";

import { useEffect, useState, useMemo } from "react";
import PageHeader from "../components/layout/PageHeader";
import Link from "next/link";
import {
    Activity,
    Calendar,
    Clock,
    MapPin,
    Radio,
    Shield,
    Trophy,
} from "lucide-react";

export default function MatchesPage() {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterTab, setFilterTab] = useState("ALL");

    useEffect(() => {
        async function fetchMatches() {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch("/api/matches");
                const json = await res.json();
                if (res.ok && json.success) {
                    setMatches(json.data || []);
                } else {
                    setError("Unable to load matches. Please refresh the page.");
                }
            } catch (err) {
                setError("Network error while loading matches.");
            } finally {
                setLoading(false);
            }
        }
        fetchMatches();
    }, []);

    const filteredMatches = useMemo(() => {
        if (filterTab === "ALL") return matches;
        return matches.filter((m) => {
            const s = (m.status || "").toLowerCase();
            if (filterTab === "LIVE") return s === "live";
            if (filterTab === "UPCOMING") return s === "scheduled" || s === "upcoming";
            if (filterTab === "COMPLETED") return s === "completed";
            return true;
        });
    }, [matches, filterTab]);

    const liveCount = useMemo(
        () => matches.filter((m) => (m.status || "").toLowerCase() === "live").length,
        [matches]
    );

    return (
        <>
            <PageHeader
                title="Matches & Live Scores"
                breadcrumbs={[{ label: "Home", href: "/" }]}
                current="Matches"
            />

            <section className="py-5" style={{ background: "#f8fbfb", minHeight: "80vh" }}>
                <div className="container">
                    {/* Header Banner */}
                    <div
                        className="p-4 p-md-5 rounded-4 text-white mb-4 shadow-sm position-relative overflow-hidden"
                        style={{
                            background: "linear-gradient(135deg, #062f38 0%, #0d4b57 100%)",
                            border: "1px solid rgba(164, 255, 0, 0.2)",
                        }}
                    >
                        <div className="row align-items-center">
                            <div className="col-lg-8">
                                <div className="d-flex align-items-center gap-2 mb-2">
                                    <span
                                        className="badge px-3 py-1 fw-bold text-uppercase"
                                        style={{ background: "var(--lime)", color: "var(--navy)" }}
                                    >
                                        Live Match Centre
                                    </span>
                                    {liveCount > 0 && (
                                        <span className="badge bg-danger rounded-pill px-3 py-1 fw-bold d-inline-flex align-items-center gap-1.5 animate-pulse">
                                            <Radio size={12} /> {liveCount} Live Now
                                        </span>
                                    )}
                                </div>
                                <h1 className="fw-bold mb-2 text-white font-oswald text-uppercase display-5">
                                    Academy Fixtures &amp; Scorecards
                                </h1>
                                <p className="lead mb-0 text-white-50" style={{ maxWidth: "600px", fontSize: "1.05rem" }}>
                                    Follow practice matches, intra-academy league clashes, and inter-club tournaments with official scorecards.
                                </p>
                            </div>
                            <div className="col-lg-4 text-lg-end mt-3 mt-lg-0">
                                <Link
                                    href="/tournaments"
                                    className="btn btn-outline-light rounded-pill px-4 py-2.5 fw-semibold"
                                >
                                    Browse Tournaments
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="bg-white p-3 rounded-4 shadow-sm border mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <div className="d-flex align-items-center gap-2 overflow-x-auto pb-1 pb-md-0">
                            <button
                                type="button"
                                className={`btn btn-sm rounded-pill px-3 fw-semibold ${
                                    filterTab === "ALL" ? "btn-dark" : "btn-light border"
                                }`}
                                onClick={() => setFilterTab("ALL")}
                            >
                                All Matches ({matches.length})
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm rounded-pill px-3 fw-semibold d-flex align-items-center gap-1.5 ${
                                    filterTab === "LIVE" ? "btn-danger text-white" : "btn-light border"
                                }`}
                                onClick={() => setFilterTab("LIVE")}
                            >
                                <span className="p-1 rounded-circle bg-danger-subtle d-inline-block"></span>
                                Live Matches ({liveCount})
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm rounded-pill px-3 fw-semibold ${
                                    filterTab === "UPCOMING" ? "btn-dark" : "btn-light border"
                                }`}
                                onClick={() => setFilterTab("UPCOMING")}
                            >
                                Scheduled / Fixtures
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm rounded-pill px-3 fw-semibold ${
                                    filterTab === "COMPLETED" ? "btn-dark" : "btn-light border"
                                }`}
                                onClick={() => setFilterTab("COMPLETED")}
                            >
                                Completed Results
                            </button>
                        </div>

                        <div className="d-none d-md-block text-muted small">
                            Showing <strong>{filteredMatches.length}</strong> match(es)
                        </div>
                    </div>

                    {/* Match Cards */}
                    {loading ? (
                        <div className="text-center py-5 bg-white rounded-4 border shadow-sm p-5">
                            <div className="spinner-border text-success" role="status" />
                            <p className="text-muted mt-2 small mb-0">Loading match scorecards and fixtures...</p>
                        </div>
                    ) : error ? (
                        <div className="alert alert-danger text-center py-4 rounded-4 shadow-sm">{error}</div>
                    ) : filteredMatches.length === 0 ? (
                        <div className="text-center py-5 bg-white rounded-4 border p-5 shadow-sm">
                            <Activity size={56} className="text-muted opacity-40 mb-3" />
                            <h4 className="fw-bold text-dark font-oswald text-uppercase">No Matches Found</h4>
                            <p className="text-muted small mb-3">
                                No matches found under the selected category. Check back soon for upcoming academy match fixtures.
                            </p>
                            <button
                                type="button"
                                className="btn btn-outline-success btn-sm px-4 rounded-pill"
                                onClick={() => setFilterTab("ALL")}
                            >
                                View All Matches
                            </button>
                        </div>
                    ) : (
                        <div className="row g-4">
                            {filteredMatches.map((m) => {
                                const isLive = (m.status || "").toLowerCase() === "live";
                                const isCompleted = (m.status || "").toLowerCase() === "completed";

                                return (
                                    <div key={m.id} className="col-12 col-md-6 col-xl-4">
                                        <div className="card h-100 border-0 rounded-4 shadow-sm overflow-hidden bg-white p-3.5 d-flex flex-column justify-content-between position-relative">
                                            <div>
                                                {/* Match Header Badge */}
                                                <div className="d-flex align-items-center justify-content-between mb-3">
                                                    <span className="badge bg-light text-dark border rounded-pill px-2.5 py-1 small">
                                                        {m.match_type_name || m.match_type || "T20 Match"}
                                                    </span>

                                                    {isLive ? (
                                                        <span className="badge bg-danger rounded-pill px-2.5 py-1 d-inline-flex align-items-center gap-1 small fw-bold">
                                                            <Radio size={11} /> LIVE
                                                        </span>
                                                    ) : isCompleted ? (
                                                        <span className="badge bg-secondary rounded-pill px-2.5 py-1 small">
                                                            Completed
                                                        </span>
                                                    ) : (
                                                        <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2.5 py-1 small">
                                                            Scheduled
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Teams Versus Section */}
                                                <div className="p-3 rounded-3 bg-light mb-3">
                                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                                        <div className="d-flex align-items-center gap-2">
                                                            <Shield size={16} className="text-primary flex-shrink-0" />
                                                            <span className="fw-bold text-dark fs-6 text-truncate">
                                                                {m.team_a_name || "Team Alpha"}
                                                            </span>
                                                        </div>
                                                        <div className="fw-bold text-dark font-oswald fs-5">
                                                            {m.team_a_score ? m.team_a_score : "-"}
                                                        </div>
                                                    </div>

                                                    <div className="d-flex align-items-center justify-content-center my-1">
                                                        <span className="text-muted extra-small text-uppercase fw-semibold" style={{ fontSize: "0.7rem" }}>
                                                            VS
                                                        </span>
                                                    </div>

                                                    <div className="d-flex align-items-center justify-content-between">
                                                        <div className="d-flex align-items-center gap-2">
                                                            <Shield size={16} className="text-danger flex-shrink-0" />
                                                            <span className="fw-bold text-dark fs-6 text-truncate">
                                                                {m.team_b_name || "Team Bravo"}
                                                            </span>
                                                        </div>
                                                        <div className="fw-bold text-dark font-oswald fs-5">
                                                            {m.team_b_score ? m.team_b_score : "-"}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Toss / Result Note */}
                                                {m.result_note ? (
                                                    <div className="small fw-semibold text-success mb-2 text-truncate" title={m.result_note}>
                                                        🏆 {m.result_note}
                                                    </div>
                                                ) : m.toss_decision ? (
                                                    <div className="extra-small text-muted mb-2 text-truncate" style={{ fontSize: "0.75rem" }}>
                                                        🪙 Toss won by {m.toss_winner_name || "Team"} (Elected to {m.toss_decision})
                                                    </div>
                                                ) : null}

                                                {/* Date & Ground */}
                                                <div className="small text-muted d-flex flex-column gap-1 mb-3">
                                                    <div className="d-flex align-items-center gap-1.5">
                                                        <Calendar size={13} className="text-success" />
                                                        <span>{m.match_date || "Date TBA"}</span>
                                                    </div>
                                                    <div className="d-flex align-items-center gap-1.5">
                                                        <MapPin size={13} className="text-danger" />
                                                        <span className="text-truncate">{m.ground_name || m.branch_name || "Main Campus Turf"}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Footer Actions */}
                                            <div className="pt-2 border-top d-flex align-items-center justify-content-between">
                                                <span className="extra-small text-muted" style={{ fontSize: "0.72rem" }}>
                                                    Match #{m.id}
                                                </span>
                                                <a
                                                    href="tel:+918285831503"
                                                    className="btn btn-sm btn-outline-dark rounded-pill px-3"
                                                >
                                                    Match Inquiries
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>
        </>
    );
}
