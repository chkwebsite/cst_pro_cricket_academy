"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import UserForm from "../UserForm";

export default function UserNew() {
    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                            <div>
                                <Link href="/next_panel/users" className="btn btn-sm btn-outline-secondary mb-3">
                                    <ArrowLeft size={16} className="me-2" /> Back to Users
                                </Link>
                                <h1 className="h4 mb-0">Add User</h1>
                                <p className="text-muted mb-0">Create a login account and link it to a staff or player record.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <UserForm />
                    </div>
                </div>
            </div>
        </div>
    );
}
