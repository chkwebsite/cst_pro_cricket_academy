"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

import UserBranchForm, {
    getEmptyUserBranch,
    buildUserBranchPayload,
} from "../UserBranchForm";

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

export default function NewUserBranchPage() {
    const [values, setValues] = useState(getEmptyUserBranch());
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
            const res = await fetch("/api/user-branches", {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                },

                body: JSON.stringify(
                    buildUserBranchPayload(values)
                ),
            });

            const json = await readJson(res);

            if (!res.ok) {
                throw new Error(
                    json.message ||
                    "Unable to create user branch."
                );
            }

            router.push("/next_panel/user-branches");
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
                                href="/next_panel/user-branches"
                                className="btn btn-sm btn-outline-secondary mb-3"
                            >
                                <ArrowLeft
                                    size={16}
                                    className="me-2"
                                />

                                Back
                            </Link>

                            <h1 className="h4 mb-2">
                                Create User Branch
                            </h1>

                            <p className="text-muted mb-0">
                                Assign a user to a branch.
                            </p>
                        </div>

                        <button
                            className="btn btn-primary"
                            type="submit"
                            form="userBranchForm"
                            disabled={saving}
                        >
                            <Plus
                                size={16}
                                className="me-2"
                            />

                            {saving
                                ? "Saving..."
                                : "Save User Branch"}
                        </button>
                    </div>
                </div>

                {/* =================================================
                    FORM
                ================================================= */}

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <UserBranchForm
                            formId="userBranchForm"
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
