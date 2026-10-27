"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import BranchForm, { getEmptyBranch, buildBranchPayload } from "../../BranchForm";

export default function EditBranchPage() {
    const [values, setValues] = useState(getEmptyBranch());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const params = useParams();
    const router = useRouter();

    useEffect(() => {
        async function loadBranch() {
            try {
                const res = await fetch(`/api/branch/${params.id}`);
                const json = await res.json();
                if (!res.ok) throw new Error(json.message || "Unable to load branch.");
                const branch = json.data;
                setValues({
                    academy_id: branch.academy_id ?? "",
                    branch_name: branch.branch_name || "",
                    branch_code: branch.branch_code || "",
                    email: branch.email || "",
                    phone: branch.phone || "",
                    address: branch.address || "",
                    city: branch.city || "",
                    state: branch.state || "",
                    pin_code: branch.pin_code || "",
                    status: branch.status ?? 1,
                });
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        loadBranch();
    }, [params.id]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const res = await fetch(`/api/branch/${params.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildBranchPayload(values)),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Unable to update branch.");
            router.push(`/next_panel/branches/${params.id}`);
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
                                <Link href="/next_panel/branches" className="btn btn-sm btn-outline-secondary mb-3">
                                    <ArrowLeft size={16} className="me-2" /> Back to Branches
                                </Link>
                                <h1 className="h4 mb-2">Edit Branch</h1>
                                <p className="text-muted mb-0">Update branch profile and contact settings.</p>
                            </div>
                            <button className="btn btn-primary" type="submit" form="branchEditForm" disabled={saving || loading}>
                                <Save size={16} className="me-2" /> {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        {loading ? (
                            <div className="text-center py-5 text-muted">Loading branch details...</div>
                        ) : (
                            <BranchForm
                                formId="branchEditForm"
                                values={values}
                                onChange={setValues}
                                onSubmit={handleSubmit}
                                error={error}
                                loading={saving}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
