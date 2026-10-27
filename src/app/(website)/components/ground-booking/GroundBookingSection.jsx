"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@/app/next_panel/components/UserContext";
import {
    AlertCircle,
    Check,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    Mail,
    MapPin,
    Moon,
    Phone,
    Plus,
    Search,
    ShieldCheck,
    Sun,
    Trophy,
    User,
    Users,
    X,
} from "lucide-react";

// ==========================================
// FALLBACK DATA (Used if DB is offline/empty)
// ==========================================
const FALLBACK_GROUNDS = [
    {
        id: 1,
        ground_name: "ST International Cricket Stadium - Ground A",
        ground_code: "GRD-01",
        contact_person: "Coach Vikram Singh",
        phone: "+91 8285831503",
        email: "ground@stacademy.com",
        address: "ST Sports Complex, Sector 48, Sohna Road",
        description: "Championship-standard natural turf cricket ground equipped with 800-lux tournament floodlights, 65m boundary, player pavilion, and digital scoreboard.",
        ground_facility: "Turf Match Pitch, 800-Lux Floodlights, Air-Conditioned Pavilion, Practice Nets, Live Streaming Tower, Digital Scoreboard",
        status: 1,
    },
    {
        id: 2,
        ground_name: "ST Academy Turf & Nets Arena - Ground B",
        ground_code: "GRD-02",
        contact_person: "Admin In-Charge",
        phone: "+91 8285831503",
        email: "practice@stacademy.com",
        address: "ST Academy Campus, Ground B",
        description: "Dedicated match practice ground with 6 turf nets, 2 bowling machines, fitness sprint tracks, and shaded dugout for high-intensity training.",
        ground_facility: "6 Turf Nets, Bowling Machine, Astro-turf, Floodlights, Changing Rooms",
        status: 1,
    },
];

const PRESET_SLOTS = [
    {
        label: "Morning Match",
        time: "06:00 - 10:00",
        start: "06:00",
        end: "10:00",
        icon: Sun,
        desc: "Ideal for cool morning overs",
    },
    {
        label: "Day Session",
        time: "10:00 - 14:00",
        start: "10:00",
        end: "14:00",
        icon: Sun,
        desc: "Full sunshine match play",
    },
    {
        label: "Afternoon Match",
        time: "14:00 - 18:00",
        start: "14:00",
        end: "18:00",
        icon: Sun,
        desc: "Golden hour T20 fixture",
    },
    {
        label: "Floodlight Night",
        time: "18:00 - 22:00",
        start: "18:00",
        end: "22:00",
        icon: Moon,
        desc: "High-voltage night match",
    },
    {
        label: "Full Day Tournament",
        time: "07:00 - 17:00",
        start: "07:00",
        end: "17:00",
        icon: Trophy,
        desc: "Full day corporate/club cup",
    },
];

const BOOKING_PURPOSES = [
    "Practice Session",
    "Friendly Match",
    "Tournament",
    "Corporate Event",
    "Other",
];

