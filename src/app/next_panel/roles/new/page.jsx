"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import RoleForm, { getEmptyRole, buildRolePayload } from "../RoleForm";

export default function NewRolePage() {
    const [values, setValues] = useState(getEmptyRole());
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const router = useRouter();

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const res = await fetch("/api/roles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildRolePayload(values)),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Unable to create role.");
            router.push("/next_panel/roles");
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                            <div>
                                <Link href="/next_panel/roles" className="btn btn-sm btn-outline-secondary mb-3">
                                    <ArrowLeft size={16} className="me-2" /> Back to Roles
                                </Link>
                                <h1 className="h4 mb-2">Create Role</h1>
                                <p className="text-muted mb-0">Add a new role, optionally scoped to an academy or branch.</p>
                            </div>
                            <button className="btn btn-primary" type="submit" form="roleForm" disabled={saving}>
                                <Plus size={16} className="me-2" /> {saving ? "Saving..." : "Save Role"}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <RoleForm
                            formId="roleForm"
                            values={values}
                            onChange={setValues}
                            onSubmit={handleSubmit}
                            error={error}
                            loading={saving}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
