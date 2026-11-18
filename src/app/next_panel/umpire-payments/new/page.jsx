"use client";

import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, IndianRupee } from "lucide-react";
import UmpirePaymentForm from "../UmpirePaymentForm";

export default function UmpirePaymentNewPage() {
    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-2">
                        <Link href="/next_panel/umpire-payments" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to Umpire Payments
                        </Link>
                        <h3 className="h4 mb-1 d-flex align-items-center gap-2">
                            <IndianRupee size={22} className="text-primary" />
                            <span>Record Umpire Payment</span>
                        </h3>
                        <p className="text-muted mb-0">
                            Disburse match officiating fee or ground booking fee to the umpire.
                        </p>
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <Suspense fallback={<div className="text-center py-4 text-muted">Loading form...</div>}>
                            <UmpirePaymentForm />
                        </Suspense>
                    </div>
                </div>
            </div>
        </div>
    );
}
