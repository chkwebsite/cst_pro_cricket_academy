"use client";

import { useState, useEffect, Suspense } from "react";
import PageHeader from "../components/layout/PageHeader";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
    Award,
    Building2,
    Calendar,
    CheckCircle2,
    Clock,
    GraduationCap,
    MapPin,
    Phone,
    Shield,
    Sparkles,
    Star,
    Trophy,
    User,
} from "lucide-react";

function BookFreeTrialContent() {
    const searchParams = useSearchParams();
    const queryAcademyId = searchParams.get("academy_id") || "";
    const queryBranchId = searchParams.get("branch_id") || "";

    const [academies, setAcademies] = useState([]);
    const [branches, setBranches] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [loadingOptions, setLoadingOptions] = useState(true);
    const [loadingPrograms, setLoadingPrograms] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        student_name: "",
        phone: "",
        email: "",
        age: "",
        academy_id: queryAcademyId,
        branch_id: queryBranchId,
        program_id: "",
        message: "",
    });

    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    // 1. Initial Load: Academies & Branches
    useEffect(() => {
        let isMounted = true;

        async function fetchInitialOptions() {
            try {
                const [aRes, bRes] = await Promise.all([
                    fetch("/api/academies?status=1"),
                    fetch("/api/branch?status=1"),
                ]);

                const aJson = await aRes.json();
                const bJson = await bRes.json();

                if (!isMounted) return;

                let loadedAcademies = [];
                let loadedBranches = [];

                if (aRes.ok && aJson.success && Array.isArray(aJson.data)) {
                    loadedAcademies = aJson.data;
                    setAcademies(loadedAcademies);
                }

                if (bRes.ok && bJson.success && Array.isArray(bJson.data)) {
                    loadedBranches = bJson.data;
                    setBranches(loadedBranches);
                }

                // Determine effective academy_id
                let effAcademyId = queryAcademyId;
                if (!effAcademyId && loadedAcademies.length > 0) {
                    effAcademyId = String(loadedAcademies[0].id);
                }

                // Determine effective branch_id for this academy
                const matchingBranches = loadedBranches.filter(
                    (b) => Number(b.academy_id) === Number(effAcademyId)
                );

                let effBranchId = queryBranchId;
                const branchBelongs = matchingBranches.some(
                    (b) => String(b.id) === String(effBranchId)
                );

                if (!branchBelongs && matchingBranches.length > 0) {
                    effBranchId = String(matchingBranches[0].id);
                }

                setFormData((prev) => ({
                    ...prev,
                    academy_id: effAcademyId || prev.academy_id,
                    branch_id: effBranchId || prev.branch_id,
                }));
            } catch (err) {
                console.error("Failed to load initial options:", err);
            } finally {
                if (isMounted) setLoadingOptions(false);
            }
        }

        fetchInitialOptions();

        return () => {
            isMounted = false;
        };
    }, [queryAcademyId, queryBranchId]);

    // 2. Fetch & Bind Programs based on selected Academy and Branch
    useEffect(() => {
        if (!formData.academy_id) {
            setPrograms([]);
            return;
        }

        let isMounted = true;
        setLoadingPrograms(true);

        let url = `/api/programs?status=1&academy_id=${formData.academy_id}`;
        if (formData.branch_id) {
            url += `&branch_id=${formData.branch_id}`;
        }

        fetch(url)
            .then((res) => res.json())
            .then((json) => {
                if (isMounted && json.success && Array.isArray(json.data)) {
                    setPrograms(json.data);

                    // Reset program_id if previously selected program is not in the new list
                    setFormData((prev) => {
                        const exists = json.data.some((p) => String(p.id) === String(prev.program_id));
                        return exists ? prev : { ...prev, program_id: "" };
                    });
                } else if (isMounted) {
                    setPrograms([]);
                    setFormData((prev) => ({ ...prev, program_id: "" }));
                }
            })
            .catch((err) => {
                console.error("Failed to load filtered programs:", err);
                if (isMounted) {
                    setPrograms([]);
                    setFormData((prev) => ({ ...prev, program_id: "" }));
                }
            })
            .finally(() => {
                if (isMounted) setLoadingPrograms(false);
            });

        return () => {
            isMounted = false;
        };
    }, [formData.academy_id, formData.branch_id]);

    // Update query params if they change externally
    useEffect(() => {
        if (queryAcademyId) {
            setFormData((prev) => ({ ...prev, academy_id: queryAcademyId }));
        }
        if (queryBranchId) {
            setFormData((prev) => ({ ...prev, branch_id: queryBranchId }));
        }
    }, [queryAcademyId, queryBranchId]);

    // Handle Academy change: filter branches, reset branch_id & program_id
    const handleAcademyChange = (e) => {
        const nextAcademyId = e.target.value;
        const matchingBranches = branches.filter(
            (b) => Number(b.academy_id) === Number(nextAcademyId)
        );

        setFormData((prev) => ({
            ...prev,
            academy_id: nextAcademyId,
            branch_id: matchingBranches.length > 0 ? String(matchingBranches[0].id) : "",
            program_id: "",
        }));
    };

    // Handle Branch change: update branch_id and reset program_id
    const handleBranchChange = (e) => {
        const nextBranchId = e.target.value;
        setFormData((prev) => ({
            ...prev,
            branch_id: nextBranchId,
            program_id: "",
        }));
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    // Filter branches belonging to the currently selected academy
    const filteredBranches = formData.academy_id
        ? branches.filter((b) => Number(b.academy_id) === Number(formData.academy_id))
        : branches;

    // Current selected academy, branch, and program objects for display
    const selectedAcademyObj = academies.find(
        (a) => String(a.id) === String(formData.academy_id)
    );
    const selectedBranchObj = branches.find(
        (b) => String(b.id) === String(formData.branch_id)
    );
    const selectedProgramObj = programs.find(
        (p) => String(p.id) === String(formData.program_id)
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg("");

        if (!formData.student_name.trim() || !formData.phone.trim()) {
            setErrorMsg("Please provide student name and contact phone number.");
            return;
        }

        if (!formData.academy_id) {
            setErrorMsg("Please select an academy.");
            return;
        }

        if (!formData.branch_id) {
            setErrorMsg("Please select a preferred branch / campus.");
            return;
        }

        setSubmitting(true);
        try {
            const academyLabel = selectedAcademyObj?.academy_name || `Academy #${formData.academy_id}`;
            const branchLabel = selectedBranchObj?.branch_name || `Branch #${formData.branch_id}`;
            const programLabel = selectedProgramObj?.program_name || "General Coaching Assessment";

            const trialMessage = formData.message.trim()
                ? `[Free Trial Booking | ${academyLabel} - ${branchLabel} | Program: ${programLabel}] ${formData.message.trim()}`
                : `Free Trial Booking request submitted via website for ${academyLabel} - ${branchLabel} (${programLabel})`;

            const payload = {
                academy_id: Number(formData.academy_id),
                branch_id: Number(formData.branch_id),
                student_name: formData.student_name.trim(),
                phone: formData.phone.trim(),
                email: formData.email.trim() || null,
                age: formData.age ? Number(formData.age) : null,
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
                                        style={{ background: "var(--lime, #b6ff00)", color: "var(--navy, #062f38)" }}
                                    >
                                        Zero Cost Trial
                                    </span>
                                    <h2 className="font-oswald text-uppercase fw-bold text-white display-6 mb-3">
                                        Experience Pro Cricket Coaching
                                    </h2>
                                    <p className="text-white-50 mb-4" style={{ lineHeight: "1.7" }}>
                                        Join our high-performance trial session at your chosen academy branch. Get assessed by BCCI-certified coaches on genuine turf pitches.
                                    </p>

                                    <ul className="list-unstyled d-flex flex-column gap-3 mb-4">
                                        <li className="d-flex align-items-start gap-3">
                                            <div
                                                className="rounded-circle p-2 d-flex align-items-center justify-content-center flex-shrink-0"
                                                style={{ background: "rgba(255,255,255,0.1)", color: "var(--lime, #b6ff00)" }}
                                            >
                                                <Calendar size={18} />
                                            </div>
                                            <div>
                                                <div className="fw-bold">1 Full Free Training Day</div>
                                                <small className="text-white-50">Experience structured drills, net sessions & match scenarios.</small>
                                            </div>
                                        </li>
                                        <li className="d-flex align-items-start gap-3">
                                            <div
                                                className="rounded-circle p-2 d-flex align-items-center justify-content-center flex-shrink-0"
                                                style={{ background: "rgba(255,255,255,0.1)", color: "var(--lime, #b6ff00)" }}
                                            >
                                                <Trophy size={18} />
                                            </div>
                                            <div>
                                                <div className="fw-bold">Skill Assessment Report</div>
                                                <small className="text-white-50">Head coaches evaluate batting, bowling, fitness & mental game.</small>
                                            </div>
                                        </li>
                                        <li className="d-flex align-items-start gap-3">
                                            <div
                                                className="rounded-circle p-2 d-flex align-items-center justify-content-center flex-shrink-0"
                                                style={{ background: "rgba(255,255,255,0.1)", color: "var(--lime, #b6ff00)" }}
                                            >
                                                <Shield size={18} />
                                            </div>
                                            <div>
                                                <div className="fw-bold">No Obligation</div>
                                                <small className="text-white-50">No hidden fees or compulsory admission. 100% free trial.</small>
                                            </div>
                                        </li>
                                    </ul>
                                </div>

                                <div className="pt-4 border-top border-white border-opacity-10">
                                    <div className="small text-white-50 mb-1">Direct Admission Helpline:</div>
                                    <a
                                        href="tel:+918285831503"
                                        className="text-white fw-bold text-decoration-none d-flex align-items-center gap-2 fs-5"
                                    >
                                        <Phone size={18} style={{ color: "var(--lime, #b6ff00)" }} /> +91 8285831503
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
                                        <p className="text-muted mb-3" style={{ maxWidth: "480px", margin: "0 auto" }}>
                                            Thank you, <strong>{formData.student_name}</strong>! Our head coach will call you on <strong>{formData.phone}</strong> within 24 hours to confirm your trial slot timing and kit instructions.
                                        </p>
                                        {selectedAcademyObj && selectedBranchObj && (
                                            <div
                                                className="p-3 rounded-3 mb-4 text-start mx-auto"
                                                style={{ maxWidth: "440px", background: "#f8f9fa", border: "1px solid #e9ecef" }}
                                            >
                                                <div className="small text-muted mb-1">Booking Confirmation:</div>
                                                <div className="fw-bold text-dark d-flex align-items-center gap-2">
                                                    <Building2 size={16} className="text-danger" />
                                                    <span>{selectedAcademyObj.academy_name}</span>
                                                </div>
                                                <div className="text-secondary small d-flex align-items-center gap-2 mt-1">
                                                    <MapPin size={16} className="text-primary" />
                                                    <span>{selectedBranchObj.branch_name} {selectedBranchObj.city ? `(${selectedBranchObj.city})` : ""}</span>
                                                </div>
                                                {selectedProgramObj && (
                                                    <div className="text-success small d-flex align-items-center gap-2 mt-1 fw-semibold">
                                                        <GraduationCap size={16} />
                                                        <span>Program: {selectedProgramObj.program_name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
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
                                                        academy_id: queryAcademyId || (academies[0]?.id ? String(academies[0].id) : ""),
                                                        branch_id: queryBranchId || (filteredBranches[0]?.id ? String(filteredBranches[0].id) : ""),
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

                                                {/* Academy Selection (Auto-filled & Changeable) */}
                                                <div className="col-md-6">
                                                    <label className="form-label small fw-bold text-dark d-flex align-items-center gap-1">
                                                        <Building2 size={15} className="text-danger" />
                                                        <span>Selected Academy <span className="text-danger">*</span></span>
                                                    </label>
                                                    <select
                                                        name="academy_id"
                                                        value={formData.academy_id}
                                                        onChange={handleAcademyChange}
                                                        className="form-select"
                                                        disabled={loadingOptions}
                                                        required
                                                    >
                                                        <option value="">Select Academy...</option>
                                                        {academies.map((a) => (
                                                            <option key={a.id} value={a.id}>
                                                                {a.academy_name} {a.city ? `(${a.city})` : ""}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Branch Selection (Auto-filled & Filtered by Academy) */}
                                                <div className="col-md-6">
                                                    <label className="form-label small fw-bold text-dark d-flex align-items-center gap-1">
                                                        <MapPin size={15} className="text-danger" />
                                                        <span>Preferred Branch / Campus <span className="text-danger">*</span></span>
                                                    </label>
                                                    <select
                                                        name="branch_id"
                                                        value={formData.branch_id}
                                                        onChange={handleBranchChange}
                                                        className="form-select"
                                                        disabled={!formData.academy_id || loadingOptions}
                                                        required
                                                    >
                                                        <option value="">
                                                            {!formData.academy_id
                                                                ? "Please select an academy first"
                                                                : filteredBranches.length === 0
                                                                ? "No active branches for this academy"
                                                                : "Select Campus / Branch..."}
                                                        </option>
                                                        {filteredBranches.map((b) => (
                                                            <option key={b.id} value={b.id}>
                                                                {b.branch_name} {b.city ? `(${b.city})` : ""}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Preferred Program - DYNAMICALLY BOUND TO SELECTED ACADEMY & BRANCH */}
                                                <div className="col-md-12">
                                                    <label className="form-label small fw-bold text-dark d-flex align-items-center justify-content-between mb-1">
                                                        <span className="d-flex align-items-center gap-1">
                                                            <GraduationCap size={16} className="text-danger" />
                                                            <span>Interested Program</span>
                                                            <small className="text-muted fw-normal">(Optional)</small>
                                                        </span>
                                                        {loadingPrograms && (
                                                            <span className="text-muted small">
                                                                <span className="spinner-border spinner-border-sm me-1" role="status" />
                                                                Loading campus programs...
                                                            </span>
                                                        )}
                                                    </label>
                                                    <select
                                                        name="program_id"
                                                        value={formData.program_id}
                                                        onChange={handleChange}
                                                        className="form-select"
                                                        disabled={!formData.academy_id || loadingPrograms}
                                                    >
                                                        <option value="">
                                                            {loadingPrograms
                                                                ? "Loading programs..."
                                                                : "General Coaching (Any Batch / Skill Assessment)"}
                                                        </option>
                                                        {programs.map((p) => (
                                                            <option key={p.id} value={p.id}>
                                                                {p.program_name} {p.program_fee ? `— ₹${Number(p.program_fee).toLocaleString("en-IN")}` : ""}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {formData.academy_id && formData.branch_id && !loadingPrograms && programs.length === 0 && (
                                                        <small className="text-muted mt-1 d-block">
                                                            No specific specialized programs registered for this campus. General coaching trial will be assigned.
                                                        </small>
                                                    )}
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
                                                        style={{ background: "var(--navy, #062f38)" }}
                                                    >
                                                        {submitting ? (
                                                            <>
                                                                <span className="spinner-border spinner-border-sm" role="status" />
                                                                Submitting Request...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Sparkles size={18} style={{ color: "var(--lime, #b6ff00)" }} />
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

export default function BookFreeTrialPage() {
    return (
        <Suspense
            fallback={
                <div className="text-center py-5" style={{ minHeight: "60vh" }}>
                    <div className="spinner-border text-danger" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            }
        >
            <BookFreeTrialContent />
        </Suspense>
    );
}