const pad = (n) => String(n).padStart(2, "0");
const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function GroundBookingSection() {
    // -----------------------------------------------------------------
    // Grounds & Bookings Data State
    // -----------------------------------------------------------------
    const [grounds, setGrounds] = useState([]);
    const [selectedGroundId, setSelectedGroundId] = useState(1);
    const [bookingRequests, setBookingRequests] = useState([]);
    const [confirmedBookings, setConfirmedBookings] = useState([]);
    const [allSlots, setAllSlots] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [bookingAlertMessage, setBookingAlertMessage] = useState("");

    // -----------------------------------------------------------------
    // Calendar Navigation State
    // -----------------------------------------------------------------
    const today = useMemo(() => new Date(), []);
    const todayStr = useMemo(() => toDateKey(today), [today]);

    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [selectedDate, setSelectedDate] = useState(todayStr);

    // -----------------------------------------------------------------
    // Modal & Form State
    // -----------------------------------------------------------------
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [groundSlots, setGroundSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [selectedSlotPreset, setSelectedSlotPreset] = useState("Morning Match");
    const [formData, setFormData] = useState({
        customer_name: "",
        mobile: "",
        email: "",
        ground_id: 1,
        booking_date: todayStr,
        start_time: "06:00",
        end_time: "10:00",
        booking_purpose: "Friendly Match",
        number_of_players: 22,
        special_requirements: "",
    });

    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");
    const [formSuccess, setFormSuccess] = useState(null);

    // -----------------------------------------------------------------
    // Status Tracker Search State
    // -----------------------------------------------------------------
    const [trackerQuery, setTrackerQuery] = useState("");
    const [trackerResult, setTrackerResult] = useState(null);
    const [trackingLoading, setTrackingLoading] = useState(false);
    const [trackerError, setTrackerError] = useState("");

    const { user } = useUser();

    useEffect(() => {
        if (user) {
            setFormData((prev) => ({
                ...prev,
                customer_name: prev.customer_name || user.name || `${user.first_name || ""} ${user.last_name || ""}`.trim(),
                mobile: prev.mobile || user.phone || "",
                email: prev.email || user.email || "",
            }));
        }
    }, [user]);

    // -----------------------------------------------------------------
    // 1. Fetch Grounds & Bookings
    // -----------------------------------------------------------------
    const refreshData = useCallback(async () => {
        try {
            const [groundsRes, requestsRes, bookingsRes, slotsRes] = await Promise.all([
                fetch("/api/ground?status=1").catch(() => null),
                fetch("/api/ground-booking-requests").catch(() => null),
                fetch("/api/ground-bookings").catch(() => null),
                fetch("/api/ground-slots?status=1").catch(() => null),
            ]);

            const groundsJson = groundsRes?.ok ? await groundsRes.json() : null;
            const requestsJson = requestsRes?.ok ? await requestsRes.json() : null;
            const bookingsJson = bookingsRes?.ok ? await bookingsRes.json() : null;
            const slotsJson = slotsRes?.ok ? await slotsRes.json() : null;

            const loadedGrounds =
                groundsJson?.success && Array.isArray(groundsJson.data) && groundsJson.data.length > 0
                    ? groundsJson.data
                    : FALLBACK_GROUNDS;

            setGrounds(loadedGrounds);
            if (requestsJson?.success && Array.isArray(requestsJson.data)) {
                setBookingRequests(requestsJson.data);
            }
            if (bookingsJson?.success && Array.isArray(bookingsJson.data)) {
                setConfirmedBookings(bookingsJson.data);
            }
            if (slotsJson?.success && Array.isArray(slotsJson.data)) {
                setAllSlots(slotsJson.data);
            }
        } catch (err) {
            console.error("Ground data refresh error:", err);
        }
    }, []);

    // Fetch slots from api/ground-slots
    const loadGroundSlots = useCallback(async (groundId) => {
        if (!groundId) return;
        try {
            setLoadingSlots(true);
            const res = await fetch(`/api/ground-slots?ground_id=${groundId}&status=1`).catch(() => null);
            const json = res?.ok ? await res.json() : null;
            if (json?.success && Array.isArray(json.data) && json.data.length > 0) {
                setGroundSlots(json.data);
            } else {
                setGroundSlots([]);
            }
        } catch (err) {
            console.error("Error fetching ground slots:", err);
            setGroundSlots([]);
        } finally {
            setLoadingSlots(false);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;

        async function initLoad() {
            try {
                const [groundsRes, requestsRes, bookingsRes, slotsRes] = await Promise.all([
                    fetch("/api/ground?status=1").catch(() => null),
                    fetch("/api/ground-booking-requests").catch(() => null),
                    fetch("/api/ground-bookings").catch(() => null),
                    fetch("/api/ground-slots?status=1").catch(() => null),
                ]);

                const groundsJson = groundsRes?.ok ? await groundsRes.json() : null;
                const requestsJson = requestsRes?.ok ? await requestsRes.json() : null;
                const bookingsJson = bookingsRes?.ok ? await bookingsRes.json() : null;
                const slotsJson = slotsRes?.ok ? await slotsRes.json() : null;

                if (!isMounted) return;

                const loadedGrounds =
                    groundsJson?.success && Array.isArray(groundsJson.data) && groundsJson.data.length > 0
                        ? groundsJson.data
                        : FALLBACK_GROUNDS;

                setGrounds(loadedGrounds);
                const initialGId = loadedGrounds.length > 0 ? loadedGrounds[0].id : 1;
                setSelectedGroundId(initialGId);

                if (requestsJson?.success && Array.isArray(requestsJson.data)) {
                    setBookingRequests(requestsJson.data);
                }

                if (bookingsJson?.success && Array.isArray(bookingsJson.data)) {
                    setConfirmedBookings(bookingsJson.data);
                }

                if (slotsJson?.success && Array.isArray(slotsJson.data)) {
                    setAllSlots(slotsJson.data);
                }

                // Pre-load slots for initial ground
                loadGroundSlots(initialGId);
            } catch (err) {
                console.error("Ground data fetch error:", err);
                if (isMounted) setGrounds(FALLBACK_GROUNDS);
            } finally {
                if (isMounted) setLoadingData(false);
            }
        }

        initLoad();

        return () => {
            isMounted = false;
        };
    }, [loadGroundSlots]);

    // Active Ground Object
    const activeGround = useMemo(() => {
        return (
            grounds.find((g) => String(g.id) === String(selectedGroundId)) ||
            grounds[0] ||
            FALLBACK_GROUNDS[0]
        );
    }, [grounds, selectedGroundId]);

    // -----------------------------------------------------------------
    // 2. Calendar Computations
    // -----------------------------------------------------------------
    const calendarDays = useMemo(() => {
        const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
        const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
        const prevMonthTotalDays = new Date(currentYear, currentMonth, 0).getDate();

        const cells = [];

        // Previous month trailing days
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const dayNum = prevMonthTotalDays - i;
            const prevMonthDate = new Date(currentYear, currentMonth - 1, dayNum);
            cells.push({
                day: dayNum,
                dateKey: toDateKey(prevMonthDate),
                isCurrentMonth: false,
                isPast: toDateKey(prevMonthDate) < todayStr,
            });
        }

        // Current month days
        for (let d = 1; d <= totalDays; d++) {
            const dateObj = new Date(currentYear, currentMonth, d);
            const dateKey = toDateKey(dateObj);
            cells.push({
                day: d,
                dateKey,
                isCurrentMonth: true,
                isPast: dateKey < todayStr,
            });
        }

        // Next month leading days to complete grid (multiples of 7)
        const remaining = 7 - (cells.length % 7);
        if (remaining < 7) {
            for (let nextD = 1; nextD <= remaining; nextD++) {
                const nextMonthDate = new Date(currentYear, currentMonth + 1, nextD);
                cells.push({
                    day: nextD,
                    dateKey: toDateKey(nextMonthDate),
                    isCurrentMonth: false,
                    isPast: toDateKey(nextMonthDate) < todayStr,
                });
            }
        }

        return cells;
    }, [currentYear, currentMonth, todayStr]);

    // Month Navigation Handlers
    const handlePrevMonth = () => {
        if (currentMonth === 0) {
            setCurrentYear((y) => y - 1);
            setCurrentMonth(11);
        } else {
            setCurrentMonth((m) => m - 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentYear((y) => y + 1);
            setCurrentMonth(0);
        } else {
            setCurrentMonth((m) => m + 1);
        }
    };

    const handleJumpToToday = () => {
        setCurrentYear(today.getFullYear());
        setCurrentMonth(today.getMonth());
        setSelectedDate(todayStr);
    };

    // -----------------------------------------------------------------
    // 3. Availability Helper for a given dateKey & Slot Checking
    // -----------------------------------------------------------------
    const getDateBookings = useCallback(
        (dateKey) => {
            const requests = bookingRequests.filter(
                (r) =>
                    String(r.ground_id) === String(selectedGroundId) &&
                    String(r.booking_date).slice(0, 10) === dateKey &&
                    r.request_status !== "Rejected" &&
                    r.request_status !== "Cancelled"
            );

            const confirmed = confirmedBookings.filter(
                (b) =>
                    String(b.ground_id) === String(selectedGroundId) &&
                    String(b.booking_date).slice(0, 10) === dateKey &&
                    b.booking_status !== "Cancelled"
            );

            return { requests, confirmed, total: requests.length + confirmed.length };
        },
        [bookingRequests, confirmedBookings, selectedGroundId]
    );

    // Check if a specific slot is booked on a date
    const checkSlotBooked = useCallback(
        (slot, dateKey, targetGroundId) => {
            const gId = targetGroundId || selectedGroundId;
            const sStart = String(slot.start_time || slot.start || "").slice(0, 5);
            const sEnd = String(slot.end_time || slot.end || "").slice(0, 5);

            // 1. Confirmed Bookings (cst_ground_bookings)
            const isConfirmed = confirmedBookings.some((b) => {
                if (String(b.ground_id) !== String(gId)) return false;
                const bDate = String(b.booking_date).slice(0, 10);
                if (bDate !== dateKey) return false;
                if (b.booking_status === "Cancelled") return false;

                // Match by slot_id
                if (slot.id && b.slot_id && String(b.slot_id) === String(slot.id)) {
                    return true;
                }

                // Match by time overlap
                if (b.start_time && b.end_time && sStart && sEnd) {
                    const bStart = String(b.start_time).slice(0, 5);
                    const bEnd = String(b.end_time).slice(0, 5);
                    return bStart < sEnd && bEnd > sStart;
                }

                return false;
            });

            if (isConfirmed) return true;

            // 2. Booking Requests (cst_ground_booking_requests)
            const isRequested = bookingRequests.some((r) => {
                if (String(r.ground_id) !== String(gId)) return false;
                const rDate = String(r.booking_date).slice(0, 10);
                if (rDate !== dateKey) return false;
                if (r.request_status === "Rejected" || r.request_status === "Cancelled") return false;

                // Match by time overlap
                if (r.start_time && r.end_time && sStart && sEnd) {
                    const rStart = String(r.start_time).slice(0, 5);
                    const rEnd = String(r.end_time).slice(0, 5);
                    return rStart < sEnd && rEnd > sStart;
                }

                return false;
            });

            return isRequested;
        },
        [confirmedBookings, bookingRequests, selectedGroundId]
    );

    // Get comprehensive status of all slots on a date
    const getDateSlotStatus = useCallback(
        (dateKey, targetGroundId) => {
            const gId = targetGroundId || selectedGroundId;
            const slotsForGround = allSlots.filter((s) => String(s.ground_id) === String(gId));
            const activeSlots = slotsForGround.length > 0 ? slotsForGround : (groundSlots.length > 0 ? groundSlots : PRESET_SLOTS.slice(0, 2));

            const totalSlots = activeSlots.length;
            const bookedSlots = activeSlots.filter((slot) => checkSlotBooked(slot, dateKey, gId));
            const availableSlots = activeSlots.filter((slot) => !checkSlotBooked(slot, dateKey, gId));

            const isFullyBooked = totalSlots > 0 && bookedSlots.length >= totalSlots;
            const isPartiallyBooked = bookedSlots.length > 0 && !isFullyBooked;
            const isAvailable = bookedSlots.length === 0;

            return {
                totalSlots,
                bookedCount: bookedSlots.length,
                availableCount: availableSlots.length,
                bookedSlots,
                availableSlots,
                isFullyBooked,
                isPartiallyBooked,
                isAvailable,
            };
        },
        [allSlots, groundSlots, selectedGroundId, checkSlotBooked]
    );

    // Bookings and Slot Status for selected date
    const selectedDateBookings = useMemo(() => {
        return getDateBookings(selectedDate);
    }, [getDateBookings, selectedDate]);

    const selectedDateStatus = useMemo(() => {
        return getDateSlotStatus(selectedDate);
    }, [getDateSlotStatus, selectedDate]);

    // -----------------------------------------------------------------
    // 4. Handle Date Click
    // -----------------------------------------------------------------
    const handleDateClick = (dayCell) => {
        if (dayCell.isPast) return;

        const slotStatus = getDateSlotStatus(dayCell.dateKey);

        // Agar kisi date ko dono slot booked ho: date par click na ho aur message dede ki already booked
        if (slotStatus.isFullyBooked) {
            setBookingAlertMessage(
                `Already Booked: All playing slots for ${activeGround.ground_name} on ${dayCell.dateKey} are already booked! Please select another date.`
            );
            return;
        }

        setSelectedDate(dayCell.dateKey);

        // Clear alert if date has available slots
        setBookingAlertMessage("");

        // Agar date completely free hai (dono slot available), automatically open modal
        if (slotStatus.isAvailable) {
            openBookingModal(dayCell.dateKey);
        }
    };

    // Open booking modal with prefilled date and load ground slots
    const openBookingModal = (dateStr, overrideGroundId) => {
        const targetDate = dateStr || selectedDate;
        const gId = overrideGroundId || selectedGroundId;

        const slotStatus = getDateSlotStatus(targetDate, gId);

        // Safety: agar dono slot booked ho, modal open na ho aur message show kare
        if (slotStatus.isFullyBooked) {
            setBookingAlertMessage(
                `Already Booked: All playing slots on ${targetDate} are already booked! Please select another date.`
            );
            return;
        }

        // First available (unbooked) slot choose karo taaki booked slot preselect na ho
        const firstFree = slotStatus.availableSlots[0];
        const sStart = firstFree
            ? String(firstFree.start_time || firstFree.start || "06:00").slice(0, 5)
            : "06:00";
        const sEnd = firstFree
            ? String(firstFree.end_time || firstFree.end || "10:00").slice(0, 5)
            : "10:00";
        const sName = firstFree ? (firstFree.slot_name || firstFree.label || "Morning") : "Morning";

        setSelectedSlotPreset(sName);
        setFormData((prev) => ({
            ...prev,
            ground_id: gId,
            booking_date: targetDate,
            start_time: sStart,
            end_time: sEnd,
        }));

        setBookingAlertMessage("");
        setFormError("");
        setFormSuccess(null);
        setIsModalOpen(true);
        loadGroundSlots(gId);
    };

    // Close booking modal
    const closeBookingModal = () => {
        setIsModalOpen(false);
        setFormError("");
        setFormSuccess(null);
    };

    // Apply preset time slot
    const handleSelectSlotPreset = (preset) => {
        setSelectedSlotPreset(preset.label);
        setFormData((prev) => ({
            ...prev,
            start_time: preset.start,
            end_time: preset.end,
        }));
    };

    // -----------------------------------------------------------------
    // 5. Submit Ground Booking Request to POST /api/ground-booking-requests
    // -----------------------------------------------------------------
    const handleSubmitBooking = async (e) => {
        e.preventDefault();
        setFormError("");
        setFormSuccess(null);

        // Client-side validations
        if (!formData.customer_name.trim()) {
            setFormError("Please enter your full name.");
            return;
        }

        const phoneDigits = formData.mobile.replace(/[^0-9]/g, "");
        if (phoneDigits.length < 10) {
            setFormError("Please enter a valid 10-digit mobile number.");
            return;
        }

        if (formData.start_time >= formData.end_time) {
            setFormError("End time must be after start time.");
            return;
        }

        // Validate if selected time overlaps with an already booked slot
        const isTimeAlreadyBooked = checkSlotBooked(
            { start_time: formData.start_time, end_time: formData.end_time },
            formData.booking_date,
            formData.ground_id
        );
        if (isTimeAlreadyBooked) {
            setFormError("The selected time slot is already booked on this date. Please choose an available time slot.");
            return;
        }

        try {
            setSubmitting(true);

            const payload = {
                customer_name: formData.customer_name.trim(),
                mobile: phoneDigits,
                email: formData.email.trim() || null,
                ground_id: Number(formData.ground_id),
                booking_date: formData.booking_date,
                start_time: formData.start_time.length === 5 ? `${formData.start_time}:00` : formData.start_time,
                end_time: formData.end_time.length === 5 ? `${formData.end_time}:00` : formData.end_time,
                booking_purpose: formData.booking_purpose,
                number_of_players: formData.number_of_players ? Number(formData.number_of_players) : null,
                special_requirements: formData.special_requirements.trim() || null,
            };

            const res = await fetch("/api/ground-booking-requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setFormSuccess(data);
                // Refresh data to show newly booked date on calendar
                refreshData();
            } else {
                setFormError(data.message || "Failed to submit booking request. Please check inputs.");
            }
        } catch (err) {
            console.error("Booking submission error:", err);
            setFormError("Network error. Please try again or contact the academy directly.");
        } finally {
            setSubmitting(false);
        }
    };

    // -----------------------------------------------------------------
    // 6. Track Request Status
    // -----------------------------------------------------------------
    const handleTrackRequest = async (e) => {
        e.preventDefault();
        if (!trackerQuery.trim()) return;

        try {
            setTrackingLoading(true);
            setTrackerError("");
            setTrackerResult(null);

            const res = await fetch(`/api/ground-booking-requests?search=${encodeURIComponent(trackerQuery.trim())}`);
            const data = await res.json();

            if (res.ok && data.success && Array.isArray(data.data) && data.data.length > 0) {
                setTrackerResult(data.data[0]);
            } else {
                setTrackerError("No booking request found matching this reference number or mobile.");
            }
        } catch (err) {
            console.error("Tracker error:", err);
            setTrackerError("Failed to look up request status. Please try again.");
        } finally {
            setTrackingLoading(false);
        }
    };

    return (
        <section className="py-5 bg-white">
            <div className="container">
                {/* Heading */}
                <div className="text-center mb-5 reveal">
                    <span className="section-tag">Ground Schedule &amp; Slots</span>
                    <h2 className="section-title">Ground Availability &amp; Booking</h2>
                    <div className="divider"></div>
                    <p className="text-secondary max-w-700 mx-auto">
                        Check real-time calendar availability for ST Cricket Grounds. Select any open date to submit an official booking request for match fixtures, net sessions, or corporate tournaments.
                    </p>
                </div>

                {/* Ground Selector Dropdown */}
                <div className="bg-light rounded-4 p-3 p-md-4 mb-4 shadow-sm border">
                    <div className="row g-3 align-items-center justify-content-between">
                        <div className="col-12 col-md-6 col-lg-5">
                            <label htmlFor="ground-select-dropdown" className="form-label fw-bold text-navy small text-uppercase mb-1 d-flex align-items-center gap-2">
                                <Trophy size={16} className="text-primary" />
                                Select Cricket Ground:
                            </label>
                            <select
                                id="ground-select-dropdown"
                                className="form-select form-select-md border-2 shadow-sm rounded-3 fw-semibold text-dark"
                                value={selectedGroundId}
                                onChange={(e) => {
                                    const newGrdId = Number(e.target.value);
                                    setSelectedGroundId(newGrdId);
                                    loadGroundSlots(newGrdId);
                                }}
                            >
                                {grounds.map((g) => (
                                    <option key={`grd-${g.id}`} value={g.id}>
                                        {g.ground_name} {g.ground_code ? `(${g.ground_code})` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Ground Quick Stats */}
                        <div className="col-12 col-md-6 col-lg-7 text-muted small d-flex flex-wrap align-items-center justify-content-md-end gap-3 pt-md-3">
                            <span className="d-inline-flex align-items-center gap-1 bg-white px-3 py-2 rounded-3 border">
                                <MapPin size={15} className="text-red flex-shrink-0" />
                                <span>{activeGround.address || "Main Complex"}</span>
                            </span>
                            <span className="d-inline-flex align-items-center gap-1 bg-white px-3 py-2 rounded-3 border">
                                <Phone size={15} className="text-primary flex-shrink-0" />
                                <span>{activeGround.phone || "+91 8285831503"}</span>
                            </span>
                        </div>
                    </div>

                    {/* Ground Facilities tags */}
                    {activeGround.ground_facility && (
                        <div className="mt-3 pt-3 border-top d-flex flex-wrap align-items-center gap-2">
                            <span className="badge bg-white text-navy border small">Features &amp; Facilities:</span>
                            {activeGround.ground_facility.split(",").map((fac, fIdx) => (
                                <span key={fIdx} className="badge bg-white text-secondary border small">
                                    ✓ {fac.trim()}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* MAIN GRID: Left Calendar (col-lg-7) & Right Details (col-lg-5) */}
                <div className="row g-4 mb-5">
                    {/* LEFT COLUMN: Monthly Calendar */}
                    <div className="col-12 col-lg-7">
                        {/* Booking Alert Banner */}
                        {bookingAlertMessage && (
                            <div className="alert alert-danger alert-dismissible fade show d-flex align-items-center justify-content-between p-3 mb-3 border-2 border-danger shadow-sm rounded-3" role="alert">
                                <div className="d-flex align-items-center gap-2">
                                    <AlertCircle size={22} className="text-danger flex-shrink-0" />
                                    <div>
                                        <strong className="d-block text-danger">Date Unavailable / Already Booked!</strong>
                                        <span className="small text-dark">{bookingAlertMessage}</span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setBookingAlertMessage("")}
                                    aria-label="Close"
                                />
                            </div>
                        )}

                        <div className="ground-cal-box">
                            {/* Calendar Header Navigation */}
                            <div className="ground-cal-header">
                                <div>
                                    <h4 className="fw-bold text-navy mb-0">
                                        {MONTH_NAMES[currentMonth]} {currentYear}
                                    </h4>
                                    <span className="text-muted small">Click any date to view availability or book</span>
                                </div>

                                <div className="d-flex align-items-center gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary rounded-pill px-2 py-1"
                                        onClick={handleJumpToToday}
                                        title="Jump to current date"
                                    >
                                        Today
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-dark rounded-circle p-2"
                                        onClick={handlePrevMonth}
                                        aria-label="Previous month"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-dark rounded-circle p-2"
                                        onClick={handleNextMonth}
                                        aria-label="Next month"
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Legend */}
                            <div className="d-flex flex-wrap align-items-center gap-3 mb-3 pb-2 border-bottom small text-muted">
                                <span className="d-inline-flex align-items-center gap-1">
                                    <span className="status-dot available" /> Available (Click to Book)
                                </span>
                                <span className="d-inline-flex align-items-center gap-1">
                                    <span className="status-dot booked" /> Booked
                                </span>
                                <span className="d-inline-flex align-items-center gap-1">
                                    <span className="status-dot partial" /> Partial / Request
                                </span>
                                <span className="d-inline-flex align-items-center gap-1">
                                    <span className="text-muted opacity-50">Past</span>
                                </span>
                            </div>

                            {/* Day Names Header */}
                            <div className="ground-cal-grid mb-1">
                                {DAY_NAMES.map((dayName) => (
                                    <div key={dayName} className="ground-cal-day-name">
                                        {dayName}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar Days Grid */}
                            <div className="ground-cal-grid">
                                {calendarDays.map((cell, idx) => {
                                    const { requests, confirmed, total } = getDateBookings(cell.dateKey);
                                    const isSelected = selectedDate === cell.dateKey;
                                    const isToday = cell.dateKey === todayStr;
                                    const slotStatus = getDateSlotStatus(cell.dateKey);

                                    let statusDot = "available";
                                    let statusText = "Free";

                                    if (slotStatus.isFullyBooked) {
                                        statusDot = "booked";
                                        statusText = "Booked";
                                    } else if (slotStatus.isPartiallyBooked) {
                                        statusDot = "partial";
                                        statusText = `${slotStatus.availableCount} Left`;
                                    } else if (total > 0) {
                                        if (confirmed.length > 0) {
                                            statusDot = "booked";
                                            statusText = "Booked";
                                        } else {
                                            statusDot = "partial";
                                            statusText = "Pending";
                                        }
                                    }

                                    const isFullyBooked = !cell.isPast && cell.isCurrentMonth && slotStatus.isFullyBooked;

                                    return (
                                        <div
                                            key={`day-${cell.dateKey}-${idx}`}
                                            className={`ground-cal-cell ${cell.isPast ? "is-past" : ""} ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""} ${!cell.isCurrentMonth ? "is-other-month" : ""} ${isFullyBooked ? "is-fully-booked" : ""}`}
                                            onClick={() => handleDateClick(cell)}
                                            title={
                                                cell.isPast
                                                    ? "Past date"
                                                    : isFullyBooked
                                                    ? `Already Booked: All slots on ${cell.dateKey} are reserved`
                                                    : `${cell.dateKey}: ${statusText}`
                                            }
                                        >
                                            <span className="ground-cal-num">{cell.day}</span>

                                            {!cell.isPast && cell.isCurrentMonth && (
                                                <div className="d-flex align-items-center gap-1">
                                                    <span className={`status-dot ${statusDot}`} />
                                                    <span className="status-badge-text">
                                                        {statusText}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Selected Date Details & Action */}
                    <div className="col-12 col-lg-5">
                        <div className="ground-details-card h-100 d-flex flex-column justify-content-between">
                            <div>
                                <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                                    <span className="badge bg-red text-white px-3 py-1">
                                        Selected Date
                                    </span>
                                    <span className="text-muted small">
                                        Ground: <strong>{activeGround.ground_code || "GRD-01"}</strong>
                                    </span>
                                </div>

                                <h4 className="fw-bold text-navy mb-1">
                                    {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                                        weekday: "long",
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                    })}
                                </h4>

                                <p className="text-secondary small mb-4">
                                    {activeGround.ground_name}
                                </p>

                                {/* Availability State Card */}
                                {selectedDateStatus.isFullyBooked ? (
                                    <div className="bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded-4 p-3 mb-4">
                                        <div className="d-flex align-items-center gap-2 mb-2">
                                            <AlertCircle size={22} className="text-danger flex-shrink-0" />
                                            <h6 className="fw-bold text-danger mb-0">
                                                Already Booked (All Slots Reserved)
                                            </h6>
                                        </div>
                                        <p className="text-secondary small mb-3">
                                            All playing slots for {activeGround.ground_name} are already booked on this date ({selectedDate}). Online booking is unavailable for this date. Please choose another open date on the calendar.
                                        </p>

                                        {/* List Booked Slots */}
                                        <div className="d-flex flex-column gap-2 mb-3">
                                            {selectedDateStatus.bookedSlots.map((slot, sIdx) => (
                                                <div
                                                    key={`b-slot-full-${sIdx}`}
                                                    className="bg-white rounded-3 p-2 border small d-flex justify-content-between align-items-center"
                                                >
                                                    <div>
                                                        <span className="fw-bold text-danger d-block">
                                                            {slot.slot_name || "Match Slot"}
                                                        </span>
                                                        <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                                                            {slot.start_time?.slice(0, 5) || slot.start} - {slot.end_time?.slice(0, 5) || slot.end}
                                                        </span>
                                                    </div>
                                                    <span className="badge bg-danger text-white">
                                                        Already Booked
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            className="btn btn-sm btn-secondary w-100 rounded-pill py-2 fw-semibold"
                                            disabled
                                            style={{ cursor: "not-allowed" }}
                                        >
                                            All Slots Already Booked
                                        </button>
                                    </div>
                                ) : selectedDateStatus.isPartiallyBooked ? (
                                    <div className="bg-warning bg-opacity-10 border border-warning border-opacity-25 rounded-4 p-3 mb-4">
                                        <div className="d-flex align-items-center gap-2 mb-2">
                                            <AlertCircle size={22} className="text-warning flex-shrink-0" />
                                            <h6 className="fw-bold text-dark mb-0">
                                                1 Slot Booked • {selectedDateStatus.availableCount} Slot Available
                                            </h6>
                                        </div>
                                        <p className="text-secondary small mb-3">
                                            One slot is already booked on this date. You can still book the remaining available slot.
                                        </p>

                                        {/* List Bookings and Available Slots */}
                                        <div className="d-flex flex-column gap-2 mb-3">
                                            {selectedDateStatus.bookedSlots.map((slot, sIdx) => (
                                                <div
                                                    key={`b-slot-part-${sIdx}`}
                                                    className="bg-white rounded-3 p-2 border small d-flex justify-content-between align-items-center"
                                                >
                                                    <div>
                                                        <span className="fw-bold text-danger d-block">
                                                            {slot.slot_name || "Match Slot"} ({slot.start_time?.slice(0, 5) || slot.start} - {slot.end_time?.slice(0, 5) || slot.end})
                                                        </span>
                                                        <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                                                            Reserved Slot
                                                        </span>
                                                    </div>
                                                    <span className="badge bg-danger text-white">
                                                        Booked
                                                    </span>
                                                </div>
                                            ))}

                                            {selectedDateStatus.availableSlots.map((slot, sIdx) => (
                                                <div
                                                    key={`a-slot-part-${sIdx}`}
                                                    className="bg-white rounded-3 p-2 border small d-flex justify-content-between align-items-center border-success"
                                                >
                                                    <div>
                                                        <span className="fw-bold text-success d-block">
                                                            {slot.slot_name || "Available Slot"} ({slot.start_time?.slice(0, 5) || slot.start} - {slot.end_time?.slice(0, 5) || slot.end})
                                                        </span>
                                                        <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                                                            Ready for booking
                                                        </span>
                                                    </div>
                                                    <span className="badge bg-success text-white">
                                                        Available
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            className="btn btn-sm btn-warning text-dark w-100 rounded-pill py-2 fw-semibold"
                                            onClick={() => openBookingModal(selectedDate)}
                                        >
                                            <Plus size={16} className="me-1" />
                                            Book Remaining Available Slot
                                        </button>
                                    </div>
                                ) : (
                                    <div className="bg-success bg-opacity-10 border border-success border-opacity-25 rounded-4 p-3 mb-4">
                                        <div className="d-flex align-items-center gap-2 mb-2">
                                            <CheckCircle2 size={22} className="text-success flex-shrink-0" />
                                            <h6 className="fw-bold text-success mb-0">
                                                Ground is Available!
                                            </h6>
                                        </div>
                                        <p className="text-secondary small mb-3">
                                            No confirmed matches or practice bookings are scheduled on this date. All playing slots are open. You can request your preferred morning, day, or evening slot.
                                        </p>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-success w-100 rounded-pill py-2 fw-semibold"
                                            onClick={() => openBookingModal(selectedDate)}
                                        >
                                            <Plus size={16} className="me-1" />
                                            Book Ground on This Date
                                        </button>
                                    </div>
                                )}

                                {/* Popular Standard Time Slots Reference */}
                                <div>
                                    <h6 className="fw-bold text-navy mb-2 small text-uppercase">
                                        Standard Playing Slots Reference:
                                    </h6>
                                    <div className="d-flex flex-column gap-2">
                                        {PRESET_SLOTS.map((slot, sIdx) => {
                                            const SlotIcon = slot.icon;
                                            return (
                                                <div
                                                    key={`preset-${sIdx}`}
                                                    className="d-flex align-items-center justify-content-between p-2 rounded-3 bg-light border small"
                                                >
                                                    <div className="d-flex align-items-center gap-2">
                                                        <SlotIcon size={14} className="text-red" />
                                                        <span className="fw-semibold text-dark">{slot.label}</span>
                                                    </div>
                                                    <span className="badge bg-white text-navy border">
                                                        {slot.time}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Helpdesk Notice */}
                            <div className="pt-3 border-top mt-4 text-center">
                                <span className="small text-muted d-block mb-1">
                                    Need urgent match confirmation or turf pitch inspection?
                                </span>
                                <a
                                    href={`tel:${activeGround.phone?.replace(/[^0-9+]/g, "") || "+918285831503"}`}
                                    className="btn btn-sm btn-outline-danger rounded-pill px-3"
                                >
                                    <Phone size={13} className="me-1" />
                                    Call Ground Manager ({activeGround.contact_person || "Academy Admin"})
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. GROUND FEATURES & AMENITIES BANNER */}
                <div className="row g-4 mb-5">
                    <div className="col-12 col-md-6 col-lg-3">
                        <div className="rules-hero-card">
                            <div className="rules-hero-icon bg-primary bg-opacity-10 text-primary">
                                <Trophy size={24} />
                            </div>
                            <h5 className="fw-bold text-navy mb-1">Championship Turf</h5>
                            <p className="text-secondary small mb-0">
                                International red soil and clay turf wickets prepared by certified curators for pace, bounce, and fair spin.
                            </p>
                        </div>
                    </div>
                    <div className="col-12 col-md-6 col-lg-3">
                        <div className="rules-hero-card">
                            <div className="rules-hero-icon bg-warning bg-opacity-10 text-warning">
                                <Moon size={24} />
                            </div>
                            <h5 className="fw-bold text-navy mb-1">800-Lux Floodlights</h5>
                            <p className="text-secondary small mb-0">
                                Professional shadow-free LED tower lighting for thrilling day-night T20 tournaments and late evening practice.
                            </p>
                        </div>
                    </div>
                    <div className="col-12 col-md-6 col-lg-3">
                        <div className="rules-hero-card">
                            <div className="rules-hero-icon bg-success bg-opacity-10 text-success">
                                <Users size={24} />
                            </div>
                            <h5 className="fw-bold text-navy mb-1">Pavilion &amp; Dugout</h5>
                            <p className="text-secondary small mb-0">
                                Shaded player dugouts, air-conditioned dressing rooms, umpire lounge, and viewing pavilion for spectators.
                            </p>
                        </div>
                    </div>
                    <div className="col-12 col-md-6 col-lg-3">
                        <div className="rules-hero-card">
                            <div className="rules-hero-icon bg-danger bg-opacity-10 text-danger">
                                <ShieldCheck size={24} />
                            </div>
                            <h5 className="fw-bold text-navy mb-1">Safety &amp; Scoreboard</h5>
                            <p className="text-secondary small mb-0">
                                Full boundary netting, emergency first aid station, digital electronic scoreboard, and live streaming facility.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 3. TRACK YOUR BOOKING REQUEST SECTION */}
                <div className="bg-light rounded-4 p-4 p-md-5 mb-5 shadow-sm">
                    <div className="row g-4 align-items-center justify-content-between">
                        <div className="col-12 col-lg-5">
                            <span className="badge bg-red text-white mb-2 px-3 py-1">
                                Check Request Status
                            </span>
                            <h3 className="fw-bold text-navy mb-2">Track Your Ground Booking</h3>
                            <p className="text-secondary small mb-0">
                                Already submitted a booking request? Enter your reference number (e.g. <code>GBR-1729...</code>) or 10-digit mobile number to view live status.
                            </p>
                        </div>

                        <div className="col-12 col-lg-7">
                            <form onSubmit={handleTrackRequest} className="mb-3">
                                <div className="input-group">
                                    <span className="input-group-text bg-white border-end-0">
                                        <Search size={18} className="text-muted" />
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control border-start-0 py-2"
                                        placeholder="Enter Request # (e.g. GBR-...) or Mobile Number"
                                        value={trackerQuery}
                                        onChange={(e) => setTrackerQuery(e.target.value)}
                                    />
                                    <button
                                        type="submit"
                                        className="btn btn-navy px-4 fw-semibold"
                                        disabled={trackingLoading}
                                    >
                                        {trackingLoading ? "Searching..." : "Track Status"}
                                    </button>
                                </div>
                            </form>

                            {/* Tracker Error */}
                            {trackerError && (
                                <div className="alert alert-danger py-2 small mb-0">
                                    <AlertCircle size={14} className="me-1" />
                                    {trackerError}
                                </div>
                            )}

                            {/* Tracker Result Display */}
                            {trackerResult && (
                                <div className="bg-white rounded-3 p-3 border shadow-sm">
                                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2 pb-2 border-bottom">
                                        <div>
                                            <span className="fw-bold text-navy">{trackerResult.request_number}</span>
                                            <span className="text-muted small ms-2">
                                                Date: {trackerResult.booking_date?.slice(0, 10)}
                                            </span>
                                        </div>
                                        <span
                                            className={`badge px-3 py-1 ${
                                                trackerResult.request_status === "Approved"
                                                    ? "bg-success"
                                                    : trackerResult.request_status === "Rejected"
                                                    ? "bg-danger"
                                                    : "bg-warning text-dark"
                                            }`}
                                        >
                                            {trackerResult.request_status}
                                        </span>
                                    </div>
                                    <div className="row g-2 small text-secondary">
                                        <div className="col-6 col-sm-4">
                                            <strong>Name:</strong> {trackerResult.customer_name}
                                        </div>
                                        <div className="col-6 col-sm-4">
                                            <strong>Time:</strong> {trackerResult.start_time?.slice(0, 5)} - {trackerResult.end_time?.slice(0, 5)}
                                        </div>
                                        <div className="col-6 col-sm-4">
                                            <strong>Purpose:</strong> {trackerResult.booking_purpose}
                                        </div>
                                        {trackerResult.admin_remarks && (
                                            <div className="col-12 text-dark mt-1">
                                                <strong>Admin Remarks:</strong> {trackerResult.admin_remarks}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ============================================================= */}
            {/* BOOKING REQUEST MODAL (Matches api/ground-booking-requests)   */}
            {/* ============================================================= */}
            {isModalOpen && (
                <div
                    className="ground-modal-backdrop"
                    onClick={closeBookingModal}
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="ground-modal-dialog"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="ground-modal-header">
                            <div>
                                <h5 className="fw-bold text-navy mb-0">
                                    Ground Booking Request
                                </h5>
                                <span className="text-muted small">
                                    {activeGround.ground_name} • Date: {formData.booking_date}
                                </span>
                            </div>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary rounded-circle p-2"
                                onClick={closeBookingModal}
                                aria-label="Close form"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="ground-modal-body">
                            {formSuccess ? (
                                /* SUCCESS CONFIRMATION VIEW */
                                <div className="text-center py-4">
                                    <div className="rules-hero-icon bg-success text-white mx-auto mb-3">
                                        <Check size={28} />
                                    </div>
                                    <h4 className="fw-bold text-navy mb-2">
                                        Booking Request Submitted!
                                    </h4>
                                    <p className="text-secondary small mb-3">
                                        Thank you, <strong>{formData.customer_name}</strong>. Your ground booking request has been received under reference:
                                    </p>
                                    <div className="bg-light p-3 rounded-3 mb-4 d-inline-block border">
                                        <span className="text-muted small d-block">Reference Number:</span>
                                        <h5 className="fw-bold text-red mb-0">
                                            {formSuccess.data?.request_number || "GBR-PENDING"}
                                        </h5>
                                    </div>
                                    <p className="text-secondary small mb-4">
                                        Status: <span className="badge bg-warning text-dark">Pending Admin Review</span>
                                        <br />
                                        Our ground coordinator will contact you at <strong>{formData.mobile}</strong> within 2 hours to confirm your playing slot and payment terms.
                                    </p>
                                    <button
                                        type="button"
                                        className="btn btn-navy px-4 rounded-pill"
                                        onClick={closeBookingModal}
                                    >
                                        Close Window
                                    </button>
                                </div>
                            ) : (
                                /* BOOKING REQUEST FORM */
                                <form onSubmit={handleSubmitBooking}>
                                    {/* Error Banner */}
                                    {formError && (
                                        <div className="alert alert-danger py-2 small d-flex align-items-center gap-2 mb-3">
                                            <AlertCircle size={16} className="flex-shrink-0" />
                                            <span>{formError}</span>
                                        </div>
                                    )}

                                    {/* Ground & Date Selection (Locked to user's selection) */}
                                    <div className="row g-3 mb-3">
                                        <div className="col-12 col-md-6">
                                            <label className="form-label small fw-bold text-navy mb-1 d-flex align-items-center justify-content-between">
                                                <span>Selected Ground</span>
                                                <span className="badge bg-light text-muted border" style={{ fontSize: "0.68rem" }}>🔒 Locked</span>
                                            </label>
                                            <select
                                                className="form-select form-select-sm bg-light text-dark fw-semibold"
                                                value={formData.ground_id}
                                                disabled
                                                style={{ cursor: "not-allowed" }}
                                            >
                                                {grounds.map((g) => (
                                                    <option key={`opt-g-${g.id}`} value={g.id}>
                                                        {g.ground_name} {g.ground_code ? `(${g.ground_code})` : ""}
                                                    </option>
                                                ))}
                                            </select>
                                            <small className="text-muted" style={{ fontSize: "0.72rem" }}>Based on selected ground above</small>
                                        </div>

                                        <div className="col-12 col-md-6">
                                            <label className="form-label small fw-bold text-navy mb-1 d-flex align-items-center justify-content-between">
                                                <span>Booking Date</span>
                                                <span className="badge bg-light text-muted border" style={{ fontSize: "0.68rem" }}>🔒 Locked</span>
                                            </label>
                                            <input
                                                type="date"
                                                className="form-control form-control-sm bg-light text-dark fw-semibold"
                                                value={formData.booking_date}
                                                disabled
                                                style={{ cursor: "not-allowed" }}
                                            />
                                            <small className="text-muted" style={{ fontSize: "0.72rem" }}>Based on selected calendar date</small>
                                        </div>
                                    </div>

                                    {/* Playing Slots picked from api/ground-slots */}
                                    <div className="mb-3">
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                            <label className="form-label small fw-bold text-navy mb-0 d-flex align-items-center gap-1">
                                                <Clock size={14} className="text-red" />
                                                Available Playing Slots for this Ground:
                                            </label>
                                            {loadingSlots ? (
                                                <span className="text-muted small">
                                                    <span className="spinner-border spinner-border-sm me-1 text-red" />
                                                    Loading slots...
                                                </span>
                                            ) : (
                                                <span className="text-muted small">
                                                    {groundSlots.length > 0
                                                        ? `${groundSlots.length} slots found`
                                                        : "Standard academy slots"}
                                                </span>
                                            )}
                                        </div>

                                        {groundSlots.length > 0 ? (
                                            <div className="row g-2">
                                                {groundSlots.map((slot) => {
                                                    const sStart = slot.start_time?.slice(0, 5);
                                                    const sEnd = slot.end_time?.slice(0, 5);
                                                    const isSelected =
                                                        formData.start_time === sStart &&
                                                        formData.end_time === sEnd;
                                                    const isSlotBooked = checkSlotBooked(slot, formData.booking_date, formData.ground_id);

                                                    return (
                                                        <div className="col-12 col-sm-6" key={`slot-${slot.id}`}>
                                                            <button
                                                                type="button"
                                                                disabled={isSlotBooked}
                                                                className={`ground-slot-btn w-100 text-start ${isSelected ? "active" : ""} ${isSlotBooked ? "disabled is-booked" : ""}`}
                                                                onClick={() => {
                                                                    if (isSlotBooked) return;
                                                                    setSelectedSlotPreset(slot.slot_name);
                                                                    setFormData((prev) => ({
                                                                        ...prev,
                                                                        start_time: sStart,
                                                                        end_time: sEnd,
                                                                    }));
                                                                }}
                                                                style={isSlotBooked ? { cursor: "not-allowed", opacity: 0.6 } : {}}
                                                                title={isSlotBooked ? "This slot is already booked on this date" : `Select ${slot.slot_name}`}
                                                            >
                                                                <div className="d-flex w-100 justify-content-between align-items-center mb-1">
                                                                    <span className="fw-bold text-truncate">{slot.slot_name}</span>
                                                                    {isSlotBooked ? (
                                                                        <span className="badge bg-danger text-white border" style={{ fontSize: "0.68rem" }}>
                                                                            Already Booked
                                                                        </span>
                                                                    ) : slot.price && Number(slot.price) > 0 ? (
                                                                        <span className="badge bg-light text-danger border small">
                                                                            ₹{Number(slot.price).toLocaleString()}
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                                <small className="text-muted d-block">
                                                                    {sStart} - {sEnd} {isSlotBooked && "• Unavailable"}
                                                                </small>
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="row g-2">
                                                {PRESET_SLOTS.map((slot, pIdx) => {
                                                    const isSlotBooked = checkSlotBooked(
                                                        { start_time: slot.start, end_time: slot.end },
                                                        formData.booking_date,
                                                        formData.ground_id
                                                    );
                                                    return (
                                                        <div className="col-6 col-sm-4" key={`pslot-${pIdx}`}>
                                                            <button
                                                                type="button"
                                                                disabled={isSlotBooked}
                                                                className={`ground-slot-btn w-100 text-start ${
                                                                    selectedSlotPreset === slot.label ? "active" : ""
                                                                } ${isSlotBooked ? "disabled is-booked" : ""}`}
                                                                onClick={() => {
                                                                    if (isSlotBooked) return;
                                                                    handleSelectSlotPreset(slot);
                                                                }}
                                                                style={isSlotBooked ? { cursor: "not-allowed", opacity: 0.6 } : {}}
                                                                title={isSlotBooked ? "Already booked" : slot.label}
                                                            >
                                                                <div className="d-flex w-100 justify-content-between align-items-center">
                                                                    <span>{slot.label}</span>
                                                                    {isSlotBooked && (
                                                                        <span className="badge bg-danger text-white" style={{ fontSize: "0.65rem" }}>
                                                                            Already Booked
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <small className="text-muted">{slot.time}</small>
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Custom Timings Adjustment */}
                                    <div className="row g-2 mb-3 align-items-center bg-light rounded-3 p-2 border">
                                        <div className="col-6 col-md-3">
                                            <label className="form-label small fw-bold text-navy mb-1">
                                                Start Time *
                                            </label>
                                            <input
                                                type="time"
                                                className="form-control form-control-sm"
                                                value={formData.start_time}
                                                onChange={(e) => {
                                                    setSelectedSlotPreset("Custom");
                                                    setFormData({ ...formData, start_time: e.target.value });
                                                }}
                                                required
                                            />
                                        </div>
                                        <div className="col-6 col-md-3">
                                            <label className="form-label small fw-bold text-navy mb-1">
                                                End Time *
                                            </label>
                                            <input
                                                type="time"
                                                className="form-control form-control-sm"
                                                value={formData.end_time}
                                                onChange={(e) => {
                                                    setSelectedSlotPreset("Custom");
                                                    setFormData({ ...formData, end_time: e.target.value });
                                                }}
                                                required
                                            />
                                        </div>
                                        <div className="col-12 col-md-6 pt-md-3">
                                            <span className="text-muted small">
                                                <em>Click any slot above or enter custom start &amp; end hours.</em>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Personal Info: Customer Name & Mobile */}
                                    <div className="row g-3 mb-3">
                                        <div className="col-12 col-md-6">
                                            <label className="form-label small fw-bold text-navy mb-1">
                                                Your Full Name *
                                            </label>
                                            <div className="input-group input-group-sm">
                                                <span className="input-group-text bg-white">
                                                    <User size={14} className="text-muted" />
                                                </span>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    placeholder="e.g. Rahul Sharma"
                                                    value={formData.customer_name}
                                                    onChange={(e) =>
                                                        setFormData({ ...formData, customer_name: e.target.value })
                                                    }
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="col-12 col-md-6">
                                            <label className="form-label small fw-bold text-navy mb-1">
                                                Mobile Number *
                                            </label>
                                            <div className="input-group input-group-sm">
                                                <span className="input-group-text bg-white">
                                                    <Phone size={14} className="text-muted" />
                                                </span>
                                                <input
                                                    type="tel"
                                                    className="form-control"
                                                    placeholder="10-digit phone number"
                                                    maxLength={10}
                                                    value={formData.mobile}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            mobile: e.target.value.replace(/[^0-9]/g, ""),
                                                        })
                                                    }
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Email, Purpose & Expected Players */}
                                    <div className="row g-3 mb-3">
                                        <div className="col-12 col-md-4">
                                            <label className="form-label small fw-bold text-navy mb-1">
                                                Email Address (Optional)
                                            </label>
                                            <div className="input-group input-group-sm">
                                                <span className="input-group-text bg-white">
                                                    <Mail size={14} className="text-muted" />
                                                </span>
                                                <input
                                                    type="email"
                                                    className="form-control"
                                                    placeholder="you@example.com"
                                                    value={formData.email}
                                                    onChange={(e) =>
                                                        setFormData({ ...formData, email: e.target.value })
                                                    }
                                                />
                                            </div>
                                        </div>

                                        <div className="col-12 col-md-4">
                                            <label className="form-label small fw-bold text-navy mb-1">
                                                Booking Purpose *
                                            </label>
                                            <select
                                                className="form-select form-select-sm"
                                                value={formData.booking_purpose}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, booking_purpose: e.target.value })
                                                }
                                                required
                                            >
                                                {BOOKING_PURPOSES.map((purpose) => (
                                                    <option key={purpose} value={purpose}>
                                                        {purpose}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="col-12 col-md-4">
                                            <label className="form-label small fw-bold text-navy mb-1">
                                                Expected Players
                                            </label>
                                            <div className="input-group input-group-sm">
                                                <span className="input-group-text bg-white">
                                                    <Users size={14} className="text-muted" />
                                                </span>
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    min={1}
                                                    max={100}
                                                    value={formData.number_of_players}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            number_of_players: e.target.value,
                                                        })
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Special Requirements (Optional) - FULL WIDTH */}
                                    <div className="row g-3 mb-4">
                                        <div className="col-12">
                                            <label className="form-label small fw-bold text-navy mb-1">
                                                Special Requirements (Optional)
                                            </label>
                                            <textarea
                                                className="form-control"
                                                rows={3}
                                                placeholder="e.g. Need floodlights, certified umpires, tournament match balls, pitch watering, commentary box, live stream..."
                                                value={formData.special_requirements}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        special_requirements: e.target.value,
                                                    })
                                                }
                                            />
                                        </div>
                                    </div>

                                    {/* Submit Button */}
                                    <div className="d-flex align-items-center justify-content-end gap-2 pt-3 border-top">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-secondary px-3"
                                            onClick={closeBookingModal}
                                            disabled={submitting}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="btn btn-sm btn-red px-4 py-2 fw-semibold"
                                            disabled={submitting}
                                        >
                                            {submitting ? "Submitting..." : "Submit Booking Request"}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
