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

    const router = useRouter();

    // =====================================================
    // SUBMIT
    // =====================================================

    const submit = async (e) => {
        e.preventDefault();

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
                            onChange={setValues}
                            onSubmit={submit}
                            error={error}
                            loading={saving}
                        />
                    </div>
                </div>

            </div>
        </div>
    );
}
