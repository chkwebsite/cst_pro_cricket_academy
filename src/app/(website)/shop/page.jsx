"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    Check,
    MapPin,
    Package,
    Search,
    ShoppingBag,
    ShoppingCart,
    SlidersHorizontal,
    Sparkles,
    Tag,
    X,
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

    // Category count map
    const categoryCounts = useMemo(() => {
        const counts = {};
        products.forEach((p) => {
            const catId = String(p.category_id);
            counts[catId] = (counts[catId] || 0) + 1;
        });
        return counts;
    }, [products]);

    // Active Category Name
    const selectedCategoryName = useMemo(() => {
        if (selectedCategory === "all") return "All Products";
        const found = categories.find((c) => String(c.id) === String(selectedCategory));
        return found ? found.category_name : "Selected Category";
    }, [selectedCategory, categories]);

    // Filter & Sort Products
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

    // Other related products when a specific category is active
    const relatedOtherProducts = useMemo(() => {
        if (selectedCategory === "all") return [];
        return products
            .filter((p) => String(p.category_id) !== String(selectedCategory))
            .slice(0, 3);
    }, [products, selectedCategory]);

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

    // Product Card Component
    const renderProductCard = (p) => {
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
            <div key={p.id} className="col-12 col-sm-6 col-lg-4">
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
                                className="w-100 h-100 object-fit-contain p-3 transition-zoom"
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

                {/* Main Shop Layout: Left Sidebar + Right Products Grid */}
                <div className="row g-4">
                    {/* LEFT SIDEBAR: Categories List */}
                    <div className="col-lg-3 col-md-4">
                        <div
                            className="card border-0 rounded-4 shadow-sm bg-white p-3 p-lg-4 sticky-md-top"
                            style={{ top: "90px", zIndex: 10 }}
                        >
                            {/* Categories Header */}
                            <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                                <span className="fw-bold text-dark font-oswald text-uppercase fs-6 d-flex align-items-center gap-2">
                                    <SlidersHorizontal size={16} className="text-success" />
                                    Categories
                                </span>
                                <span className="badge bg-light text-muted border rounded-pill">
                                    {categories.length + 1}
                                </span>
                            </div>

                            {/* Category Filter Vertical List */}
                            <div className="d-flex flex-column gap-2">
                                {/* All Products Button */}
                                <button
                                    type="button"
                                    className={`btn text-start d-flex align-items-center justify-content-between py-2.5 px-3 rounded-3 transition ${
                                        selectedCategory === "all"
                                            ? "btn-dark shadow-sm fw-bold text-white"
                                            : "btn-light bg-light border-0 text-dark"
                                    }`}
                                    onClick={() => setSelectedCategory("all")}
                                >
                                    <span className="d-flex align-items-center gap-2 text-truncate">
                                        <Package
                                            size={16}
                                            className={selectedCategory === "all" ? "text-warning" : "text-muted"}
                                        />
                                        <span className="text-truncate">All Products</span>
                                    </span>
                                    <span
                                        className={`badge rounded-pill ${
                                            selectedCategory === "all"
                                                ? "bg-white text-dark"
                                                : "bg-white text-muted border"
                                        }`}
                                    >
                                        {products.length}
                                    </span>
                                </button>

                                {/* Individual Categories */}
                                {categories.map((c) => {
                                    const isSelected = String(selectedCategory) === String(c.id);
                                    const count = categoryCounts[String(c.id)] || 0;

                                    return (
                                        <button
                                            key={c.id}
                                            type="button"
                                            className={`btn text-start d-flex align-items-center justify-content-between py-2.5 px-3 rounded-3 transition ${
                                                isSelected
                                                    ? "btn-dark shadow-sm fw-bold text-white"
                                                    : "btn-light bg-light border-0 text-dark"
                                            }`}
                                            onClick={() => setSelectedCategory(String(c.id))}
                                        >
                                            <span className="d-flex align-items-center gap-2 text-truncate">
                                                <Tag
                                                    size={15}
                                                    className={isSelected ? "text-warning" : "text-muted flex-shrink-0"}
                                                />
                                                <span className="text-truncate" title={c.category_name}>
                                                    {c.category_name}
                                                </span>
                                            </span>
                                            <span
                                                className={`badge rounded-pill ms-2 flex-shrink-0 ${
                                                    isSelected
                                                        ? "bg-white text-dark"
                                                        : "bg-white text-muted border"
                                                }`}
                                            >
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Reset Filters Option */}
                            {(selectedCategory !== "all" || search) && (
                                <div className="pt-3 mt-3 border-top">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary btn-sm w-100 rounded-pill d-flex align-items-center justify-content-center gap-1.5"
                                        onClick={() => {
                                            setSelectedCategory("all");
                                            setSearch("");
                                        }}
                                    >
                                        <X size={14} /> Clear All Filters
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT SIDE: Related Products List */}
                    <div className="col-lg-9 col-md-8">
                        {/* Search Input Box (Shifted above Listing Header) */}
                        <div className="bg-white p-3 rounded-4 shadow-sm border mb-3">
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0 text-muted">
                                    <Search size={16} />
                                </span>
                                <input
                                    type="text"
                                    className="form-control border-start-0 bg-light"
                                    placeholder="Search bats, balls, kits, pads..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                {search && (
                                    <button
                                        type="button"
                                        className="btn btn-light border border-start-0 text-muted"
                                        onClick={() => setSearch("")}
                                        title="Clear search"
                                    >
                                        <X size={15} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Header Row: Active Category title & Sort Selector */}
                        <div className="bg-white p-3 p-md-3.5 rounded-4 shadow-sm border mb-4 d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3">
                            <div>
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                    <h5 className="fw-bold mb-0 font-oswald text-uppercase text-dark">
                                        {selectedCategoryName}
                                    </h5>
                                    <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill">
                                        {filteredProducts.length} {filteredProducts.length === 1 ? "Product" : "Products"}
                                    </span>
                                </div>
                                <p className="text-muted small mb-0 mt-1">
                                    {selectedCategory === "all"
                                        ? "Showing all available cricket gear and training equipment"
                                        : `Showing all related products for ${selectedCategoryName}`}
                                </p>
                            </div>

                            {/* Sort Selector */}
                            <div className="d-flex align-items-center gap-2 ms-sm-auto flex-shrink-0">
                                <label className="text-muted small text-nowrap d-none d-sm-inline">Sort by:</label>
                                <select
                                    className="form-select form-select-sm"
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    style={{ minWidth: "165px" }}
                                >
                                    <option value="featured">Featured Items</option>
                                    <option value="price-low">Price: Low to High</option>
                                    <option value="price-high">Price: High to Low</option>
                                    <option value="name-asc">Name: A to Z</option>
                                </select>
                            </div>
                        </div>

                        {/* Product Grid / Loading / Empty State */}
                        {loading ? (
                            <div className="text-center py-5 bg-white rounded-4 border shadow-sm p-5">
                                <div className="spinner-border text-success" role="status" />
                                <p className="text-muted mt-2 small mb-0">Loading pro store products...</p>
                            </div>
                        ) : error ? (
                            <div className="alert alert-danger text-center py-4 rounded-4 shadow-sm">{error}</div>
                        ) : filteredProducts.length === 0 ? (
                            <div className="text-center py-5 bg-white rounded-4 border p-5 shadow-sm">
                                <Package size={56} className="text-muted opacity-50 mb-3" />
                                <h4 className="fw-bold text-dark font-oswald text-uppercase">No Products Found</h4>
                                <p className="text-muted small mb-3">
                                    {search || selectedCategory !== "all"
                                        ? "No products matched your search or category filter."
                                        : "The store catalogue is currently being updated. Please check back soon."}
                                </p>
                                <button
                                    type="button"
                                    className="btn btn-outline-success btn-sm px-4 rounded-pill"
                                    onClick={() => { setSearch(""); setSelectedCategory("all"); }}
                                >
                                    Reset Filters & View All
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Primary Product Grid */}
                                <div className="row g-3 g-xl-4">
                                    {filteredProducts.map((p) => renderProductCard(p))}
                                </div>

                                {/* Related / Recommended Products when a specific category is selected */}
                                {selectedCategory !== "all" && relatedOtherProducts.length > 0 && (
                                    <div className="mt-5 pt-4 border-top">
                                        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                                            <div>
                                                <h5 className="fw-bold mb-0 font-oswald text-uppercase text-dark d-flex align-items-center gap-2">
                                                    <Sparkles size={16} className="text-warning" />
                                                    Other Related Equipment
                                                </h5>
                                                <p className="text-muted small mb-0">Popular equipment from other categories you might need</p>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-dark rounded-pill px-3"
                                                onClick={() => setSelectedCategory("all")}
                                            >
                                                View All ({products.length})
                                            </button>
                                        </div>
                                        <div className="row g-3 g-xl-4">
                                            {relatedOtherProducts.map((p) => renderProductCard(p))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
