"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

import MenuForm, {
    getEmptyMenu,
    buildMenuPayload,
} from "../MenuForm";

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

export default function NewMenuPage() {
    const [values, setValues] = useState(getEmptyMenu());
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});

    const router = useRouter();

    const handleValuesChange = (newValues) => {
        setFieldErrors((prev) => {
            const next = { ...prev };
            if (newValues.menu_key && next.menu_key) delete next.menu_key;
            if (newValues.menu_name && next.menu_name) delete next.menu_name;
            if (newValues.menu_title && next.menu_title) delete next.menu_title;
            return next;
        });
        setValues(newValues);
    };

    const handleBlur = (field) => () => {
        if (field === "menu_key" && !values.menu_key?.trim()) {
            setFieldErrors((prev) => ({ ...prev, menu_key: "Menu key is required." }));
        }
        if (field === "menu_name" && !values.menu_name?.trim()) {
            setFieldErrors((prev) => ({ ...prev, menu_name: "Menu name is required." }));
        }
        if (field === "menu_title" && !values.menu_title?.trim()) {
            setFieldErrors((prev) => ({ ...prev, menu_title: "Menu title is required." }));
        }
    };

    // =====================================================
    // SUBMIT
    // =====================================================

    const submit = async (e) => {
        e.preventDefault();

        const errs = {};
        if (!values.menu_key?.trim()) errs.menu_key = "Menu key is required.";
        if (!values.menu_name?.trim()) errs.menu_name = "Menu name is required.";
        if (!values.menu_title?.trim()) errs.menu_title = "Menu title is required.";

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
            const res = await fetch("/api/menu", {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                },

                body: JSON.stringify(
                    buildMenuPayload(values)
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
                    "Unable to create menu."
                );
            }

            router.push("/next_panel/menu");
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
                                href="/next_panel/menu"
                                className="btn btn-sm btn-outline-secondary mb-3"
                            >
                                <ArrowLeft
                                    size={16}
                                    className="me-2"
                                />

                                Back
                            </Link>

                            <h1 className="h4 mb-2">
                                Create Menu
                            </h1>

                            <p className="text-muted mb-0">
                                Add a new navigation menu item.
                            </p>
                        </div>

                        <button
                            className="btn btn-primary"
                            type="submit"
                            form="menuForm"
                            disabled={saving}
                        >
                            <Plus
                                size={16}
                                className="me-2"
                            />

                            {saving
                                ? "Saving..."
                                : "Save Menu"}
                        </button>
                    </div>
                </div>

                {/* =================================================
                    FORM
                ================================================= */}

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <MenuForm
                            formId="menuForm"
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
