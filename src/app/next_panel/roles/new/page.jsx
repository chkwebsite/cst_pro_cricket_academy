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
    const [fieldErrors, setFieldErrors] = useState({});
    const router = useRouter();

    const handleValuesChange = (newValues) => {
        if (fieldErrors.role_name && newValues.role_name?.trim()) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.role_name;
                return next;
            });
        }
        setValues(newValues);
    };

    const handleBlur = (field) => () => {
        if (field === "role_name" && !values.role_name?.trim()) {
            setFieldErrors((prev) => ({ ...prev, role_name: "Role name is required." }));
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!values.role_name?.trim()) {
            setFieldErrors({ role_name: "Role name is required." });
            const el = document.querySelector('[name="role_name"]');
            if (el) {
                el.focus();
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const res = await fetch("/api/roles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildRolePayload(values)),
            });
            const json = await res.json();
            if (!res.ok) {
                if (json.errors) {
                    setFieldErrors(json.errors);
                    const el = document.querySelector('[name="role_name"]');
                    if (el) {
                        el.focus();
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                }
                throw new Error(json.message || "Unable to create role.");
            }
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
                                <p className="text-muted mb-0">Add a new role scoped to an academy or branch, or create as global.</p>
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
                            onChange={handleValuesChange}
                            onSubmit={handleSubmit}
                            error={error}
                            fieldErrors={fieldErrors}
                            onBlur={handleBlur}
                            loading={saving}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
