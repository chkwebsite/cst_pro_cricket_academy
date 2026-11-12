"use client";

import {
    AlertCircle,
    Calendar,
    CheckCircle2,
    Clock,
    CreditCard,
    DollarSign,
    Eye,
    Filter,
    MapPin,
    Package,
    Phone,
    RefreshCw,
    Search,
    SearchSlash,
    ShoppingBag,
    ShoppingCart,
    Truck,
    User,
    X,
    XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useUser } from "../components/UserContext";
import Pagination from "../components/Pagination";

const ORDER_STATUS_COLORS = {
    Pending: "bg-warning text-dark",
    Confirmed: "bg-info text-dark",
    Processing: "bg-primary text-white",
    Ready: "bg-teal text-white",
    Dispatched: "bg-indigo text-white",
    Delivered: "bg-success text-white",
    Cancelled: "bg-danger text-white",
    Returned: "bg-secondary text-white",
};

const PAYMENT_STATUS_COLORS = {
    Pending: "bg-warning text-dark",
    Partial: "bg-info text-dark",
    Paid: "bg-success text-white",
    Failed: "bg-danger text-white",
    Refunded: "bg-secondary text-white",
};

const getEstimatedDeliveryDate = (createdDate, type = "Delivery") => {
    const days = type === "Pickup" ? 2 : 12;
    const d = createdDate ? new Date(createdDate) : new Date();
    d.setDate(d.getDate() + days);
    return d;
};

