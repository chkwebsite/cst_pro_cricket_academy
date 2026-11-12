"use client";

import {
    AlertCircle,
    CheckCircle2,
    DollarSign,
    Edit,
    FolderTree,
    Image as ImageIcon,
    Layers,
    MapPin,
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
import { useEffect, useState } from "react";
import Pagination from "../components/Pagination";

export default function ProductsPage() {
    const [products, setProducts] = useState([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const [categories, setCategories] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    // Filters
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [reloadCount, setReloadCount] = useState(0);

    // Modals
    const [productModalOpen, setProductModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [imageModalProduct, setImageModalProduct] = useState(null);
    const [productImages, setProductImages] = useState([]);
    const [loadingImages, setLoadingImages] = useState(false);
    const [stockModalProduct, setStockModalProduct] = useState(null);
    const [productStockList, setProductStockList] = useState([]);
    const [loadingStock, setLoadingStock] = useState(false);

    // Product Form
    const [formData, setFormData] = useState({
        category_id: "",
        product_name: "",
        slug: "",
        product_code: "",
        description: "",
        price: "",
        sale_price: "",
        tax_percent: "0",
        status: 1,
    });
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");

    // Load filter options (categories & branches)
    useEffect(() => {
        (async () => {
            try {
                const [catRes, brRes] = await Promise.all([
                    fetch("/api/product-categories"),
                    fetch("/api/branch"),
                ]);
                const catJson = await catRes.json();
                const brJson = await brRes.json();
                if (catRes.ok && catJson.success) setCategories(catJson.data || []);
                if (brRes.ok && brJson.success) setBranches(brJson.data || []);
            } catch {
                /* non-fatal */
            }
        })();
    }, []);

    // Load products
    useEffect(() => {
        let cancelled = false;

        async function fetchProducts() {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (search.trim()) params.set("search", search.trim());
                if (categoryFilter) params.set("category_id", categoryFilter);
                if (statusFilter !== "") params.set("status", statusFilter);

                const res = await fetch(`/api/products?${params.toString()}`);
                const json = await res.json();

                if (!res.ok || !json.success) throw new Error(json.message || "Failed to load products.");

                if (!cancelled) setProducts(json.data || []);
            } catch (err) {
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchProducts();
        return () => { cancelled = true; };
    }, [search, categoryFilter, statusFilter, reloadCount]);

    useEffect(() => {
        setPage(1);
    }, [search, categoryFilter, statusFilter]);

    const totalPages = Math.ceil(products.length / PAGE_SIZE) || 1;
    const pagedProducts = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // Name change auto-slug generator
    const handleNameChange = (name) => {
        setFormData((prev) => {
            const autoSlug = !editingProduct
                ? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")
                : prev.slug;
            return { ...prev, product_name: name, slug: autoSlug };
        });
    };

    // Open Add Product Modal
    const handleOpenCreate = () => {
        setEditingProduct(null);
        setFormData({
            category_id: categories[0]?.id ? String(categories[0].id) : "",
            product_name: "",
            slug: "",
            product_code: `PRD-${Date.now().toString().slice(-5)}`,
            description: "",
            price: "",
            sale_price: "",
            tax_percent: "18",
            status: 1,
        });
        setFormError("");
        setProductModalOpen(true);
    };

    // Open Edit Product Modal
    const handleOpenEdit = (p) => {
        setEditingProduct(p);
        setFormData({
            category_id: p.category_id ? String(p.category_id) : "",
            product_name: p.product_name || "",
            slug: p.slug || "",
            product_code: p.product_code || "",
            description: p.description || "",
            price: String(p.price || ""),
            sale_price: p.sale_price !== null && p.sale_price !== undefined ? String(p.sale_price) : "",
            tax_percent: String(p.tax_percent ?? "0"),
            status: p.status ?? 1,
        });
        setFormError("");
        setProductModalOpen(true);
    };

    // Quick Status Toggle
    const handleToggleStatus = async (p) => {
        const newStatus = Number(p.status) === 1 ? 0 : 1;
        try {
            const res = await fetch(`/api/products/${p.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    product_name: p.product_name,
                    slug: p.slug,
                    price: p.price,
                    status: newStatus,
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to update status.");

            setNotice(`Product "${p.product_name}" status updated.`);
            setTimeout(() => setNotice(null), 3500);
            setReloadCount((c) => c + 1);
        } catch (err) {
            alert(err.message);
        }
    };

    // Delete Product
    const handleDelete = async (p) => {
        if (!confirm(`Are you sure you want to delete product "${p.product_name}"?`)) return;

        try {
            const res = await fetch(`/api/products/${p.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete product.");

            setNotice(`Product "${p.product_name}" deleted.`);
            setTimeout(() => setNotice(null), 3500);
            setProducts((prev) => prev.filter((item) => item.id !== p.id));
        } catch (err) {
            alert(err.message);
        }
    };

    // Save Product (Create / Edit)
    const handleSaveProduct = async (e) => {
        e.preventDefault();
        setSaving(true);
        setFormError("");

        try {
            const isEdit = Boolean(editingProduct);
            const url = isEdit ? `/api/products/${editingProduct.id}` : "/api/products";
            const method = isEdit ? "PUT" : "POST";

            const payload = {
                category_id: formData.category_id ? Number(formData.category_id) : null,
                product_name: formData.product_name.trim(),
                slug: formData.slug.trim().toLowerCase(),
                product_code: formData.product_code.trim() || null,
                description: formData.description.trim() || null,
                price: Number(formData.price),
                sale_price: formData.sale_price !== "" ? Number(formData.sale_price) : null,
                tax_percent: Number(formData.tax_percent || 0),
                status: Number(formData.status),
            };

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();

            if (!res.ok || !json.success) throw new Error(json.message || "Failed to save product.");

            setNotice(isEdit ? "Product updated successfully." : "Product created successfully.");
            setTimeout(() => setNotice(null), 3500);
            setProductModalOpen(false);
            setReloadCount((c) => c + 1);
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    // Image Modal: Open & Fetch images
    const handleOpenImages = async (p) => {
        setImageModalProduct(p);
        setLoadingImages(true);
        try {
            const res = await fetch(`/api/product-images?product_id=${p.id}`);
            const json = await res.json();
            if (res.ok && json.success) setProductImages(json.data || []);
        } catch {
            setProductImages([]);
        } finally {
            setLoadingImages(false);
        }
    };

    // Image Upload
    const handleUploadImage = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !imageModalProduct) return;

        if (file.size > 2 * 1024 * 1024) {
            alert(`"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(2)}MB. Maximum allowed image size is 2MB.`);
            e.target.value = "";
            return;
        }

        const body = new FormData();
        body.append("product_id", String(imageModalProduct.id));
        body.append("image", file);
        body.append("is_primary", productImages.length === 0 ? "1" : "0");
        body.append("image_alt", imageModalProduct.product_name);

        try {
            const res = await fetch("/api/product-images", { method: "POST", body });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to upload image.");

            handleOpenImages(imageModalProduct);
            setReloadCount((c) => c + 1);
        } catch (err) {
            alert(err.message);
        }
    };

    // Set Primary Image
    const handleSetPrimaryImage = async (imgId) => {
        try {
            const res = await fetch(`/api/product-images/${imgId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_primary: 1 }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to set primary.");

            handleOpenImages(imageModalProduct);
            setReloadCount((c) => c + 1);
        } catch (err) {
            alert(err.message);
        }
    };

    // Delete Image
    const handleDeleteImage = async (imgId) => {
        if (!confirm("Delete this image?")) return;
        try {
            const res = await fetch(`/api/product-images/${imgId}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete.");

            setProductImages((prev) => prev.filter((img) => img.id !== imgId));
            setReloadCount((c) => c + 1);
        } catch (err) {
            alert(err.message);
        }
    };

    // Stock Modal: Open & Fetch stock
    const handleOpenStock = async (p) => {
        setStockModalProduct(p);
        setLoadingStock(true);
        try {
            const res = await fetch(`/api/product-stock?product_id=${p.id}`);
            const json = await res.json();
            if (res.ok && json.success) setProductStockList(json.data || []);
        } catch {
            setProductStockList([]);
        } finally {
            setLoadingStock(false);
        }
    };

    // Save Stock item
    const handleUpdateStock = async (branchId, quantity, lowStockAlert) => {
        if (!stockModalProduct) return;
        try {
            const res = await fetch("/api/product-stock", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    product_id: stockModalProduct.id,
                    branch_id: branchId,
                    quantity: Number(quantity),
                    low_stock_alert: Number(lowStockAlert || 5),
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to update stock.");

            handleOpenStock(stockModalProduct);
        } catch (err) {
            alert(err.message);
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
                            style={{ background: "#e8f5e9", color: "#2e7d32" }}
                        >
                            <Package size={24} />
                        </div>
                        <div>
                            <h3 className="mb-0 fw-bold text-dark">Store Products</h3>
                            <p className="text-muted small mb-0">
                                Manage academy store merchandise, cricket kits, pricing, tax rates and stock.
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
                            <span>Add Product</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Notification alert */}
            {notice && (
                <div className="alert alert-success alert-dismissible fade show d-flex align-items-center gap-2" role="alert">
                    <CheckCircle2 size={18} />
                    <span>{notice}</span>
                    <button type="button" className="btn-close" onClick={() => setNotice(null)} aria-label="Close" />
                </div>
            )}

            {/* Error alert */}
            {error && (
                <div className="alert alert-danger d-flex align-items-center gap-2" role="alert">
                    <XCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {/* Filter Bar */}
            <div className="bg-white rounded-4 shadow-sm p-3 mb-3 border">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                    <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
                        <div className="input-group" style={{ maxWidth: "320px" }}>
                            <span className="input-group-text bg-light border-end-0">
                                <Search size={16} className="text-muted" />
                            </span>
                            <input
                                type="text"
                                className="form-control border-start-0"
                                placeholder="Search product name, code, slug..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <select
                            className="form-select"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            style={{ maxWidth: "180px" }}
                        >
                            <option value="">All Categories</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>{c.category_name}</option>
                            ))}
                        </select>

                        <select
                            className="form-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{ maxWidth: "150px" }}
                        >
                            <option value="">All Statuses</option>
                            <option value="1">Active</option>
                            <option value="0">Inactive</option>
                        </select>

                        {(search || categoryFilter || statusFilter !== "") && (
                            <button
                                type="button"
                                className="btn btn-outline-secondary d-flex align-items-center gap-1"
                                onClick={() => { setSearch(""); setCategoryFilter(""); setStatusFilter(""); }}
                            >
                                <SearchSlash size={16} />
                                <span>Reset</span>
                            </button>
                        )}
                    </div>
                    <div className="text-muted small">
                        Total <strong>{products.length}</strong> {products.length === 1 ? "product" : "products"}
                    </div>
                </div>
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-4 shadow-sm border overflow-hidden">
                {loading ? (
                    <div className="text-center py-5">
                        <div className="spinner-border text-success" role="status" />
                        <p className="text-muted small mt-2 mb-0">Loading products...</p>
                    </div>
                ) : products.length === 0 ? (
                    <div className="text-center py-5">
                        <Package size={48} className="text-muted opacity-50 mb-2" />
                        <h5 className="fw-semibold text-secondary">No Products Found</h5>
                        <p className="text-muted small mb-3">Add items to sell in the cricket academy pro shop.</p>
                        <button type="button" className="btn btn-outline-success btn-sm" onClick={handleOpenCreate}>
                            <Plus size={16} className="me-1" /> Add Product
                        </button>
                    </div>
                ) : (
                    <>
                    <div className="table-responsive">
                        <table className="table align-middle table-hover mb-0">
                            <thead className="table-light text-secondary small text-uppercase">
                                <tr>
                                    <th style={{ width: "50px" }} className="text-center">#</th>
                                    <th>Product Details</th>
                                    <th>Category</th>
                                    <th>Pricing</th>
                                    <th>Tax Rate</th>
                                    <th>Stock</th>
                                    <th className="text-center">Status</th>
                                    <th style={{ width: "190px" }} className="text-end pe-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedProducts.map((item, idx) => (
                                    <tr key={item.id}>
                                        <td className="text-center text-muted small fw-medium">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <div
                                                    className="rounded-3 bg-light border d-inline-flex align-items-center justify-content-center text-muted flex-shrink-0 overflow-hidden"
                                                    style={{ width: "44px", height: "44px" }}
                                                >
                                                    {item.primary_image ? (
                                                        <img
                                                            src={item.primary_image}
                                                            alt={item.product_name}
                                                            className="w-100 h-100 object-fit-contain p-0.5"
                                                        />
                                                    ) : (
                                                        <Package size={22} className="text-success opacity-75" />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="fw-bold text-dark">{item.product_name}</div>
                                                    <div className="small text-muted d-flex align-items-center gap-2">
                                                        <span>Code: <code className="text-secondary">{item.product_code || "—"}</code></span>
                                                        <span>•</span>
                                                        <span className="text-truncate" style={{ maxWidth: "160px" }}>{item.slug}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="badge bg-secondary-subtle text-secondary border px-2 py-1">
                                                {item.category_name || "Uncategorized"}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="fw-bold text-dark fs-6">
                                                ₹{Number(item.sale_price ?? item.price).toLocaleString("en-IN")}
                                            </div>
                                            {item.sale_price && Number(item.sale_price) < Number(item.price) && (
                                                <div className="small text-muted text-decoration-line-through">
                                                    ₹{Number(item.price).toLocaleString("en-IN")}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <span className="small text-muted">{item.tax_percent}% GST</span>
                                        </td>
                                        <td>
                                            {item.total_stock !== undefined ? (
                                                Number(item.total_stock) > 0 ? (
                                                    <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                                                        {item.total_stock} units
                                                    </span>
                                                ) : (
                                                    <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1">
                                                        Out of stock
                                                    </span>
                                                )
                                            ) : (
                                                <span className="small text-muted">—</span>
                                            )}
                                            {item.available_branches && (
                                                <div
                                                    className="extra-small text-muted mt-1 text-truncate"
                                                    style={{ maxWidth: "160px", fontSize: "0.72rem" }}
                                                    title={`Stocked at: ${item.available_branches}`}
                                                >
                                                    <MapPin size={10} className="text-secondary me-0.5" />
                                                    {item.available_branches}
                                                </div>
                                            )}
                                        </td>
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
                                                    className="btn btn-outline-info"
                                                    onClick={() => handleOpenImages(item)}
                                                    title="Manage Product Images"
                                                >
                                                    <ImageIcon size={15} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-primary"
                                                    onClick={() => handleOpenStock(item)}
                                                    title="Manage Branch Stock"
                                                >
                                                    <Layers size={15} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-secondary"
                                                    onClick={() => handleOpenEdit(item)}
                                                    title="Edit Product"
                                                >
                                                    <Edit size={15} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-danger"
                                                    onClick={() => handleDelete(item)}
                                                    title="Delete Product"
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
                        total={products.length}
                        onPageChange={setPage}
                        pageSize={PAGE_SIZE}
                    />
                    </>
                )}
            </div>

            {/* MODAL 1: CREATE / EDIT PRODUCT */}
            {productModalOpen && (
                <div
                    className="modal fade show d-block"
                    tabIndex="-1"
                    style={{ background: "rgba(0,0,0,0.5)" }}
                    onClick={() => setProductModalOpen(false)}
                >
                    <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
                            <form onSubmit={handleSaveProduct}>
                                <div className="modal-header bg-light border-bottom">
                                    <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                                        <Package size={20} className="text-success" />
                                        <span>{editingProduct ? `Edit Product: ${editingProduct.product_name}` : "Create New Product"}</span>
                                    </h5>
                                    <button type="button" className="btn-close" onClick={() => setProductModalOpen(false)} />
                                </div>

                                <div className="modal-body p-4">
                                    {formError && (
                                        <div className="alert alert-danger py-2 small mb-3">
                                            {formError}
                                        </div>
                                    )}

                                    <div className="row g-3">
                                        <div className="col-md-8">
                                            <label className="form-label small fw-semibold text-secondary">Product Name *</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="e.g. MRF Grand Edition English Willow Bat"
                                                required
                                                value={formData.product_name}
                                                onChange={(e) => handleNameChange(e.target.value)}
                                            />
                                        </div>

                                        <div className="col-md-4">
                                            <label className="form-label small fw-semibold text-secondary">Category *</label>
                                            <select
                                                className="form-select"
                                                required
                                                value={formData.category_id}
                                                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                            >
                                                <option value="">Select Category</option>
                                                {categories.map((c) => (
                                                    <option key={c.id} value={c.id}>{c.category_name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="col-md-6">
                                            <label className="form-label small fw-semibold text-secondary">Product Code (SKU)</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="e.g. BAT-MRF-001"
                                                value={formData.product_code}
                                                onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                                            />
                                        </div>

                                        <div className="col-md-6">
                                            <label className="form-label small fw-semibold text-secondary">Slug (URL friendly) *</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                required
                                                value={formData.slug}
                                                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "") })}
                                            />
                                        </div>

                                        <div className="col-md-4">
                                            <label className="form-label small fw-semibold text-secondary">Regular Price (₹) *</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                className="form-control"
                                                placeholder="0.00"
                                                required
                                                value={formData.price}
                                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                            />
                                        </div>

                                        <div className="col-md-4">
                                            <label className="form-label small fw-semibold text-secondary">Sale Price (₹ optional)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                className="form-control"
                                                placeholder="Discounted price"
                                                value={formData.sale_price}
                                                onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                                            />
                                        </div>

                                        <div className="col-md-4">
                                            <label className="form-label small fw-semibold text-secondary">Tax / GST (%)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max="100"
                                                className="form-control"
                                                value={formData.tax_percent}
                                                onChange={(e) => setFormData({ ...formData, tax_percent: e.target.value })}
                                            />
                                        </div>

                                        <div className="col-12">
                                            <label className="form-label small fw-semibold text-secondary">Description</label>
                                            <textarea
                                                className="form-control"
                                                rows={3}
                                                placeholder="Detailed description, specifications, warranty, size..."
                                                value={formData.description}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            />
                                        </div>

                                        <div className="col-md-6">
                                            <label className="form-label small fw-semibold text-secondary">Status</label>
                                            <select
                                                className="form-select"
                                                value={formData.status}
                                                onChange={(e) => setFormData({ ...formData, status: Number(e.target.value) })}
                                            >
                                                <option value={1}>Active (Visible in Store)</option>
                                                <option value={0}>Inactive (Hidden)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="modal-footer bg-light border-top">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary px-4"
                                        onClick={() => setProductModalOpen(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-success px-4"
                                        disabled={saving}
                                    >
                                        {saving ? "Saving..." : editingProduct ? "Update Product" : "Create Product"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2: MANAGE IMAGES */}
            {imageModalProduct && (
                <div
                    className="modal fade show d-block"
                    tabIndex="-1"
                    style={{ background: "rgba(0,0,0,0.5)" }}
                    onClick={() => setImageModalProduct(null)}
                >
                    <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
                            <div className="modal-header bg-light border-bottom">
                                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                                    <ImageIcon size={20} className="text-info" />
                                    <span>Product Images: {imageModalProduct.product_name}</span>
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setImageModalProduct(null)} />
                            </div>

                            <div className="modal-body p-4">
                                {/* Upload button */}
                                <div className="p-3 mb-4 rounded-3 bg-light border text-center">
                                    <label className="btn btn-success d-inline-flex align-items-center gap-2 cursor-pointer mb-0">
                                        <Upload size={16} />
                                        <span>Upload New Image</span>
                                        <input
                                            type="file"
                                            className="d-none"
                                            accept="image/jpeg,image/png,image/webp"
                                            onChange={handleUploadImage}
                                        />
                                    </label>
                                    <div className="text-muted small mt-2">JPG, PNG or WebP up to 2MB</div>
                                </div>

                                {loadingImages ? (
                                    <div className="text-center py-4">
                                        <div className="spinner-border text-info" />
                                    </div>
                                ) : productImages.length === 0 ? (
                                    <div className="text-center py-4 text-muted">
                                        <ImageIcon size={36} className="opacity-50 mb-2" />
                                        <p className="mb-0">No images uploaded for this product yet.</p>
                                    </div>
                                ) : (
                                    <div className="row g-3">
                                        {productImages.map((img) => (
                                            <div key={img.id} className="col-6 col-md-4">
                                                <div className="card h-100 border rounded-3 overflow-hidden shadow-sm position-relative">
                                                    <img
                                                        src={img.image_path.trim()}
                                                        alt={img.image_alt || "Product image"}
                                                        className="w-100 object-fit-cover"
                                                        style={{ height: "140px" }}
                                                    />
                                                    {Number(img.is_primary) === 1 && (
                                                        <span className="badge bg-warning text-dark position-absolute top-0 start-0 m-2 shadow-sm d-flex align-items-center gap-1">
                                                            <Star size={12} fill="currentColor" /> Primary
                                                        </span>
                                                    )}
                                                    <div className="card-body p-2 d-flex justify-content-between align-items-center bg-light">
                                                        {Number(img.is_primary) !== 1 ? (
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-warning btn-sm py-0 px-2 small"
                                                                onClick={() => handleSetPrimaryImage(img.id)}
                                                            >
                                                                Make Primary
                                                            </button>
                                                        ) : (
                                                            <span className="small text-muted">Main Image</span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger btn-sm p-1"
                                                            onClick={() => handleDeleteImage(img.id)}
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer bg-light border-top">
                                <button
                                    type="button"
                                    className="btn btn-secondary px-4"
                                    onClick={() => setImageModalProduct(null)}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 3: MANAGE BRANCH STOCK */}
            {stockModalProduct && (
                <div
                    className="modal fade show d-block"
                    tabIndex="-1"
                    style={{ background: "rgba(0,0,0,0.5)" }}
                    onClick={() => setStockModalProduct(null)}
                >
                    <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
                            <div className="modal-header bg-light border-bottom">
                                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                                    <Layers size={20} className="text-primary" />
                                    <span>Branch Inventory: {stockModalProduct.product_name}</span>
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setStockModalProduct(null)} />
                            </div>

                            <div className="modal-body p-4">
                                <p className="text-muted small mb-3">
                                    Set the stock quantity available at each academy branch for in-person pickup or branch fulfillment.
                                </p>

                                {branches.length === 0 ? (
                                    <div className="alert alert-warning small">No academy branches registered yet.</div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-bordered align-middle">
                                            <thead className="table-light small text-uppercase">
                                                <tr>
                                                    <th>Branch</th>
                                                    <th style={{ width: "130px" }}>Quantity</th>
                                                    <th style={{ width: "130px" }}>Low Stock Alert</th>
                                                    <th style={{ width: "120px" }}>Status</th>
                                                    <th style={{ width: "100px" }} className="text-end">Save</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {branches.map((b) => {
                                                    const stockRow = productStockList.find((s) => Number(s.branch_id) === Number(b.id));
                                                    return (
                                                        <BranchStockRow
                                                            key={b.id}
                                                            branch={b}
                                                            currentStock={stockRow}
                                                            onSave={handleUpdateStock}
                                                        />
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer bg-light border-top">
                                <button
                                    type="button"
                                    className="btn btn-secondary px-4"
                                    onClick={() => setStockModalProduct(null)}
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Sub-component for inline branch stock row
function BranchStockRow({ branch, currentStock, onSave }) {
    const [qty, setQty] = useState(currentStock?.quantity ?? 0);
    const [alertThreshold, setAlertThreshold] = useState(currentStock?.low_stock_alert ?? 5);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setQty(currentStock?.quantity ?? 0);
        setAlertThreshold(currentStock?.low_stock_alert ?? 5);
    }, [currentStock]);

    const handleRowSave = async () => {
        await onSave(branch.id, qty, alertThreshold);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const statusBadge =
        Number(qty) <= 0
            ? "bg-danger"
            : Number(qty) <= Number(alertThreshold)
            ? "bg-warning text-dark"
            : "bg-success";

    const statusText =
        Number(qty) <= 0
            ? "Out of Stock"
            : Number(qty) <= Number(alertThreshold)
            ? "Low Stock"
            : "In Stock";

    return (
        <tr>
            <td>
                <div className="fw-semibold text-dark">{branch.branch_name}</div>
                <div className="small text-muted">{branch.city || "Branch"}</div>
            </td>
            <td>
                <input
                    type="number"
                    min="0"
                    className="form-control form-control-sm"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                />
            </td>
            <td>
                <input
                    type="number"
                    min="0"
                    className="form-control form-control-sm"
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(e.target.value)}
                />
            </td>
            <td>
                <span className={`badge ${statusBadge} small`}>{statusText}</span>
            </td>
            <td className="text-end">
                <button
                    type="button"
                    className={`btn btn-sm ${saved ? "btn-success" : "btn-primary"} px-3`}
                    onClick={handleRowSave}
                >
                    {saved ? "Saved" : "Update"}
                </button>
            </td>
        </tr>
    );
}
