"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

import UserBranchForm, {
    buildUserBranchPayload,
} from "../../UserBranchForm";

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

export default function EditUserBranchPage() {
    const params = useParams();
    const router = useRouter();

    const [values, setValues] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});

    const handleValuesChange = (newValues) => {
        setFieldErrors((prev) => {
            const next = { ...prev };
            if (newValues.user_id && next.user_id) delete next.user_id;
            if (newValues.branch_id && next.branch_id) delete next.branch_id;
            return next;
        });
        setValues(newValues);
    };

    const handleBlur = (field) => () => {
        if (field === "user_id" && !values?.user_id) {
            setFieldErrors((prev) => ({ ...prev, user_id: "Please select a user." }));
        }
        if (field === "branch_id" && !values?.branch_id) {
            setFieldErrors((prev) => ({ ...prev, branch_id: "Please select a branch." }));
        }
    };

    // =====================================================
    // LOAD USER BRANCH
    // =====================================================

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(
                    `/api/user-branches/${params.id}`
                );

                const json = await readJson(res);

                if (!res.ok) {
                    throw new Error(
                        json.message ||
                        "Unable to load user branch."
                    );
                }

                const d = json.data;

                setValues({
                    user_id: d.user_id ?? "",
                    branch_id: d.branch_id ?? "",
                    is_primary: d.is_primary ? 1 : 0,
                    status: d.status ?? 1,
                });
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [params.id]);

    // =====================================================
    // SUBMIT
    // =====================================================

    const submit = async (e) => {
        e.preventDefault();

        const errs = {};
        if (!values?.user_id) errs.user_id = "Please select a user.";
        if (!values?.branch_id) errs.branch_id = "Please select a branch.";

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
        setFieldErrors({});

        try {
            const res = await fetch(
                `/api/user-branches/${params.id}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type": "application/json",
                    },

                    body: JSON.stringify(
                        buildUserBranchPayload(values)
                    ),
                }
            );

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
                    "Unable to update user branch."
                );
            }

            router.push(
                `/next_panel/user-branches/${params.id}`
            );
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
                                href={`/next_panel/user-branches/${params.id}`}
                                className="btn btn-sm btn-outline-secondary mb-3"
                            >
                                <ArrowLeft
                                    size={16}
                                    className="me-2"
                                />

                                Back
                            </Link>

                            <h1 className="h4 mb-2">
                                Edit User Branch
                            </h1>
                        </div>

                        <button
                            className="btn btn-primary"
                            type="submit"
                            form="userBranchEditForm"
                            disabled={saving || loading}
                        >
                            <Save
                                size={16}
                                className="me-2"
                            />

                            {saving
                                ? "Saving..."
                                : "Save Changes"}
                        </button>
                    </div>
                </div>

                {/* =================================================
                    FORM
                ================================================= */}

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">

                        {loading ? (
                            <div className="text-center py-5 text-muted">
                                Loading...
                            </div>
                        ) : values ? (
                            <UserBranchForm
                                formId="userBranchEditForm"
                                values={values}
                                onChange={handleValuesChange}
                                onSubmit={submit}
                                error={error}
                                fieldErrors={fieldErrors}
                                onBlur={handleBlur}
                                loading={saving}
                            />
                        ) : (
                            <div className="alert alert-danger">
                                {error || "Unable to load."}
                            </div>
                        )}

                    </div>
                </div>

            </div>
        </div>
    );
}
