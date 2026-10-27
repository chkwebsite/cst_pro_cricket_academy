"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Edit, Loader2 } from "lucide-react";
import GroundBookingRequestForm from "../../GroundBookingRequestForm";

export default function EditGroundBookingRequestPage({ params }) {
    const { id } = use(params);
    const [requestData, setRequestData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let isMounted = true;
        async function fetchRequest() {
            try {
                const res = await fetch(`/api/ground-booking-requests/${id}`, {
                    cache: "no-store",
                });
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to fetch request data");
                }
                if (isMounted) {
                    setRequestData(json.data);
                }
            } catch (err) {
                if (isMounted) setError(err.message);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchRequest();
        return () => {
            isMounted = false;
        };
    }, [id]);

    if (loading) {
        return (
            <div className="container-fluid py-5 text-center">
                <Loader2 className="spinner-border text-primary mb-2" size={32} />
                <p className="text-muted">Loading booking request #{id}...</p>
            </div>
        );
    }

    if (error || !requestData) {
        return (
            <div className="container-fluid py-4">
                <div className="alert alert-danger">
                    <h5>Error</h5>
                    <p>{error || "Booking request not found"}</p>
                    <Link
                        href="/next_panel/ground-booking-requests"
                        className="btn btn-outline-danger btn-sm"
                    >
                        Back to Requests
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid py-2">
            <div className="row g-3">
                {/* Header */}
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-2">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <div className="d-flex align-items-center gap-3">
                                <Link
                                    href={`/next_panel/ground-booking-requests/${id}`}
                                    className="btn btn-sm btn-outline-secondary rounded-circle p-2"
                                    title="Back"
                                >
                                    <ArrowLeft size={18} />
                                </Link>
                                <div>
                                    <h3 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                                        <Edit className="text-primary" size={24} />
                                        Edit Booking Request
                                    </h3>
                                    <p className="text-muted small mb-0">
                                        Reference: <strong>{requestData.request_number}</strong> • Customer: {requestData.customer_name}
                                    </p>
                                </div>
                            </div>

                            <Link
                                href={`/next_panel/ground-booking-requests/${id}`}
                                className="btn btn-outline-secondary px-3"
                            >
                                View Details
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <div className="col-12">
                    <GroundBookingRequestForm
                        isEdit={true}
                        initialData={requestData}
                        requestId={id}
                    />
                </div>
            </div>
        </div>
    );
}
