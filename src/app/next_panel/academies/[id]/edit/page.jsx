"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import AcademyForm, { getEmptyAcademy, buildAcademyFormData } from "../../AcademyForm";

export default function EditAcademyPage() {
    const [values, setValues] = useState(getEmptyAcademy());
    const [logoFile, setLogoFile] = useState(null);
    const [existingLogoUrl, setExistingLogoUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const params = useParams();
    const router = useRouter();

    useEffect(() => {
        async function loadAcademy() {
            try {
                const res = await fetch(`/api/academies/${params.id}`);
                const json = await res.json();
                if (!res.ok) throw new Error(json.message || "Unable to load academy.");
                const academy = json.data;
                setValues({
                    academy_name: academy.academy_name || "",
                    academy_code: academy.academy_code || "",
                    contact_person: academy.contact_person || "",
                    email: academy.email || "",
                    phone: academy.phone || "",
                    website: academy.website || "",
                    address: academy.address || "",
                    city: academy.city || "",
                    state: academy.state || "",
                    pin_code: academy.pin_code || "",
                    gst_no: academy.gst_no || "",
                    pan_no: academy.pan_no || "",
                    status: academy.status ?? 1,
                });
                setExistingLogoUrl(academy.logo || null);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        loadAcademy();
    }, [params.id]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const res = await fetch(`/api/academies/${params.id}`, {
                method: "PUT",
                body: buildAcademyFormData(values, logoFile),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Unable to update academy.");
            router.push(`/next_panel/academies/${params.id}`);
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
                                <h1 className="h4 mb-2">Edit Academy</h1>
                                <p className="text-muted mb-0">Update academy profile and contact settings.</p>
                            </div>
                            <button className="btn btn-primary" type="submit" form="academyEditForm" disabled={saving || loading}>
                                <Save size={16} className="me-2" /> {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        {loading ? (
                            <div className="text-center py-5 text-muted">Loading academy details...</div>
                        ) : (
                            <AcademyForm
                                formId="academyEditForm"
                                values={values}
                                onChange={setValues}
                                onSubmit={handleSubmit}
                                error={error}
                                loading={saving}
                                existingLogoUrl={existingLogoUrl}
                                onLogoFileChange={setLogoFile}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
