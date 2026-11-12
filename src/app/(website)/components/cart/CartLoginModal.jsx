"use client";

import Link from "next/link";
import { Lock, LogIn, ShoppingBag, UserCheck, UserPlus, X } from "lucide-react";

export default function CartLoginModal({ isOpen, onClose, product = null }) {
    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-60"
                style={{ zIndex: 1070 }}
                onClick={onClose}
            />

            {/* Modal Dialog */}
            <div
                className="position-fixed top-50 start-50 translate-middle w-100 p-3"
                style={{ maxWidth: "480px", zIndex: 1075 }}
            >
                <div className="card border-0 shadow-lg rounded-4 overflow-hidden bg-white text-center">
                    {/* Header Banner */}
                    <div
                        className="p-4 position-relative text-white"
                        style={{
                            background: "linear-gradient(135deg, var(--navy, #062f38) 0%, #0d4653 100%)",
                        }}
                    >
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-link text-white-50 p-1 position-absolute top-0 end-0 m-3 text-decoration-none hover-white"
                            aria-label="Close"
                        >
                            <X size={20} />
                        </button>

                        <div
                            className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3 shadow"
                            style={{
                                width: "68px",
                                height: "68px",
                                background: "rgba(255, 255, 255, 0.12)",
                                border: "2px solid var(--lime, #a4ff00)",
                                color: "var(--lime, #a4ff00)",
                            }}
                        >
                            <Lock size={32} />
                        </div>

                        <h4 className="fw-bold mb-1 display-font text-white" style={{ letterSpacing: "0.5px" }}>
                            SIGN IN REQUIRED
                        </h4>
                        <p className="text-white-50 small mb-0">
                            Please log in to add products to your cart and proceed with shopping.
                        </p>
                    </div>

                    {/* Body */}
                    <div className="p-4">
                        {product && (
                            <div className="p-2.5 mb-3 bg-light rounded-3 border d-flex align-items-center gap-2 text-start">
                                <div
                                    className="rounded bg-white border flex-shrink-0 d-flex align-items-center justify-content-center overflow-hidden"
                                    style={{ width: "42px", height: "42px" }}
                                >
                                    {product.image || product.primary_image ? (
                                        <img
                                            src={(product.image || product.primary_image).trim()}
                                            alt=""
                                            className="w-100 h-100 object-fit-contain"
                                        />
                                    ) : (
                                        <ShoppingBag size={20} className="text-muted" />
                                    )}
                                </div>
                                <div className="min-w-0 flex-grow-1">
                                    <div className="fw-semibold text-dark small text-truncate">
                                        {product.product_name || product.name}
                                    </div>
                                    <div className="text-muted extra-small" style={{ fontSize: "0.75rem" }}>
                                        Item cannot be added without login
                                    </div>
                                </div>
                            </div>
                        )}

                        <p className="text-secondary small mb-4">
                            You must be logged in as an <strong>Academy Player / Coach</strong> or a{" "}
                            <strong>Public Customer</strong> to purchase cricket equipment, gear, and merchandise.
                        </p>

                        {/* Sign In Options */}
                        <div className="d-grid gap-2 mb-3">
                            <Link
                                href="/login?tab=public&redirect=/shop"
                                className="btn btn-navy py-2.5 rounded-pill fw-semibold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                                onClick={onClose}
                            >
                                <LogIn size={16} />
                                <span>Sign In as Public User</span>
                            </Link>

                            <Link
                                href="/login?tab=academy&redirect=/shop"
                                className="btn btn-outline-dark py-2.5 rounded-pill fw-semibold d-flex align-items-center justify-content-center gap-2"
                                onClick={onClose}
                            >
                                <UserCheck size={16} />
                                <span>Academy Member Sign In</span>
                            </Link>
                        </div>

                        {/* Register Link */}
                        <div className="pt-2 border-top small text-muted">
                            Don&apos;t have an account?{" "}
                            <Link
                                href="/register"
                                className="fw-bold text-navy text-decoration-none hover-teal"
                                onClick={onClose}
                            >
                                Create Free Account <UserPlus size={13} className="ms-0.5" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
