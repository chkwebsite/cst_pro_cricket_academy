"use client";

import { Star, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useUser } from "../components/UserContext";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB (same limit as the API)

export default function GroundImageForm({ id = null, defaultGroundId = "" }) {
    const router = useRouter();
    const isEdit = Boolean(id);
    const fileInputRef = useRef(null);
    const {user} = useUser();
    const hasSessionUser = Boolean(user);
    const userRole = String(user?.user_type || "")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ");
    const isSuperAdmin = ["super admin", "superadmin", "admin"].includes(userRole);
    const isBranchAdmin = userRole === "branch admin";
    const userAcademyId = user?.academy_id;
    const userBranchId = user?.branch_id;

    const [grounds, setGrounds] = useState([]);
    const [groundsLoading, setGroundsLoading] = useState(true);
    const [groundId, setGroundId] = useState(defaultGroundId);
    const [isPrimary, setIsPrimary] = useState(false);

    // Add mode: many files. Edit mode: at most one replacement file.
    // Each entry: { file, preview }
    const [selected, setSelected] = useState([]);
    const [currentImage, setCurrentImage] = useState("");

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState("");

    // Grounds for the dropdown
    useEffect(() => {
        if (!hasSessionUser) return;

        const loadGrounds = async () => {
            try {
                const params = new URLSearchParams({ status: "1" });
                if (!isSuperAdmin) {
                    if (isBranchAdmin) {
                        params.set("branch_id", String(userBranchId || 0));
                    } else {
                        params.set("academy_id", String(userAcademyId || 0));
                    }
                }

                const res = await fetch(`/api/ground?${params.toString()}`, {
                    cache: "no-store",
                });
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Unable to load grounds");
                }
                setGrounds(json.data || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setGroundsLoading(false);
            }
        };
        loadGrounds();
    }, [hasSessionUser, isSuperAdmin, isBranchAdmin, userAcademyId, userBranchId]);

    // GET SINGLE IMAGE (edit mode)
    useEffect(() => {
        if (!id) return;

        const getImage = async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/ground-images/${id}`);
                const json = await res.json();

                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to fetch ground image");
                }

                setGroundId(String(json.data.ground_id));
                setIsPrimary(Number(json.data.is_primary) === 1);
                setCurrentImage(json.data.ground_image || "");
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        };
        getImage();
    }, [id]);

    // Free object URLs when the component unmounts
    const selectedRef = useRef(selected);
    useEffect(() => {
        selectedRef.current = selected;
    }, [selected]);

    useEffect(() => {
        return () => selectedRef.current.forEach((s) => URL.revokeObjectURL(s.preview));
    }, []);

    const handleFiles = (e) => {
        const picked = Array.from(e.target.files || []);
        e.target.value = ""; // allow picking the same file again
        if (picked.length === 0) return;

        for (const f of picked) {
            if (!ALLOWED_TYPES.includes(f.type)) {
                return setError(`${f.name}: only JPG, PNG and WEBP images are allowed`);
            }
            if (f.size > MAX_SIZE) {
                return setError(`${f.name} exceeds the 5MB limit`);
            }
        }
        setError("");

        const entries = picked.map((file) => ({ file, preview: URL.createObjectURL(file) }));

        if (isEdit) {
            selected.forEach((s) => URL.revokeObjectURL(s.preview));
            setSelected([entries[0]]);
            entries.slice(1).forEach((s) => URL.revokeObjectURL(s.preview));
        } else {
            setSelected((prev) => [...prev, ...entries]);
        }
    };

    const removeSelected = (index) => {
        setSelected((prev) => {
            URL.revokeObjectURL(prev[index].preview);
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!groundId || !grounds.some((ground) => Number(ground.id) === Number(groundId))) {
            return setError("Please select a ground available to your account");
        }
        if (!isEdit && selected.length === 0) {
            return setError("Please select at least one image");
        }

        try {
            setLoading(true);
            setError("");

            const fd = new FormData();
            fd.append("ground_id", groundId);

            if (isEdit) {
                fd.append("is_primary", isPrimary ? "1" : "0");
                if (selected[0]) fd.append("ground_image", selected[0].file);
            } else {
                selected.forEach((s) => fd.append("ground_images", s.file));
            }

            // Do NOT set Content-Type; the browser adds the multipart boundary.
            const res = await fetch(isEdit ? `/api/ground-images/${id}` : "/api/ground-images", {
                method: isEdit ? "PUT" : "POST",
                body: fd,
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || "Something went wrong");
            }

            alert(isEdit ? "Ground image updated successfully" : "Ground images uploaded successfully");

            router.push("/next_panel/ground-images");
            router.refresh();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching || groundsLoading) {
        return <div className="text-center py-5">Loading...</div>;
    }

    return (
        <div className="card shadow-sm">
            <div className="card-header">
                <h5 className="mb-0">{isEdit ? "Edit Ground Image" : "Upload Ground Images"}</h5>
            </div>

            <div className="card-body">
                {error && <div className="alert alert-danger">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label className="form-label">Ground</label>
                        <select
                            className="form-select"
                            value={groundId}
                            onChange={(e) => setGroundId(e.target.value)}
                            required
                        >
                            <option value="">Select ground</option>
                            {grounds.map((g) => (
                                <option key={g.id} value={g.id}>
                                    {g.ground_name} ({g.ground_code}){g.academy_name ? ` - ${g.academy_name}` : ""}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Current image (edit mode) */}
                    {isEdit && currentImage && (
                        <div className="mb-3">
                            <label className="form-label d-block">Current Image</label>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={currentImage}
                                alt="Current ground"
                                className="rounded border"
                                style={{ maxHeight: "200px", maxWidth: "100%", objectFit: "cover" }}
                            />
                        </div>
                    )}

                    <div className="mb-3">
                        <label className="form-label">
                            {isEdit ? "Replace Image (optional)" : "Images"}
                        </label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="form-control"
                            accept="image/jpeg,image/png,image/webp"
                            multiple={!isEdit}
                            onChange={handleFiles}
                        />
                        <div className="form-text">JPG, PNG or WEBP, up to 5MB each.</div>
                    </div>

                    {/* Previews */}
                    {selected.length > 0 && (
                        <div className="d-flex flex-wrap gap-3 mb-3">
                            {selected.map((s, i) => (
                                <div key={s.preview} className="position-relative">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={s.preview}
                                        alt={s.file.name}
                                        className="rounded border"
                                        style={{ width: "130px", height: "100px", objectFit: "cover" }}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-danger position-absolute top-0 end-0 p-0 d-flex align-items-center justify-content-center"
                                        style={{ width: "22px", height: "22px", transform: "translate(40%, -40%)" }}
                                        onClick={() => removeSelected(i)}
                                        aria-label="Remove image"
                                    >
                                        <X size={14} />
                                    </button>
                                    {!isEdit && i === 0 && (
                                        <span className="badge bg-warning text-dark position-absolute bottom-0 start-0 m-1">
                                            <Star size={11} className="me-1" />First
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {!isEdit && (
                        <div className="form-text mb-3">
                            If this ground has no primary image yet, the first image becomes primary.
                        </div>
                    )}

                    {/* Primary toggle (edit mode) */}
                    {isEdit && (
                        <div className="form-check mb-3">
                            <input
                                id="is_primary"
                                type="checkbox"
                                className="form-check-input"
                                checked={isPrimary}
                                onChange={(e) => setIsPrimary(e.target.checked)}
                            />
                            <label htmlFor="is_primary" className="form-check-label">
                                Set as primary image
                            </label>
                        </div>
                    )}

                    <div className="d-flex gap-2">
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? "Saving..." : isEdit ? "Update Image" : "Upload Images"}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => router.push("/next_panel/ground-images")}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
