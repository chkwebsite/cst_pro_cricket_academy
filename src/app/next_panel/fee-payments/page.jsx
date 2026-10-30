"use client";

import { Edit, Eye, Receipt, SearchSlash, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "../components/UserContext";
import Pagination from "../components/Pagination";

const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque"];
const PAYMENT_STATUSES = ["Paid", "Refunded", "Cancelled"];

const STATUS_BADGE = {
    Paid: "bg-success",
    Refunded: "bg-warning text-dark",
    Cancelled: "bg-secondary",
};

const money = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDateTime = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const payer = (f) => {
    if (f.first_name || f.last_name) return `${f.first_name || ""} ${f.last_name || ""}`.trim();
    if (f.outside_player_name) return f.outside_player_name;
    if (f.player_name) return f.player_name;
    if (f.outside_player_id) return `Outside player #${f.outside_player_id}`;
    return "—";
};

export default function FeePaymentsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [payments, setPayments] = useState([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    // Filters (all supported server-side by GET /api/fee-payments)
    const [search, setSearch] = useState(""); // client-side only
    const [paymentMode, setPaymentMode] = useState("");
    const [status, setStatus] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    const { user } = useUser();
    const hasSessionUser = Boolean(user);
    const userAcademyId = user?.academy_id;
    const hasAssignedAcademy =
        userAcademyId !== null && userAcademyId !== undefined && userAcademyId !== "" && Number(userAcademyId) !== 0;

    useEffect(() => {
        if (!hasSessionUser) return;

        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (paymentMode) params.set("payment_mode", paymentMode);
                if (status) params.set("status", status);
                if (dateFrom) params.set("date_from", dateFrom);
                if (dateTo) params.set("date_to", dateTo);

                const query = params.toString();
                const res = await fetch(`/api/fee-payments${query ? `?${query}` : ""}`, { signal: controller.signal });
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.message || "Unable to load payments.");
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
    }, [hasSessionUser, paymentMode, status, dateFrom, dateTo]);

    // The API has no academy filter on payments, so academy-bound users only see their own
    const scoped = hasAssignedAcademy
        ? payments.filter((p) => Number(p.academy_id) === Number(userAcademyId))
        : payments;

    // The API has no text search, so this filters the loaded rows
    const needle = search.trim().toLowerCase();
    const visible = needle
        ? scoped.filter((p) =>
              [p.transaction_no, p.fee_type, payer(p), p.remarks, `#${p.fee_status_id}`]
                  .filter(Boolean)
                  .some((v) => String(v).toLowerCase().includes(needle))
          )
        : scoped;

    useEffect(() => {
        setPage(1);
    }, [search, paymentMode, status, dateFrom, dateTo]);

    const totalPages = Math.ceil(visible.length / PAGE_SIZE) || 1;
    const pagedItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // Net received = Paid minus Refunded; cancelled payments are ignored (same as the API)
    const netReceived = visible.reduce((sum, p) => {
        if (p.status === "Paid") return sum + Number(p.amount || 0);
        if (p.status === "Refunded") return sum - Number(p.amount || 0);
        return sum;
    }, 0);

    const handleClear = (e) => {
        e.preventDefault();
        setSearch("");
        setPaymentMode("");
        setStatus("");
        setDateFrom("");
        setDateTo("");
    };

    const handleDelete = async (item) => {
        if (!confirm(`Delete this ₹${money(item.amount)} ${item.status.toLowerCase()} payment? This cannot be undone.`)) return;
        setError(null);
        setNotice(null);
        try {
            const res = await fetch(`/api/fee-payments/${item.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Unable to delete payment");
            setPayments((current) => current.filter((p) => p.id !== item.id));
            setNotice("Payment deleted.");
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="container-fluid">
            <div className="row g-3">
                <div className="col-sm-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center gap-3">
                            <div>
                                <h3 className="mb-0"><Receipt /> Fee Payments</h3>
                                <p className="text-muted mb-0">Record payments and refunds against fee records.</p>
                            </div>
                            <Link href="/next_panel/fee-payments/new" className="btn btn-primary px-4">
                                <Receipt size={18} /> Record Payment
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="col-sm-12">
                    <div className="d-flex flex-wrap align-items-center gap-3">
                        <div className="input-group" style={{ maxWidth: "260px" }}>
                            <span className="input-group-text bg-white"><Search size={18} /></span>
                            <input type="text" className="form-control" placeholder="Txn no, fee type, player, remarks" value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>

                        <select className="form-select" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} style={{ maxWidth: "180px" }}>
                            <option value="">Choose Mode</option>
                            {PAYMENT_MODES.map((m) => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>

                        <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: "180px" }}>
                            <option value="">Choose Status</option>
                            {PAYMENT_STATUSES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>

                        <div className="d-flex align-items-center gap-2">
                            <input type="date" className="form-control" aria-label="Date from" style={{ maxWidth: "165px" }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                            <span className="text-muted">to</span>
                            <input type="date" className="form-control" aria-label="Date to" style={{ maxWidth: "165px" }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                        </div>

                        <button type="button" className="btn btn-outline-danger" onClick={handleClear} aria-label="Clear filters">
                            <SearchSlash />
                        </button>
                    </div>
                </div>

                <div className="col-sm-12">
                    {error && <div className="alert alert-danger">{error}</div>}
                    {notice && <div className="alert alert-success">{notice}</div>}

                    {loading ? (
                        <div className="text-center py-5 text-muted">Loading payments...</div>
                    ) : visible.length === 0 ? (
                        <div className="text-center py-5 text-muted">No payments found.</div>
                    ) : (
                        <>
                        <div className="table-responsive">
                            <table className="table align-middle mb-0">
                                <thead className="table-success">
                                    <tr>
                                        <th>#</th>
                                        <th>Date</th>
                                        <th>Fee</th>
                                        <th>Player</th>
                                        <th>Mode</th>
                                        <th className="text-end">Amount</th>
                                        <th>Status</th>
                                        <th>Recorded By</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedItems.map((item, idx) => (
                                        <tr key={item.id}>
                                            <th>{(page - 1) * PAGE_SIZE + idx + 1}</th>
                                            <td>{formatDateTime(item.payment_date)}</td>
                                            <td>
                                                <Link href={`/next_panel/fee-status/${item.fee_status_id}`} className="text-decoration-none">
                                                    <span className="badge text-bg-light border">{item.fee_type}</span>
                                                </Link>
                                                <small className="text-muted d-block mt-1">
                                                    Fee #{item.fee_status_id} · ₹{money(item.paid_amount)} / ₹{money(item.fee_amount)} ({item.fee_status})
                                                </small>
                                            </td>
                                            <td>{payer(item)}</td>
                                            <td>
                                                <div>{item.payment_mode}</div>
                                                {item.transaction_no && <small className="text-muted">{item.transaction_no}</small>}
                                            </td>
                                            <td className="text-end">
                                                {item.status === "Refunded" ? "−" : ""}₹{money(item.amount)}
                                            </td>
                                            <td>
                                                <span className={`badge ${STATUS_BADGE[item.status] || "bg-secondary"}`}>{item.status}</span>
                                            </td>
                                            <td>{`${item.created_by_first_name || ""} ${item.created_by_last_name || ""}`.trim() || "—"}</td>
                                            <td>
                                                <div className="d-flex justify-content-start gap-2">
                                                    <Link href={`/next_panel/fee-payments/${item.id}`} className="btn btn-outline-primary" aria-label="View payment details">
                                                        <Eye size={16} />
                                                    </Link>
                                                    <Link href={`/next_panel/fee-payments/${item.id}/edit`} className="btn btn-outline-secondary" aria-label="Edit payment">
                                                        <Edit size={16} />
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-danger"
                                                        onClick={() => handleDelete(item)}
                                                        disabled={item.status === "Paid"}
                                                        title={item.status === "Paid" ? "Paid payments can't be deleted. Edit and mark as Refunded or Cancelled." : "Delete payment"}
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
                                    <tr className="fw-semibold">
                                        <td colSpan={5} className="text-end">Net received (paid − refunded)</td>
                                        <td className="text-end">₹{money(netReceived)}</td>
                                        <td colSpan={3}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <Pagination
                            page={page}
                            totalPages={totalPages}
                            total={visible.length}
                            onPageChange={setPage}
                            pageSize={PAGE_SIZE}
                        />
                    </>
                    )}
                </div>
            </div>
        </div>
    );
}
