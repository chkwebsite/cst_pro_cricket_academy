"use client";

import {
    AlertTriangle,
    CheckCircle2,
    Edit,
    Layers,
    Package,
    Plus,
    RefreshCw,
    Search,
    SearchSlash,
    Sliders,
    XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import Pagination from "../components/Pagination";

export default function ProductStockPage() {
    const [stockList, setStockList] = useState([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const [branches, setBranches] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    // Filters
    const [search, setSearch] = useState("");
    const [branchFilter, setBranchFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [reloadCount, setReloadCount] = useState(0);

    // Edit Modal state
    const [editingItem, setEditingItem] = useState(null);
    const [quantityInput, setQuantityInput] = useState(0);
    const [lowStockInput, setLowStockInput] = useState(5);
    const [saving, setSaving] = useState(false);

    // Add Stock Modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [newProductId, setNewProductId] = useState("");
    const [newBranchId, setNewBranchId] = useState("");
    const [newQuantity, setNewQuantity] = useState(20);
    const [newLowStock, setNewLowStock] = useState(5);
    const [adding, setAdding] = useState(false);

    // Load options (branches & products)
    useEffect(() => {
        (async () => {
            try {
                const [brRes, prRes] = await Promise.all([
                    fetch("/api/branch"),
                    fetch("/api/products"),
                ]);
                const brJson = await brRes.json();
                const prJson = await prRes.json();
                if (brRes.ok && brJson.success) setBranches(brJson.data || []);
                if (prRes.ok && prJson.success) setProducts(prJson.data || []);
            } catch {
                /* non-fatal */
            }
        })();
    }, []);

    // Load Stock
    useEffect(() => {
        let cancelled = false;

        async function fetchStock() {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (search.trim()) params.set("search", search.trim());
                if (branchFilter) params.set("branch_id", branchFilter);
                if (statusFilter) params.set("stock_status", statusFilter);

                const res = await fetch(`/api/product-stock?${params.toString()}`);
                const json = await res.json();

                if (!res.ok || !json.success) throw new Error(json.message || "Failed to load stock.");

                if (!cancelled) setStockList(json.data || []);
            } catch (err) {
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchStock();
        return () => { cancelled = true; };
    }, [search, branchFilter, statusFilter, reloadCount]);

    useEffect(() => {
        setPage(1);
    }, [search, branchFilter, statusFilter]);

    const totalPages = Math.ceil(stockList.length / PAGE_SIZE) || 1;
    const pagedStock = stockList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // KPI Metrics
    const inStockCount = stockList.filter((s) => s.stock_status === "In Stock").length;
    const lowStockCount = stockList.filter((s) => s.stock_status === "Low Stock").length;
    const outOfStockCount = stockList.filter((s) => s.stock_status === "Out of Stock").length;

    // Open Edit Modal
    const handleOpenEdit = (item) => {
        setEditingItem(item);
        setQuantityInput(item.quantity ?? 0);
        setLowStockInput(item.low_stock_alert ?? 5);
    };

    // Save Stock Update
    const handleSaveStock = async (e) => {
        e.preventDefault();
        if (!editingItem) return;
        setSaving(true);

        try {
            const res = await fetch(`/api/product-stock/${editingItem.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    quantity: Number(quantityInput),
                    low_stock_alert: Number(lowStockInput),
                }),
            });
            const json = await res.json();

            if (!res.ok || !json.success) throw new Error(json.message || "Failed to update stock.");

            setNotice(`Stock updated for "${editingItem.product_name}".`);
            setTimeout(() => setNotice(null), 3500);
            setEditingItem(null);
            setReloadCount((c) => c + 1);
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    // Create / Allocate New Stock
    const handleCreateStock = async (e) => {
        e.preventDefault();
        if (!newProductId || !newBranchId) {
            alert("Please select both product and branch.");
            return;
        }

        setAdding(true);
        try {
            const res = await fetch("/api/product-stock", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    product_id: Number(newProductId),
                    branch_id: Number(newBranchId),
                    quantity: Number(newQuantity),
                    low_stock_alert: Number(newLowStock),
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to allocate stock.");

            setNotice("Stock entry created/updated successfully.");
            setTimeout(() => setNotice(null), 3500);
            setShowAddModal(false);
            setReloadCount((c) => c + 1);
        } catch (err) {
            alert(err.message);
        } finally {
            setAdding(false);
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
                            style={{ background: "#e1f5fe", color: "#0277bd" }}
                        >
                            <Layers size={24} />
                        </div>
                        <div>
                            <h3 className="mb-0 fw-bold text-dark">Branch Inventory & Stock</h3>
                            <p className="text-muted small mb-0">
                                Monitor product quantities across all academy branch stores, low stock alerts, and reserves.
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
                            className="btn btn-primary d-flex align-items-center gap-1 px-3"
                            onClick={() => setShowAddModal(true)}
                        >
                            <Plus size={18} />
                            <span>Allocate Stock</span>
                        </button>
                    </div>
                </div>

                {/* KPI Metrics */}
                <div className="row g-3 mt-3 pt-3 border-top">
                    <div className="col-6 col-md-3">
                        <div className="p-3 rounded-3 bg-light border d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small fw-medium">Total Inventory Entries</div>
                                <div className="fs-4 fw-bold text-dark">{stockList.length}</div>
                            </div>
                            <Layers className="text-primary opacity-75" size={26} />
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="p-3 rounded-3 bg-light border d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small fw-medium">Healthy Stock</div>
                                <div className="fs-4 fw-bold text-success">{inStockCount}</div>
                            </div>
                            <CheckCircle2 className="text-success opacity-75" size={26} />
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="p-3 rounded-3 bg-light border d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small fw-medium">Low Stock Warning</div>
                                <div className="fs-4 fw-bold text-warning">{lowStockCount}</div>
                            </div>
                            <AlertTriangle className="text-warning opacity-75" size={26} />
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="p-3 rounded-3 bg-light border d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small fw-medium">Out of Stock</div>
                                <div className="fs-4 fw-bold text-danger">{outOfStockCount}</div>
                            </div>
                            <XCircle className="text-danger opacity-75" size={26} />
                        </div>
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
                                placeholder="Search product name or code..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <select
                            className="form-select"
                            value={branchFilter}
                            onChange={(e) => setBranchFilter(e.target.value)}
                            style={{ maxWidth: "200px" }}
                        >
                            <option value="">All Branches</option>
                            {branches.map((b) => (
                                <option key={b.id} value={b.id}>{b.branch_name}</option>
                            ))}
                        </select>

                        <select
                            className="form-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{ maxWidth: "160px" }}
                        >
                            <option value="">All Stock Status</option>
                            <option value="In Stock">In Stock</option>
                            <option value="Low Stock">Low Stock</option>
                            <option value="Out of Stock">Out of Stock</option>
                        </select>

                        {(search || branchFilter || statusFilter) && (
                            <button
                                type="button"
                                className="btn btn-outline-secondary d-flex align-items-center gap-1"
                                onClick={() => { setSearch(""); setBranchFilter(""); setStatusFilter(""); }}
                            >
                                <SearchSlash size={16} />
                                <span>Reset</span>
                            </button>
                        )}
                    </div>
                    <div className="text-muted small">
                        Showing <strong>{stockList.length}</strong> items
                    </div>
                </div>
            </div>

            {/* Stock Table */}
            <div className="bg-white rounded-4 shadow-sm border overflow-hidden">
                {loading ? (
                    <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status" />
                        <p className="text-muted small mt-2 mb-0">Loading inventory data...</p>
                    </div>
                ) : stockList.length === 0 ? (
                    <div className="text-center py-5">
                        <Layers size={48} className="text-muted opacity-50 mb-2" />
                        <h5 className="fw-semibold text-secondary">No Stock Records Found</h5>
                        <p className="text-muted small mb-0">
                            Assign product stock to branches from the Products page to manage inventory here.
                        </p>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table align-middle table-hover mb-0">
                            <thead className="table-light text-secondary small text-uppercase">
                                <tr>
                                    <th style={{ width: "50px" }} className="text-center">#</th>
                                    <th>Product</th>
                                    <th>Branch</th>
                                    <th className="text-center">Total Qty</th>
                                    <th className="text-center">Reserved</th>
                                    <th className="text-center">Available</th>
                                    <th className="text-center">Low Stock Alert</th>
                                    <th className="text-center">Stock Status</th>
                                    <th style={{ width: "100px" }} className="text-end pe-3">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedStock.map((item, idx) => {
                                    const badgeClass =
                                        item.stock_status === "Out of Stock"
                                            ? "bg-danger"
                                            : item.stock_status === "Low Stock"
                                            ? "bg-warning text-dark"
                                            : "bg-success";

                                    return (
                                        <tr key={item.id}>
                                            <td className="text-center text-muted small fw-medium">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                                            <td>
                                                <div className="fw-bold text-dark">{item.product_name}</div>
                                                <div className="small text-muted">
                                                    <span>Code: <code>{item.product_code || "—"}</code></span>
                                                    <span className="ms-2">₹{Number(item.sale_price ?? item.price).toLocaleString("en-IN")}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="badge bg-light text-dark border px-2 py-1">
                                                    {item.branch_name}
                                                </span>
                                            </td>
                                            <td className="text-center fw-bold">{item.quantity}</td>
                                            <td className="text-center text-muted">{item.reserved_quantity ?? 0}</td>
                                            <td className="text-center fw-bold fs-6" style={{ color: "#062f38" }}>
                                                {item.available_quantity ?? item.quantity}
                                            </td>
                                            <td className="text-center text-secondary small">{item.low_stock_alert}</td>
                                            <td className="text-center">
                                                <span className={`badge ${badgeClass} px-2 py-1`}>
                                                    {item.stock_status}
                                                </span>
                                            </td>
                                            <td className="text-end pe-3">
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
                                                    onClick={() => handleOpenEdit(item)}
                                                >
                                                    <Edit size={14} />
                                                    <span>Adjust</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        total={stockList.length}
                        onPageChange={setPage}
                        pageSize={PAGE_SIZE}
                    />
                )}
            </div>

            {/* EDIT STOCK MODAL */}
            {editingItem && (
                <div
                    className="modal fade show d-block"
                    tabIndex="-1"
                    style={{ background: "rgba(0,0,0,0.5)" }}
                    onClick={() => setEditingItem(null)}
                >
                    <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
                            <form onSubmit={handleSaveStock}>
                                <div className="modal-header bg-light border-bottom">
                                    <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                                        <Sliders size={20} className="text-primary" />
                                        <span>Adjust Stock</span>
                                    </h5>
                                    <button type="button" className="btn-close" onClick={() => setEditingItem(null)} />
                                </div>

                                <div className="modal-body p-4">
                                    <div className="p-3 mb-3 bg-light rounded-3 border">
                                        <div className="fw-bold text-dark fs-6">{editingItem.product_name}</div>
                                        <div className="text-muted small">
                                            Branch: <strong>{editingItem.branch_name}</strong> • SKU: {editingItem.product_code || "—"}
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-secondary">Current Quantity on Hand *</label>
                                        <input
                                            type="number"
                                            min="0"
                                            className="form-control"
                                            required
                                            value={quantityInput}
                                            onChange={(e) => setQuantityInput(e.target.value)}
                                        />
                                        <div className="form-text small">Total physical inventory units present at this branch.</div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-secondary">Low Stock Warning Threshold</label>
                                        <input
                                            type="number"
                                            min="1"
                                            className="form-control"
                                            value={lowStockInput}
                                            onChange={(e) => setLowStockInput(e.target.value)}
                                        />
                                        <div className="form-text small">Alert triggers when available stock falls below this quantity.</div>
                                    </div>
                                </div>

                                <div className="modal-footer bg-light border-top">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary px-4"
                                        onClick={() => setEditingItem(null)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary px-4"
                                        disabled={saving}
                                    >
                                        {saving ? "Saving..." : "Save Stock"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            {/* Add Stock Modal */}
            {showAddModal && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content rounded-4 border-0 shadow">
                            <div className="modal-header border-bottom">
                                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                                    <Plus className="text-primary" size={20} />
                                    Allocate Product Stock
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setShowAddModal(false)}
                                    disabled={adding}
                                />
                            </div>

                            <form onSubmit={handleCreateStock}>
                                <div className="modal-body p-4">
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-secondary">Product *</label>
                                        <select
                                            className="form-select"
                                            required
                                            value={newProductId}
                                            onChange={(e) => setNewProductId(e.target.value)}
                                            disabled={adding}
                                        >
                                            <option value="">-- Select Product --</option>
                                            {products.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.product_name} ({p.product_code || `ID: ${p.id}`})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-secondary">Branch *</label>
                                        <select
                                            className="form-select"
                                            required
                                            value={newBranchId}
                                            onChange={(e) => setNewBranchId(e.target.value)}
                                            disabled={adding}
                                        >
                                            <option value="">-- Select Branch --</option>
                                            {branches.map((b) => (
                                                <option key={b.id} value={b.id}>
                                                    {b.branch_name} {b.city ? `(${b.city})` : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="row g-2">
                                        <div className="col-12 col-sm-6 mb-3">
                                            <label className="form-label small fw-semibold text-secondary">Initial Quantity *</label>
                                            <input
                                                type="number"
                                                min="0"
                                                className="form-control"
                                                required
                                                value={newQuantity}
                                                onChange={(e) => setNewQuantity(e.target.value)}
                                                disabled={adding}
                                            />
                                        </div>

                                        <div className="col-12 col-sm-6 mb-3">
                                            <label className="form-label small fw-semibold text-secondary">Low Stock Alert *</label>
                                            <input
                                                type="number"
                                                min="1"
                                                className="form-control"
                                                required
                                                value={newLowStock}
                                                onChange={(e) => setNewLowStock(e.target.value)}
                                                disabled={adding}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="modal-footer bg-light border-top">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary px-4"
                                        onClick={() => setShowAddModal(false)}
                                        disabled={adding}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary px-4"
                                        disabled={adding}
                                    >
                                        {adding ? "Allocating..." : "Allocate Stock"}
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
