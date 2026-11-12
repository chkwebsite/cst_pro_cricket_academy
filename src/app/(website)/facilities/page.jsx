import PageHeader from "../components/layout/PageHeader";
import Link from "next/link";
import {
    Activity,
    Award,
    Check,
    Coffee,
    Compass,
    Cpu,
    Dumbbell,
    Home,
    Layers,
    MapPin,
    Shield,
    Sparkles,
    Sun,
    Video,
    Zap,
} from "lucide-react";

export const metadata = {
    title: "World-Class Cricket Facilities & Campus | CST Cricket Academy",
    description:
        "Explore international-standard turf wickets, computerized bowling machines, floodlit grounds, high-tech video analysis labs, indoor practice nets, and athlete fitness gym at CST Cricket Academy.",
    keywords: [
        "Cricket Facilities",
        "Turf Wickets Cricket",
        "Bowling Machine Practice Nets",
        "Floodlight Cricket Ground",
        "Video Analysis Cricket Coaching",
        "Indoor Cricket Nets",
        "Cricket Fitness Gym",
        "Cricket Academy Campus",
    ],
    openGraph: {
        title: "World-Class Cricket Facilities & Campus | CST Cricket Academy",
        description:
            "International-standard turf wickets, computerized bowling machines, floodlit grounds, and video analysis labs.",
    },
};

const FACILITIES_DATA = [
    {
        id: "turf-pitches",
        icon: Layers,
        badge: "Ground Infrastructure",
        title: "International Standard Turf Pitches",
        description: "Prepared with authentic black and red soil by seasoned BCCI-level curators to replicate domestic and international pitch conditions.",
        features: [
            "6 Match-standard natural turf wickets",
            "Dedicated spin and pace-friendly pitches",
            "Full 30-yard and boundary grass outfield",
            "Daily rolled and moisture-controlled preparation",
        ],
    },
    {
        id: "bowling-machines",
        icon: Cpu,
        badge: "Modern Tech",
        title: "Programmable High-Speed Bowling Machines",
        description: "State-of-the-art dual-wheel bowling machines capable of delivering precision line and length drills at speeds from 60 km/h to 145 km/h.",
        features: [
            "Outswing, inswing, off-spin & leg-cutters",
            "Bouncer and yorker repetition simulation",
            "Remote digital controls with custom coaching routines",
            "Heavy leather and dimpled practice ball compatibility",
        ],
    },
    {
        id: "night-floodlights",
        icon: Zap,
        badge: "Night Matches",
        title: "Tournament Grade LED Floodlights",
        description: "High-lux shadow-free LED floodlighting system installed across our main match ground and training nets for uninterrupted evening coaching and night corporate cups.",
        features: [
            "HD broadcast-grade lux output",
            "Zero flicker for accurate night sight of the white ball",
            "Complete coverage of batsman, bowler runup and outfield",
            "Slots available 6:00 PM to 11:30 PM",
        ],
    },
    {
        id: "video-analysis",
        icon: Video,
        badge: "Biomechanical",
        title: "High-Speed Video Analysis & Biomechanics Lab",
        description: "Slow-motion multi-angle cameras capture player batting stance, backlift, trigger movement, and bowling release point for scientific coach feedback.",
        features: [
            "Frame-by-frame bowling action review",
            "Bat swing trajectory and footwork analysis",
            "Coach voice-over reports shared on WhatsApp",
            "Quarterly skill progression benchmarking",
        ],
    },
    {
        id: "gym-fitness",
        icon: Dumbbell,
        badge: "Athletic Conditioning",
        title: "Cricket-Specific Strength & Conditioning Gym",
        description: "Equipped specifically for cricketer athletic conditioning — core strength, shoulder rotational power, sprint agility, and injury prevention.",
        features: [
            "Plyometric jump boxes, agility ladders & hurdles",
            "Resistance bands and functional training rigs",
            "Certified sports physiotherapist support",
            "Personalized workout routines for fast bowlers and batsmen",
        ],
    },
    {
        id: "hostel-mess",
        icon: Home,
        badge: "Outstation Players",
        title: "On-Campus Hostel & Hygienic Sports Cafeteria",
        description: "Secure, fully supervised residential facility located right at our Maruti Kunj campus for outstation players traveling from Delhi NCR, Haryana, UP, and across India.",
        features: [
            "Air-conditioned student dormitory and shared rooms",
            "High-protein athletic meals planned by sports nutritionists",
            "24/7 CCTV surveillance and resident warden",
            "Study rooms for players balancing academic schooling",
        ],
    },
];

