import PageHeader from "../components/layout/PageHeader";
import Link from "next/link";
import { ShieldCheck, Lock, Eye, FileText, Bell, Mail } from "lucide-react";

export const metadata = {
    title: "Privacy Policy | CST Cricket Academy",
    description:
        "Read how CST Cricket Academy collects, uses, protects, and manages your personal information, registration data, and online booking records.",
    keywords: ["Privacy Policy", "Data Protection", "User Privacy", "CST Cricket Academy Privacy"],
    openGraph: {
        title: "Privacy Policy | CST Cricket Academy",
        description: "Official Privacy Policy regarding user data protection at CST Cricket Academy.",
    },
};

export default function PrivacyPolicyPage() {
    return (
        <>
            <PageHeader
                title="Privacy Policy"
                breadcrumbs={[{ label: "Home", href: "/" }]}
                current="Privacy Policy"
            />

            <section className="py-5" style={{ background: "#f8fbfb", minHeight: "70vh" }}>
                <div className="container">
                    <div className="row justify-content-center">
                        <div className="col-lg-10">
                            {/* Intro Card */}
                            <div className="card border-0 rounded-4 shadow-sm p-4 p-md-5 bg-white mb-4">
                                <div className="d-flex align-items-center gap-3 mb-4 pb-3 border-bottom">
                                    <div className="p-3 rounded-circle bg-success-subtle text-success">
                                        <ShieldCheck size={32} />
                                    </div>
                                    <div>
                                        <h2 className="fw-bold mb-1 font-oswald text-uppercase text-dark">
                                            Your Privacy Matters to Us
                                        </h2>
                                        <p className="text-muted small mb-0">
                                            Last Updated: October 2026 | CST Pro Cricket Academy
                                        </p>
                                    </div>
                                </div>

                                <div className="privacy-content text-secondary" style={{ lineHeight: "1.8", fontSize: "0.98rem" }}>
                                    <p>
                                        Welcome to <strong>CST Cricket Academy</strong> (&quot;Academy&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;).
                                        We are committed to safeguarding the privacy of our students, parents, players, customers, and visitors who use our website, book our cricket grounds, register for coaching programs, or purchase gear from our Pro Store.
                                    </p>

                                    <h4 className="fw-bold text-dark font-oswald text-uppercase mt-4 mb-2 d-flex align-items-center gap-2">
                                        <Lock size={18} className="text-success" /> 1. Information We Collect
                                    </h4>
                                    <p>
                                        We may collect personal identification details when you interact with our platform:
                                    </p>
                                    <ul>
                                        <li><strong>Registration &amp; Profile Details:</strong> Full name, age, date of birth, blood group, guardian contact details, email address, phone number, and residential address.</li>
                                        <li><strong>Ground Booking Information:</strong> Preferred match date, time slot, turf/ground choice, team name, and coordinator contact information.</li>
                                        <li><strong>Pro Store Orders:</strong> Delivery address, billing contact, equipment preferences, and purchase history.</li>
                                        <li><strong>Medical &amp; Fitness Notes:</strong> Emergency medical contacts and physical conditions shared with coaches to ensure player safety during training.</li>
                                    </ul>

                                    <h4 className="fw-bold text-dark font-oswald text-uppercase mt-4 mb-2 d-flex align-items-center gap-2">
                                        <Eye size={18} className="text-success" /> 2. How We Use Your Information
                                    </h4>
                                    <p>
                                        The information we collect is strictly used to deliver and enhance academy services:
                                    </p>
                                    <ul>
                                        <li>Managing student attendance, coaching batches, fitness assessments, and match schedules.</li>
                                        <li>Processing and confirming ground booking reservations and slot availability.</li>
                                        <li>Fulfilling equipment orders placed in the online Pro Store and coordinating delivery or branch pickup.</li>
                                        <li>Sending notifications regarding academy holidays, weather-related batch cancellations, and tournament announcements.</li>
                                        <li>Complying with sports governing body norms (district and state cricket associations).</li>
                                    </ul>

                                    <h4 className="fw-bold text-dark font-oswald text-uppercase mt-4 mb-2 d-flex align-items-center gap-2">
                                        <FileText size={18} className="text-success" /> 3. Data Protection &amp; Security
                                    </h4>
                                    <p>
                                        We adopt industry-standard security practices, encrypted connections (SSL), and restricted database permissions to protect your personal information against unauthorized access, loss, or alteration. We do <strong>not sell, rent, or trade</strong> your personal information to third-party marketing companies.
                                    </p>

                                    <h4 className="fw-bold text-dark font-oswald text-uppercase mt-4 mb-2 d-flex align-items-center gap-2">
                                        <Bell size={18} className="text-success" /> 4. Photography &amp; Match Recordings
                                    </h4>
                                    <p>
                                        During training sessions, matches, and tournaments, photographs and video recordings may be captured for performance analysis, technical feedback, and social media/website showcase. If you prefer your or your ward&apos;s photos not to be displayed on public media, please inform our academy administration in writing.
                                    </p>

                                    <h4 className="fw-bold text-dark font-oswald text-uppercase mt-4 mb-2 d-flex align-items-center gap-2">
                                        <Mail size={18} className="text-success" /> 5. Contacting Our Privacy Team
                                    </h4>
                                    <p>
                                        If you have questions, corrections, or concerns regarding your personal data or this Privacy Policy, please reach out to us:
                                    </p>
                                    <div className="bg-light p-3 rounded-3 border">
                                        <div className="fw-bold text-dark">CST Cricket Academy Administration</div>
                                        <div className="small text-muted">Maruti Kunj Road, Gurugram, Haryana - 122002</div>
                                        <div className="small text-muted">Phone: +91 8285831503 | Email: chandankeshri100@gmail.com</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
