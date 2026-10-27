"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    Check,
    CheckCircle2,
    Edit,
    ExternalLink,
    Eye,
    Filter,
    Grid,
    Image as ImageIcon,
    LayoutGrid,
    List,
    Package,
    Plus,
    RefreshCw,
    Search,
    SearchSlash,
    Star,
    Trash2,
    Upload,
    X,
    XCircle,
} from "lucide-react";

export default function ProductImagesPage() {
    const [images, setImages] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    // Filters
    const [search, setSearch] = useState("");
    const [selectedProductId, setSelectedProductId] = useState("");
    const [primaryFilter, setPrimaryFilter] = useState(""); // "" | "1" | "0"
    const [statusFilter, setStatusFilter] = useState(""); // "" | "1" | "0"
    const [viewMode, setViewMode] = useState("grid"); // "grid" | "table"
    const [reloadCount, setReloadCount] = useState(0);

    // Modal state for Add/Edit
    const [modalOpen, setModalOpen] = useState(false);
    const [editingImage, setEditingImage] = useState(null);
    const [formData, setFormData] = useState({
        product_id: "",
        image_alt: "",
        is_primary: 0,
        sort_order: 0,
        status: 1,
        image: null,
    });
    const [imagePreview, setImagePreview] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");

    // Lightbox preview modal
    const [lightboxImage, setLightboxImage] = useState(null);

    // Load products list for dropdown filters
    useEffect(() => {
        let isMounted = true;
        async function fetchProducts() {
            try {
                const res = await fetch("/api/products?status=1");
                const json = await res.json();
                if (isMounted && res.ok && json.success) {
                    setProducts(json.data || []);
                }
            } catch (err) {
                console.error("Failed to load products list:", err);
            }
        }
        fetchProducts();
        return () => {
            isMounted = false;
        };
    }, []);

    // Load Images
    useEffect(() => {
        let cancelled = false;

        async function loadImages() {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (search.trim()) params.set("search", search.trim());
                if (selectedProductId) params.set("product_id", selectedProductId);
                if (primaryFilter !== "") params.set("is_primary", primaryFilter);
                if (statusFilter !== "") params.set("status", statusFilter);

                const res = await fetch(`/api/product-images?${params.toString()}`);
                const json = await res.json();

                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to load product images.");
                }

                if (!cancelled) setImages(json.data || []);
            } catch (err) {
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadImages();
        return () => {
            cancelled = true;
        };
    }, [search, selectedProductId, primaryFilter, statusFilter, reloadCount]);

    // Open Add Modal
    const handleOpenCreate = () => {
        setEditingImage(null);
        setFormData({
            product_id: selectedProductId || (products[0] ? String(products[0].id) : ""),
            image_alt: "",
            is_primary: 0,
            sort_order: 0,
            status: 1,
            image: null,
        });
        setImagePreview(null);
        setFormError("");
        setModalOpen(true);
    };

    // Open Edit Modal
    const handleOpenEdit = (item) => {
        setEditingImage(item);
        setFormData({
            product_id: String(item.product_id),
            image_alt: item.image_alt || "",
            is_primary: item.is_primary ? 1 : 0,
            sort_order: item.sort_order ?? 0,
            status: item.status ?? 1,
            image: null,
        });
        setImagePreview(item.image_path || null);
        setFormError("");
        setModalOpen(true);
    };

    // Toggle Primary status
    const handleSetPrimary = async (item) => {
        try {
            const fd = new FormData();
            fd.append("is_primary", "1");
            const res = await fetch(`/api/product-images/${item.id}`, {
                method: "PUT",
                body: fd,
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message);

            setNotice({ type: "success", text: "Primary image updated successfully." });
            setReloadCount((c) => c + 1);
        } catch (err) {
            setNotice({ type: "danger", text: err.message || "Failed to update primary image." });
        }
    };

    // Toggle Active/Inactive status
    const handleToggleStatus = async (item) => {
        const newStatus = Number(item.status) === 1 ? 0 : 1;
        try {
            const fd = new FormData();
            fd.append("status", String(newStatus));
            const res = await fetch(`/api/product-images/${item.id}`, {
                method: "PUT",
                body: fd,
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message);

            setNotice({ type: "success", text: `Image ${newStatus === 1 ? "activated" : "deactivated"} successfully.` });
            setReloadCount((c) => c + 1);
        } catch (err) {
            setNotice({ type: "danger", text: err.message || "Status change failed." });
        }
    };

    // Delete image
    const handleDelete = async (item) => {
        if (!confirm(`Are you sure you want to delete this image? This action cannot be undone.`)) {
            return;
        }

        try {
            const res = await fetch(`/api/product-images/${item.id}`, {
                method: "DELETE",
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message);

            setNotice({ type: "success", text: "Image deleted successfully." });
            setReloadCount((c) => c + 1);
        } catch (err) {
            setNotice({ type: "danger", text: err.message || "Failed to delete image." });
        }
    };

    // File change handler
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            setFormError("Image file size must be less than 5MB.");
            return;
        }

        setFormData((prev) => ({ ...prev, image: file }));
        setImagePreview(URL.createObjectURL(file));
        setFormError("");
    };

    // Save Form (Create or Update)
    const handleSave = async (e) => {
        e.preventDefault();
        setFormError("");

        if (!editingImage && !formData.image) {
            setFormError("Please select an image file to upload.");
            return;
        }

        if (!formData.product_id) {
            setFormError("Please select a product.");
            return;
        }

        setSaving(true);
        try {
            const fd = new FormData();
            fd.append("product_id", formData.product_id);
            fd.append("image_alt", formData.image_alt.trim());
            fd.append("is_primary", String(formData.is_primary));
            fd.append("sort_order", String(formData.sort_order || 0));
            fd.append("status", String(formData.status));

            if (formData.image) {
                fd.append("image", formData.image);
            }

            let res;
            if (editingImage) {
                res = await fetch(`/api/product-images/${editingImage.id}`, {
                    method: "PUT",
                    body: fd,
                });
            } else {
                res = await fetch("/api/product-images", {
                    method: "POST",
                    body: fd,
                });
            }

            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to save image.");
            }

            setModalOpen(false);
            setNotice({
                type: "success",
                text: editingImage ? "Product image updated successfully." : "Product image uploaded successfully.",
            });
            setReloadCount((c) => c + 1);
        } catch (err) {
            setFormError(err.message || "Save operation failed.");
        } finally {
            setSaving(false);
        }
    };

    // KPI Metrics
    const metrics = useMemo(() => {
        const total = images.length;
        const primary = images.filter((i) => Number(i.is_primary) === 1).length;
        const active = images.filter((i) => Number(i.status) === 1).length;
        const uniqueProducts = new Set(images.map((i) => i.product_id)).size;
        return { total, primary, active, uniqueProducts };
    }, [images]);

    return (
        <div className="container-fluid p-4">
            {/* Header & Page Title */}
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
                <div>
                    <h2 className="fw-bold mb-1 d-flex align-items-center gap-2" style={{ color: "#062f38" }}>
                        <ImageIcon size={26} className="text-primary" /> Product Images Master
                    </h2>
                    <p className="text-muted small mb-0">
                        Upload, organize, and manage multi-angle gallery photos and primary featured pictures for products.
                    </p>
                </div>

                <div className="d-flex gap-2">
                    <button
                        type="button"
                        onClick={() => setReloadCount((c) => c + 1)}
                        className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1.5"
                        title="Reload"
                    >
                        <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
                    </button>
                    <button
                        type="button"
                        onClick={handleOpenCreate}
                        className="btn btn-primary btn-sm d-flex align-items-center gap-1.5 shadow-sm px-3"
                    >
                        <Plus size={16} /> Upload Product Image
                    </button>
                </div>
            </div>

            {/* KPI Metrics Cards */}
            <div className="row g-3 mb-4">
                <div className="col-6 col-md-3">
                    <div className="card border-0 shadow-sm rounded-3 p-3 bg-white">
                        <div className="small text-muted mb-1 fw-semibold">Total Photos</div>
                        <div className="fs-3 fw-bold text-dark">{metrics.total}</div>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="card border-0 shadow-sm rounded-3 p-3 bg-white">
                        <div className="small text-muted mb-1 fw-semibold">Primary Featured</div>
                        <div className="fs-3 fw-bold text-warning">{metrics.primary}</div>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="card border-0 shadow-sm rounded-3 p-3 bg-white">
                        <div className="small text-muted mb-1 fw-semibold">Products with Photos</div>
                        <div className="fs-3 fw-bold text-info">{metrics.uniqueProducts}</div>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="card border-0 shadow-sm rounded-3 p-3 bg-white">
                        <div className="small text-muted mb-1 fw-semibold">Active Images</div>
                        <div className="fs-3 fw-bold text-success">{metrics.active}</div>
                    </div>
                </div>
            </div>

            {/* Notice Alert */}
            {notice && (
                <div className={`alert alert-${notice.type} alert-dismissible fade show rounded-3 p-3 small`} role="alert">
                    {notice.text}
                    <button type="button" className="btn-close" onClick={() => setNotice(null)} aria-label="Close" />
                </div>
            )}

            {/* Filters Bar */}
            <div className="card border-0 shadow-sm rounded-3 p-3 bg-white mb-4">
                <div className="row g-2 align-items-center">
                    {/* Search */}
                    <div className="col-12 col-md-3">
                        <div className="input-group input-group-sm">
                            <span className="input-group-text bg-light border-end-0">
                                <Search size={14} className="text-muted" />
                            </span>
                            <input
                                type="text"
                                className="form-control border-start-0"
                                placeholder="Search by alt or product..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Product Filter */}
                    <div className="col-12 col-md-3">
                        <select
                            className="form-select form-select-sm"
                            value={selectedProductId}
                            onChange={(e) => setSelectedProductId(e.target.value)}
                        >
                            <option value="">-- All Products ({products.length}) --</option>
                            {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.product_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Primary Filter */}
                    <div className="col-6 col-md-2">
                        <select
                            className="form-select form-select-sm"
                            value={primaryFilter}
                            onChange={(e) => setPrimaryFilter(e.target.value)}
                        >
                            <option value="">-- All Types --</option>
                            <option value="1">Primary / Featured Only</option>
                            <option value="0">Secondary Gallery Only</option>
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div className="col-6 col-md-2">
                        <select
                            className="form-select form-select-sm"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">-- All Statuses --</option>
                            <option value="1">Active Only</option>
                            <option value="0">Inactive Only</option>
                        </select>
                    </div>

                    {/* View Switch */}
                    <div className="col-12 col-md-2 text-md-end d-flex justify-content-md-end gap-1">
                        <button
                            type="button"
                            onClick={() => setViewMode("grid")}
                            className={`btn btn-sm ${viewMode === "grid" ? "btn-primary" : "btn-outline-secondary"}`}
                            title="Grid View"
                        >
                            <LayoutGrid size={15} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("table")}
                            className={`btn btn-sm ${viewMode === "table" ? "btn-primary" : "btn-outline-secondary"}`}
                            title="Table View"
                        >
                            <List size={15} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content: Grid View or Table View */}
            {loading ? (
                <div className="card border-0 shadow-sm rounded-3 p-5 bg-white text-center">
                    <div className="spinner-border text-primary mb-2" role="status" />
                    <div className="small text-muted">Loading product images...</div>
                </div>
            ) : error ? (
                <div className="alert alert-danger rounded-3 p-3 small">{error}</div>
            ) : images.length === 0 ? (
                <div className="card border-0 shadow-sm rounded-3 p-5 bg-white text-center">
                    <ImageIcon size={48} className="text-muted mb-3 mx-auto opacity-50" />
                    <h5 className="fw-bold mb-1">No Product Images Found</h5>
                    <p className="text-muted small mb-3">
                        {search || selectedProductId || primaryFilter || statusFilter
                            ? "No images match the selected filter criteria."
                            : "No product photos have been uploaded yet. Click below to add the first one."}
                    </p>
                    <div>
                        <button type="button" onClick={handleOpenCreate} className="btn btn-primary btn-sm px-4">
                            <Plus size={15} className="me-1" /> Upload Product Image
                        </button>
                    </div>
                </div>
            ) : viewMode === "grid" ? (
                /* GRID VIEW */
                <div className="row g-3">
                    {images.map((item) => (
                        <div className="col-12 col-sm-6 col-md-4 col-lg-3" key={item.id}>
                            <div className="card border-0 shadow-sm rounded-3 overflow-hidden h-100 bg-white">
                                {/* Photo Container */}
                                <div
                                    className="position-relative bg-light border-bottom cursor-pointer d-flex align-items-center justify-content-center overflow-hidden"
                                    style={{ height: "190px" }}
                                    onClick={() => setLightboxImage(item)}
                                >
                                    <img
                                        src={item.image_path}
                                        alt={item.image_alt || item.product_name}
                                        className="w-100 h-100 object-fit-contain p-2"
                                    />

                                    {/* Primary Badge */}
                                    {Number(item.is_primary) === 1 ? (
                                        <span
                                            className="position-absolute top-0 start-0 m-2 badge bg-warning text-dark d-flex align-items-center gap-1 shadow-sm small"
                                            style={{ zIndex: 2 }}
                                        >
                                            <Star size={12} fill="currentColor" /> Primary
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSetPrimary(item);
                                            }}
                                            className="position-absolute top-0 start-0 m-2 btn btn-light btn-sm rounded-pill py-0.5 px-2 extra-small text-muted shadow-sm hover-warning"
                                            style={{ zIndex: 2, fontSize: "0.7rem" }}
                                            title="Make Primary"
                                        >
                                            <Star size={11} className="me-1" /> Make Primary
                                        </button>
                                    )}

                                    {/* Status Badge */}
                                    <span
                                        className={`position-absolute top-0 end-0 m-2 badge rounded-pill small ${
                                            Number(item.status) === 1 ? "bg-success" : "bg-secondary"
                                        }`}
                                        style={{ zIndex: 2 }}
                                    >
                                        {Number(item.status) === 1 ? "Active" : "Inactive"}
                                    </span>

                                    {/* Hover Preview Overlay */}
                                    <div className="position-absolute bottom-0 end-0 m-2 bg-dark bg-opacity-75 text-white rounded p-1 small d-flex align-items-center gap-1">
                                        <Eye size={13} />
                                    </div>
                                </div>

                                {/* Details Body */}
                                <div className="card-body p-3 d-flex flex-column justify-content-between">
                                    <div>
                                        <div className="fw-bold text-dark small text-truncate mb-1" title={item.product_name}>
                                            {item.product_name}
                                        </div>
                                        <div className="text-muted extra-small text-truncate mb-2" style={{ fontSize: "0.75rem" }}>
                                            {item.image_alt ? `Alt: ${item.image_alt}` : "No caption text"}
                                        </div>
                                    </div>

                                    {/* Action Bar */}
                                    <div className="pt-2 border-top d-flex justify-content-between align-items-center">
                                        <span className="extra-small text-muted" style={{ fontSize: "0.72rem" }}>
                                            Order: #{item.sort_order ?? 0}
                                        </span>

                                        <div className="btn-group btn-group-sm">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleStatus(item)}
                                                className={`btn btn-sm ${
                                                    Number(item.status) === 1
                                                        ? "btn-outline-success"
                                                        : "btn-outline-secondary"
                                                }`}
                                                title={Number(item.status) === 1 ? "Deactivate" : "Activate"}
                                            >
                                                {Number(item.status) === 1 ? <Check size={13} /> : <X size={13} />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenEdit(item)}
                                                className="btn btn-outline-primary btn-sm"
                                                title="Edit Caption &amp; Order"
                                            >
                                                <Edit size={13} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(item)}
                                                className="btn btn-outline-danger btn-sm"
                                                title="Delete Image"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* TABLE VIEW */
                <div className="card border-0 shadow-sm rounded-3 overflow-hidden bg-white">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="table-light small">
                                <tr>
                                    <th style={{ width: "80px" }}>Preview</th>
                                    <th>Product</th>
                                    <th>Caption / Alt</th>
                                    <th style={{ width: "120px" }}>Role</th>
                                    <th style={{ width: "100px" }}>Sort Order</th>
                                    <th style={{ width: "100px" }}>Status</th>
                                    <th style={{ width: "140px" }} className="text-end">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {images.map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <div
                                                className="rounded bg-light border d-flex align-items-center justify-content-center overflow-hidden cursor-pointer"
                                                style={{ width: "50px", height: "50px" }}
                                                onClick={() => setLightboxImage(item)}
                                            >
                                                <img
                                                    src={item.image_path}
                                                    alt=""
                                                    className="w-100 h-100 object-fit-contain"
                                                />
                                            </div>
                                        </td>
                                        <td>
                                            <div className="fw-semibold text-dark small">{item.product_name}</div>
                                            <div className="extra-small text-muted" style={{ fontSize: "0.75rem" }}>
                                                ID: #{item.product_id}
                                            </div>
                                        </td>
                                        <td>
                                            <span className="small text-muted">{item.image_alt || "—"}</span>
                                        </td>
                                        <td>
                                            {Number(item.is_primary) === 1 ? (
                                                <span className="badge bg-warning text-dark d-inline-flex align-items-center gap-1 small">
                                                    <Star size={11} fill="currentColor" /> Primary
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => handleSetPrimary(item)}
                                                    className="btn btn-outline-secondary btn-sm py-0 px-2 extra-small"
                                                    style={{ fontSize: "0.72rem" }}
                                                >
                                                    Make Primary
                                                </button>
                                            )}
                                        </td>
                                        <td>
                                            <span className="small fw-semibold">{item.sort_order ?? 0}</span>
                                        </td>
                                        <td>
                                            <span
                                                className={`badge rounded-pill small ${
                                                    Number(item.status) === 1 ? "bg-success" : "bg-secondary"
                                                }`}
                                            >
                                                {Number(item.status) === 1 ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td className="text-end">
                                            <div className="btn-group btn-group-sm">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenEdit(item)}
                                                    className="btn btn-outline-primary"
                                                    title="Edit"
                                                >
                                                    <Edit size={13} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(item)}
                                                    className="btn btn-outline-danger"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Upload / Edit Modal */}
            {modalOpen && (
                <div
                    className="modal show d-block"
                    tabIndex="-1"
                    style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}
                >
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content rounded-3 border-0 shadow">
                            <div className="modal-header border-bottom py-3">
                                <h5 className="modal-title fw-bold" style={{ color: "#062f38" }}>
                                    {editingImage ? "Edit Product Image" : "Upload Product Image"}
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setModalOpen(false)}
                                    aria-label="Close"
                                />
                            </div>

                            <form onSubmit={handleSave}>
                                <div className="modal-body p-4">
                                    {formError && (
                                        <div className="alert alert-danger py-2 px-3 small rounded-2 mb-3">
                                            {formError}
                                        </div>
                                    )}

                                    {/* Product Selector */}
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">
                                            Associated Product <span className="text-danger">*</span>
                                        </label>
                                        <select
                                            className="form-select"
                                            value={formData.product_id}
                                            onChange={(e) =>
                                                setFormData((prev) => ({ ...prev, product_id: e.target.value }))
                                            }
                                            required
                                            disabled={Boolean(editingImage)}
                                        >
                                            <option value="">-- Choose Product --</option>
                                            {products.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.product_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Image File Input */}
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">
                                            Image File {!editingImage && <span className="text-danger">*</span>}
                                        </label>
                                        <input
                                            type="file"
                                            className="form-control"
                                            accept="image/jpeg,image/png,image/webp"
                                            onChange={handleFileChange}
                                        />
                                        <div className="form-text extra-small" style={{ fontSize: "0.75rem" }}>
                                            Supports JPG, PNG, WebP (Max 5MB).
                                        </div>

                                        {imagePreview && (
                                            <div className="mt-2 text-center p-2 bg-light rounded border">
                                                <img
                                                    src={imagePreview}
                                                    alt="Preview"
                                                    style={{ maxHeight: "150px", maxWidth: "100%" }}
                                                    className="object-fit-contain"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Image Alt / Caption */}
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Caption / Alt Text</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. Front View, Grip Detail, Blade Angle"
                                            value={formData.image_alt}
                                            onChange={(e) =>
                                                setFormData((prev) => ({ ...prev, image_alt: e.target.value }))
                                            }
                                        />
                                    </div>

                                    <div className="row g-3">
                                        {/* Sort Order */}
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Display Sort Order</label>
                                            <input
                                                type="number"
                                                className="form-control"
                                                value={formData.sort_order}
                                                onChange={(e) =>
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        sort_order: Number(e.target.value) || 0,
                                                    }))
                                                }
                                            />
                                        </div>

                                        {/* Status */}
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Status</label>
                                            <select
                                                className="form-select"
                                                value={formData.status}
                                                onChange={(e) =>
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        status: Number(e.target.value),
                                                    }))
                                                }
                                            >
                                                <option value="1">Active</option>
                                                <option value="0">Inactive</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Make Primary Checkbox */}
                                    <div className="mt-3 form-check">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="isPrimaryCheck"
                                            checked={Number(formData.is_primary) === 1}
                                            onChange={(e) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    is_primary: e.target.checked ? 1 : 0,
                                                }))
                                            }
                                        />
                                        <label className="form-check-label small fw-semibold" htmlFor="isPrimaryCheck">
                                            Set as Primary / Main Featured Image for this Product
                                        </label>
                                    </div>
                                </div>

                                <div className="modal-footer border-top py-2.5">
                                    <button
                                        type="button"
                                        className="btn btn-light btn-sm"
                                        onClick={() => setModalOpen(false)}
                                        disabled={saving}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary btn-sm px-4 shadow-sm"
                                        disabled={saving}
                                    >
                                        {saving ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-1" />
                                                Saving...
                                            </>
                                        ) : (
                                            "Save Image"
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox / Zoom Modal */}
            {lightboxImage && (
                <div
                    className="modal show d-block"
                    tabIndex="-1"
                    style={{ backgroundColor: "rgba(0,0,0,0.8)", zIndex: 1060 }}
                    onClick={() => setLightboxImage(null)}
                >
                    <div
                        className="modal-dialog modal-dialog-centered modal-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-content bg-transparent border-0 text-white text-center">
                            <div className="d-flex justify-content-between align-items-center mb-2 px-2">
                                <div className="fw-bold">{lightboxImage.product_name}</div>
                                <button
                                    type="button"
                                    className="btn btn-link text-white p-0"
                                    onClick={() => setLightboxImage(null)}
                                >
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="bg-white rounded-3 p-3">
                                <img
                                    src={lightboxImage.image_path}
                                    alt={lightboxImage.image_alt || ""}
                                    className="img-fluid rounded"
                                    style={{ maxHeight: "75vh", objectFit: "contain" }}
                                />
                            </div>
                            {lightboxImage.image_alt && (
                                <div className="mt-2 text-white-50 small">{lightboxImage.image_alt}</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
