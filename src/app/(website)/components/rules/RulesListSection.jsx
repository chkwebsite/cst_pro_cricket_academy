"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    CreditCard,
    HeartPulse,
    Search,
    ShieldAlert,
    ShieldCheck,
    Shirt,
    Users,
    X,
    XCircle,
} from "lucide-react";

// -----------------------------------------------------------------------------
// CORE PILLARS DATA
// -----------------------------------------------------------------------------
const CORE_PILLARS = [
    {
        icon: ShieldCheck,
        colorClass: "bg-primary bg-opacity-10 text-primary",
        title: "Discipline & Integrity",
        desc: "Respect for coaches, teammates, and umpires. Upholding the true spirit of cricket on and off the field.",
    },
    {
        icon: HeartPulse,
        colorClass: "bg-danger bg-opacity-10 text-danger",
        title: "Safety & Gear First",
        desc: "Compulsory protective armor, certified helmets, and strict safety guidelines in all net and turf sessions.",
    },
    {
        icon: Clock,
        colorClass: "bg-info bg-opacity-10 text-info",
        title: "Punctuality & Dedication",
        desc: "Report 15 minutes early for warm-ups. Minimum 75% attendance mandatory for match team selection.",
    },
    {
        icon: Users,
        colorClass: "bg-success bg-opacity-10 text-success",
        title: "Positive Environment",
        desc: "Zero tolerance for bullying, foul language, or misconduct. A safe, nurturing community for every player.",
    },
];

// -----------------------------------------------------------------------------
// RULES CATEGORIES DATA
// -----------------------------------------------------------------------------
const DEFAULT_RULES = [
    {
        id: "conduct",
        category: "General Code of Conduct",
        icon: ShieldCheck,
        iconBg: "bg-primary bg-opacity-10 text-primary",
        summary: "Fundamental guidelines for maintaining discipline, teamwork, and sportsman spirit.",
        points: [
            "Students must strictly follow coaches and ground staff instructions unconditionally at all times.",
            "Display utmost respect towards teammates, coaches, match officials, opponents, and ground staff.",
            "Academy equipment, turf pitches, practice nets, and bowling machines must be handled with care and respect.",
            "Strictly no mobile phones or entertainment devices allowed on the field or inside the nets during sessions.",
            "Maintain cleanliness on the ground; dispose of tapes, water bottles, and wrappers in designated trash bins.",
            "Players are strictly expected to refrain from arguments with umpires or unsporting gestures in practice matches.",
        ],
    },
    {
        id: "attendance",
        category: "Attendance & Punctuality",
        icon: Clock,
        iconBg: "bg-info bg-opacity-10 text-info",
        summary: "Guidelines on reporting times, leaves, consistency, and tournament selection criteria.",
        points: [
            "Players must arrive at the ground at least 10–15 minutes prior to their assigned batch timing for dynamic warm-ups.",
            "Late arrivals by more than 15 minutes may be restricted from batting/bowling nets to avoid injury from skipped warm-ups.",
            "Prior written or WhatsApp notification to the head coach or branch coordinator is required for any leave of absence.",
            "A minimum of 75% monthly attendance is mandatory to receive quarterly skill assessments and match selection eligibility.",
            "Frequent unexplained absenteeism may result in forfeiture of allocated training slots or batch rescheduling.",
        ],
    },
    {
        id: "dresscode",
        category: "Dress Code & Protective Equipment",
        icon: Shirt,
        iconBg: "bg-warning bg-opacity-10 text-warning",
        summary: "Mandatory academy attire, footwear, and protective armor required for training.",
        points: [
            "All trainees must report in official CST Cricket Academy practice kit (or clean cricket whites as specified).",
            "Appropriate cricket rubber-stud shoes (or spikes on designated turf pitches only) are strictly mandatory.",
            "Batters MUST wear an approved cricket helmet, batting gloves, leg guards, thigh pad, and abdominal guard in nets.",
            "Wicketkeepers must wear keeping gloves, inners, abdominal guard, and keeping pads at all times during drills.",
            "Players must carry their own labeled water bottles, sweat towels, cricket caps, and sun protection for daytime sessions.",
        ],
    },
    {
        id: "safety",
        category: "Health, Safety & Injury Protocol",
        icon: HeartPulse,
        iconBg: "bg-danger bg-opacity-10 text-danger",
        summary: "Protocols ensuring medical readiness, concussion safety, and emergency response.",
        points: [
            "Immediately report any pain, muscle sprain, dizziness, or injury to the on-duty coach or academy physiotherapist.",
            "Strictly no crossing or walking behind active net bowling lanes while bowling machines or bowlers are in operation.",
            "All pre-existing medical conditions, allergies, or physical restrictions must be formally disclosed at admission.",
            "First aid kits, ice compresses, and emergency medical contacts are permanently stationed on-site across all branches.",
            "A player recovering from a significant injury must provide medical clearance before resuming full-pace training.",
        ],
    },
    {
        id: "fees",
        category: "Fees, Billing & Membership Policies",
        icon: CreditCard,
        iconBg: "bg-secondary bg-opacity-10 text-secondary",
        summary: "Details on fee deadlines, refund policies, and academy membership terms.",
        points: [
            "Academy training fees are payable in advance on or before the 10th of every calendar month.",
            "Fees once paid are strictly non-refundable and non-transferable under any circumstances.",
            "Residential hostel trainees and high-performance academy camp students follow their dedicated contractual schedules.",
            "Non-payment of fees for more than 15 days past the deadline may lead to temporary suspension of batch allocation.",
            "Official receipts are issued digitally upon payment clearance via UPI, bank transfer, or card payments.",
        ],
    },
    {
        id: "parents",
        category: "Parents, Guardians & Visitors Guidelines",
        icon: Users,
        iconBg: "bg-success bg-opacity-10 text-success",
        summary: "Ensuring an encouraging, uninterrupted learning atmosphere for all young athletes.",
        points: [
            "Parents and visitors must observe training sessions solely from designated spectator galleries or pavilion areas.",
            "Parents are strictly requested not to coach or shout tactical instructions from the boundary during practice sessions.",
            "Entering the pitch, net lanes, team dugout, or fitness gym while coaching is active is strictly prohibited.",
            "Parent-coach performance reviews should be pre-scheduled with the branch manager outside active training hours.",
            "Positive encouragement is expected; abusive language toward players, coaches, or rival teams will not be tolerated.",
        ],
    },
];

