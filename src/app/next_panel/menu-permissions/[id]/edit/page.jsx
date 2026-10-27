"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

import MenuPermissionForm, {
    buildMenuPermissionPayload,
} from "../../MenuPermissionForm";

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

export default function EditMenuPermissionPage() {
    const params = useParams();
    const router = useRouter();

    const [values, setValues] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    // =====================================================
    // LOAD MENU PERMISSION
    // =====================================================

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(
                    `/api/menu-permissions/${params.id}`
                );

                const json = await readJson(res);

                if (!res.ok) {
                    throw new Error(
                        json.message ||
                        "Unable to load menu permission."
                    );
                }

                const d = json.data;

                setValues({
                    menu_id: d.menu_id ?? "",
                    permission_id: d.permission_id ?? "",
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

        setSaving(true);
        setError(null);

        try {
            const res = await fetch(
                `/api/menu-permissions/${params.id}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type": "application/json",
                    },

                    body: JSON.stringify(
                        buildMenuPermissionPayload(values)
                    ),
                }
            );

            const json = await readJson(res);

            if (!res.ok) {
                throw new Error(
                    json.message ||
                    "Unable to update menu permission."
                );
            }

            router.push(
                `/next_panel/menu-permissions/${params.id}`
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
                                href={`/next_panel/menu-permissions/${params.id}`}
                                className="btn btn-sm btn-outline-secondary mb-3"
                            >
                                <ArrowLeft
                                    size={16}
                                    className="me-2"
                                />

                                Back
                            </Link>

                            <h1 className="h4 mb-2">
                                Edit Menu Permission
                            </h1>
                        </div>

                        <button
                            className="btn btn-primary"
                            type="submit"
                            form="menuPermissionEditForm"
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
                            <MenuPermissionForm
                                formId="menuPermissionEditForm"
                                values={values}
                                onChange={setValues}
                                onSubmit={submit}
                                error={error}
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
