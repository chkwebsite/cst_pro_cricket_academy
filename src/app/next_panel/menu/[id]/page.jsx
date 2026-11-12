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

export default function MenuDetailPage() {
    const params = useParams();
    const router = useRouter();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // =====================================================
    // LOAD MENU
    // =====================================================

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(
                    `/api/menu/${params.id}`
                );

                const json = await readJson(res);

                if (!res.ok) {
                    throw new Error(
                        json.message ||
                        "Unable to load menu."
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
        if (!confirm("Delete this menu?")) {
            return;
        }

        setDeleting(true);

        try {
            const res = await fetch(
                `/api/menu/${params.id}`,
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

            router.push("/next_panel/menu");
        } catch (e) {
            setError(e.message);
        } finally {
            setDeleting(false);
        }
    };

    const fields = [
        ["Menu Key", "menu_key"],
        ["Menu Name", "menu_name"],
        ["Menu Title", "menu_title"],
        ["Menu Icon", "menu_icon"],
        ["Menu URL", "menu_url"],
        ["Menu Order", "menu_order"],
        ["Parent Menu", "parent_menu_title"],
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
                                Menu #{params.id}
                            </h1>

                            <p className="text-muted mb-0">
                                View menu item details.
                            </p>
                        </div>

                        <div className="d-flex gap-2">
                            <Link
                                href={`/next_panel/menu/${params.id}/edit`}
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
                                        Menu Type
                                    </h2>

                                    <span className="badge bg-info-subtle text-info-emphasis text-capitalize">
                                        {data.menu_type}
                                    </span>
                                </div>

                                <div className="col-md-6">
                                    <h2 className="h6 mb-1">
                                        Show In Sidebar
                                    </h2>

                                    <span
                                        className={`badge ${data.is_sidebar
                                            ? "bg-primary-subtle text-primary-emphasis"
                                            : "bg-secondary"
                                            }`}
                                    >
                                        {data.is_sidebar
                                            ? "Yes"
                                            : "No"}
                                    </span>
                                </div>

                                <div className="col-md-6">
                                    <h2 className="h6 mb-1">
                                        Active
                                    </h2>

                                    <span
                                        className={`badge ${data.is_active
                                            ? "bg-success"
                                            : "bg-secondary"
                                            }`}
                                    >
                                        {data.is_active
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
