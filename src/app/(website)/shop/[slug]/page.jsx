"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    Building2,
    Check,
    CheckCircle2,
    ChevronRight,
    CreditCard,
    Heart,
    MapPin,
    Minus,
    Package,
    Phone,
    Plus,
    RotateCcw,
    Share2,
    ShieldCheck,
    ShoppingCart,
    Star,
    Tag,
    Truck,
} from "lucide-react";
import { useCart } from "../../components/cart/CartContext";

export default function ProductDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { addToCart } = useCart();

    const slug = params?.slug;
    const [product, setProduct] = useState(null);
    const [images, setImages] = useState([]);
    const [selectedImage, setSelectedImage] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [addedNotice, setAddedNotice] = useState(false);

    useEffect(() => {
        if (!slug) return;
        let cancelled = false;

        async function fetchProductData() {
            setLoading(true);
            setError(null);
            try {
                // 1. Direct fetch by slug or ID from /api/products/[id]
                let found = null;
                const directRes = await fetch(`/api/products/${encodeURIComponent(slug)}`);
                const directJson = await directRes.json();

                if (directRes.ok && directJson.success && directJson.data) {
                    found = directJson.data;
                } else {
                    // Fallback to query by slug
                    const res = await fetch(`/api/products?slug=${encodeURIComponent(slug)}`);
                    const json = await res.json();
                    if (res.ok && json.success && json.data && json.data.length > 0) {
                        found = json.data.find((p) => p.slug === slug || String(p.id) === String(slug)) || json.data[0];
                    }
                }

                if (!found) throw new Error("Product not found.");

                // Ensure stocks by branch are loaded
                if (!found.stocks || found.stocks.length === 0) {
                    try {
                        const stockRes = await fetch(`/api/product-stock?product_id=${found.id}`);
                        const stockJson = await stockRes.json();
                        if (stockRes.ok && stockJson.success && Array.isArray(stockJson.data)) {
                            found.stocks = stockJson.data;
                        }
                    } catch {
                        /* ignore */
                    }
                }

                if (!cancelled) {
                    setProduct(found);

                    // Gallery images (already included from direct API or fetch via product-images)
                    if (Array.isArray(found.images) && found.images.length > 0) {
                        setImages(found.images);
                        const primary = found.images.find((i) => Number(i.is_primary) === 1) || found.images[0];
                        setSelectedImage(primary.image_path || found.primary_image);
                    } else {
                        try {
                            const imgRes = await fetch(`/api/product-images?product_id=${found.id}`);
                            const imgJson = await imgRes.json();
                            if (imgRes.ok && imgJson.success && imgJson.data?.length > 0) {
                                setImages(imgJson.data);
                                const primary = imgJson.data.find((i) => Number(i.is_primary) === 1) || imgJson.data[0];
                                setSelectedImage(primary.image_path);
                            } else if (found.primary_image) {
                                setSelectedImage(found.primary_image);
                            } else if (found.category_image) {
                                setSelectedImage(found.category_image);
                            }
                        } catch {
                            if (found.primary_image) setSelectedImage(found.primary_image);
                        }
                    }
                }
            } catch (err) {
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchProductData();
        return () => { cancelled = true; };
    }, [slug]);

    const handleAddToCart = () => {
        if (!product) return;
        const success = addToCart(
            {
                ...product,
                image: selectedImage || images[0]?.image_path || null,
            },
            quantity
        );
        if (success) {
            setAddedNotice(true);
            setTimeout(() => setAddedNotice(false), 2500);
        }
    };

    const handleBuyNow = () => {
        if (!product) return;
        const success = addToCart(
            {
                ...product,
                image: selectedImage || images[0]?.image_path || null,
            },
            quantity
        );
        if (success) {
            router.push("/checkout");
        }
    };

    if (loading) {
        return (
            <div className="py-5 text-center" style={{ minHeight: "60vh" }}>
                <div className="spinner-border text-success my-5" role="status" />
                <p className="text-muted small">Loading product details...</p>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="container py-5 text-center" style={{ minHeight: "60vh" }}>
                <div className="bg-white p-5 rounded-4 shadow-sm border max-w-500 mx-auto">
                    <Package size={52} className="text-muted opacity-50 mb-3" />
                    <h4 className="fw-bold text-dark font-oswald text-uppercase">Product Not Found</h4>
                    <p className="text-muted small mb-4">
                        The requested item may have been moved or is currently unavailable in the store.
                    </p>
                    <Link href="/shop" className="btn btn-dark px-4 rounded-pill">
                        <ArrowLeft size={16} className="me-1" />
                        Return to Store
                    </Link>
                </div>
            </div>
        );
    }

    const regularPrice = Number(product.price || 0);
    const salePrice = product.sale_price !== null && product.sale_price !== undefined ? Number(product.sale_price) : null;
    const effectivePrice = salePrice ?? regularPrice;
    const hasDiscount = salePrice && salePrice < regularPrice;
    const discountPercent = hasDiscount ? Math.round(((regularPrice - salePrice) / regularPrice) * 100) : 0;
    const isOutOfStock = product.total_stock !== undefined && Number(product.total_stock) <= 0;

    const allBranches = Array.isArray(product.stocks) ? product.stocks : [];
    const inStockBranches = allBranches.filter((b) => Number(b.available_quantity ?? b.quantity ?? 0) > 0);

    return (
        <div className="product-detail-page py-4 py-md-5" style={{ background: "#f8fbfb", minHeight: "85vh" }}>
            <div className="container">
                {/* Breadcrumbs */}
                <nav aria-label="breadcrumb" className="mb-4">
                    <ol className="breadcrumb small">
                        <li className="breadcrumb-item">
                            <Link href="/" className="text-muted text-decoration-none">Home</Link>
                        </li>
                        <li className="breadcrumb-item">
                            <Link href="/shop" className="text-muted text-decoration-none">Store</Link>
                        </li>
                        {product.category_name && (
                            <li className="breadcrumb-item">
                                <Link
                                    href={`/shop?category=${product.category_id}`}
                                    className="text-muted text-decoration-none"
                                >
                                    {product.category_name}
                                </Link>
                            </li>
                        )}
                        <li className="breadcrumb-item active text-dark fw-semibold" aria-current="page">
                            {product.product_name}
                        </li>
                    </ol>
                </nav>

                {/* Main Product Section */}
                <div className="bg-white rounded-4 shadow-sm border p-4 p-md-5 mb-5">
                    <div className="row g-4 g-lg-5">
                        {/* Image Gallery Column */}
                        <div className="col-lg-6">
                            <div className="position-sticky" style={{ top: "100px" }}>
                                {/* Main Image Preview */}
                                <div
                                    className="rounded-4 bg-light border p-3 d-flex align-items-center justify-content-center overflow-hidden position-relative mb-3"
                                    style={{ height: "420px" }}
                                >
                                    {hasDiscount && (
                                        <span
                                            className="position-absolute top-0 start-0 m-3 badge rounded-pill fw-bold shadow-sm"
                                            style={{ background: "#e53935", color: "#fff", zIndex: 2 }}
                                        >
                                            Save {discountPercent}%
                                        </span>
                                    )}

                                    {isOutOfStock && (
                                        <span
                                            className="position-absolute top-0 end-0 m-3 badge bg-danger rounded-pill fw-bold shadow-sm px-3 py-1.5"
                                            style={{ zIndex: 2 }}
                                        >
                                            Out of Stock
                                        </span>
                                    )}

                                    {selectedImage ? (
                                        <img
                                            src={selectedImage.trim()}
                                            alt={product.product_name}
                                            className="w-100 h-100 object-fit-contain transition-zoom"
                                        />
                                    ) : (
                                        <div className="text-center text-muted">
                                            <Package size={64} className="opacity-30 mb-2" />
                                            <div className="small opacity-50">Pro Gear Image</div>
                                        </div>
                                    )}
                                </div>

                                {/* Thumbnails */}
                                {images.length > 1 && (
                                    <div className="d-flex align-items-center gap-2 overflow-x-auto pb-2">
                                        {images.map((img) => (
                                            <button
                                                key={img.id}
                                                type="button"
                                                className={`btn p-1 rounded-3 border flex-shrink-0 ${
                                                    selectedImage === img.image_path ? "border-success border-2 shadow-sm" : "opacity-75"
                                                }`}
                                                style={{ width: "70px", height: "70px" }}
                                                onClick={() => setSelectedImage(img.image_path)}
                                            >
                                                <img
                                                    src={img.image_path.trim()}
                                                    alt="Thumbnail"
                                                    className="w-100 h-100 object-fit-cover rounded"
                                                />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Product Info Column */}
                        <div className="col-lg-6 d-flex flex-column">
                            {/* Category & Code */}
                            <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                                <span
                                    className="badge px-3 py-1 rounded-pill small fw-semibold"
                                    style={{ background: "#e0f2f1", color: "#004d40" }}
                                >
                                    {product.category_name || "Official Pro Store"}
                                </span>
                                {product.product_code && (
                                    <span className="text-muted small">
                                        SKU: <code className="text-secondary">{product.product_code}</code>
                                    </span>
                                )}
                                {isOutOfStock ? (
                                    <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2.5 py-1 small ms-auto fw-semibold">
                                        Out of Stock
                                    </span>
                                ) : product.total_stock !== undefined ? (
                                    <span className="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1 small ms-auto fw-semibold d-inline-flex align-items-center gap-1">
                                        <CheckCircle2 size={13} />
                                        In Stock ({product.total_stock} units)
                                    </span>
                                ) : null}
                            </div>

                            {/* Branch Quick Pill */}
                            {inStockBranches.length > 0 ? (
                                <div className="mb-2">
                                    <span className="badge bg-light text-navy border d-inline-flex align-items-center gap-1.5 px-3 py-1.5 rounded-pill small text-wrap text-start">
                                        <MapPin size={13} className="text-danger flex-shrink-0" />
                                        <span>
                                            Available at: <strong className="text-navy">{inStockBranches.map((b) => b.branch_name).join(", ")}</strong>
                                        </span>
                                    </span>
                                </div>
                            ) : allBranches.length > 0 ? (
                                <div className="mb-2">
                                    <span className="badge bg-light text-secondary border d-inline-flex align-items-center gap-1.5 px-3 py-1.5 rounded-pill small text-wrap text-start">
                                        <MapPin size={13} className="text-muted flex-shrink-0" />
                                        <span>Academy Branches: {allBranches.map((b) => b.branch_name).join(", ")}</span>
                                    </span>
                                </div>
                            ) : null}

                            {/* Title */}
                            <h2 className="fw-bold mb-3 text-dark font-oswald text-uppercase" style={{ letterSpacing: "0.5px" }}>
                                {product.product_name}
                            </h2>

                            {/* Ratings Placeholder */}
                            <div className="d-flex align-items-center gap-2 mb-3">
                                <div className="d-flex text-warning">
                                    <Star size={16} fill="currentColor" />
                                    <Star size={16} fill="currentColor" />
                                    <Star size={16} fill="currentColor" />
                                    <Star size={16} fill="currentColor" />
                                    <Star size={16} fill="currentColor" />
                                </div>
                                <span className="small text-muted fw-semibold">4.9 / 5 (Academy Verified)</span>
                            </div>

                            {/* Price Display */}
                            <div className="p-3 rounded-3 bg-light border mb-4">
                                <div className="d-flex align-items-baseline gap-3">
                                    <span className="fs-2 fw-bold text-dark font-oswald">
                                        ₹{effectivePrice.toLocaleString("en-IN")}
                                    </span>
                                    {hasDiscount && (
                                        <span className="fs-5 text-muted text-decoration-line-through">
                                            ₹{regularPrice.toLocaleString("en-IN")}
                                        </span>
                                    )}
                                    {hasDiscount && (
                                        <span className="badge bg-success-subtle text-success border border-success px-2 py-1 small">
                                            Save ₹{(regularPrice - salePrice).toLocaleString("en-IN")}
                                        </span>
                                    )}
                                </div>
                                <div className="text-muted small mt-1">
                                    Inclusive of all taxes ({product.tax_percent || 0}% GST applied at checkout)
                                </div>
                            </div>

                            {/* Description */}
                            <div className="mb-4">
                                <h6 className="fw-bold text-dark mb-2">Product Overview</h6>
                                <p className="text-secondary" style={{ lineHeight: "1.6" }}>
                                    {product.description ||
                                        "Professional standard cricket equipment engineered for optimal performance, durability, and comfort during rigorous training sessions and match conditions."}
                                </p>
                            </div>

                            {/* Academy Branch Availability Card */}
                            <div className="card border-0 rounded-4 p-3.5 mb-4 shadow-sm" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2.5">
                                    <div className="d-flex align-items-center gap-2">
                                        <div
                                            className="rounded-circle bg-navy text-lime d-flex align-items-center justify-content-center flex-shrink-0"
                                            style={{ width: "32px", height: "32px" }}
                                        >
                                            <MapPin size={16} />
                                        </div>
                                        <div>
                                            <h6 className="fw-bold text-navy mb-0 font-oswald text-uppercase" style={{ letterSpacing: "0.5px" }}>
                                                AVAILABLE ACADEMY BRANCHES
                                            </h6>
                                            <div className="extra-small text-muted">
                                                Branch locations &amp; local stock availability
                                            </div>
                                        </div>
                                    </div>

                                    {inStockBranches.length > 0 && (
                                        <span className="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1 rounded-pill small fw-semibold">
                                            ✓ In Stock at {inStockBranches.length} Branch{inStockBranches.length > 1 ? "es" : ""}
                                        </span>
                                    )}
                                </div>

                                {/* Branch List */}
                                <div className="d-flex flex-column gap-2 mt-2">
                                    {allBranches.length > 0 ? (
                                        allBranches.map((b) => {
                                            const isBranchInStock = Number(b.available_quantity) > 0;
                                            return (
                                                <div
                                                    key={b.branch_id || b.id}
                                                    className={`p-3 rounded-3 border bg-white d-flex flex-wrap align-items-center justify-content-between gap-2 transition-all ${
                                                        isBranchInStock ? "border-success-subtle shadow-xs" : "border-light opacity-75"
                                                    }`}
                                                >
                                                    <div className="d-flex align-items-center gap-2.5 overflow-hidden">
                                                        <div
                                                            className={`rounded-circle p-2 d-flex align-items-center justify-content-center flex-shrink-0 ${
                                                                isBranchInStock ? "bg-light text-navy" : "bg-light text-muted"
                                                            }`}
                                                            style={{ width: "36px", height: "36px" }}
                                                        >
                                                            <Building2 size={18} className={isBranchInStock ? "text-teal" : "text-muted"} />
                                                        </div>
                                                        <div>
                                                            <div className="fw-bold text-navy small mb-0.5">
                                                                {b.branch_name}
                                                            </div>
                                                            <div className="extra-small text-muted d-flex flex-wrap align-items-center gap-1.5">
                                                                {b.city && (
                                                                    <span className="badge bg-light text-secondary border px-1.5 py-0.5" style={{ fontSize: "0.68rem" }}>
                                                                        {b.city}
                                                                    </span>
                                                                )}
                                                                {b.address && <span>{b.address}</span>}
                                                                {b.branch_phone && (
                                                                    <span className="d-inline-flex align-items-center gap-0.5 ms-1">
                                                                        <Phone size={10} /> {b.branch_phone}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="text-end flex-shrink-0">
                                                        {isBranchInStock ? (
                                                            <div className="d-flex flex-column align-items-end">
                                                                <span className="badge bg-success text-white px-2.5 py-1 rounded-pill small fw-bold">
                                                                    Ready for Pickup
                                                                </span>
                                                                <span className="extra-small text-success mt-0.5 fw-semibold" style={{ fontSize: "0.72rem" }}>
                                                                    {b.available_quantity} in stock
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="badge bg-light text-muted border px-2.5 py-1 rounded-pill small">
                                                                Out of Stock
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="p-3 bg-white rounded-3 border text-center text-muted small">
                                            <Package size={20} className="mb-1 opacity-50" />
                                            <div>Stock details for branches are being synced. Available for online delivery.</div>
                                        </div>
                                    )}
                                </div>

                                {/* Branch pickup note */}
                                <div className="mt-2.5 pt-2 border-top extra-small text-muted d-flex align-items-center gap-1.5">
                                    <Truck size={13} className="text-navy flex-shrink-0" />
                                    <span>
                                        Order online and collect within <strong>2 days</strong> via Academy Pickup, or choose doorstep delivery in <strong>12 days</strong>.
                                    </span>
                                </div>
                            </div>

                            {/* Quantity and Actions */}
                            <div className="mt-auto pt-3 border-top">
                                <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
                                    {/* Quantity Stepper */}
                                    <div className="d-flex align-items-center border rounded-pill bg-light p-1">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-white rounded-circle p-1 border-0"
                                            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                            aria-label="Decrease"
                                        >
                                            <Minus size={16} />
                                        </button>
                                        <span className="px-3 fw-bold fs-6">{quantity}</span>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-white rounded-circle p-1 border-0"
                                            onClick={() => setQuantity((q) => q + 1)}
                                            aria-label="Increase"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>

                                    {/* Add to Cart Button */}
                                    <button
                                        type="button"
                                        className={`btn px-4 py-2 rounded-pill fw-semibold d-flex align-items-center gap-2 transition ${
                                            isOutOfStock
                                                ? "btn-secondary opacity-50"
                                                : addedNotice
                                                ? "btn-success"
                                                : "btn-outline-dark"
                                        }`}
                                        onClick={handleAddToCart}
                                        disabled={isOutOfStock}
                                    >
                                        {isOutOfStock ? (
                                            <span>Out of Stock</span>
                                        ) : addedNotice ? (
                                            <>
                                                <Check size={18} />
                                                <span>Added to Cart!</span>
                                            </>
                                        ) : (
                                            <>
                                                <ShoppingCart size={18} />
                                                <span>Add to Cart</span>
                                            </>
                                        )}
                                    </button>

                                    {/* Buy Now Button */}
                                    {!isOutOfStock && (
                                        <button
                                            type="button"
                                            className="btn btn-success px-4 py-2 rounded-pill fw-semibold shadow-sm d-flex align-items-center gap-2"
                                            style={{ background: "#062f38", borderColor: "#062f38" }}
                                            onClick={handleBuyNow}
                                        >
                                            <span>Buy Now</span>
                                        </button>
                                    )}
                                </div>

                                {/* Trust Highlights */}
                                <div className="row g-2 pt-3 border-top text-muted small">
                                    <div className="col-6 d-flex align-items-center gap-2">
                                        <ShieldCheck size={18} className="text-success flex-shrink-0" />
                                        <span>100% Genuine Gear</span>
                                    </div>
                                    <div className="col-6 d-flex align-items-center gap-2">
                                        <Truck size={18} className="text-primary flex-shrink-0" />
                                        <span>Home Delivery / Academy Pickup</span>
                                    </div>
                                    <div className="col-6 d-flex align-items-center gap-2">
                                        <CheckCircle2 size={18} className="text-teal flex-shrink-0" />
                                        <span>Coaches Recommended</span>
                                    </div>
                                    <div className="col-6 d-flex align-items-center gap-2">
                                        <CreditCard size={18} className="text-info flex-shrink-0" />
                                        <span>Cash on Delivery / UPI</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
