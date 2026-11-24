"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    AlertCircle,
    ArrowLeft,
    Building2,
    Calendar,
    Check,
    CheckCircle2,
    Clock,
    CreditCard,
    DollarSign,
    Lock,
    MapPin,
    Package,
    Phone,
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

    // Form state - Home Delivery removed, strictly Academy Branch Pickup
    const fulfillmentType = "Pickup";
    const [selectedBranchId, setSelectedBranchId] = useState("");
    const selectedBranch = branches.find((b) => String(b.id) === String(selectedBranchId)) || null;
    const [paymentMethod, setPaymentMethod] = useState("COD"); // "COD" | "UPI" | "Card" | "Bank Transfer"
    const [notes, setNotes] = useState("");

    // Contact info
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");

    // Guest account creation password (optional if guest)
    const [guestPassword, setGuestPassword] = useState("");
    const [createAccount, setCreateAccount] = useState(false);

    // Submission states
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    // Branch pickup is always Free
    const deliveryFee = 0;
    const finalTotal = grandTotal;

    // Pickup ready date (+2 days)
    const pickupEstDate = getEstimatedDeliveryDate("Pickup");
    const currentEstDate = pickupEstDate;

    // Load branches for pickup
    useEffect(() => {
        let isMounted = true;
        async function fetchBranches() {
            try {
                const res = await fetch("/api/branch?status=1");
                const json = await res.json();
                if (isMounted && res.ok && json.success && Array.isArray(json.data)) {
                    let branchList = json.data;
                    const ac1 = branchList.filter((b) => Number(b.academy_id) === 1);
                    if (ac1.length > 0) {
                        branchList = ac1;
                    }
                    setBranches(branchList);
                    if (branchList.length > 0) {
                        setSelectedBranchId(String(branchList[0].id));
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
            setErrorMessage("Please select an academy pickup branch.");
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

            const selectedBranch = branches.find((b) => String(b.id) === String(selectedBranchId));
            const estDays = 2; // Branch pickup in 2 days
            const estDateObj = new Date();
            estDateObj.setDate(estDateObj.getDate() + estDays);
            const yyyy = estDateObj.getFullYear();
            const mm = String(estDateObj.getMonth() + 1).padStart(2, "0");
            const dd = String(estDateObj.getDate()).padStart(2, "0");
            const estimatedDeliveryDate = `${yyyy}-${mm}-${dd}`;

            const branchAddressText = selectedBranch
                ? `${selectedBranch.branch_name}${selectedBranch.address ? `, ${selectedBranch.address}` : ""}${selectedBranch.city ? `, ${selectedBranch.city}` : ""}`
                : "Academy Branch Pickup";

            const orderPayload = {
                academy_id: selectedBranch?.academy_id || 1,
                customer_user_id: isPublicUser ? null : activeUserId,
                public_user_id: isPublicUser ? activeUserId : null,
                fulfillment_branch_id: Number(selectedBranchId),
                fulfillment_type: "Pickup",
                estimated_delivery_date: estimatedDeliveryDate,
                customer_name: name.trim(),
                customer_phone: phone.trim(),
                customer_email: email.trim() || null,
                delivery_address: branchAddressText,
                delivery_city: selectedBranch?.city || null,
                delivery_state: null,
                delivery_pincode: null,
                subtotal: Number(subtotal.toFixed(2)),
                tax_amount: Number(taxTotal.toFixed(2)),
                delivery_charge: 0,
                discount_amount: 0,
                payment_method: paymentMethod,
                payment_status: "Pending",
                order_status: "Processing",
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

            // Save order to recent orders cache in browser for instant tracking in /orders
            if (typeof window !== "undefined") {
                try {
                    const storedOrders = JSON.parse(localStorage.getItem("cst_recent_orders") || "[]");
                    if (!storedOrders.includes(createdOrderNo)) {
                        storedOrders.unshift(createdOrderNo);
                        localStorage.setItem("cst_recent_orders", JSON.stringify(storedOrders.slice(0, 25)));
                    }
                    if (phone.trim()) localStorage.setItem("cst_customer_phone", phone.trim());
                    if (email.trim()) localStorage.setItem("cst_customer_email", email.trim());
                } catch (_) {}
            }

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
                        new_status: "Processing",
                        remarks: `Order placed online via CST Pro store (${fulfillmentType} - ${paymentMethod}). Status: Processing.`,
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

                            {/* Step 2: Fulfillment - Academy Branch Pickup */}
                            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white mb-4">
                                <div className="d-flex align-items-center justify-content-between mb-3">
                                    <div className="d-flex align-items-center gap-2">
                                        <div
                                            className="rounded-circle bg-navy text-lime d-flex align-items-center justify-content-center fw-bold"
                                            style={{ width: "30px", height: "30px", fontSize: "0.85rem" }}
                                        >
                                            2
                                        </div>
                                        <h5 className="fw-bold text-navy mb-0 display-font">FULFILLMENT METHOD</h5>
                                    </div>
                                    <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-1 rounded-pill small fw-bold">
                                        ✓ Free Academy Pickup
                                    </span>
                                </div>

                                {/* Pickup Highlight Card */}
                                <div className="p-3.5 rounded-4 border mb-3" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
                                    <div className="d-flex align-items-start gap-3">
                                        <div
                                            className="rounded-circle bg-navy text-lime p-2.5 d-flex align-items-center justify-content-center flex-shrink-0 mt-1"
                                            style={{ width: "42px", height: "42px" }}
                                        >
                                            <Building2 size={22} />
                                        </div>
                                        <div className="flex-grow-1">
                                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-1">
                                                <div className="fw-bold text-navy fs-6">Academy Branch Pickup</div>
                                                <span className="badge bg-success text-white px-2.5 py-1 rounded-pill small fw-semibold">
                                                    Ready in 2 Days ({formatDeliveryDate(pickupEstDate)})
                                                </span>
                                            </div>
                                            <p className="small text-muted mb-0" style={{ lineHeight: "1.5" }}>
                                                Select your nearest CST Academy branch below. You can collect your gear directly from the branch reception. No shipping, handling, or doorstep delivery fees.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Branch Selector */}
                                <div className="mb-3">
                                    <label className="form-label small fw-semibold text-navy mb-1.5 d-flex align-items-center justify-content-between">
                                        <span>Select Academy Branch to Collect Gear <span className="text-danger">*</span></span>
                                        <span className="extra-small text-muted">({branches.length} branches available)</span>
                                    </label>
                                    {loadingBranches ? (
                                        <div className="small text-muted py-2">Loading academy branches...</div>
                                    ) : (
                                        <select
                                            className="form-select form-select-lg fs-6"
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

                                {/* Selected Branch Info Card */}
                                {selectedBranch && (
                                    <div className="p-3 rounded-4 bg-light border border-teal-subtle mt-3">
                                        <div className="d-flex align-items-start gap-2.5">
                                            <MapPin size={18} className="text-danger flex-shrink-0 mt-1" />
                                            <div className="flex-grow-1">
                                                <div className="fw-bold text-navy small mb-0.5">
                                                    {selectedBranch.branch_name} {selectedBranch.city ? `— ${selectedBranch.city}` : ""}
                                                </div>
                                                {selectedBranch.address && (
                                                    <div className="extra-small text-muted mb-1">
                                                        {selectedBranch.address}
                                                    </div>
                                                )}
                                                <div className="d-flex flex-wrap align-items-center gap-3 extra-small text-secondary">
                                                    {selectedBranch.branch_phone && (
                                                        <span className="d-inline-flex align-items-center gap-1">
                                                            <Phone size={12} /> Helpline: {selectedBranch.branch_phone}
                                                        </span>
                                                    )}
                                                    <span className="d-inline-flex align-items-center gap-1 text-success fw-semibold">
                                                        <Clock size={12} /> Collection Timing: Mon - Sat (9 AM - 6 PM)
                                                    </span>
                                                </div>
                                            </div>
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
                                        { id: "COD", label: "Pay at Branch (Cash / UPI)", icon: DollarSign, desc: "Pay in cash or UPI when collecting gear at branch" },
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
                                    placeholder="e.g. Bat knocking request, grip color preference, jersey size note..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    disabled={submitting}
                                />
                            </div>
                        </div>

                        {/* RIGHT: Price Details (Flipkart / Amazon Style) */}
                        <div className="col-12 col-lg-4">
                            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white sticky-top" style={{ top: "100px" }}>
                                <div className="border-bottom pb-3 mb-3">
                                    <h5 className="fw-bold text-navy mb-0 display-font text-uppercase" style={{ letterSpacing: "0.5px" }}>
                                        PRICE DETAILS
                                    </h5>
                                </div>

                                {/* Items mini-list */}
                                <div className="divide-y mb-3 max-h-240 overflow-y-auto" style={{ maxHeight: "200px" }}>
                                    {items.map((item) => (
                                        <div key={item.product_id} className="py-2 d-flex align-items-center justify-content-between gap-2 border-bottom">
                                            <div className="d-flex align-items-center gap-2 overflow-hidden">
                                                <div
                                                    className="rounded bg-light border flex-shrink-0 d-flex align-items-center justify-content-center overflow-hidden"
                                                    style={{ width: "38px", height: "38px" }}
                                                >
                                                    {item.image ? (
                                                        <img src={item.image} alt="" className="w-100 h-100 object-fit-cover" />
                                                    ) : (
                                                        <Package size={16} className="text-muted" />
                                                    )}
                                                </div>
                                                <div className="small text-truncate">
                                                    <div className="fw-semibold text-navy text-truncate" style={{ maxWidth: "160px" }}>
                                                        {item.product_name}
                                                    </div>
                                                    <div className="text-muted extra-small">Qty: {item.quantity}</div>
                                                </div>
                                            </div>

                                            <div className="small fw-bold text-navy text-end flex-shrink-0">
                                                ₹{(Number(item.sale_price ?? item.price ?? 0) * item.quantity).toLocaleString("en-IN")}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Pickup Schedule Banner */}
                                <div className="p-3 my-2.5 rounded-4 bg-light border d-flex align-items-start gap-2.5">
                                    <div
                                        className="rounded-circle bg-navy text-lime d-flex align-items-center justify-content-center flex-shrink-0 mt-0.5"
                                        style={{ width: "30px", height: "30px" }}
                                    >
                                        <Calendar size={15} />
                                    </div>
                                    <div className="flex-grow-1">
                                        <div className="extra-small text-uppercase fw-bold text-muted" style={{ letterSpacing: "0.5px" }}>
                                            Branch Pickup Ready
                                        </div>
                                        <div className="fw-bold text-navy fs-6">
                                            {formatDeliveryDate(pickupEstDate)} (+2 Days)
                                        </div>
                                        <div className="extra-small text-muted">
                                            {selectedBranch ? `Collect at ${selectedBranch.branch_name}` : "Collect at chosen academy branch"}
                                        </div>
                                    </div>
                                </div>

                                {/* Cost Breakdown - Flipkart Inclusive GST Formula */}
                                <div className="d-flex justify-content-between py-2 small text-muted">
                                    <span>Price ({items.length} {items.length === 1 ? "item" : "items"})</span>
                                    <span className="fw-semibold text-navy">₹{grandTotal.toLocaleString("en-IN")}</span>
                                </div>

                                <div className="d-flex justify-content-between py-2 small text-muted">
                                    <span>Item Subtotal (Net Base)</span>
                                    <span className="fw-semibold text-navy">₹{Math.round(subtotal).toLocaleString("en-IN")}</span>
                                </div>

                                <div className="d-flex justify-content-between py-2 small text-muted">
                                    <span>Taxes &amp; GST (Included)</span>
                                    <span className="fw-semibold text-success">
                                        {taxTotal > 0 ? `+₹${Math.round(taxTotal).toLocaleString("en-IN")}` : "Included in MRP"}
                                    </span>
                                </div>

                                <div className="d-flex justify-content-between py-2 small text-muted">
                                    <span>Academy Pickup &amp; Handling</span>
                                    <span className="text-success fw-bold">FREE</span>
                                </div>

                                <div className="d-flex justify-content-between py-3 my-2 border-top border-bottom">
                                    <span className="fw-bold text-navy fs-5">Total Amount</span>
                                    <span className="fw-bold fs-5" style={{ color: "#062f38" }}>
                                        ₹{Math.round(finalTotal).toLocaleString("en-IN")}
                                    </span>
                                </div>

                                <div className="p-2.5 mb-3 rounded-3 bg-success-subtle border border-success-subtle text-success small d-flex align-items-center gap-2">
                                    <CheckCircle2 size={16} className="flex-shrink-0" />
                                    <span>Inclusive of all taxes &amp; GST ({taxTotal > 0 ? `₹${Math.round(taxTotal).toLocaleString("en-IN")} GST included` : "All taxes included"})</span>
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
                                        100% Safe &amp; Secure Payments
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
