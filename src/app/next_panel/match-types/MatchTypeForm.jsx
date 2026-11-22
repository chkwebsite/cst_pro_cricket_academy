"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { FormError, RequiredLabel } from "@/app/components/form";

const LIST_URL = "/next_panel/match-types";

// Shared by the "new" and "edit" pages.
// - initial: existing match type (edit) or undefined (create)
// - matchTypeId: set when editing
export default function MatchTypeForm({ initial, matchTypeId }) {
    const router = useRouter();
    const isEdit = !!matchTypeId;

    const [form, setForm] = useState({
        name: initial?.name || "",
        code: initial?.code || "",
        description: initial?.description || "",
        status: initial ? String(initial.status) : "1",
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});

    const setField = (key, value) => {
        if (fieldErrors[key]) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
        setForm((f) => ({ ...f, [key]: value }));
    };

    const handleBlur = (field) => () => {
        if (field === "name" && !form.name.trim()) {
            setFieldErrors((prev) => ({ ...prev, name: "Match type name is required." }));
        }
        if (field === "code" && !form.code.trim()) {
            setFieldErrors((prev) => ({ ...prev, code: "Match type code is required." }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        const errs = {};
        if (!form.name.trim()) errs.name = "Match type name is required.";
        if (!form.code.trim()) errs.code = "Match type code is required.";

        if (Object.keys(errs).length > 0) {
            setFieldErrors(errs);
            const firstKey = Object.keys(errs)[0];
            const el = document.getElementById(`mt-${firstKey}`);
            if (el) {
                el.focus();
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            return;
        }

        setSaving(true);
        setFieldErrors({});

        try {
            const res = await fetch(isEdit ? `/api/match-types/${matchTypeId}` : "/api/match-types", {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name.trim(),
                    code: form.code.trim(),
                    description: form.description.trim() || null,
                    status: Number(form.status),
                }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.success) {
                if (json.errors) {
                    setFieldErrors(json.errors);
                    const firstKey = Object.keys(json.errors)[0];
                    const el = document.getElementById(`mt-${firstKey}`);
                    if (el) {
                        el.focus();
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                }
                throw new Error(json.message || "Failed to save match type");
            }

            router.push(LIST_URL);
            router.refresh();
        } catch (err) {
            setError(err.message);
            setSaving(false);
        }
    };

    return (
        <div className="container-fluid">
            <div className="bg-white rounded-4 shadow-sm p-4" style={{ maxWidth: 720 }}>
                <Link href={LIST_URL} className="btn btn-sm btn-outline-secondary mb-3">
                    <ArrowLeft size={16} className="me-2" /> Back to match types
                </Link>
                <h1 className="h4 mb-4">{isEdit ? "Edit match type" : "Add match type"}</h1>

                {error && (
                    <div className="alert alert-danger" role="alert">{error}</div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                    <div className="mb-3">
                        <label htmlFor="mt-name" className="form-label fw-semibold">
                            Name <span style={{ color: "#dc3545" }}>*</span>
                        </label>
                        <input
                            id="mt-name"
                            className={`form-control ${fieldErrors.name ? "is-invalid border-danger" : ""}`}
                            value={form.name}
                            onChange={(e) => setField("name", e.target.value)}
                            onBlur={handleBlur("name")}
                            placeholder="e.g. Limited Overs"
                            autoFocus
                        />
                        <FormError error={fieldErrors.name} />
                    </div>

                    <div className="mb-3">
                        <label htmlFor="mt-code" className="form-label fw-semibold">
                            Code <span style={{ color: "#dc3545" }}>*</span>
                        </label>
                        <input
                            id="mt-code"
                            className={`form-control text-uppercase ${fieldErrors.code ? "is-invalid border-danger" : ""}`}
                            value={form.code}
                            onChange={(e) => setField("code", e.target.value)}
                            onBlur={handleBlur("code")}
                            placeholder="e.g. LO"
                        />
                        <FormError error={fieldErrors.code} />
                        <div className="form-text">Saved in capitals and must be unique.</div>
                    </div>

                    <div className="mb-3">
                        <label htmlFor="mt-desc" className="form-label fw-semibold">Description</label>
                        <textarea
                            id="mt-desc"
                            className="form-control"
                            rows={3}
                            value={form.description}
                            onChange={(e) => setField("description", e.target.value)}
                        />
                    </div>

                    <div className="mb-4">
                        <label htmlFor="mt-status" className="form-label fw-semibold">Status</label>
                        <select
                            id="mt-status"
                            className="form-select"
                            value={form.status}
                            onChange={(e) => setField("status", e.target.value)}
                        >
                            <option value="1">Active</option>
                            <option value="0">Inactive</option>
                        </select>
                    </div>

                    <div className="d-flex gap-2">
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            <Save size={16} className="me-2" />
                            {saving ? "Saving..." : isEdit ? "Save changes" : "Create match type"}
                        </button>
                        <Link href={LIST_URL} className="btn btn-outline-secondary">Cancel</Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
