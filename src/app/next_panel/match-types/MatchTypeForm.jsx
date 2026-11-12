"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";

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

    const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!form.name.trim()) return setError("Match type name is required");
        if (!form.code.trim()) return setError("Match type code is required");

        setSaving(true);
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
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to save match type");

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
                        <label htmlFor="mt-name" className="form-label">Name <span className="text-danger">*</span></label>
                        <input
                            id="mt-name"
                            className="form-control"
                            value={form.name}
                            onChange={(e) => setField("name", e.target.value)}
                            placeholder="e.g. Limited Overs"
                            autoFocus
                        />
                    </div>

                    <div className="mb-3">
                        <label htmlFor="mt-code" className="form-label">Code <span className="text-danger">*</span></label>
                        <input
                            id="mt-code"
                            className="form-control text-uppercase"
                            value={form.code}
                            onChange={(e) => setField("code", e.target.value)}
                            placeholder="e.g. LO"
                        />
                        <div className="form-text">Saved in capitals and must be unique.</div>
                    </div>

                    <div className="mb-3">
                        <label htmlFor="mt-desc" className="form-label">Description</label>
                        <textarea
                            id="mt-desc"
                            className="form-control"
                            rows={3}
                            value={form.description}
                            onChange={(e) => setField("description", e.target.value)}
                        />
                    </div>

                    <div className="mb-4">
                        <label htmlFor="mt-status" className="form-label">Status</label>
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
