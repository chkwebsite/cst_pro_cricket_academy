"use client";

import { ArrowLeft, Image as ImageIcon, Save, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "../components/UserContext";

const EMPTY_FORM = {
    academy_id: "",
    category_name: "",
    slug: "",
    description: "",
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

export default function GalleryCategoryForm({ id = null }) {
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

    const [formData, setFormData] = useState(EMPTY_FORM);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState("");
    const [academies, setAcademies] = useState([]);
    const [academiesLoading, setAcademiesLoading] = useState(true);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    // Load Academies
    useEffect(() => {
        const loadAcademies = async () => {
            try {
                setAcademiesLoading(true);
                const res = await fetch("/api/academies");
                const json = await res.json();
                if (res.ok && json.success) {
                    setAcademies(Array.isArray(json.data) ? json.data : []);
                }
            } catch {
                // Ignore failure
            } finally {
                setAcademiesLoading(false);
            }
        };
        loadAcademies();
    }, []);

    // Visible academies based on user role:
    // If Academy Admin: only show their assigned academy.
    // If Super Admin: show all academies.
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

    // Load category if edit mode
    useEffect(() => {
        if (!id) return;
        const fetchCategory = async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/gallery-categories/${id}`);
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to fetch gallery category");
                }
                const cat = json.data;
                setFormData({
                    academy_id: cat.academy_id ? String(cat.academy_id) : "",
                    category_name: cat.category_name || "",
                    slug: cat.slug || "",
                    description: cat.description || "",
                    sort_order: cat.sort_order ?? 0,
                    status: cat.status ?? 1,
                });
                if (cat.featured_image) {
                    setImagePreview(cat.featured_image);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        };
        fetchCategory();
    }, [id]);

    const handleNameChange = (e) => {
        const val = e.target.value;
        setFormData((prev) => ({
            ...prev,
            category_name: val,
            slug: !isEdit && !prev.slug_manually_edited ? slugify(val) : prev.slug,
        }));
    };

    const handleAutoSlug = () => {
        if (formData.category_name) {
            setFormData((prev) => ({
                ...prev,
                slug: slugify(prev.category_name),
            }));
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                setError(`"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(2)}MB. Maximum allowed image size is 2MB.`);
                e.target.value = "";
                setImageFile(null);
                setImagePreview(null);
                return;
            }
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");

        if (!formData.category_name.trim()) {
            setError("Category name is required.");
            return;
        }
        if (!formData.slug.trim()) {
            setError("Slug is required.");
            return;
        }

        try {
            setLoading(true);
            const fd = new FormData();
            const targetAcademyId = isAcademyAdmin
                ? userAcademyId
                : (formData.academy_id || null);
            if (targetAcademyId) fd.append("academy_id", targetAcademyId);
            fd.append("category_name", formData.category_name.trim());
            fd.append("slug", formData.slug.trim());
            if (formData.description) fd.append("description", formData.description.trim());
            fd.append("sort_order", String(formData.sort_order ?? 0));
            fd.append("status", String(formData.status ?? 1));
            if (user?.id) fd.append("created_by", String(user.id));

            if (imageFile) {
                fd.append("featured_image", imageFile);
            }

            const url = isEdit ? `/api/gallery-categories/${id}` : "/api/gallery-categories";
            const method = isEdit ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                body: fd,
            });
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to save gallery category.");
            }

            setSuccessMsg(isEdit ? "Category updated successfully!" : "Category created successfully!");
            setTimeout(() => {
                router.push("/next_panel/gallery-categories");
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
                Loading category details...
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
                                    {isEdit ? "Edit Gallery Category" : "New Gallery Category"}
                                </h2>
                                <p className="text-muted mb-0 small">
                                    {isEdit
                                        ? "Update category information, image, and status."
                                        : "Create a new category for photos and videos."}
                                </p>
                            </div>
                            <Link
                                href="/next_panel/gallery-categories"
                                className="btn btn-outline-secondary btn-sm"
                            >
                                <ArrowLeft size={16} className="me-1" /> Back to Categories
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
                            <h5 className="mb-3 text-secondary">Basic Information</h5>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">
                                        Category Name <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. Tournaments, Practice Matches, Annual Camp"
                                        value={formData.category_name}
                                        onChange={handleNameChange}
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
                                            placeholder="e.g. tournaments"
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
                                            title="Generate slug from name"
                                        >
                                            <Sparkles size={16} className="me-1" /> Auto
                                        </button>
                                    </div>
                                    <small className="text-muted">Unique URL identifier</small>
                                </div>

                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">
                                        Academy {isAcademyAdmin ? <span className="text-danger">*</span> : "(Optional)"}
                                    </label>
                                    {isAcademyAdmin ? (
                                        <div>
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
                                            <small className="text-muted d-block mt-1">
                                                Locked to your assigned academy.
                                            </small>
                                        </div>
                                    ) : (
                                        <div>
                                            <select
                                                className="form-select"
                                                value={formData.academy_id}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, academy_id: e.target.value })
                                                }
                                            >
                                                <option value="">All Academies (Global)</option>
                                                {academiesLoading && visibleAcademies.length === 0 && (
                                                    <option disabled value="">
                                                        Loading academies...
                                                    </option>
                                                )}
                                                {visibleAcademies.map((ac) => (
                                                    <option key={ac.id} value={ac.id}>
                                                        {ac.academy_name || ac.name || `Academy #${ac.id}`}
                                                        {ac.academy_code ? ` (${ac.academy_code})` : ""}
                                                    </option>
                                                ))}
                                            </select>
                                            <small className="text-muted d-block mt-1">
                                                Super Admin: select an academy or leave Global.
                                            </small>
                                        </div>
                                    )}
                                </div>

                                <div className="col-md-3">
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
                                    <small className="text-muted">Lower numbers appear first</small>
                                </div>

                                <div className="col-md-3">
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
                                    <label className="form-label fw-semibold">Description</label>
                                    <textarea
                                        className="form-control"
                                        rows={3}
                                        placeholder="Brief description about this category..."
                                        value={formData.description}
                                        onChange={(e) =>
                                            setFormData({ ...formData, description: e.target.value })
                                        }
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="card border-0 shadow-sm rounded-4 p-4 mb-4">
                            <h5 className="mb-3 text-secondary">Featured Image</h5>
                            <div className="row g-3 align-items-center">
                                <div className="col-md-4">
                                    {imagePreview ? (
                                        <div className="position-relative border rounded-3 p-2 text-center bg-light">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={imagePreview}
                                                alt="Preview"
                                                className="img-fluid rounded"
                                                style={{ maxHeight: "180px", objectFit: "cover" }}
                                            />
                                        </div>
                                    ) : (
                                        <div
                                            className="border border-dashed rounded-3 p-4 text-center text-muted bg-light d-flex flex-column align-items-center justify-content-center"
                                            style={{ minHeight: "150px" }}
                                        >
                                            <ImageIcon size={36} className="mb-2 text-secondary opacity-50" />
                                            <small>No image selected</small>
                                        </div>
                                    )}
                                </div>

                                <div className="col-md-8">
                                    <label className="form-label fw-semibold">
                                        Upload Image (Max 2MB)
                                    </label>
                                    <input
                                        type="file"
                                        className="form-control"
                                        accept="image/jpeg,image/png,image/webp,image/jpg"
                                        onChange={handleImageChange}
                                    />
                                    <small className="text-muted d-block mt-1">
                                        Allowed types: JPG, PNG, WEBP.
                                    </small>
                                </div>
                            </div>
                        </div>

                        <div className="d-flex justify-content-end gap-2 mb-5">
                            <Link
                                href="/next_panel/gallery-categories"
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
                                {loading ? "Saving..." : isEdit ? "Update Category" : "Save Category"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
