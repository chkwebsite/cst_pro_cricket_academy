"use client";

import { useState, useMemo } from "react";
import PageHeader from "../components/layout/PageHeader";
import Link from "next/link";
import {
    ChevronDown,
    ChevronUp,
    HelpCircle,
    MessageCircle,
    Phone,
    Search,
    Sparkles,
} from "lucide-react";

const FAQ_LIST = [
    {
        category: "Admissions",
        q: "What is the minimum age to join CST Cricket Academy?",
        a: "We welcome budding cricketers starting from 5 years old in our Foundation Grassroots Program. We run specialized age-specific batches for Under-10, Under-12, Under-14, Under-16, Under-19, and Senior competitive players.",
    },
    {
        category: "Admissions",
        q: "Is it mandatory to bring a full cricket kit for the free trial session?",
        a: "No! For the initial trial session, your child just needs comfortable sports track pants, a t-shirt, and sports shoes. The academy provides basic bats, helmets, and practice balls for the trial. Once admitted, coaches will guide you on the ideal bat weight and kit requirements.",
    },
    {
        category: "Batches & Timing",
        q: "What are the coaching batch timings for school students?",
        a: "We operate both morning batches (6:00 AM – 8:30 AM) and evening batches (4:00 PM – 7:30 PM) Tuesday through Sunday. We also offer dedicated Saturday & Sunday Weekend-Only Batches for students with demanding school hours.",
    },
    {
        category: "Ground Booking",
        q: "How can I book a turf cricket ground for corporate or club matches?",
        a: "You can book directly on our website via the Ground Booking page. Simply select your preferred date, ground (Maruti Kunj Main Turf or Dhananjay Campus), and slot (Morning, Afternoon, or Night Floodlights). You will receive an instant confirmation.",
    },
    {
        category: "Ground Booking",
        q: "What happens if our booked match is rained out?",
        a: "If rain or poor ground conditions interrupt your match before 5 overs are bowled, CST Cricket Academy provides a 100% free rescheduling to any mutually available future date. Your booking fee is completely safe.",
    },
    {
        category: "Hostel & Facilities",
        q: "Do you have boarding / hostel facilities for outstation players?",
        a: "Yes! Our Maruti Kunj campus features secure on-campus residential boarding with AC rooms, high-protein athletic meals prepared by our nutritionist, 24/7 CCTV surveillance, and resident warden supervision for players from Delhi NCR and across India.",
    },
    {
        category: "Pro Store",
        q: "Are the bats and equipment in the Pro Store genuine?",
        a: "100% authentic and verified. Every English Willow bat, Kashmir Willow bat, helmet, glove, and ball in our Pro Store is hand-picked and tested by our senior coaches. We offer campus pickup and doorstep courier delivery across India.",
    },
    {
        category: "Coaching",
        q: "Are your cricket coaches BCCI or NIS certified?",
        a: "Yes. All our lead trainers and head coaches hold official certification from BCCI (Level 1, 2) or the National Institute of Sports (NIS) with extensive domestic first-class playing experience.",
    },
];

