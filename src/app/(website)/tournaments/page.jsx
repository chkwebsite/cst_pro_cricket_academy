"use client";

import { useEffect, useState, useMemo } from "react";
import PageHeader from "../components/layout/PageHeader";
import Link from "next/link";
import {
    Calendar,
    Clock,
    MapPin,
    Medal,
    Package,
    Phone,
    Shield,
    Sparkles,
    Trophy,
    Users,
} from "lucide-react";

export default function TournamentsPage() {
    const [tournaments, setTournaments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState("ALL");

    useEffect(() => {
        async function fetchTournaments() {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch("/api/tournaments");
                const json = await res.json();
                if (res.ok && json.success) {
                    setTournaments(json.data || []);
                } else {
                    setError("Failed to load tournaments. Please try again.");
                }
            } catch (err) {
                setError("Network error while loading tournament fixtures.");
            } finally {
                setLoading(false);
            }
        }
        fetchTournaments();
    }, []);

    // Filter tournaments by status
    const filteredTournaments = useMemo(() => {
        if (statusFilter === "ALL") return tournaments;
        return tournaments.filter((t) => {
            const s = (t.status || "").toLowerCase();
            if (statusFilter === "ACTIVE") return s === "active" || s === "ongoing";
            if (statusFilter === "UPCOMING") return s === "upcoming" || s === "scheduled" || s === "registration open";
            if (statusFilter === "COMPLETED") return s === "completed";
            return true;
        });
    }, [tournaments, statusFilter]);

    const getStatusBadge = (status) => {
        const s = (status || "").toLowerCase();
        if (s.includes("active") || s.includes("ongoing")) {
            return <span className="badge bg-danger rounded-pill px-3 py-1.5 fw-bold animate-pulse">● Live Now</span>;
        }
        if (s.includes("upcoming") || s.includes("open")) {
            return <span className="badge bg-success rounded-pill px-3 py-1.5 fw-bold">Registration Open</span>;
        }
        if (s.includes("completed")) {
            return <span className="badge bg-secondary rounded-pill px-3 py-1.5">Completed</span>;
        }
        return <span className="badge bg-light text-dark border rounded-pill px-3 py-1.5">{status || "Scheduled"}</span>;
    };

    return (
        <>
            <PageHeader
                title="Tournaments & Championships"
                breadcrumbs={[{ label: "Home", href: "/" }]}
                current="Tournaments"
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
                                <span
                                    className="badge px-3 py-1 mb-2 fw-bold text-uppercase"
                                    style={{ background: "var(--lime)", color: "var(--navy)" }}
                                >
                                    CST Pro Cup Series
                                </span>
                                <h1 className="fw-bold mb-2 text-white font-oswald text-uppercase display-5">
                                    Official Tournaments &amp; Leagues
                                </h1>
                                <p className="lead mb-0 text-white-50" style={{ maxWidth: "600px", fontSize: "1.05rem" }}>
                                    Compete on international standard turf pitches with BCCI-accredited umpires, live ball-by-ball scorecards, and trophy presentations.
                                </p>
                            </div>
                            <div className="col-lg-4 text-lg-end mt-3 mt-lg-0">
                                <Link
                                    href="/contact"
                                    className="btn btn-light fw-bold px-4 py-2.5 rounded-pill shadow-sm"
                                >
                                    Organize Your Cup
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
                                    statusFilter === "ALL" ? "btn-dark" : "btn-light border"
                                }`}
                                onClick={() => setStatusFilter("ALL")}
                            >
                                All Tournaments ({tournaments.length})
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm rounded-pill px-3 fw-semibold ${
                                    statusFilter === "ACTIVE" ? "btn-dark" : "btn-light border"
                                }`}
                                onClick={() => setStatusFilter("ACTIVE")}
                            >
                                Live &amp; Ongoing
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm rounded-pill px-3 fw-semibold ${
                                    statusFilter === "UPCOMING" ? "btn-dark" : "btn-light border"
                                }`}
                                onClick={() => setStatusFilter("UPCOMING")}
                            >
                                Upcoming
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm rounded-pill px-3 fw-semibold ${
                                    statusFilter === "COMPLETED" ? "btn-dark" : "btn-light border"
                                }`}
                                onClick={() => setStatusFilter("COMPLETED")}
                            >
                                Completed
                            </button>
                        </div>

                        <div className="d-none d-md-block text-muted small">
                            Showing <strong>{filteredTournaments.length}</strong> tournament(s)
                        </div>
                    </div>

                    {/* Content Section */}
                    {loading ? (
                        <div className="text-center py-5 bg-white rounded-4 border shadow-sm p-5">
                            <div className="spinner-border text-success" role="status" />
                            <p className="text-muted mt-2 small mb-0">Loading tournaments &amp; championship schedule...</p>
                        </div>
                    ) : error ? (
                        <div className="alert alert-danger text-center py-4 rounded-4 shadow-sm">{error}</div>
                    ) : filteredTournaments.length === 0 ? (
                        <div className="text-center py-5 bg-white rounded-4 border p-5 shadow-sm">
                            <Trophy size={56} className="text-muted opacity-40 mb-3" />
                            <h4 className="fw-bold text-dark font-oswald text-uppercase">No Tournaments Found</h4>
                            <p className="text-muted small mb-3">
                                No tournaments match the selected status filter right now.
                            </p>
                            <button
                                type="button"
                                className="btn btn-outline-success btn-sm px-4 rounded-pill"
                                onClick={() => setStatusFilter("ALL")}
                            >
                                View All Tournaments
                            </button>
                        </div>
                    ) : (
                        <div className="row g-4">
                            {filteredTournaments.map((t) => (
                                <div key={t.id} className="col-12 col-lg-6">
                                    <div className="card h-100 border-0 rounded-4 shadow-sm overflow-hidden bg-white p-4 d-flex flex-column justify-content-between">
                                        <div>
                                            {/* Top Row: Type & Status */}
                                            <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
                                                <span
                                                    className="badge px-2.5 py-1 rounded-pill small fw-semibold"
                                                    style={{ background: "#e0f2f1", color: "#004d40" }}
                                                >
                                                    {t.tournament_type || "Cricket Cup"}
                                                    {t.age_group ? ` • ${t.age_group}` : ""}
                                                </span>
                                                {getStatusBadge(t.status)}
                                            </div>

                                            {/* Tournament Title */}
                                            <h4 className="fw-bold font-oswald text-uppercase text-dark mb-2">
                                                {t.tournament_name}
                                            </h4>

                                            {t.description && (
                                                <p className="text-muted small mb-3 text-truncate-2">
                                                    {t.description}
                                                </p>
                                            )}

                                            {/* Details Grid */}
                                            <div className="row g-2 p-3 rounded-3 bg-light mb-3 small text-secondary">
                                                <div className="col-sm-6 d-flex align-items-center gap-2">
                                                    <Calendar size={15} className="text-success flex-shrink-0" />
                                                    <span>
                                                        <strong>Dates:</strong> {t.start_date || "TBA"} - {t.end_date || "TBA"}
                                                    </span>
                                                </div>
                                                <div className="col-sm-6 d-flex align-items-center gap-2">
                                                    <MapPin size={15} className="text-danger flex-shrink-0" />
                                                    <span className="text-truncate">
                                                        <strong>Venue:</strong> {t.branch_name || "Main Campus Turf"}
                                                    </span>
                                                </div>
                                                <div className="col-sm-6 d-flex align-items-center gap-2">
                                                    <Users size={15} className="text-primary flex-shrink-0" />
                                                    <span>
                                                        <strong>Teams:</strong> Max {t.max_teams || 16} Teams ({t.max_players_per_team || 15}/squad)
                                                    </span>
                                                </div>
                                                <div className="col-sm-6 d-flex align-items-center gap-2">
                                                    <Medal size={15} className="text-warning flex-shrink-0" />
                                                    <span>
                                                        <strong>Entry Fee:</strong> {t.team_fee ? `₹${Number(t.team_fee).toLocaleString("en-IN")}` : "Free / Sponsored"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="d-flex align-items-center justify-content-between pt-3 border-top mt-auto flex-wrap gap-2">
                                            <div className="small text-muted">
                                                Code: <code>{t.tournament_code || `CST-T${t.id}`}</code>
                                            </div>
                                            <div className="d-flex align-items-center gap-2">
                                                <Link
                                                    href="/matches"
                                                    className="btn btn-outline-dark btn-sm rounded-pill px-3"
                                                >
                                                    View Matches
                                                </Link>
                                                <a
                                                    href="tel:+918285831503"
                                                    className="btn btn-success btn-sm rounded-pill px-3 fw-semibold d-flex align-items-center gap-1"
                                                >
                                                    <Phone size={13} />
                                                    Register Team
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </>
    );
}
