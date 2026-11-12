"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { useUser } from "../components/UserContext";
import {
    BOOKING_STATUSES,
    PAYMENT_MODES,
    PURPOSES,
    derivePaymentStatus,
    formatPrice,
    formatTime,
    normalizePurpose,
    paymentBadge,
    toDateInput,
} from "./bookingUtils";

const EMPTY_FORM = {
    ground_id: "",
    slot_id: "",
    booking_date: "",
    purpose: "Practice",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    match_id: "",
    tournament_id: "",
    total_amount: 0,
    paid_amount: 0,
    payment_mode: "",
    transaction_no: "",
    booking_status: "Booked",
    remarks: "",
};

// academyId / branchId are only passed in edit mode (the GET-by-id API requires them)
export default function GroundBookingForm({
    id = null,
    academyId = null,
    branchId = null,
    embedded = false,
    initialValues = {},
    tournaments = [],
    onCreated,
    onCancel,
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isEdit = Boolean(id);
    const { user } = useUser();
    const hasSessionUser = Boolean(user);
    const userRole = String(user?.user_type || "")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ");
    const isSuperAdmin = ["super admin", "superadmin", "admin"].includes(userRole);
    const isBranchAdmin = userRole === "branch admin";
    const userAcademyId = user?.academy_id;
    const userBranchId = user?.branch_id;

    const requestId = searchParams.get("request_id") || "";
    const requestNumber = searchParams.get("request_number") || "";

    const [formData, setFormData] = useState(() => {
        const initGroundId = initialValues.ground_id || searchParams.get("ground_id") || "";
        const initSlotId = initialValues.slot_id || searchParams.get("slot_id") || "";
        const initDate = initialValues.booking_date || searchParams.get("booking_date") || "";
        const initName = initialValues.customer_name || searchParams.get("customer_name") || "";
        const initPhone =
            initialValues.customer_phone ||
            searchParams.get("customer_phone") ||
            searchParams.get("mobile") ||
            searchParams.get("phone") ||
            "";
        const initEmail =
            initialValues.customer_email ||
            searchParams.get("customer_email") ||
            searchParams.get("email") ||
            "";
        const initPurpose = normalizePurpose(
            initialValues.purpose || searchParams.get("purpose") || searchParams.get("booking_purpose")
        );
        const initMatchId = initialValues.match_id || searchParams.get("match_id") || "";
        const initTournId = initialValues.tournament_id || searchParams.get("tournament_id") || "";
        const initRemarks =
            initialValues.remarks ||
            searchParams.get("remarks") ||
            searchParams.get("special_requirements") ||
            (requestNumber ? `Converted from Request #${requestNumber}` : "");

        return {
            ...EMPTY_FORM,
            ground_id: initGroundId ? String(initGroundId) : "",
            slot_id: initSlotId ? String(initSlotId) : "",
            booking_date: initDate ? toDateInput(initDate) : "",
            purpose: initPurpose,
            customer_name: initName,
            customer_phone: initPhone,
            customer_email: initEmail,
            match_id: initMatchId,
            tournament_id: initTournId,
            remarks: initRemarks,
        };
    });
    const [grounds, setGrounds] = useState([]);
    const [slots, setSlots] = useState([]); // all active slots; filtered by ground below

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState("");

    // Active grounds + active slots (slot rows carry academy_id / branch_id)
    useEffect(() => {
        if (!hasSessionUser) return;

        (async () => {
            try {
                const params = new URLSearchParams({ status: "1" });
                if (!isSuperAdmin) {
                    if (isBranchAdmin) {
                        params.set("branch_id", String(userBranchId || 0));
                    } else {
                        params.set("academy_id", String(userAcademyId || 0));
                    }
                }

                const [gRes, sRes] = await Promise.all([
                    fetch(`/api/ground?${params.toString()}`, { cache: "no-store" }),
                    fetch("/api/ground-slots?status=1", { cache: "no-store" }),
                ]);
                const [gJson, sJson] = await Promise.all([gRes.json(), sRes.json()]);
                if (!gRes.ok || !gJson.success) throw new Error(gJson.message || "Unable to load grounds");
                if (!sRes.ok || !sJson.success) throw new Error(sJson.message || "Unable to load slots");
                setGrounds(gJson.data || []);
                setSlots(sJson.data || []);
            } catch (err) {
                setError(err.message);
            }
        })();
    }, [hasSessionUser, isSuperAdmin, isBranchAdmin, userAcademyId, userBranchId]);

    // Edit mode
    useEffect(() => {
        if (!id) return;

        (async () => {
            try {
                setFetching(true);
                setError("");
                if (!academyId || !branchId) {
                    throw new Error("Missing academy/branch. Open this booking from the bookings list.");
                }
                const qs = new URLSearchParams({ academy_id: academyId, branch_id: branchId });
                const res = await fetch(`/api/ground-bookings/${id}?${qs.toString()}`);
                const result = await res.json();

                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Failed to fetch booking");
                }

                const d = result.data;
                const lastPayment = (d.payments || [])[0]; // API returns newest first
                setFormData({
                    ground_id: String(d.ground_id),
                    slot_id: String(d.slot_id),
                    booking_date: toDateInput(d.booking_date),
                    purpose: d.purpose || "Practice",
                    customer_name: d.customer_name || "",
                    customer_phone: d.customer_phone || "",
                    customer_email: d.customer_email || "",
                    match_id: d.match_id ?? "",
                    tournament_id: d.tournament_id ?? "",
                    total_amount: d.total_amount ?? 0,
                    paid_amount: d.paid_amount ?? 0,
                    payment_mode: lastPayment?.payment_mode || "",
                    transaction_no: lastPayment?.transaction_no || "",
                    booking_status: d.booking_status || "Booked",
                    remarks: d.remarks || "",
                });
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        })();
    }, [id, academyId, branchId]);

    // Update formData if searchParams change or on client-side mount
    useEffect(() => {
        if (isEdit) return;

        const gId = searchParams.get("ground_id");
        const sId = searchParams.get("slot_id");
        const bDate = searchParams.get("booking_date");
        const cName = searchParams.get("customer_name");
        const cPhone = searchParams.get("customer_phone") || searchParams.get("mobile") || searchParams.get("phone");
        const cEmail = searchParams.get("customer_email") || searchParams.get("email");
        const purp = searchParams.get("purpose") || searchParams.get("booking_purpose");
        const rem = searchParams.get("remarks") || searchParams.get("special_requirements");
        const reqNo = searchParams.get("request_number");

        if (gId || bDate || cName || cPhone || cEmail || purp || rem || sId) {
            setFormData((prev) => ({
                ...prev,
                ground_id: prev.ground_id || (gId ? String(gId) : ""),
                slot_id: prev.slot_id || (sId ? String(sId) : ""),
                booking_date: prev.booking_date || (bDate ? toDateInput(bDate) : ""),
                customer_name: prev.customer_name || cName || "",
                customer_phone: prev.customer_phone || cPhone || "",
                customer_email: prev.customer_email || cEmail || "",
                purpose: prev.purpose && prev.purpose !== "Practice" ? prev.purpose : normalizePurpose(purp || prev.purpose),
                remarks: prev.remarks || rem || (reqNo ? `Converted from Request #${reqNo}` : ""),
            }));
        }
    }, [searchParams, isEdit]);

    // If converting from a booking request, fetch full request data if needed
    useEffect(() => {
        if (isEdit || !requestId) return;

        let isMounted = true;
        async function loadRequest() {
            try {
                const res = await fetch(`/api/ground-booking-requests/${requestId}`, { cache: "no-store" });
                const json = await res.json();
                if (isMounted && res.ok && json.success && json.data) {
                    const req = json.data;
                    setFormData((prev) => ({
                        ...prev,
                        ground_id: prev.ground_id || (req.ground_id ? String(req.ground_id) : ""),
                        booking_date: prev.booking_date || toDateInput(req.booking_date),
                        customer_name: prev.customer_name || req.customer_name || "",
                        customer_phone: prev.customer_phone || req.mobile || "",
                        customer_email: prev.customer_email || req.email || "",
                        purpose: prev.purpose && prev.purpose !== "Practice" ? prev.purpose : normalizePurpose(req.booking_purpose),
                        remarks: prev.remarks || (req.special_requirements ? `[Req #${req.request_number}] ${req.special_requirements}` : `Converted from Request #${req.request_number}`),
                    }));
                }
            } catch (err) {
                console.error("Failed to load request data:", err);
            }
        }
        loadRequest();
        return () => {
            isMounted = false;
        };
    }, [requestId, isEdit]);

    // Auto-match slot when slots or ground_id is available
    useEffect(() => {
        if (isEdit || !slots.length || !formData.ground_id) return;

        const currentValid = slots.some(
            (s) => String(s.id) === String(formData.slot_id) && String(s.ground_id) === String(formData.ground_id)
        );
        if (currentValid) return;

        const availableSlots = slots.filter((s) => String(s.ground_id) === String(formData.ground_id));
        if (!availableSlots.length) return;

        const paramSlotId = searchParams.get("slot_id");
        const paramStartTime = searchParams.get("start_time");
        const paramEndTime = searchParams.get("end_time");

        let matched = null;

        if (paramSlotId) {
            matched = availableSlots.find((s) => String(s.id) === String(paramSlotId));
        }

        if (!matched && paramStartTime) {
            const cleanStart = String(paramStartTime).trim().slice(0, 5);
            const cleanEnd = paramEndTime ? String(paramEndTime).trim().slice(0, 5) : null;

            if (cleanEnd) {
                matched = availableSlots.find((s) => {
                    const sStart = String(s.start_time || "").trim().slice(0, 5);
                    const sEnd = String(s.end_time || "").trim().slice(0, 5);
                    return sStart === cleanStart && sEnd === cleanEnd;
                });
            }

            if (!matched) {
                matched = availableSlots.find((s) => {
                    const sStart = String(s.start_time || "").trim().slice(0, 5);
                    return sStart === cleanStart;
                });
            }
        }

        if (!matched && availableSlots.length === 1 && !formData.slot_id) {
            matched = availableSlots[0];
        }

        if (matched) {
            setFormData((prev) => ({
                ...prev,
                slot_id: String(matched.id),
                total_amount: prev.total_amount > 0 ? prev.total_amount : (Number(matched.price) || 0),
            }));
        }
    }, [slots, formData.ground_id, formData.slot_id, isEdit, searchParams]);

    const groundSlots = useMemo(
        () => slots.filter((s) => String(s.ground_id) === String(formData.ground_id)),
        [slots, formData.ground_id]
    );

    const balance = Math.max((Number(formData.total_amount) || 0) - (Number(formData.paid_amount) || 0), 0);
    const paymentStatus = derivePaymentStatus(formData.total_amount, formData.paid_amount);

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData((prev) => {
            const next = { ...prev, [name]: value };

            // Changing ground invalidates the chosen slot
            if (name === "ground_id") next.slot_id = "";

            // Picking a slot pre-fills the amount from the slot price (create only)
            if (name === "slot_id" && !isEdit) {
                const slot = slots.find((s) => String(s.id) === String(value));
                if (slot) next.total_amount = Number(slot.price) || 0;
            }
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const total = Number(formData.total_amount) || 0;
        const paid = Number(formData.paid_amount) || 0;

        // Mirrors the API validation
        if (!formData.ground_id) return setError("Please select a ground");
        if (!formData.slot_id) return setError("Please select a slot");
        if (!formData.booking_date) return setError("Booking date is required");
        if (!formData.customer_name.trim()) return setError("Customer name is required");
        if (!formData.purpose.trim()) return setError("Purpose is required");
        if (total < 0 || paid < 0) return setError("Amount cannot be negative");
        if (paid > total) return setError("Paid amount cannot be greater than total amount");
        if (paid > 0 && !formData.payment_mode) {
            return setError("Payment mode is required when paid amount is greater than 0");
        }
        if (formData.customer_email.trim() && !/^\S+@\S+\.\S+$/.test(formData.customer_email.trim())) {
            return setError("Please enter a valid email address");
        }

        // academy / branch come from the slot (create) or the URL (edit)
        const slot = slots.find((s) => String(s.id) === String(formData.slot_id));
        const academy_id = isEdit ? academyId : slot?.academy_id;
        const branch_id = isEdit ? branchId : slot?.branch_id;
        if (!academy_id || !branch_id) {
            return setError("Academy and branch could not be determined for this slot");
        }

        const payload = {
            academy_id: Number(academy_id),
            branch_id: Number(branch_id),
            ground_id: Number(formData.ground_id),
            slot_id: Number(formData.slot_id),
            match_id: formData.match_id ? Number(formData.match_id) : null,
            tournament_id: formData.tournament_id ? Number(formData.tournament_id) : null,
            customer_name: formData.customer_name.trim(),
            customer_phone: formData.customer_phone.trim() || null,
            customer_email: formData.customer_email.trim() || null,
            booking_date: formData.booking_date,
            purpose: formData.purpose.trim(),
            total_amount: total,
            paid_amount: paid,
            payment_mode: paid > 0 ? formData.payment_mode : null,
            transaction_no: paid > 0 ? formData.transaction_no.trim() || null : null,
            remarks: formData.remarks.trim() || null,
        };
        if (isEdit) payload.booking_status = formData.booking_status;

        try {
            setLoading(true);
            setError("");

            const res = await fetch(isEdit ? `/api/ground-bookings/${id}` : `/api/ground-bookings`, {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                // 409 includes the booking that already holds this slot/date
                const clash = data.booking_no ? ` (${data.booking_no})` : "";
                throw new Error((data.message || "Something went wrong") + clash);
            }

            if (embedded && !isEdit) {
                onCreated?.(data.data);
                return;
            }

            // If converted from a booking request, mark the request as Approved
            if (requestId && !isEdit) {
                try {
                    await fetch(`/api/ground-booking-requests/${requestId}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            request_status: "Approved",
                            admin_remarks: `Confirmed booking #${data.data?.booking_no || ""} created.`,
                        }),
                    });
                } catch (putErr) {
                    console.error("Failed to update booking request status:", putErr);
                }
            }

            alert(isEdit ? "Booking updated successfully" : "Booking created successfully");

            router.push("/next_panel/ground-bookings");
            router.refresh();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return <div className="text-center py-5">Loading...</div>;
    }

    return (
        <div className={embedded ? "" : "card shadow-sm"}>
            {!embedded && (
                <div className="card-header">
                    <h5 className="mb-0">{isEdit ? "Edit Booking" : "New Booking"}</h5>
                </div>
            )}

            <div className={embedded ? "" : "card-body"}>
                {error && <div className="alert alert-danger">{error}</div>}

                {requestNumber && !isEdit && (
                    <div className="alert alert-info d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4 py-2 px-3 rounded-3">
                        <div className="d-flex align-items-center gap-2">
                            <CalendarCheck size={18} className="text-info flex-shrink-0" />
                            <span>
                                Converting Ground Booking Request <strong>#{requestNumber}</strong> into Confirmed Booking.
                            </span>
                        </div>
                        {requestId && (
                            <Link
                                href={`/next_panel/ground-booking-requests/${requestId}`}
                                target="_blank"
                                className="btn btn-sm btn-outline-info py-1 px-2"
                            >
                                View Original Request
                            </Link>
                        )}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* Ground / slot / date */}
                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Ground</label>
                            <select
                                name="ground_id"
                                className="form-select"
                                value={formData.ground_id}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Select ground</option>
                                {grounds.map((g) => (
                                    <option key={g.id} value={g.id}>{g.ground_name} ({g.ground_code})</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Slot</label>
                            <select
                                name="slot_id"
                                className="form-select"
                                value={formData.slot_id}
                                onChange={handleChange}
                                disabled={!formData.ground_id}
                                required
                            >
                                <option value="">
                                    {formData.ground_id
                                        ? groundSlots.length ? "Select slot" : "No active slots for this ground"
                                        : "Select a ground first"}
                                </option>
                                {groundSlots.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.slot_name} · {formatTime(s.start_time)}–{formatTime(s.end_time)} · {formatPrice(s.price)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Booking Date</label>
                            <input
                                type="date"
                                name="booking_date"
                                className="form-control"
                                value={formData.booking_date}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    {/* Customer */}
                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Customer Name</label>
                            <input
                                type="text"
                                name="customer_name"
                                className="form-control"
                                value={formData.customer_name}
                                onChange={handleChange}
                                placeholder="Enter customer name"
                                required
                            />
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Phone (optional)</label>
                            <input
                                type="tel"
                                name="customer_phone"
                                className="form-control"
                                value={formData.customer_phone}
                                onChange={handleChange}
                                placeholder="Enter phone number"
                            />
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Email (optional)</label>
                            <input
                                type="email"
                                name="customer_email"
                                className="form-control"
                                value={formData.customer_email}
                                onChange={handleChange}
                                placeholder="Enter email"
                            />
                        </div>
                    </div>

                    {/* Purpose / links */}
                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Purpose</label>
                            <select
                                name="purpose"
                                className="form-select"
                                value={formData.purpose}
                                onChange={handleChange}
                                required
                            >
                                {PURPOSES.map((purpose) => (
                                    <option key={purpose} value={purpose}>{purpose}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Match ID (optional)</label>
                            <input
                                type="number"
                                name="match_id"
                                className="form-control"
                                min="1"
                                value={formData.match_id}
                                onChange={handleChange}
                                placeholder="Link to a match"
                            />
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Tournament ID (optional)</label>
                            {embedded ? (
                                <select
                                    name="tournament_id"
                                    className="form-select"
                                    value={formData.tournament_id}
                                    onChange={handleChange}
                                >
                                    <option value="">Choose tournament</option>
                                    {tournaments.map((tournament) => (
                                        <option key={tournament.id} value={tournament.id}>
                                            {tournament.tournament_name}{tournament.tournament_code ? ` (${tournament.tournament_code})` : ""}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="number"
                                    name="tournament_id"
                                    className="form-control"
                                    min="1"
                                    value={formData.tournament_id}
                                    onChange={handleChange}
                                    placeholder="Link to a tournament"
                                />
                            )}
                        </div>
                    </div>

                    {/* Payment */}
                    <div className="row">
                        <div className="col-md-3 mb-3">
                            <label className="form-label">Total Amount (₹)</label>
                            <input
                                type="number"
                                name="total_amount"
                                className="form-control"
                                min="0"
                                step="0.01"
                                value={formData.total_amount}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="col-md-3 mb-3">
                            <label className="form-label">Paid Amount (₹)</label>
                            <input
                                type="number"
                                name="paid_amount"
                                className="form-control"
                                min="0"
                                step="0.01"
                                value={formData.paid_amount}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="col-md-3 mb-3">
                            <label className="form-label">Balance</label>
                            <div className="form-control bg-light d-flex justify-content-between align-items-center">
                                <span>{formatPrice(balance)}</span>
                                <span className={`badge ${paymentBadge(paymentStatus)}`}>{paymentStatus}</span>
                            </div>
                        </div>

                        {isEdit && (
                            <div className="col-md-3 mb-3">
                                <label className="form-label">Booking Status</label>
                                <select
                                    name="booking_status"
                                    className="form-select"
                                    value={formData.booking_status}
                                    onChange={handleChange}
                                >
                                    {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    {Number(formData.paid_amount) > 0 && (
                        <div className="row">
                            <div className="col-md-4 mb-3">
                                <label className="form-label">Payment Mode</label>
                                <select
                                    name="payment_mode"
                                    className="form-select"
                                    value={formData.payment_mode}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="">Select mode</option>
                                    {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>

                            <div className="col-md-4 mb-3">
                                <label className="form-label">Transaction No (optional)</label>
                                <input
                                    type="text"
                                    name="transaction_no"
                                    className="form-control"
                                    value={formData.transaction_no}
                                    onChange={handleChange}
                                    placeholder="UPI ref / cheque no"
                                />
                            </div>
                        </div>
                    )}

                    {isEdit && (
                        <div className="alert alert-warning py-2">
                            Saving replaces the booking&apos;s payment records with a single payment of the
                            paid amount above, dated today.
                        </div>
                    )}

                    <div className="mb-3">
                        <label className="form-label">Remarks (optional)</label>
                        <textarea
                            name="remarks"
                            className="form-control"
                            rows={3}
                            value={formData.remarks}
                            onChange={handleChange}
                            placeholder="Enter remarks"
                        />
                    </div>

                    <div className="d-flex gap-2">
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? "Saving..." : isEdit ? "Update Booking" : "Create Booking"}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => embedded ? onCancel?.() : router.push("/next_panel/ground-bookings")}
                        >
                            {embedded ? "Close" : "Cancel"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
