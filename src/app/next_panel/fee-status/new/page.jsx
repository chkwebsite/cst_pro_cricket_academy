"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import FeeStatusForm from "../FeeStatusForm";

export default function FeeStatusNew() {
    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href="/next_panel/fee-status" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to Fee Status
                        </Link>
                        <h1 className="h4 mb-0">Create Fee</h1>
                        <p className="text-muted mb-0">Add a new fee record.</p>
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <FeeStatusForm />
                    </div>
                </div>
            </div>
        </div>
    );
}
