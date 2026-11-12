"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit, GraduationCap, Image as ImageIcon, Trash2 } from "lucide-react";
// import { useAuth } from "@/components/utils/AuthContext";

const fields = [
    ["Academy Code", "academy_code"],
    ["Contact Person", "contact_person"],
    ["Email", "email"],
    ["Phone", "phone"],
    ["Website", "website"],
    ["Address", "address"],
    ["City", "city"],
    ["State", "state"],
    ["Pin Code", "pin_code"],
    ["GST No.", "gst_no"],
    ["PAN No.", "pan_no"],
];

export default function AcademyDetailPage() {
    // const { user: userInfo } = useAuth();
    const [academy, setAcademy] = useState(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState(null);
    const params = useParams();
    const router = useRouter();

    useEffect(() => {
        async function loadAcademy() {
            try {
                const res = await fetch(`/api/academies/${params.id}`);
                const json = await res.json();
                if (!res.ok) throw new Error(json.message || "Unable to load academy.");
                setAcademy(json.data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        loadAcademy();
    }, [params.id]);

    const handleDelete = async () => {
        if (!confirm("Delete this academy?")) return;

        setDeleting(true);
        setError(null);

        try {
            const res = await fetch(`/api/academies/${params.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Unable to delete academy.");
            router.push("/next_panel/academies");
        } catch (err) {
            setError(err.message);
        } finally {
            setDeleting(false);
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
                                <div className="d-flex align-items-center gap-2 mb-2">
                                    <GraduationCap size={24} />
                                    <h1 className="h4 mb-0">{academy?.academy_name || "Academy Details"}</h1>
                                </div>
                                <p className="text-muted mb-0">View and manage this academy profile.</p>
                            </div>
                            <div className="d-flex gap-2">
                                {/* {userInfo.permissions.includes("academies.edit") && ( */}
                                    <Link href={`/next_panel/academies/${params.id}/edit`} className="btn btn-primary">
                                        <Edit size={16} className="me-2" /> Edit
                                    </Link>
                                {/* )}
                                {userInfo.permissions.includes("academies.delete") && ( */}
                                    <button className="btn btn-outline-danger" onClick={handleDelete} disabled={deleting}>
                                        <Trash2 size={16} className="me-2" /> {deleting ? "Deleting..." : "Delete"}
                                    </button>
                                {/* )} */}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        {loading ? (
                            <div className="text-center py-5 text-muted">Loading academy details...</div>
                        ) : error ? (
                            <div className="alert alert-danger">{error}</div>
                        ) : (
                            <div className="row gy-4">
                                <div className="col-12 d-flex align-items-center gap-3">
                                    <div
                                        className="d-flex align-items-center justify-content-center bg-light rounded-3 border overflow-hidden flex-shrink-0"
                                        style={{ width: 72, height: 72 }}
                                    >
                                        {academy.logo ? (
                                            <img src={academy.logo} alt={academy.academy_name} className="w-100 h-100" style={{ objectFit: "cover" }} />
                                        ) : (
                                            <ImageIcon size={26} className="text-muted" />
                                        )}
                                    </div>
                                    <div className="d-flex align-items-center gap-2">
                                        <span className={`badge ${academy.status === 1 ? "bg-success" : "bg-secondary"}`}>
                                            {academy.status === 1 ? "Active" : "Inactive"}
                                        </span>
                                        <span className="text-muted small">ID: {academy.id}</span>
                                    </div>
                                </div>

                                {fields.map(([label, key]) => (
                                    <div className="col-md-6" key={key}>
                                        <h2 className="h6 mb-1">{label}</h2>
                                        <p className="mb-0 text-muted">{academy[key] || "Not provided"}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
