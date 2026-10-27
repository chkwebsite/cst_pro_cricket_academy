"use client";

import Link from "next/link";
import {
    ArrowLeft,
    ArrowRight,
    Lock,
    Minus,
    Plus,
    RotateCcw,
    ShieldCheck,
    ShoppingBag,
    ShoppingCart,
    Trash2,
    Truck,
} from "lucide-react";
import { useCart } from "../components/cart/CartContext";
import { useUser } from "@/app/next_panel/components/UserContext";

export default function CartPage() {
    const { isLoggedIn, user } = useUser();
    const {
        items,
        itemCount,
        subtotal,
        taxTotal,
        grandTotal,
        updateQuantity,
        removeFromCart,
        clearCart,
    } = useCart();

    const deliveryFee = subtotal > 1500 || subtotal === 0 ? 0 : 99;
    const finalAmount = grandTotal + deliveryFee;

    if (!isLoggedIn || !user) {
        return (
            <div className="bg-cream min-vh-100 py-5">
                <div className="container py-4">
                    <div className="row justify-content-center">
                        <div className="col-12 col-md-8 col-lg-6 text-center">
                            <div className="bg-white rounded-4 shadow-sm border p-4 p-md-5">
                                <div
                                    className="rounded-circle d-inline-flex align-items-center justify-content-center bg-light text-navy mb-3"
                                    style={{ width: "70px", height: "70px" }}
                                >
                                    <Lock size={32} className="text-danger" />
                                </div>
                                <h3 className="fw-bold text-navy mb-2 display-font">SIGN IN TO ACCESS CART</h3>
                                <p className="text-secondary small mb-4">
                                    Shopping cart and checkout features are available exclusively for logged-in users. Please sign in to view your cart items or add gear.
                                </p>
                                <div className="d-flex flex-wrap justify-content-center gap-2">
                                    <Link href="/login?tab=public&redirect=/cart" className="btn btn-navy px-4 py-2 rounded-pill fw-semibold">
                                        Sign In as Public User
                                    </Link>
                                    <Link href="/login?tab=academy&redirect=/cart" className="btn btn-outline-dark px-4 py-2 rounded-pill fw-semibold">
                                        Academy Member Sign In
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-cream min-vh-100 py-5">
            <div className="container py-3">
                {/* Header breadcrumb */}
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
                    <div>
                        <div className="d-flex align-items-center gap-2 small text-muted mb-1">
                            <Link href="/shop" className="text-decoration-none text-muted d-flex align-items-center gap-1 hover-navy">
                                <ArrowLeft size={14} /> Back to Store
                            </Link>
                            <span>/</span>
                            <span className="text-navy fw-semibold">Shopping Cart</span>
                        </div>
                        <h2 className="display-font fw-bold text-navy mb-0">SHOPPING CART</h2>
                    </div>

                    {items.length > 0 && (
                        <button
                            type="button"
                            onClick={clearCart}
                            className="btn btn-outline-danger btn-sm rounded-pill px-3 py-1.5 fw-semibold d-flex align-items-center gap-1.5"
                        >
                            <Trash2 size={14} /> Clear Cart
                        </button>
                    )}
                </div>

                {items.length === 0 ? (
                    /* Empty State */
                    <div className="card border-0 shadow-sm rounded-4 p-5 text-center my-4 bg-white">
                        <div
                            className="rounded-circle d-inline-flex align-items-center justify-content-center mx-auto mb-3"
                            style={{
                                width: "90px",
                                height: "90px",
                                background: "rgba(10, 25, 47, 0.05)",
                                color: "var(--navy)",
                            }}
                        >
                            <ShoppingCart size={42} strokeWidth={1.5} />
                        </div>
                        <h3 className="fw-bold text-navy mb-2 display-font">YOUR CART IS EMPTY</h3>
                        <p className="text-muted small mx-auto mb-4" style={{ maxWidth: "420px" }}>
                            Looks like you haven&apos;t added any cricket gear or academy merchandise to your cart yet.
                        </p>
                        <div>
                            <Link
                                href="/shop"
                                className="btn btn-navy px-4 py-2.5 rounded-pill fw-semibold d-inline-flex align-items-center gap-2 shadow-sm"
                            >
                                <ShoppingBag size={18} /> Explore CST Cricket Store
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="row g-4">
                        {/* Cart Items List */}
                        <div className="col-12 col-lg-8">
                            <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-3">
                                <div className="card-header bg-white border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
                                    <span className="fw-bold text-navy">Items in Cart ({itemCount})</span>
                                    <span className="small text-muted">Price</span>
                                </div>

                                <div className="divide-y">
                                    {items.map((item) => {
                                        const unitPrice = Number(item.sale_price ?? item.price ?? 0);
                                        const itemTotal = unitPrice * Number(item.quantity || 1);

                                        return (
                                            <div
                                                key={item.product_id}
                                                className="p-3 p-md-4 border-bottom d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3"
                                            >
                                                {/* Left: Image & Name */}
                                                <div className="d-flex align-items-center gap-3">
                                                    <div
                                                        className="rounded-3 overflow-hidden bg-light border flex-shrink-0 d-flex align-items-center justify-content-center"
                                                        style={{ width: "80px", height: "80px" }}
                                                    >
                                                        {item.image ? (
                                                            <img
                                                                src={item.image}
                                                                alt={item.product_name}
                                                                className="w-100 h-100 object-fit-cover"
                                                            />
                                                        ) : (
                                                            <ShoppingBag size={28} className="text-muted" />
                                                        )}
                                                    </div>

                                                    <div>
                                                        <Link
                                                            href={`/shop/${item.slug || `product-${item.product_id}`}`}
                                                            className="text-decoration-none fw-bold text-navy d-block mb-1 hover-teal"
                                                        >
                                                            {item.product_name}
                                                        </Link>
                                                        {item.product_code && (
                                                            <div className="small text-muted mb-1">
                                                                SKU: <span className="fw-semibold">{item.product_code}</span>
                                                            </div>
                                                        )}
                                                        <div className="d-flex align-items-center gap-2 small">
                                                            <span className="fw-bold text-navy">
                                                                ₹{unitPrice.toLocaleString("en-IN")}
                                                            </span>
                                                            {item.sale_price && (
                                                                <span className="text-muted text-decoration-line-through">
                                                                    ₹{Number(item.price).toLocaleString("en-IN")}
                                                                </span>
                                                            )}
                                                            {item.tax_percent > 0 && (
                                                                <span className="badge bg-light text-muted border">
                                                                    +{item.tax_percent}% GST
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right: Quantity Stepper & Subtotal */}
                                                <div className="d-flex align-items-center justify-content-between justify-content-sm-end gap-3 mt-2 mt-sm-0">
                                                    <div className="d-flex align-items-center border rounded-pill bg-light p-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                                                            className="btn btn-sm btn-light rounded-circle p-1 d-flex align-items-center justify-content-center"
                                                            style={{ width: "28px", height: "28px" }}
                                                            aria-label="Decrease quantity"
                                                        >
                                                            <Minus size={14} />
                                                        </button>
                                                        <span
                                                            className="px-3 fw-bold small text-navy text-center"
                                                            style={{ minWidth: "36px" }}
                                                        >
                                                            {item.quantity}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                                                            className="btn btn-sm btn-light rounded-circle p-1 d-flex align-items-center justify-content-center"
                                                            style={{ width: "28px", height: "28px" }}
                                                            aria-label="Increase quantity"
                                                        >
                                                            <Plus size={14} />
                                                        </button>
                                                    </div>

                                                    <div className="text-end" style={{ minWidth: "85px" }}>
                                                        <div className="fw-bold text-navy">
                                                            ₹{itemTotal.toLocaleString("en-IN")}
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => removeFromCart(item.product_id)}
                                                        className="btn btn-outline-danger btn-sm rounded-circle p-1.5 d-flex align-items-center justify-content-center"
                                                        title="Remove product"
                                                        aria-label="Remove item"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="p-3 bg-light d-flex flex-wrap justify-content-between align-items-center gap-2">
                                    <Link
                                        href="/shop"
                                        className="btn btn-outline-navy btn-sm rounded-pill px-3 py-1.5 fw-semibold d-inline-flex align-items-center gap-1"
                                    >
                                        <ArrowLeft size={14} /> Continue Shopping
                                    </Link>
                                    <div className="small text-muted">
                                        Free shipping on orders above ₹1,500
                                    </div>
                                </div>
                            </div>

                            {/* Trust badges strip */}
                            <div className="row g-2 text-center">
                                <div className="col-12 col-md-4">
                                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                                        <div className="text-success mb-2">
                                            <ShieldCheck size={24} className="mx-auto" />
                                        </div>
                                        <div className="fw-bold text-navy small">100% Genuine Gear</div>
                                        <div className="text-muted extra-small" style={{ fontSize: "0.75rem" }}>
                                            Direct from official academy manufacturers
                                        </div>
                                    </div>
                                </div>
                                <div className="col-12 col-md-4">
                                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                                        <div className="text-info mb-2">
                                            <Truck size={24} className="mx-auto" />
                                        </div>
                                        <div className="fw-bold text-navy small">Fast Delivery / Pickup</div>
                                        <div className="text-muted extra-small" style={{ fontSize: "0.75rem" }}>
                                            Home shipping or collect at any branch
                                        </div>
                                    </div>
                                </div>
                                <div className="col-12 col-md-4">
                                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                                        <div className="text-warning mb-2">
                                            <RotateCcw size={24} className="mx-auto" />
                                        </div>
                                        <div className="fw-bold text-navy small">Easy Exchanges</div>
                                        <div className="text-muted extra-small" style={{ fontSize: "0.75rem" }}>
                                            Hassle-free sizing exchanges at branches
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Order Summary Sidebar */}
                        <div className="col-12 col-lg-4">
                            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white sticky-top" style={{ top: "100px" }}>
                                <h4 className="fw-bold text-navy mb-3 display-font">ORDER SUMMARY</h4>

                                <div className="d-flex justify-content-between py-2 border-bottom">
                                    <span className="text-muted">Subtotal ({itemCount} items)</span>
                                    <span className="fw-semibold text-navy">₹{subtotal.toLocaleString("en-IN")}</span>
                                </div>

                                <div className="d-flex justify-content-between py-2 border-bottom">
                                    <span className="text-muted">Estimated Tax / GST</span>
                                    <span className="fw-semibold text-navy">
                                        {taxTotal > 0 ? `₹${Math.round(taxTotal).toLocaleString("en-IN")}` : "Included"}
                                    </span>
                                </div>

                                <div className="d-flex justify-content-between py-2 border-bottom">
                                    <span className="text-muted">Estimated Shipping</span>
                                    <span className="fw-semibold text-navy">
                                        {deliveryFee === 0 ? (
                                            <span className="text-success fw-bold">FREE</span>
                                        ) : (
                                            `₹${deliveryFee}`
                                        )}
                                    </span>
                                </div>

                                <div className="d-flex justify-content-between py-3 my-2 border-bottom">
                                    <span className="fw-bold text-navy fs-5">Total Amount</span>
                                    <span className="fw-bold text-navy fs-5">
                                        ₹{Math.round(finalAmount).toLocaleString("en-IN")}
                                    </span>
                                </div>

                                <div className="small text-muted mb-4">
                                    Final shipping &amp; delivery charges are confirmed at checkout based on selected branch or destination address.
                                </div>

                                <Link
                                    href="/checkout"
                                    className="btn btn-navy w-100 py-3 rounded-pill fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm text-uppercase"
                                    style={{ letterSpacing: "0.5px" }}
                                >
                                    Proceed to Checkout <ArrowRight size={18} />
                                </Link>

                                <div className="mt-3 text-center">
                                    <span className="small text-muted d-inline-flex align-items-center gap-1">
                                        <ShieldCheck size={14} className="text-success" />
                                        Safe &amp; Secure 256-bit Encrypted Checkout
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
