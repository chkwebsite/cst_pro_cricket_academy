"use client";

import {
    CheckCircle2,
    Edit,
    FolderTree,
    Image as ImageIcon,
    Plus,
    RefreshCw,
    Search,
    SearchSlash,
    Trash2,
    Upload,
    X,
    XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import Pagination from "../components/Pagination";

export default function ProductCategoriesPage() {
    const [categories, setCategories] = useState([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    // Filters
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [reloadCount, setReloadCount] = useState(0);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formData, setFormData] = useState({
        category_name: "",
        slug: "",
        description: "",
        sort_order: 0,
        status: 1,
        image: null,
    });
    const [imagePreview, setImagePreview] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");

    // Load categories
    useEffect(() => {
        let cancelled = false;

        async function loadData() {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (search.trim()) params.set("search", search.trim());
                if (statusFilter !== "") params.set("status", statusFilter);

                const res = await fetch(`/api/product-categories?${params.toString()}`);
                const json = await res.json();

                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to load categories.");
                }

                if (!cancelled) setCategories(json.data || []);
            } catch (err) {
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadData();
        return () => { cancelled = true; };
    }, [search, statusFilter, reloadCount]);

    useEffect(() => {
        setPage(1);
    }, [search, statusFilter]);

    const totalPages = Math.ceil(categories.length / PAGE_SIZE) || 1;
    const pagedCategories = categories.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // Slug generator helper
    const handleNameChange = (name) => {
        setFormData((prev) => {
            const autoSlug = !editingCategory
                ? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")
                : prev.slug;
            return { ...prev, category_name: name, slug: autoSlug };
        });
    };

    // Open Add Modal
    const handleOpenCreate = () => {
        setEditingCategory(null);
        setFormData({
            category_name: "",
            slug: "",
            description: "",
            sort_order: categories.length + 1,
            status: 1,
            image: null,
        });
        setImagePreview(null);
        setFormError("");
        setModalOpen(true);
    };

    // Open Edit Modal
    const handleOpenEdit = (item) => {
        setEditingCategory(item);
        setFormData({
            category_name: item.category_name || "",
            slug: item.slug || "",
            description: item.description || "",
            sort_order: item.sort_order ?? 0,
            status: item.status ?? 1,
            image: null,
        });
        setImagePreview(item.category_image || null);
        setFormError("");
        setModalOpen(true);
    };

    // Quick Status Toggle
    const handleToggleStatus = async (item) => {
        const newStatus = Number(item.status) === 1 ? 0 : 1;
        try {
            const body = new FormData();
            body.append("category_name", item.category_name);
            body.append("slug", item.slug);
            body.append("status", String(newStatus));

            const res = await fetch(`/api/product-categories/${item.id}`, {
                method: "PUT",
                body,
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to toggle status");

            setNotice(`Category "${item.category_name}" is now ${newStatus === 1 ? "Active" : "Inactive"}.`);
            setTimeout(() => setNotice(null), 3500);
            setReloadCount((c) => c + 1);
        } catch (err) {
            alert(err.message);
        }
    };

    // Delete Category
    const handleDelete = async (item) => {
        if (!confirm(`Are you sure you want to delete category "${item.category_name}"?`)) return;

        try {
            const res = await fetch(`/api/product-categories/${item.id}`, {
                method: "DELETE",
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete category");

            setNotice(`Category "${item.category_name}" deleted successfully.`);
            setTimeout(() => setNotice(null), 3500);
            setCategories((prev) => prev.filter((c) => c.id !== item.id));
        } catch (err) {
            alert(err.message);
        }
    };

    // Save Form (Create / Edit)
    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setFormError("");

        try {
            const body = new FormData();
            body.append("category_name", formData.category_name.trim());
            body.append("slug", formData.slug.trim().toLowerCase());
            if (formData.description) body.append("description", formData.description.trim());
            body.append("sort_order", String(formData.sort_order || 0));
            body.append("status", String(formData.status));
            if (formData.image) {
                body.append("category_image", formData.image);
            }

            const isEdit = Boolean(editingCategory);
            const url = isEdit ? `/api/product-categories/${editingCategory.id}` : "/api/product-categories";
            const method = isEdit ? "PUT" : "POST";

            const res = await fetch(url, { method, body });
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to save category.");
            }

            setNotice(isEdit ? "Category updated successfully." : "Category created successfully.");
            setTimeout(() => setNotice(null), 3500);
            setModalOpen(false);
            setReloadCount((c) => c + 1);
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="container-fluid py-2">
            {/* Header Banner */}
            <div className="bg-white rounded-4 shadow-sm p-4 mb-4 border">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div className="d-flex align-items-center gap-2">
                        <div
                            className="rounded-3 d-inline-flex align-items-center justify-content-center p-2"
                            style={{ background: "#e0f2f1", color: "#004d40" }}
                        >
                            <FolderTree size={24} />
                        </div>
                        <div>
                            <h3 className="mb-0 fw-bold text-dark">Product Categories</h3>
                            <p className="text-muted small mb-0">
                                Organize store products into categories (Cricket Bats, Balls, Protective Gear, Apparel, etc.)
                            </p>
                        </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <button
                            type="button"
                            className="btn btn-outline-secondary d-flex align-items-center gap-1"
                            onClick={() => setReloadCount((c) => c + 1)}
                        >
                            <RefreshCw size={16} />
                            <span>Refresh</span>
                        </button>
                        <button
                            type="button"
                            className="btn btn-success d-flex align-items-center gap-1 px-3"
                            onClick={handleOpenCreate}
                        >
                            <Plus size={18} />
                            <span>Add Category</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Notification Alert */}
            {notice && (
                <div className="alert alert-success alert-dismissible fade show d-flex align-items-center gap-2" role="alert">
                    <CheckCircle2 size={18} />
                    <span>{notice}</span>
                    <button type="button" className="btn-close" onClick={() => setNotice(null)} aria-label="Close" />
                </div>
            )}

            {/* Error Alert */}
            {error && (
                <div className="alert alert-danger d-flex align-items-center gap-2" role="alert">
                    <XCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {/* Filters Bar */}
            <div className="bg-white rounded-4 shadow-sm p-3 mb-3 border">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                    <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
                        <div className="input-group" style={{ maxWidth: "340px" }}>
                            <span className="input-group-text bg-light border-end-0">
                                <Search size={16} className="text-muted" />
                            </span>
                            <input
                                type="text"
                                className="form-control border-start-0"
                                placeholder="Search category name or slug..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <select
                            className="form-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{ maxWidth: "160px" }}
                        >
                            <option value="">All Status</option>
                            <option value="1">Active</option>
                            <option value="0">Inactive</option>
                        </select>

                        {(search || statusFilter !== "") && (
                            <button
                                type="button"
                                className="btn btn-outline-secondary d-flex align-items-center gap-1"
                                onClick={() => { setSearch(""); setStatusFilter(""); }}
                            >
                                <SearchSlash size={16} />
                                <span>Reset</span>
                            </button>
                        )}
                    </div>
                    <div className="text-muted small">
                        Total <strong>{categories.length}</strong> {categories.length === 1 ? "category" : "categories"}
                    </div>
                </div>
            </div>

            {/* Categories Table */}
            <div className="bg-white rounded-4 shadow-sm border overflow-hidden">
                {loading ? (
                    <div className="text-center py-5">
                        <div className="spinner-border text-success" role="status" />
                        <p className="text-muted small mt-2 mb-0">Loading categories...</p>
                    </div>
                ) : categories.length === 0 ? (
                    <div className="text-center py-5">
                        <FolderTree size={48} className="text-muted opacity-50 mb-2" />
                        <h5 className="fw-semibold text-secondary">No Categories Found</h5>
                        <p className="text-muted small mb-3">Create your first product category to organize your academy store.</p>
                        <button type="button" className="btn btn-outline-success btn-sm" onClick={handleOpenCreate}>
                            <Plus size={16} className="me-1" /> Add Category
                        </button>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table align-middle table-hover mb-0">
                            <thead className="table-light text-secondary small text-uppercase">
                                <tr>
                                    <th style={{ width: "60px" }} className="text-center">#</th>
                                    <th style={{ width: "70px" }}>Image</th>
                                    <th>Category Name</th>
                                    <th>Slug</th>
                                    <th>Description</th>
                                    <th className="text-center">Sort Order</th>
                                    <th className="text-center">Status</th>
                                    <th style={{ width: "120px" }} className="text-end pe-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedCategories.map((item, idx) => (
                                    <tr key={item.id}>
                                        <td className="text-center text-muted small fw-medium">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                                        <td>
                                            {item.category_image ? (
                                                <img
                                                    src={item.category_image.trim()}
                                                    alt={item.category_name}
                                                    width={44}
                                                    height={44}
                                                    className="rounded-3 object-fit-cover border shadow-sm"
                                                />
                                            ) : (
                                                <div
                                                    className="rounded-3 bg-light border d-inline-flex align-items-center justify-content-center text-muted"
                                                    style={{ width: "44px", height: "44px" }}
                                                >
                                                    <ImageIcon size={20} className="opacity-50" />
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <div className="fw-bold text-dark">{item.category_name}</div>
                                            <span className="text-muted small">ID: #{item.id}</span>
                                        </td>
                                        <td>
                                            <code className="bg-light px-2 py-1 rounded small text-secondary">{item.slug}</code>
                                        </td>
                                        <td>
                                            <span className="text-muted small text-truncate d-inline-block" style={{ maxWidth: "260px" }}>
                                                {item.description || "—"}
                                            </span>
                                        </td>
                                        <td className="text-center fw-semibold text-secondary">{item.sort_order}</td>
                                        <td className="text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleStatus(item)}
                                                className={`badge border-0 px-2 py-1 cursor-pointer transition ${
                                                    Number(item.status) === 1 ? "bg-success" : "bg-secondary"
                                                }`}
                                                style={{ fontSize: "0.75rem", cursor: "pointer" }}
                                                title="Click to toggle status"
                                            >
                                                {Number(item.status) === 1 ? "Active" : "Inactive"}
                                            </button>
                                        </td>
                                        <td className="text-end pe-3">
                                            <div className="btn-group btn-group-sm">
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-secondary"
                                                    onClick={() => handleOpenEdit(item)}
                                                    title="Edit Category"
                                                >
                                                    <Edit size={15} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-danger"
                                                    onClick={() => handleDelete(item)}
                                                    title="Delete Category"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        total={categories.length}
                        onPageChange={setPage}
                        pageSize={PAGE_SIZE}
                    />
                )}
            </div>

            {/* CREATE / EDIT MODAL */}
            {modalOpen && (
                <div
                    className="modal fade show d-block"
                    tabIndex="-1"
                    style={{ background: "rgba(0,0,0,0.5)" }}
                    onClick={() => setModalOpen(false)}
                >
                    <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
                            <form onSubmit={handleSave}>
                                <div className="modal-header bg-light border-bottom">
                                    <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                                        <FolderTree size={20} className="text-success" />
                                        <span>{editingCategory ? `Edit: ${editingCategory.category_name}` : "Create Category"}</span>
                                    </h5>
                                    <button type="button" className="btn-close" onClick={() => setModalOpen(false)} />
                                </div>

                                <div className="modal-body p-4">
                                    {formError && (
                                        <div className="alert alert-danger py-2 small mb-3">
                                            {formError}
                                        </div>
                                    )}

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-secondary">Category Name *</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. Cricket Bats"
                                            required
                                            value={formData.category_name}
                                            onChange={(e) => handleNameChange(e.target.value)}
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-secondary">Slug (URL friendly) *</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. cricket-bats"
                                            required
                                            value={formData.slug}
                                            onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "") })}
                                        />
                                        <div className="form-text small">Lowercase letters, numbers and hyphens only.</div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-secondary">Description</label>
                                        <textarea
                                            className="form-control"
                                            rows={2}
                                            placeholder="Brief overview of this category..."
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        />
                                    </div>

                                    <div className="row g-2 mb-3">
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold text-secondary">Sort Order</label>
                                            <input
                                                type="number"
                                                className="form-control"
                                                value={formData.sort_order}
                                                onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold text-secondary">Status</label>
                                            <select
                                                className="form-select"
                                                value={formData.status}
                                                onChange={(e) => setFormData({ ...formData, status: Number(e.target.value) })}
                                            >
                                                <option value={1}>Active</option>
                                                <option value={0}>Inactive</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-secondary">Category Image (Max 2MB)</label>
                                        <input
                                            type="file"
                                            className="form-control"
                                            accept="image/jpeg,image/png,image/webp"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    if (file.size > 2 * 1024 * 1024) {
                                                        alert(`"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(2)}MB. Maximum allowed image size is 2MB.`);
                                                        e.target.value = "";
                                                        return;
                                                    }
                                                    setFormData({ ...formData, image: file });
                                                    setImagePreview(URL.createObjectURL(file));
                                                }
                                            }}
                                        />
                                        {imagePreview && (
                                            <div className="mt-2 d-flex align-items-center gap-2">
                                                <img
                                                    src={imagePreview.trim()}
                                                    alt="Preview"
                                                    width={60}
                                                    height={60}
                                                    className="rounded-3 border object-fit-cover"
                                                />
                                                <span className="text-muted small">Image Selected</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="modal-footer bg-light border-top">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary px-4"
                                        onClick={() => setModalOpen(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-success px-4"
                                        disabled={saving}
                                    >
                                        {saving ? "Saving..." : editingCategory ? "Update Category" : "Create Category"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