// -----------------------------------------------------------------------------
// DO'S AND DON'TS DATA
// -----------------------------------------------------------------------------
const DOS_LIST = [
    "Arrive 15 minutes before session in full academy kit and cricket shoes.",
    "Wear helmet, pads, gloves, and abdominal guard before entering batting nets.",
    "Warm up thoroughly and stretch after every session to prevent injury.",
    "Support and cheer for your academy teammates during practice and matches.",
    "Keep all personal equipment clearly labeled inside your kit bag.",
    "Hydrate consistently before, during, and after intensive drills.",
];

const DONTS_LIST = [
    "Do NOT use mobile phones, headphones, or smart devices during practice.",
    "Do NOT enter or walk behind active bowling nets without coach permission.",
    "Zero tolerance for foul language, sledging, swearing, or bullying.",
    "Do NOT touch or adjust bowling machines without coach supervision.",
    "Parents must NOT enter the pitch, nets, or dugout during active sessions.",
    "Do NOT leave personal trash, bottle caps, or tape on the cricket field.",
];

export default function RulesListSection({
    tag = "Academy Standards",
    title = "Rules & Code of Conduct",
    subtitle = "Our official policies and standards are designed to nurture world-class cricketers within a culture of discipline, safety, sportsmanship, and mutual respect.",
}) {
    // State
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [openCategories, setOpenCategories] = useState({
        conduct: true,
        attendance: true,
    });

    // Toggle single category
    const toggleCategory = (id) => {
        setOpenCategories((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
    };

    // Expand all / Collapse all
    const handleExpandAll = () => {
        const nextState = {};
        DEFAULT_RULES.forEach((r) => {
            nextState[r.id] = true;
        });
        setOpenCategories(nextState);
    };

    const handleCollapseAll = () => {
        setOpenCategories({});
    };

    // Filter rules by category and search query
    const filteredRules = useMemo(() => {
        return DEFAULT_RULES.filter((rule) => {
            // Category filter
            if (selectedCategory !== "all" && rule.id !== selectedCategory) {
                return false;
            }

            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const inTitle = rule.category.toLowerCase().includes(q);
                const inSummary = rule.summary.toLowerCase().includes(q);
                const inPoints = rule.points.some((p) => p.toLowerCase().includes(q));
                if (!inTitle && !inSummary && !inPoints) return false;
            }

            return true;
        });
    }, [selectedCategory, searchQuery]);

    return (
        <section className="py-5 bg-white">
            <div className="container">
                {/* Heading */}
                <div className="text-center mb-5 reveal">
                    <span className="section-tag">{tag}</span>
                    <h2 className="section-title">{title}</h2>
                    <div className="divider"></div>
                    {subtitle && (
                        <p className="text-secondary max-w-700 mx-auto">
                            {subtitle}
                        </p>
                    )}
                </div>

                {/* 1. CORE PILLARS BANNER (Top 4 Highlight Cards) */}
                <div className="row g-4 mb-5">
                    {CORE_PILLARS.map((pillar, idx) => {
                        const Icon = pillar.icon;
                        return (
                            <div className="col-12 col-sm-6 col-lg-3" key={`pillar-${idx}`}>
                                <div className="rules-hero-card">
                                    <div className={`rules-hero-icon ${pillar.colorClass}`}>
                                        <Icon size={26} />
                                    </div>
                                    <h5 className="fw-bold text-navy mb-2">{pillar.title}</h5>
                                    <p className="text-secondary small mb-0 flex-grow-1">
                                        {pillar.desc}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* 2. SEARCH & CATEGORY FILTER BAR */}
                <div className="bg-light rounded-4 p-3 p-md-4 mb-4 shadow-sm">
                    <div className="row g-3 align-items-center justify-content-between mb-3">
                        <div className="col-12 col-md-6 col-lg-5">
                            <div className="rules-search-bar">
                                <Search size={18} className="text-muted" />
                                <input
                                    type="text"
                                    className="rules-search-input"
                                    placeholder="Search rules (e.g., helmet, mobile, attendance, fees)..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-link text-muted p-0"
                                        onClick={() => setSearchQuery("")}
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Expand / Collapse All */}
                        <div className="col-12 col-md-auto d-flex align-items-center gap-2">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-dark rounded-pill px-3"
                                onClick={handleExpandAll}
                            >
                                Expand All
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                                onClick={handleCollapseAll}
                            >
                                Collapse All
                            </button>
                        </div>
                    </div>

                    {/* Filter Pills */}
                    <div className="d-flex flex-wrap gap-2 pt-2 border-top">
                        <button
                            type="button"
                            className={`rules-tab-btn ${selectedCategory === "all" ? "active" : ""}`}
                            onClick={() => setSelectedCategory("all")}
                        >
                            All Guidelines ({DEFAULT_RULES.length})
                        </button>
                        {DEFAULT_RULES.map((cat) => (
                            <button
                                key={`tab-${cat.id}`}
                                type="button"
                                className={`rules-tab-btn ${selectedCategory === cat.id ? "active" : ""}`}
                                onClick={() => setSelectedCategory(cat.id)}
                            >
                                {cat.category}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 3. RULES ACCORDION LIST */}
                <div className="mb-5">
                    {filteredRules.length === 0 ? (
                        <div className="text-center py-5 bg-light rounded-4">
                            <AlertCircle size={44} className="text-secondary opacity-50 mb-3 mx-auto" />
                            <h5>No matching rules found</h5>
                            <p className="text-muted small">
                                Try searching for another keyword or reset the category filter.
                            </p>
                            <button
                                type="button"
                                className="btn btn-sm btn-red"
                                onClick={() => {
                                    setSearchQuery("");
                                    setSelectedCategory("all");
                                }}
                            >
                                Reset Filter
                            </button>
                        </div>
                    ) : (
                        filteredRules.map((rule) => {
                            const Icon = rule.icon;
                            const isExpanded = !!openCategories[rule.id];

                            return (
                                <div className="rules-category-card" key={`rule-box-${rule.id}`}>
                                    {/* Header Button */}
                                    <button
                                        type="button"
                                        className={`rules-accordion-btn ${isExpanded ? "expanded" : ""}`}
                                        onClick={() => toggleCategory(rule.id)}
                                        aria-expanded={isExpanded}
                                    >
                                        <div className="d-flex align-items-center gap-3">
                                            <div className={`rules-cat-icon ${rule.iconBg}`}>
                                                <Icon size={22} />
                                            </div>
                                            <div>
                                                <h5 className="fw-bold mb-1 text-navy text-start">
                                                    {rule.category}
                                                </h5>
                                                <p className="text-secondary small mb-0 text-start d-none d-sm-block">
                                                    {rule.summary}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="d-flex align-items-center gap-2">
                                            <span className="badge bg-light text-dark border small d-none d-md-inline-block">
                                                {rule.points.length} Points
                                            </span>
                                            {isExpanded ? (
                                                <ChevronUp size={20} className="text-red" />
                                            ) : (
                                                <ChevronDown size={20} className="text-secondary" />
                                            )}
                                        </div>
                                    </button>

                                    {/* Body */}
                                    {isExpanded && (
                                        <div className="p-3 p-md-4 bg-white">
                                            <div className="row g-2">
                                                {rule.points.map((pt, pIdx) => (
                                                    <div className="col-12" key={`pt-${rule.id}-${pIdx}`}>
                                                        <div className="rules-point-row">
                                                            <div className="rules-point-check">
                                                                <CheckCircle2 size={16} />
                                                            </div>
                                                            <div className="text-secondary" style={{ fontSize: "0.95rem", lineHeight: "1.6" }}>
                                                                {pt}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* 4. DO'S AND DON'TS SIDE-BY-SIDE SECTION */}
                <div className="mb-5">
                    <div className="text-center mb-4">
                        <span className="section-tag">Quick Reference</span>
                        <h3 className="fw-bold text-navy">Ground Do&apos;s &amp; Don&apos;ts</h3>
                        <p className="text-secondary small">
                            A quick checklist for every player before stepping onto the training turf.
                        </p>
                    </div>

                    <div className="row g-4">
                        {/* DO'S COLUMN */}
                        <div className="col-12 col-md-6">
                            <div className="rules-dos-box">
                                <div className="d-flex align-items-center gap-2 mb-3 pb-2 border-bottom border-success border-opacity-25">
                                    <CheckCircle2 size={24} className="text-success" />
                                    <h4 className="fw-bold text-success mb-0">Always DO</h4>
                                </div>
                                <div className="d-flex flex-column gap-3">
                                    {DOS_LIST.map((item, idx) => (
                                        <div className="d-flex align-items-start gap-2" key={`do-${idx}`}>
                                            <CheckCircle2 size={18} className="text-success flex-shrink-0 mt-1" />
                                            <span className="text-secondary small fw-medium">{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* DON'TS COLUMN */}
                        <div className="col-12 col-md-6">
                            <div className="rules-donts-box">
                                <div className="d-flex align-items-center gap-2 mb-3 pb-2 border-bottom border-danger border-opacity-25">
                                    <XCircle size={24} className="text-danger" />
                                    <h4 className="fw-bold text-danger mb-0">Strictly DON&apos;T</h4>
                                </div>
                                <div className="d-flex flex-column gap-3">
                                    {DONTS_LIST.map((item, idx) => (
                                        <div className="d-flex align-items-start gap-2" key={`dont-${idx}`}>
                                            <XCircle size={18} className="text-danger flex-shrink-0 mt-1" />
                                            <span className="text-secondary small fw-medium">{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 5. ZERO TOLERANCE POLICY CALLOUT */}
                <div className="rules-zero-tolerance mb-5">
                    <div className="row align-items-center g-3">
                        <div className="col-12 col-md-auto text-center text-md-start">
                            <div className="rules-hero-icon bg-danger text-white mx-auto mx-md-0 mb-0">
                                <ShieldAlert size={28} />
                            </div>
                        </div>
                        <div className="col-12 col-md">
                            <h4 className="fw-bold text-danger mb-1">
                                Strict Zero-Tolerance Policy
                            </h4>
                            <p className="text-secondary mb-0 small">
                                CST Cricket Academy maintains zero tolerance toward bullying, verbal abuse, hazing, substance abuse, and deliberate property damage. Any player or affiliate violating these core values faces immediate disciplinary review, suspension, or expulsion.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 6. SUPPORT & CONTACT HELP CARD */}
                <div className="rules-help-box">
                    <div className="row g-4 align-items-center justify-content-between">
                        <div className="col-12 col-lg-8">
                            <span className="badge bg-red text-white mb-2 px-3 py-1">
                                Need Assistance?
                            </span>
                            <h3 className="fw-bold text-white mb-2">
                                Have Questions Regarding Policies or Registrations?
                            </h3>
                            <p className="text-white-50 mb-0">
                                Our administration team and head coaches are available to assist with medical disclosures, batch schedules, or fee clarifications.
                            </p>
                        </div>
                        <div className="col-12 col-lg-4 d-flex flex-wrap gap-2 justify-content-lg-end">
                            <Link href="/contact" className="btn btn-red px-4 py-2">
                                Contact Helpdesk <ArrowRight size={16} className="ms-1" />
                            </Link>
                            <Link href="/programs" className="btn btn-outline-light px-4 py-2">
                                View Programs
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
