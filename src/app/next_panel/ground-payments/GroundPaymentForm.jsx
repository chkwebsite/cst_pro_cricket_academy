"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque"];

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM = {
    booking_id: "",
    payment_date: today(),
    amount: "",
    payment_mode: "Cash",
    transaction_no: "",
    remarks: "",
};

export default function GroundPaymentForm({ id = null }) {
    const router = useRouter();
    const isEdit = Boolean(id);

    const [formData, setFormData] = useState(EMPTY_FORM);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState("");
    const [bookings, setBookings] = useState([]);
    const [bookingsLoading, setBookingsLoading] = useState(true);
    const [bookingsError, setBookingsError] = useState("");

    useEffect(() => {
        const controller = new AbortController();

        const loadBookings = async () => {
            try {
                setBookingsLoading(true);
                setBookingsError("");

                const fetchPage = async (page) => {
                    const res = await fetch(`/api/ground-bookings?balance_due=1&limit=100&page=${page}`, {
                        signal: controller.signal,
                    });
                    const result = await res.json();
                    if (!res.ok || !result.success) {
                        throw new Error(result.message || "Unable to load bookings with balance");
                    }
                    return result;
                };

                const firstPage = await fetchPage(1);
                const totalPages = Number(firstPage.pagination?.totalPages) || 1;
                const remainingPages = await Promise.all(
                    Array.from({ length: totalPages - 1 }, (_, index) => fetchPage(index + 2))
                );

                setBookings([
                    ...(firstPage.data || []),
                    ...remainingPages.flatMap((result) => result.data || []),
                ]);
            } catch (err) {
                if (err.name !== "AbortError") setBookingsError(err.message);
            } finally {
                if (!controller.signal.aborted) setBookingsLoading(false);
            }
        };

        loadBookings();
        return () => controller.abort();
    }, []);

    // GET SINGLE GROUND PAYMENT (edit mode)
    useEffect(() => {
        if (!id) return;

        const getPayment = async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/ground-payments/${id}`);
                const result = await res.json();

                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Failed to fetch Ground Payment");
                }

                const d = result.data;
                setFormData({
                    booking_id: d.booking_id ?? "",
                    payment_date: d.payment_date ? String(d.payment_date).slice(0, 10) : "",
                    amount: d.amount ?? "",
                    payment_mode: d.payment_mode || "Cash",
                    transaction_no: d.transaction_no || "",
                    remarks: d.remarks || "",
                });
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        };
        getPayment();
    }, [id]);

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === "booking_id") {
            const selectedBooking = bookings.find((booking) => Number(booking.id) === Number(value));
            return setFormData((prev) => ({
                ...prev,
                booking_id: value,
                amount: selectedBooking ? String(selectedBooking.balance_amount) : "",
            }));
        }

        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const selectedBookingIsListed = bookings.some(
        (booking) => Number(booking.id) === Number(formData.booking_id)
    );

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Mirrors the API's required-field validation
        const bookingId = Number(formData.booking_id);
        if (!Number.isInteger(bookingId) || bookingId <= 0) return setError("Please choose a valid booking");
        if (!formData.payment_date) return setError("Payment date is required");
        if (!(Number(formData.amount) > 0)) return setError("Payment amount must be greater than zero");
        if (!formData.payment_mode) return setError("Payment mode is required");

        try {
            setLoading(true);
            setError("");

            const res = await fetch(isEdit ? `/api/ground-payments/${id}` : `/api/ground-payments`, {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    booking_id: bookingId,
                    payment_date: formData.payment_date,
                    amount: Number(formData.amount),
                    payment_mode: formData.payment_mode,
                    transaction_no: String(formData.transaction_no).trim() || null,
                    remarks: String(formData.remarks).trim() || null,
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || "Something went wrong");
            }

            alert(isEdit ? "Ground payment updated successfully" : "Ground payment added successfully");

            router.push("/next_panel/ground-payments");
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
        <div className="card shadow-sm">
            <div className="card-header">
                <h5 className="mb-0">{isEdit ? "Edit Ground Payment" : "Add Ground Payment"}</h5>
            </div>

            <div className="card-body">
                {error && <div className="alert alert-danger">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Booking ID / Booking No.</label>
                            <select
                                name="booking_id"
                                className="form-select"
                                value={formData.booking_id}
                                onChange={handleChange}
                                required
                                disabled={bookingsLoading || !isEdit && Boolean(bookingsError)}
                            >
                                <option value="">
                                    {bookingsLoading ? "Loading bookings..." : "Choose booking"}
                                </option>
                                {isEdit && formData.booking_id && !selectedBookingIsListed && (
                                    <option value={formData.booking_id}>
                                        Booking #{formData.booking_id} (current payment)
                                    </option>
                                )}
                                {bookings.map((booking) => (
                                    <option key={booking.id} value={booking.id}>
                                        #{booking.id} - {booking.booking_no} - {booking.customer_name} - Balance: ₹{Number(booking.balance_amount).toLocaleString("en-IN")}
                                    </option>
                                ))}
                            </select>
                            {bookingsError && <div className="form-text text-danger">{bookingsError}</div>}
                            {!bookingsLoading && !bookingsError && bookings.length === 0 && (
                                <div className="form-text">No bookings with balance are available.</div>
                            )}
                        </div>

                        <div className="col-md-6 mb-3">
                            <label className="form-label">Payment Date</label>
                            <input
                                type="date"
                                name="payment_date"
                                className="form-control"
                                value={formData.payment_date}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Amount (₹)</label>
                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                name="amount"
                                className="form-control"
                                value={formData.amount}
                                onChange={handleChange}
                                placeholder="Enter amount"
                                required
                            />
                        </div>

                        <div className="col-md-6 mb-3">
                            <label className="form-label">Payment Mode</label>
                            <select
                                name="payment_mode"
                                className="form-select"
                                value={formData.payment_mode}
                                onChange={handleChange}
                            >
                                {PAYMENT_MODES.map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="mb-3">
                        <label className="form-label">Transaction No. (optional)</label>
                        <input
                            type="text"
                            name="transaction_no"
                            className="form-control"
                            value={formData.transaction_no}
                            onChange={handleChange}
                            placeholder="UPI ref, cheque no., card slip no., etc."
                        />
                    </div>

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
                            {loading ? "Saving..." : isEdit ? "Update Payment" : "Add Payment"}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => router.push("/next_panel/ground-payments")}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
