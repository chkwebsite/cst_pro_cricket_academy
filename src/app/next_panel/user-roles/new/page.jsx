"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

import UserRoleForm, {
    getEmptyUserRole,
    buildUserRolePayload,
} from "../UserRoleForm";

async function readJson(res) {
    const text = await res.text();

    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch {
        return {
            message: text,
        };
    }
}

export default function NewUserRolePage() {
    const [values, setValues] = useState(getEmptyUserRole());
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});

    const router = useRouter();

    const handleValuesChange = (newValues) => {
        setFieldErrors((prev) => {
            const next = { ...prev };
            if (newValues.user_id && next.user_id) delete next.user_id;
            if (newValues.role_id && next.role_id) delete next.role_id;
            return next;
        });
        setValues(newValues);
    };

    const handleBlur = (field) => () => {
        if (field === "user_id" && !values.user_id) {
            setFieldErrors((prev) => ({ ...prev, user_id: "Please select a user." }));
        }
        if (field === "role_id" && !values.role_id) {
            setFieldErrors((prev) => ({ ...prev, role_id: "Please select a role." }));
        }
    };

    // =====================================================
    // SUBMIT
    // =====================================================

    const submit = async (e) => {
        e.preventDefault();

        const errs = {};
        if (!values.user_id) errs.user_id = "Please select a user.";
        if (!values.role_id) errs.role_id = "Please select a role.";

        if (Object.keys(errs).length > 0) {
            setFieldErrors(errs);
            const firstKey = Object.keys(errs)[0];
            const el = document.querySelector(`[name="${firstKey}"]`);
            if (el) {
                el.focus();
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const res = await fetch("/api/user-roles", {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                },

                body: JSON.stringify(
                    buildUserRolePayload(values)
                ),
            });

            const json = await readJson(res);

            if (!res.ok) {
                if (json.errors) {
                    setFieldErrors(json.errors);
                    const firstKey = Object.keys(json.errors)[0];
                    const el = document.querySelector(`[name="${firstKey}"]`);
                    if (el) {
                        el.focus();
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                }
                throw new Error(
                    json.message ||
                    "Unable to create user role."
                );
            }

            router.push("/next_panel/user-roles");
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    // =====================================================
    // UI
    // =====================================================

    return (
        <div className="container-fluid">
            <div className="row g-4">

                {/* =================================================
                    HEADER
                ================================================= */}

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">

                        <div>
                            <Link
                                href="/next_panel/user-roles"
                                className="btn btn-sm btn-outline-secondary mb-3"
                            >
                                <ArrowLeft
                                    size={16}
                                    className="me-2"
                                />

                                Back
                            </Link>

                            <h1 className="h4 mb-2">
                                Assign Role to User
                            </h1>

                            <p className="text-muted mb-0">
                                Grant a user access via a role.
                            </p>
                        </div>

                        <button
                            className="btn btn-primary"
                            type="submit"
                            form="userRoleForm"
                            disabled={saving}
                        >
                            <Plus
                                size={16}
                                className="me-2"
                            />

                            {saving
                                ? "Saving..."
                                : "Save User Role"}
                        </button>
                    </div>
                </div>

                {/* =================================================
                    FORM
                ================================================= */}

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <UserRoleForm
                            formId="userRoleForm"
                            values={values}
                            onChange={handleValuesChange}
                            onSubmit={submit}
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
