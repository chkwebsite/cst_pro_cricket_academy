import PageHeader from "../components/layout/PageHeader";
import Link from "next/link";
import {
    Award,
    Calendar,
    CheckCircle2,
    Crown,
    Medal,
    Shield,
    Sparkles,
    Star,
    Target,
    Trophy,
    Users,
} from "lucide-react";

export const metadata = {
    title: "Achievements & Hall of Fame | CST Cricket Academy",
    description:
        "Celebrate the remarkable milestones, state selections, Ranji & IPL prodigies, championship trophies, and player honors at CST Cricket Academy's Hall of Fame.",
    keywords: [
        "Cricket Academy Achievements",
        "Cricket Hall of Fame",
        "State Level Cricket Selections",
        "Ranji Trophy Selections",
        "Cricket Championship Trophies",
        "Youth Cricket Prodigies",
        "Cricket Talent Records",
    ],
    openGraph: {
        title: "Achievements & Hall of Fame | CST Cricket Academy",
        description:
            "Celebrate the remarkable milestones, state selections, trophies, and player honors at CST Cricket Academy.",
    },
};

const STATS_DATA = [
    { number: "45+", label: "State & District Selections", sub: "BCCI & State affiliated" },
    { number: "22+", label: "Championship Trophies", sub: "U-14, U-16 & Open Cups" },
    { number: "18", label: "Centuries Scored in 2026", sub: "In official tournament matches" },
    { number: "12", label: "5-Wicket Hauls", sub: "By fast & spin prodigies" },
];

const STAR_PLAYERS = [
    {
        name: "Aman Sharma",
        badge: "Under-19 State Squad",
        role: "Right-Arm Fast Bowler",
        achievement: "Selected for Haryana State U-19 Camp. Clocked 134 km/h with 24 wickets in the Inter-District League.",
        year: "2026",
    },
    {
        name: "Rohan Verma",
        badge: "Under-16 District Captain",
        role: "Top-Order Batsman",
        achievement: "Leading run-scorer in Gurugram District Cup (412 runs in 6 matches including 2 unbeaten centuries).",
        year: "2026",
    },
    {
        name: "Sameer Khan",
        badge: "Vinoo Mankad Trophy Trial",
        role: "Wicket-Keeper Batsman",
        achievement: "Averaging 52.4 in state selection trials. Known for explosive middle-order finishing.",
        year: "2025",
    },
    {
        name: "Karan Singhal",
        badge: "Under-14 State Selection",
        role: "Left-Arm Orthodox Spinner",
        achievement: "Took 7 wickets for 18 runs in the State Championship Final, winning Player of the Tournament.",
        year: "2025",
    },
];

const TOURNAMENT_HONORS = [
    {
        title: "Champions — NCR Junior Premier Cup 2026",
        category: "Under-16 Division",
        desc: "Defeated Delhi Cricket Club by 48 runs in the final at Sports Mantra Ground.",
    },
    {
        title: "Winners — Gurugram Corporate Cricket League 2026",
        category: "Open Night Cup",
        desc: "Undefeated championship run across 8 high-stakes floodlit evening matches.",
    },
    {
        title: "Gold Medalists — Haryana Inter-Academy Championship",
        category: "Under-14 Category",
        desc: "Dominated the 16-team tournament with stellar team bowling and disciplined fielding.",
    },
];

