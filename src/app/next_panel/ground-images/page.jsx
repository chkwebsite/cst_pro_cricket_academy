"use client";

import { Edit, Images, Plus, SearchSlash, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "../components/UserContext";

export default function GroundImagesPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [images, setImages] = useState([]);
    const [grounds, setGrounds] = useState([]);
    const [groundId, setGroundId] = useState("");
    const [busyId, setBusyId] = useState(null);
    const {user} = useUser();
    const hasSessionUser = Boolean(user);
    const userAcademyId = user?.academy_id;
    const hasAssignedAcademy =
        userAcademyId !== null &&
        userAcademyId !== undefined &&
        userAcademyId !== "" &&
        Number(userAcademyId) !== 0;
    const effectiveAcademyId = hasAssignedAcademy ? String(userAcademyId) : "";

    // Grounds list for the filter dropdown + name lookup
    useEffect(() => {
        if (!hasSessionUser) return;

        const loadGrounds = async () => {
            try {
                const params = new URLSearchParams({ status: "1" });
                if (effectiveAcademyId) params.set("academy_id", effectiveAcademyId);
                const res = await fetch(`/api/ground?${params.toString()}`);
                const json = await res.json();
                if (res.ok && json.success) setGrounds(json.data || []);
            } catch {
                /* filter just stays empty */
            }
        };
        loadGrounds();
    }, [hasSessionUser, effectiveAcademyId]);

    const loadImages = useCallback(async (signal) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (groundId) params.set("ground_id", groundId);
            if (effectiveAcademyId) params.set("academy_id", effectiveAcademyId);
            const query = params.toString();
            const res = await fetch(`/api/ground-images${query ? `?${query}` : ""}`, { signal });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to load ground images.");
            }
            setImages(json.data || []);
        } catch (err) {
            if (err.name !== "AbortError") setError(err.message);
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [groundId, effectiveAcademyId]);

    useEffect(() => {
        if (!hasSessionUser) return;

        const controller = new AbortController();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadImages(controller.signal);
        return () => controller.abort();
    }, [hasSessionUser, loadImages]);

    const groundLabel = (id) => {
        const g = grounds.find((x) => Number(x.id) === Number(id));
        return g ? g.ground_name : `Ground #${id}`;
    };

    const handleSetPrimary = async (id) => {
        setBusyId(id);
        setError(null);
        try {
            const fd = new FormData();
            fd.append("is_primary", "1");
            const res = await fetch(`/api/ground-images/${id}`, { method: "PUT", body: fd });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to set primary image");
            }
            await loadImages();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Delete this image?")) return;
        setBusyId(id);
        setError(null);
        try {
            const res = await fetch(`/api/ground-images/${id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to delete image");
            }
            // Reload: the API may have promoted another image to primary
            await loadImages();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const addHref = groundId
        ? `/next_panel/ground-images/new?ground_id=${groundId}`
        : "/next_panel/ground-images/new";

    return (
        <div className="container-fluid">
            <div className="row g-3">
                {/* Header */}
                <div className="col-sm-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center gap-3">
                            <div>
                                <h3 className="mb-0"><Images /> Ground Images</h3>
                                <p className="text-muted mb-0">Upload and manage photos for each ground.</p>
                            </div>
                            <Link href={addHref} className="btn btn-primary px-4">
                                <Plus size={18} /> Add Images
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="col-sm-12">
                    <div className="d-flex flex-wrap align-items-center gap-3">
                        <select
                            className="form-select"
                            value={groundId}
                            onChange={(e) => setGroundId(e.target.value)}
                            style={{ maxWidth: "280px" }}
                        >
                            <option value="">All Grounds</option>
                            {grounds.map((g) => (
                                <option key={g.id} value={g.id}>
                                    {g.ground_name} ({g.ground_code}){g.academy_name ? ` - ${g.academy_name}` : ""}
                                </option>
                            ))}
                        </select>

                        <button
                            type="button"
                            className="btn btn-outline-danger"
                            onClick={() => setGroundId("")}
                            aria-label="Clear filters"
                        >
                            <SearchSlash />
                        </button>

                        {!loading && (
                            <span className="text-muted small">{images.length} image(s)</span>
                        )}
                    </div>
                </div>

                {/* Gallery */}
                <div className="col-sm-12">
                    {error && <div className="alert alert-danger">{error}</div>}

                    {loading ? (
                        <div className="text-center py-5 text-muted">Loading images...</div>
                    ) : images.length === 0 ? (
                        <div className="text-center py-5 text-muted">No ground images found.</div>
                    ) : (
                        <div className="row g-3">
                            {images.map((img) => {
                                const isPrimary = Number(img.is_primary) === 1;
                                return (
                                    <div key={img.id} className="col-12 col-sm-6 col-lg-4 col-xl-3">
                                        <div className="card h-100 shadow-sm">
                                            <div className="position-relative">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={img.ground_image}
                                                    alt={groundLabel(img.ground_id)}
                                                    className="card-img-top"
                                                    style={{ height: "190px", objectFit: "cover" }}
                                                />
                                                {isPrimary && (
                                                    <span className="badge bg-warning text-dark position-absolute top-0 start-0 m-2">
                                                        <Star size={12} className="me-1" />Primary
                                                    </span>
                                                )}
                                            </div>

                                            <div className="card-body py-2">
                                                <div className="fw-semibold text-truncate">
                                                    {groundLabel(img.ground_id)}
                                                </div>
                                                <small className="text-muted">
                                                    {img.created_at
                                                        ? new Date(img.created_at).toLocaleDateString()
                                                        : ""}
                                                </small>
                                            </div>

                                            <div className="card-footer bg-white d-flex gap-2">
                                                {!isPrimary && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-warning"
                                                        onClick={() => handleSetPrimary(img.id)}
                                                        disabled={busyId === img.id}
                                                        title="Set as primary"
                                                    >
                                                        <Star size={16} />
                                                    </button>
                                                )}
                                                <Link
                                                    href={`/next_panel/ground-images/${img.id}/edit`}
                                                    className="btn btn-sm btn-outline-secondary"
                                                    aria-label="Edit image"
                                                >
                                                    <Edit size={16} />
                                                </Link>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-danger ms-auto"
                                                    onClick={() => handleDelete(img.id)}
                                                    disabled={busyId === img.id}
                                                    aria-label="Delete image"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
