"use client";

import { useState, useEffect } from "react";
import PageHeader from "../components/layout/PageHeader";
import Link from "next/link";
import {
    Award,
    Calendar,
    CheckCircle2,
    Clock,
    MapPin,
    Phone,
    Shield,
    Sparkles,
    Star,
    Trophy,
    User,
} from "lucide-react";

export default function BookFreeTrialPage() {
    const [branches, setBranches] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [loadingOptions, setLoadingOptions] = useState(true);

    // Form state
    const [formData, setFormData] = useState({
        student_name: "",
        phone: "",
        email: "",
        age: "",
        branch_id: "",
        program_id: "",
        message: "",
    });

    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    // Load branches & programs for dropdowns
    useEffect(() => {
        async function fetchOptions() {
            try {
                const [bRes, pRes] = await Promise.all([
                    fetch("/api/branch?status=1"),
                    fetch("/api/programs?status=1"),
                ]);
                const bJson = await bRes.json();
                const pJson = await pRes.json();

                if (bRes.ok && bJson.success && Array.isArray(bJson.data)) {
                    setBranches(bJson.data);
                    if (bJson.data.length > 0) {
                        setFormData((prev) => ({ ...prev, branch_id: String(bJson.data[0].id) }));
                    }
                }
                if (pRes.ok && pJson.success && Array.isArray(pJson.data)) {
                    setPrograms(pJson.data);
                }
            } catch (err) {
                console.error("Failed to load options:", err);
            } finally {
                setLoadingOptions(false);
            }
        }
        fetchOptions();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg("");

        if (!formData.student_name.trim() || !formData.phone.trim()) {
            setErrorMsg("Please provide student name and contact phone number.");
            return;
        }

        setSubmitting(true);
        try {
            const trialMessage = formData.message.trim()
                ? `[Free Trial Booking Request] ${formData.message.trim()}`
                : "Free Trial Booking request submitted via website";

            const payload = {
                academy_id: 1,
                student_name: formData.student_name.trim(),
                phone: formData.phone.trim(),
                email: formData.email.trim() || null,
                age: formData.age ? Number(formData.age) : null,
                branch_id: formData.branch_id ? Number(formData.branch_id) : null,
                program_id: formData.program_id ? Number(formData.program_id) : null,
                message: trialMessage,
                enquiry_source: "Website",
                enquiry_status: "New",
            };

            const res = await fetch("/api/student-enquiries", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json();
            if (res.ok && json.success) {
                setSubmitted(true);
            } else {
                setErrorMsg(json.message || "Something went wrong. Please call us directly.");
            }
        } catch (err) {
            setErrorMsg("Network error. Please try again or reach out on WhatsApp.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <PageHeader
                title="Book a Free Trial Session"
                breadcrumbs={[{ label: "Home", href: "/" }]}
                current="Book a Free Trial"
            />

            <section className="py-5" style={{ background: "#f8fbfb", minHeight: "80vh" }}>
                <div className="container">
                    <div className="row g-4 align-items-stretch">
                        {/* Left Column: Why Join / Trial Benefits */}
                        <div className="col-lg-5">
                            <div
                                className="p-4 p-md-5 rounded-4 text-white h-100 shadow-sm d-flex flex-column justify-content-between position-relative overflow-hidden"
                                style={{
                                    background: "linear-gradient(135deg, #062f38 0%, #0d4b57 100%)",
                                }}
                            >
                                <div>
                                    <span
                                        className="badge px-3 py-1 mb-3 fw-bold text-uppercase"
                                        style={{ background: "var(--lime)", color: "var(--navy)" }}
                                    >
                                        Zero Cost Trial
                                    </span>
                                    <h2 className="font-oswald text-uppercase fw-bold text-white display-6 mb-3">
                                        Experience Pro Cricket Coaching
                                    </h2>
                                    <p className="text-white-50 mb-4" style={{ lineHeight: "1.7" }}>
                                        Visit our international standard training turf wickets, meet our BCCI &amp; NIS certified coaches, and get a personalized skills evaluation for your child.
                                    </p>

                                    <div className="d-flex flex-column gap-3 mb-4">
                                        <div className="d-flex align-items-start gap-3">
                                            <div
                                                className="p-2 rounded-circle flex-shrink-0"
                                                style={{ background: "rgba(164, 255, 0, 0.15)", color: "var(--lime)" }}
                                            >
                                                <Award size={20} />
                                            </div>
                                            <div>
                                                <div className="fw-bold text-white fs-6">90-Minute Live Session</div>
                                                <div className="text-white-50 small">Batting, bowling &amp; fielding drills on natural turf.</div>
                                            </div>
                                        </div>

                                        <div className="d-flex align-items-start gap-3">
                                            <div
                                                className="p-2 rounded-circle flex-shrink-0"
                                                style={{ background: "rgba(164, 255, 0, 0.15)", color: "var(--lime)" }}
                                            >
                                                <Trophy size={20} />
                                            </div>
                                            <div>
                                                <div className="fw-bold text-white fs-6">Coach Skill Assessment</div>
                                                <div className="text-white-50 small">Custom feedback report on grip, stance, and action.</div>
                                            </div>
                                        </div>

                                        <div className="d-flex align-items-start gap-3">
                                            <div
                                                className="p-2 rounded-circle flex-shrink-0"
                                                style={{ background: "rgba(164, 255, 0, 0.15)", color: "var(--lime)" }}
                                            >
                                                <Shield size={20} />
                                            </div>
                                            <div>
                                                <div className="fw-bold text-white fs-6">No Commitment Needed</div>
                                                <div className="text-white-50 small">Decide on admission only after your child loves the experience.</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 rounded-3 bg-white bg-opacity-10 border border-white border-opacity-20 mt-4">
                                    <div className="small text-white-50 mb-1">Direct Admission Helpline:</div>
                                    <a
                                        href="tel:+918285831503"
                                        className="text-white fw-bold text-decoration-none d-flex align-items-center gap-2 fs-5"
                                    >
                                        <Phone size={18} style={{ color: "var(--lime)" }} /> +91 8285831503
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Registration Form or Success Message */}
                        <div className="col-lg-7">
                            <div className="card border-0 rounded-4 shadow-sm p-4 p-md-5 bg-white h-100">
                                {submitted ? (
                                    <div className="text-center py-5 my-auto">
                                        <div
                                            className="d-inline-flex p-3 rounded-circle mb-3"
                                            style={{ background: "#e8f5e9", color: "#2e7d32" }}
                                        >
                                            <CheckCircle2 size={56} />
                                        </div>
                                        <h3 className="fw-bold font-oswald text-uppercase text-dark mb-2">
                                            Trial Session Requested!
                                        </h3>
                                        <p className="text-muted mb-4" style={{ maxWidth: "480px", margin: "0 auto" }}>
                                            Thank you, <strong>{formData.student_name}</strong>! Our head coach will call you on <strong>{formData.phone}</strong> within 24 hours to confirm your trial slot timing and kit instructions.
                                        </p>
                                        <div className="d-flex justify-content-center gap-3">
                                            <Link href="/" className="btn btn-dark rounded-pill px-4">
                                                Back to Home
                                            </Link>
                                            <button
                                                type="button"
                                                className="btn btn-outline-success rounded-pill px-4"
                                                onClick={() => {
                                                    setSubmitted(false);
                                                    setFormData({
                                                        student_name: "",
                                                        phone: "",
                                                        email: "",
                                                        age: "",
                                                        branch_id: branches[0]?.id ? String(branches[0].id) : "",
                                                        program_id: "",
                                                        message: "",
                                                    });
                                                }}
                                            >
                                                Book Another
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="mb-4">
                                            <h3 className="fw-bold font-oswald text-uppercase text-dark mb-1">
                                                Book Your Free Trial
                                            </h3>
                                            <p className="text-muted small mb-0">
                                                Fill out the details below. Our coaching coordinator will confirm your preferred timing.
                                            </p>
                                        </div>

                                        {errorMsg && (
                                            <div className="alert alert-danger py-2 small rounded-3 mb-3">
                                                {errorMsg}
                                            </div>
                                        )}

                                        <form onSubmit={handleSubmit}>
                                            <div className="row g-3">
                                                {/* Student Name */}
                                                <div className="col-md-6">
                                                    <label className="form-label small fw-bold text-dark">
                                                        Student Full Name <span className="text-danger">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="student_name"
                                                        required
                                                        placeholder="e.g. Aarav Sharma"
                                                        value={formData.student_name}
                                                        onChange={handleChange}
                                                        className="form-control"
                                                    />
                                                </div>

                                                {/* Phone Number */}
                                                <div className="col-md-6">
                                                    <label className="form-label small fw-bold text-dark">
                                                        WhatsApp / Mobile No. <span className="text-danger">*</span>
                                                    </label>
                                                    <input
                                                        type="tel"
                                                        name="phone"
                                                        required
                                                        placeholder="e.g. 9876543210"
                                                        value={formData.phone}
                                                        onChange={handleChange}
                                                        className="form-control"
                                                    />
                                                </div>

                                                {/* Student Age */}
                                                <div className="col-md-6">
                                                    <label className="form-label small fw-bold text-dark">
                                                        Player Age (Years)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        name="age"
                                                        min="4"
                                                        max="35"
                                                        placeholder="e.g. 12"
                                                        value={formData.age}
                                                        onChange={handleChange}
                                                        className="form-control"
                                                    />
                                                </div>

                                                {/* Email Address */}
                                                <div className="col-md-6">
                                                    <label className="form-label small fw-bold text-dark">
                                                        Email Address
                                                    </label>
                                                    <input
                                                        type="email"
                                                        name="email"
                                                        placeholder="parent@example.com"
                                                        value={formData.email}
                                                        onChange={handleChange}
                                                        className="form-control"
                                                    />
                                                </div>

                                                {/* Preferred Campus */}
                                                <div className="col-md-6">
                                                    <label className="form-label small fw-bold text-dark">
                                                        Preferred Branch / Campus
                                                    </label>
                                                    <select
                                                        name="branch_id"
                                                        value={formData.branch_id}
                                                        onChange={handleChange}
                                                        className="form-select"
                                                    >
                                                        {branches.length > 0 ? (
                                                            branches.map((b) => (
                                                                <option key={b.id} value={b.id}>
                                                                    {b.branch_name} ({b.city || "Campus"})
                                                                </option>
                                                            ))
                                                        ) : (
                                                            <option value="">Main Campus (Maruti Kunj)</option>
                                                        )}
                                                    </select>
                                                </div>

                                                {/* Preferred Program */}
                                                <div className="col-md-6">
                                                    <label className="form-label small fw-bold text-dark">
                                                        Interested Program
                                                    </label>
                                                    <select
                                                        name="program_id"
                                                        value={formData.program_id}
                                                        onChange={handleChange}
                                                        className="form-select"
                                                    >
                                                        <option value="">General Coaching (Any Batch)</option>
                                                        {programs.map((p) => (
                                                            <option key={p.id} value={p.id}>
                                                                {p.program_name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Message */}
                                                <div className="col-12">
                                                    <label className="form-label small fw-bold text-dark">
                                                        Special Notes (Preferred day/time or previous playing experience)
                                                    </label>
                                                    <textarea
                                                        name="message"
                                                        rows="3"
                                                        placeholder="Tell us if your child is a batsman, bowler, wicketkeeper or beginner..."
                                                        value={formData.message}
                                                        onChange={handleChange}
                                                        className="form-control"
                                                    ></textarea>
                                                </div>

                                                {/* Submit Button */}
                                                <div className="col-12 mt-4">
                                                    <button
                                                        type="submit"
                                                        disabled={submitting}
                                                        className="btn btn-dark w-100 py-3 rounded-pill fw-bold text-uppercase letter-spacing-1 shadow-sm d-flex align-items-center justify-content-center gap-2"
                                                        style={{ background: "var(--navy)" }}
                                                    >
                                                        {submitting ? (
                                                            <>
                                                                <span className="spinner-border spinner-border-sm" role="status" />
                                                                Submitting Request...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Sparkles size={18} style={{ color: "var(--lime)" }} />
                                                                Confirm Free Trial Booking
                                                            </>
                                                        )}
                                                    </button>
                                                    <p className="text-muted small text-center mt-2 mb-0">
                                                        🔒 We respect your privacy. No spam guaranteed.
                                                    </p>
                                                </div>
                                            </div>
                                        </form>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
