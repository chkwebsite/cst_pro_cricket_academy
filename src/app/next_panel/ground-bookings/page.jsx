"use client";

import { CalendarCheck, Clock, Edit, Eye, Phone, Search, SearchSlash, Trash2, Trees } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useUser } from "../components/UserContext";
import Pagination from "../components/Pagination";
import {
    BOOKING_STATUSES,
    PAYMENT_STATUSES,
    bookingBadge,
    formatDate,
    formatPrice,
    formatTime,
    paymentBadge,
} from "./bookingUtils";

const LIMIT = 20;

function GroundBookingsList() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // If query contains convert-request parameters, redirect directly to the new booking form
    useEffect(() => {
        if (searchParams.get("request_id") || searchParams.get("request_number")) {
            router.replace(`/next_panel/ground-bookings/new?${searchParams.toString()}`);
        }
    }, [searchParams, router]);
    const { user } = useUser();
    const hasSessionUser = Boolean(user);
    const userAcademyId = user?.academy_id;
    const userBranchId = user?.branch_id;
    const userRole = String(user?.user_type || "")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ");
    const isSuperAdmin = ["super admin", "superadmin", "admin"].includes(userRole);
    const isBranchAdmin = userRole === "branch admin";
    const isPlayer = userRole.includes("player") || String(user?.user_type) === "7";
    const [scope, setScope] = useState({ academy_id: "", branch_id: "" });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [bookings, setBookings] = useState([]);
    const [grounds, setGrounds] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [page, setPage] = useState(1);

    // Filters (all supported server-side by GET /api/ground-bookings)
    const [groundId, setGroundId] = useState(searchParams.get("ground_id") || "");
    const [bookingNo, setBookingNo] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [bookingDate, setBookingDate] = useState("");
    const [bookingStatus, setBookingStatus] = useState("");
    const [paymentStatus, setPaymentStatus] = useState("");

    useEffect(() => {
        if (!hasSessionUser) return;

        let isMounted = true;

        const loadGrounds = async () => {
            try {
                const params = new URLSearchParams();
                if (!isSuperAdmin && scope.academy_id) params.set("academy_id", scope.academy_id);
                if (!isSuperAdmin && scope.branch_id) params.set("branch_id", scope.branch_id);

                const query = params.toString();
                const res = await fetch(`/api/ground${query ? `?${query}` : ""}`, {
                    cache: "no-store",
                });
                const json = await res.json();
                if (isMounted && res.ok && json.success) setGrounds(json.data || []);
            } catch {
                if (isMounted) setGrounds([]);
            }
        };

        loadGrounds();

        return () => {
            isMounted = false;
        };
    }, [hasSessionUser, isSuperAdmin, scope.academy_id, scope.branch_id]);

    useEffect(() => {
        if (!hasSessionUser) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setScope({ academy_id: "", branch_id: "" });
            return;
        }

        let isMounted = true;

        const resolveScope = async () => {
            if (isSuperAdmin) {
                if (isMounted) setScope({ academy_id: "", branch_id: "" });
                return;
            }

            const sessionAcademyId = userAcademyId && Number(userAcademyId) !== 0 ? String(userAcademyId) : "";
            const sessionBranchId = userBranchId && Number(userBranchId) !== 0 ? String(userBranchId) : "";

            if (sessionBranchId) {
                try {
                    const res = await fetch(`/api/branch/${sessionBranchId}`, { cache: "no-store" });
                    const json = await res.json();
                    if (isMounted && res.ok && json.success && json.data) {
                        setScope({
                            academy_id: String(json.data.academy_id || sessionAcademyId || ""),
                            branch_id: sessionBranchId,
                        });
                        return;
                    }
                } catch {
                    // fall through to the session values below
                }

                if (isMounted) {
                    setScope({
                        academy_id: sessionAcademyId,
                        branch_id: sessionBranchId,
                    });
                }
                return;
            }

            if (isMounted) {
                setScope({
                    academy_id: sessionAcademyId,
                    branch_id: "",
                });
            }
        };

        resolveScope();

        return () => {
            isMounted = false;
        };
    }, [hasSessionUser, isSuperAdmin, userAcademyId, userBranchId]);

    // Any filter change goes back to page 1
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPage(1);
    }, [groundId, bookingNo, customerName, customerPhone, bookingDate, bookingStatus, paymentStatus]);

    // Debounced fetch
    useEffect(() => {
        if (!hasSessionUser) return;

        const controller = new AbortController();

        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
                if (!isSuperAdmin && scope.academy_id) params.set("academy_id", scope.academy_id);
                if (!isSuperAdmin && scope.branch_id) params.set("branch_id", scope.branch_id);
                if (groundId) params.set("ground_id", groundId);
                if (bookingNo.trim()) params.set("booking_no", bookingNo.trim());
                if (customerName.trim()) params.set("customer_name", customerName.trim());
                if (customerPhone.trim()) params.set("customer_phone", customerPhone.trim());
                if (bookingDate) params.set("booking_date", bookingDate);
                if (bookingStatus) params.set("booking_status", bookingStatus);
                if (paymentStatus) params.set("payment_status", paymentStatus);

                const res = await fetch(`/api/ground-bookings?${params.toString()}`, {
                    signal: controller.signal,
                    cache: "no-store",
                });
                const json = await res.json();

                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Unable to load bookings.");
                }
                setBookings(json.data || []);
                setPagination(json.pagination || { page: 1, totalPages: 1, total: 0 });
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }, 300);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [
        hasSessionUser,
        isSuperAdmin,
        scope.academy_id,
        scope.branch_id,
        page,
        groundId,
        bookingNo,
        customerName,
        customerPhone,
        bookingDate,
        bookingStatus,
        paymentStatus,
    ]);

    const handleClear = (e) => {
        e.preventDefault();
        setGroundId("");
        setBookingNo("");
        setCustomerName("");
        setCustomerPhone("");
        setBookingDate("");
        setBookingStatus("");
        setPaymentStatus("");
    };

    const handleDelete = async (b) => {
        if (!confirm(`Permanently delete booking ${b.booking_no}? This cannot be undone.`)) return;
        setError(null);
        try {
            // API hard-deletes and takes academy_id + branch_id as query params
            const qs = new URLSearchParams({ academy_id: b.academy_id, branch_id: b.branch_id });
            const res = await fetch(`/api/ground-bookings/${b.id}?${qs.toString()}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to delete booking");
            }
            setBookings((current) => current.filter((x) => x.id !== b.id));
            setPagination((p) => ({ ...p, total: Math.max(p.total - 1, 0) }));
        } catch (err) {
            setError(err.message);
        }
    };

    const addHref = `/next_panel/ground-bookings/new${groundId ? `?ground_id=${groundId}` : ""}`;

    return (
        <div className="container-fluid">
            <div className="row g-3">
                {/* Header */}
                <div className="col-sm-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center gap-3">
                            <div>
                                <h3 className="mb-0"><CalendarCheck /> Ground Bookings</h3>
                                <p className="text-muted mb-0">Manage ground reservations, payments, and balances.</p>
                            </div>
                            {!isPlayer && (
                                <div className="d-flex gap-2">
                                    <Link href="/next_panel/ground-slots" className="btn btn-outline-secondary px-3">
                                        <Clock size={18} /> Slots
                                    </Link>
                                    <Link href="/next_panel/grounds" className="btn btn-outline-secondary px-3">
                                        <Trees size={18} /> Grounds
                                    </Link>
                                    <Link href={addHref} className="btn btn-primary px-4">
                                        <CalendarCheck size={18} /> New Booking
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="col-sm-12">
                    <div className="d-flex flex-wrap align-items-center gap-3">
                        <select
                            className="form-select"
                            style={{ maxWidth: "210px" }}
                            value={groundId}
                            onChange={(e) => setGroundId(e.target.value)}
                        >
                            <option value="">All grounds</option>
                            {grounds.map((g) => (
                                <option key={g.id} value={g.id}>{g.ground_name}</option>
                            ))}
                        </select>

                        <div className="input-group" style={{ maxWidth: "220px" }}>
                            <span className="input-group-text bg-white"><Search size={18} /></span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Booking no"
                                value={bookingNo}
                                onChange={(e) => setBookingNo(e.target.value)}
                            />
                        </div>

                        <input
                            type="text"
                            className="form-control"
                            placeholder="Customer name"
                            style={{ maxWidth: "190px" }}
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                        />

                        <input
                            type="text"
                            className="form-control"
                            placeholder="Phone"
                            style={{ maxWidth: "150px" }}
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                        />

                        <input
                            type="date"
                            className="form-control"
                            style={{ maxWidth: "170px" }}
                            value={bookingDate}
                            onChange={(e) => setBookingDate(e.target.value)}
                        />

                        <select
                            className="form-select"
                            style={{ maxWidth: "170px" }}
                            value={bookingStatus}
                            onChange={(e) => setBookingStatus(e.target.value)}
                        >
                            <option value="">Booking Status</option>
                            {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>

                        <select
                            className="form-select"
                            style={{ maxWidth: "170px" }}
                            value={paymentStatus}
                            onChange={(e) => setPaymentStatus(e.target.value)}
                        >
                            <option value="">Payment Status</option>
                            {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>

                        <button
                            type="button"
                            className="btn btn-outline-danger"
                            onClick={handleClear}
                            aria-label="Clear filters"
                        >
                            <SearchSlash />
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="col-sm-12">
                    {error && <div className="alert alert-danger">{error}</div>}

                    {loading ? (
                        <div className="text-center py-5 text-muted">Loading bookings...</div>
                    ) : bookings.length === 0 ? (
                        <div className="text-center py-5 text-muted">No bookings found.</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table align-middle mb-0">
                                <thead className="table-success">
                                    <tr>
                                        <th>#</th>
                                        <th>Booking</th>
                                        <th>Customer</th>
                                        <th>Ground / Slot</th>
                                        <th>Amount</th>
                                        <th>Payment</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bookings.map((item, idx) => {
                                        const closed = item.booking_status === "Completed" || item.booking_status === "Cancelled";
                                        return (
                                        <tr key={item.id}>
                                            <th>{(pagination.page - 1) * LIMIT + idx + 1}</th>
                                            <td>
                                                <div>{item.booking_no}</div>
                                                <small className="text-muted d-block">{formatDate(item.booking_date)}</small>
                                                <small className="text-muted">{item.purpose}</small>
                                            </td>
                                            <td>
                                                <div>{item.customer_name}</div>
                                                {item.customer_phone && (
                                                    <small className="text-muted d-block">
                                                        <Phone size={12} className="me-1" />{item.customer_phone}
                                                    </small>
                                                )}
                                                {item.customer_email && (
                                                    <small className="text-muted d-block">{item.customer_email}</small>
                                                )}
                                            </td>
                                            <td>
                                                <div>{item.ground_name}</div>
                                                <small className="text-muted">
                                                    {item.slot_name} · {formatTime(item.start_time)} – {formatTime(item.end_time)}
                                                </small>
                                            </td>
                                            <td>
                                                <div>{formatPrice(item.total_amount)}</div>
                                                <small className="text-muted d-block">Paid {formatPrice(item.paid_amount)}</small>
                                                {Number(item.balance_amount) > 0 && (
                                                    <small className="text-danger">Due {formatPrice(item.balance_amount)}</small>
                                                )}
                                            </td>
                                            <td>
                                                <span className={`badge ${paymentBadge(item.payment_status)}`}>
                                                    {item.payment_status}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge ${bookingBadge(item.booking_status)}`}>
                                                    {item.booking_status}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="d-flex justify-content-start align-items-center gap-2">
                                                    <Link
                                                        href={`/next_panel/ground-bookings/${item.id}`}
                                                        className="btn btn-outline-primary"
                                                        aria-label="View booking"
                                                        title="View Booking"
                                                    >
                                                        <Eye size={16} />
                                                    </Link>
                                                    {!isPlayer && (
                                                        <>
                                                            {closed ? (
                                                                <button type="button" className="btn btn-outline-secondary" aria-label="Edit booking" disabled>
                                                                    <Edit size={16} />
                                                                </button>
                                                            ) : (
                                                                <Link
                                                                    href={`/next_panel/ground-bookings/${item.id}/edit?academy_id=${item.academy_id}&branch_id=${item.branch_id}`}
                                                                    className="btn btn-outline-secondary"
                                                                    aria-label="Edit booking"
                                                                >
                                                                    <Edit size={16} />
                                                                </Link>
                                                            )}
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-danger"
                                                                onClick={() => handleDelete(item)}
                                                                aria-label="Delete booking"
                                                                disabled={closed}
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )})
                                    }
                                   
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {!loading && pagination.total > 0 && (
                    <div className="col-sm-12">
                        <Pagination
                            page={page}
                            totalPages={pagination.totalPages}
                            total={pagination.total}
                            onPageChange={setPage}
                            pageSize={LIMIT}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

export default function GroundBookingsPage() {
    return (
        <Suspense fallback={<div className="text-center py-5 text-muted">Loading...</div>}>
            <GroundBookingsList />
        </Suspense>
    );
}