export default function AchievementsPage() {
    return (
        <>
            <PageHeader
                title="Achievements & Hall of Fame"
                breadcrumbs={[{ label: "Home", href: "/" }]}
                current="Achievements"
            />

            <section className="py-5" style={{ background: "#f8fbfb", minHeight: "80vh" }}>
                <div className="container">
                    {/* Header Banner */}
                    <div
                        className="p-4 p-md-5 rounded-4 text-white mb-5 shadow-sm position-relative overflow-hidden"
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
                                    Proven Track Record
                                </span>
                                <h1 className="fw-bold mb-2 text-white font-oswald text-uppercase display-5">
                                    Our Champions &amp; Rising Stars
                                </h1>
                                <p className="lead mb-0 text-white-50" style={{ maxWidth: "600px", fontSize: "1.05rem" }}>
                                    Behind every trophy is dedicated early morning practice, expert coach mentoring, and relentless hard work on our turf wickets.
                                </p>
                            </div>
                            <div className="col-lg-4 text-lg-end mt-3 mt-lg-0">
                                <Link
                                    href="/book-free-trial"
                                    className="btn btn-light fw-bold px-4 py-2.5 rounded-pill shadow-sm"
                                >
                                    Start Your Journey
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Stats Counter Row */}
                    <div className="row g-3 mb-5">
                        {STATS_DATA.map((st, idx) => (
                            <div key={idx} className="col-6 col-lg-3">
                                <div className="card border-0 rounded-4 shadow-sm p-4 text-center bg-white h-100">
                                    <div
                                        className="fw-bold font-oswald display-5 mb-1"
                                        style={{ color: "#062f38" }}
                                    >
                                        {st.number}
                                    </div>
                                    <div className="fw-bold text-dark fs-6 mb-1">{st.label}</div>
                                    <div className="text-muted extra-small" style={{ fontSize: "0.78rem" }}>
                                        {st.sub}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Star Players Showcase */}
                    <div className="mb-5">
                        <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
                            <div>
                                <span className="badge bg-warning-subtle text-warning-emphasis rounded-pill px-3 py-1 fw-bold text-uppercase small mb-1">
                                    Player Spotlight
                                </span>
                                <h3 className="fw-bold font-oswald text-uppercase text-dark mb-0">
                                    Recent State &amp; District Selections
                                </h3>
                            </div>
                            <Link href="/programs" className="btn btn-outline-dark btn-sm rounded-pill px-3">
                                View Coaching Programs
                            </Link>
                        </div>

                        <div className="row g-4">
                            {STAR_PLAYERS.map((player, idx) => (
                                <div key={idx} className="col-12 col-md-6">
                                    <div className="card border-0 rounded-4 shadow-sm p-4 bg-white h-100 d-flex flex-column justify-content-between transition-card">
                                        <div>
                                            <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
                                                <div>
                                                    <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-1 small fw-bold mb-2">
                                                        {player.badge}
                                                    </span>
                                                    <h4 className="fw-bold text-dark font-oswald text-uppercase mb-1">
                                                        {player.name}
                                                    </h4>
                                                    <span className="text-muted small fw-semibold">
                                                        {player.role}
                                                    </span>
                                                </div>
                                                <div
                                                    className="p-2.5 rounded-circle"
                                                    style={{ background: "#fff9c4", color: "#f57f17" }}
                                                >
                                                    <Crown size={22} />
                                                </div>
                                            </div>

                                            <p className="text-secondary small mb-3" style={{ lineHeight: "1.7" }}>
                                                {player.achievement}
                                            </p>
                                        </div>

                                        <div className="pt-3 border-top d-flex align-items-center justify-content-between small text-muted">
                                            <span>Batch of {player.year}</span>
                                            <span className="fw-semibold text-dark">CST Cricket Academy</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Academy Trophies & Honors */}
                    <div className="card border-0 rounded-4 shadow-sm p-4 p-md-5 bg-white">
                        <div className="d-flex align-items-center gap-2 mb-4">
                            <Trophy size={28} className="text-warning" />
                            <div>
                                <h3 className="fw-bold font-oswald text-uppercase text-dark mb-0">
                                    Tournament Honors &amp; Cups
                                </h3>
                                <p className="text-muted small mb-0">Recent championships lifted by academy squads</p>
                            </div>
                        </div>

                        <div className="row g-3">
                            {TOURNAMENT_HONORS.map((h, idx) => (
                                <div key={idx} className="col-12 col-lg-4">
                                    <div className="p-3.5 rounded-3 bg-light h-100 border">
                                        <span className="badge bg-white text-dark border rounded-pill px-2.5 py-1 extra-small mb-2 fw-semibold">
                                            {h.category}
                                        </span>
                                        <h5 className="fw-bold font-oswald text-uppercase text-dark mb-1">
                                            {h.title}
                                        </h5>
                                        <p className="text-muted small mb-0">
                                            {h.desc}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