const formatDeliveryDate = (dateVal) => {
    if (!dateVal) return "—";
    const d = typeof dateVal === "string" ? new Date(dateVal.includes("T") ? dateVal : dateVal + "T00:00:00") : new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

export default function OrdersPage() {
    const { user } = useUser();
    const currentUserType = String(user?.user_type || "").toLowerCase().trim();
    const isPlayer = currentUserType.includes("player") || currentUserType === "7";

    const [orders, setOrders] = useState([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    // Filters
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [paymentFilter, setPaymentFilter] = useState("");
    const [fulfillmentFilter, setFulfillmentFilter] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [reloadCount, setReloadCount] = useState(0);

    // Modals
    const [viewOrder, setViewOrder] = useState(null);
    const [orderItems, setOrderItems] = useState([]);
    const [orderPayments, setOrderPayments] = useState([]);
    const [orderHistory, setOrderHistory] = useState([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Status Update Modal
    const [statusModalOrder, setStatusModalOrder] = useState(null);
    const [newStatus, setNewStatus] = useState("Pending");
    const [statusNotes, setStatusNotes] = useState("");
    const [updatingStatus, setUpdatingStatus] = useState(false);

    // Payment Record Modal
    const [paymentModalOrder, setPaymentModalOrder] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState("UPI");
    const [paymentAmount, setPaymentAmount] = useState("");
    const [transactionNo, setTransactionNo] = useState("");
    const [paymentNotes, setPaymentNotes] = useState("");
    const [savingPayment, setSavingPayment] = useState(false);

    // Load Orders
    useEffect(() => {
        let cancelled = false;

        async function fetchOrders() {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (search.trim()) params.set("search", search.trim());
                if (statusFilter) params.set("order_status", statusFilter);
                if (paymentFilter) params.set("payment_status", paymentFilter);
                if (fulfillmentFilter) params.set("fulfillment_type", fulfillmentFilter);
                if (startDate) params.set("start_date", startDate);
                if (endDate) params.set("end_date", endDate);

                // If logged in user is a player, restrict to their orders
                if (isPlayer && user?.id) {
                    params.set("customer_user_id", user.id);
                    if (user.email) params.set("customer_email", user.email);
                }

                const res = await fetch(`/api/orders?${params.toString()}`);
                const json = await res.json();

                if (!res.ok || !json.success) throw new Error(json.message || "Failed to load orders.");

                if (!cancelled) setOrders(json.data || []);
            } catch (err) {
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchOrders();
        return () => { cancelled = true; };
    }, [search, statusFilter, paymentFilter, fulfillmentFilter, startDate, endDate, reloadCount, isPlayer, user]);

    useEffect(() => {
        setPage(1);
    }, [search, statusFilter, paymentFilter, fulfillmentFilter, startDate, endDate]);

    // KPI Metrics
    const totalOrders = orders.length;
    const pendingOrders = orders.filter((o) => o.order_status === "Pending").length;
    const processingOrders = orders.filter((o) => ["Confirmed", "Processing", "Ready", "Dispatched"].includes(o.order_status)).length;
    const deliveredOrders = orders.filter((o) => o.order_status === "Delivered").length;
    const totalRevenue = orders.filter((o) => o.order_status !== "Cancelled").reduce((acc, o) => acc + Number(o.grand_total || 0), 0);

    const totalPages = Math.ceil(orders.length / PAGE_SIZE) || 1;
    const pagedOrders = orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // Open View Order Modal & Fetch details
    const handleOpenView = async (order) => {
        setViewOrder(order);
        setLoadingDetails(true);

        try {
            const [itemsRes, payRes, histRes] = await Promise.all([
                fetch(`/api/order-items?order_id=${order.id}`),
                fetch(`/api/order-payments?order_id=${order.id}`),
                fetch(`/api/order-status-history?order_id=${order.id}`),
            ]);

            const [itemsJson, payJson, histJson] = await Promise.all([
                itemsRes.json(),
                payRes.json(),
                histRes.json(),
            ]);

            setOrderItems(itemsJson.data || []);
            setOrderPayments(payJson.data || []);
            setOrderHistory(histJson.data || []);
        } catch {
            setOrderItems([]);
            setOrderPayments([]);
            setOrderHistory([]);
        } finally {
            setLoadingDetails(false);
        }
    };

    // Open Status Update Modal
    const handleOpenStatusModal = (order) => {
        if (order.order_status === "Delivered") {
            alert("This order is already Delivered. All modifications are disabled.");
            return;
        }
        if (order.order_status === "Cancelled") {
            alert("This order is already Cancelled. Status cannot be modified.");
            return;
        }
        setStatusModalOrder(order);
        setNewStatus(order.order_status || "Pending");
        setStatusNotes("");
    };

    // Save Status Update
    const handleSaveStatus = async (e) => {
        e.preventDefault();
        if (!statusModalOrder) return;

        // Dispatched orders cannot be cancelled
        if (newStatus === "Cancelled" && (statusModalOrder.order_status === "Dispatched" || statusModalOrder.order_status === "Delivered")) {
            alert("Cannot cancel an order that is already dispatched or delivered.");
            return;
        }

        setUpdatingStatus(true);

        try {
            const res = await fetch(`/api/orders/${statusModalOrder.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    order_status: newStatus,
                    notes: statusNotes.trim() || `Status updated to ${newStatus}`,
                    actor_type: "Academy User",
                    actor_id: user?.id || null,
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to update order status.");

            setNotice(`Order #${statusModalOrder.order_no} status changed to ${newStatus}.`);
            setTimeout(() => setNotice(null), 3500);
            setStatusModalOrder(null);
            setReloadCount((c) => c + 1);
        } catch (err) {
            alert(err.message);
        } finally {
            setUpdatingStatus(false);
        }
    };

    // Open Payment Record Modal
    const handleOpenPaymentModal = (order) => {
        setPaymentModalOrder(order);
        setPaymentMethod("UPI");
        setPaymentAmount(order.grand_total || "");
        setTransactionNo("");
        setPaymentNotes("");
    };

    // Save Payment Record
    const handleSavePayment = async (e) => {
        e.preventDefault();
        if (!paymentModalOrder) return;
        setSavingPayment(true);

        try {
            const res = await fetch("/api/order-payments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    order_id: paymentModalOrder.id,
                    payment_method: paymentMethod,
                    payment_status: "Success",
                    amount: Number(paymentAmount),
                    transaction_no: transactionNo.trim() || null,
                    notes: paymentNotes.trim() || null,
                    payment_date: new Date().toISOString().slice(0, 19).replace("T", " "),
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to record payment.");

            // Also update order payment status to Paid
            await fetch(`/api/orders/${paymentModalOrder.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    payment_status: "Paid",
                    payment_method: paymentMethod,
                }),
            });

            setNotice(`Payment of ₹${Number(paymentAmount).toLocaleString("en-IN")} recorded for #${paymentModalOrder.order_no}.`);
            setTimeout(() => setNotice(null), 3500);
            setPaymentModalOrder(null);
            setReloadCount((c) => c + 1);
        } catch (err) {
            alert(err.message);
        } finally {
            setSavingPayment(false);
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
                            style={{ background: "#e8eaf6", color: "#283593" }}
                        >
                            <ShoppingCart size={24} />
                        </div>
                        <div>
                            <h3 className="mb-0 fw-bold text-dark">
                                {isPlayer ? "My Orders & Purchases" : "Customer Orders"}
                            </h3>
                            <p className="text-muted small mb-0">
                                {isPlayer
                                    ? "Track your academy gear, kit orders, and shipment delivery updates."
                                    : "Review e-commerce orders, track fulfillment status, record payments, and inspect order histories."}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="btn btn-outline-secondary d-flex align-items-center gap-1"
                        onClick={() => setReloadCount((c) => c + 1)}
                    >
                        <RefreshCw size={16} />
                        <span>Refresh</span>
                    </button>
                </div>

                {/* KPI Metrics */}
                <div className="row g-3 mt-3 pt-3 border-top">
                    <div className="col-6 col-md">
                        <div className="p-3 rounded-3 bg-light border d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small fw-medium">Total Orders</div>
                                <div className="fs-4 fw-bold text-dark">{totalOrders}</div>
                            </div>
                            <ShoppingCart className="text-primary opacity-75" size={26} />
                        </div>
                    </div>
                    <div className="col-6 col-md">
                        <div className="p-3 rounded-3 bg-light border d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small fw-medium">{isPlayer ? "Awaiting Confirmation" : "New / Pending"}</div>
                                <div className="fs-4 fw-bold text-warning">{pendingOrders}</div>
                            </div>
                            <Clock className="text-warning opacity-75" size={26} />
                        </div>
                    </div>
                    <div className="col-6 col-md">
                        <div className="p-3 rounded-3 bg-light border d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small fw-medium">{isPlayer ? "In Transit / Ready" : "In Progress"}</div>
                                <div className="fs-4 fw-bold text-info">{processingOrders}</div>
                            </div>
                            <Truck className="text-info opacity-75" size={26} />
                        </div>
                    </div>
                    <div className="col-6 col-md">
                        <div className="p-3 rounded-3 bg-light border d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small fw-medium">{isPlayer ? "Delivered / Received" : "Completed"}</div>
                                <div className="fs-4 fw-bold text-success">{deliveredOrders}</div>
                            </div>
                            <CheckCircle2 className="text-success opacity-75" size={26} />
                        </div>
                    </div>
                    <div className="col-12 col-md">
                        <div className="p-3 rounded-3 bg-light border d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small fw-medium">{isPlayer ? "Total Spent" : "Revenue"}</div>
                                <div className="fs-4 fw-bold text-success">₹{totalRevenue.toLocaleString("en-IN")}</div>
                            </div>
                            <DollarSign className="text-success opacity-75" size={26} />
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
                        <div className="input-group" style={{ maxWidth: "280px" }}>
                            <span className="input-group-text bg-light border-end-0">
                                <Search size={16} className="text-muted" />
                            </span>
                            <input
                                type="text"
                                className="form-control border-start-0"
                                placeholder="Search order no, customer..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <select
                            className="form-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{ maxWidth: "160px" }}
                        >
                            <option value="">All Statuses</option>
                            <option value="Pending">Pending</option>
                            <option value="Confirmed">Confirmed</option>
                            <option value="Processing">Processing</option>
                            <option value="Ready">Ready</option>
                            <option value="Dispatched">Dispatched</option>
                            <option value="Delivered">Delivered</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>

                        <select
                            className="form-select"
                            value={paymentFilter}
                            onChange={(e) => setPaymentFilter(e.target.value)}
                            style={{ maxWidth: "150px" }}
                        >
                            <option value="">All Payments</option>
                            <option value="Pending">Pending</option>
                            <option value="Paid">Paid</option>
                            <option value="Partial">Partial</option>
                            <option value="Failed">Failed</option>
                        </select>

                        <select
                            className="form-select"
                            value={fulfillmentFilter}
                            onChange={(e) => setFulfillmentFilter(e.target.value)}
                            style={{ maxWidth: "140px" }}
                        >
                            <option value="">All Delivery</option>
                            <option value="Delivery">Home Delivery</option>
                            <option value="Pickup">Store Pickup</option>
                        </select>

                        {(search || statusFilter || paymentFilter || fulfillmentFilter) && (
                            <button
                                type="button"
                                className="btn btn-outline-secondary d-flex align-items-center gap-1"
                                onClick={() => {
                                    setSearch("");
                                    setStatusFilter("");
                                    setPaymentFilter("");
                                    setFulfillmentFilter("");
                                }}
                            >
                                <SearchSlash size={16} />
                                <span>Reset</span>
                            </button>
                        )}
                    </div>
                    <div className="text-muted small">
                        Showing <strong>{orders.length}</strong> orders
                    </div>
                </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-4 shadow-sm border overflow-hidden">
                {loading ? (
                    <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status" />
                        <p className="text-muted small mt-2 mb-0">Loading orders...</p>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-5">
                        <ShoppingCart size={48} className="text-muted opacity-50 mb-2" />
                        <h5 className="fw-semibold text-secondary">{isPlayer ? "No Orders Placed Yet" : "No Orders Found"}</h5>
                        <p className="text-muted small mb-0">
                            {isPlayer
                                ? "You have not placed any orders yet. Visit the academy merchandise store to order gear and kits."
                                : "Customer orders placed on the website store will appear here."}
                        </p>
                    </div>
                ) : (
                    <>
                    <div className="table-responsive">
                        <table className="table align-middle table-hover mb-0">
                            <thead className="table-light text-secondary small text-uppercase">
                                <tr>
                                    <th style={{ width: "40px" }} className="text-center">#</th>
                                    <th>Order No</th>
                                    <th>Saler Name</th>
                                    <th>Buyer Name</th>
                                    <th>Deliver Point</th>
                                    <th>Total (₹)</th>
                                    <th>Payment</th>
                                    <th className="text-center">Order Status</th>
                                    <th>Order Date</th>
                                    <th>Delivery Date</th>
                                    <th style={{ width: "160px" }} className="text-end pe-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedOrders.map((item, idx) => {
                                    const isDelivered = item.order_status === "Delivered";
                                    const isCancelled = item.order_status === "Cancelled";

                                    // Dynamic background based on order lifecycle
                                    // Delivered: Light Green (#f0fdf4)
                                    // Cancelled: Light Red (#fef2f2)
                                    const rowStyle = isDelivered
                                        ? { backgroundColor: "#f0fdf4" }
                                        : isCancelled
                                        ? { backgroundColor: "#fef2f2" }
                                        : undefined;

                                    return (
                                        <tr key={item.id} style={rowStyle} className={isDelivered ? "border-success-subtle" : isCancelled ? "border-danger-subtle" : ""}>
                                            <td className="text-center text-muted small fw-medium">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                                            {/* Order No */}
                                            <td>
                                                <div className="fw-bold text-dark font-monospace" style={{ fontSize: "0.88rem" }}>
                                                    {item.order_no}
                                                </div>
                                                <span className="badge bg-light text-muted border" style={{ fontSize: "0.68rem" }}>
                                                    ID: #{item.id}
                                                </span>
                                            </td>
                                            {/* Saler Name */}
                                            <td>
                                                <div className="d-flex align-items-center gap-1.5 fw-semibold text-dark small">
                                                    <MapPin size={13} className="text-danger flex-shrink-0" />
                                                    <span>{item.branch_name || item.academy_name || "Main Branch"}</span>
                                                </div>
                                                <div className="extra-small text-muted" style={{ fontSize: "0.72rem" }}>
                                                    {item.academy_name && item.academy_name !== item.branch_name ? item.academy_name : "Seller Store"}
                                                </div>
                                            </td>
                                            {/* Buyer Name */}
                                            <td>
                                                <div className="fw-semibold text-dark">{item.customer_name}</div>
                                                <div className="small text-muted d-flex align-items-center gap-1">
                                                    <Phone size={11} />
                                                    <span>{item.customer_phone}</span>
                                                </div>
                                                {item.customer_email && (
                                                    <div className="extra-small text-muted text-truncate" style={{ maxWidth: "150px", fontSize: "0.72rem" }}>
                                                        {item.customer_email}
                                                    </div>
                                                )}
                                            </td>
                                            {/* Deliver Point */}
                                            <td>
                                                <div className="d-flex align-items-center gap-1 small fw-medium">
                                                    {item.fulfillment_type === "Delivery" ? (
                                                        <>
                                                            <Truck size={14} className="text-primary flex-shrink-0" />
                                                            <span>Home Delivery</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Package size={14} className="text-teal flex-shrink-0" />
                                                            <span>Store Pickup</span>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="text-muted extra-small mt-0.5" style={{ fontSize: "0.74rem" }}>
                                                    {item.fulfillment_type === "Pickup"
                                                        ? (item.branch_name || "Pickup at Branch")
                                                        : [item.delivery_address, item.delivery_city, item.delivery_pincode].filter(Boolean).join(", ") || (item.delivery_city || "Delivery Address")}
                                                </div>
                                            </td>
                                            {/* Total */}
                                            <td>
                                                <div className="fw-bold text-dark fs-6">
                                                    ₹{Number(item.grand_total).toLocaleString("en-IN")}
                                                </div>
                                                <span className="text-muted small">
                                                    Sub: ₹{Number(item.subtotal).toLocaleString("en-IN")}
                                                </span>
                                            </td>
                                            {/* Payment */}
                                            <td>
                                                <span className={`badge ${PAYMENT_STATUS_COLORS[item.payment_status] || "bg-secondary"} px-2 py-1 small`}>
                                                    {item.payment_status}
                                                </span>
                                                <div className="small text-muted mt-1">{item.payment_method}</div>
                                            </td>
                                            {/* Order Status */}
                                            <td className="text-center">
                                                <span className={`badge ${ORDER_STATUS_COLORS[item.order_status] || "bg-secondary"} px-2 py-1`}>
                                                    {item.order_status}
                                                </span>
                                            </td>
                                            {/* Order Date */}
                                            <td className="text-muted small">
                                                {item.created_at
                                                    ? new Date(item.created_at).toLocaleDateString("en-IN", {
                                                          day: "2-digit",
                                                          month: "short",
                                                          year: "numeric",
                                                          hour: "2-digit",
                                                          minute: "2-digit",
                                                      })
                                                    : "—"}
                                            </td>
                                            {/* Delivery Date */}
                                            <td>
                                                <div className="fw-semibold text-dark small d-flex align-items-center gap-1">
                                                    <Calendar size={13} className="text-primary flex-shrink-0" />
                                                    <span>
                                                        {formatDeliveryDate(item.estimated_delivery_date || getEstimatedDeliveryDate(item.created_at, item.fulfillment_type))}
                                                    </span>
                                                </div>
                                                <span className="badge bg-light text-muted border extra-small mt-0.5" style={{ fontSize: "0.68rem" }}>
                                                    {item.fulfillment_type === "Pickup" ? "+2D (Pickup)" : "+12D (Delivery)"}
                                                </span>
                                            </td>
                                            {/* Actions */}
                                            <td className="text-end pe-3">
                                                <div className="btn-group btn-group-sm">
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-info"
                                                        onClick={() => handleOpenView(item)}
                                                        title="View Full Details"
                                                    >
                                                        <Eye size={15} />
                                                    </button>
                                                    {!isPlayer && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-primary"
                                                                onClick={() => handleOpenStatusModal(item)}
                                                                disabled={isDelivered || isCancelled}
                                                                title={
                                                                    isDelivered
                                                                        ? "Order Delivered — all modifications disabled"
                                                                        : isCancelled
                                                                        ? "Order Cancelled — modification disabled"
                                                                        : "Update Order Status"
                                                                }
                                                                style={isDelivered || isCancelled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                                                            >
                                                                <Truck size={15} />
                                                            </button>
                                                            {item.payment_status !== "Paid" && (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-outline-success"
                                                                    onClick={() => handleOpenPaymentModal(item)}
                                                                    disabled={isDelivered || isCancelled}
                                                                    title={
                                                                        isDelivered
                                                                            ? "Order Delivered — all buttons disabled"
                                                                            : isCancelled
                                                                            ? "Order Cancelled — disabled"
                                                                            : "Record Payment"
                                                                    }
                                                                    style={isDelivered || isCancelled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                                                                >
                                                                    <CreditCard size={15} />
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
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
                        total={orders.length}
                        onPageChange={setPage}
                        pageSize={PAGE_SIZE}
                    />
                    </>
                )}
            </div>

            {/* MODAL 1: VIEW ORDER DETAILS */}
            {viewOrder && (
                <div
                    className="modal fade show d-block"
                    tabIndex="-1"
                    style={{ background: "rgba(0,0,0,0.5)" }}
                    onClick={() => setViewOrder(null)}
                >
                    <div className="modal-dialog modal-dialog-centered modal-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
                            <div className="modal-header bg-light border-bottom">
                                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                                    <ShoppingCart size={22} className="text-primary" />
                                    <span>Order Details: {viewOrder.order_no}</span>
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setViewOrder(null)} />
                            </div>

                            <div className="modal-body p-4">
                                {loadingDetails ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-primary" />
                                    </div>
                                ) : (
                                    <div className="row g-4">
                                        {/* Order Info & Customer Summary */}
                                        <div className="col-md-4">
                                            <div className="bg-light p-3 rounded-3 border h-100">
                                                <h6 className="fw-bold text-dark mb-3">Customer Information</h6>
                                                <div className="mb-2">
                                                    <span className="text-muted small d-block">Name:</span>
                                                    <span className="fw-semibold text-dark">{viewOrder.customer_name}</span>
                                                </div>
                                                <div className="mb-2">
                                                    <span className="text-muted small d-block">Phone:</span>
                                                    <a href={`tel:${viewOrder.customer_phone}`} className="text-decoration-none">
                                                        {viewOrder.customer_phone}
                                                    </a>
                                                </div>
                                                {viewOrder.customer_email && (
                                                    <div className="mb-2">
                                                        <span className="text-muted small d-block">Email:</span>
                                                        <span className="small text-dark">{viewOrder.customer_email}</span>
                                                    </div>
                                                )}
                                                <hr className="my-3" />

                                                <h6 className="fw-bold text-dark mb-2">Fulfillment Details</h6>
                                                <div className="mb-2">
                                                    <span className="text-muted small d-block">Type:</span>
                                                    <span className="badge bg-primary-subtle text-primary border">{viewOrder.fulfillment_type}</span>
                                                </div>
                                                {viewOrder.fulfillment_type === "Delivery" ? (
                                                    <div className="mb-2">
                                                        <span className="text-muted small d-block">Delivery Address:</span>
                                                        <span className="small text-dark">
                                                            {viewOrder.delivery_address}, {viewOrder.delivery_city}, {viewOrder.delivery_state} - {viewOrder.delivery_pincode}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="mb-2">
                                                        <span className="text-muted small d-block">Pickup Branch:</span>
                                                        <span className="small text-dark">{viewOrder.branch_name || "Academy Branch"}</span>
                                                    </div>
                                                )}
                                                <div className="mb-2">
                                                    <span className="text-muted small d-block">
                                                        {viewOrder.fulfillment_type === "Pickup" ? "Estimated Ready Date (+2 Days):" : "Estimated Delivery Date (+12 Days):"}
                                                    </span>
                                                    <span className="badge bg-light text-dark border fw-bold px-2.5 py-1 small">
                                                        <Calendar size={12} className="me-1 text-primary" />
                                                        {formatDeliveryDate(viewOrder.estimated_delivery_date || getEstimatedDeliveryDate(viewOrder.created_at, viewOrder.fulfillment_type))}
                                                    </span>
                                                </div>

                                                <hr className="my-3" />
                                                <div className="d-flex justify-content-between align-items-center mb-1">
                                                    <span className="text-muted small">Order Status:</span>
                                                    <span className={`badge ${ORDER_STATUS_COLORS[viewOrder.order_status] || "bg-secondary"}`}>
                                                        {viewOrder.order_status}
                                                    </span>
                                                </div>
                                                <div className="d-flex justify-content-between align-items-center mb-1">
                                                    <span className="text-muted small">Payment Status:</span>
                                                    <span className={`badge ${PAYMENT_STATUS_COLORS[viewOrder.payment_status] || "bg-secondary"}`}>
                                                        {viewOrder.payment_status}
                                                    </span>
                                                </div>
                                                <div className="d-flex justify-content-between align-items-center">
                                                    <span className="text-muted small">Method:</span>
                                                    <span className="small fw-semibold">{viewOrder.payment_method}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Items & Payment Breakdown */}
                                        <div className="col-md-8">
                                            <h6 className="fw-bold text-dark mb-2">Order Items</h6>
                                            <div className="table-responsive border rounded-3 mb-4">
                                                <table className="table align-middle table-sm mb-0">
                                                    <thead className="table-light small text-uppercase">
                                                        <tr>
                                                            <th>Product</th>
                                                            <th className="text-end">Unit Price</th>
                                                            <th className="text-center">Qty</th>
                                                            <th className="text-end">Line Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {orderItems.map((item) => (
                                                            <tr key={item.id}>
                                                                <td>
                                                                    <div className="fw-semibold text-dark">{item.product_name}</div>
                                                                    {item.product_code && <code className="small">{item.product_code}</code>}
                                                                </td>
                                                                <td className="text-end">₹{Number(item.unit_price).toLocaleString("en-IN")}</td>
                                                                <td className="text-center fw-bold">{item.quantity}</td>
                                                                <td className="text-end fw-bold">₹{Number(item.line_total).toLocaleString("en-IN")}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot className="table-light">
                                                        <tr>
                                                            <td colSpan="3" className="text-end small">Subtotal:</td>
                                                            <td className="text-end fw-semibold">₹{Number(viewOrder.subtotal).toLocaleString("en-IN")}</td>
                                                        </tr>
                                                        <tr>
                                                            <td colSpan="3" className="text-end small">Tax Amount:</td>
                                                            <td className="text-end fw-semibold">₹{Number(viewOrder.tax_amount).toLocaleString("en-IN")}</td>
                                                        </tr>
                                                        {Number(viewOrder.delivery_charge) > 0 && (
                                                            <tr>
                                                                <td colSpan="3" className="text-end small">Delivery Charge:</td>
                                                                <td className="text-end fw-semibold">₹{Number(viewOrder.delivery_charge).toLocaleString("en-IN")}</td>
                                                            </tr>
                                                        )}
                                                        <tr className="table-success">
                                                            <td colSpan="3" className="text-end fw-bold">Grand Total:</td>
                                                            <td className="text-end fw-bold fs-5 text-success">
                                                                ₹{Number(viewOrder.grand_total).toLocaleString("en-IN")}
                                                            </td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>

                                            {/* Status Timeline History */}
                                            {orderHistory.length > 0 && (
                                                <div className="mt-3">
                                                    <h6 className="fw-bold text-dark mb-2">Status Timeline</h6>
                                                    <div className="list-group list-group-flush border rounded-3 overflow-hidden">
                                                        {orderHistory.map((h) => (
                                                            <div key={h.id} className="list-group-item d-flex justify-content-between align-items-center py-2 small">
                                                                <div>
                                                                    <span className="fw-semibold text-dark">{h.new_status}</span>
                                                                    {h.notes && <span className="text-muted ms-2">— {h.notes}</span>}
                                                                </div>
                                                                <div className="text-muted text-nowrap">
                                                                    {new Date(h.created_at).toLocaleString("en-IN", {
                                                                        day: "2-digit",
                                                                        month: "short",
                                                                        hour: "2-digit",
                                                                        minute: "2-digit",
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer bg-light border-top">
                                <button
                                    type="button"
                                    className="btn btn-secondary px-4"
                                    onClick={() => setViewOrder(null)}
                                >
                                    Close
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary px-3 d-flex align-items-center gap-1"
                                    disabled={viewOrder.order_status === "Delivered" || viewOrder.order_status === "Cancelled"}
                                    title={
                                        viewOrder.order_status === "Delivered"
                                            ? "Order Delivered — all modifications disabled"
                                            : viewOrder.order_status === "Cancelled"
                                            ? "Order Cancelled — disabled"
                                            : "Update Status"
                                    }
                                    style={viewOrder.order_status === "Delivered" || viewOrder.order_status === "Cancelled" ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                                    onClick={() => {
                                        const ord = viewOrder;
                                        setViewOrder(null);
                                        handleOpenStatusModal(ord);
                                    }}
                                >
                                    <Truck size={16} />
                                    <span>Update Status</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2: UPDATE ORDER STATUS */}
            {statusModalOrder && (
                <div
                    className="modal fade show d-block"
                    tabIndex="-1"
                    style={{ background: "rgba(0,0,0,0.5)" }}
                    onClick={() => setStatusModalOrder(null)}
                >
                    <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
                            <form onSubmit={handleSaveStatus}>
                                <div className="modal-header bg-light border-bottom">
                                    <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                                        <Truck size={20} className="text-primary" />
                                        <span>Update Status: #{statusModalOrder.order_no}</span>
                                    </h5>
                                    <button type="button" className="btn-close" onClick={() => setStatusModalOrder(null)} />
                                </div>

                                <div className="modal-body p-4">
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-secondary">Select New Order Status</label>
                                        <select
                                            className="form-select"
                                            value={newStatus}
                                            onChange={(e) => setNewStatus(e.target.value)}
                                        >
                                            <option value="Pending">Pending</option>
                                            <option value="Confirmed">Confirmed</option>
                                            <option value="Processing">Processing</option>
                                            <option value="Ready">Ready for Pickup / Dispatch</option>
                                            <option value="Dispatched">Dispatched / Out for Delivery</option>
                                            <option value="Delivered">Delivered / Completed</option>
                                            <option
                                                value="Cancelled"
                                                disabled={statusModalOrder.order_status === "Dispatched" || statusModalOrder.order_status === "Delivered"}
                                            >
                                                Cancelled {statusModalOrder.order_status === "Dispatched" ? "(Disabled — already dispatched)" : statusModalOrder.order_status === "Delivered" ? "(Disabled — already delivered)" : ""}
                                            </option>
                                            <option value="Returned">Returned</option>
                                        </select>
                                        {statusModalOrder.order_status === "Dispatched" && (
                                            <div className="alert alert-warning py-2 px-3 mt-2 small d-flex align-items-center gap-2 mb-0">
                                                <AlertCircle size={16} className="text-warning flex-shrink-0" />
                                                <span>This order is already <strong>Dispatched</strong>. Cancel action is disabled.</span>
                                            </div>
                                        )}
                                        {statusModalOrder.order_status === "Delivered" && (
                                            <div className="alert alert-success py-2 px-3 mt-2 small d-flex align-items-center gap-2 mb-0">
                                                <CheckCircle2 size={16} className="text-success flex-shrink-0" />
                                                <span>This order is already <strong>Delivered</strong>. All modifications are disabled.</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-secondary">Status Change Remarks / Notes</label>
                                        <textarea
                                            className="form-control"
                                            rows={2}
                                            placeholder="e.g. Courier tracking link: BlueDart #12345"
                                            value={statusNotes}
                                            onChange={(e) => setStatusNotes(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="modal-footer bg-light border-top">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary px-4"
                                        onClick={() => setStatusModalOrder(null)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary px-4"
                                        disabled={updatingStatus}
                                    >
                                        {updatingStatus ? "Saving..." : "Update Status"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 3: RECORD PAYMENT */}
            {paymentModalOrder && (
                <div
                    className="modal fade show d-block"
                    tabIndex="-1"
                    style={{ background: "rgba(0,0,0,0.5)" }}
                    onClick={() => setPaymentModalOrder(null)}
                >
                    <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
                            <form onSubmit={handleSavePayment}>
                                <div className="modal-header bg-light border-bottom">
                                    <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                                        <CreditCard size={20} className="text-success" />
                                        <span>Record Payment: #{paymentModalOrder.order_no}</span>
                                    </h5>
                                    <button type="button" className="btn-close" onClick={() => setPaymentModalOrder(null)} />
                                </div>

                                <div className="modal-body p-4">
                                    <div className="p-3 mb-3 bg-light rounded-3 border">
                                        <div className="d-flex justify-content-between align-items-center">
                                            <span className="text-muted small">Total Due:</span>
                                            <span className="fw-bold fs-5 text-success">
                                                ₹{Number(paymentModalOrder.grand_total).toLocaleString("en-IN")}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-secondary">Payment Method *</label>
                                        <select
                                            className="form-select"
                                            value={paymentMethod}
                                            onChange={(e) => setPaymentMethod(e.target.value)}
                                        >
                                            <option value="UPI">UPI / QR Code</option>
                                            <option value="Cash">Cash in Hand</option>
                                            <option value="Card">Debit / Credit Card</option>
                                            <option value="Bank Transfer">Bank Transfer / NEFT</option>
                                            <option value="COD">Cash on Delivery (Collected)</option>
                                        </select>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-secondary">Amount Received (₹) *</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="form-control"
                                            required
                                            value={paymentAmount}
                                            onChange={(e) => setPaymentAmount(e.target.value)}
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-secondary">Transaction / Reference Number</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="UPI Ref ID, Receipt No, or Bank UTR"
                                            value={transactionNo}
                                            onChange={(e) => setTransactionNo(e.target.value)}
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-secondary">Notes</label>
                                        <textarea
                                            className="form-control"
                                            rows={2}
                                            placeholder="Optional payment notes..."
                                            value={paymentNotes}
                                            onChange={(e) => setPaymentNotes(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="modal-footer bg-light border-top">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary px-4"
                                        onClick={() => setPaymentModalOrder(null)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-success px-4"
                                        disabled={savingPayment}
                                    >
                                        {savingPayment ? "Recording..." : "Save Payment"}
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
