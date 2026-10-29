"use client";

import { useEffect, useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import Link from "next/link";
import {
    Calendar,
    Clock,
    MapPin,
    Phone,
    Plus,
    RefreshCw,
    Shield,
    User,
} from "lucide-react";
import { useUser } from "@/app/next_panel/components/UserContext";

export default function MyBookingsPage() {
    const { user, isLoggedIn } = useUser();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadBookings = async () => {
        setLoading(true);
        setError(null);
        try {
            const query = user?.phone || user?.email || user?.name || "";
            const res = await fetch(`/api/ground-booking-requests?search=${encodeURIComponent(query)}`);
            const json = await res.json();
            if (res.ok && json.success) {
                setBookings(json.data || []);
            } else {
                setBookings([]);
            }
        } catch (err) {
            setError("Failed to load your ground bookings.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isLoggedIn && user) {
            loadBookings();
        } else {
            setLoading(false);
        }
    }, [isLoggedIn, user]);

    return (
        <>
            <PageHeader
                title="My Ground Bookings"
                breadcrumbs={[{ label: "Home", href: "/" }]}
                current="My Bookings"
            />

            <section className="py-5" style={{ background: "#f8fbfb", minHeight: "80vh" }}>
                <div className="container">
                    {/* Header Strip */}
                    <div className="bg-white p-4 rounded-4 shadow-sm border mb-4 d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3">
                        <div>
                            <h4 className="fw-bold font-oswald text-uppercase text-dark mb-1">
                                Turf Slot Reservations
                            </h4>
                            <p className="text-muted small mb-0">
                                View status, ground details, and match dates for your booked cricket slots.
                            </p>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm rounded-pill px-3 d-flex align-items-center gap-1.5"
                                onClick={loadBookings}
                                disabled={loading}
                            >
                                <RefreshCw size={13} className={loading ? "spin" : ""} />
                                <span>Refresh</span>
                            </button>
                            <Link
                                href="/ground-booking"
                                className="btn btn-dark btn-sm rounded-pill px-3.5 d-flex align-items-center gap-1.5 fw-semibold"
                            >
                                <Plus size={14} />
                                <span>Book New Slot</span>
                            </Link>
                        </div>
                    </div>

                    {!isLoggedIn ? (
                        <div className="card border-0 rounded-4 shadow-sm p-5 bg-white text-center">
                            <Calendar size={48} className="text-muted opacity-40 mx-auto mb-3" />
                            <h4 className="fw-bold font-oswald text-uppercase text-dark mb-2">
                                Please Log In to View Your Bookings
                            </h4>
                            <p className="text-muted small mb-4" style={{ maxWidth: "420px", margin: "0 auto" }}>
                                Sign in with your registered phone number or email to view your confirmed ground reservations and payment status.
                            </p>
                            <div className="d-flex justify-content-center gap-3">
                                <Link href="/login" className="btn btn-dark rounded-pill px-4">
                                    Login to Account
                                </Link>
                                <Link href="/ground-booking" className="btn btn-outline-success rounded-pill px-4">
                                    Book as Guest
                                </Link>
                            </div>
                        </div>
                    ) : loading ? (
                        <div className="text-center py-5 bg-white rounded-4 border shadow-sm p-5">
                            <div className="spinner-border text-success" role="status" />
                            <p className="text-muted mt-2 small mb-0">Fetching your ground slot reservations...</p>
                        </div>
                    ) : error ? (
                        <div className="alert alert-danger text-center py-4 rounded-4">{error}</div>
                    ) : bookings.length === 0 ? (
                        <div className="card border-0 rounded-4 shadow-sm p-5 bg-white text-center">
                            <Calendar size={48} className="text-muted opacity-40 mx-auto mb-3" />
                            <h4 className="fw-bold font-oswald text-uppercase text-dark mb-2">
                                No Ground Bookings Found
                            </h4>
                            <p className="text-muted small mb-4" style={{ maxWidth: "420px", margin: "0 auto" }}>
                                You have not reserved any match grounds or practice nets yet. Check availability and reserve your cricket slot.
                            </p>
                            <div>
                                <Link href="/ground-booking" className="btn btn-success rounded-pill px-4 py-2.5 fw-semibold">
                                    Browse Available Slots
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="row g-3">
                            {bookings.map((b) => (
                                <div key={b.id} className="col-12">
                                    <div className="card border-0 rounded-4 shadow-sm p-4 bg-white">
                                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 pb-2 border-bottom">
                                            <div>
                                                <span className="badge bg-light text-dark border me-2">
                                                    {b.request_number || `REQ-${b.id}`}
                                                </span>
                                                <span className="badge bg-dark text-white rounded-pill px-3 py-1">
                                                    {b.request_status || "Pending"}
                                                </span>
                                            </div>
                                            <div className="text-muted small">
                                                Booked on: {b.created_at ? new Date(b.created_at).toLocaleDateString() : "Recent"}
                                            </div>
                                        </div>

                                        <div className="row g-3">
                                            <div className="col-md-4">
                                                <div className="small text-muted mb-1">Ground / Turf Venue</div>
                                                <div className="fw-bold text-dark fs-6 d-flex align-items-center gap-1.5">
                                                    <MapPin size={16} className="text-danger flex-shrink-0" />
                                                    <span>{b.ground_name || "Main Campus Cricket Ground"}</span>
                                                </div>
                                            </div>
                                            <div className="col-md-4">
                                                <div className="small text-muted mb-1">Match Date &amp; Time</div>
                                                <div className="fw-bold text-dark fs-6 d-flex align-items-center gap-1.5">
                                                    <Calendar size={16} className="text-success flex-shrink-0" />
                                                    <span>{b.booking_date || "Date TBA"}</span>
                                                    {b.slot_title && (
                                                        <span className="text-muted small">({b.slot_title})</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="col-md-4">
                                                <div className="small text-muted mb-1">Team / Coordinator</div>
                                                <div className="fw-semibold text-dark fs-6 d-flex align-items-center gap-1.5">
                                                    <User size={16} className="text-primary flex-shrink-0" />
                                                    <span>{b.customer_name || user?.name || "Player"}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-3 mt-3 border-top d-flex align-items-center justify-content-between flex-wrap gap-2">
                                            <div className="small text-muted">
                                                Need changes or umpire support?
                                            </div>
                                            <a
                                                href="tel:+918285831503"
                                                className="btn btn-sm btn-outline-success rounded-pill px-3 d-flex align-items-center gap-1"
                                            >
                                                <Phone size={13} />
                                                Contact Coordinator
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </>
    );
}
