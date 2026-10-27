"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import AcademyForm, { getEmptyAcademy, buildAcademyFormData } from "../AcademyForm";

export default function NewAcademyPage() {
    const [values, setValues] = useState(getEmptyAcademy());
    const [logoFile, setLogoFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const router = useRouter();

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const res = await fetch("/api/academies", {
                method: "POST",
                body: buildAcademyFormData(values, logoFile),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Unable to create academy.");
            router.push("/next_panel/academies");
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
                                <Link href="/next_panel/academies" className="btn btn-sm btn-outline-secondary mb-3">
                                    <ArrowLeft size={16} className="me-2" /> Back to Academies
                                </Link>
                                <h1 className="h4 mb-2">Create Academy</h1>
                                <p className="text-muted mb-0">Add a new partner academy profile.</p>
                            </div>
                            <button className="btn btn-primary" type="submit" form="academyForm" disabled={saving}>
                                <Plus size={16} className="me-2" /> {saving ? "Saving..." : "Save Academy"}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <AcademyForm
                            formId="academyForm"
                            values={values}
                            onChange={setValues}
                            onSubmit={handleSubmit}
                            error={error}
                            loading={saving}
                            onLogoFileChange={setLogoFile}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
