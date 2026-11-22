"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import RoleForm, { getEmptyRole, buildRolePayload } from "../../RoleForm";

export default function EditRolePage() {
    const [values, setValues] = useState(getEmptyRole());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});
    const params = useParams();
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

    useEffect(() => {
        async function loadRole() {
            try {
                const res = await fetch(`/api/roles/${params.id}`);
                const json = await res.json();
                if (!res.ok) throw new Error(json.message || "Unable to load role.");
                const role = json.data;
                setValues({
                    role_name: role.role_name || "",
                    role_desc: role.role_desc || "",
                    academy_id: role.academy_id ?? "",
                    branch_id: role.branch_id ?? "",
                    status: role.status ?? 1,
                });
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        loadRole();
    }, [params.id]);

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
            const res = await fetch(`/api/roles/${params.id}`, {
                method: "PUT",
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
                throw new Error(json.message || "Unable to update role.");
            }
            router.push(`/next_panel/roles/${params.id}`);
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
                                <h1 className="h4 mb-2">Edit Role</h1>
                                <p className="text-muted mb-0">Update role name, description, and scope.</p>
                            </div>
                            <button className="btn btn-primary" type="submit" form="roleEditForm" disabled={saving || loading}>
                                <Save size={16} className="me-2" /> {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        {loading ? (
                            <div className="text-center py-5 text-muted">Loading role details...</div>
                        ) : (
                            <RoleForm
                                formId="roleEditForm"
                                values={values}
                                onChange={handleValuesChange}
                                onSubmit={handleSubmit}
                                error={error}
                                fieldErrors={fieldErrors}
                                onBlur={handleBlur}
                                loading={saving}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
