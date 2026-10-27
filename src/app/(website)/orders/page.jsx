"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    AlertCircle,
    ArrowRight,
    Calendar,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    CreditCard,
    DollarSign,
    ExternalLink,
    Filter,
    HelpCircle,
    Info,
    MapPin,
    Package,
    Phone,
    RefreshCw,
    Search,
    ShoppingBag,
    Tag,
    Truck,
    User,
    UserCheck,
    X,
    XCircle,
} from "lucide-react";
import { useUser } from "@/app/next_panel/components/UserContext";

const ORDER_STAGES = [
    { key: "Pending", label: "Placed" },
    { key: "Confirmed", label: "Confirmed" },
    { key: "Processing", label: "Processing" },
    { key: "Dispatched", label: "Dispatched" },
    { key: "Delivered", label: "Delivered" },
];

const STAGE_RANK = {
    Pending: 1,
    Confirmed: 2,
    Processing: 3,
    Ready: 3,
    Dispatched: 4,
    Delivered: 5,
};

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
    const [notice, setNotice] = useState(null);

    // Cancel modal state
    const [cancelModalOrder, setCancelModalOrder] = useState(null);
    const [cancelReasonPreset, setCancelReasonPreset] = useState("Changed my mind");
    const [cancelReason, setCancelReason] = useState("");
    const [cancelling, setCancelling] = useState(false);

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
            let loadedOrders = res.ok && json.success ? json.data || [] : [];

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

    // Open Cancel Order modal
    const handleOpenCancelModal = (ord) => {
        if (ord.order_status === "Dispatched") {
            alert("This order is already Dispatched and cannot be cancelled.");
            return;
        }
        if (ord.order_status === "Delivered") {
            alert("This order is already Delivered.");
            return;
        }
        if (ord.order_status === "Cancelled") {
            alert("This order is already Cancelled.");
            return;
        }
        setCancelModalOrder(ord);
        setCancelReasonPreset("Changed my mind");
        setCancelReason("");
    };

    // Submit cancellation to API
    const handleConfirmCancel = async () => {
        if (!cancelModalOrder) return;
        setCancelling(true);
        try {
            const finalReason = cancelReason.trim()
                ? `${cancelReasonPreset}: ${cancelReason.trim()}`
                : cancelReasonPreset;

            const res = await fetch(`/api/orders/${cancelModalOrder.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    order_status: "Cancelled",
                    notes: `Cancelled by customer: ${finalReason}`,
                    actor_type: user?.is_public || user?.user_type === "Public User" ? "Public User" : "Academy User",
                    actor_id: user?.id || null,
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to cancel order.");
            }

            const cancelledNo = cancelModalOrder.order_no;
            setCancelModalOrder(null);
            setNotice(`Order #${cancelledNo} has been cancelled successfully. Any items held have been released back to branch inventory.`);
            setTimeout(() => setNotice(null), 6000);
            await fetchOrders();
        } catch (err) {
            alert(err.message);
        } finally {
            setCancelling(false);
        }
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
                return "bg-primary text-white";
            case "Ready":
                return "bg-info text-dark";
            case "Processing":
            case "Confirmed":
                return "bg-secondary text-white";
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

    // Metrics for dashboard summary
    const totalStoreOrders = orders.length;
    const activeStoreOrders = orders.filter((o) =>
        ["Pending", "Confirmed", "Processing", "Ready", "Dispatched"].includes(o.order_status)
    ).length;
    const completedStoreOrders = orders.filter((o) => o.order_status === "Delivered").length;
    const cancelledStoreOrders = orders.filter((o) => o.order_status === "Cancelled").length;

    return (
        <div className="bg-light min-vh-100 py-4 py-md-5">
            <div className="container py-2" style={{ maxWidth: "1120px" }}>
                {/* 1. TOP BREADCRUMB */}
                <div className="d-flex align-items-center gap-2 small text-muted mb-3">
                    <Link href="/" className="text-decoration-none text-muted hover-navy">
                        Home
                    </Link>
                    <span>/</span>
                    <Link href="/shop" className="text-decoration-none text-muted hover-navy">
                        Equipment Store
                    </Link>
                    <span>/</span>
                    <span className="text-navy fw-semibold">My Orders &amp; Tracking</span>
                </div>

                {/* 2. EXECUTIVE HERO HEADER */}
                <div
                    className="rounded-4 p-4 p-md-5 mb-4 shadow-sm text-white position-relative overflow-hidden"
                    style={{
                        background: "linear-gradient(135deg, #062f38 0%, #0a4a55 100%)",
                        boxShadow: "0 10px 30px rgba(6,47,56, 0.15)",
                    }}
                >
                    <div className="position-relative" style={{ zIndex: 2 }}>
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <div>
                                <div className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill bg-white bg-opacity-10 text-lime small fw-semibold mb-2">
                                    <ShoppingBag size={14} />
                                    <span>Official CST Cricket Equipment &amp; Facility Orders</span>
                                </div>
                                <h1 className="display-font fw-bold text-white mb-2" style={{ letterSpacing: "0.5px" }}>
                                    MY ORDERS &amp; TRACKING
                                </h1>
                                <p className="text-white-50 mb-0 small" style={{ maxWidth: "560px" }}>
                                    Review your equipment purchases, track real-time delivery checkpoints, manage branch pickup locations, or cancel orders before dispatch.
                                </p>
                            </div>

                            <div className="d-flex flex-wrap align-items-center gap-2">
                                <Link
                                    href="/shop"
                                    className="btn btn-lime text-navy px-4 py-2.5 rounded-pill fw-bold d-inline-flex align-items-center gap-2 shadow-sm"
                                >
                                    <ShoppingBag size={17} />
                                    <span>CST Pro Shop</span>
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => {
                                        fetchOrders();
                                        fetchGroundBookings();
                                    }}
                                    className="btn btn-outline-light rounded-pill px-3 py-2.5 d-inline-flex align-items-center gap-1.5"
                                    title="Refresh Orders"
                                >
                                    <RefreshCw size={15} className={loading ? "spin" : ""} />
                                    <span>Refresh</span>
                                </button>
                            </div>
                        </div>

                        {/* Quick Stats Pills */}
                        {isLoggedIn && orderType === "store" && (
                            <div className="row g-2 mt-3 pt-3 border-top border-white border-opacity-10">
                                <div className="col-6 col-md-3">
                                    <div className="p-2.5 rounded-3 bg-white bg-opacity-10 d-flex align-items-center justify-content-between">
                                        <span className="small text-white-50">Total Orders:</span>
                                        <span className="fw-bold text-white fs-6">{totalStoreOrders}</span>
                                    </div>
                                </div>
                                <div className="col-6 col-md-3">
                                    <div className="p-2.5 rounded-3 bg-white bg-opacity-10 d-flex align-items-center justify-content-between">
                                        <span className="small text-white-50">In Progress:</span>
                                        <span className="fw-bold text-lime fs-6">{activeStoreOrders}</span>
                                    </div>
                                </div>
                                <div className="col-6 col-md-3">
                                    <div className="p-2.5 rounded-3 bg-white bg-opacity-10 d-flex align-items-center justify-content-between">
                                        <span className="small text-white-50">Delivered:</span>
                                        <span className="fw-bold text-success fs-6">{completedStoreOrders}</span>
                                    </div>
                                </div>
                                <div className="col-6 col-md-3">
                                    <div className="p-2.5 rounded-3 bg-white bg-opacity-10 d-flex align-items-center justify-content-between">
                                        <span className="small text-white-50">Cancelled:</span>
                                        <span className="fw-bold text-danger fs-6">{cancelledStoreOrders}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. MAIN CATEGORY TABS (Store Orders vs Ground Bookings) */}
                <div className="bg-white rounded-4 p-1.5 shadow-sm border mb-4 d-flex">
                    <button
                        type="button"
                        className={`btn flex-fill rounded-pill py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2 transition-all ${
                            orderType === "store" ? "btn-navy shadow-sm" : "btn-light text-muted border-0 bg-transparent hover-navy"
                        }`}
                        onClick={() => setOrderType("store")}
                    >
                        <Package size={18} />
                        <span>Equipment Store Orders</span>
                        {orders.length > 0 && (
                            <span className={`badge rounded-pill ms-1 ${orderType === "store" ? "bg-white text-navy" : "bg-secondary text-white"}`}>
                                {orders.length}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        className={`btn flex-fill rounded-pill py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2 transition-all ${
                            orderType === "ground" ? "btn-navy shadow-sm" : "btn-light text-muted border-0 bg-transparent hover-navy"
                        }`}
                        onClick={() => setOrderType("ground")}
                    >
                        <Calendar size={18} />
                        <span>Ground &amp; Net Slot Bookings</span>
                        {groundBookings.length > 0 && (
                            <span className={`badge rounded-pill ms-1 ${orderType === "ground" ? "bg-white text-navy" : "bg-secondary text-white"}`}>
                                {groundBookings.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* ==================================================== */}
                {/* STORE ORDERS TAB */}
                {/* ==================================================== */}
                {orderType === "store" && (
                    <>
                        {/* Notice Banner */}
                        {notice && (
                            <div className="alert alert-success rounded-4 p-3 mb-4 shadow-sm d-flex align-items-center justify-content-between gap-2 border-0 bg-success-subtle text-success">
                                <div className="d-flex align-items-center gap-2">
                                    <CheckCircle2 size={18} className="text-success flex-shrink-0" />
                                    <span className="fw-medium">{notice}</span>
                                </div>
                                <button type="button" className="btn-close" onClick={() => setNotice(null)} aria-label="Close" />
                            </div>
                        )}

                        {/* 4. SEARCH & STATUS FILTER TOOLBAR */}
                        <div className="bg-white rounded-4 p-3 shadow-sm border mb-4">
                            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                                {/* Search Box */}
                                <form onSubmit={handleGuestSearch} className="flex-grow-1" style={{ maxWidth: "420px" }}>
                                    <div className="input-group">
                                        <span className="input-group-text bg-light border-end-0 text-muted">
                                            <Search size={16} />
                                        </span>
                                        <input
                                            type="text"
                                            className="form-control border-start-0 ps-0"
                                            placeholder="Search by Order No, product, or phone..."
                                            value={searchOrderNo}
                                            onChange={(e) => setSearchOrderNo(e.target.value)}
                                        />
                                        {searchOrderNo && (
                                            <button
                                                type="button"
                                                className="btn btn-light border border-start-0 text-muted"
                                                onClick={() => {
                                                    setSearchOrderNo("");
                                                    if (isLoggedIn) fetchOrders();
                                                }}
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                        <button type="submit" className="btn btn-navy px-3.5 fw-semibold">
                                            Search
                                        </button>
                                    </div>
                                </form>

                                {/* Status Filters (Only for Logged in user or when orders present) */}
                                {isLoggedIn && (
                                    <div className="d-flex flex-wrap align-items-center gap-1.5">
                                        {["ALL", "Pending", "Confirmed", "Processing", "Dispatched", "Delivered", "Cancelled"].map((st) => (
                                            <button
                                                key={st}
                                                type="button"
                                                onClick={() => setStatusFilter(st)}
                                                className={`btn btn-sm rounded-pill px-3 py-1.5 fw-semibold transition-all ${
                                                    statusFilter === st
                                                        ? "btn-navy shadow-sm"
                                                        : "btn-light text-muted border-0 bg-light hover-navy"
                                                }`}
                                            >
                                                {st === "ALL" ? "All Orders" : st}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 5. ORDERS LIST */}
                        {loading ? (
                            <div className="card border-0 shadow-sm rounded-4 p-5 bg-white text-center">
                                <div className="spinner-border text-navy mb-2" role="status" />
                                <div className="text-muted small">Loading customer orders...</div>
                            </div>
                        ) : error ? (
                            <div className="alert alert-danger rounded-4 p-3.5 small shadow-sm">{error}</div>
                        ) : orders.length === 0 ? (
                            <div className="card border-0 shadow-sm rounded-4 p-5 bg-white text-center">
                                <div
                                    className="rounded-circle mx-auto d-flex align-items-center justify-content-center mb-3"
                                    style={{ width: "70px", height: "70px", background: "#f1f5f9" }}
                                >
                                    <Package size={34} className="text-muted opacity-75" />
                                </div>
                                <h4 className="fw-bold text-navy display-font mb-2">NO ORDERS FOUND</h4>
                                <p className="text-muted small mb-4 mx-auto" style={{ maxWidth: "440px" }}>
                                    {isLoggedIn
                                        ? "You haven't placed any equipment store orders yet. Explore cricket bats, balls, kits, and uniforms in our official shop."
                                        : "Enter your Order Number or registered phone number above to track your order."}
                                </p>
                                <div className="d-flex justify-content-center gap-2">
                                    <Link href="/shop" className="btn btn-navy px-4 py-2 rounded-pill fw-semibold shadow-sm">
                                        Browse Cricket Shop
                                    </Link>
                                    {!isLoggedIn && (
                                        <Link href="/login" className="btn btn-outline-dark px-4 py-2 rounded-pill fw-semibold">
                                            Sign In
                                        </Link>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="d-flex flex-column gap-4">
                                {orders.map((ord) => {
                                    const isExpanded = expandedOrder === ord.id;
                                    const lineItems = orderItemsMap[ord.id] || [];
                                    const statusHistory = orderStatusHistoryMap[ord.id] || [];

                                    const isDelivered = ord.order_status === "Delivered";
                                    const isCancelled = ord.order_status === "Cancelled";
                                    const isDispatched = ord.order_status === "Dispatched";
                                    const isPickup = ord.fulfillment_type === "Pickup";
                                    const currentRank = STAGE_RANK[ord.order_status] || 1;

                                    // Dynamic Card Styling based on lifecycle status
                                    const cardStyle = isCancelled
                                        ? { backgroundColor: "#fef2f2", borderColor: "#fca5a5" }
                                        : isDelivered
                                        ? { backgroundColor: "#f0fdf4", borderColor: "#86efac" }
                                        : { backgroundColor: "#ffffff", borderColor: "#e2e8f0" };

                                    return (
                                        <div
                                            key={ord.id}
                                            className="card rounded-4 border shadow-sm overflow-hidden transition-all"
                                            style={cardStyle}
                                        >
                                            {/* ======================================================== */}
                                            {/* 1. CARD TOP METADATA BAR (Executive Neutral Header) */}
                                            {/* ======================================================== */}
                                            <div
                                                className="p-3 px-md-4 py-3 border-bottom d-flex flex-wrap align-items-center justify-content-between gap-3"
                                                style={{
                                                    backgroundColor: isCancelled ? "#fee2e2" : isDelivered ? "#dcfce7" : "#f8fafc",
                                                }}
                                            >
                                                <div className="d-flex flex-wrap align-items-center gap-3 gap-md-4 text-secondary small">
                                                    <div>
                                                        <span
                                                            className="text-uppercase text-muted d-block fw-bold"
                                                            style={{ fontSize: "0.68rem", letterSpacing: "0.5px" }}
                                                        >
                                                            ORDER PLACED
                                                        </span>
                                                        <span className="fw-semibold text-dark">
                                                            {ord.created_at
                                                                ? new Date(ord.created_at).toLocaleDateString("en-IN", {
                                                                      day: "2-digit",
                                                                      month: "short",
                                                                      year: "numeric",
                                                                  })
                                                                : "—"}
                                                        </span>
                                                    </div>

                                                    <div className="vr d-none d-md-block opacity-25" style={{ height: "24px" }} />

                                                    <div>
                                                        <span
                                                            className="text-uppercase text-muted d-block fw-bold"
                                                            style={{ fontSize: "0.68rem", letterSpacing: "0.5px" }}
                                                        >
                                                            TOTAL AMOUNT
                                                        </span>
                                                        <span className="fw-bold text-dark fs-6">
                                                            ₹{Number(ord.grand_total || 0).toLocaleString("en-IN")}
                                                        </span>
                                                        <span className="extra-small text-muted ms-1">
                                                            ({ord.payment_method} • {ord.payment_status})
                                                        </span>
                                                    </div>

                                                    <div className="vr d-none d-md-block opacity-25" style={{ height: "24px" }} />

                                                    <div>
                                                        <span
                                                            className="text-uppercase text-muted d-block fw-bold"
                                                            style={{ fontSize: "0.68rem", letterSpacing: "0.5px" }}
                                                        >
                                                            SELLER / FULFILLMENT
                                                        </span>
                                                        <span className="fw-semibold text-dark d-inline-flex align-items-center gap-1">
                                                            <MapPin size={12} className="text-danger flex-shrink-0" />
                                                            <span>{ord.branch_name || "Main Branch"}</span>
                                                        </span>
                                                        <span className="badge bg-light text-muted border extra-small ms-1" style={{ fontSize: "0.65rem" }}>
                                                            {isPickup ? "Pickup" : "Delivery"}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="text-end ms-auto">
                                                    <span
                                                        className="text-uppercase text-muted d-block fw-bold"
                                                        style={{ fontSize: "0.68rem", letterSpacing: "0.5px" }}
                                                    >
                                                        ORDER #
                                                    </span>
                                                    <div className="font-monospace fw-bold text-dark" style={{ fontSize: "0.88rem" }}>
                                                        {ord.order_no}
                                                    </div>
                                                    <div className="d-flex align-items-center gap-2 justify-content-end mt-0.5">
                                                        <Link
                                                            href={`/order-success/${encodeURIComponent(ord.order_no)}`}
                                                            className="text-navy extra-small fw-semibold d-inline-flex align-items-center gap-1 text-decoration-none hover-teal"
                                                        >
                                                            <span>Invoice Receipt</span>
                                                            <ExternalLink size={11} />
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* ======================================================== */}
                                            {/* 2. STATUS & DELIVERY PROMISE BANNER */}
                                            {/* ======================================================== */}
                                            <div
                                                className="px-3 px-md-4 py-2.5 border-bottom d-flex flex-wrap align-items-center justify-content-between gap-3"
                                                style={{
                                                    backgroundColor: isCancelled ? "#fff5f5" : isDelivered ? "#f0fdf4" : "#ffffff",
                                                }}
                                            >
                                                <div className="d-flex flex-wrap align-items-center gap-2.5">
                                                    <span className={`badge rounded-pill px-3 py-1.5 fw-bold ${statusBadgeClass(ord.order_status)}`}>
                                                        {ord.order_status}
                                                    </span>

                                                    {/* Delivery Promise Badge */}
                                                    <div className="fw-semibold text-dark small d-flex align-items-center gap-1.5">
                                                        <Clock size={15} className="text-primary flex-shrink-0" />
                                                        <span>
                                                            {isDelivered
                                                                ? "Order successfully delivered & completed."
                                                                : isCancelled
                                                                ? "Order cancelled. Items returned to inventory."
                                                                : isPickup
                                                                ? `Ready for pickup: ${formatDeliveryDate(ord.estimated_delivery_date || getEstimatedDeliveryDate(ord.created_at, ord.fulfillment_type))} (+2 Days)`
                                                                : `Estimated delivery: ${formatDeliveryDate(ord.estimated_delivery_date || getEstimatedDeliveryDate(ord.created_at, ord.fulfillment_type))} (+12 Days)`}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Header Action Buttons: Cancel & Toggle Details */}
                                                <div className="d-flex align-items-center gap-2">
                                                    {/* Cancel Order Button */}
                                                    {!isCancelled && !isDelivered && (
                                                        <button
                                                            type="button"
                                                            disabled={isDispatched}
                                                            onClick={() => handleOpenCancelModal(ord)}
                                                            className={`btn btn-sm rounded-pill px-3 py-1.5 fw-semibold d-inline-flex align-items-center gap-1.5 ${
                                                                isDispatched ? "btn-light border text-muted" : "btn-outline-danger shadow-sm"
                                                            }`}
                                                            title={
                                                                isDispatched
                                                                    ? "Order has already been dispatched and cannot be cancelled"
                                                                    : "Cancel this order"
                                                            }
                                                            style={isDispatched ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
                                                        >
                                                            <XCircle size={14} />
                                                            <span>Cancel Order</span>
                                                        </button>
                                                    )}

                                                    {/* Toggle Expand Details */}
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleOrderDetails(ord.id)}
                                                        className="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1.5 fw-medium d-inline-flex align-items-center gap-1"
                                                    >
                                                        <span>{isExpanded ? "Hide Details" : "View Details"}</span>
                                                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* ======================================================== */}
                                            {/* 3. CONNECTED PROGRESS STEPPER */}
                                            {/* ======================================================== */}
                                            {!isCancelled ? (
                                                <div
                                                    className="px-3 px-md-4 py-3 border-bottom"
                                                    style={{ backgroundColor: isDelivered ? "#f0fdf4" : "#ffffff" }}
                                                >
                                                    <div className="position-relative py-2" style={{ maxWidth: "680px", margin: "0 auto" }}>
                                                        {/* Base connecting line */}
                                                        <div
                                                            className="position-absolute start-0 end-0 top-50 translate-middle-y bg-light-subtle border-top border-2"
                                                            style={{ zIndex: 1, margin: "0 35px" }}
                                                        />
                                                        {/* Filled green connecting line based on rank */}
                                                        <div
                                                            className="position-absolute start-0 top-50 translate-middle-y bg-success"
                                                            style={{
                                                                zIndex: 2,
                                                                margin: "0 35px",
                                                                height: "3px",
                                                                width: `${Math.min(100, Math.max(0, ((currentRank - 1) / 4) * 100))}%`,
                                                                transition: "width 0.4s ease",
                                                            }}
                                                        />

                                                        {/* 5 Stages Checkpoint Nodes */}
                                                        <div className="d-flex justify-content-between position-relative" style={{ zIndex: 3 }}>
                                                            {ORDER_STAGES.map((stg, sIdx) => {
                                                                const stepRank = STAGE_RANK[stg.key];
                                                                const isPassed = currentRank > stepRank;
                                                                const isCurrent = currentRank === stepRank;
                                                                const isDeliveredStep = isDelivered && stg.key === "Delivered";
                                                                const isCompleted = isPassed || isDeliveredStep;

                                                                return (
                                                                    <div key={stg.key} className="text-center" style={{ width: "80px" }}>
                                                                        <div
                                                                            className={`rounded-circle mx-auto d-flex align-items-center justify-content-center shadow-sm ${
                                                                                isCompleted
                                                                                    ? "bg-success text-white border-2 border-success"
                                                                                    : isCurrent
                                                                                    ? "bg-navy text-white border-2 border-navy"
                                                                                    : "bg-white text-muted border-2 border-secondary-subtle"
                                                                            }`}
                                                                            style={{
                                                                                width: "28px",
                                                                                height: "28px",
                                                                                fontSize: "0.72rem",
                                                                                transition: "all 0.3s ease",
                                                                            }}
                                                                        >
                                                                            {isCompleted ? (
                                                                                <CheckCircle2 size={16} />
                                                                            ) : isCurrent ? (
                                                                                <span
                                                                                    className="spinner-grow spinner-grow-sm"
                                                                                    role="status"
                                                                                    style={{ width: "8px", height: "8px" }}
                                                                                />
                                                                            ) : (
                                                                                <span>{sIdx + 1}</span>
                                                                            )}
                                                                        </div>
                                                                        <div
                                                                            className={`extra-small mt-1 text-truncate fw-semibold ${
                                                                                isCompleted ? "text-success" : isCurrent ? "text-navy fw-bold" : "text-muted"
                                                                            }`}
                                                                            style={{ fontSize: "0.72rem" }}
                                                                        >
                                                                            {stg.label}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div
                                                    className="px-3 px-md-4 py-2.5 border-bottom d-flex align-items-center gap-2 small"
                                                    style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}
                                                >
                                                    <XCircle size={16} className="text-danger flex-shrink-0" />
                                                    <span className="fw-semibold">
                                                        Order Cancelled — Reserved equipment returned to branch stock. Fulfillment stopped.
                                                    </span>
                                                </div>
                                            )}

                                            {/* ======================================================== */}
                                            {/* 4. ITEMS SUMMARY PREVIEW BAR */}
                                            {/* ======================================================== */}
                                            <div
                                                className="px-3 px-md-4 py-2.5 d-flex flex-wrap align-items-center justify-content-between gap-2 small"
                                                style={{
                                                    backgroundColor: isCancelled ? "#fff5f5" : isDelivered ? "#f0fdf4" : "#ffffff",
                                                }}
                                            >
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className="badge bg-light text-navy border px-2.5 py-1">
                                                        {ord.item_count ? `${ord.item_count} Item${ord.item_count > 1 ? "s" : ""}` : "Equipment"}
                                                    </span>
                                                    <span className="text-muted text-truncate" style={{ maxWidth: "480px" }}>
                                                        {ord.item_summary || "Cricket equipment items ordered"}
                                                    </span>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => toggleOrderDetails(ord.id)}
                                                    className="btn btn-link btn-sm text-navy fw-semibold p-0 text-decoration-none d-inline-flex align-items-center gap-1 hover-teal"
                                                >
                                                    <span>{isExpanded ? "Close Item Details" : "Inspect Products & Delivery"}</span>
                                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                </button>
                                            </div>

                                            {/* ======================================================== */}
                                            {/* 5. EXPANDED LINE ITEMS & TIMELINE DRAWER */}
                                            {/* ======================================================== */}
                                            {isExpanded && (
                                                <div
                                                    className="p-3 p-md-4 border-top"
                                                    style={{
                                                        backgroundColor: isCancelled ? "#fff5f5" : isDelivered ? "#f0fdf4" : "#f8fafc",
                                                    }}
                                                >
                                                    {loadingDetails && lineItems.length === 0 ? (
                                                        <div className="text-center py-4">
                                                            <div className="spinner-border spinner-border-sm text-navy" />
                                                            <span className="small text-muted ms-2">Loading order details...</span>
                                                        </div>
                                                    ) : (
                                                        <div className="row g-4">
                                                            {/* Left Column: Items List & Fulfillment Details */}
                                                            <div className="col-12 col-lg-7">
                                                                <h6 className="fw-bold text-navy small mb-3 display-font d-flex align-items-center gap-1.5">
                                                                    <Package size={15} />
                                                                    <span>ORDERED ITEMS ({lineItems.length})</span>
                                                                </h6>

                                                                <div className="bg-white rounded-3 border overflow-hidden mb-3">
                                                                    {lineItems.map((item) => (
                                                                        <div
                                                                            key={item.id}
                                                                            className="p-3 d-flex justify-content-between align-items-center border-bottom last-border-0"
                                                                        >
                                                                            <div className="d-flex align-items-center gap-2.5">
                                                                                <div
                                                                                    className="rounded-3 bg-light d-flex align-items-center justify-content-center p-2 border"
                                                                                    style={{ width: "42px", height: "42px" }}
                                                                                >
                                                                                    <ShoppingBag size={18} className="text-navy" />
                                                                                </div>
                                                                                <div>
                                                                                    <div className="fw-semibold text-dark small">
                                                                                        {item.product_name}
                                                                                    </div>
                                                                                    <div className="text-muted extra-small">
                                                                                        Qty: <strong>{item.quantity}</strong> × ₹
                                                                                        {Number(item.unit_price).toLocaleString("en-IN")}
                                                                                        {item.product_code && ` · SKU: ${item.product_code}`}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="fw-bold text-dark text-end small">
                                                                                ₹{Number(item.line_total).toLocaleString("en-IN")}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>

                                                                {/* Delivery & Destination Address Card */}
                                                                <div className="bg-white rounded-3 p-3 border mb-3">
                                                                    <div className="fw-bold text-navy small mb-1.5 d-flex align-items-center gap-1">
                                                                        <MapPin size={14} className="text-danger" />
                                                                        <span>
                                                                            {isPickup ? "Pickup Branch Location:" : "Delivery Address:"}
                                                                        </span>
                                                                    </div>
                                                                    {isPickup ? (
                                                                        <div className="small text-muted">
                                                                            <strong className="text-dark d-block">
                                                                                {ord.branch_name || "CST Pro Cricket Academy (Main)"}
                                                                            </strong>
                                                                            <span>Please bring this Order Number (#<strong>{ord.order_no}</strong>) when collecting items from the academy branch.</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="small text-muted">
                                                                            <strong className="text-dark d-block">{ord.customer_name}</strong>
                                                                            <span>{ord.delivery_address},{" "}
                                                                            {[ord.delivery_city, ord.delivery_state, ord.delivery_pincode]
                                                                                .filter(Boolean)
                                                                                .join(", ")}</span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Pricing Breakdown Summary */}
                                                                <div className="bg-white rounded-3 p-3 border small">
                                                                    <div className="d-flex justify-content-between text-muted mb-1">
                                                                        <span>Subtotal</span>
                                                                        <span>₹{Number(ord.subtotal || 0).toLocaleString("en-IN")}</span>
                                                                    </div>
                                                                    {Number(ord.delivery_charge) > 0 && (
                                                                        <div className="d-flex justify-content-between text-muted mb-1">
                                                                            <span>Delivery Fee</span>
                                                                            <span>₹{Number(ord.delivery_charge).toLocaleString("en-IN")}</span>
                                                                        </div>
                                                                    )}
                                                                    {Number(ord.tax_amount) > 0 && (
                                                                        <div className="d-flex justify-content-between text-muted mb-1">
                                                                            <span>Tax / GST</span>
                                                                            <span>₹{Number(ord.tax_amount).toLocaleString("en-IN")}</span>
                                                                        </div>
                                                                    )}
                                                                    <div className="d-flex justify-content-between fw-bold text-dark pt-2 border-top fs-6">
                                                                        <span>Grand Total</span>
                                                                        <span className="text-success">₹{Number(ord.grand_total || 0).toLocaleString("en-IN")}</span>
                                                                    </div>
                                                                </div>

                                                                {/* In-drawer Cancel Order Box */}
                                                                {!isCancelled && !isDelivered && (
                                                                    <div className="mt-3 p-3 rounded-3 bg-white border d-flex flex-wrap justify-content-between align-items-center gap-2">
                                                                        <div>
                                                                            <div className="fw-semibold text-dark small">Order Cancellation</div>
                                                                            <div className="text-muted extra-small">
                                                                                {isDispatched
                                                                                    ? "This order has already been dispatched and cannot be cancelled."
                                                                                    : "Cancel before dispatch to immediately return all reserved items to branch inventory."}
                                                                            </div>
                                                                        </div>
                                                                        {!isDispatched ? (
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-outline-danger btn-sm rounded-pill px-3.5 py-1.5 fw-semibold d-inline-flex align-items-center gap-1.5 shadow-sm"
                                                                                onClick={() => handleOpenCancelModal(ord)}
                                                                            >
                                                                                <XCircle size={15} />
                                                                                <span>Cancel Order</span>
                                                                            </button>
                                                                        ) : (
                                                                            <span className="badge bg-light text-muted border px-3 py-1.5 small">
                                                                                Cannot cancel (Dispatched)
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Right Column: Tracking History Timeline */}
                                                            <div className="col-12 col-lg-5">
                                                                <h6 className="fw-bold text-navy small mb-3 display-font d-flex align-items-center gap-1.5">
                                                                    <Clock size={15} />
                                                                    <span>ORDER TIMELINE</span>
                                                                </h6>

                                                                <div className="bg-white rounded-3 p-3 border">
                                                                    {statusHistory.length === 0 ? (
                                                                        <div className="small text-muted py-2">
                                                                            Order created with status: <strong className="text-navy">{ord.order_status}</strong>.
                                                                        </div>
                                                                    ) : (
                                                                        <div className="border-start border-2 ps-3 ms-2 py-1">
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

                                                                {/* Customer Assistance Card */}
                                                                <div className="mt-3 p-3 rounded-3 bg-white border small">
                                                                    <div className="fw-semibold text-navy mb-1 d-flex align-items-center gap-1">
                                                                        <HelpCircle size={14} className="text-teal" />
                                                                        <span>Need Help with this Order?</span>
                                                                    </div>
                                                                    <p className="text-muted extra-small mb-2">
                                                                        For questions regarding pickup timings, sizing exchanges, or delivery status, please contact CST Pro Academy customer support.
                                                                    </p>
                                                                    <Link href="/contact" className="btn btn-outline-dark btn-sm rounded-pill px-3 py-1 extra-small fw-semibold">
                                                                        Contact Support
                                                                    </Link>
                                                                </div>
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
                                <h5 className="fw-bold text-navy mb-1 display-font">MY GROUND &amp; NET BOOKINGS</h5>
                                <p className="text-muted small mb-0">Track turf pitch reservations, practice net slots, and tournament bookings.</p>
                            </div>
                            <Link href="/ground-booking" className="btn btn-lime text-navy btn-sm rounded-pill px-4 fw-semibold shadow-sm">
                                Book Ground Slot
                            </Link>
                        </div>

                        {loadingGround ? (
                            <div className="card border-0 shadow-sm rounded-4 p-5 bg-white text-center">
                                <div className="spinner-border text-navy mb-2" role="status" />
                                <div className="text-muted small">Loading slot bookings...</div>
                            </div>
                        ) : groundBookings.length === 0 ? (
                            <div className="card border-0 shadow-sm rounded-4 p-5 bg-white text-center">
                                <div
                                    className="rounded-circle mx-auto d-flex align-items-center justify-content-center mb-3"
                                    style={{ width: "70px", height: "70px", background: "#f1f5f9" }}
                                >
                                    <Calendar size={34} className="text-muted opacity-75" />
                                </div>
                                <h4 className="fw-bold text-navy display-font mb-2">NO GROUND BOOKINGS</h4>
                                <p className="text-muted small mb-4 mx-auto" style={{ maxWidth: "420px" }}>
                                    You have not reserved any match grounds or practice nets yet. Check availability and reserve your cricket slot.
                                </p>
                                <div>
                                    <Link href="/ground-booking" className="btn btn-navy px-4 py-2 rounded-pill fw-semibold shadow-sm">
                                        Explore Grounds &amp; Reserve Slot
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="row g-3">
                                {groundBookings.map((b) => (
                                    <div className="col-12" key={b.id}>
                                        <div className="card border rounded-4 shadow-sm p-4 bg-white">
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
                                                    Booking Date: <strong>{b.booking_date}</strong> ({b.start_time} - {b.end_time})
                                                </div>
                                            </div>

                                            <h6 className="fw-bold text-navy mb-1">{b.ground_name || "CST Pro Cricket Ground"}</h6>
                                            <div className="small text-muted mb-2">
                                                Purpose: <strong>{b.booking_purpose || "Match / Practice"}</strong>
                                            </div>

                                            {b.admin_remarks && (
                                                <div className="p-2.5 bg-light rounded-3 small text-muted border">
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

                {/* ==================================================== */}
                {/* 6. CANCEL ORDER CONFIRMATION MODAL */}
                {/* ==================================================== */}
                {cancelModalOrder && (
                    <div
                        className="modal fade show d-block"
                        tabIndex="-1"
                        style={{ background: "rgba(0,0,0,0.55)", zIndex: 1060 }}
                        onClick={() => !cancelling && setCancelModalOrder(null)}
                    >
                        <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
                                <div className="modal-header bg-danger text-white">
                                    <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                                        <AlertCircle size={20} />
                                        <span>Cancel Order #{cancelModalOrder.order_no}</span>
                                    </h5>
                                    <button
                                        type="button"
                                        className="btn-close btn-close-white"
                                        disabled={cancelling}
                                        onClick={() => setCancelModalOrder(null)}
                                    />
                                </div>

                                <div className="modal-body p-4">
                                    <div className="alert alert-warning small d-flex align-items-start gap-2 mb-3 border-0 bg-warning-subtle text-dark">
                                        <AlertCircle size={16} className="text-warning flex-shrink-0 mt-0.5" />
                                        <div>
                                            Are you sure you want to cancel this order? Any reserved items will be released back to the branch store inventory immediately.
                                        </div>
                                    </div>

                                    <div className="p-3 bg-light rounded-3 mb-3 small border">
                                        <div className="d-flex justify-content-between mb-1">
                                            <span className="text-muted">Order Total:</span>
                                            <span className="fw-bold text-navy">
                                                ₹{Number(cancelModalOrder.grand_total).toLocaleString("en-IN")}
                                            </span>
                                        </div>
                                        <div className="d-flex justify-content-between mb-1">
                                            <span className="text-muted">Fulfillment:</span>
                                            <span className="fw-semibold">
                                                {cancelModalOrder.fulfillment_type === "Pickup"
                                                    ? `Pickup (${cancelModalOrder.branch_name || "Branch"})`
                                                    : "Home Delivery"}
                                            </span>
                                        </div>
                                        <div className="d-flex justify-content-between">
                                            <span className="text-muted">Current Status:</span>
                                            <span className="badge bg-primary text-white">{cancelModalOrder.order_status}</span>
                                        </div>
                                    </div>

                                    <div className="mb-2">
                                        <label className="form-label small fw-semibold text-secondary">
                                            Why do you want to cancel this order?
                                        </label>
                                        <select
                                            className="form-select form-select-sm mb-2"
                                            value={cancelReasonPreset}
                                            onChange={(e) => setCancelReasonPreset(e.target.value)}
                                            disabled={cancelling}
                                        >
                                            <option value="Changed my mind">Changed my mind</option>
                                            <option value="Ordered by mistake / duplicate order">Ordered by mistake / duplicate order</option>
                                            <option value="Ordered incorrect size or equipment model">Ordered incorrect size or equipment model</option>
                                            <option value="Estimated delivery date is too late">Estimated delivery date is too late</option>
                                            <option value="Found alternative equipment elsewhere">Found alternative equipment elsewhere</option>
                                            <option value="Other reason">Other reason</option>
                                        </select>
                                        <textarea
                                            className="form-control form-control-sm"
                                            rows={2}
                                            placeholder="Additional notes or comments (optional)"
                                            value={cancelReason}
                                            onChange={(e) => setCancelReason(e.target.value)}
                                            disabled={cancelling}
                                        />
                                    </div>
                                </div>

                                <div className="modal-footer bg-light border-top">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary rounded-pill px-4"
                                        disabled={cancelling}
                                        onClick={() => setCancelModalOrder(null)}
                                    >
                                        Keep My Order
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-danger rounded-pill px-4 d-inline-flex align-items-center gap-1.5"
                                        disabled={cancelling}
                                        onClick={handleConfirmCancel}
                                    >
                                        {cancelling ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm" role="status" />
                                                <span>Cancelling...</span>
                                            </>
                                        ) : (
                                            <>
                                                <XCircle size={16} />
                                                <span>Yes, Cancel Order</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
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
                <div className="min-vh-100 bg-light d-flex align-items-center justify-content-center">
                    <div className="spinner-border text-navy" role="status" />
                </div>
            }
        >
            <OrdersContent />
        </Suspense>
    );
}