export default function FacilitiesPage() {
    return (
        <>
            <PageHeader
                title="Academy Facilities"
                breadcrumbs={[{ label: "Home", href: "/" }]}
                current="Facilities"
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
                                    Infrastructure Excellence
                                </span>
                                <h1 className="fw-bold mb-2 text-white font-oswald text-uppercase display-5">
                                    World-Class Cricket Infrastructure
                                </h1>
                                <p className="lead mb-0 text-white-50" style={{ maxWidth: "600px", fontSize: "1.05rem" }}>
                                    Built to professional domestic standards. Everything a cricketer needs to develop elite technique, athletic fitness, and competitive match confidence.
                                </p>
                            </div>
                            <div className="col-lg-4 text-lg-end mt-3 mt-lg-0">
                                <Link
                                    href="/book-free-trial"
                                    className="btn btn-light fw-bold px-4 py-2.5 rounded-pill shadow-sm"
                                >
                                    Book a Facility Tour
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Facility Cards Grid */}
                    <div className="row g-4">
                        {FACILITIES_DATA.map((fac) => {
                            const IconComponent = fac.icon;
                            return (
                                <div key={fac.id} className="col-12 col-md-6 col-lg-4">
                                    <div className="card h-100 border-0 rounded-4 shadow-sm overflow-hidden bg-white p-4 d-flex flex-column justify-content-between transition-card">
                                        <div>
                                            {/* Icon & Badge */}
                                            <div className="d-flex align-items-center justify-content-between mb-3">
                                                <div
                                                    className="p-3 rounded-circle"
                                                    style={{ background: "#e0f2f1", color: "#004d40" }}
                                                >
                                                    <IconComponent size={26} />
                                                </div>
                                                <span className="badge bg-light text-muted border rounded-pill px-2.5 py-1 small">
                                                    {fac.badge}
                                                </span>
                                            </div>

                                            {/* Title */}
                                            <h4 className="fw-bold font-oswald text-uppercase text-dark mb-2">
                                                {fac.title}
                                            </h4>

                                            {/* Description */}
                                            <p className="text-muted small mb-3" style={{ lineHeight: "1.6" }}>
                                                {fac.description}
                                            </p>

                                            {/* Bullet Points */}
                                            <div className="d-flex flex-column gap-2 mb-3">
                                                {fac.features.map((feat, idx) => (
                                                    <div key={idx} className="d-flex align-items-start gap-2 small text-secondary">
                                                        <Check size={14} className="text-success flex-shrink-0 mt-1" />
                                                        <span>{feat}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="pt-3 border-top mt-auto">
                                            <Link
                                                href="/book-free-trial"
                                                className="small fw-semibold text-success text-decoration-none d-flex align-items-center gap-1"
                                            >
                                                <span>Experience in Free Trial</span> &rarr;
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Ground Booking CTA Strip */}
                    <div className="mt-5 p-4 p-md-5 rounded-4 bg-white shadow-sm border d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-4">
                        <div>
                            <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-1 rounded-pill small fw-bold text-uppercase mb-2">
                                Available for Corporate &amp; Club Matches
                            </span>
                            <h3 className="fw-bold font-oswald text-uppercase text-dark mb-1">
                                Looking to Book a Turf Match Slot?
                            </h3>
                            <p className="text-muted small mb-0" style={{ maxWidth: "600px" }}>
                                Reserve our full match grounds and practice turf nets with white/red balls, electronic scoreboards, and umpire support.
                            </p>
                        </div>
                        <div className="d-flex align-items-center gap-3 flex-wrap">
                            <Link href="/ground-booking" className="btn btn-dark rounded-pill px-4 py-2.5 fw-semibold">
                                View Available Slots
                            </Link>
                            <a href="tel:+918285831503" className="btn btn-outline-success rounded-pill px-4 py-2.5 fw-semibold">
                                Call Coordinator
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
