import PageHeader from "../components/layout/PageHeader";
import Link from "next/link";
import { FileCheck, AlertTriangle, Shield, CheckCircle, Scale, Clock } from "lucide-react";

export const metadata = {
    title: "Terms & Conditions | CST Cricket Academy",
    description:
        "Official terms and conditions governing coaching programs, ground slot bookings, facility rules, and pro shop orders at CST Cricket Academy.",
    keywords: ["Terms and Conditions", "Academy Terms of Service", "Ground Booking Agreement", "Legal Terms"],
    openGraph: {
        title: "Terms & Conditions | CST Cricket Academy",
        description: "Official terms and conditions governing services at CST Cricket Academy.",
    },
};

export default function TermsConditionsPage() {
    return (
        <>
            <PageHeader
                title="Terms & Conditions"
                breadcrumbs={[{ label: "Home", href: "/" }]}
                current="Terms & Conditions"
            />

            <section className="py-5" style={{ background: "#f8fbfb", minHeight: "70vh" }}>
                <div className="container">
                    <div className="row justify-content-center">
                        <div className="col-lg-10">
                            <div className="card border-0 rounded-4 shadow-sm p-4 p-md-5 bg-white mb-4">
                                <div className="d-flex align-items-center gap-3 mb-4 pb-3 border-bottom">
                                    <div className="p-3 rounded-circle bg-primary-subtle text-primary">
                                        <Scale size={32} />
                                    </div>
                                    <div>
                                        <h2 className="fw-bold mb-1 font-oswald text-uppercase text-dark">
                                            Terms of Service &amp; Facility Usage
                                        </h2>
                                        <p className="text-muted small mb-0">
                                            Please review these terms carefully before enrolling, booking grounds, or purchasing equipment.
                                        </p>
                                    </div>
                                </div>

                                <div className="terms-content text-secondary" style={{ lineHeight: "1.8", fontSize: "0.98rem" }}>
                                    <p>
                                        These Terms &amp; Conditions govern your use of the services, website, training facilities, and Pro Store operated by <strong>CST Cricket Academy</strong>.
                                        By using our website, submitting an admission form, booking a ground slot, or purchasing gear, you accept and agree to be bound by these terms.
                                    </p>

                                    <h4 className="fw-bold text-dark font-oswald text-uppercase mt-4 mb-2 d-flex align-items-center gap-2">
                                        <CheckCircle size={18} className="text-primary" /> 1. Academy Admissions &amp; Training
                                    </h4>
                                    <ul>
                                        <li>Admissions are granted based on age group verification and coach assessment during trial sessions.</li>
                                        <li>All students must strictly adhere to the designated academy uniform (white cricket kit / academy colored jersey) and standard protective gear (helmet, pads, gloves, abdomen guard).</li>
                                        <li>Discipline, sportsmanship, and respect towards coaches, umpires, and fellow players are strictly enforced. Any act of indiscipline may lead to suspension without fee refund.</li>
                                        <li>Academy coaching fees must be paid in advance by the due date each month or term.</li>
                                    </ul>

                                    <h4 className="fw-bold text-dark font-oswald text-uppercase mt-4 mb-2 d-flex align-items-center gap-2">
                                        <Clock size={18} className="text-primary" /> 2. Cricket Ground &amp; Turf Bookings
                                    </h4>
                                    <ul>
                                        <li>Ground slots are reserved on a first-come, first-served basis upon receipt of booking confirmation.</li>
                                        <li>Teams must report at least 15 minutes prior to their booked slot time. Delays by teams do not warrant an extension of the match slot.</li>
                                        <li>Only standard cricket rubber or turf studs/spikes are permitted on turf wickets. Metal spikes that cause pitch damage are strictly prohibited.</li>
                                        <li>In the event of unplayable weather or sudden rain, the academy management will reschedule the slot to an available mutually agreed future date.</li>
                                    </ul>

                                    <h4 className="fw-bold text-dark font-oswald text-uppercase mt-4 mb-2 d-flex align-items-center gap-2">
                                        <FileCheck size={18} className="text-primary" /> 3. Pro Store &amp; Equipment Purchases
                                    </h4>
                                    <ul>
                                        <li>All cricket gear listed in our Pro Store is 100% genuine and verified by academy coaches.</li>
                                        <li>Orders placed online can be picked up at your nearest academy branch or delivered to your address as per selected shipping method.</li>
                                        <li>Prices displayed are in Indian Rupees (INR) and are inclusive of applicable taxes unless specified otherwise.</li>
                                    </ul>

                                    <h4 className="fw-bold text-dark font-oswald text-uppercase mt-4 mb-2 d-flex align-items-center gap-2">
                                        <AlertTriangle size={18} className="text-warning" /> 4. Health, Injury &amp; Liability Waiver
                                    </h4>
                                    <p>
                                        Cricket is an active physical sport with inherent risks of ball impact and athletic injury. While the academy enforces strict safety protocols (protective helmets, trained first aid, experienced coaches), the academy and its management shall not be held liable for accidental injuries sustained during normal course of practice or matches. Parents and players are advised to maintain active personal medical insurance.
                                    </p>

                                    <h4 className="fw-bold text-dark font-oswald text-uppercase mt-4 mb-2 d-flex align-items-center gap-2">
                                        <Shield size={18} className="text-primary" /> 5. Modification of Terms
                                    </h4>
                                    <p>
                                        CST Cricket Academy reserves the right to modify these terms at any time. Continued use of the facilities or website following any changes signifies your agreement to the updated terms.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
