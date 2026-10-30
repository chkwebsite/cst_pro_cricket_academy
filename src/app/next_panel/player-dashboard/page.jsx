"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    Award,
    Calendar,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    CreditCard,
    DollarSign,
    ExternalLink,
    Eye,
    Flame,
    HelpCircle,
    Info,
    Layers,
    Lock,
    MapPin,
    Medal,
    Phone,
    RefreshCw,
    Shield,
    Sparkles,
    Target,
    Trophy,
    User,
    UserCheck,
    Users,
    Zap,
} from "lucide-react";
import PageLoader, { usePageLoading } from "../components/PageLoader";

export default function PlayerDashboardPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const selectedUserId = searchParams.get("user_id") || "";
    const selectedYear = searchParams.get("year") || String(new Date().getFullYear());

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);
    const [activeTab, setActiveTab] = useState("overview"); // "overview" | "matches" | "fees" | "performance"
    const [expandedMatchId, setExpandedMatchId] = useState(null);

    const toggleExpandMatch = (id) => {
        setExpandedMatchId((prev) => (prev === id ? null : id));
    };

    useEffect(() => {
        let isMounted = true;

        async function fetchDashboard() {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (selectedUserId) params.set("user_id", selectedUserId);
                if (selectedYear) params.set("year", selectedYear);

                const res = await fetch(`/api/player-dashboard?${params.toString()}`);
                const json = await res.json();

                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to load player dashboard.");
                }

                if (isMounted) {
                    setData(json.data);
                }
            } catch (err) {
                if (isMounted) {
                    setError(err.message || "Network error while loading player portal.");
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchDashboard();
        return () => {
            isMounted = false;
        };
    }, [selectedUserId, selectedYear]);

    const handlePlayerSelect = (userId) => {
        startTransition(() => {
            const params = new URLSearchParams(searchParams.toString());
            if (userId) params.set("user_id", userId);
            else params.delete("user_id");
            router.push(`/next_panel/player-dashboard?${params.toString()}`);
        });
    };

    const handleYearChange = (year) => {
        startTransition(() => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("year", year);
            router.push(`/next_panel/player-dashboard?${params.toString()}`);
        });
    };

    if (loading && !data) {
        return (
            <PageLoader
                message="Loading Player Dashboard"
                subtitle="Retrieving player enrolled programs, match fixtures, and fee records..."
            />
        );
    }

    if (error && !data) {
        return (
            <div className="container-fluid py-5">
                <div className="card shadow-sm border-0 rounded-4 p-5 text-center my-5 bg-white">
                    <div className="rounded-circle bg-danger-subtle text-danger d-inline-flex p-3 mx-auto mb-3">
                        <AlertCircle size={36} />
                    </div>
                    <h4 className="fw-bold text-dark mb-2">Unable to Load Dashboard</h4>
                    <p className="text-muted small mx-auto mb-4" style={{ maxWidth: "460px" }}>{error}</p>
                    <div className="d-flex justify-content-center gap-2">
                        <button
                            type="button"
                            className="btn btn-primary rounded-pill px-4"
                            onClick={() => window.location.reload()}
                        >
                            <RefreshCw size={14} className="me-1" /> Retry
                        </button>
                        <Link href="/next_panel/dashboard" className="btn btn-outline-secondary rounded-pill px-4">
                            Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const {
        user,
        admission,
        programs = [],
        feeCalendar,
        teams = [],
        enrolledMatches = [],
        enrolledTournaments = [],
        liveMatches = [],
        upcomingMatches = [],
        upcomingTournaments = [],
        matchAndTournamentFees = [],
        performance,
        playerOptions = [],
        isStaffView = false,
        adminRole = "Staff",
        scopeTitle = "",
    } = data || {};

    const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
        [admission?.first_name, admission?.last_name].filter(Boolean).join(" ") ||
        "Player";

    const admissionNo = admission?.admission_no || user?.appointment_no || "N/A";
    const branchName = admission?.branch_name || user?.branch_name || "Main Campus";
    const roleName = admission?.role_name || "All-Rounder";

    const currentYear = new Date().getFullYear();

    return (
        <div className="container-fluid py-4 px-md-4">
            {/* Top Bar for Staff / Admin preview picker */}
            {isStaffView && (
                <div className="card border-0 rounded-4 shadow-sm mb-4 bg-white overflow-hidden border-start border-4 border-primary">
                    <div className="card-body p-3 p-md-4">
                        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                            <div className="d-flex align-items-center gap-3">
                                <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center shadow-sm flex-shrink-0" style={{ width: "46px", height: "46px" }}>
                                    <Shield size={24} />
                                </div>
                                <div>
                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                        <h5 className="fw-bold text-dark mb-0">{adminRole} View: Select Player</h5>
                                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2 py-1 small">
                                            {playerOptions.length} {playerOptions.length === 1 ? "Player" : "Players"} Available
                                        </span>
                                    </div>
                                    <span className="text-muted small">
                                        {scopeTitle || "Switch between enrolled players to inspect their personal dashboard, match fixtures, and fee records."}
                                    </span>
                                </div>
                            </div>

                            <div className="d-flex align-items-center gap-2 w-100 w-md-auto ms-auto" style={{ minWidth: "280px", maxWidth: "520px" }}>
                                <label className="form-label small fw-semibold text-muted mb-0 d-none d-lg-inline text-nowrap">
                                    Active Player:
                                </label>
                                {playerOptions.length > 0 ? (
                                    <select
                                        className="form-select form-select-md rounded-pill border-2 border-primary-subtle shadow-sm px-3 fw-semibold text-dark bg-white"
                                        value={user?.id || ""}
                                        onChange={(e) => handlePlayerSelect(e.target.value)}
                                        disabled={isPending}
                                    >
                                        {playerOptions.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} {p.admission_no ? `[${p.admission_no}]` : `(#${p.id})`} {p.branch_name ? `• ${p.branch_name}` : ""}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="text-muted small fst-italic">
                                        No players enrolled in this scope yet.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!user && isStaffView && (
                <div className="card border-0 rounded-4 shadow-sm p-5 text-center my-4 bg-white">
                    <div className="rounded-circle bg-primary-subtle text-primary d-inline-flex p-3 mx-auto mb-3">
                        <Users size={36} />
                    </div>
                    <h5 className="fw-bold text-dark mb-2">No Players Enrolled Yet</h5>
                    <p className="text-muted small mx-auto mb-4" style={{ maxWidth: "500px" }}>
                        There are currently no active players registered under this scope. Once players are admitted, you will be able to inspect their full portal here.
                    </p>
                    <div>
                        <Link href="/next_panel/admission-players/new" className="btn btn-primary rounded-pill px-4">
                            + Admit New Player
                        </Link>
                    </div>
                </div>
            )}

            {user && (
                <>
            {/* 1. PLAYER PROFILE CARD - NOT EDITABLE */}
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4 bg-white">
                <div
                    className="p-4 p-md-5 text-white position-relative"
                    style={{
                        background: "linear-gradient(135deg, #062f38 0%, #0a4a55 60%, #00bcd4 100%)",
                    }}
                >
                    <div className="row align-items-center g-4 position-relative" style={{ zIndex: 1 }}>
                        <div className="col-auto">
                            <div
                                className="rounded-circle border border-3 border-white shadow-lg overflow-hidden d-flex align-items-center justify-content-center bg-white text-dark fw-bold position-relative"
                                style={{ width: "100px", height: "100px", fontSize: "2.2rem" }}
                            >
                                {user?.profile_image ? (
                                    <img
                                        src={user.profile_image}
                                        alt={displayName}
                                        className="w-100 h-100 object-fit-cover"
                                    />
                                ) : (
                                    (displayName?.[0] || "P").toUpperCase()
                                )}
                            </div>
                        </div>

                        <div className="col">
                            <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                                <span className="badge bg-lime text-navy fw-bold px-2.5 py-1 text-uppercase" style={{ fontSize: "0.72rem" }}>
                                    <UserCheck size={12} className="me-1 inline" /> Player
                                </span>
                                <span className="badge bg-white-subtle text-white border border-white-50 px-2.5 py-1" style={{ fontSize: "0.72rem" }}>
                                    Adm No: {admissionNo}
                                </span>
                                {branchName && (
                                    <span className="badge bg-black-subtle text-white-75 px-2.5 py-1" style={{ fontSize: "0.72rem" }}>
                                        <MapPin size={11} className="me-1 inline" /> {branchName}
                                    </span>
                                )}
                            </div>

                            <h2 className="fw-bold mb-1 font-oswald text-uppercase tracking-wide text-white">
                                {displayName}
                            </h2>

                            <div className="d-flex flex-wrap align-items-center gap-3 text-white-75 small">
                                <span>
                                    <strong>Role:</strong> {roleName}
                                </span>
                                <span>•</span>
                                <span>
                                    <strong>Email:</strong> {user?.email || admission?.email || "—"}
                                </span>
                                <span>•</span>
                                <span>
                                    <strong>Phone:</strong> {user?.phone || admission?.phone || "—"}
                                </span>
                            </div>
                        </div>

                        {/* Lock / Not Editable Indicator */}
                        <div className="col-lg-auto text-lg-end">
                            <div
                                className="d-inline-flex flex-column align-items-lg-end p-2.5 rounded-3"
                                style={{ background: "rgba(0, 0, 0, 0.25)", backdropFilter: "blur(4px)" }}
                            >
                                <span className="badge bg-warning text-dark d-inline-flex align-items-center gap-1 mb-1 fw-bold">
                                    <Lock size={12} /> Official Profile: Non-Editable
                                </span>
                                <span className="text-white-50" style={{ fontSize: "0.7rem", maxWidth: "230px" }}>
                                    Player credentials and master data are managed by CST Cricket Academy.
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Profile Details Grid (Read-Only) */}
                <div className="p-4 bg-light border-top border-light-subtle">
                    <div className="row g-3 small text-dark">
                        <div className="col-6 col-md-3">
                            <span className="text-muted d-block" style={{ fontSize: "0.72rem" }}>Date of Birth / Age</span>
                            <span className="fw-bold">{admission?.under_age ? `Age Group: ${admission.under_age}` : "Not Specified"}</span>
                        </div>
                        <div className="col-6 col-md-3">
                            <span className="text-muted d-block" style={{ fontSize: "0.72rem" }}>Gender</span>
                            <span className="fw-bold">{admission?.gender || "Male"}</span>
                        </div>
                        <div className="col-6 col-md-3">
                            <span className="text-muted d-block" style={{ fontSize: "0.72rem" }}>Father / Guardian</span>
                            <span className="fw-bold">{admission?.father_name || "—"}</span>
                        </div>
                        <div className="col-6 col-md-3">
                            <span className="text-muted d-block" style={{ fontSize: "0.72rem" }}>Aadhaar No</span>
                            <span className="fw-bold">{admission?.aadhaar_no ? `•••• •••• ${String(admission.aadhaar_no).slice(-4)}` : "—"}</span>
                        </div>
                        <div className="col-12 col-md-6">
                            <span className="text-muted d-block" style={{ fontSize: "0.72rem" }}>Residential Address</span>
                            <span className="fw-medium">
                                {[admission?.address, admission?.city, admission?.state, admission?.pin_code].filter(Boolean).join(", ") || "Academy Hostel / Local Resident"}
                            </span>
                        </div>
                        <div className="col-6 col-md-3">
                            <span className="text-muted d-block" style={{ fontSize: "0.72rem" }}>Primary Academy</span>
                            <span className="fw-bold text-primary">{user?.academy_name || "CST Cricket Academy"}</span>
                        </div>
                        <div className="col-6 col-md-3">
                            <span className="text-muted d-block" style={{ fontSize: "0.72rem" }}>Membership Status</span>
                            <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                                <Check size={11} className="me-1" /> Active Student
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* QUICK STATS KPI ROW */}
            <div className="row g-3 mb-4">
                <div className="col-6 col-lg-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="text-muted small fw-semibold">Enrolled Programs</span>
                            <div className="badge bg-primary-subtle text-primary p-2 rounded-3">
                                <Layers size={18} />
                            </div>
                        </div>
                        <div className="fs-3 fw-bold text-dark font-oswald">{programs.length}</div>
                        <span className="text-muted" style={{ fontSize: "0.72rem" }}>Active Training Batches</span>
                    </div>
                </div>

                <div className="col-6 col-lg-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="text-muted small fw-semibold">Enrolled Teams</span>
                            <div className="badge bg-success-subtle text-success p-2 rounded-3">
                                <Users size={18} />
                            </div>
                        </div>
                        <div className="fs-3 fw-bold text-dark font-oswald">{teams.length}</div>
                        <span className="text-muted" style={{ fontSize: "0.72rem" }}>Squad Memberships</span>
                    </div>
                </div>

                <div className="col-6 col-lg-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="text-muted small fw-semibold">My Matches</span>
                            <div className="badge bg-warning-subtle text-warning p-2 rounded-3">
                                <Trophy size={18} />
                            </div>
                        </div>
                        <div className="fs-3 fw-bold text-dark font-oswald">{enrolledMatches.length}</div>
                        <span className="text-muted" style={{ fontSize: "0.72rem" }}>Total Registered Fixtures</span>
                    </div>
                </div>

                <div className="col-6 col-lg-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="text-muted small fw-semibold">{selectedYear} Fee Status</span>
                            <div className="badge bg-info-subtle text-info p-2 rounded-3">
                                <CreditCard size={18} />
                            </div>
                        </div>
                        <div className="fs-3 fw-bold text-dark font-oswald">
                            ₹{Number(feeCalendar?.summary?.total_due || 0).toLocaleString("en-IN")}
                        </div>
                        <span className={`small fw-semibold ${Number(feeCalendar?.summary?.total_due || 0) > 0 ? "text-danger" : "text-success"}`} style={{ fontSize: "0.72rem" }}>
                            {Number(feeCalendar?.summary?.total_due || 0) > 0 ? "Pending Dues" : "All Dues Cleared"}
                        </span>
                    </div>
                </div>
            </div>

            {/* TABBED NAVIGATION */}
            <div className="card border-0 shadow-sm rounded-4 mb-4 bg-white overflow-hidden">
                <div className="card-header bg-white border-bottom p-2 px-3">
                    <ul className="nav nav-pills card-header-pills gap-1">
                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link rounded-pill px-3 py-2 fw-semibold small ${activeTab === "overview" ? "active bg-primary text-white" : "text-dark"}`}
                                onClick={() => setActiveTab("overview")}
                            >
                                <Layers size={15} className="me-1 inline" /> Programs &amp; Teams
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link rounded-pill px-3 py-2 fw-semibold small ${activeTab === "matches" ? "active bg-primary text-white" : "text-dark"}`}
                                onClick={() => setActiveTab("matches")}
                            >
                                <Trophy size={15} className="me-1 inline" /> Matches &amp; Tournaments
                                {liveMatches.length > 0 && (
                                    <span className="badge rounded-pill bg-danger ms-1.5 px-1.5 py-0.5" style={{ fontSize: "0.62rem" }}>
                                        {liveMatches.length} LIVE
                                    </span>
                                )}
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link rounded-pill px-3 py-2 fw-semibold small ${activeTab === "fees" ? "active bg-primary text-white" : "text-dark"}`}
                                onClick={() => setActiveTab("fees")}
                            >
                                <CreditCard size={15} className="me-1 inline" /> Fee Status (Jan - Dec)
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link rounded-pill px-3 py-2 fw-semibold small ${activeTab === "performance" ? "active bg-primary text-white" : "text-dark"}`}
                                onClick={() => setActiveTab("performance")}
                            >
                                <Activity size={15} className="me-1 inline" /> Player Performance &amp; Stats
                            </button>
                        </li>
                    </ul>
                </div>

                <div className="card-body p-4">
                    {/* TAB 1: PROGRAMS & TEAMS */}
                    {activeTab === "overview" && (
                        <div>
                            {/* Section A: Enrolled Programs */}
                            <div className="mb-5">
                                <div className="d-flex align-items-center justify-content-between mb-3">
                                    <div>
                                        <h5 className="fw-bold text-dark font-oswald text-uppercase mb-1">
                                            Enrolled Coaching Programs
                                        </h5>
                                        <p className="text-muted small mb-0">
                                            Training courses, scheduled batches, and active duration.
                                        </p>
                                    </div>
                                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-3 py-1.5">
                                        {programs.length} Program{programs.length === 1 ? "" : "s"}
                                    </span>
                                </div>

                                {programs.length === 0 ? (
                                    <div className="text-center py-4 bg-light rounded-4 text-muted small">
                                        <Layers size={32} className="opacity-50 mb-2" />
                                        <p className="mb-0">No active coaching program enrollments found.</p>
                                    </div>
                                ) : (
                                    <div className="row g-3">
                                        {programs.map((prog) => (
                                            <div key={prog.id} className="col-12 col-md-6 col-xl-4">
                                                <div className="card h-100 border rounded-4 p-3.5 shadow-sm hover-shadow transition">
                                                    <div className="d-flex align-items-start justify-content-between mb-2">
                                                        <div className="badge bg-primary-subtle text-primary fw-bold px-2 py-1" style={{ fontSize: "0.72rem" }}>
                                                            {prog.branch_name || "Main Campus"}
                                                        </div>
                                                        <span className={`badge ${prog.status === 1 ? "bg-success" : "bg-secondary"} text-white`} style={{ fontSize: "0.68rem" }}>
                                                            {prog.status === 1 ? "Active" : "Inactive"}
                                                        </span>
                                                    </div>

                                                    <h6 className="fw-bold text-dark mb-2">{prog.program_name}</h6>

                                                    <div className="small text-muted mb-3 d-flex flex-column gap-1">
                                                        <div className="d-flex align-items-center gap-2">
                                                            <Calendar size={13} className="text-secondary" />
                                                            <span>
                                                                <strong>Start:</strong> {prog.start_date ? new Date(prog.start_date).toLocaleDateString("en-IN") : "Immediate"}
                                                            </span>
                                                        </div>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <Calendar size={13} className="text-secondary" />
                                                            <span>
                                                                <strong>End:</strong> {prog.end_date ? new Date(prog.end_date).toLocaleDateString("en-IN") : "Ongoing"}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="mt-auto pt-2 border-top d-flex align-items-center justify-content-between small">
                                                        <span className="text-muted">Program Fee</span>
                                                        <span className="fw-bold text-primary fs-6">
                                                            ₹{Number(prog.program_fee || 0).toLocaleString("en-IN")}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Section B: Enrolled Teams */}
                            <div>
                                <div className="d-flex align-items-center justify-content-between mb-3">
                                    <div>
                                        <h5 className="fw-bold text-dark font-oswald text-uppercase mb-1">
                                            My Enrolled Teams
                                        </h5>
                                        <p className="text-muted small mb-0">
                                            Official club squads and tournament teams you belong to.
                                        </p>
                                    </div>
                                    <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-1.5">
                                        {teams.length} Team{teams.length === 1 ? "" : "s"}
                                    </span>
                                </div>

                                {teams.length === 0 ? (
                                    <div className="text-center py-4 bg-light rounded-4 text-muted small">
                                        <Users size={32} className="opacity-50 mb-2" />
                                        <p className="mb-0">You are not currently assigned to any match or tournament teams.</p>
                                    </div>
                                ) : (
                                    <div className="row g-3">
                                        {teams.map((t, idx) => (
                                            <div key={idx} className="col-12 col-md-6 col-xl-4">
                                                <div className="card h-100 border rounded-4 p-3.5 shadow-sm d-flex flex-column justify-content-between">
                                                    <div>
                                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                                            <span className="badge bg-light text-muted border" style={{ fontSize: "0.68rem" }}>
                                                                {t.category}
                                                            </span>
                                                            {t.jersey_no && (
                                                                <span className="badge bg-dark text-white font-oswald px-2 py-1">
                                                                    Jersey #{t.jersey_no}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="d-flex align-items-center gap-3 mb-2">
                                                            <div
                                                                className="rounded-circle bg-navy text-white d-flex align-items-center justify-content-center fw-bold shadow-sm"
                                                                style={{ width: "42px", height: "42px", fontSize: "1.1rem" }}
                                                            >
                                                                {t.team_code || t.team_name?.[0] || "T"}
                                                            </div>
                                                            <div>
                                                                <h6 className="fw-bold text-dark mb-0">{t.team_name}</h6>
                                                                <span className="text-muted small">{t.tournament_name || t.branch_name || "CST Academy"}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="pt-2 border-top mt-2 d-flex align-items-center justify-content-between small text-muted">
                                                        <span>Team Role</span>
                                                        <span className="badge bg-primary-subtle text-primary fw-bold">
                                                            {t.player_role || "Squad Member"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 2: MATCHES & TOURNAMENTS */}
                    {activeTab === "matches" && (
                        <div>
                            {/* 1. Live Matches Banner (if any) */}
                            {liveMatches.length > 0 && (
                                <div className="mb-4">
                                    <div className="d-flex align-items-center gap-2 mb-2">
                                        <span className="spinner-grow spinner-grow-sm text-danger" role="status"></span>
                                        <h6 className="fw-bold text-danger font-oswald text-uppercase mb-0 tracking-wide">
                                            Live Matches in Progress ({liveMatches.length})
                                        </h6>
                                    </div>

                                    <div className="row g-3">
                                        {liveMatches.map((m) => (
                                            <div key={m.id} className="col-12 col-md-6">
                                                <div className="card border-danger border-2 rounded-4 p-3 shadow-sm bg-danger-subtle">
                                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                                        <span className="badge bg-danger text-white">LIVE NOW</span>
                                                        <span className="small text-muted fw-bold">{m.match_no}</span>
                                                    </div>
                                                    <div className="fs-5 fw-bold text-dark font-oswald text-center my-2">
                                                        {m.team_a_name || "Team A"} <span className="text-muted">VS</span> {m.team_b_name || "Team B"}
                                                    </div>
                                                    <div className="text-center text-muted small">
                                                        <MapPin size={12} className="inline me-1" /> {m.ground_name || "Academy Ground"} • {m.tournament_name || "Friendly Match"}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 2. My Enrolled Matches */}
                            <div className="mb-5">
                                <div className="d-flex align-items-center justify-content-between mb-3">
                                    <div>
                                        <h5 className="fw-bold text-dark font-oswald text-uppercase mb-1">
                                            My Match Fixtures
                                        </h5>
                                        <p className="text-muted small mb-0">
                                            Matches where you are registered in the playing squad.
                                        </p>
                                    </div>
                                    <span className="badge bg-primary rounded-pill px-3 py-1.5">
                                        {enrolledMatches.length} Matches
                                    </span>
                                </div>

                                {enrolledMatches.length === 0 ? (
                                    <div className="text-center py-4 bg-light rounded-4 text-muted small">
                                        <Trophy size={32} className="opacity-50 mb-2" />
                                        <p className="mb-0">You have not been selected for any match fixtures yet.</p>
                                    </div>
                                ) : (
                                    <div className="table-responsive bg-white rounded-4 border">
                                        <table className="table align-middle mb-0 small">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Match</th>
                                                    <th>Tournament / Type</th>
                                                    <th>Teams (A vs B)</th>
                                                    <th>Date &amp; Time</th>
                                                    <th>Venue</th>
                                                    <th>My Team &amp; Role</th>
                                                    <th>Status</th>
                                                    <th>My Performance</th>
                                                    <th className="text-end">Scorecard</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {enrolledMatches.map((m) => {
                                                    const isExpanded = expandedMatchId === m.id;
                                                    return (
                                                        <tr key={m.id} className={isExpanded ? "table-active" : ""}>
                                                            <td className="fw-bold">{m.match_no}</td>
                                                            <td>
                                                                <span className="text-dark fw-medium">{m.tournament_name || "Practice Game"}</span>
                                                                <span className="text-muted d-block" style={{ fontSize: "0.7rem" }}>{m.match_type || "T20"}</span>
                                                            </td>
                                                            <td className="fw-semibold">
                                                                {m.team_a_name || "Team A"} <span className="text-muted">vs</span> {m.team_b_name || "Team B"}
                                                            </td>
                                                            <td>
                                                                <div className="fw-medium">{m.match_date ? new Date(m.match_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "TBD"}</div>
                                                                <div className="text-muted" style={{ fontSize: "0.7rem" }}>{m.match_time || "—"}</div>
                                                            </td>
                                                            <td>{m.ground_name || "Academy Ground"}</td>
                                                            <td>
                                                                <span className="badge bg-primary-subtle text-primary">{m.my_team_name || "Assigned Team"}</span>
                                                                <span className="text-muted d-block mt-0.5" style={{ fontSize: "0.7rem" }}>{m.player_role || "Player"}</span>
                                                            </td>
                                                            <td>
                                                                <span className={`badge ${
                                                                    String(m.match_status).toLowerCase() === "live"
                                                                        ? "bg-danger"
                                                                        : String(m.match_status).toLowerCase() === "completed"
                                                                        ? "bg-success"
                                                                        : "bg-warning text-dark"
                                                                }`}>
                                                                    {m.match_status || "Upcoming"}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                {m.has_scorecard ? (
                                                                    <div className="d-flex flex-wrap gap-1 align-items-center">
                                                                        {m.batting?.has_batted && (
                                                                            <span className="badge bg-primary-subtle text-primary border border-primary-subtle" title="Batting: Runs (Balls)">
                                                                                🏏 {m.batting.runs} ({m.batting.balls}b)
                                                                            </span>
                                                                        )}
                                                                        {m.bowling?.has_bowled && (
                                                                            <span className="badge bg-danger-subtle text-danger border border-danger-subtle" title="Bowling: Wickets/Runs">
                                                                                🎯 {m.bowling.wickets}/{m.bowling.runs_conceded}
                                                                            </span>
                                                                        )}
                                                                        {m.fielding?.has_fielded && (
                                                                            <span className="badge bg-success-subtle text-success border border-success-subtle" title="Fielding dismissals">
                                                                                🧤 {m.fielding.total_dismissals}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                                                                        {m.is_played ? "Scorecard pending" : "Match not played"}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="text-end">
                                                                {m.has_scorecard ? (
                                                                    <button
                                                                        type="button"
                                                                        className={`btn btn-sm ${isExpanded ? "btn-primary text-white" : "btn-outline-primary"} rounded-pill px-2.5 py-1 d-inline-flex align-items-center gap-1`}
                                                                        onClick={() => toggleExpandMatch(m.id)}
                                                                    >
                                                                        <span>{isExpanded ? "Hide" : "Scorecard"}</span>
                                                                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-muted small">—</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>

                                        {/* EXPANDABLE CRICKET SCORECARDS FOR EXPANDED MATCH */}
                                        {enrolledMatches.filter((m) => expandedMatchId === m.id).map((m) => (
                                            <div key={`expanded-card-${m.id}`} className="p-3.5 bg-light border-top">
                                                <div className="bg-white rounded-4 p-3.5 border shadow-sm">
                                                    {/* Header / Inning Summaries */}
                                                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 pb-3 mb-3 border-bottom">
                                                        <div>
                                                            <h6 className="fw-bold text-dark font-oswald text-uppercase mb-0 d-flex align-items-center gap-1.5">
                                                                <Trophy size={16} className="text-warning" />
                                                                <span>Match #{m.match_no} Official Player Performance</span>
                                                            </h6>
                                                            <span className="text-muted small">
                                                                {m.team_a_name} vs {m.team_b_name} • {m.tournament_name || "Academy Fixture"} • {m.ground_name}
                                                            </span>
                                                        </div>
                                                        {m.innings_summary && m.innings_summary.length > 0 && (
                                                            <div className="d-flex flex-wrap gap-1.5 align-items-center">
                                                                {m.innings_summary.map((inn, innIdx) => (
                                                                    <span key={innIdx} className="badge bg-secondary-subtle text-dark border px-2.5 py-1 fw-semibold" style={{ fontSize: "0.75rem" }}>
                                                                        Innings {inn.innings_no} ({inn.batting_team_name}): <strong className="text-primary">{inn.score_text}</strong>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* 3 Detailed Cards: Batting, Bowling, Fielding */}
                                                    <div className="row g-3">
                                                        {/* Card 1: Batting */}
                                                        <div className="col-12 col-md-4">
                                                            <div className="card h-100 border rounded-4 p-3 bg-light-subtle">
                                                                <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                                                                    <div className="d-flex align-items-center gap-1.5">
                                                                        <Zap size={16} className="text-primary" />
                                                                        <span className="fw-bold text-dark font-oswald text-uppercase small">Batting Breakdown</span>
                                                                    </div>
                                                                    {m.batting?.has_batted && (
                                                                        <span className="badge bg-primary-subtle text-primary fw-bold" style={{ fontSize: "0.68rem" }}>
                                                                            Position #{m.batting.batting_position}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {m.batting?.has_batted ? (
                                                                    <div>
                                                                        <div className="d-flex align-items-baseline gap-2 my-2">
                                                                            <span className="fs-2 fw-bold text-primary font-oswald">{m.batting.runs}</span>
                                                                            <span className="text-muted small">runs off <strong>{m.batting.balls}</strong> balls</span>
                                                                        </div>

                                                                        <div className="bg-white p-2 rounded-3 mb-2 small text-dark d-flex justify-content-between border">
                                                                            <span><strong>{m.batting.fours}</strong> × 4s</span>
                                                                            <span><strong>{m.batting.sixes}</strong> × 6s</span>
                                                                            <span>SR: <strong>{m.batting.strike_rate}</strong></span>
                                                                        </div>

                                                                        <div className="small pt-1">
                                                                            <span className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Dismissal Mode:</span>
                                                                            <span className={`badge ${m.batting.is_not_out ? "bg-success-subtle text-success border border-success-subtle" : "bg-light text-dark border"} text-wrap text-start mt-0.5`}>
                                                                                {m.batting.dismissal_text}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="py-4 text-center text-muted small">
                                                                        <Zap size={22} className="opacity-25 mb-1" />
                                                                        <p className="mb-0">Did not bat in this fixture</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Card 2: Bowling */}
                                                        <div className="col-12 col-md-4">
                                                            <div className="card h-100 border rounded-4 p-3 bg-light-subtle">
                                                                <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                                                                    <div className="d-flex align-items-center gap-1.5">
                                                                        <Flame size={16} className="text-danger" />
                                                                        <span className="fw-bold text-dark font-oswald text-uppercase small">Bowling Spell</span>
                                                                    </div>
                                                                    {m.bowling?.has_bowled && (
                                                                        <span className="badge bg-danger-subtle text-danger fw-bold" style={{ fontSize: "0.68rem" }}>
                                                                            {m.bowling.overs} Overs
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {m.bowling?.has_bowled ? (
                                                                    <div>
                                                                        <div className="d-flex align-items-baseline gap-2 my-2">
                                                                            <span className="fs-2 fw-bold text-danger font-oswald">
                                                                                {m.bowling.wickets} / {m.bowling.runs_conceded}
                                                                            </span>
                                                                            <span className="text-muted small">in <strong>{m.bowling.overs}</strong> ov</span>
                                                                        </div>

                                                                        <div className="bg-white p-2 rounded-3 mb-2 small text-dark d-flex justify-content-between border">
                                                                            <span>Maidens: <strong>{m.bowling.maidens}</strong></span>
                                                                            <span>Balls: <strong>{m.bowling.balls_bowled}</strong></span>
                                                                            <span>Econ: <strong>{m.bowling.economy}</strong></span>
                                                                        </div>

                                                                        <div className="small pt-1 d-flex justify-content-between text-muted">
                                                                            <span>Wides: <strong className="text-dark">{m.bowling.wides}</strong></span>
                                                                            <span>No Balls: <strong className="text-dark">{m.bowling.no_balls}</strong></span>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="py-4 text-center text-muted small">
                                                                        <Flame size={22} className="opacity-25 mb-1" />
                                                                        <p className="mb-0">Did not bowl in this fixture</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Card 3: Fielding */}
                                                        <div className="col-12 col-md-4">
                                                            <div className="card h-100 border rounded-4 p-3 bg-light-subtle">
                                                                <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                                                                    <div className="d-flex align-items-center gap-1.5">
                                                                        <Shield size={16} className="text-success" />
                                                                        <span className="fw-bold text-dark font-oswald text-uppercase small">Fielding &amp; Keeping</span>
                                                                    </div>
                                                                    <span className="badge bg-success-subtle text-success fw-bold" style={{ fontSize: "0.68rem" }}>
                                                                        {m.fielding?.total_dismissals || 0} Total
                                                                    </span>
                                                                </div>

                                                                {m.fielding?.has_fielded ? (
                                                                    <div>
                                                                        <div className="d-flex align-items-baseline gap-2 my-2">
                                                                            <span className="fs-2 fw-bold text-success font-oswald">{m.fielding.total_dismissals}</span>
                                                                            <span className="text-muted small">Dismissals effected</span>
                                                                        </div>

                                                                        <div className="bg-white p-2 rounded-3 mb-2 small text-dark d-flex justify-content-between border">
                                                                            <span>Catches: <strong>{m.fielding.catches}</strong></span>
                                                                            <span>Run Outs: <strong>{m.fielding.run_outs}</strong></span>
                                                                            <span>Stumpings: <strong>{m.fielding.stumpings}</strong></span>
                                                                        </div>

                                                                        <div className="small pt-1 text-muted">
                                                                            <span>Active fielding contributions recorded on match sheet</span>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="py-4 text-center text-muted small">
                                                                        <Shield size={22} className="opacity-25 mb-1" />
                                                                        <p className="mb-0">0 catches or dismissals credited</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 3. All Upcoming Academy Matches */}
                            <div className="mb-5">
                                <div className="d-flex align-items-center justify-content-between mb-3">
                                    <div>
                                        <h5 className="fw-bold text-dark font-oswald text-uppercase mb-1">
                                            All Upcoming Academy Fixtures
                                        </h5>
                                        <p className="text-muted small mb-0">Upcoming matches scheduled across CST Cricket Academy grounds.</p>
                                    </div>
                                </div>

                                {upcomingMatches.length === 0 ? (
                                    <div className="text-center py-3 bg-light rounded-4 text-muted small">
                                        No upcoming match fixtures scheduled at the moment.
                                    </div>
                                ) : (
                                    <div className="row g-3">
                                        {upcomingMatches.slice(0, 6).map((m) => (
                                            <div key={m.id} className="col-12 col-md-6 col-xl-4">
                                                <div className="card border rounded-4 p-3 shadow-sm h-100">
                                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                                        <span className="badge bg-light text-muted border">{m.match_no}</span>
                                                        <span className="badge bg-warning-subtle text-warning-emphasis">{m.match_type || "T20 Match"}</span>
                                                    </div>
                                                    <h6 className="fw-bold text-dark mb-1 font-oswald text-uppercase">
                                                        {m.team_a_name || "Team A"} vs {m.team_b_name || "Team B"}
                                                    </h6>
                                                    <div className="text-muted small mb-2">{m.tournament_name || "Academy Cup"}</div>
                                                    <div className="mt-auto pt-2 border-top d-flex justify-content-between small text-muted">
                                                        <span><Calendar size={12} className="inline me-1" />{m.match_date ? new Date(m.match_date).toLocaleDateString("en-IN") : "TBD"}</span>
                                                        <span><MapPin size={12} className="inline me-1" />{m.ground_name || "Turf"}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 4. Enrolled & Open Tournaments */}
                            <div>
                                <div className="d-flex align-items-center justify-content-between mb-3">
                                    <div>
                                        <h5 className="fw-bold text-dark font-oswald text-uppercase mb-1">
                                            Tournaments &amp; League Cups
                                        </h5>
                                        <p className="text-muted small mb-0">Registered championship tournaments and upcoming open leagues.</p>
                                    </div>
                                </div>

                                <div className="row g-3">
                                    {enrolledTournaments.map((t) => (
                                        <div key={t.id} className="col-12 col-md-6">
                                            <div className="card border-primary border-2 rounded-4 p-3.5 shadow-sm bg-primary-subtle h-100">
                                                <div className="d-flex justify-content-between align-items-center mb-2">
                                                    <span className="badge bg-primary text-white">ENROLLED SQUAD</span>
                                                    <span className="badge bg-success">{t.tournament_status || "Active"}</span>
                                                </div>
                                                <h5 className="fw-bold text-dark font-oswald text-uppercase mb-1">{t.tournament_name}</h5>
                                                <p className="text-muted small mb-2">Representing Team: <strong>{t.team_name}</strong></p>
                                                <div className="pt-2 border-top border-primary-subtle d-flex justify-content-between small text-muted">
                                                    <span>Start: {t.start_date ? new Date(t.start_date).toLocaleDateString("en-IN") : "TBD"}</span>
                                                    <span>End: {t.end_date ? new Date(t.end_date).toLocaleDateString("en-IN") : "TBD"}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {upcomingTournaments.map((t) => (
                                        <div key={t.id} className="col-12 col-md-6">
                                            <div className="card border rounded-4 p-3.5 shadow-sm bg-white h-100">
                                                <div className="d-flex justify-content-between align-items-center mb-2">
                                                    <span className="badge bg-light text-muted border">{t.tournament_code || "TOURNAMENT"}</span>
                                                    <span className="badge bg-info-subtle text-info-emphasis">{t.status || "Upcoming"}</span>
                                                </div>
                                                <h5 className="fw-bold text-dark font-oswald text-uppercase mb-1">{t.tournament_name}</h5>
                                                <div className="pt-2 border-top d-flex justify-content-between small text-muted">
                                                    <span><Calendar size={12} className="inline me-1" />{t.start_date ? new Date(t.start_date).toLocaleDateString("en-IN") : "TBD"}</span>
                                                    <span>Fee: ₹{Number(t.registration_fee || 0).toLocaleString("en-IN")}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: FEES STATUS (JAN TO DEC) */}
                    {activeTab === "fees" && (
                        <div>
                            {/* Year Switcher & Overview Header */}
                            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 p-3 rounded-4 bg-light border">
                                <div>
                                    <h5 className="fw-bold text-dark font-oswald text-uppercase mb-1">
                                        Academy Monthly Fee Calendar (Jan to Dec {feeCalendar?.year || currentYear})
                                    </h5>
                                    <p className="text-muted small mb-0">
                                        Track month-by-month paid status, outstanding balance, and receipts.
                                    </p>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    <span className="text-muted small fw-semibold">Year:</span>
                                    <select
                                        className="form-select form-select-sm rounded-pill px-3 shadow-sm"
                                        value={feeCalendar?.year || currentYear}
                                        onChange={(e) => handleYearChange(e.target.value)}
                                    >
                                        <option value="2025">2025</option>
                                        <option value="2026">2026</option>
                                        <option value="2027">2027</option>
                                    </select>
                                </div>
                            </div>

                            {/* Monthly 12 Grid Matrix */}
                            <div className="row g-3 mb-5">
                                {feeCalendar?.months?.map((m) => {
                                    const isPaid = String(m.payment_status).toLowerCase() === "paid";
                                    const isPendingStatus = String(m.payment_status).toLowerCase() === "pending" || Number(m.due_amount) > 0;
                                    const isUpcoming = !m.is_billed;

                                    return (
                                        <div key={m.month_num} className="col-12 col-sm-6 col-md-4 col-xl-3">
                                            <div
                                                className={`card h-100 border rounded-4 p-3.5 shadow-sm transition ${
                                                    isPaid
                                                        ? "border-success bg-success-subtle"
                                                        : isPendingStatus && m.is_billed
                                                        ? "border-danger bg-danger-subtle"
                                                        : "bg-white"
                                                }`}
                                            >
                                                <div className="d-flex justify-content-between align-items-center mb-2">
                                                    <span className="fw-bold font-oswald text-uppercase fs-6 text-dark">
                                                        {m.month_name}
                                                    </span>
                                                    <span
                                                        className={`badge rounded-pill px-2.5 py-1 ${
                                                            isPaid
                                                                ? "bg-success text-white"
                                                                : isPendingStatus && m.is_billed
                                                                ? "bg-danger text-white"
                                                                : "bg-light text-muted border"
                                                        }`}
                                                        style={{ fontSize: "0.68rem" }}
                                                    >
                                                        {isPaid ? "PAID" : isPendingStatus && m.is_billed ? "PENDING" : "UPCOMING"}
                                                    </span>
                                                </div>

                                                <div className="my-2">
                                                    {m.is_billed ? (
                                                        <>
                                                            <div className="d-flex justify-content-between small text-muted mb-1">
                                                                <span>Fee:</span>
                                                                <span className="fw-bold text-dark">₹{m.fee_amount.toLocaleString("en-IN")}</span>
                                                            </div>
                                                            <div className="d-flex justify-content-between small text-muted mb-1">
                                                                <span>Paid:</span>
                                                                <span className="fw-bold text-success">₹{m.paid_amount.toLocaleString("en-IN")}</span>
                                                            </div>
                                                            <div className="d-flex justify-content-between small text-muted">
                                                                <span>Due:</span>
                                                                <span className={`fw-bold ${m.due_amount > 0 ? "text-danger" : "text-muted"}`}>
                                                                    ₹{m.due_amount.toLocaleString("en-IN")}
                                                                </span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="text-muted small py-2 text-center opacity-75">
                                                            Bill not yet generated
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="mt-auto pt-2 border-top d-flex justify-content-between align-items-center" style={{ fontSize: "0.7rem" }}>
                                                    <span className="text-muted">
                                                        {m.due_date ? `Due: ${new Date(m.due_date).toLocaleDateString("en-IN")}` : "Monthly Cycle"}
                                                    </span>
                                                    {isPaid && (
                                                        <span className="text-success fw-bold d-flex align-items-center gap-1">
                                                            <CheckCircle2 size={13} /> Cleared
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Section: Match & Tournament Fees */}
                            <div className="mt-5">
                                <div className="d-flex align-items-center justify-content-between mb-3">
                                    <div>
                                        <h5 className="fw-bold text-dark font-oswald text-uppercase mb-1">
                                            Match &amp; Tournament Fee Status
                                        </h5>
                                        <p className="text-muted small mb-0">Individual match participation and tournament registration fees.</p>
                                    </div>
                                    <span className="badge bg-secondary rounded-pill px-3 py-1.5">
                                        {matchAndTournamentFees.length} Records
                                    </span>
                                </div>

                                {matchAndTournamentFees.length === 0 ? (
                                    <div className="text-center py-4 bg-light rounded-4 text-muted small">
                                        <CreditCard size={32} className="opacity-50 mb-2" />
                                        <p className="mb-0">No match or tournament fee dues recorded for this player account.</p>
                                    </div>
                                ) : (
                                    <div className="table-responsive bg-white rounded-4 border">
                                        <table className="table table-hover align-middle mb-0 small">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Fee Type</th>
                                                    <th>Event / Match</th>
                                                    <th>Fee Amount</th>
                                                    <th>Paid Amount</th>
                                                    <th>Pending Due</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {matchAndTournamentFees.map((f) => (
                                                    <tr key={f.id}>
                                                        <td className="fw-bold text-dark">{f.fee_type || "Match Fee"}</td>
                                                        <td>
                                                            <span className="fw-medium text-dark">{f.tournament_name || (f.match_no ? `Match ${f.match_no}` : "Club Match")}</span>
                                                            {f.match_date && (
                                                                <span className="text-muted d-block" style={{ fontSize: "0.7rem" }}>
                                                                    {new Date(f.match_date).toLocaleDateString("en-IN")}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="fw-bold text-dark">₹{Number(f.fee_amount || 0).toLocaleString("en-IN")}</td>
                                                        <td className="fw-bold text-success">₹{Number(f.paid_amount || 0).toLocaleString("en-IN")}</td>
                                                        <td className="fw-bold text-danger">₹{Number(f.due_amount || 0).toLocaleString("en-IN")}</td>
                                                        <td>
                                                            <span className={`badge ${
                                                                String(f.status).toLowerCase() === "paid"
                                                                    ? "bg-success"
                                                                    : Number(f.due_amount) > 0
                                                                    ? "bg-danger"
                                                                    : "bg-warning text-dark"
                                                            }`}>
                                                                {f.status || (Number(f.due_amount) <= 0 ? "Paid" : "Pending")}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 4: PLAYER PERFORMANCE & STATS */}
                    {activeTab === "performance" && (
                        <div>
                            <div className="d-flex align-items-center justify-content-between mb-4">
                                <div>
                                    <h5 className="fw-bold text-dark font-oswald text-uppercase mb-1">
                                        Career Statistics &amp; Match Performance
                                    </h5>
                                    <p className="text-muted small mb-0">Official batting, bowling, and scorecard records from academy fixtures.</p>
                                </div>
                            </div>

                            {/* Batting Card */}
                            <div className="card border rounded-4 p-4 mb-4 shadow-sm bg-white">
                                <div className="d-flex align-items-center gap-2 mb-3">
                                    <div className="badge bg-primary text-white p-2 rounded-3">
                                        <Zap size={18} />
                                    </div>
                                    <h6 className="fw-bold text-dark font-oswald text-uppercase fs-5 mb-0">
                                        Batting Career Record
                                    </h6>
                                </div>

                                <div className="row g-3 text-center">
                                    <div className="col-4 col-md-2">
                                        <div className="bg-light p-2.5 rounded-3">
                                            <span className="text-muted d-block small" style={{ fontSize: "0.72rem" }}>Innings</span>
                                            <span className="fs-4 fw-bold font-oswald text-dark">{performance?.batting?.innings || 0}</span>
                                        </div>
                                    </div>
                                    <div className="col-4 col-md-2">
                                        <div className="bg-light p-2.5 rounded-3">
                                            <span className="text-muted d-block small" style={{ fontSize: "0.72rem" }}>Runs</span>
                                            <span className="fs-4 fw-bold font-oswald text-primary">{performance?.batting?.runs || 0}</span>
                                        </div>
                                    </div>
                                    <div className="col-4 col-md-2">
                                        <div className="bg-light p-2.5 rounded-3">
                                            <span className="text-muted d-block small" style={{ fontSize: "0.72rem" }}>Highest Score</span>
                                            <span className="fs-4 fw-bold font-oswald text-dark">{performance?.batting?.highest_score || 0}</span>
                                        </div>
                                    </div>
                                    <div className="col-4 col-md-2">
                                        <div className="bg-light p-2.5 rounded-3">
                                            <span className="text-muted d-block small" style={{ fontSize: "0.72rem" }}>Average</span>
                                            <span className="fs-4 fw-bold font-oswald text-dark">{performance?.batting?.average || "0.00"}</span>
                                        </div>
                                    </div>
                                    <div className="col-4 col-md-2">
                                        <div className="bg-light p-2.5 rounded-3">
                                            <span className="text-muted d-block small" style={{ fontSize: "0.72rem" }}>Strike Rate</span>
                                            <span className="fs-4 fw-bold font-oswald text-dark">{performance?.batting?.strike_rate || "0.00"}</span>
                                        </div>
                                    </div>
                                    <div className="col-4 col-md-2">
                                        <div className="bg-light p-2.5 rounded-3">
                                            <span className="text-muted d-block small" style={{ fontSize: "0.72rem" }}>50s / 100s</span>
                                            <span className="fs-4 fw-bold font-oswald text-success">
                                                {performance?.batting?.fifties || 0} / {performance?.batting?.hundreds || 0}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Bowling Card */}
                            <div className="card border rounded-4 p-4 mb-4 shadow-sm bg-white">
                                <div className="d-flex align-items-center gap-2 mb-3">
                                    <div className="badge bg-danger text-white p-2 rounded-3">
                                        <Flame size={18} />
                                    </div>
                                    <h6 className="fw-bold text-dark font-oswald text-uppercase fs-5 mb-0">
                                        Bowling Career Record
                                    </h6>
                                </div>

                                <div className="row g-3 text-center">
                                    <div className="col-4 col-md-2">
                                        <div className="bg-light p-2.5 rounded-3">
                                            <span className="text-muted d-block small" style={{ fontSize: "0.72rem" }}>Overs</span>
                                            <span className="fs-4 fw-bold font-oswald text-dark">{performance?.bowling?.overs || 0}</span>
                                        </div>
                                    </div>
                                    <div className="col-4 col-md-2">
                                        <div className="bg-light p-2.5 rounded-3">
                                            <span className="text-muted d-block small" style={{ fontSize: "0.72rem" }}>Wickets</span>
                                            <span className="fs-4 fw-bold font-oswald text-danger">{performance?.bowling?.wickets || 0}</span>
                                        </div>
                                    </div>
                                    <div className="col-4 col-md-2">
                                        <div className="bg-light p-2.5 rounded-3">
                                            <span className="text-muted d-block small" style={{ fontSize: "0.72rem" }}>Maidens</span>
                                            <span className="fs-4 fw-bold font-oswald text-dark">{performance?.bowling?.maidens || 0}</span>
                                        </div>
                                    </div>
                                    <div className="col-4 col-md-2">
                                        <div className="bg-light p-2.5 rounded-3">
                                            <span className="text-muted d-block small" style={{ fontSize: "0.72rem" }}>Runs Conceded</span>
                                            <span className="fs-4 fw-bold font-oswald text-dark">{performance?.bowling?.runs_conceded || 0}</span>
                                        </div>
                                    </div>
                                    <div className="col-4 col-md-2">
                                        <div className="bg-light p-2.5 rounded-3">
                                            <span className="text-muted d-block small" style={{ fontSize: "0.72rem" }}>Economy</span>
                                            <span className="fs-4 fw-bold font-oswald text-dark">{performance?.bowling?.economy || "0.00"}</span>
                                        </div>
                                    </div>
                                    <div className="col-4 col-md-2">
                                        <div className="bg-light p-2.5 rounded-3">
                                            <span className="text-muted d-block small" style={{ fontSize: "0.72rem" }}>Bowling Avg</span>
                                            <span className="fs-4 fw-bold font-oswald text-dark">{performance?.bowling?.average || "—"}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Fielding Card */}
                            <div className="card border rounded-4 p-4 mb-4 shadow-sm bg-white">
                                <div className="d-flex align-items-center gap-2 mb-3">
                                    <div className="badge bg-success text-white p-2 rounded-3">
                                        <Shield size={18} />
                                    </div>
                                    <h6 className="fw-bold text-dark font-oswald text-uppercase fs-5 mb-0">
                                        Fielding Career Record
                                    </h6>
                                </div>

                                <div className="row g-3 text-center">
                                    <div className="col-6 col-md-3">
                                        <div className="bg-light p-2.5 rounded-3">
                                            <span className="text-muted d-block small" style={{ fontSize: "0.72rem" }}>Total Dismissals</span>
                                            <span className="fs-4 fw-bold font-oswald text-success">{performance?.fielding?.total_dismissals || 0}</span>
                                        </div>
                                    </div>
                                    <div className="col-6 col-md-3">
                                        <div className="bg-light p-2.5 rounded-3">
                                            <span className="text-muted d-block small" style={{ fontSize: "0.72rem" }}>Catches Taken</span>
                                            <span className="fs-4 fw-bold font-oswald text-dark">{performance?.fielding?.catches || 0}</span>
                                        </div>
                                    </div>
                                    <div className="col-6 col-md-3">
                                        <div className="bg-light p-2.5 rounded-3">
                                            <span className="text-muted d-block small" style={{ fontSize: "0.72rem" }}>Run Outs</span>
                                            <span className="fs-4 fw-bold font-oswald text-dark">{performance?.fielding?.run_outs || 0}</span>
                                        </div>
                                    </div>
                                    <div className="col-6 col-md-3">
                                        <div className="bg-light p-2.5 rounded-3">
                                            <span className="text-muted d-block small" style={{ fontSize: "0.72rem" }}>Stumpings</span>
                                            <span className="fs-4 fw-bold font-oswald text-dark">{performance?.fielding?.stumpings || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Match Performance Log */}
                            <div>
                                <h6 className="fw-bold text-dark font-oswald text-uppercase mb-3">
                                    Recent Scorecard Performances
                                </h6>

                                {(!performance?.recentScores || performance.recentScores.length === 0) ? (
                                    <div className="text-center py-4 bg-light rounded-4 text-muted small">
                                        <Activity size={32} className="opacity-50 mb-2" />
                                        <p className="mb-0">No scorecard entries recorded yet for this player.</p>
                                    </div>
                                ) : (
                                    <div className="table-responsive bg-white rounded-4 border">
                                        <table className="table table-hover align-middle mb-0 small">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Match</th>
                                                    <th>Event / Format</th>
                                                    <th>Batting Details</th>
                                                    <th>Bowling Spell</th>
                                                    <th>Fielding</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {performance.recentScores.map((score, idx) => (
                                                    <tr key={idx}>
                                                        <td>
                                                            <div className="fw-bold text-dark">{score.match_no}</div>
                                                            {score.match_date && (
                                                                <span className="text-muted" style={{ fontSize: "0.7rem" }}>
                                                                    {new Date(score.match_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <div className="text-dark fw-medium">{score.tournament_name || "Academy Fixture"}</div>
                                                            {score.match_type && (
                                                                <span className="badge bg-light text-muted border mt-0.5" style={{ fontSize: "0.68rem" }}>
                                                                    {score.match_type}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {score.runs !== null ? (
                                                                <div>
                                                                    <div className="fw-bold text-primary">
                                                                        {score.runs} <span className="text-muted fw-normal">runs ({score.balls}b, {score.fours}×4, {score.sixes}×6)</span>
                                                                    </div>
                                                                    <div className="text-muted mt-0.5" style={{ fontSize: "0.72rem" }}>
                                                                        SR: <strong className="text-dark">{score.strike_rate || "0.00"}</strong> • {score.dismissal_text || score.dismissal_type || "Not Out"}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted fst-italic">Did not bat</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {score.overs !== null ? (
                                                                <div>
                                                                    <div className="fw-bold text-danger">
                                                                        {score.wickets} / {score.runs_conceded} <span className="text-muted fw-normal">({score.overs} ov)</span>
                                                                    </div>
                                                                    <div className="text-muted mt-0.5" style={{ fontSize: "0.72rem" }}>
                                                                        Econ: <strong className="text-dark">{score.economy || "0.00"}</strong> • Maidens: {score.maidens || 0}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted fst-italic">Did not bowl</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {(score.total_fielding || 0) > 0 ? (
                                                                <div className="d-flex flex-wrap gap-1">
                                                                    {score.catches > 0 && (
                                                                        <span className="badge bg-success-subtle text-success border border-success-subtle">
                                                                            {score.catches} Catch{score.catches > 1 ? "es" : ""}
                                                                        </span>
                                                                    )}
                                                                    {score.run_outs > 0 && (
                                                                        <span className="badge bg-info-subtle text-info border border-info-subtle">
                                                                            {score.run_outs} Run Out{score.run_outs > 1 ? "s" : ""}
                                                                        </span>
                                                                    )}
                                                                    {score.stumpings > 0 && (
                                                                        <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                                                                            {score.stumpings} Stumping{score.stumpings > 1 ? "s" : ""}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            </>
            )}
        </div>
    );
}
