"use client";

import { Edit, IndianRupee, Search, SearchSlash, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import Pagination from "../components/Pagination";

const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque"];

const formatDate = (value) => {
    if (!value) return "—";
    const [y, m, d] = String(value).slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
};

const formatAmount = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString("en-IN", { style: "currency", currency: "INR" });
};

export default function GroundPaymentsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [payments, setPayments] = useState([]);

    // Filters (all supported server-side by GET /api/ground-payments)
    const [bookingId, setBookingId] = useState("");
    const [bookingNo, setBookingNo] = useState("");
    const [paymentDate, setPaymentDate] = useState("");
    const [paymentMode, setPaymentMode] = useState("");
    const [transactionNo, setTransactionNo] = useState("");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    // Debounced fetch so we don't hit the API on every keystroke
    useEffect(() => {
        const controller = new AbortController();

        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (bookingId.trim()) params.set("booking_id", bookingId.trim());
                if (bookingNo.trim()) params.set("booking_no", bookingNo.trim());
                if (paymentDate) params.set("payment_date", paymentDate);
                if (paymentMode) params.set("payment_mode", paymentMode);
                if (transactionNo.trim()) params.set("transaction_no", transactionNo.trim());

                const query = params.toString();
                const res = await fetch(`/api/ground-payments${query ? `?${query}` : ""}`, {
                    signal: controller.signal,
                });
                const json = await res.json();

                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Unable to load Ground Payments.");
                }
                setPayments(json.data || []);
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
    }, [bookingId, bookingNo, paymentDate, paymentMode, transactionNo]);

    const handleClear = (e) => {
        e.preventDefault();
        setBookingId("");
        setBookingNo("");
        setPaymentDate("");
        setPaymentMode("");
        setTransactionNo("");
    };

    const handleDelete = async (id, amount) => {
        if (!confirm(`Delete payment #${id} of ${formatAmount(amount)}?`)) return;
        setError(null);
        try {
            const res = await fetch(`/api/ground-payments/${id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to delete ground payment");
            }
            setPayments((current) => current.filter((p) => p.id !== id));
        } catch (err) {
            setError(err.message);
        }
    };

    const total = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalPages = Math.ceil(payments.length / PAGE_SIZE) || 1;
    const pagedPayments = payments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
console.log("payment", payments);
    return (
        <div className="container-fluid">
            <div className="row g-3">
                {/* Header */}
                <div className="col-sm-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center gap-3">
                            <div>
                                <h3 className="mb-0"><IndianRupee /> Ground Payments</h3>
                                <p className="text-muted mb-0">Manage payments received against ground bookings.</p>
                            </div>
                            <Link href="/next_panel/ground-payments/new" className="btn btn-primary px-4">
                                <IndianRupee size={18} /> Add Payment
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="col-sm-12">
                    <div className="d-flex flex-wrap align-items-center gap-3">
                        <div className="input-group" style={{ maxWidth: "200px" }}>
                            <span className="input-group-text bg-white"><Search size={18} /></span>
                            <input
                                type="number"
                                min="1"
                                className="form-control"
                                placeholder="Booking ID"
                                value={bookingId}
                                onChange={(e) => setBookingId(e.target.value)}
                            />
                        </div>

                        <input
                            type="text"
                            className="form-control"
                            placeholder="Booking No."
                            style={{ maxWidth: "200px" }}
                            value={bookingNo}
                            onChange={(e) => setBookingNo(e.target.value)}
                        />

                        <input
                            type="date"
                            className="form-control"
                            style={{ maxWidth: "170px" }}
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                        />

                        <select
                            className="form-select"
                            value={paymentMode}
                            onChange={(e) => setPaymentMode(e.target.value)}
                            style={{ maxWidth: "180px" }}
                        >
                            <option value="">Choose Mode</option>
                            {PAYMENT_MODES.map((m) => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>

                        <input
                            type="text"
                            className="form-control"
                            placeholder="Transaction no."
                            style={{ maxWidth: "220px" }}
                            value={transactionNo}
                            onChange={(e) => setTransactionNo(e.target.value)}
                        />

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
                        <div className="text-center py-5 text-muted">Loading ground payments...</div>
                    ) : payments.length === 0 ? (
                        <div className="text-center py-5 text-muted">No ground payments found.</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table align-middle mb-0">
                                <thead className="table-success">
                                    <tr>
                                        <th>#</th>
                                        <th>Booking</th>
                                        <th>Payment Date</th>
                                        <th className="text-end">Amount</th>
                                        <th>Mode</th>
                                        <th>Transaction No.</th>
                                        <th>Remarks</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedPayments.map((item, idx) => (
                                        <tr key={item.id}>
                                            <th>{(page - 1) * PAGE_SIZE + idx + 1}</th>
                                            <td>#{item.booking_id}-{item.booking_no}</td>
                                            <td>{formatDate(item.payment_date)}</td>
                                            <td className="text-end">{formatAmount(item.amount)}</td>
                                            <td>
                                                <span className="badge text-bg-light border">{item.payment_mode}</span>
                                            </td>
                                            <td>{item.transaction_no || "—"}</td>
                                            <td style={{ maxWidth: "240px" }}>{item.remarks || "—"}</td>
                                            <td>
                                                <div className="d-flex justify-content-start gap-2">
                                                    <Link
                                                        href={`/next_panel/ground-payments/${item.id}/edit`}
                                                        className="btn btn-outline-secondary"
                                                        aria-label="Edit payment"
                                                    >
                                                        <Edit size={16} />
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-danger"
                                                        onClick={() => handleDelete(item.id, item.amount)}
                                                        aria-label="Delete payment"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <th colSpan={3} className="text-end">Total</th>
                                        <th className="text-end">{formatAmount(total)}</th>
                                        <th colSpan={4} />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {!loading && payments.length > 0 && (
                        <div className="mt-3">
                            <Pagination
                                page={page}
                                totalPages={totalPages}
                                total={payments.length}
                                onPageChange={setPage}
                                pageSize={PAGE_SIZE}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
