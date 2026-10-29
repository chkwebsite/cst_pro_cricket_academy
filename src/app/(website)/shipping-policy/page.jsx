import PageHeader from "../components/layout/PageHeader";
import Link from "next/link";
import { Truck, MapPin, PackageCheck, Clock, ShieldCheck } from "lucide-react";

export const metadata = {
    title: "Shipping & Delivery Policy | CST Cricket Academy Pro Shop",
    description:
        "Learn about shipping timelines, express courier delivery, tracking, and free academy branch pickup options for cricket bats, pads, and gear at CST Cricket Academy Pro Shop.",
    keywords: ["Shipping Policy", "Cricket Gear Delivery", "Express Cricket Shipping", "Store Pickup"],
    openGraph: {
        title: "Shipping & Delivery Policy | CST Cricket Academy Pro Shop",
        description: "Shipping timelines and delivery details for CST Cricket Academy Pro Shop.",
    },
};

export default function ShippingPolicyPage() {
    return (
        <>
            <PageHeader
                title="Shipping & Delivery Policy"
                breadcrumbs={[{ label: "Home", href: "/" }]}
                current="Shipping Policy"
            />

            <section className="py-5" style={{ background: "#f8fbfb", minHeight: "70vh" }}>
                <div className="container">
                    <div className="row justify-content-center">
                        <div className="col-lg-10">
                            <div className="card border-0 rounded-4 shadow-sm p-4 p-md-5 bg-white mb-4">
                                <div className="d-flex align-items-center gap-3 mb-4 pb-3 border-bottom">
                                    <div className="p-3 rounded-circle bg-info-subtle text-info-emphasis">
                                        <Truck size={32} />
                                    </div>
                                    <div>
                                        <h2 className="fw-bold mb-1 font-oswald text-uppercase text-dark">
                                            Store Shipping &amp; Pickup Guidelines
                                        </h2>
                                        <p className="text-muted small mb-0">
                                            Fast, safe dispatch of genuine cricket equipment across India and direct campus pickup.
                                        </p>
                                    </div>
                                </div>

                                <div className="shipping-content text-secondary" style={{ lineHeight: "1.8", fontSize: "0.98rem" }}>
                                    <h4 className="fw-bold text-dark font-oswald text-uppercase mt-4 mb-2 d-flex align-items-center gap-2">
                                        <MapPin size={18} className="text-info" /> 1. Campus Pickup (Instant &amp; Free)
                                    </h4>
                                    <p>
                                        Students and players can collect their ordered equipment directly from our academy branches at <strong>zero shipping cost</strong>:
                                    </p>
                                    <ul>
                                        <li><strong>Main Campus:</strong> CST Pro Cricket Academy, Maruti Kunj, Gurugram.</li>
                                        <li><strong>Training Campus:</strong> Dhananjay Cricket Academy, Prem Kunj, Gurugram.</li>
                                        <li>Pickup orders are typically ready for collection within <strong>24 hours</strong> of placement.</li>
                                    </ul>

                                    <h4 className="fw-bold text-dark font-oswald text-uppercase mt-4 mb-2 d-flex align-items-center gap-2">
                                        <Clock size={18} className="text-info" /> 2. Doorstep Delivery Timelines
                                    </h4>
                                    <p>
                                        For orders shipped to your residential or office address:
                                    </p>
                                    <ul>
                                        <li><strong>Delhi NCR (Gurugram, Delhi, Noida, Faridabad):</strong> 1 to 2 business days.</li>
                                        <li><strong>North &amp; Central India:</strong> 3 to 5 business days.</li>
                                        <li><strong>Rest of India:</strong> 4 to 7 business days via reliable courier partners (BlueDart, Delhivery, DTDC).</li>
                                    </ul>

                                    <h4 className="fw-bold text-dark font-oswald text-uppercase mt-4 mb-2 d-flex align-items-center gap-2">
                                        <PackageCheck size={18} className="text-info" /> 3. Order Tracking &amp; Notifications
                                    </h4>
                                    <p>
                                        As soon as your package is dispatched, you will receive an SMS and WhatsApp confirmation containing the consignment tracking number. You can also view real-time delivery status on your <Link href="/orders" className="text-decoration-none fw-semibold text-success">My Orders</Link> page.
                                    </p>

                                    <h4 className="fw-bold text-dark font-oswald text-uppercase mt-4 mb-2 d-flex align-items-center gap-2">
                                        <ShieldCheck size={18} className="text-info" /> 4. Protective Packaging for Heavy Bats &amp; Kits
                                    </h4>
                                    <p>
                                        English Willow and Kashmir Willow cricket bats, protective helmets, and kit bags are packaged with shock-absorbing multi-layer bubble wrap and reinforced outer cartons to eliminate transit damages. If package tamper is observed at delivery, please take a photo and contact us immediately before accepting delivery.
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
