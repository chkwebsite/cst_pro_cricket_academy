"use client";

import { ArrowLeft, Image as ImageIcon, Save, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "../components/UserContext";

const EMPTY_FORM = {
    academy_id: "",
    category_id: "",
    branch_id: "",
    album_title: "",
    slug: "",
    description: "",
    event_date: "",
    location: "",
    is_featured: 0,
    sort_order: 0,
    status: 1,
};

function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w-]+/g, "")
        .replace(/--+/g, "-")
        .replace(/^-+/, "")
        .replace(/-+$/, "");
}

export default function GalleryAlbumForm({ id = null, defaultCategoryId = "" }) {
    const router = useRouter();
    const isEdit = Boolean(id);
    const { user } = useUser();

    // Determine user role and academy
    const userRole = String(
        user?.user_type || user?.role || user?.role_name || user?.user_role || ""
    )
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ");

    const isSuperAdmin =
        ["super admin", "superadmin", "admin"].includes(userRole) && !user?.academy_id;
    const userAcademyId =
        user?.academy_id && Number(user?.academy_id) !== 0 ? String(user.academy_id) : "";
    const isAcademyAdmin = Boolean(userAcademyId) && !isSuperAdmin;

    const [formData, setFormData] = useState({
        ...EMPTY_FORM,
        category_id: defaultCategoryId,
        academy_id: isAcademyAdmin ? userAcademyId : "",
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState("");
    const [categories, setCategories] = useState([]);
    const [academies, setAcademies] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    // Visible academies based on user role
    const visibleAcademies = useMemo(() => {
        if (!isAcademyAdmin) {
            return academies;
        }
        const filtered = academies.filter(
            (ac) => String(ac.id) === String(userAcademyId)
        );
        if (filtered.length === 0 && userAcademyId) {
            return [
                {
                    id: userAcademyId,
                    academy_name: user?.academy_name || `Academy #${userAcademyId}`,
                },
            ];
        }
        return filtered;
    }, [academies, isAcademyAdmin, userAcademyId, user?.academy_name]);

    // Compute active academy id for filtering branches
    const activeAcademyId = isAcademyAdmin ? userAcademyId : formData.academy_id;

    // Filter branches based on selected or locked academy
    const filteredBranches = useMemo(() => {
        if (!activeAcademyId) return branches;
        return branches.filter((b) => String(b.academy_id) === String(activeAcademyId));
    }, [branches, activeAcademyId]);

    // Load reference options: categories, academies, branches
    useEffect(() => {
        const loadOptions = async () => {
            try {
                const [catRes, acadRes, branchRes] = await Promise.all([
                    fetch("/api/gallery-categories?status=1"),
                    fetch("/api/academies"),
                    fetch("/api/branch?status=1"),
                ]);
                const [catJson, acadJson, branchJson] = await Promise.all([
                    catRes.json(),
                    acadRes.json(),
                    branchRes.json(),
                ]);

                if (catRes.ok && catJson.success) {
                    setCategories(catJson.data || []);
                }
                if (acadRes.ok && acadJson.success) {
                    setAcademies(acadJson.data || []);
                }
                if (branchRes.ok && branchJson.success) {
                    setBranches(branchJson.data || []);
                }
            } catch {
                // Ignore load error
            }
        };
        loadOptions();
    }, []);

    // Load album if edit mode
    useEffect(() => {
        if (!id) return;
        const fetchAlbum = async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/gallery-albums/${id}`);
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to fetch gallery album");
                }
                const a = json.data;
                setFormData({
                    academy_id: a.academy_id ? String(a.academy_id) : "",
                    category_id: a.category_id ? String(a.category_id) : "",
                    branch_id: a.branch_id ? String(a.branch_id) : "",
                    album_title: a.album_title || "",
                    slug: a.slug || "",
                    description: a.description || "",
                    event_date: a.event_date ? a.event_date.split("T")[0] : "",
                    location: a.location || "",
                    is_featured: a.is_featured ?? 0,
                    sort_order: a.sort_order ?? 0,
                    status: a.status ?? 1,
                });
                if (a.cover_image) {
                    setImagePreview(a.cover_image);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        };
        fetchAlbum();
    }, [id]);

    const handleTitleChange = (e) => {
        const val = e.target.value;
        setFormData((prev) => ({
            ...prev,
            album_title: val,
            slug: !isEdit && !prev.slug_manually_edited ? slugify(val) : prev.slug,
        }));
    };

    const handleAutoSlug = () => {
        if (formData.album_title) {
            setFormData((prev) => ({
                ...prev,
                slug: slugify(prev.album_title),
            }));
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");

        if (!formData.album_title.trim()) {
            setError("Album title is required.");
            return;
        }
        if (!formData.slug.trim()) {
            setError("Album slug is required.");
            return;
        }

        try {
            setLoading(true);
            const fd = new FormData();
            const targetAcademyId = isAcademyAdmin
                ? userAcademyId
                : (formData.academy_id || null);
            if (targetAcademyId) fd.append("academy_id", targetAcademyId);
            if (formData.category_id) fd.append("category_id", formData.category_id);
            if (formData.branch_id) fd.append("branch_id", formData.branch_id);
            fd.append("album_title", formData.album_title.trim());
            fd.append("slug", formData.slug.trim());
            if (formData.description) fd.append("description", formData.description.trim());
            if (formData.event_date) fd.append("event_date", formData.event_date);
            if (formData.location) fd.append("location", formData.location.trim());
            fd.append("is_featured", String(formData.is_featured ? 1 : 0));
            fd.append("sort_order", String(formData.sort_order ?? 0));
            fd.append("status", String(formData.status ?? 1));
            if (user?.id) fd.append("created_by", String(user.id));

            if (imageFile) {
                fd.append("cover_image", imageFile);
            }

            const url = isEdit ? `/api/gallery-albums/${id}` : "/api/gallery-albums";
            const method = isEdit ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                body: fd,
            });
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to save gallery album.");
            }

            setSuccessMsg(isEdit ? "Album updated successfully!" : "Album created successfully!");
            setTimeout(() => {
                router.push("/next_panel/gallery-albums");
            }, 800);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="container-fluid py-5 text-center text-muted">
                <div className="spinner-border text-primary me-2" role="status" />
                Loading album details...
            </div>
        );
    }

    return (
        <div className="container-fluid">
            <div className="row g-4 justify-content-center">
                <div className="col-12 col-xl-10">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <h2 className="h4 mb-1">
                                    {isEdit ? "Edit Gallery Album" : "New Gallery Album"}
                                </h2>
                                <p className="text-muted mb-0 small">
                                    {isEdit
                                        ? "Update album metadata, cover picture, and classification."
                                        : "Create an album for matches, practice sessions, or events."}
                                </p>
                            </div>
                            <Link
                                href="/next_panel/gallery-albums"
                                className="btn btn-outline-secondary btn-sm"
                            >
                                <ArrowLeft size={16} className="me-1" /> Back to Albums
                            </Link>
                        </div>
                    </div>

                    {error && (
                        <div className="alert alert-danger alert-dismissible fade show" role="alert">
                            {error}
                        </div>
                    )}

                    {successMsg && (
                        <div className="alert alert-success alert-dismissible fade show" role="alert">
                            {successMsg}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="card border-0 shadow-sm rounded-4 p-4 mb-4">
                            <h5 className="mb-3 text-secondary">Album Details</h5>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">
                                        Album Title <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. Under-16 State Championship Final"
                                        value={formData.album_title}
                                        onChange={handleTitleChange}
                                        required
                                    />
                                </div>

                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">
                                        Slug <span className="text-danger">*</span>
                                    </label>
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. u16-championship-final"
                                            value={formData.slug}
                                            onChange={(e) =>
                                                setFormData({ ...formData, slug: e.target.value })
                                            }
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary"
                                            onClick={handleAutoSlug}
                                            title="Generate slug from title"
                                        >
                                            <Sparkles size={16} className="me-1" /> Auto
                                        </button>
                                    </div>
                                </div>

                                <div className="col-md-4">
                                    <label className="form-label fw-semibold">Category</label>
                                    <select
                                        className="form-select"
                                        value={formData.category_id}
                                        onChange={(e) =>
                                            setFormData({ ...formData, category_id: e.target.value })
                                        }
                                    >
                                        <option value="">Select Category</option>
                                        {categories.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.category_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="col-md-4">
                                    <label className="form-label fw-semibold">
                                        Academy {isAcademyAdmin ? <span className="text-danger">*</span> : "(Optional)"}
                                    </label>
                                    {isAcademyAdmin ? (
                                        <select
                                            className="form-select bg-light"
                                            value={userAcademyId}
                                            disabled
                                        >
                                            {visibleAcademies.map((ac) => (
                                                <option key={ac.id} value={ac.id}>
                                                    {ac.academy_name || ac.name || `Academy #${ac.id}`}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <select
                                            className="form-select"
                                            value={formData.academy_id}
                                            onChange={(e) =>
                                                setFormData({ ...formData, academy_id: e.target.value })
                                            }
                                        >
                                            <option value="">All Academies (Global)</option>
                                            {visibleAcademies.map((ac) => (
                                                <option key={ac.id} value={ac.id}>
                                                    {ac.academy_name || ac.name} {ac.academy_code ? `(${ac.academy_code})` : ""}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <div className="col-md-4">
                                    <label className="form-label fw-semibold">Branch (Optional)</label>
                                    <select
                                        className="form-select"
                                        value={formData.branch_id}
                                        onChange={(e) =>
                                            setFormData({ ...formData, branch_id: e.target.value })
                                        }
                                    >
                                        <option value="">Select Branch</option>
                                        {filteredBranches.map((b) => (
                                            <option key={b.id} value={b.id}>
                                                {b.branch_name} {b.city ? `(${b.city})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="col-md-4">
                                    <label className="form-label fw-semibold">Event Date</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={formData.event_date}
                                        onChange={(e) =>
                                            setFormData({ ...formData, event_date: e.target.value })
                                        }
                                    />
                                </div>

                                <div className="col-md-4">
                                    <label className="form-label fw-semibold">Location / Ground</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. Main Turf Stadium, Branch A"
                                        value={formData.location}
                                        onChange={(e) =>
                                            setFormData({ ...formData, location: e.target.value })
                                        }
                                    />
                                </div>

                                <div className="col-md-2">
                                    <label className="form-label fw-semibold">Sort Order</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        value={formData.sort_order}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                sort_order: parseInt(e.target.value, 10) || 0,
                                            })
                                        }
                                    />
                                </div>

                                <div className="col-md-2">
                                    <label className="form-label fw-semibold">Status</label>
                                    <select
                                        className="form-select"
                                        value={formData.status}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                status: parseInt(e.target.value, 10),
                                            })
                                        }
                                    >
                                        <option value={1}>Active</option>
                                        <option value={0}>Inactive</option>
                                    </select>
                                </div>

                                <div className="col-12">
                                    <div className="form-check form-switch mt-2">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="is_featured"
                                            checked={Number(formData.is_featured) === 1}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    is_featured: e.target.checked ? 1 : 0,
                                                })
                                            }
                                        />
                                        <label className="form-check-label fw-semibold" htmlFor="is_featured">
                                            Feature this album on home & highlights
                                        </label>
                                    </div>
                                </div>

                                <div className="col-12">
                                    <label className="form-label fw-semibold">Description</label>
                                    <textarea
                                        className="form-control"
                                        rows={3}
                                        placeholder="Details about the event, highlights, teams involved..."
                                        value={formData.description}
                                        onChange={(e) =>
                                            setFormData({ ...formData, description: e.target.value })
                                        }
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="card border-0 shadow-sm rounded-4 p-4 mb-4">
                            <h5 className="mb-3 text-secondary">Cover Image</h5>
                            <div className="row g-3 align-items-center">
                                <div className="col-md-4">
                                    {imagePreview ? (
                                        <div className="position-relative border rounded-3 p-2 text-center bg-light">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={imagePreview}
                                                alt="Cover preview"
                                                className="img-fluid rounded"
                                                style={{ maxHeight: "190px", objectFit: "cover" }}
                                            />
                                        </div>
                                    ) : (
                                        <div
                                            className="border border-dashed rounded-3 p-4 text-center text-muted bg-light d-flex flex-column align-items-center justify-content-center"
                                            style={{ minHeight: "150px" }}
                                        >
                                            <ImageIcon size={36} className="mb-2 text-secondary opacity-50" />
                                            <small>No cover image uploaded</small>
                                        </div>
                                    )}
                                </div>

                                <div className="col-md-8">
                                    <label className="form-label fw-semibold">
                                        Upload Cover Photo (Max 5MB)
                                    </label>
                                    <input
                                        type="file"
                                        className="form-control"
                                        accept="image/jpeg,image/png,image/webp,image/jpg"
                                        onChange={handleImageChange}
                                    />
                                    <small className="text-muted d-block mt-1">
                                        High resolution landscape photo recommended (16:9 or 4:3).
                                    </small>
                                </div>
                            </div>
                        </div>

                        <div className="d-flex justify-content-end gap-2 mb-5">
                            <Link
                                href="/next_panel/gallery-albums"
                                className="btn btn-outline-secondary px-4"
                            >
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                className="btn btn-primary px-4 d-flex align-items-center gap-2"
                                disabled={loading}
                            >
                                <Save size={18} />
                                {loading ? "Saving..." : isEdit ? "Update Album" : "Save Album"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
