"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import AgeGroupForm from "../AgeGroupForm";

export default function AgeGroupNew() {
    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                            <div>
                                <Link href="/next_panel/age-groups" className="btn btn-sm btn-outline-secondary mb-3">
                                    <ArrowLeft size={16} className="me-2" /> Back to Age Groups
                                </Link>
                                <h1 className="h4 mb-0">Add Age Group</h1>
                                <p className="text-muted mb-0">Create a new age group.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <AgeGroupForm />
                    </div>
                </div>
            </div>
        </div>
    );
}
