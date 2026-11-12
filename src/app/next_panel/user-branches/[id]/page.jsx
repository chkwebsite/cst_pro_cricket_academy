"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";

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

export default function UserBranchDetailPage() {
    const params = useParams();
    const router = useRouter();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // =====================================================
    // LOAD USER BRANCH
    // =====================================================

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(
                    `/api/user-branches/${params.id}`
                );

                const json = await readJson(res);

                if (!res.ok) {
                    throw new Error(
                        json.message ||
                        "Unable to load user branch."
                    );
                }

                setData(json.data);
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [params.id]);

    // =====================================================
    // DELETE
    // =====================================================

    const del = async () => {
        if (!confirm("Delete this user branch?")) {
            return;
        }

        setDeleting(true);

        try {
            const res = await fetch(
                `/api/user-branches/${params.id}`,
                {
                    method: "DELETE",
                }
            );

            const json = await readJson(res);

            if (!res.ok) {
                throw new Error(
                    json.message ||
                    "Unable to delete."
                );
            }

            router.push("/next_panel/user-branches");
        } catch (e) {
            setError(e.message);
        } finally {
            setDeleting(false);
        }
    };

    const fields = [
        ["User ID", "user_id"],
        ["First Name", "first_name"],
        ["Last Name", "last_name"],
        ["Email", "email"],
        ["Phone", "phone"],
        ["Branch ID", "branch_id"],
        ["Branch Name", "branch_name"],
    ];

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
                                User Branch #{params.id}
                            </h1>

                            <p className="text-muted mb-0">
                                View branch assignment details.
                            </p>
                        </div>

                        <div className="d-flex gap-2">
                            <Link
                                href={`/next_panel/user-branches/${params.id}/edit`}
                                className="btn btn-primary"
                            >
                                <Edit
                                    size={16}
                                    className="me-2"
                                />
                                Edit
                            </Link>

                            <button
                                className="btn btn-outline-danger"
                                onClick={del}
                                disabled={deleting}
                            >
                                <Trash2
                                    size={16}
                                    className="me-2"
                                />
                                {deleting
                                    ? "Deleting..."
                                    : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* =================================================
                    DETAILS
                ================================================= */}

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">

                        {loading ? (
                            <div className="text-center py-5 text-muted">
                                Loading...
                            </div>
                        ) : error ? (
                            <div className="alert alert-danger">
                                {error}
                            </div>
                        ) : (
                            <div className="row gy-4">

                                {fields.map(([label, key]) => (
                                    <div
                                        className="col-md-6"
                                        key={key}
                                    >
                                        <h2 className="h6 mb-1">
                                            {label}
                                        </h2>

                                        <p className="mb-0 text-muted">
                                            {data[key] ??
                                                "Not provided"}
                                        </p>
                                    </div>
                                ))}

                                <div className="col-md-6">
                                    <h2 className="h6 mb-1">
                                        Primary Branch
                                    </h2>

                                    <span
                                        className={`badge ${data.is_primary === 0
                                            ? "bg-primary text-white"
                                            : "bg-secondary"
                                            }`}
                                    >
                                        {data.is_primary === 0
                                            ? "Yes"
                                            : "No"}
                                    </span>
                                </div>

                                <div className="col-md-6">
                                    <h2 className="h6 mb-1">
                                        Status
                                    </h2>

                                    <span
                                        className={`badge ${data.status === 1
                                            ? "bg-success"
                                            : "bg-secondary"
                                            }`}
                                    >
                                        {data.status === 1
                                            ? "Active"
                                            : "Inactive"}
                                    </span>
                                </div>

                            </div>
                        )}

                    </div>
                </div>

            </div>
        </div>
    );
}
