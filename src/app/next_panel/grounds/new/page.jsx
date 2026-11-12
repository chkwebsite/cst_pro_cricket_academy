"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import GroundForm from "../GroundForm";

export default function GroundNew() {
    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href="/next_panel/grounds" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to Grounds
                        </Link>
                        <h1 className="h4 mb-0">Create Ground</h1>
                        <p className="text-muted mb-0">Add a new ground.</p>
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <GroundForm />
                    </div>
                </div>
            </div>
        </div>
    );
}