export default function FaqPage() {
    const [selectedCategory, setSelectedCategory] = useState("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [openIdx, setOpenIdx] = useState(0);

    const categories = ["ALL", "Admissions", "Batches & Timing", "Ground Booking", "Hostel & Facilities", "Pro Store", "Coaching"];

    const filteredFaqs = useMemo(() => {
        return FAQ_LIST.filter((item) => {
            const matchesCat = selectedCategory === "ALL" || item.category === selectedCategory;
            const matchesSearch =
                !searchQuery.trim() ||
                item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.a.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCat && matchesSearch;
        });
    }, [selectedCategory, searchQuery]);

    const toggleFaq = (idx) => {
        setOpenIdx((prev) => (prev === idx ? null : idx));
    };

    return (
        <>
            <PageHeader
                title="Frequently Asked Questions"
                breadcrumbs={[{ label: "Home", href: "/" }]}
                current="FAQ"
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
                                    Help &amp; Support
                                </span>
                                <h1 className="fw-bold mb-2 text-white font-oswald text-uppercase display-5">
                                    Got Questions? We Have Answers.
                                </h1>
                                <p className="lead mb-0 text-white-50" style={{ maxWidth: "600px", fontSize: "1.05rem" }}>
                                    Find immediate answers about admissions, trial sessions, batch timings, hostel facilities, ground bookings, and equipment orders.
                                </p>
                            </div>
                            <div className="col-lg-4 text-lg-end mt-3 mt-lg-0">
                                <Link
                                    href="/book-free-trial"
                                    className="btn btn-light fw-bold px-4 py-2.5 rounded-pill shadow-sm"
                                >
                                    Book Free Trial
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Search & Category Pills */}
                    <div className="bg-white p-3 p-md-4 rounded-4 shadow-sm border mb-4">
                        {/* Search Input */}
                        <div className="mb-3">
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0 text-muted">
                                    <Search size={16} />
                                </span>
                                <input
                                    type="text"
                                    className="form-control border-start-0 bg-light"
                                    placeholder="Search questions (e.g. fee, trial, hostel, bat, age limit)..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Category Buttons */}
                        <div className="d-flex align-items-center gap-2 overflow-x-auto pb-1">
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    className={`btn btn-sm rounded-pill px-3 text-nowrap fw-semibold ${
                                        selectedCategory === cat ? "btn-dark" : "btn-light border"
                                    }`}
                                    onClick={() => setSelectedCategory(cat)}
                                >
                                    {cat === "ALL" ? "All Questions" : cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* FAQ Accordion List */}
                    <div className="row justify-content-center">
                        <div className="col-lg-10">
                            {filteredFaqs.length === 0 ? (
                                <div className="text-center py-5 bg-white rounded-4 border p-5 shadow-sm">
                                    <HelpCircle size={56} className="text-muted opacity-40 mb-3" />
                                    <h4 className="fw-bold font-oswald text-uppercase text-dark mb-1">
                                        No Answers Matched Your Search
                                    </h4>
                                    <p className="text-muted small mb-3">
                                        Feel free to call or WhatsApp our academy team directly.
                                    </p>
                                    <button
                                        type="button"
                                        className="btn btn-outline-success btn-sm rounded-pill px-4"
                                        onClick={() => {
                                            setSearchQuery("");
                                            setSelectedCategory("ALL");
                                        }}
                                    >
                                        View All FAQs
                                    </button>
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-3">
                                    {filteredFaqs.map((faq, idx) => {
                                        const isOpen = openIdx === idx;
                                        return (
                                            <div
                                                key={idx}
                                                className="card border-0 rounded-4 shadow-sm overflow-hidden bg-white"
                                            >
                                                <button
                                                    type="button"
                                                    className="p-3.5 p-md-4 text-start bg-transparent border-0 d-flex align-items-center justify-content-between gap-3 w-100"
                                                    onClick={() => toggleFaq(idx)}
                                                >
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span
                                                            className="badge bg-light text-muted border rounded-pill extra-small d-none d-sm-inline-block"
                                                            style={{ fontSize: "0.7rem" }}
                                                        >
                                                            {faq.category}
                                                        </span>
                                                        <h6 className="fw-bold text-dark mb-0 fs-6">
                                                            {faq.q}
                                                        </h6>
                                                    </div>
                                                    <div className="text-muted flex-shrink-0">
                                                        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                    </div>
                                                </button>

                                                {isOpen && (
                                                    <div className="px-3.5 px-md-4 pb-4 pt-1 text-secondary border-top bg-light bg-opacity-25" style={{ lineHeight: "1.7" }}>
                                                        {faq.a}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Help Box */}
                            <div className="mt-5 p-4 rounded-4 bg-white border shadow-sm d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
                                <div className="d-flex align-items-center gap-3">
                                    <div className="p-3 rounded-circle bg-success-subtle text-success">
                                        <MessageCircle size={28} />
                                    </div>
                                    <div>
                                        <h5 className="fw-bold text-dark mb-1 font-oswald text-uppercase">
                                            Still Have a Question?
                                        </h5>
                                        <p className="text-muted small mb-0">
                                            Speak directly with our head coach or academy coordinator.
                                        </p>
                                    </div>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    <a
                                        href="tel:+918285831503"
                                        className="btn btn-dark rounded-pill px-4 py-2.5 fw-semibold d-flex align-items-center gap-2"
                                    >
                                        <Phone size={15} /> +91 8285831503
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
