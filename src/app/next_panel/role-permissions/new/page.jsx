"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import RolePermissionForm from "../RolePermissionForm";

export default function RolePermissionNew() {
    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                            <div>
                                <Link href="/next_panel/role-permissions" className="btn btn-sm btn-outline-secondary mb-3">
                                    <ArrowLeft size={16} className="me-2" /> Back to Role Permissions
                                </Link>
                                <h1 className="h4 mb-0">Assign Permission to Role</h1>
                                <p className="text-muted mb-0">Grant a permission to a role.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <RolePermissionForm />
                    </div>
                </div>
            </div>
        </div>
    );
}
