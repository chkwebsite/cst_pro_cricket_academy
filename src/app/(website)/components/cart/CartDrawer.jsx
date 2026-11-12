"use client";

import Link from "next/link";
import { ArrowRight, Minus, Package, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useCart } from "./CartContext";
import { useUser } from "@/app/next_panel/components/UserContext";

export default function CartDrawer() {
    const { isLoggedIn, user } = useUser();
    const {
        items,
        itemCount,
        subtotal,
        taxTotal,
        grandTotal,
        drawerOpen,
        setDrawerOpen,
        updateQuantity,
        removeFromCart,
    } = useCart();

    if (!isLoggedIn || !user || !drawerOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50"
                style={{ zIndex: 1060 }}
                onClick={() => setDrawerOpen(false)}
            />

            {/* Offcanvas Drawer */}
            <div
                className="position-fixed top-0 end-0 h-100 bg-white shadow-lg d-flex flex-column"
                style={{
                    width: "100%",
                    maxWidth: "420px",
                    zIndex: 1065,
                    transition: "transform 0.3s ease-in-out",
                }}
            >
                {/* Header */}
                <div className="p-3 border-bottom d-flex align-items-center justify-content-between" style={{ background: "#062f38", color: "#fff" }}>
                    <div className="d-flex align-items-center gap-2">
                        <ShoppingBag size={20} style={{ color: "#a4ff00" }} />
                        <h6 className="mb-0 fw-bold">Your Cart ({itemCount})</h6>
                    </div>
                    <button
                        type="button"
                        className="btn btn-link text-white p-0 text-decoration-none"
                        onClick={() => setDrawerOpen(false)}
                        aria-label="Close cart"
                    >
                        <X size={22} />
                    </button>
                </div>

                {/* Items List */}
                <div className="flex-grow-1 overflow-y-auto p-3">
                    {items.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                            <ShoppingBag size={52} className="opacity-25 mb-3" />
                            <h6 className="fw-semibold text-secondary">Your Cart is Empty</h6>
                            <p className="small mb-4">Explore cricket bats, balls, kits and academy apparel in our store.</p>
                            <Link
                                href="/shop"
                                className="btn btn-outline-success btn-sm px-4"
                                onClick={() => setDrawerOpen(false)}
                            >
                                Browse Pro Shop
                            </Link>
                        </div>
                    ) : (
                        <div className="d-flex flex-column gap-3">
                            {items.map((item) => {
                                const unitPrice = Number(item.sale_price ?? item.price ?? 0);
                                const lineTotal = unitPrice * item.quantity;

                                return (
                                    <div key={item.product_id} className="d-flex gap-3 p-2 rounded-3 border bg-light align-items-center">
                                        {/* Image */}
                                        <div
                                            className="rounded-3 bg-white border flex-shrink-0 d-flex align-items-center justify-content-center overflow-hidden"
                                            style={{ width: "64px", height: "64px" }}
                                        >
                                            {item.image ? (
                                                <img
                                                    src={item.image.trim()}
                                                    alt={item.product_name}
                                                    className="w-100 h-100 object-fit-cover"
                                                />
                                            ) : (
                                                <Package size={28} className="text-muted opacity-50" />
                                            )}
                                        </div>

                                        {/* Details */}
                                        <div className="flex-grow-1 min-w-0">
                                            <div className="fw-bold text-dark text-truncate small">{item.product_name}</div>
                                            <div className="text-muted small">
                                                ₹{unitPrice.toLocaleString("en-IN")} each
                                            </div>

                                            {/* Quantity controls */}
                                            <div className="d-flex align-items-center gap-2 mt-1">
                                                <div className="btn-group btn-group-sm border rounded bg-white" role="group">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-light border-0 py-0 px-2"
                                                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                                                    >
                                                        <Minus size={12} />
                                                    </button>
                                                    <span className="px-2 py-0 small fw-bold d-flex align-items-center">
                                                        {item.quantity}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-light border-0 py-0 px-2"
                                                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                                                    >
                                                        <Plus size={12} />
                                                    </button>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn btn-link text-danger p-0 ms-auto"
                                                    onClick={() => removeFromCart(item.product_id)}
                                                    title="Remove item"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Line Total */}
                                        <div className="text-end fw-bold text-dark small">
                                            ₹{lineTotal.toLocaleString("en-IN")}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Summary */}
                {items.length > 0 && (
                    <div className="p-3 border-top bg-light">
                        <div className="d-flex justify-content-between align-items-center mb-1 small">
                            <span className="text-muted">Subtotal:</span>
                            <span className="fw-semibold text-dark">₹{subtotal.toLocaleString("en-IN")}</span>
                        </div>
                        {taxTotal > 0 && (
                            <div className="d-flex justify-content-between align-items-center mb-2 small">
                                <span className="text-muted">Estimated GST:</span>
                                <span className="fw-semibold text-dark">₹{taxTotal.toLocaleString("en-IN")}</span>
                            </div>
                        )}
                        <div className="d-flex justify-content-between align-items-center mb-3 fs-6">
                            <span className="fw-bold text-dark">Total:</span>
                            <span className="fw-bold" style={{ color: "#062f38", fontSize: "1.2rem" }}>
                                ₹{grandTotal.toLocaleString("en-IN")}
                            </span>
                        </div>

                        <div className="d-grid gap-2">
                            <Link
                                href="/checkout"
                                className="btn btn-success fw-semibold py-2 d-flex align-items-center justify-content-center gap-2 shadow-sm"
                                onClick={() => setDrawerOpen(false)}
                            >
                                <span>Proceed to Checkout</span>
                                <ArrowRight size={16} />
                            </Link>
                            <Link
                                href="/cart"
                                className="btn btn-outline-secondary py-2 small fw-semibold"
                                onClick={() => setDrawerOpen(false)}
                            >
                                View Cart Details
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
