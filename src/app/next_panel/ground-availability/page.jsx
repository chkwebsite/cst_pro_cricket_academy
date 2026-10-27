"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarCheck, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useUser } from "../components/UserContext";

// Bookings that take a slot out of circulation. Cancelled ones free it up,
// which matches the API's own overlap check. Completed bookings (past days)
// are still shown as taken so history reads correctly.
const TAKEN_STATUSES = ["Booked", "Confirmed", "Completed"];

const STATUS_STYLE = {
    Booked: { bg: "#dbeafe", border: "#93c5fd", text: "#1e3a8a" },
    Confirmed: { bg: "#fee2e2", border: "#fca5a5", text: "#7f1d1d" },
    Completed: { bg: "#e5e7eb", border: "#d1d5db", text: "#374151" },
};
const FREE_STYLE = { bg: "#dcfce7", border: "#86efac", text: "#14532d" };

const pad = (n) => String(n).padStart(2, "0");
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (key) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
};
const addDays = (d, n) => {
    const next = new Date(d);
    next.setDate(next.getDate() + n);
    return next;
};
// Weeks run Monday to Sunday.
const startOfWeek = (d) => addDays(d, -((d.getDay() + 6) % 7));
const hhmm = (t) => (t ? t.slice(0, 5) : "");

export default function GroundAvailabilityPage() {
    const { user } = useUser();
    const session = typeof window !== "undefined"
        ? JSON.parse(sessionStorage.getItem("auth_session") || "null")
        : null;
    const permissions = Array.isArray(session?.permissions) ? session.permissions : [];
    const canCreate = permissions.some((permission) => {
        const name = typeof permission === "string" ? permission : permission?.permission_name || permission?.name || "";
        return name === "ground-bookings.create" || name === "ground_bookings.create" || name === "ground-bookings.create";
    }) || !!user?.permissions?.includes("ground-bookings.create");

    const userRole = String(user?.user_type || "")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ");
    const isSuperAdmin = ["super admin", "superadmin", "admin"].includes(userRole);
    const isBranchAdmin = userRole === "branch admin";
    const userAcademyId = user?.academy_id;
    const userBranchId = user?.branch_id;
    const [scope, setScope] = useState({ academy_id: "", branch_id: "" });

    const todayKey = useMemo(() => toKey(new Date()), []);

    const [grounds, setGrounds] = useState([]);
    const [groundId, setGroundId] = useState("");
    const [selectedKey, setSelectedKey] = useState(todayKey);

    const [slots, setSlots] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [loadingBookings, setLoadingBookings] = useState(false);
    const [error, setError] = useState(null);

    const weekStart = useMemo(() => startOfWeek(fromKey(selectedKey)), [selectedKey]);
    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
    const weekFrom = toKey(weekDays[0]);
    const weekTo = toKey(weekDays[6]);

    useEffect(() => {
        if (!user) return;

        let cancelled = false;

        const resolveScope = async () => {
            if (isSuperAdmin) {
                if (!cancelled) setScope({ academy_id: "", branch_id: "" });
                return;
            }

            const sessionAcademyId = userAcademyId && Number(userAcademyId) !== 0 ? String(userAcademyId) : "";
            const sessionBranchId = userBranchId && Number(userBranchId) !== 0 ? String(userBranchId) : "";

            if (sessionBranchId) {
                try {
                    const res = await fetch(`/api/branch/${sessionBranchId}`, { cache: "no-store" });
                    const json = await res.json();
                    if (!cancelled && res.ok && json.success && json.data) {
                        setScope({
                            academy_id: String(json.data.academy_id || sessionAcademyId || ""),
                            branch_id: sessionBranchId,
                        });
                        return;
                    }
                } catch {
                    // fall through to user session values below
                }
            }

            if (!cancelled) {
                setScope({
                    academy_id: sessionAcademyId,
                    branch_id: sessionBranchId,
                });
            }
        };

        resolveScope();

        return () => { cancelled = true; };
    }, [user, isSuperAdmin, userAcademyId, userBranchId]);

    // Grounds
    useEffect(() => {
        if (!user) return;

        let cancelled = false;
        (async () => {
            try {
                const params = new URLSearchParams({ status: "1" });
                if (!isSuperAdmin) {
                    if (scope.branch_id) {
                        params.set("branch_id", scope.branch_id);
                    } else if (scope.academy_id) {
                        params.set("academy_id", scope.academy_id);
                    }
                }

                const res = await fetch(`/api/ground?${params.toString()}`, { cache: "no-store" });
                const json = await res.json().catch(() => ({}));
                if (cancelled) return;
                if (!res.ok || !json.success) throw new Error(json.message || "Unable to load grounds.");
                const list = json.data || [];
                setGrounds(list);
                if (list.length) {
                    setGroundId((cur) => {
                        if (cur && list.some((g) => String(g.id) === String(cur))) {
                            return cur;
                        }
                        return String(list[0].id);
                    });
                } else {
                    setGroundId("");
                }
            } catch (err) {
                if (!cancelled) setError(err.message || "Unable to load grounds.");
            }
        })();
        return () => { cancelled = true; };
    }, [user, isSuperAdmin, scope.academy_id, scope.branch_id]);

    // Slots - a ground's slot list does not depend on the date.
    useEffect(() => {
        if (!groundId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSlots([]);
            return;
        }
        let cancelled = false;
        (async () => {
            setLoadingSlots(true);
            try {
                const res = await fetch(`/api/ground-slots?ground_id=${groundId}&status=1`);
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.message || "Unable to load slots.");
                if (!cancelled) {
                    const sorted = (json.data || []).filter((slot) => Number(slot.ground_id) === Number(groundId)).sort((a, b) =>
                        (a.start_time || "").localeCompare(b.start_time || "")
                    );
                    setSlots(sorted);
                }
            } catch (err) {
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoadingSlots(false);
            }
        })();
        return () => { cancelled = true; };
    }, [groundId]);

    // Bookings for the visible week only.
    useEffect(() => {
        if (!groundId || !user) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setBookings([]);
            return;
        }
        let cancelled = false;
        (async () => {
            setLoadingBookings(true);
            setError(null);
            try {
                const params = new URLSearchParams({
                    ground_id: groundId,
                    limit: "500",
                });
                if (!isSuperAdmin) {
                    if (scope.branch_id) {
                        params.set("branch_id", scope.branch_id);
                    } else if (scope.academy_id) {
                        params.set("academy_id", scope.academy_id);
                    }
                }
                const res = await fetch(`/api/ground-bookings?${params.toString()}`, { cache: "no-store" });
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.message || "Unable to load bookings.");
                if (!cancelled) {
                    const filtered = (json.data || []).filter((b) => {
                        const date = b.booking_date?.slice(0, 10);
                        return date && date >= weekFrom && date <= weekTo;
                    });
                    setBookings(filtered);
                }
            } catch (err) {
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoadingBookings(false);
            }
        })();
        return () => { cancelled = true; };
    }, [groundId, user, isSuperAdmin, scope.academy_id, scope.branch_id, weekFrom, weekTo]);

    // "date|slotId" -> the booking that holds that slot.
    const takenMap = useMemo(() => {
        const map = {};
        bookings.forEach((b) => {
            const date = b.booking_date?.slice(0, 10);
            if (!date || !TAKEN_STATUSES.includes(b.booking_status)) return;
            map[`${date}|${b.slot_id}`] = b;
        });
        return map;
    }, [bookings]);

    const takenFor = (dateKey, slot) => takenMap[`${dateKey}|${slot.id}`] || null;

    const dayFreeCount = (dateKey) => slots.filter((s) => !takenFor(dateKey, s)).length;

    const weekFree = weekDays.reduce((sum, d) => sum + dayFreeCount(toKey(d)), 0);
    const weekTotal = slots.length * 7;

    const shiftWeek = (n) => setSelectedKey(toKey(addDays(fromKey(selectedKey), n * 7)));

    const bookHref = (slot, dateKey) =>
        `/next_panel/ground-bookings/new?ground_id=${groundId}&slot_id=${slot.id}&booking_date=${dateKey}`;

    const selectedDate = fromKey(selectedKey);
    const selectedIsPast = selectedKey < todayKey;
    const rangeLabel = `${weekDays[0].toLocaleDateString(undefined, { day: "numeric", month: "short" })} - ${weekDays[6].toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;

    const renderCell = (dateKey, slot) => {
        const booking = takenFor(dateKey, slot);
        const isPast = dateKey < todayKey;

        if (booking) {
            const s = STATUS_STYLE[booking.booking_status] || STATUS_STYLE.Completed;
            return (
                <Link
                    href={`/next_panel/ground-bookings/${booking.id}`}
                    className="d-block rounded-2 px-2 py-1 text-decoration-none small text-truncate"
                    style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}
                    title={`${booking.customer_name || "Booking"} (${booking.booking_status})`}
                >
                    <span className="fw-semibold">Booked</span>
                    {booking.customer_name ? ` - ${booking.customer_name}` : ""}
                </Link>
            );
        }

        if (isPast) {
            return <span className="d-block text-center text-muted small">-</span>;
        }

        if (canCreate) {
            return (
                <Link
                    href={bookHref(slot, dateKey)}
                    className="d-flex align-items-center justify-content-center gap-1 rounded-2 px-2 py-1 text-decoration-none small fw-semibold"
                    style={{ background: FREE_STYLE.bg, border: `1px solid ${FREE_STYLE.border}`, color: FREE_STYLE.text }}
                    title="Book this slot"
                >
                    <Plus size={12} /> Available
                </Link>
            );
        }

        return (
            <span
                className="d-block text-center rounded-2 px-2 py-1 small fw-semibold"
                style={{ background: FREE_STYLE.bg, border: `1px solid ${FREE_STYLE.border}`, color: FREE_STYLE.text }}
            >
                Available
            </span>
        );
    };

    return (
        <div className="container-fluid">
            <div className="row g-4">
                {/* Header */}
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <Link href="/next_panel/ground-bookings" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to bookings
                        </Link>
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <CalendarCheck size={24} />
                            <h1 className="h4 mb-0">Ground availability</h1>
                        </div>
                        <p className="text-muted mb-0">See which slots are free this week and book one in a click.</p>
                    </div>
                </div>

                {/* Controls */}
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-3">
                        <div className="row g-3 align-items-end">
                            <div className="col-12 col-md-4">
                                <label htmlFor="ga-ground" className="form-label small text-muted mb-1">Ground</label>
                                <select
                                    id="ga-ground"
                                    className="form-select"
                                    value={groundId}
                                    onChange={(e) => setGroundId(e.target.value)}
                                >
                                    <option value="">Select ground</option>
                                    {grounds.map((g) => (
                                        <option key={g.id} value={g.id}>{g.ground_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-6 col-md-3">
                                <label htmlFor="ga-date" className="form-label small text-muted mb-1">Jump to date</label>
                                <input
                                    id="ga-date"
                                    type="date"
                                    className="form-control"
                                    value={selectedKey}
                                    onChange={(e) => e.target.value && setSelectedKey(e.target.value)}
                                />
                            </div>

                            <div className="col-6 col-md-5">
                                <div className="d-flex align-items-center justify-content-md-end gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        onClick={() => shiftWeek(-1)}
                                        aria-label="Previous week"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-outline-primary"
                                        onClick={() => setSelectedKey(todayKey)}
                                    >
                                        This week
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        onClick={() => shiftWeek(1)}
                                        aria-label="Next week"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="col-12">
                        <div className="alert alert-danger mb-0" role="alert">{error}</div>
                    </div>
                )}

                {!groundId ? (
                    <div className="col-12">
                        <div className="bg-white rounded-4 shadow-sm p-5 text-center text-muted">
                            Select a ground to see its availability.
                        </div>
                    </div>
                ) : loadingSlots ? (
                    <div className="col-12">
                        <div className="bg-white rounded-4 shadow-sm p-5 text-center text-muted">Loading slots...</div>
                    </div>
                ) : slots.length === 0 ? (
                    <div className="col-12">
                        <div className="bg-white rounded-4 shadow-sm p-5 text-center text-muted">
                            This ground has no active slots yet.{" "}
                            <Link href="/next_panel/ground-slots">Add a slot</Link> to start taking bookings.
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Week grid */}
                        <div className="col-12">
                            <div className="bg-white rounded-4 shadow-sm p-3">
                                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                                    <div>
                                        <h2 className="h6 mb-0">{rangeLabel}</h2>
                                        <div className="small text-muted">
                                            {weekFree} of {weekTotal} slots free this week
                                            {loadingBookings && " - refreshing..."}
                                        </div>
                                    </div>
                                    <div className="d-flex flex-wrap align-items-center gap-3 small text-muted">
                                        <span className="d-flex align-items-center gap-1">
                                            <span className="d-inline-block rounded-1" style={{ width: 12, height: 12, background: FREE_STYLE.bg, border: `1px solid ${FREE_STYLE.border}` }} />
                                            Free
                                        </span>
                                        {Object.entries(STATUS_STYLE).map(([name, s]) => (
                                            <span key={name} className="d-flex align-items-center gap-1">
                                                <span className="d-inline-block rounded-1" style={{ width: 12, height: 12, background: s.bg, border: `1px solid ${s.border}` }} />
                                                {name}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="table-responsive">
                                    <table className="table align-middle mb-0" style={{ minWidth: 760, tableLayout: "fixed" }}>
                                        <thead>
                                            <tr>
                                                <th style={{ width: 150 }} className="small text-muted fw-semibold">Slot</th>
                                                {weekDays.map((d) => {
                                                    const key = toKey(d);
                                                    const isSelected = key === selectedKey;
                                                    const isToday = key === todayKey;
                                                    return (
                                                        <th key={key} className="text-center p-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedKey(key)}
                                                                className={`btn btn-sm w-100 ${isSelected ? "btn-primary" : isToday ? "btn-outline-primary" : "btn-light"}`}
                                                                aria-pressed={isSelected}
                                                            >
                                                                <div className="fw-semibold">
                                                                    {d.toLocaleDateString(undefined, { weekday: "short" })} {d.getDate()}
                                                                </div>
                                                                <div style={{ fontSize: 11, opacity: 0.85 }}>
                                                                    {dayFreeCount(key)} free
                                                                </div>
                                                            </button>
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {slots.map((slot) => (
                                                <tr key={slot.id}>
                                                    <td>
                                                        <div className="fw-semibold small">{slot.slot_name || "Slot"}</div>
                                                        <div className="text-muted small">
                                                            {hhmm(slot.start_time)} - {hhmm(slot.end_time)}
                                                        </div>
                                                        {slot.price ? (
                                                            <div className="text-muted small">₹{Number(slot.price).toFixed(2)}</div>
                                                        ) : null}
                                                    </td>
                                                    {weekDays.map((d) => {
                                                        const key = toKey(d);
                                                        return (
                                                            <td
                                                                key={key}
                                                                className="p-1"
                                                                style={key === selectedKey ? { background: "rgba(13,110,253,0.05)" } : undefined}
                                                            >
                                                                {renderCell(key, slot)}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Selected day */}
                        <div className="col-12">
                            <div className="bg-white rounded-4 shadow-sm p-3">
                                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                                    <h2 className="h6 mb-0">
                                        {selectedDate.toLocaleDateString(undefined, {
                                            weekday: "long",
                                            day: "numeric",
                                            month: "long",
                                            year: "numeric",
                                        })}
                                    </h2>
                                    <div className="d-flex align-items-center gap-2">
                                        {selectedIsPast && <span className="badge bg-secondary">Past date</span>}
                                        <span className="small text-muted">
                                            {dayFreeCount(selectedKey)} of {slots.length} free
                                        </span>
                                    </div>
                                </div>

                                <div className="list-group list-group-flush">
                                    {slots.map((slot) => {
                                        const booking = takenFor(selectedKey, slot);
                                        return (
                                            <div
                                                key={slot.id}
                                                className="list-group-item px-0 d-flex flex-wrap justify-content-between align-items-center gap-2"
                                            >
                                                <div>
                                                    <div className="fw-semibold">
                                                        {slot.slot_name || "Slot"}{" "}
                                                        <span className="text-muted fw-normal">
                                                            {hhmm(slot.start_time)} - {hhmm(slot.end_time)}
                                                        </span>
                                                    </div>
                                                    <div className="small text-muted">
                                                        {booking
                                                            ? `${booking.customer_name || "Customer"} - ${booking.booking_status}`
                                                            : slot.price
                                                                ? `₹${Number(slot.price).toFixed(2)}`
                                                                : "No price set"}
                                                    </div>
                                                </div>

                                                {booking ? (
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className="badge bg-danger">Booked</span>
                                                        <Link
                                                            href={`/next_panel/ground-bookings/${booking.id}`}
                                                            className="btn btn-sm btn-outline-secondary"
                                                        >
                                                            View booking
                                                        </Link>
                                                    </div>
                                                ) : selectedIsPast ? (
                                                    <span className="small text-muted">Not booked</span>
                                                ) : canCreate ? (
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className="badge bg-success">Available</span>
                                                        <Link href={bookHref(slot, selectedKey)} className="btn btn-sm btn-primary">
                                                            <Plus size={14} className="me-1" /> Book slot
                                                        </Link>
                                                    </div>
                                                ) : (
                                                    <span className="badge bg-success">Available</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
