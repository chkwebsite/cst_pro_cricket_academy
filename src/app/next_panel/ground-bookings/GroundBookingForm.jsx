"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, UserCheck, Search, X, Check, AlertCircle } from "lucide-react";
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
    umpire_id: "",
    umpire_fee_id: "",
    umpire_name: "",
    umpire_phone: "",
    umpire_match_type: "",
    umpire_fee_amount: 0,
    umpire_payment_type: "Per Match",
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
    const [matches, setMatches] = useState([]);
    const [tournamentsList, setTournamentsList] = useState([]);

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState("");

    // Umpire modal state
    const [showUmpireModal, setShowUmpireModal] = useState(false);
    const [availableUmpires, setAvailableUmpires] = useState([]);
    const [loadingUmpires, setLoadingUmpires] = useState(false);
    const [umpireSearch, setUmpireSearch] = useState("");
    const [selectedModalUmpireId, setSelectedModalUmpireId] = useState("");
    const [selectedModalFeeId, setSelectedModalFeeId] = useState("");

    const openUmpireModal = async () => {
        setShowUmpireModal(true);
        setLoadingUmpires(true);
        try {
            const slot = slots.find((s) => String(s.id) === String(formData.slot_id));
            const acadId = isEdit ? academyId : (slot?.academy_id || userAcademyId);
            const brId = isEdit ? branchId : (slot?.branch_id || userBranchId);

            const params = new URLSearchParams({ status: "1" });
            if (acadId) params.set("academy_id", String(acadId));
            if (brId) params.set("branch_id", String(brId));

            const res = await fetch(`/api/umpires?${params.toString()}`);
            const json = await res.json();
            if (res.ok && json.success) {
                setAvailableUmpires(json.data || []);
            }
        } catch (err) {
            console.error("Failed to fetch umpires:", err);
        } finally {
            setLoadingUmpires(false);
        }
    };

    const handleAssignUmpire = (ump, feeObj) => {
        setFormData((prev) => ({
            ...prev,
            umpire_id: String(ump.id),
            umpire_fee_id: feeObj?.id ? String(feeObj.id) : "",
            umpire_name: ump.umpire_name,
            umpire_phone: ump.mobile,
            umpire_match_type: feeObj?.match_type || "Standard",
            umpire_fee_amount: Number(feeObj?.fee_amount || 0),
            umpire_payment_type: feeObj?.payment_type || "Per Match",
        }));
        setShowUmpireModal(false);
    };

    const handleRemoveUmpire = () => {
        setFormData((prev) => ({
            ...prev,
            umpire_id: "",
            umpire_fee_id: "",
            umpire_name: "",
            umpire_phone: "",
            umpire_match_type: "",
            umpire_fee_amount: 0,
            umpire_payment_type: "Per Match",
        }));
    };

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

    // Matches and Tournaments for booking linkage
    useEffect(() => {
        if (!hasSessionUser) return;

        const controller = new AbortController();
        const loadMatchesAndTournaments = async () => {
            try {
                const matchParams = new URLSearchParams();
                const tournParams = new URLSearchParams();
                const academyParam = userAcademyId || "";
                if (academyParam) {
                    matchParams.set("academy_id", String(academyParam));
                    tournParams.set("academy_id", String(academyParam));
                }

                const [mRes, tRes] = await Promise.all([
                    fetch(`/api/matches?${matchParams.toString()}`, { signal: controller.signal }),
                    fetch(`/api/tournaments?${tournParams.toString()}`, { signal: controller.signal }),
                ]);

                const [mJson, tJson] = await Promise.all([mRes.json(), tRes.json()]);
                if (mRes.ok && mJson.success) setMatches(mJson.data || []);
                if (tRes.ok && tJson.success) setTournamentsList(tJson.data || []);
            } catch (err) {
                if (err.name !== "AbortError") {
                    console.error("Error loading matches/tournaments in booking form:", err);
                }
            }
        };

        loadMatchesAndTournaments();
        return () => controller.abort();
    }, [hasSessionUser, userAcademyId]);

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
                    umpire_id: d.umpire_id ? String(d.umpire_id) : "",
                    umpire_fee_id: d.umpire_fee_id ? String(d.umpire_fee_id) : "",
                    umpire_name: d.umpire_name || "",
                    umpire_phone: d.umpire_phone || "",
                    umpire_match_type: d.umpire_match_type || "",
                    umpire_fee_amount: d.umpire_fee_amount ?? 0,
                    umpire_payment_type: d.umpire_payment_type || "Per Match",
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
                ground_id: gId ? String(gId) : prev.ground_id,
                slot_id: sId ? String(sId) : prev.slot_id,
                booking_date: bDate ? toDateInput(bDate) : prev.booking_date,
                customer_name: cName || prev.customer_name,
                customer_phone: cPhone || prev.customer_phone,
                customer_email: cEmail || prev.customer_email,
                purpose: purp ? normalizePurpose(purp) : prev.purpose,
                remarks: rem || (reqNo ? `Converted from Request #${reqNo}` : prev.remarks),
            }));
        }
    }, [searchParams, isEdit]);

    // Ensure slots specifically for formData.ground_id are loaded
    useEffect(() => {
        if (!formData.ground_id) return;

        const hasSlotsForGround = slots.some((s) => String(s.ground_id) === String(formData.ground_id));
        if (hasSlotsForGround) return;

        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/ground-slots?ground_id=${formData.ground_id}&status=1`, { cache: "no-store" });
                const json = await res.json();
                if (!cancelled && res.ok && json.success && Array.isArray(json.data)) {
                    setSlots((prev) => {
                        const existingIds = new Set(prev.map((s) => String(s.id)));
                        const newSlots = json.data.filter((s) => !existingIds.has(String(s.id)));
                        return newSlots.length > 0 ? [...prev, ...newSlots] : prev;
                    });
                }
            } catch (err) {
                console.error("Failed to load ground slots:", err);
            }
        })();

        return () => { cancelled = true; };
    }, [formData.ground_id, slots]);

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
                        ground_id: req.ground_id ? String(req.ground_id) : prev.ground_id,
                        booking_date: req.booking_date ? toDateInput(req.booking_date) : prev.booking_date,
                        customer_name: req.customer_name || prev.customer_name,
                        customer_phone: req.mobile || prev.customer_phone,
                        customer_email: req.email || prev.customer_email,
                        purpose: req.booking_purpose ? normalizePurpose(req.booking_purpose) : prev.purpose,
                        remarks: prev.remarks || (req.special_requirements ? `[Req #${req.request_number}] ${req.special_requirements}` : `Converted from Request #${req.request_number}`),
                        umpire_id: req.umpire_id ? String(req.umpire_id) : prev.umpire_id,
                        umpire_fee_id: req.umpire_fee_id ? String(req.umpire_fee_id) : prev.umpire_fee_id,
                        umpire_name: req.umpire_name || prev.umpire_name,
                        umpire_phone: req.umpire_phone || prev.umpire_phone,
                        umpire_match_type: req.umpire_match_type || prev.umpire_match_type,
                        umpire_fee_amount: req.umpire_fee_amount ?? prev.umpire_fee_amount,
                        umpire_payment_type: req.umpire_payment_type || prev.umpire_payment_type,
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

    // Auto-match slot and price when slots or ground_id is available
    useEffect(() => {
        if (isEdit || !slots.length) return;

        const paramGroundId = searchParams.get("ground_id");
        const paramSlotId = searchParams.get("slot_id");
        const paramDate = searchParams.get("booking_date");
        const paramStartTime = searchParams.get("start_time");
        const paramEndTime = searchParams.get("end_time");

        const targetGroundId = formData.ground_id || (paramGroundId ? String(paramGroundId) : "");
        const targetSlotId = formData.slot_id || (paramSlotId ? String(paramSlotId) : "");
        const targetDate = formData.booking_date || (paramDate ? toDateInput(paramDate) : "");

        if (!targetGroundId) return;

        const availableSlots = slots.filter((s) => String(s.ground_id) === String(targetGroundId));
        if (!availableSlots.length) return;

        let matched = null;

        if (targetSlotId) {
            matched = availableSlots.find((s) => String(s.id) === String(targetSlotId));
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
            const slotPrice = Number(matched.price) || 0;
            setFormData((prev) => {
                const nextGroundId = String(targetGroundId);
                const nextSlotId = String(matched.id);
                const nextDate = prev.booking_date || targetDate;
                const nextTotal = prev.total_amount > 0 ? prev.total_amount : slotPrice;

                if (
                    String(prev.ground_id) === nextGroundId &&
                    String(prev.slot_id) === nextSlotId &&
                    prev.booking_date === nextDate &&
                    prev.total_amount === nextTotal
                ) {
                    return prev;
                }

                return {
                    ...prev,
                    ground_id: nextGroundId,
                    slot_id: nextSlotId,
                    booking_date: nextDate,
                    total_amount: nextTotal,
                };
            });
        }
    }, [slots, formData.ground_id, formData.slot_id, formData.booking_date, isEdit, searchParams]);

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
            match_id: formData.match_id && !isNaN(Number(formData.match_id))
                ? Number(formData.match_id)
                : (formData.match_id ? String(formData.match_id).trim() : null),
            tournament_id: formData.tournament_id && !isNaN(Number(formData.tournament_id))
                ? Number(formData.tournament_id)
                : (formData.tournament_id ? String(formData.tournament_id).trim() : null),
            umpire_id: formData.umpire_id ? Number(formData.umpire_id) : null,
            umpire_fee_id: formData.umpire_fee_id ? Number(formData.umpire_fee_id) : null,
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
                            <label className="form-label">Ground <span className="text-danger ms-1">*</span></label>
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
                            <label className="form-label">Slot <span className="text-danger ms-1">*</span></label>
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
                            <label className="form-label">Booking Date <span className="text-danger ms-1">*</span></label>
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
                            <label className="form-label">Customer Name <span className="text-danger ms-1">*</span></label>
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
                            <label className="form-label">Phone</label>
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
                            <label className="form-label">Email</label>
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
                            <label className="form-label">Purpose <span className="text-danger ms-1">*</span></label>
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
                            <label className="form-label">Match ID</label>
                            <select
                                name="match_id"
                                className="form-select"
                                value={formData.match_id}
                                onChange={handleChange}
                            >
                                <option value="">Select match</option>
                                {formData.match_id && !matches.some((m) => String(m.id) === String(formData.match_id)) && (
                                    <option value={formData.match_id}>Match #{formData.match_id}</option>
                                )}
                                {matches.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.match_no || `Match #${m.id}`} — {m.team_a_name} vs {m.team_b_name}{m.match_date ? ` (${String(m.match_date).slice(0, 10)})` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Tournament ID</label>
                            <select
                                name="tournament_id"
                                className="form-select"
                                value={formData.tournament_id}
                                onChange={handleChange}
                            >
                                <option value="">Choose tournament</option>
                                {formData.tournament_id && !(embedded ? tournaments : tournamentsList).some((t) => String(t.id) === String(formData.tournament_id)) && (
                                    <option value={formData.tournament_id}>Tournament #{formData.tournament_id}</option>
                                )}
                                {(embedded ? tournaments : tournamentsList).map((tournament) => (
                                    <option key={tournament.id} value={tournament.id}>
                                        {tournament.tournament_name}{tournament.tournament_code ? ` (${tournament.tournament_code})` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Umpire Requirement Section */}
                    <div className="mb-4">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <label className="form-label fw-bold mb-0 d-flex align-items-center gap-2">
                                <UserCheck size={18} className="text-primary" />
                                Match Umpire Requirement
                            </label>
                            {formData.umpire_id && (
                                <span className="badge bg-success-subtle text-success border border-success-subtle">
                                    Assigned
                                </span>
                            )}
                        </div>

                        {formData.umpire_id ? (
                            <div className="card bg-light border-primary-subtle p-3 rounded-3 shadow-xs">
                                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="p-2 rounded-3 bg-primary text-white">
                                            <UserCheck size={20} />
                                        </div>
                                        <div>
                                            <div className="fw-bold">{formData.umpire_name}</div>
                                            <div className="small text-muted">
                                                {formData.umpire_phone && (
                                                    <span className="me-3">📞 {formData.umpire_phone}</span>
                                                )}
                                                <span>
                                                    Match Format: <strong className="text-dark">{formData.umpire_match_type || "Standard"}</strong> • Fee: <strong className="text-success">₹{Number(formData.umpire_fee_amount || 0).toLocaleString("en-IN")}</strong> ({formData.umpire_payment_type || "Per Match"})
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="d-flex align-items-center gap-2">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-primary"
                                            onClick={openUmpireModal}
                                        >
                                            Change Umpire
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-danger"
                                            onClick={handleRemoveUmpire}
                                        >
                                            Remove Umpire
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="d-flex align-items-center justify-content-between p-3 border border-dashed rounded-3 bg-light">
                                <div className="text-muted small">
                                    Need a certified umpire for this match, friendly, or practice slot?
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                                    onClick={openUmpireModal}
                                >
                                    <UserCheck size={16} /> + Need Umpire
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Payment */}
                    <div className="row">
                        <div className="col-md-3 mb-3">
                            <label className="form-label">Total Amount (₹) <span className="text-danger ms-1">*</span></label>
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
                                <label className="form-label">Payment Mode <span className="text-danger ms-1">*</span></label>
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
                                <label className="form-label">Transaction No</label>
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
                        <label className="form-label">Remarks</label>
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

                {/* Umpire Selection Modal */}
                {showUmpireModal && (
                    <div
                        className="modal show d-block"
                        tabIndex="-1"
                        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
                    >
                        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
                            <div className="modal-content rounded-4 border-0 shadow">
                                <div className="modal-header border-0 pb-0">
                                    <div className="d-flex align-items-center gap-2">
                                        <div className="p-2 rounded-3 bg-primary-subtle text-primary">
                                            <UserCheck size={20} />
                                        </div>
                                        <div>
                                            <h5 className="modal-title fw-bold">Select Match Umpire</h5>
                                            <small className="text-muted">
                                                Choose an active umpire and their format billing rate
                                            </small>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn-close"
                                        onClick={() => setShowUmpireModal(false)}
                                    ></button>
                                </div>

                                <div className="modal-body p-4">
                                    {/* Search Input */}
                                    <div className="input-group mb-3">
                                        <span className="input-group-text bg-white">
                                            <Search size={16} className="text-muted" />
                                        </span>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Search by umpire name, phone, or qualification..."
                                            value={umpireSearch}
                                            onChange={(e) => setUmpireSearch(e.target.value)}
                                        />
                                    </div>

                                    {loadingUmpires ? (
                                        <div className="text-center py-4 text-muted">
                                            <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                                            Loading umpires...
                                        </div>
                                    ) : availableUmpires.length === 0 ? (
                                        <div className="text-center py-4 text-muted">
                                            <UserCheck size={36} className="mb-2 opacity-50" />
                                            <div>No active umpires found for this academy/branch.</div>
                                            <Link
                                                href="/next_panel/umpires/new"
                                                target="_blank"
                                                className="btn btn-sm btn-link mt-1"
                                            >
                                                + Register a new umpire
                                            </Link>
                                        </div>
                                    ) : (
                                        <div className="d-flex flex-column gap-3">
                                            {availableUmpires
                                                .filter((u) => {
                                                    if (!umpireSearch.trim()) return true;
                                                    const q = umpireSearch.toLowerCase();
                                                    return (
                                                        u.umpire_name.toLowerCase().includes(q) ||
                                                        (u.mobile && u.mobile.includes(q)) ||
                                                        (u.qualification && u.qualification.toLowerCase().includes(q))
                                                    );
                                                })
                                                .map((ump) => {
                                                    const isCurrentlyAssigned = String(formData.umpire_id) === String(ump.id);
                                                    return (
                                                        <div
                                                            key={ump.id}
                                                            className={`card border rounded-3 p-3 transition-all ${
                                                                isCurrentlyAssigned
                                                                    ? "border-primary bg-primary-subtle"
                                                                    : "border-light-subtle bg-white hover-shadow"
                                                            }`}
                                                        >
                                                            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                                                                <div>
                                                                    <div className="fw-bold d-flex align-items-center gap-2">
                                                                        {ump.umpire_name}
                                                                        {isCurrentlyAssigned && (
                                                                            <span className="badge bg-primary text-white">
                                                                                Current
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <small className="text-muted">
                                                                        📞 {ump.mobile}
                                                                        {ump.qualification ? ` • ${ump.qualification}` : ""}
                                                                        {ump.experience_years ? ` • ${ump.experience_years} yrs exp` : ""}
                                                                    </small>
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-outline-primary"
                                                                    onClick={() => handleAssignUmpire(ump, null)}
                                                                >
                                                                    Assign (Standard)
                                                                </button>
                                                            </div>

                                                            {/* Configured Fees */}
                                                            {ump.fees && ump.fees.length > 0 && (
                                                                <div className="mt-2 pt-2 border-top">
                                                                    <small className="fw-semibold text-muted d-block mb-1">
                                                                        Available Format Fee Rates:
                                                                    </small>
                                                                    <div className="d-flex flex-wrap gap-2">
                                                                        {ump.fees.map((fee) => (
                                                                            <button
                                                                                key={fee.id}
                                                                                type="button"
                                                                                className="btn btn-sm btn-light border text-start d-flex align-items-center gap-2 py-1 px-2"
                                                                                onClick={() => handleAssignUmpire(ump, fee)}
                                                                                title="Click to assign with this fee"
                                                                            >
                                                                                <span className="fw-semibold">{fee.match_type}:</span>
                                                                                <span className="text-success fw-bold">
                                                                                    ₹{Number(fee.fee_amount).toLocaleString("en-IN")}
                                                                                </span>
                                                                                <span className="text-muted small">
                                                                                    ({fee.payment_type})
                                                                                </span>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    )}
                                </div>

                                <div className="modal-footer border-0 pt-0">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => setShowUmpireModal(false)}
                                    >
                                        Cancel
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
