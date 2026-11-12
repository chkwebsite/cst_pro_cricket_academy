"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import FeePaymentForm from "../FeePaymentForm";

function FeePaymentHeader() {
    const searchParams = useSearchParams();
    const from = searchParams.get("from");
    const isFromFeeStatus = from === "fee-status";

    return (
        <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
            <Link
                href={isFromFeeStatus ? "/next_panel/fee-status" : "/next_panel/fee-payments"}
                className="btn btn-sm btn-outline-secondary mb-3"
            >
                <ArrowLeft size={16} className="me-2" />
                {isFromFeeStatus ? "Back to Fee Status" : "Back to Fee Payments"}
            </Link>
            <h1 className="h4 mb-0">Record Payment</h1>
            <p className="text-muted mb-0">Add a payment against a fee record.</p>
        </div>
    );
}

export default function FeePaymentNew() {
    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <Suspense
                        fallback={
                            <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                                <h1 className="h4 mb-0">Record Payment</h1>
                            </div>
                        }
                    >
                        <FeePaymentHeader />
                    </Suspense>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        {/* the form reads ?fee_status_id= via useSearchParams */}
                        <Suspense fallback={<div className="text-center py-4">Loading...</div>}>
                            <FeePaymentForm />
                        </Suspense>
                    </div>
                </div>
            </div>
        </div>
    );
}
