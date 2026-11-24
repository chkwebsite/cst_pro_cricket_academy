"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
    ArrowRight,
    Calendar,
    CheckCircle2,
    Clock,
    Download,
    MapPin,
    Package,
    Phone,
    Printer,
    ShoppingBag,
    Truck,
} from "lucide-react";

function getEstimatedDeliveryDate(createdDate, type = "Pickup") {
    const days = 2; // Academy Branch Pickup ready in 2 days
    const d = createdDate ? new Date(createdDate) : new Date();
    d.setDate(d.getDate() + days);
    return d;
}

function formatDeliveryDate(dateVal) {
    if (!dateVal) return "";
    const d = typeof dateVal === "string" ? new Date(dateVal.includes("T") ? dateVal : dateVal + "T00:00:00") : new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

export default function OrderSuccessPage() {
    const params = useParams();
    const orderNo = params?.order_no ? decodeURIComponent(params.order_no) : "";

    const [order, setOrder] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!orderNo) return;

        // Persist order in browser storage for instant viewing on /orders
        if (typeof window !== "undefined") {
            try {
                const storedOrders = JSON.parse(localStorage.getItem("cst_recent_orders") || "[]");
                if (!storedOrders.includes(orderNo)) {
                    storedOrders.unshift(orderNo);
                    localStorage.setItem("cst_recent_orders", JSON.stringify(storedOrders.slice(0, 25)));
                }
            } catch (_) {}
        }

        let cancelled = false;

        async function fetchOrderDetails() {
            setLoading(true);
            try {
                const res = await fetch(`/api/orders?order_no=${encodeURIComponent(orderNo)}`);
                const json = await res.json();

                if (!cancelled && res.ok && json.success && json.data && json.data.length > 0) {
                    const fetchedOrder = json.data[0];
                    setOrder(fetchedOrder);

                    // Fetch items
                    const itemsRes = await fetch(`/api/order-items?order_id=${fetchedOrder.id}`);
                    const itemsJson = await itemsRes.json();
                    if (!cancelled && itemsRes.ok && itemsJson.success) {
                        setItems(itemsJson.data || []);
                    }
                } else if (!cancelled) {
                    setError("Could not load details for this order.");
                }
            } catch (err) {
                if (!cancelled) setError("Failed to fetch order information.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchOrderDetails();

        return () => {
            cancelled = true;
        };
    }, [orderNo]);

    return (
        <div className="bg-cream min-vh-100 py-5">
            <div className="container py-3" style={{ maxWidth: "860px" }}>
                {/* Success Card Header */}
                <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white text-center mb-4">
                    <div
                        className="rounded-circle d-inline-flex align-items-center justify-content-center mx-auto mb-3"
                        style={{
                            width: "80px",
                            height: "80px",
                            background: "rgba(16, 185, 129, 0.1)",
                            color: "#10b981",
                        }}
                    >
                        <CheckCircle2 size={48} strokeWidth={2} />
                    </div>

                    <h2 className="display-font fw-bold text-navy mb-2">THANK YOU FOR YOUR ORDER!</h2>
                    <p className="text-muted small mb-3">
                        We have received your order and our academy equipment store is preparing your cricket gear.
                    </p>

                    <div className="d-inline-flex align-items-center justify-content-center gap-2 p-2 px-4 rounded-pill bg-light border mb-4">
                        <span className="small text-muted">Order Number:</span>
                        <span className="fw-bold text-navy font-monospace">{orderNo}</span>
                    </div>

                    <div className="d-flex flex-wrap justify-content-center gap-2">
                        <Link
                            href={`/orders?search=${encodeURIComponent(orderNo)}`}
                            className="btn btn-navy px-4 py-2.5 rounded-pill fw-semibold d-inline-flex align-items-center gap-2 shadow-sm"
                        >
                            <Package size={16} /> Track My Orders
                        </Link>
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="btn btn-outline-dark px-4 py-2.5 rounded-pill fw-semibold d-inline-flex align-items-center gap-2"
                        >
                            <Printer size={16} /> Print Receipt
                        </button>
                        <Link
                            href="/shop"
                            className="btn btn-lime text-navy px-4 py-2.5 rounded-pill fw-semibold d-inline-flex align-items-center gap-2"
                        >
                            <ShoppingBag size={16} /> Continue Shopping
                        </Link>
                    </div>
                </div>

                {loading ? (
                    <div className="card border-0 shadow-sm rounded-4 p-5 bg-white text-center">
                        <div className="spinner-border text-navy mb-2" role="status" />
                        <div className="text-muted small">Loading order receipt...</div>
                    </div>
                ) : error ? (
                    <div className="alert alert-warning rounded-4 p-3 small text-center">{error}</div>
                ) : order ? (
                    /* Order Breakdown Card */
                    <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4">
                        <div className="p-4 border-bottom bg-light d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <div>
                                <span className="badge bg-navy text-lime rounded-pill px-3 py-1.5 fw-semibold small me-2">
                                    {order.order_status || "Pending"}
                                </span>
                                <span className="small text-muted">
                                    Placed on: {new Date(order.created_at).toLocaleString()}
                                </span>
                            </div>

                            <div className="small text-muted">
                                Payment: <strong className="text-navy">{order.payment_method}</strong> ({order.payment_status})
                            </div>
                        </div>

                        {/* Delivery / Ready Date Banner */}
                        <div className="p-3.5 px-4 bg-navy text-white d-flex flex-wrap align-items-center justify-content-between gap-3">
                            <div className="d-flex align-items-center gap-3">
                                <div
                                    className="rounded-circle bg-lime text-navy d-flex align-items-center justify-content-center flex-shrink-0"
                                    style={{ width: "42px", height: "42px" }}
                                >
                                    <Package size={22} />
                                </div>
                                <div>
                                    <div className="extra-small text-uppercase fw-bold text-lime" style={{ letterSpacing: "0.5px" }}>
                                        {order.fulfillment_type === "Pickup" ? "Ready for Branch Pickup (+2 Days)" : "Estimated Ready Date"}
                                    </div>
                                    <div className="fs-5 fw-bold text-white mb-0">
                                        {formatDeliveryDate(order.estimated_delivery_date || getEstimatedDeliveryDate(order.created_at, order.fulfillment_type))}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <span className="badge bg-white text-navy px-3 py-1.5 rounded-pill fw-semibold">
                                    ⚡ Free Academy Branch Pickup
                                </span>
                            </div>
                        </div>

                        {/* Customer & Fulfillment Info */}
                        <div className="p-4 border-bottom">
                            <div className="row g-3">
                                <div className="col-12 col-md-6">
                                    <div className="text-muted small mb-1 fw-semibold text-uppercase" style={{ letterSpacing: "0.5px" }}>
                                        Customer Details
                                    </div>
                                    <div className="fw-bold text-navy">{order.customer_name}</div>
                                    <div className="small text-secondary">{order.customer_phone}</div>
                                    {order.customer_email && <div className="small text-secondary">{order.customer_email}</div>}
                                </div>

                                <div className="col-12 col-md-6">
                                    <div className="text-muted small mb-1 fw-semibold text-uppercase" style={{ letterSpacing: "0.5px" }}>
                                        Pickup Academy Branch
                                    </div>
                                    <div className="small text-navy">
                                        <div className="fw-bold fs-6 text-navy mb-0.5">{order.branch_name || "Academy Branch Counter"}</div>
                                        {order.delivery_address && <div className="text-muted">{order.delivery_address}</div>}
                                        <div className="text-success fw-semibold mt-1">
                                            ✓ Collect gear at branch reception by presenting Order No: <span className="font-monospace">{order.order_no}</span>
                                        </div>
                                    </div>

                                    <div className="mt-2.5 pt-2 border-top">
                                        <div className="text-muted extra-small text-uppercase fw-semibold">
                                            Pickup Ready Date:
                                        </div>
                                        <div className="fw-bold text-navy small d-flex align-items-center gap-1.5 mt-0.5">
                                            <Calendar size={13} className="text-teal" />
                                            <span>
                                                {formatDeliveryDate(order.estimated_delivery_date || getEstimatedDeliveryDate(order.created_at, order.fulfillment_type))}
                                            </span>
                                            <span className="badge bg-success-subtle text-success border border-success-subtle extra-small ms-1">
                                                Ready in 2 Days
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Order Items Table */}
                        <div className="p-4 border-bottom">
                            <h6 className="fw-bold text-navy mb-3 display-font">ORDERED ITEMS ({items.length})</h6>
                            <div className="divide-y">
                                {items.map((item) => (
                                    <div key={item.id} className="py-2.5 d-flex justify-content-between align-items-center gap-3 border-bottom">
                                        <div>
                                            <div className="fw-bold text-navy small">{item.product_name}</div>
                                            <div className="text-muted extra-small">
                                                Qty: {item.quantity} × ₹{Number(item.unit_price).toLocaleString("en-IN")}
                                                <span className="ms-1 text-success">(Incl. of taxes)</span>
                                            </div>
                                        </div>
                                        <div className="fw-bold text-navy small text-end">
                                            ₹{Number(item.line_total).toLocaleString("en-IN")}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Order Totals - Flipkart Style Inclusive GST */}
                        <div className="p-4 bg-light">
                            <div className="row justify-content-end">
                                <div className="col-12 col-sm-6 col-md-5">
                                    <div className="d-flex justify-content-between py-1 small text-muted">
                                        <span>Item Subtotal (Net Base)</span>
                                        <span className="fw-semibold text-navy">₹{Number(order.subtotal || 0).toLocaleString("en-IN")}</span>
                                    </div>
                                    <div className="d-flex justify-content-between py-1 small text-muted">
                                        <span>Taxes &amp; GST (Included)</span>
                                        <span className="fw-semibold text-success">
                                            {Number(order.tax_amount || 0) > 0 ? `+₹${Number(order.tax_amount || 0).toLocaleString("en-IN")}` : "Included in MRP"}
                                        </span>
                                    </div>
                                    <div className="d-flex justify-content-between py-1 small text-muted">
                                        <span>Academy Branch Pickup</span>
                                        <span className="fw-bold text-success">FREE</span>
                                    </div>
                                    <div className="d-flex justify-content-between py-2 border-top mt-2">
                                        <span className="fw-bold text-navy">Total Amount</span>
                                        <span className="fw-bold text-navy fs-5" style={{ color: "#062f38" }}>
                                            ₹{Number(order.grand_total || 0).toLocaleString("en-IN")}
                                        </span>
                                    </div>
                                    <div className="extra-small text-muted text-end mt-0.5">
                                        (Inclusive of all taxes &amp; GST)
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
