"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Activity,
    ArrowRight,
    Award,
    Calendar,
    CheckCircle2,
    Clock,
    CreditCard,
    DollarSign,
    Layers,
    Receipt,
    TrendingUp,
    UserCheck,
    Users,
    Shield,
    Sparkles,
} from "lucide-react";
import { useUser } from "../components/UserContext";

export default function Dashboard() {
    const { user } = useUser();
    const [stats, setStats] = useState({
        playersCount: 0,
        batchesCount: 0,
        trainingsCount: 0,
        matrixStats: null,
    });
    const [loading, setLoading] = useState(true);

    // Auto-redirect players to their dedicated Player Dashboard
    useEffect(() => {
        if (user) {
            const userTypeStr = String(user.user_type || "").trim().toLowerCase();
            if (userTypeStr === "player" || userTypeStr === "7") {
                window.location.replace("/next_panel/player-dashboard");
            }
        }
    }, [user]);

    const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Admin";
    const currentYear = new Date().getFullYear();

    const userTypeStr = String(user?.user_type || "").trim().toLowerCase();
    const isCoach = userTypeStr.includes("coach");
    const isAccountant = userTypeStr.includes("account");
    const isBranchAdmin = userTypeStr.includes("branch");
    const isAcademyAdmin = userTypeStr.includes("academy");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [playersRes, batchesRes, trainingRes, matrixRes] = await Promise.all([
                    fetch("/api/admission-players?status=1&limit=1").catch(() => null),
                    fetch("/api/batches?status=1&limit=1").catch(() => null),
                    fetch("/api/individual-training?status=Active&limit=1").catch(() => null),
                    fetch(`/api/player-program-fees/matrix?year=${currentYear}`).catch(() => null),
                ]);

                const [pJson, bJson, tJson, mJson] = await Promise.all([
                    playersRes ? playersRes.json().catch(() => ({})) : {},
                    batchesRes ? batchesRes.json().catch(() => ({})) : {},
                    trainingRes ? trainingRes.json().catch(() => ({})) : {},
                    matrixRes ? matrixRes.json().catch(() => ({})) : {},
                ]);

                if (!cancelled) {
                    setStats({
                        playersCount: pJson?.pagination?.total || pJson?.data?.length || 0,
                        batchesCount: bJson?.count || bJson?.data?.length || 0,
                        trainingsCount: tJson?.pagination?.total || tJson?.data?.length || 0,
                        matrixStats: mJson?.stats || null,
                    });
                }
            } catch (err) {
                console.error("Dashboard stats error:", err);
            } finally {
                setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [currentYear]);

    return (
        <div className="container-fluid px-0">
            {/* Hero Welcome Banner (Website Brand Theme) */}
            <div
                className="card border-0 text-white mb-4 shadow-sm overflow-hidden"
                style={{
                    background: "linear-gradient(135deg, #062f38 0%, #0a4a55 60%, #009688 100%)",
                    borderRadius: "16px",
                }}
            >
                <div className="card-body p-4 p-md-5 position-relative">
                    <div className="row align-items-center g-3">
                        <div className="col-lg-8">
                            <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill mb-3" style={{ background: "rgba(255, 255, 255, 0.15)", backdropFilter: "blur(4px)" }}>
                                <Sparkles size={14} className="text-warning" />
                                <span className="small fw-semibold text-white">
                                    {isCoach ? "Coach Workspace Portal" : isAccountant ? "Accounts & Finance Portal" : isBranchAdmin ? "Branch Admin Portal" : isAcademyAdmin ? "Academy Admin Portal" : "CST Pro Cricket Academy Workspace"}
                                </span>
                            </div>
                            <h2 className="display-6 fw-bold mb-2 text-white">
                                Welcome back, {displayName}!
                            </h2>
                            <p className="text-white-50 mb-4" style={{ maxWidth: "620px", fontSize: "0.95rem" }}>
                                {isCoach
                                    ? "Manage your assigned batches, view enrolled players, record attendance, and monitor players with pending or partial fee dues."
                                    : isAccountant
                                    ? "Track player program fee invoices, monthly collection matrices, ground payments, and fee receipts in real-time."
                                    : isBranchAdmin
                                    ? "Manage your branch batches, players, ground bookings, and fee statuses seamlessly."
                                    : "Monitor player admissions, coaching batch assignments, 1:1 training schedules, and track monthly fee collections in real-time."}
                            </p>
                            <div className="d-flex flex-wrap gap-2">
                                {isCoach ? (
                                    <>
                                        <Link
                                            href="/next_panel/batches"
                                            className="btn btn-light fw-bold text-dark px-3 py-2 shadow-sm d-inline-flex align-items-center gap-2"
                                            style={{ borderRadius: "8px" }}
                                        >
                                            <Layers size={16} /> My Batches
                                        </Link>
                                        <Link
                                            href="/next_panel/batch-players"
                                            className="btn btn-outline-light px-3 py-2 d-inline-flex align-items-center gap-2"
                                            style={{ borderRadius: "8px" }}
                                        >
                                            <Users size={16} /> My Players
                                        </Link>
                                        <Link
                                            href="/next_panel/player-attendance"
                                            className="btn btn-outline-light px-3 py-2 d-inline-flex align-items-center gap-2"
                                            style={{ borderRadius: "8px" }}
                                        >
                                            <UserCheck size={16} /> Attendance
                                        </Link>
                                        <Link
                                            href="/next_panel/player-program-fees"
                                            className="btn btn-outline-light px-3 py-2 d-inline-flex align-items-center gap-2"
                                            style={{ borderRadius: "8px" }}
                                        >
                                            <CreditCard size={16} /> Fee Dues
                                        </Link>
                                    </>
                                ) : isAccountant ? (
                                    <>
                                        <Link
                                            href="/next_panel/player-fees-matrix"
                                            className="btn btn-light fw-bold text-dark px-3 py-2 shadow-sm d-inline-flex align-items-center gap-2"
                                            style={{ borderRadius: "8px" }}
                                        >
                                            <Calendar size={16} /> Fees Matrix ({currentYear})
                                        </Link>
                                        <Link
                                            href="/next_panel/player-program-fees"
                                            className="btn btn-outline-light px-3 py-2 d-inline-flex align-items-center gap-2"
                                            style={{ borderRadius: "8px" }}
                                        >
                                            <Receipt size={16} /> Program Fees
                                        </Link>
                                        <Link
                                            href="/next_panel/player-payments"
                                            className="btn btn-outline-light px-3 py-2 d-inline-flex align-items-center gap-2"
                                            style={{ borderRadius: "8px" }}
                                        >
                                            <CheckCircle2 size={16} /> Receipts
                                        </Link>
                                    </>
                                ) : (
                                    <>
                                        <Link
                                            href="/next_panel/player-fees-matrix"
                                            className="btn btn-light fw-bold text-dark px-3 py-2 shadow-sm d-inline-flex align-items-center gap-2"
                                            style={{ borderRadius: "8px" }}
                                        >
                                            <Calendar size={16} /> Fees Matrix ({currentYear})
                                        </Link>
                                        <Link
                                            href="/next_panel/individual-training"
                                            className="btn btn-outline-light px-3 py-2 d-inline-flex align-items-center gap-2"
                                            style={{ borderRadius: "8px" }}
                                        >
                                            <Activity size={16} /> 1:1 Training
                                        </Link>
                                        <Link
                                            href="/next_panel/admission-players"
                                            className="btn btn-outline-light px-3 py-2 d-inline-flex align-items-center gap-2"
                                            style={{ borderRadius: "8px" }}
                                        >
                                            <Users size={16} /> Players
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="col-lg-4 text-center d-none d-lg-block">
                            <div className="p-3 bg-white rounded-3 d-inline-block shadow" style={{ maxWidth: "200px" }}>
                                <img
                                    src="/images/website/logo.png"
                                    alt="CST Pro"
                                    className="img-fluid"
                                    style={{ maxHeight: "75px" }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Metrics KPI Cards */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card h-100 border-0 shadow-sm border-start border-4 border-primary">
                        <div className="card-body p-3 p-md-4">
                            <div className="d-flex justify-content-between align-items-start">
                                <div>
                                    <span className="text-muted small fw-semibold text-uppercase">Admitted Players</span>
                                    <h3 className="fw-bold text-dark mt-2 mb-0">
                                        {loading ? <span className="spinner-border spinner-border-sm text-muted" role="status" /> : stats.playersCount}
                                    </h3>
                                </div>
                                <div className="p-2 rounded-3" style={{ background: "rgba(6, 47, 56, 0.08)", color: "#062f38" }}>
                                    <Users size={22} />
                                </div>
                            </div>
                            <div className="mt-3 small">
                                <Link href="/next_panel/admission-players" className="text-decoration-none fw-semibold text-primary d-inline-flex align-items-center gap-1">
                                    Manage players <ArrowRight size={13} />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card h-100 border-0 shadow-sm border-start border-4 border-info">
                        <div className="card-body p-3 p-md-4">
                            <div className="d-flex justify-content-between align-items-start">
                                <div>
                                    <span className="text-muted small fw-semibold text-uppercase">Training Batches</span>
                                    <h3 className="fw-bold text-dark mt-2 mb-0">
                                        {loading ? <span className="spinner-border spinner-border-sm text-muted" role="status" /> : stats.batchesCount}
                                    </h3>
                                </div>
                                <div className="p-2 rounded-3" style={{ background: "rgba(0, 188, 212, 0.1)", color: "#008ba3" }}>
                                    <Layers size={22} />
                                </div>
                            </div>
                            <div className="mt-3 small">
                                <Link href="/next_panel/batches" className="text-decoration-none fw-semibold text-info d-inline-flex align-items-center gap-1">
                                    View batches <ArrowRight size={13} />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card h-100 border-0 shadow-sm border-start border-4 border-success">
                        <div className="card-body p-3 p-md-4">
                            <div className="d-flex justify-content-between align-items-start">
                                <div>
                                    <span className="text-muted small fw-semibold text-uppercase">{currentYear} Fees Collected</span>
                                    <h3 className="fw-bold text-success mt-2 mb-0">
                                        {loading ? <span className="spinner-border spinner-border-sm text-muted" role="status" /> : `₹${Number(stats.matrixStats?.totalYearPaid || 0).toLocaleString("en-IN")}`}
                                    </h3>
                                </div>
                                <div className="p-2 rounded-3" style={{ background: "rgba(0, 150, 136, 0.1)", color: "#009688" }}>
                                    <CheckCircle2 size={22} />
                                </div>
                            </div>
                            <div className="mt-3 small">
                                <Link href="/next_panel/player-payments" className="text-decoration-none fw-semibold text-success d-inline-flex align-items-center gap-1">
                                    View receipts <ArrowRight size={13} />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card h-100 border-0 shadow-sm border-start border-4 border-danger">
                        <div className="card-body p-3 p-md-4">
                            <div className="d-flex justify-content-between align-items-start">
                                <div>
                                    <span className="text-muted small fw-semibold text-uppercase">{currentYear} Outstanding Due</span>
                                    <h3 className="fw-bold text-danger mt-2 mb-0">
                                        {loading ? <span className="spinner-border spinner-border-sm text-muted" role="status" /> : `₹${Number(stats.matrixStats?.totalYearDue || 0).toLocaleString("en-IN")}`}
                                    </h3>
                                </div>
                                <div className="p-2 rounded-3" style={{ background: "rgba(215, 38, 61, 0.1)", color: "#d7263d" }}>
                                    <Clock size={22} />
                                </div>
                            </div>
                            <div className="mt-3 small">
                                <Link href="/next_panel/player-fees-matrix" className="text-decoration-none fw-semibold text-danger d-inline-flex align-items-center gap-1">
                                    Open fees matrix <ArrowRight size={13} />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions & Navigation Grid */}
            <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-white py-3">
                    <h5 className="mb-0 fw-bold text-dark">Quick Management Hub</h5>
                    <small className="text-muted">Frequently used academy operations and direct portals</small>
                </div>
                <div className="card-body p-3 p-md-4">
                    <div className="row g-3">
                        <div className="col-6 col-md-4 col-lg-3">
                            <Link href="/next_panel/player-fees-matrix" className="text-decoration-none text-dark d-block p-3 rounded-3 border h-100 hover-card bg-light">
                                <div className="p-2 rounded-2 bg-primary text-white d-inline-block mb-2">
                                    <Calendar size={18} />
                                </div>
                                <div className="fw-bold mb-1">Fees Matrix</div>
                                <div className="text-muted small">Yearly monthly fees sheet (Jan–Dec)</div>
                            </Link>
                        </div>

                        <div className="col-6 col-md-4 col-lg-3">
                            <Link href="/next_panel/individual-training" className="text-decoration-none text-dark d-block p-3 rounded-3 border h-100 hover-card bg-light">
                                <div className="p-2 rounded-2 bg-info text-white d-inline-block mb-2">
                                    <Activity size={18} />
                                </div>
                                <div className="fw-bold mb-1">1:1 Training</div>
                                <div className="text-muted small">Dedicated personal coach allotment</div>
                            </Link>
                        </div>

                        <div className="col-6 col-md-4 col-lg-3">
                            <Link href="/next_panel/batch-coaches" className="text-decoration-none text-dark d-block p-3 rounded-3 border h-100 hover-card bg-light">
                                <div className="p-2 rounded-2 bg-dark text-white d-inline-block mb-2">
                                    <UserCheck size={18} />
                                </div>
                                <div className="fw-bold mb-1">Batch Coaches</div>
                                <div className="text-muted small">Assign Head & Specialist coaches</div>
                            </Link>
                        </div>

                        <div className="col-6 col-md-4 col-lg-3">
                            <Link href="/next_panel/admission-players" className="text-decoration-none text-dark d-block p-3 rounded-3 border h-100 hover-card bg-light">
                                <div className="p-2 rounded-2 bg-success text-white d-inline-block mb-2">
                                    <Users size={18} />
                                </div>
                                <div className="fw-bold mb-1">Admissions</div>
                                <div className="text-muted small">Register players & track programs</div>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .hover-card {
                    transition: all 0.2s ease;
                }
                .hover-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 18px rgba(6, 47, 56, 0.08);
                    border-color: #00bcd4 !important;
                }
            `}</style>
        </div>
    );
}
