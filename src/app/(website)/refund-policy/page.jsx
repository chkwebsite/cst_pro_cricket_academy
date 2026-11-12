import PageHeader from "../components/layout/PageHeader";
import Link from "next/link";
import { RotateCcw, AlertCircle, CheckCircle2, Clock, HelpCircle } from "lucide-react";

export const metadata = {
    title: "Refund & Cancellation Policy | CST Cricket Academy",
    description:
        "Understand our cancellation, rainout, and refund guidelines for turf ground reservations, coaching course fees, and cricket gear store purchases at CST Cricket Academy.",
    keywords: ["Refund Policy", "Cancellation Policy", "Ground Booking Refund", "Coaching Fee Refund", "Rainout Policy"],
    openGraph: {
        title: "Refund & Cancellation Policy | CST Cricket Academy",
        description: "Official cancellation and refund policies at CST Cricket Academy.",
    },
};

export default function RefundPolicyPage() {
    return (
        <>
            <PageHeader
                title="Refund & Cancellation Policy"
                breadcrumbs={[{ label: "Home", href: "/" }]}
                current="Refund Policy"
            />

            <section className="py-5" style={{ background: "#f8fbfb", minHeight: "70vh" }}>
                <div className="container">
                    <div className="row justify-content-center">
                        <div className="col-lg-10">
                            <div className="card border-0 rounded-4 shadow-sm p-4 p-md-5 bg-white mb-4">
                                <div className="d-flex align-items-center gap-3 mb-4 pb-3 border-bottom">
                                    <div className="p-3 rounded-circle bg-warning-subtle text-warning-emphasis">
                                        <RotateCcw size={32} />
                                    </div>
                                    <div>
                                        <h2 className="fw-bold mb-1 font-oswald text-uppercase text-dark">
                                            Cancellation, Rescheduling &amp; Refunds
                                        </h2>
                                        <p className="text-muted small mb-0">
                                            Clear, transparent policies for ground slots, academy admissions, and store gear.
                                        </p>
                                    </div>
                                </div>

                                <div className="refund-content text-secondary" style={{ lineHeight: "1.8", fontSize: "0.98rem" }}>
                                    {/* Ground Booking Refunds */}
                                    <h4 className="fw-bold text-dark font-oswald text-uppercase mt-4 mb-2 d-flex align-items-center gap-2">
                                        <Clock size={18} className="text-success" /> 1. Cricket Ground &amp; Turf Bookings
                                    </h4>
                                    <ul>
                                        <li><strong>Cancellation &gt; 48 hours prior to slot:</strong> 90% refund or 100% credit towards a future booking slot.</li>
                                        <li><strong>Cancellation between 24–48 hours:</strong> 50% refund or slot rescheduling subject to calendar availability.</li>
                                        <li><strong>Cancellation &lt; 24 hours or No-Show:</strong> No refund can be granted as grounds and umpire/scorer resources are reserved.</li>
                                        <li><strong>Weather Interruption (Rain / Poor Light):</strong> If a booked match cannot begin or is abandoned before 5 overs due to natural rain or waterlogged ground, the academy management provides an automatic <strong>100% free rescheduling</strong> to any mutually available date.</li>
                                    </ul>

                                    {/* Store Orders Refunds */}
                                    <h4 className="fw-bold text-dark font-oswald text-uppercase mt-4 mb-2 d-flex align-items-center gap-2">
                                        <RotateCcw size={18} className="text-success" /> 2. Pro Store Equipment (Bats, Gear, Apparel)
                                    </h4>
                                    <ul>
                                        <li><strong>Returns for Manufacturing Defects:</strong> Any defective, damaged, or incorrect item received can be returned or exchanged within <strong>7 days</strong> of delivery or branch pickup.</li>
                                        <li><strong>Condition for Return:</strong> Bats and protective gear must be unused, in their original packaging with warranty seals, invoices, and tags intact. Knocked-in or played-with bats cannot be accepted for return unless there is a certified blade defect.</li>
                                        <li><strong>Refund Processing:</strong> Approved returns will be refunded to your original payment method within 5–7 business days of inspection.</li>
                                    </ul>

                                    {/* Academy Coaching Fees */}
                                    <h4 className="fw-bold text-dark font-oswald text-uppercase mt-4 mb-2 d-flex align-items-center gap-2">
                                        <CheckCircle2 size={18} className="text-success" /> 3. Coaching Program Fees
                                    </h4>
                                    <ul>
                                        <li>Monthly coaching fees and annual registration fees are non-refundable once the training month has commenced.</li>
                                        <li>In cases of extended medical leave or verified injury, a fee pause or rollover to subsequent training months can be requested upon submission of a medical certificate.</li>
                                    </ul>

                                    {/* Help Box */}
                                    <div className="bg-light p-4 rounded-4 border mt-4 d-flex align-items-start gap-3">
                                        <HelpCircle size={24} className="text-success flex-shrink-0 mt-1" />
                                        <div>
                                            <h6 className="fw-bold text-dark mb-1">Need help with a cancellation or refund request?</h6>
                                            <p className="small text-muted mb-2">
                                                Our team is available 7 days a week to assist you with fast rescheduling and refund support.
                                            </p>
                                            <div className="small fw-semibold text-dark">
                                                Call: <a href="tel:+918285831503" className="text-success text-decoration-none">+91 8285831503</a> |
                                                Email: <a href="mailto:chandankeshri100@gmail.com" className="text-success text-decoration-none">chandankeshri100@gmail.com</a>
                                            </div>
                                        </div>
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
