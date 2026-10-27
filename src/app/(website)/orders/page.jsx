"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    ArrowRight,
    Calendar,
    ChevronDown,
    ChevronUp,
    Clock,
    CreditCard,
    DollarSign,
    ExternalLink,
    Filter,
    MapPin,
    Package,
    Search,
    ShoppingBag,
    Truck,
    UserCheck,
} from "lucide-react";
import { useUser } from "@/app/next_panel/components/UserContext";

function OrdersContent() {
    const searchParams = useSearchParams();
    const querySearch = searchParams.get("search") || "";

    const { user, isLoggedIn } = useUser();

    // Active Category Tab: "store" (Equipment Store Orders) | "ground" (Ground Slot Bookings)
    const [orderType, setOrderType] = useState("store");

    // Store orders state
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Filters
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [searchOrderNo, setSearchOrderNo] = useState(querySearch);

    // Expandable order items state: { [orderId]: items[] }
    const [expandedOrder, setExpandedOrder] = useState(null);
    const [orderItemsMap, setOrderItemsMap] = useState({});
    const [orderStatusHistoryMap, setOrderStatusHistoryMap] = useState({});
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Ground bookings state
    const [groundBookings, setGroundBookings] = useState([]);
    const [loadingGround, setLoadingGround] = useState(false);

    // Load store orders
    const fetchOrders = async () => {
        setLoading(true);
        setError(null);
        try {
            let url = "/api/orders?";
            const params = [];

            if (isLoggedIn && user?.id) {
                if (user.is_public || user.user_type === "Public User") {
                    params.push(`public_user_id=${user.id}`);
                } else {
                    params.push(`customer_user_id=${user.id}`);
                }
            } else if (searchOrderNo.trim()) {
                params.push(`search=${encodeURIComponent(searchOrderNo.trim())}`);
            } else {
                setOrders([]);
                setLoading(false);
                return;
            }

            if (statusFilter !== "ALL") {
                params.push(`order_status=${statusFilter}`);
            }

            url += params.join("&");

            const res = await fetch(url);
            const json = await res.json();
            let loadedOrders = res.ok && json.success ? (json.data || []) : [];

            // If empty and user has a phone number, fallback search by phone to catch all matching orders
            if (loadedOrders.length === 0 && isLoggedIn && user?.phone) {
                const fallbackRes = await fetch(`/api/orders?search=${encodeURIComponent(user.phone)}`);
                const fallbackJson = await fallbackRes.json();
                if (fallbackRes.ok && fallbackJson.success && Array.isArray(fallbackJson.data) && fallbackJson.data.length > 0) {
                    loadedOrders = fallbackJson.data;
                }
            }

            setOrders(loadedOrders);
        } catch (err) {
            setError("Unable to load orders at this time.");
        } finally {
            setLoading(false);
        }
    };

    // Load ground bookings
    const fetchGroundBookings = async () => {
        if (!user) return;
        setLoadingGround(true);
        try {
            const query = user.phone || user.email || user.name || "";
            const res = await fetch(`/api/ground-booking-requests?search=${encodeURIComponent(query)}`);
            const json = await res.json();
            if (res.ok && json.success) {
                setGroundBookings(json.data || []);
            } else {
                setGroundBookings([]);
            }
        } catch (err) {
            console.error("Failed to load ground bookings:", err);
        } finally {
            setLoadingGround(false);
        }
    };

    useEffect(() => {
        if (orderType === "store") {
            fetchOrders();
        } else {
            fetchGroundBookings();
        }
    }, [isLoggedIn, user?.id, statusFilter, orderType]);

    // Handle guest search submit
    const handleGuestSearch = (e) => {
        e.preventDefault();
        fetchOrders();
    };

    // Toggle expand order details
    const toggleOrderDetails = async (orderId) => {
        if (expandedOrder === orderId) {
            setExpandedOrder(null);
            return;
        }

        setExpandedOrder(orderId);

        // Fetch line items if not cached
        if (!orderItemsMap[orderId]) {
            setLoadingDetails(true);
            try {
                const [itemsRes, histRes] = await Promise.all([
                    fetch(`/api/order-items?order_id=${orderId}`),
                    fetch(`/api/order-status-history?order_id=${orderId}`),
                ]);
                const itemsJson = await itemsRes.json();
                const histJson = await histRes.json();

                if (itemsRes.ok && itemsJson.success) {
                    setOrderItemsMap((prev) => ({ ...prev, [orderId]: itemsJson.data || [] }));
                }
                if (histRes.ok && histJson.success) {
                    setOrderStatusHistoryMap((prev) => ({ ...prev, [orderId]: histJson.data || [] }));
                }
            } catch (err) {
                console.error("Failed to load order details:", err);
            } finally {
                setLoadingDetails(false);
            }
        }
    };

    const statusBadgeClass = (status) => {
        switch (status) {
            case "Delivered":
                return "bg-success text-white";
            case "Dispatched":
            case "Ready":
                return "bg-info text-dark";
            case "Processing":
            case "Confirmed":
                return "bg-primary text-white";
            case "Cancelled":
            case "Returned":
                return "bg-danger text-white";
            default:
                return "bg-warning text-dark";
        }
    };

    const getEstimatedDeliveryDate = (createdDate, type = "Delivery") => {
        const days = type === "Pickup" ? 2 : 12;
        const d = createdDate ? new Date(createdDate) : new Date();
        d.setDate(d.getDate() + days);
        return d;
    };

    const formatDeliveryDate = (dateVal) => {
        if (!dateVal) return "";
        const d = typeof dateVal === "string" ? new Date(dateVal.includes("T") ? dateVal : dateVal + "T00:00:00") : new Date(dateVal);
        if (isNaN(d.getTime())) return String(dateVal);
        return d.toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    return (
        <div className="bg-cream min-vh-100 py-5">
            <div className="container py-3" style={{ maxWidth: "1050px" }}>
                {/* Header Title */}
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
                    <div>
                        <div className="d-flex align-items-center gap-2 small text-muted mb-1">
                            <Link href="/shop" className="text-decoration-none text-muted hover-navy">
                                Store
                            </Link>
                            <span>/</span>
                            <span className="text-navy fw-semibold">Orders &amp; Tracking</span>
                        </div>
                        <h2 className="display-font fw-bold text-navy mb-0">MY ORDERS &amp; TRACKING</h2>
                    </div>

                    <Link
                        href="/shop"
                        className="btn btn-navy px-4 py-2.5 rounded-pill fw-semibold d-inline-flex align-items-center gap-2 shadow-sm"
                    >
                        <ShoppingBag size={16} /> CST Equipment Store
                    </Link>
                </div>

                {/* Main Category Tabs: Store Orders vs Ground Bookings */}
                <div className="bg-white rounded-4 p-2 shadow-sm border mb-4 d-flex">
                    <button
                        type="button"
                        className={`btn flex-fill rounded-pill py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2 ${
                            orderType === "store" ? "btn-navy shadow-sm" : "btn-light text-muted border-0"
                        }`}
                        onClick={() => setOrderType("store")}
                    >
                        <Package size={18} />
                        <span>Cricket Store Orders</span>
                    </button>

                    <button
                        type="button"
                        className={`btn flex-fill rounded-pill py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2 ${
                            orderType === "ground" ? "btn-navy shadow-sm" : "btn-light text-muted border-0"
                        }`}
                        onClick={() => setOrderType("ground")}
                    >
                        <Calendar size={18} />
                        <span>Ground Bookings</span>
                    </button>
                </div>

                {/* ==================================================== */}
                {/* STORE ORDERS TAB */}
                {/* ==================================================== */}
                {orderType === "store" && (
                    <>
                        {/* Guest search / Track order tool */}
                        <div className="card border-0 shadow-sm rounded-4 p-4 bg-white mb-4">
                            <div className="row g-3 align-items-center">
                                <div className="col-12 col-md-6">
                                    <h6 className="fw-bold text-navy mb-1 display-font">TRACK ANY ORDER</h6>
                                    <p className="text-muted small mb-0">
                                        Enter your order number or registered phone to track status.
                                    </p>
                                </div>
                                <div className="col-12 col-md-6">
                                    <form onSubmit={handleGuestSearch} className="d-flex gap-2">
                                        <div className="input-group">
                                            <span className="input-group-text bg-light border-end-0">
                                                <Search size={16} className="text-muted" />
                                            </span>
                                            <input
                                                type="text"
                                                className="form-control border-start-0"
                                                placeholder="e.g. ORD-173..., or phone"
                                                value={searchOrderNo}
                                                onChange={(e) => setSearchOrderNo(e.target.value)}
                                            />
                                        </div>
                                        <button type="submit" className="btn btn-navy px-4 rounded-pill fw-semibold">
                                            Track
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>

                        {/* Status filter pills */}
                        {isLoggedIn && (
                            <div className="d-flex flex-wrap gap-2 mb-4">
                                {["ALL", "Pending", "Confirmed", "Processing", "Dispatched", "Delivered", "Cancelled"].map((st) => (
                                    <button
                                        key={st}
                                        type="button"
                                        onClick={() => setStatusFilter(st)}
                                        className={`btn btn-sm rounded-pill px-3 py-1.5 fw-semibold ${
                                            statusFilter === st
                                                ? "btn-navy shadow-sm"
                                                : "btn-white bg-white text-muted border hover-navy"
                                        }`}
                                    >
                                        {st === "ALL" ? "All Statuses" : st}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Orders List */}
                        {loading ? (
                            <div className="card border-0 shadow-sm rounded-4 p-5 bg-white text-center">
                                <div className="spinner-border text-navy mb-2" role="status" />
                                <div className="text-muted small">Loading orders...</div>
                            </div>
                        ) : error ? (
                            <div className="alert alert-danger rounded-4 p-3 small">{error}</div>
                        ) : orders.length === 0 ? (
                            <div className="card border-0 shadow-sm rounded-4 p-5 bg-white text-center">
                                <Package size={48} className="text-muted mb-3 mx-auto opacity-50" />
                                <h4 className="fw-bold text-navy display-font mb-2">NO ORDERS FOUND</h4>
                                <p className="text-muted small mb-4 mx-auto" style={{ maxWidth: "420px" }}>
                                    {isLoggedIn
                                        ? "You haven't placed any store orders yet. Check out bats, balls, pads, and uniforms in our store."
                                        : "Please log in or enter your Order Number above to track your order."}
                                </p>
                                <div className="d-flex justify-content-center gap-2">
                                    <Link href="/shop" className="btn btn-navy px-4 py-2 rounded-pill fw-semibold">
                                        Shop Cricket Equipment
                                    </Link>
                                    {!isLoggedIn && (
                                        <Link href="/login" className="btn btn-outline-dark px-4 py-2 rounded-pill fw-semibold">
                                            Sign In
                                        </Link>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="d-flex flex-column gap-3">
                                {orders.map((ord) => {
                                    const isExpanded = expandedOrder === ord.id;
                                    const lineItems = orderItemsMap[ord.id] || [];
                                    const statusHistory = orderStatusHistoryMap[ord.id] || [];

                                    return (
                                        <div
                                            key={ord.id}
                                            className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white transition-all"
                                        >
                                            {/* Order Card Header */}
                                            <div className="p-3 p-md-4 border-bottom d-flex flex-wrap justify-content-between align-items-center gap-3">
                                                <div className="d-flex flex-wrap align-items-center gap-2">
                                                    <span className="font-monospace fw-bold text-navy fs-6">
                                                        {ord.order_no}
                                                    </span>
                                                    <span className={`badge rounded-pill px-3 py-1 fw-bold small ${statusBadgeClass(ord.order_status)}`}>
                                                        {ord.order_status}
                                                    </span>
                                                    <span className="badge bg-light text-navy border rounded-pill px-2.5 py-1 small">
                                                        {ord.fulfillment_type === "Pickup" ? "Branch Pickup" : "Delivery"}
                                                    </span>
                                                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2.5 py-1 small d-inline-flex align-items-center gap-1">
                                                        <Calendar size={12} />
                                                        <span>
                                                            {ord.fulfillment_type === "Pickup" ? "Ready: " : "Est. Delivery: "}
                                                            <strong>{formatDeliveryDate(ord.estimated_delivery_date || getEstimatedDeliveryDate(ord.created_at, ord.fulfillment_type))}</strong>
                                                            <span className="text-muted extra-small ms-0.5">({ord.fulfillment_type === "Pickup" ? "+2D" : "+12D"})</span>
                                                        </span>
                                                    </span>
                                                </div>

                                                <div className="d-flex align-items-center gap-3">
                                                    <div className="text-end">
                                                        <div className="fw-bold text-navy fs-5">
                                                            ₹{Number(ord.grand_total || 0).toLocaleString("en-IN")}
                                                        </div>
                                                        <div className="extra-small text-muted" style={{ fontSize: "0.75rem" }}>
                                                            {new Date(ord.created_at).toLocaleDateString()}
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => toggleOrderDetails(ord.id)}
                                                        className="btn btn-light btn-sm rounded-circle p-2 d-flex align-items-center justify-content-center"
                                                        aria-label="Toggle details"
                                                    >
                                                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Summary line */}
                                            <div className="px-3 px-md-4 py-2.5 bg-light d-flex flex-wrap justify-content-between align-items-center gap-2 small text-muted">
                                                <div className="d-flex flex-wrap align-items-center gap-3">
                                                    <span>
                                                        Recipient: <strong className="text-navy">{ord.customer_name}</strong> ({ord.customer_phone})
                                                    </span>
                                                    <span>
                                                        Payment: <strong className="text-navy">{ord.payment_method}</strong> ({ord.payment_status})
                                                    </span>
                                                </div>

                                                <div className="d-flex gap-2">
                                                    <Link
                                                        href={`/order-success/${encodeURIComponent(ord.order_no)}`}
                                                        className="text-navy fw-semibold text-decoration-none d-inline-flex align-items-center gap-1 hover-teal"
                                                    >
                                                        Receipt <ExternalLink size={12} />
                                                    </Link>
                                                </div>
                                            </div>

                                            {/* Expanded Line Items & Timeline */}
                                            {isExpanded && (
                                                <div className="p-3 p-md-4 border-top">
                                                    {loadingDetails && lineItems.length === 0 ? (
                                                        <div className="text-center py-3">
                                                            <div className="spinner-border spinner-border-sm text-navy" />
                                                            <span className="small text-muted ms-2">Loading item details...</span>
                                                        </div>
                                                    ) : (
                                                        <div className="row g-4">
                                                            {/* Items Column */}
                                                            <div className="col-12 col-md-7">
                                                                <h6 className="fw-bold text-navy small mb-3 display-font">
                                                                    ITEMS ORDERED ({lineItems.length})
                                                                </h6>

                                                                <div className="divide-y">
                                                                    {lineItems.map((item) => (
                                                                        <div
                                                                            key={item.id}
                                                                            className="py-2.5 d-flex justify-content-between align-items-center border-bottom"
                                                                        >
                                                                            <div>
                                                                                <div className="fw-semibold text-navy small">
                                                                                    {item.product_name}
                                                                                </div>
                                                                                <div className="text-muted extra-small">
                                                                                    Qty: {item.quantity} × ₹{Number(item.unit_price).toLocaleString("en-IN")}
                                                                                    {item.product_code && ` · SKU: ${item.product_code}`}
                                                                                </div>
                                                                            </div>
                                                                            <div className="fw-bold text-navy small text-end">
                                                                                ₹{Number(item.line_total).toLocaleString("en-IN")}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>

                                                                {/* Destination Address / Branch */}
                                                                <div className="mt-3 p-3 bg-light rounded-3 small">
                                                                    <div className="fw-bold text-navy mb-1">
                                                                        {ord.fulfillment_type === "Pickup"
                                                                            ? "Branch Pickup Location:"
                                                                            : "Shipping Address:"}
                                                                    </div>
                                                                    {ord.fulfillment_type === "Pickup" ? (
                                                                        <div>{ord.branch_name || "CST Pro Cricket Academy"}</div>
                                                                    ) : (
                                                                        <div>
                                                                            {ord.delivery_address},{" "}
                                                                            {[ord.delivery_city, ord.delivery_state, ord.delivery_pincode]
                                                                                .filter(Boolean)
                                                                                .join(", ")}
                                                                        </div>
                                                                    )}
                                                                    <div className="mt-2 pt-2 border-top d-flex flex-wrap justify-content-between align-items-center gap-2">
                                                                        <span className="text-muted extra-small text-uppercase fw-semibold">
                                                                            {ord.fulfillment_type === "Pickup" ? "Ready for Pickup (+2 Days):" : "Estimated Delivery (+12 Days):"}
                                                                        </span>
                                                                        <span className="fw-bold text-navy small d-inline-flex align-items-center gap-1">
                                                                            <Clock size={13} className="text-teal" />
                                                                            {formatDeliveryDate(ord.estimated_delivery_date || getEstimatedDeliveryDate(ord.created_at, ord.fulfillment_type))}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Timeline Column */}
                                                            <div className="col-12 col-md-5">
                                                                <h6 className="fw-bold text-navy small mb-3 display-font">
                                                                    STATUS TIMELINE
                                                                </h6>

                                                                {statusHistory.length === 0 ? (
                                                                    <div className="small text-muted py-2">
                                                                        Order placed with status: <strong>{ord.order_status}</strong>.
                                                                    </div>
                                                                ) : (
                                                                    <div className="border-start border-2 ps-3 ms-2">
                                                                        {statusHistory.map((hist, idx) => (
                                                                            <div key={hist.id || idx} className="mb-3 position-relative">
                                                                                <div
                                                                                    className="position-absolute rounded-circle bg-navy"
                                                                                    style={{
                                                                                        width: "10px",
                                                                                        height: "10px",
                                                                                        left: "-22px",
                                                                                        top: "4px",
                                                                                    }}
                                                                                />
                                                                                <div className="d-flex align-items-center gap-2">
                                                                                    <span className="badge bg-light text-navy border small">
                                                                                        {hist.new_status}
                                                                                    </span>
                                                                                    <span className="extra-small text-muted" style={{ fontSize: "0.75rem" }}>
                                                                                        {new Date(hist.created_at).toLocaleString()}
                                                                                    </span>
                                                                                </div>
                                                                                {hist.remarks && (
                                                                                    <div className="small text-muted mt-1">
                                                                                        {hist.remarks}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}

                {/* ==================================================== */}
                {/* GROUND BOOKINGS TAB */}
                {/* ==================================================== */}
                {orderType === "ground" && (
                    <div>
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <div>
                                <h5 className="fw-bold text-navy mb-1 display-font">MY GROUND BOOKINGS</h5>
                                <p className="text-muted small mb-0">Track turf wicket &amp; pitch slot reservations.</p>
                            </div>
                            <Link href="/ground-booking" className="btn btn-lime text-navy btn-sm rounded-pill px-4 fw-semibold">
                                Book Ground Slot
                            </Link>
                        </div>

                        {loadingGround ? (
                            <div className="card border-0 shadow-sm rounded-4 p-5 bg-white text-center">
                                <div className="spinner-border text-navy mb-2" role="status" />
                                <div className="text-muted small">Loading bookings...</div>
                            </div>
                        ) : groundBookings.length === 0 ? (
                            <div className="card border-0 shadow-sm rounded-4 p-5 bg-white text-center">
                                <Calendar size={48} className="text-muted mb-3 mx-auto opacity-50" />
                                <h4 className="fw-bold text-navy display-font mb-2">NO GROUND BOOKINGS</h4>
                                <p className="text-muted small mb-4 mx-auto" style={{ maxWidth: "420px" }}>
                                    You have not reserved any match grounds or practice nets yet.
                                </p>
                                <div>
                                    <Link href="/ground-booking" className="btn btn-navy px-4 py-2 rounded-pill fw-semibold">
                                        Explore Grounds &amp; Reserve Slot
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="row g-3">
                                {groundBookings.map((b) => (
                                    <div className="col-12" key={b.id}>
                                        <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                                            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                                                <div>
                                                    <span className="badge bg-light text-navy border me-2">
                                                        {b.request_number || `REQ-${b.id}`}
                                                    </span>
                                                    <span className="badge bg-navy text-lime rounded-pill px-3 py-1">
                                                        {b.request_status}
                                                    </span>
                                                </div>
                                                <div className="small text-muted">
                                                    Date: <strong>{b.booking_date}</strong> ({b.start_time} - {b.end_time})
                                                </div>
                                            </div>

                                            <h6 className="fw-bold text-navy mb-1">{b.ground_name || "CST Pro Cricket Ground"}</h6>
                                            <div className="small text-muted mb-2">
                                                Purpose: <strong>{b.booking_purpose || "Match / Practice"}</strong>
                                            </div>

                                            {b.admin_remarks && (
                                                <div className="p-2 bg-light rounded small text-muted">
                                                    <strong>Admin Remarks:</strong> {b.admin_remarks}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function OrdersPage() {
    return (
        <Suspense
            fallback={
                <div className="min-vh-100 bg-cream d-flex align-items-center justify-content-center">
                    <div className="spinner-border text-navy" role="status" />
                </div>
            }
        >
            <OrdersContent />
        </Suspense>
    );
}
