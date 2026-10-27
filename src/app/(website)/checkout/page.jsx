"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    AlertCircle,
    ArrowLeft,
    Calendar,
    Check,
    CheckCircle2,
    Clock,
    CreditCard,
    DollarSign,
    Lock,
    MapPin,
    Package,
    ShieldCheck,
    ShoppingBag,
    Truck,
    UserCheck,
} from "lucide-react";
import { useCart } from "../components/cart/CartContext";
import { useUser } from "@/app/next_panel/components/UserContext";

// Calculate estimated delivery date: Pickup = +2 days, Delivery = +12 days
function getEstimatedDeliveryDate(type = "Delivery") {
    const days = type === "Pickup" ? 2 : 12;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
}

function formatDeliveryDate(dateObj) {
    if (!dateObj) return "";
    const d = typeof dateObj === "string" ? new Date(dateObj.includes("T") ? dateObj : dateObj + "T00:00:00") : new Date(dateObj);
    if (isNaN(d.getTime())) return String(dateObj);
    return d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

export default function CheckoutPage() {
    const router = useRouter();
    const { items, subtotal, taxTotal, grandTotal, clearCart } = useCart();
    const { user, isLoggedIn, login } = useUser();

    // Branches state
    const [branches, setBranches] = useState([]);
    const [loadingBranches, setLoadingBranches] = useState(true);

    // Form state
    const [fulfillmentType, setFulfillmentType] = useState("Delivery"); // "Delivery" | "Pickup"
    const [selectedBranchId, setSelectedBranchId] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("COD"); // "COD" | "UPI" | "Card" | "Bank Transfer"
    const [notes, setNotes] = useState("");

    // Contact info
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");

    // Guest account creation password (optional if guest)
    const [guestPassword, setGuestPassword] = useState("");
    const [createAccount, setCreateAccount] = useState(false);

    // Delivery Address
    const [address, setAddress] = useState("");
    const [city, setCity] = useState("");
    const [stateVal, setStateVal] = useState("");
    const [pincode, setPincode] = useState("");

    // Submission states
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    // Calculate delivery fee
    const deliveryFee = fulfillmentType === "Pickup" ? 0 : subtotal > 1500 ? 0 : 99;
    const finalTotal = grandTotal + deliveryFee;

    // Delivery estimated dates (+2 days for Pickup, +12 days for Delivery)
    const deliveryEstDate = getEstimatedDeliveryDate("Delivery");
    const pickupEstDate = getEstimatedDeliveryDate("Pickup");
    const currentEstDate = fulfillmentType === "Pickup" ? pickupEstDate : deliveryEstDate;

    // Load branches (only for academy_id = 1)
    useEffect(() => {
        let isMounted = true;
        async function fetchBranches() {
            try {
                const res = await fetch("/api/branch?status=1&academy_id=1");
                const json = await res.json();
                if (isMounted && res.ok && json.success && Array.isArray(json.data)) {
                    const filtered = json.data.filter((b) => Number(b.academy_id) === 1);
                    setBranches(filtered);
                    if (filtered.length > 0) {
                        setSelectedBranchId(String(filtered[0].id));
                    }
                }
            } catch (err) {
                console.error("Failed to load branches:", err);
            } finally {
                if (isMounted) setLoadingBranches(false);
            }
        }
        fetchBranches();
        return () => {
            isMounted = false;
        };
    }, []);

    // Autofill user details
    useEffect(() => {
        if (user) {
            setName(user.name || `${user.first_name || ""} ${user.last_name || ""}`.trim());
            setPhone(user.phone || "");
            setEmail(user.email || "");
        }
    }, [user]);

    // Handle order submission
    const handlePlaceOrder = async (e) => {
        e.preventDefault();
        setErrorMessage("");

        if (items.length === 0) {
            setErrorMessage("Your cart is empty. Add products before checking out.");
            return;
        }

        if (!name.trim()) {
            setErrorMessage("Please enter your full name.");
            return;
        }

        if (!phone.trim() || phone.replace(/[^0-9]/g, "").length < 10) {
            setErrorMessage("Please enter a valid 10-digit mobile number.");
            return;
        }

        if (!selectedBranchId) {
            setErrorMessage("Please select a fulfillment branch.");
            return;
        }

        if (fulfillmentType === "Delivery" && !address.trim()) {
            setErrorMessage("Please enter your full delivery address.");
            return;
        }

        setSubmitting(true);

        try {
            let activeUserId = user?.id;
            let isPublicUser = user?.is_public || user?.user_type === "Public User";

            // If user is NOT logged in, auto-register or authenticate as public user
            if (!isLoggedIn || !activeUserId) {
                const registerPayload = {
                    name: name.trim(),
                    email: email.trim() || `${phone.trim()}@cstpro.in`,
                    phone: phone.trim(),
                    password: guestPassword.trim().length >= 6 ? guestPassword.trim() : "CstGuest@2026",
                };

                const authRes = await fetch("/api/public-auth/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(registerPayload),
                });
                const authJson = await authRes.json();

                if (authRes.ok && authJson.success && authJson.user) {
                    activeUserId = authJson.user.id;
                    isPublicUser = true;
                    // Log them in to session storage as well
                    if (authJson.session) {
                        login(authJson.session);
                    }
                } else if (authJson.message?.includes("already exists") || authJson.message?.includes("already registered")) {
                    // If already registered, attempt fallback login with provided password
                    if (guestPassword.trim()) {
                        const loginRes = await fetch("/api/public-auth/register", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                action: "login",
                                login: phone.trim(),
                                password: guestPassword.trim(),
                            }),
                        });
                        const loginJson = await loginRes.json();
                        if (loginRes.ok && loginJson.success && loginJson.user) {
                            activeUserId = loginJson.user.id;
                            isPublicUser = true;
                            if (loginJson.session) login(loginJson.session);
                        } else {
                            throw new Error("Phone number is already registered. Please sign in or use correct password.");
                        }
                    } else {
                        // User exists but no password provided - check if user list exists
                        const checkRes = await fetch(`/api/public-users?search=${encodeURIComponent(phone.trim())}`);
                        const checkJson = await checkRes.json();
                        if (checkRes.ok && checkJson.success && checkJson.data?.length > 0) {
                            activeUserId = checkJson.data[0].id;
                            isPublicUser = true;
                        } else {
                            throw new Error("This phone number is already registered. Please login to continue.");
                        }
                    }
                } else {
                    throw new Error(authJson.message || "Failed to create public user account for order.");
                }
            }

            // 1. Create order
            const estDays = fulfillmentType === "Pickup" ? 2 : 12;
            const estDateObj = new Date();
            estDateObj.setDate(estDateObj.getDate() + estDays);
            const yyyy = estDateObj.getFullYear();
            const mm = String(estDateObj.getMonth() + 1).padStart(2, "0");
            const dd = String(estDateObj.getDate()).padStart(2, "0");
            const estimatedDeliveryDate = `${yyyy}-${mm}-${dd}`;

            const orderPayload = {
                academy_id: 1,
                customer_user_id: isPublicUser ? null : activeUserId,
                public_user_id: isPublicUser ? activeUserId : null,
                fulfillment_branch_id: Number(selectedBranchId),
                fulfillment_type: fulfillmentType,
                estimated_delivery_date: estimatedDeliveryDate,
                customer_name: name.trim(),
                customer_phone: phone.trim(),
                customer_email: email.trim() || null,
                delivery_address: fulfillmentType === "Delivery" ? address.trim() : null,
                delivery_city: fulfillmentType === "Delivery" ? city.trim() || null : null,
                delivery_state: fulfillmentType === "Delivery" ? stateVal.trim() || null : null,
                delivery_pincode: fulfillmentType === "Delivery" ? pincode.trim() || null : null,
                subtotal: Number(subtotal.toFixed(2)),
                tax_amount: Number(taxTotal.toFixed(2)),
                delivery_charge: Number(deliveryFee.toFixed(2)),
                discount_amount: 0,
                payment_method: paymentMethod,
                payment_status: "Pending",
                order_status: "Pending",
                notes: notes.trim() || null,
            };

            const orderRes = await fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(orderPayload),
            });

            const orderJson = await orderRes.json();
            if (!orderRes.ok || !orderJson.success) {
                throw new Error(orderJson.message || "Failed to place order.");
            }

            const createdOrderId = orderJson.id;
            const createdOrderNo = orderJson.order_no;

            // 2. Add each order item
            for (const item of items) {
                const unitPrice = Number(item.sale_price ?? item.price ?? 0);
                const itemPayload = {
                    order_id: createdOrderId,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    product_code: item.product_code || null,
                    quantity: item.quantity,
                    unit_price: unitPrice,
                    tax_percent: Number(item.tax_percent || 0),
                    discount_amount: 0,
                };

                const itemRes = await fetch("/api/order-items", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(itemPayload),
                });
                if (!itemRes.ok) {
                    console.warn("Item insert warning:", await itemRes.text());
                }
            }

            // 3. Log initial status history
            try {
                await fetch("/api/order-status-history", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        order_id: createdOrderId,
                        old_status: null,
                        new_status: "Pending",
                        remarks: `Order placed online via CST Pro store (${fulfillmentType} - ${paymentMethod}).`,
                        actor_type: isPublicUser ? "Public User" : "Academy User",
                        actor_id: activeUserId,
                    }),
                });
            } catch (histErr) {
                console.warn("Status history log error:", histErr);
            }

            // 4. Clear cart & redirect to order-success
            clearCart();
            router.push(`/order-success/${encodeURIComponent(createdOrderNo)}`);
        } catch (err) {
            console.error("Order placement failed:", err);
            setErrorMessage(err.message || "An unexpected error occurred while placing your order.");
            setSubmitting(false);
        }
    };

    if (!isLoggedIn || !user) {
        return (
            <div className="bg-cream min-vh-100 py-5">
                <div className="container py-5 text-center">
                    <div className="bg-white rounded-4 shadow-sm border p-4 p-md-5 max-w-500 mx-auto">
                        <div
                            className="rounded-circle d-inline-flex align-items-center justify-content-center bg-light text-navy mb-3"
                            style={{ width: "70px", height: "70px" }}
                        >
                            <Lock size={32} className="text-danger" />
                        </div>
                        <h3 className="fw-bold text-navy display-font mb-2">LOGIN REQUIRED TO CHECKOUT</h3>
                        <p className="text-muted small mb-4">
                            Please sign in to your CST Pro account to complete your order and select delivery or branch pickup.
                        </p>
                        <div className="d-flex flex-wrap justify-content-center gap-2">
                            <Link href="/login?tab=public&redirect=/checkout" className="btn btn-navy px-4 py-2.5 rounded-pill fw-semibold">
                                Sign In as Public User
                            </Link>
                            <Link href="/login?tab=academy&redirect=/checkout" className="btn btn-outline-dark px-4 py-2.5 rounded-pill fw-semibold">
                                Academy Sign In
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="bg-cream min-vh-100 py-5">
                <div className="container py-5 text-center">
                    <div className="bg-white rounded-4 shadow-sm border p-5 max-w-500 mx-auto">
                        <ShoppingBag size={48} className="text-muted mb-3 mx-auto" />
                        <h3 className="fw-bold text-navy display-font mb-2">CART IS EMPTY</h3>
                        <p className="text-muted small mb-4">
                            You have no items in your cart to checkout.
                        </p>
                        <Link href="/shop" className="btn btn-navy px-4 py-2.5 rounded-pill fw-semibold">
                            Return to Store
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-cream min-vh-100 py-5">
            <div className="container py-3">
                {/* Breadcrumb */}
                <div className="d-flex align-items-center gap-2 small text-muted mb-3">
                    <Link href="/cart" className="text-decoration-none text-muted d-flex align-items-center gap-1 hover-navy">
                        <ArrowLeft size={14} /> Back to Cart
                    </Link>
                    <span>/</span>
                    <span className="text-navy fw-semibold">Checkout</span>
                </div>

                <h2 className="display-font fw-bold text-navy mb-4">COMPLETE YOUR ORDER</h2>

                {errorMessage && (
                    <div className="alert alert-danger d-flex align-items-center gap-2 rounded-4 mb-4 p-3 shadow-sm" role="alert">
                        <AlertCircle size={20} className="flex-shrink-0" />
                        <div className="small fw-semibold">{errorMessage}</div>
                    </div>
                )}

                <form onSubmit={handlePlaceOrder}>
                    <div className="row g-4">
                        {/* LEFT: Checkout Form Details */}
                        <div className="col-12 col-lg-8">
                            {/* Step 1: Customer Contact Details */}
                            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white mb-4">
                                <div className="d-flex align-items-center justify-content-between mb-3">
                                    <div className="d-flex align-items-center gap-2">
                                        <div
                                            className="rounded-circle bg-navy text-lime d-flex align-items-center justify-content-center fw-bold"
                                            style={{ width: "30px", height: "30px", fontSize: "0.85rem" }}
                                        >
                                            1
                                        </div>
                                        <h5 className="fw-bold text-navy mb-0 display-font">CONTACT INFORMATION</h5>
                                    </div>

                                    {isLoggedIn ? (
                                        <span className="badge bg-light text-navy border d-inline-flex align-items-center gap-1 px-3 py-1.5 rounded-pill small">
                                            <UserCheck size={14} className="text-success" />
                                            Logged in as {user.name || user.first_name}
                                        </span>
                                    ) : (
                                        <div className="small">
                                            Already registered?{" "}
                                            <Link href="/login?redirect=/checkout" className="text-navy fw-bold text-decoration-none hover-teal">
                                                Sign In
                                            </Link>
                                        </div>
                                    )}
                                </div>

                                <div className="row g-3">
                                    <div className="col-12 col-md-6">
                                        <label className="form-label small fw-semibold text-navy mb-1">
                                            Full Name <span className="text-danger">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Virat Kohli"
                                            required
                                            disabled={submitting}
                                        />
                                    </div>

                                    <div className="col-12 col-md-6">
                                        <label className="form-label small fw-semibold text-navy mb-1">
                                            Mobile Number <span className="text-danger">*</span>
                                        </label>
                                        <input
                                            type="tel"
                                            className="form-control"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="9876543210"
                                            required
                                            disabled={submitting}
                                        />
                                    </div>

                                    <div className="col-12">
                                        <label className="form-label small fw-semibold text-navy mb-1">
                                            Email Address <span className="text-muted">(Optional for updates)</span>
                                        </label>
                                        <input
                                            type="email"
                                            className="form-control"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="player@example.com"
                                            disabled={submitting}
                                        />
                                    </div>

                                    {/* Optional account creation for guests */}
                                    {!isLoggedIn && (
                                        <div className="col-12 mt-2">
                                            <div className="form-check">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    id="createAccountCheck"
                                                    checked={createAccount}
                                                    onChange={(e) => setCreateAccount(e.target.checked)}
                                                />
                                                <label className="form-check-label small text-navy fw-semibold" htmlFor="createAccountCheck">
                                                    Create an account to track orders &amp; get loyalty rewards
                                                </label>
                                            </div>

                                            {createAccount && (
                                                <div className="mt-2" style={{ maxWidth: "340px" }}>
                                                    <input
                                                        type="password"
                                                        className="form-control form-control-sm"
                                                        placeholder="Choose a password (min 6 characters)"
                                                        value={guestPassword}
                                                        onChange={(e) => setGuestPassword(e.target.value)}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Step 2: Fulfillment & Shipping */}
                            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white mb-4">
                                <div className="d-flex align-items-center gap-2 mb-3">
                                    <div
                                        className="rounded-circle bg-navy text-lime d-flex align-items-center justify-content-center fw-bold"
                                        style={{ width: "30px", height: "30px", fontSize: "0.85rem" }}
                                    >
                                        2
                                    </div>
                                    <h5 className="fw-bold text-navy mb-0 display-font">FULFILLMENT METHOD</h5>
                                </div>

                                {/* Toggle Delivery vs Pickup */}
                                <div className="row g-2 mb-3">
                                    <div className="col-12 col-sm-6">
                                        <label
                                            className={`card p-3 border rounded-4 cursor-pointer text-start transition-all h-100 ${
                                                fulfillmentType === "Delivery"
                                                    ? "border-navy bg-light shadow-sm"
                                                    : "bg-white border-light-subtle"
                                            }`}
                                            onClick={() => setFulfillmentType("Delivery")}
                                            style={{ cursor: "pointer" }}
                                        >
                                            <div className="d-flex align-items-center justify-content-between mb-2">
                                                <div className="d-flex align-items-center gap-2 fw-bold text-navy">
                                                    <Truck size={18} className="text-navy" />
                                                    <span>Home Delivery</span>
                                                </div>
                                                <input
                                                    type="radio"
                                                    name="fulfillment"
                                                    checked={fulfillmentType === "Delivery"}
                                                    onChange={() => setFulfillmentType("Delivery")}
                                                />
                                            </div>
                                            <div className="small text-muted mb-2">
                                                Delivered to your doorstep. Free over ₹1,500.
                                            </div>
                                            <div className="badge bg-primary-subtle text-primary border border-primary-subtle px-2.5 py-1 rounded-pill small fw-semibold d-inline-flex align-items-center gap-1">
                                                <Clock size={12} />
                                                <span>Est. Delivery: +12 Days ({formatDeliveryDate(deliveryEstDate)})</span>
                                            </div>
                                        </label>
                                    </div>

                                    <div className="col-12 col-sm-6">
                                        <label
                                            className={`card p-3 border rounded-4 cursor-pointer text-start transition-all h-100 ${
                                                fulfillmentType === "Pickup"
                                                    ? "border-navy bg-light shadow-sm"
                                                    : "bg-white border-light-subtle"
                                            }`}
                                            onClick={() => setFulfillmentType("Pickup")}
                                            style={{ cursor: "pointer" }}
                                        >
                                            <div className="d-flex align-items-center justify-content-between mb-2">
                                                <div className="d-flex align-items-center gap-2 fw-bold text-navy">
                                                    <MapPin size={18} className="text-teal" />
                                                    <span>Academy Pickup</span>
                                                </div>
                                                <input
                                                    type="radio"
                                                    name="fulfillment"
                                                    checked={fulfillmentType === "Pickup"}
                                                    onChange={() => setFulfillmentType("Pickup")}
                                                />
                                            </div>
                                            <div className="small text-muted mb-2">
                                                Collect gear from your academy branch (Free).
                                            </div>
                                            <div className="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1 rounded-pill small fw-semibold d-inline-flex align-items-center gap-1">
                                                <CheckCircle2 size={12} />
                                                <span>Ready for Pickup: +2 Days ({formatDeliveryDate(pickupEstDate)})</span>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {/* Delivery / Pickup Schedule Alert */}
                                <div className="alert alert-light border rounded-4 p-3 d-flex align-items-center gap-3 mb-4 shadow-sm">
                                    <div
                                        className="rounded-circle bg-navy text-lime p-2 d-flex align-items-center justify-content-center flex-shrink-0"
                                        style={{ width: "40px", height: "40px" }}
                                    >
                                        {fulfillmentType === "Pickup" ? <Package size={20} /> : <Truck size={20} />}
                                    </div>
                                    <div className="flex-grow-1">
                                        <div className="small fw-bold text-navy">
                                            {fulfillmentType === "Pickup"
                                                ? "⚡ Branch Pickup Schedule (Current Date + 2 Days)"
                                                : "🚚 Home Delivery Schedule (Current Date + 12 Days)"}
                                        </div>
                                        <div className="extra-small text-muted">
                                            {fulfillmentType === "Pickup"
                                                ? `Ready for collection by ${formatDeliveryDate(pickupEstDate)} at your selected branch.`
                                                : `Estimated arrival on or before ${formatDeliveryDate(deliveryEstDate)} directly at your address.`}
                                        </div>
                                    </div>
                                    <span className="badge bg-white text-navy border px-2.5 py-1 rounded-pill small fw-semibold d-none d-sm-inline-block">
                                        {fulfillmentType === "Pickup" ? "+2 Days" : "+12 Days"}
                                    </span>
                                </div>

                                {/* Branch Selector */}
                                <div className="mb-3">
                                    <label className="form-label small fw-semibold text-navy mb-1">
                                        {fulfillmentType === "Pickup" ? "Select Pickup Branch" : "Processing Branch"} <span className="text-danger">*</span>
                                    </label>
                                    {loadingBranches ? (
                                        <div className="small text-muted">Loading branches...</div>
                                    ) : (
                                        <select
                                            className="form-select"
                                            value={selectedBranchId}
                                            onChange={(e) => setSelectedBranchId(e.target.value)}
                                            required
                                            disabled={submitting}
                                        >
                                            <option value="">-- Choose Branch --</option>
                                            {branches.map((b) => (
                                                <option key={b.id} value={b.id}>
                                                    {b.branch_name} {b.city ? `(${b.city})` : ""}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {/* Delivery Address Details (only if Delivery) */}
                                {fulfillmentType === "Delivery" && (
                                    <div className="row g-3 pt-2">
                                        <div className="col-12">
                                            <label className="form-label small fw-semibold text-navy mb-1">
                                                Delivery Address <span className="text-danger">*</span>
                                            </label>
                                            <textarea
                                                className="form-control"
                                                rows={2}
                                                value={address}
                                                onChange={(e) => setAddress(e.target.value)}
                                                placeholder="Flat / House no, Building name, Street, Landmark"
                                                required
                                                disabled={submitting}
                                            />
                                        </div>

                                        <div className="col-12 col-md-4">
                                            <label className="form-label small fw-semibold text-navy mb-1">City</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={city}
                                                onChange={(e) => setCity(e.target.value)}
                                                placeholder="Mumbai"
                                                disabled={submitting}
                                            />
                                        </div>

                                        <div className="col-12 col-md-4">
                                            <label className="form-label small fw-semibold text-navy mb-1">State</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={stateVal}
                                                onChange={(e) => setStateVal(e.target.value)}
                                                placeholder="Maharashtra"
                                                disabled={submitting}
                                            />
                                        </div>

                                        <div className="col-12 col-md-4">
                                            <label className="form-label small fw-semibold text-navy mb-1">PIN Code</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={pincode}
                                                onChange={(e) => setPincode(e.target.value)}
                                                placeholder="400001"
                                                disabled={submitting}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Step 3: Payment Options */}
                            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white mb-4">
                                <div className="d-flex align-items-center gap-2 mb-3">
                                    <div
                                        className="rounded-circle bg-navy text-lime d-flex align-items-center justify-content-center fw-bold"
                                        style={{ width: "30px", height: "30px", fontSize: "0.85rem" }}
                                    >
                                        3
                                    </div>
                                    <h5 className="fw-bold text-navy mb-0 display-font">PAYMENT METHOD</h5>
                                </div>

                                <div className="row g-2">
                                    {[
                                        { id: "COD", label: fulfillmentType === "Pickup" ? "Pay at Branch" : "Cash on Delivery (COD)", icon: DollarSign, desc: "Pay in cash or UPI upon delivery / pickup" },
                                        { id: "UPI", label: "UPI / QR Code", icon: CreditCard, desc: "Pay instantly via PhonePe, Google Pay, or Paytm" },
                                        { id: "Card", label: "Debit / Credit Card", icon: CreditCard, desc: "Visa, Mastercard, RuPay & all major cards" },
                                        { id: "Bank Transfer", label: "Direct Bank Transfer", icon: Lock, desc: "Transfer directly to CST Pro Academy account" },
                                    ].map((pm) => {
                                        const Icon = pm.icon;
                                        const active = paymentMethod === pm.id;
                                        return (
                                            <div className="col-12 col-md-6" key={pm.id}>
                                                <label
                                                    className={`card p-3 border rounded-4 cursor-pointer text-start transition-all h-100 ${
                                                        active ? "border-navy bg-light shadow-sm" : "bg-white border-light-subtle"
                                                    }`}
                                                    onClick={() => setPaymentMethod(pm.id)}
                                                    style={{ cursor: "pointer" }}
                                                >
                                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                                        <div className="d-flex align-items-center gap-2 fw-bold text-navy">
                                                            <Icon size={18} className="text-navy" />
                                                            <span>{pm.label}</span>
                                                        </div>
                                                        <input
                                                            type="radio"
                                                            name="paymentMethod"
                                                            checked={active}
                                                            onChange={() => setPaymentMethod(pm.id)}
                                                        />
                                                    </div>
                                                    <div className="small text-muted">{pm.desc}</div>
                                                </label>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Step 4: Special Instructions */}
                            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                                <h6 className="fw-bold text-navy mb-2 display-font">SPECIAL NOTES / INSTRUCTIONS</h6>
                                <textarea
                                    className="form-control"
                                    rows={2}
                                    placeholder="e.g. Please call before delivery, bat knocking request, jersey size note..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    disabled={submitting}
                                />
                            </div>
                        </div>

                        {/* RIGHT: Order Summary */}
                        <div className="col-12 col-lg-4">
                            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white sticky-top" style={{ top: "100px" }}>
                                <h4 className="fw-bold text-navy mb-3 display-font">ORDER OVERVIEW</h4>

                                {/* Items mini-list */}
                                <div className="divide-y mb-3 max-h-240 overflow-y-auto" style={{ maxHeight: "240px" }}>
                                    {items.map((item) => (
                                        <div key={item.product_id} className="py-2 d-flex align-items-center justify-content-between gap-2 border-bottom">
                                            <div className="d-flex align-items-center gap-2 overflow-hidden">
                                                <div
                                                    className="rounded bg-light border flex-shrink-0 d-flex align-items-center justify-content-center overflow-hidden"
                                                    style={{ width: "40px", height: "40px" }}
                                                >
                                                    {item.image ? (
                                                        <img src={item.image} alt="" className="w-100 h-100 object-fit-cover" />
                                                    ) : (
                                                        <Package size={18} className="text-muted" />
                                                    )}
                                                </div>
                                                <div className="small text-truncate">
                                                    <div className="fw-semibold text-navy text-truncate">{item.product_name}</div>
                                                    <div className="text-muted extra-small">Qty: {item.quantity}</div>
                                                </div>
                                            </div>

                                            <div className="small fw-bold text-navy text-end flex-shrink-0">
                                                ₹{(Number(item.sale_price ?? item.price ?? 0) * item.quantity).toLocaleString("en-IN")}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Delivery / Pickup Promise Banner */}
                                <div className="p-3 my-3 rounded-4 bg-light border d-flex align-items-start gap-2.5">
                                    <div
                                        className="rounded-circle bg-navy text-lime d-flex align-items-center justify-content-center flex-shrink-0 mt-0.5"
                                        style={{ width: "32px", height: "32px" }}
                                    >
                                        <Calendar size={16} />
                                    </div>
                                    <div className="flex-grow-1">
                                        <div className="extra-small text-uppercase fw-bold text-muted" style={{ letterSpacing: "0.5px" }}>
                                            {fulfillmentType === "Pickup" ? "Ready for Pickup (+2 Days)" : "Estimated Delivery (+12 Days)"}
                                        </div>
                                        <div className="fw-bold text-navy fs-6">
                                            {formatDeliveryDate(currentEstDate)}
                                        </div>
                                        <div className="extra-small text-muted">
                                            {fulfillmentType === "Pickup" ? "⚡ Collect at selected academy branch" : "🚚 Doorstep delivery to your address"}
                                        </div>
                                    </div>
                                </div>

                                {/* Cost Breakdown */}
                                <div className="d-flex justify-content-between py-1.5 small text-muted">
                                    <span>Subtotal</span>
                                    <span className="fw-semibold text-navy">₹{subtotal.toLocaleString("en-IN")}</span>
                                </div>

                                <div className="d-flex justify-content-between py-1.5 small text-muted">
                                    <span>Taxes &amp; GST</span>
                                    <span className="fw-semibold text-navy">
                                        {taxTotal > 0 ? `₹${Math.round(taxTotal).toLocaleString("en-IN")}` : "Included"}
                                    </span>
                                </div>

                                <div className="d-flex justify-content-between py-1.5 small text-muted">
                                    <span>Shipping ({fulfillmentType})</span>
                                    <span className="fw-semibold text-navy">
                                        {deliveryFee === 0 ? <span className="text-success fw-bold">FREE</span> : `₹${deliveryFee}`}
                                    </span>
                                </div>

                                <div className="d-flex justify-content-between py-3 my-2 border-top border-bottom">
                                    <span className="fw-bold text-navy fs-5">Total Payable</span>
                                    <span className="fw-bold text-navy fs-5">
                                        ₹{Math.round(finalTotal).toLocaleString("en-IN")}
                                    </span>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="btn btn-navy w-100 py-3 rounded-pill fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm text-uppercase"
                                    style={{ letterSpacing: "0.5px" }}
                                >
                                    {submitting ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                                            Placing Order...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 size={18} /> Place Order Now
                                        </>
                                    )}
                                </button>

                                <div className="mt-3 text-center">
                                    <span className="small text-muted d-inline-flex align-items-center gap-1">
                                        <ShieldCheck size={14} className="text-success" />
                                        Guaranteed Safe CST Pro Checkout
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
