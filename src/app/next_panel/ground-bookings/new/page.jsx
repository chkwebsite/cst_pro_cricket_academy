"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useUser } from "../../components/UserContext";
import GroundBookingForm from "../GroundBookingForm";

export default function GroundBookingNew() {
    const router = useRouter();
    const { user } = useUser();
    const userRole = String(user?.user_type || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const isPlayer = userRole.includes("player") || userRole === "7";

    useEffect(() => {
        if (isPlayer) {
            router.replace("/next_panel/ground-bookings");
        }
    }, [isPlayer, router]);

    if (isPlayer) {
        return null;
    }
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
