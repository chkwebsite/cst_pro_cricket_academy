"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    ArrowRight,
    Check,
    CheckCircle2,
    Filter,
    MapPin,
    Package,
    Search,
    SearchSlash,
    ShoppingBag,
    ShoppingCart,
    SlidersHorizontal,
    Star,
    Tag,
} from "lucide-react";
import { useCart } from "../components/cart/CartContext";

export default function ShopPage() {
    const { addToCart } = useCart();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [sortBy, setSortBy] = useState("featured");
    const [addedId, setAddedId] = useState(null);

    // Load categories and products
    useEffect(() => {
        let cancelled = false;

        async function loadStore() {
            setLoading(true);
            setError(null);
            try {
                const [pRes, cRes] = await Promise.all([
                    fetch("/api/products?status=1"),
                    fetch("/api/product-categories?status=1"),
                ]);
                const pJson = await pRes.json();
                const cJson = await cRes.json();

                if (!cancelled) {
                    if (pRes.ok && pJson.success) setProducts(pJson.data || []);
                    if (cRes.ok && cJson.success) setCategories(cJson.data || []);
                }
            } catch (err) {
                if (!cancelled) setError("Failed to load store products. Please try again.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadStore();
        return () => { cancelled = true; };
    }, []);

    // Filter & Sort
    const filteredProducts = useMemo(() => {
        let result = [...products];

        // Category filter
        if (selectedCategory !== "all") {
            result = result.filter((p) => String(p.category_id) === String(selectedCategory));
        }

        // Search filter
        if (search.trim()) {
            const query = search.trim().toLowerCase();
            result = result.filter(
                (p) =>
                    p.product_name?.toLowerCase().includes(query) ||
                    p.product_code?.toLowerCase().includes(query) ||
                    p.category_name?.toLowerCase().includes(query)
            );
        }

        // Sorting
        if (sortBy === "price-low") {
            result.sort((a, b) => Number(a.sale_price ?? a.price) - Number(b.sale_price ?? b.price));
        } else if (sortBy === "price-high") {
            result.sort((a, b) => Number(b.sale_price ?? b.price) - Number(a.sale_price ?? a.price));
        } else if (sortBy === "name-asc") {
            result.sort((a, b) => a.product_name.localeCompare(b.product_name));
        }

        return result;
    }, [products, selectedCategory, search, sortBy]);

    // Handle quick add to cart
    const handleQuickAdd = (p, e) => {
        e.preventDefault();
        e.stopPropagation();
        const success = addToCart(p, 1);
        if (success) {
            setAddedId(p.id);
            setTimeout(() => setAddedId(null), 1800);
        }
    };

    return (
        <div className="shop-page py-5" style={{ background: "#f8fbfb", minHeight: "80vh" }}>
            <div className="container">
                {/* Store Header Banner */}
                <div
                    className="p-4 p-md-5 rounded-4 mb-4 text-white position-relative overflow-hidden shadow-lg"
                    style={{
                        background: "linear-gradient(135deg, #062f38 0%, #0d4b57 100%)",
                        border: "1px solid rgba(164, 255, 0, 0.2)",
                    }}
                >
                    <div className="row align-items-center position-relative" style={{ zIndex: 2 }}>
                        <div className="col-lg-8">
                            <span
                                className="badge px-3 py-1 mb-2 fw-bold text-uppercase"
                                style={{ background: "var(--lime)", color: "var(--navy)" }}
                            >
                                CST Pro Store
                            </span>
                            <h1 className="fw-bold mb-2 text-white font-oswald text-uppercase display-5">
                                Official Cricket Gear & Equipment
                            </h1>
                            <p className="lead mb-0 text-white-50" style={{ maxWidth: "600px", fontSize: "1.05rem" }}>
                                Professional bats, balls, protective gear, training kits and official academy merchandise chosen by coaches.
                            </p>
                        </div>
                        <div className="col-lg-4 text-lg-end mt-3 mt-lg-0">
                            <div className="d-inline-flex align-items-center gap-3 p-3 rounded-3 bg-white bg-opacity-10 border border-white border-opacity-25">
                                <ShoppingBag size={32} style={{ color: "var(--lime)" }} />
                                <div className="text-start">
                                    <div className="fw-bold text-white fs-6">100% Genuine Gear</div>
                                    <div className="text-white-50 small">Academy Pickup & Delivery</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters & Search Row */}
                <div className="bg-white p-3 rounded-4 shadow-sm border mb-4">
                    <div className="row g-3 align-items-center">
                        {/* Search Input */}
                        <div className="col-md-5">
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0">
                                    <Search size={16} className="text-muted" />
                                </span>
                                <input
                                    type="text"
                                    className="form-control border-start-0"
                                    placeholder="Search bats, balls, kits, pads..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                {search && (
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        onClick={() => setSearch("")}
                                    >
                                        <X size={15} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Sort Selector */}
                        <div className="col-md-4 col-sm-6 ms-auto">
                            <div className="d-flex align-items-center gap-2 justify-content-md-end">
                                <label className="text-muted small text-nowrap d-none d-sm-inline">Sort by:</label>
                                <select
                                    className="form-select form-select-sm"
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    style={{ maxWidth: "180px" }}
                                >
                                    <option value="featured">Featured Items</option>
                                    <option value="price-low">Price: Low to High</option>
                                    <option value="price-high">Price: High to Low</option>
                                    <option value="name-asc">Name: A to Z</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Category Filter Pills */}
                    <div className="d-flex align-items-center gap-2 overflow-x-auto pt-3 mt-3 border-top pb-1">
                        <button
                            type="button"
                            className={`btn btn-sm rounded-pill px-3 text-nowrap fw-semibold ${
                                selectedCategory === "all" ? "btn-dark" : "btn-light border"
                            }`}
                            onClick={() => setSelectedCategory("all")}
                        >
                            All Products ({products.length})
                        </button>
                        {categories.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                className={`btn btn-sm rounded-pill px-3 text-nowrap fw-semibold ${
                                    String(selectedCategory) === String(c.id) ? "btn-dark" : "btn-light border"
                                }`}
                                onClick={() => setSelectedCategory(String(c.id))}
                            >
                                {c.category_name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Product Grid */}
                {loading ? (
                    <div className="text-center py-5">
                        <div className="spinner-border text-success" role="status" />
                        <p className="text-muted mt-2 small">Loading pro store products...</p>
                    </div>
                ) : error ? (
                    <div className="alert alert-danger text-center py-4">{error}</div>
                ) : filteredProducts.length === 0 ? (
                    <div className="text-center py-5 bg-white rounded-4 border p-5">
                        <Package size={56} className="text-muted opacity-50 mb-3" />
                        <h4 className="fw-bold text-dark font-oswald text-uppercase">No Products Found</h4>
                        <p className="text-muted small mb-3">
                            {search || selectedCategory !== "all"
                                ? "No products matched your search or category filter."
                                : "The store catalogue is currently being updated. Please check back soon."}
                        </p>
                        <button
                            type="button"
                            className="btn btn-outline-success btn-sm px-4"
                            onClick={() => { setSearch(""); setSelectedCategory("all"); }}
                        >
                            Reset Store Filters
                        </button>
                    </div>
                ) : (
                    <div className="row g-4">
                        {filteredProducts.map((p) => {
                            const regularPrice = Number(p.price || 0);
                            const salePrice = p.sale_price !== null && p.sale_price !== undefined ? Number(p.sale_price) : null;
                            const effectivePrice = salePrice ?? regularPrice;
                            const hasDiscount = salePrice && salePrice < regularPrice;
                            const discountPercent = hasDiscount
                                ? Math.round(((regularPrice - salePrice) / regularPrice) * 100)
                                : 0;

                            const isAdded = addedId === p.id;
                            const isOutOfStock = p.total_stock !== undefined && Number(p.total_stock) <= 0;

                            return (
                                <div key={p.id} className="col-12 col-sm-6 col-md-4 col-lg-3">
                                    <div className="card h-100 border-0 rounded-4 shadow-sm overflow-hidden transition-card position-relative bg-white">
                                        {/* Stock / Discount Badges */}
                                        <div className="position-absolute top-0 start-0 m-3 d-flex flex-column gap-1" style={{ zIndex: 2 }}>
                                            {isOutOfStock ? (
                                                <span className="badge bg-danger rounded-pill fw-bold shadow-sm">
                                                    Out of Stock
                                                </span>
                                            ) : hasDiscount ? (
                                                <span
                                                    className="badge rounded-pill fw-bold shadow-sm"
                                                    style={{ background: "#e53935", color: "#fff" }}
                                                >
                                                    -{discountPercent}%
                                                </span>
                                            ) : null}
                                        </div>

                                        {/* Product Image Link */}
                                        <Link
                                            href={`/shop/${p.slug || p.id}`}
                                            className="d-block overflow-hidden position-relative bg-light text-center"
                                            style={{ height: "230px" }}
                                        >
                                            {p.primary_image || p.category_image ? (
                                                <img
                                                    src={(p.primary_image || p.category_image).trim()}
                                                    alt={p.product_name}
                                                    className="w-100 h-100 object-fit-contain p-2 transition-zoom"
                                                />
                                            ) : (
                                                <div className="w-100 h-100 d-flex flex-column align-items-center justify-content-center text-muted">
                                                    <Package size={48} className="opacity-40 mb-2" />
                                                    <span className="small opacity-60">Pro Equipment</span>
                                                </div>
                                            )}
                                        </Link>

                                        {/* Card Body */}
                                        <div className="card-body p-3 d-flex flex-column">
                                            {/* Category Tag */}
                                            <div className="mb-1">
                                                <span
                                                    className="badge px-2 py-1 rounded-pill small"
                                                    style={{ background: "#e0f2f1", color: "#004d40", fontSize: "0.7rem" }}
                                                >
                                                    {p.category_name || "Store Item"}
                                                </span>
                                            </div>

                                            {/* Product Title */}
                                            <h6 className="fw-bold mb-1">
                                                <Link
                                                    href={`/shop/${p.slug || p.id}`}
                                                    className="text-dark text-decoration-none hover-teal text-truncate-2"
                                                    style={{ lineHeight: "1.3" }}
                                                >
                                                    {p.product_name}
                                                </Link>
                                            </h6>

                                            {/* Branch Availability */}
                                            {p.available_branches && (
                                                <div
                                                    className="extra-small text-muted mb-2 d-flex align-items-center gap-1 text-truncate"
                                                    style={{ fontSize: "0.72rem" }}
                                                    title={`Available at: ${p.available_branches}`}
                                                >
                                                    <MapPin size={11} className="text-danger flex-shrink-0" />
                                                    <span className="text-truncate">{p.available_branches}</span>
                                                </div>
                                            )}

                                            {/* Pricing & Add to Cart button */}
                                            <div className="mt-auto pt-2 border-top d-flex align-items-center justify-content-between">
                                                <div>
                                                    <div className="fw-bold text-dark fs-5 font-oswald">
                                                        ₹{effectivePrice.toLocaleString("en-IN")}
                                                    </div>
                                                    {hasDiscount && (
                                                        <div className="text-muted small text-decoration-line-through">
                                                            ₹{regularPrice.toLocaleString("en-IN")}
                                                        </div>
                                                    )}
                                                </div>

                                                {isOutOfStock ? (
                                                    <span className="badge bg-secondary-subtle text-muted rounded-pill px-3 py-1.5 small">
                                                        Sold Out
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className={`btn btn-sm d-flex align-items-center gap-1 rounded-pill px-3 shadow-sm transition ${
                                                            isAdded ? "btn-success" : "btn-dark"
                                                        }`}
                                                        onClick={(e) => handleQuickAdd(p, e)}
                                                    >
                                                        {isAdded ? (
                                                            <>
                                                                <Check size={14} />
                                                                <span>Added</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ShoppingCart size={14} />
                                                                <span>Add</span>
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
