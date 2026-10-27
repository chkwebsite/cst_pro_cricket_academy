"use client";

import Link from "next/link";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import GroundBookingRequestForm from "../GroundBookingRequestForm";

export default function NewGroundBookingRequestPage() {
    return (
        <div className="container-fluid py-2">
            <div className="row g-3">
                {/* Header Card */}
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-2">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <div className="d-flex align-items-center gap-3">
                                <Link
                                    href="/next_panel/ground-booking-requests"
                                    className="btn btn-sm btn-outline-secondary rounded-circle p-2"
                                    title="Back"
                                >
                                    <ArrowLeft size={18} />
                                </Link>
                                <div>
                                    <h3 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                                        <CalendarPlus className="text-primary" size={26} />
                                        New Ground Booking Request
                                    </h3>
                                    <p className="text-muted small mb-0">
                                        Log a new ground inquiry or phone match booking request.
                                    </p>
                                </div>
                            </div>

                            <Link
                                href="/next_panel/ground-booking-requests"
                                className="btn btn-outline-secondary px-3"
                            >
                                View All Requests
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Form Container */}
                <div className="col-12">
                    <GroundBookingRequestForm isEdit={false} />
                </div>
            </div>
        </div>
    );
}
