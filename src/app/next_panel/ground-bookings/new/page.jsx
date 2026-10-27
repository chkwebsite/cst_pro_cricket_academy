"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import GroundBookingForm from "../GroundBookingForm";

export default function GroundBookingNew() {
    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href="/next_panel/ground-bookings" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to Ground Bookings
                        </Link>
                        <h1 className="h4 mb-0">Create Booking</h1>
                        <p className="text-muted mb-0">Reserve a ground slot for a date.</p>
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <Suspense fallback={<div className="text-center py-5">Loading...</div>}>
                            <GroundBookingForm />
                        </Suspense>
                    </div>
                </div>
            </div>
        </div>
    );
}
