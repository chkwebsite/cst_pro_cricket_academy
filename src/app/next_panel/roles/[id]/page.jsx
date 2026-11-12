"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit, ShieldCheck, Trash2 } from "lucide-react";
// import { useAuth } from "@/components/utils/AuthContext";

export default function RoleDetailPage() {
    // const { user: userInfo } = useAuth();
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState(null);
    const params = useParams();
    const router = useRouter();

    useEffect(() => {
        async function loadRole() {
            try {
                const res = await fetch(`/api/roles/${params.id}`);
                const json = await res.json();
                if (!res.ok) throw new Error(json.message || "Unable to load role.");
                setRole(json.data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        loadRole();
    }, [params.id]);

    const handleDelete = async () => {
        if (!confirm("Delete this role?")) return;

        setDeleting(true);
        setError(null);

        try {
            const res = await fetch(`/api/roles/${params.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Unable to delete role.");
            router.push("/next_panel/roles");
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
                                <Link href="/next_panel/roles" className="btn btn-sm btn-outline-secondary mb-3">
                                    <ArrowLeft size={16} className="me-2" /> Back to Roles
                                </Link>
                                <div className="d-flex align-items-center gap-2 mb-2">
                                    <ShieldCheck size={24} />
                                    <h1 className="h4 mb-0">{role?.role_name || "Role Details"}</h1>
                                </div>
                                <p className="text-muted mb-0">View and manage this role.</p>
                            </div>
                            <div className="d-flex gap-2">
                                {/* {userInfo.permissions.includes("roles.edit") && ( */}
                                    <Link href={`/next_panel/roles/${params.id}/edit`} className="btn btn-primary">
                                        <Edit size={16} className="me-2" /> Edit
                                    </Link>
                                {/* )}
                                {userInfo.permissions.includes("roles.delete") && ( */}
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
                            <div className="text-center py-5 text-muted">Loading role details...</div>
                        ) : error ? (
                            <div className="alert alert-danger">{error}</div>
                        ) : (
                            <div className="row gy-4">
                                <div className="col-12 d-flex align-items-center gap-2">
                                    <span className={`badge ${role.status === 1 ? "bg-success" : "bg-secondary"}`}>
                                        {role.status === 1 ? "Active" : "Inactive"}
                                    </span>
                                    <span className="text-muted small">ID: {role.id}</span>
                                </div>

                                <div className="col-md-6">
                                    <h2 className="h6 mb-1">Academy</h2>
                                    <p className="mb-0 text-muted">
                                        {role.academy_name ? `${role.academy_name} (${role.academy_code})` : "Global (all academies)"}
                                    </p>
                                </div>

                                <div className="col-md-6">
                                    <h2 className="h6 mb-1">Branch</h2>
                                    <p className="mb-0 text-muted">
                                        {role.branch_name ? `${role.branch_name} (${role.branch_code})` : "All branches"}
                                    </p>
                                </div>

                                <div className="col-12">
                                    <h2 className="h6 mb-1">Description</h2>
                                    <p className="mb-0 text-muted">{role.role_desc || "Not provided"}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
