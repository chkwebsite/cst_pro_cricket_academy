"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "../components/UserContext";
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    CreditCard,
    DollarSign,
    FileText,
    Receipt,
    User,
} from "lucide-react";
import Link from "next/link";

const PAYMENT_MODES = [
    { value: "Cash", label: "Cash" },
    { value: "UPI", label: "UPI / QR" },
    { value: "Card", label: "Debit / Credit Card" },
    { value: "Bank Transfer", label: "Bank Transfer (NEFT/IMPS)" },
    { value: "Cheque", label: "Cheque" },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function PlayerPaymentForm({ id = null, defaultFeeId = null }) {
    const router = useRouter();
    const isEdit = Boolean(id);
    const { user } = useUser();

    const userAcademyId = user?.academy_id;
    const hasAssignedAcademy =
        userAcademyId !== null && userAcademyId !== undefined && userAcademyId !== "" && Number(userAcademyId) !== 0;

    const [invoices, setInvoices] = useState([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState("");
    const [existingRecord, setExistingRecord] = useState(null);

    // Form fields
    const [feeId, setFeeId] = useState(defaultFeeId ? String(defaultFeeId) : "");
    const [paidAmount, setPaidAmount] = useState("");
    const [paymentMode, setPaymentMode] = useState("Cash");
    const [transactionNo, setTransactionNo] = useState("");
    const [paymentDate, setPaymentDate] = useState(today());
    const [remarks, setRemarks] = useState("");

    // Fetch pending/partial invoices to pay
    useEffect(() => {
        if (isEdit) return;
        let cancelled = false;

        (async () => {
            try {
                setLoadingInvoices(true);
                const params = new URLSearchParams();
                if (hasAssignedAcademy) params.set("academy_id", String(userAcademyId));

                // If defaultFeeId is present, we also fetch that specific invoice even if paid
                const res = await fetch(`/api/player-program-fees?${params.toString()}`);
                const json = await res.json();
                if (!cancelled && res.ok && json.success) {
                    const allFees = json.data || [];
                    // Keep fees that are either pending/partial OR match defaultFeeId
                    const filtered = allFees.filter(
                        (f) =>
                            f.payment_status === "Pending" ||
                            f.payment_status === "Partial" ||
                            String(f.id) === String(defaultFeeId)
                    );
                    setInvoices(filtered);

                    // If defaultFeeId is set and matching, prefill
                    if (defaultFeeId) {
                        const target = filtered.find((f) => String(f.id) === String(defaultFeeId));
                        if (target) {
                            setFeeId(String(target.id));
                            setPaidAmount(String(Number(target.due_amount) > 0 ? target.due_amount : ""));
                        }
                    }
                }
            } catch {
                if (!cancelled) setInvoices([]);
            } finally {
                if (!cancelled) setLoadingInvoices(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isEdit, defaultFeeId, hasAssignedAcademy, userAcademyId]);

    // Load existing payment record in edit mode
    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/player-payments/${id}`);
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.message || "Failed to load payment record.");

                const d = json.data;
                setExistingRecord(d);
                setFeeId(String(d.player_program_fee_id || ""));
                setPaidAmount(String(d.paid_amount || ""));
                setPaymentMode(d.payment_mode || "Cash");
                setTransactionNo(d.transaction_no || "");
                setPaymentDate(d.payment_date ? d.payment_date.slice(0, 10) : today());
                setRemarks(d.remarks || "");
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        })();
    }, [id]);

    // When invoice dropdown changes
    const handleInvoiceChange = (e) => {
        const val = e.target.value;
        setFeeId(val);
        const inv = invoices.find((item) => String(item.id) === String(val));
        if (inv) {
            const due = Number(inv.due_amount) || 0;
            setPaidAmount(due > 0 ? String(due) : "");
        }
    };

    // Find currently selected invoice
    const selectedInvoice = isEdit
        ? existingRecord
        : invoices.find((item) => String(item.id) === String(feeId));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!feeId) {
            return setError("Please select a fee invoice to pay.");
        }

        const amt = Number(paidAmount);
        if (!amt || amt <= 0) {
            return setError("Please enter a valid payment amount greater than zero.");
        }

        if (!isEdit && selectedInvoice) {
            const maxDue = Number(selectedInvoice.due_amount);
            if (amt > maxDue) {
                return setError(`Payment amount (₹${amt}) cannot exceed remaining balance due (₹${maxDue.toFixed(2)}).`);
            }
        }

        try {
            setLoading(true);

            if (isEdit) {
                const payload = {
                    id: Number(id),
                    payment_mode: paymentMode,
                    transaction_no: transactionNo.trim() || null,
                    payment_date: paymentDate,
                    remarks: remarks.trim() || null,
                };

                const res = await fetch(`/api/player-payments/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.message || "Failed to update payment.");

                alert("Payment details updated successfully.");
                router.push(`/next_panel/player-payments/${id}`);
                router.refresh();
            } else {
                const payload = {
                    player_program_fee_id: Number(feeId),
                    paid_amount: amt,
                    payment_mode: paymentMode,
                    transaction_no: transactionNo.trim() || null,
                    payment_date: paymentDate,
                    remarks: remarks.trim() || null,
                    received_by: user?.id || null,
                };

                const res = await fetch("/api/player-payments", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.message || "Failed to process payment.");

                alert("Payment received successfully! Opening receipt...");
                const paymentId = json.data?.id;
                if (paymentId) {
                    router.push(`/next_panel/player-payments/${paymentId}`);
                } else {
                    router.push("/next_panel/player-payments");
                }
                router.refresh();
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="card shadow-sm p-5 text-center">
                <div className="spinner-border text-primary mx-auto mb-3" role="status" />
                <p className="text-muted mb-0">Loading payment details...</p>
            </div>
        );
    }

    return (
        <div className="card shadow-sm border-0">
            <div className="card-header bg-white py-3 d-flex align-items-center justify-content-between">
                <div>
                    <h5 className="mb-0 fw-bold">{isEdit ? "Edit Payment Details" : "Record Player Payment"}</h5>
                    <small className="text-muted">
                        {isEdit
                            ? `Updating receipt ${existingRecord?.receipt_no || `#${id}`}`
                            : "Receive fee installment or full payment from player"}
                    </small>
                </div>
                <Link href="/next_panel/player-payments" className="btn btn-outline-secondary btn-sm">
                    <ArrowLeft size={16} className="me-1" /> Back to Payments
                </Link>
            </div>

            <div className="card-body p-4">
                {error && (
                    <div className="alert alert-danger d-flex align-items-center gap-2 mb-4">
                        <AlertCircle size={20} className="flex-shrink-0" />
                        <div>{error}</div>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="row g-4">
                        {/* Form Inputs */}
                        <div className="col-lg-7">
                            <div className="row g-3">
                                {/* Invoice Selection */}
                                <div className="col-12">
                                    <label className="form-label fw-semibold">
                                        Select Fee Invoice <span className="text-danger">*</span>
                                    </label>
                                    {isEdit ? (
                                        <input
                                            type="text"
                                            className="form-control bg-light"
                                            value={
                                                existingRecord
                                                    ? `Invoice #${existingRecord.player_program_fee_id} — ${existingRecord.player_name} (${existingRecord.admission_no})`
                                                    : `Invoice #${feeId}`
                                            }
                                            readOnly
                                        />
                                    ) : (
                                        <select
                                            className="form-select"
                                            value={feeId}
                                            onChange={handleInvoiceChange}
                                            required
                                        >
                                            <option value="">
                                                {loadingInvoices ? "Loading fee invoices..." : "Choose Fee Invoice to Pay"}
                                            </option>
                                            {invoices.map((inv) => (
                                                <option key={inv.id} value={inv.id}>
                                                    #{inv.id} · {inv.player_name} [{inv.admission_no}] — {inv.program_name} (
                                                    {inv.fee_month_name || inv.fee_month?.slice(0, 7)}) · Due: ₹
                                                    {Number(inv.due_amount).toFixed(2)}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    <div className="form-text">
                                        Only invoices with outstanding dues are listed above.
                                    </div>
                                </div>

                                {/* Paid Amount */}
                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">
                                        Amount Paying (₹) <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="1"
                                        max={!isEdit && selectedInvoice ? Number(selectedInvoice.due_amount) : undefined}
                                        className="form-control fw-bold fs-5 text-success"
                                        value={paidAmount}
                                        onChange={(e) => setPaidAmount(e.target.value)}
                                        disabled={isEdit}
                                        required
                                    />
                                    <div className="form-text">
                                        {selectedInvoice && !isEdit && (
                                            <button
                                                type="button"
                                                className="btn btn-link btn-sm p-0 text-decoration-none"
                                                onClick={() => setPaidAmount(String(selectedInvoice.due_amount))}
                                            >
                                                Pay full due: ₹{Number(selectedInvoice.due_amount).toFixed(2)}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Payment Date */}
                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">
                                        Payment Date <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={paymentDate}
                                        onChange={(e) => setPaymentDate(e.target.value)}
                                        required
                                    />
                                </div>

                                {/* Payment Mode */}
                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">
                                        Payment Mode <span className="text-danger">*</span>
                                    </label>
                                    <select
                                        className="form-select"
                                        value={paymentMode}
                                        onChange={(e) => setPaymentMode(e.target.value)}
                                        required
                                    >
                                        {PAYMENT_MODES.map((mode) => (
                                            <option key={mode.value} value={mode.value}>
                                                {mode.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Reference / Txn No */}
                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">
                                        Transaction / Ref No
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder={
                                            paymentMode === "Cash"
                                                ? "Optional cash voucher / receipt #"
                                                : "UPI Ref / UTR / Cheque No / Card Auth"
                                        }
                                        value={transactionNo}
                                        onChange={(e) => setTransactionNo(e.target.value)}
                                    />
                                </div>

                                {/* Remarks */}
                                <div className="col-12">
                                    <label className="form-label fw-semibold">Remarks / Notes</label>
                                    <textarea
                                        rows="2"
                                        className="form-control"
                                        placeholder="Optional notes or remarks..."
                                        value={remarks}
                                        onChange={(e) => setRemarks(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Invoice Overview Card */}
                        <div className="col-lg-5">
                            <div className="card bg-light border rounded-3 p-3 h-100 d-flex flex-column justify-content-between">
                                <div>
                                    <h6 className="fw-bold mb-3 d-flex align-items-center gap-2 text-primary">
                                        <Receipt size={18} /> Invoice Details
                                    </h6>

                                    {selectedInvoice ? (
                                        <div className="list-group list-group-flush bg-transparent">
                                            <div className="list-group-item bg-transparent px-0 py-2 d-flex justify-content-between">
                                                <span className="text-muted">Player Name:</span>
                                                <span className="fw-semibold text-dark">{selectedInvoice.player_name}</span>
                                            </div>
                                            <div className="list-group-item bg-transparent px-0 py-2 d-flex justify-content-between">
                                                <span className="text-muted">Admission No:</span>
                                                <span className="fw-semibold text-dark">{selectedInvoice.admission_no}</span>
                                            </div>
                                            <div className="list-group-item bg-transparent px-0 py-2 d-flex justify-content-between">
                                                <span className="text-muted">Program:</span>
                                                <span className="fw-semibold text-dark">{selectedInvoice.program_name}</span>
                                            </div>
                                            <div className="list-group-item bg-transparent px-0 py-2 d-flex justify-content-between">
                                                <span className="text-muted">Billing Month:</span>
                                                <span className="fw-semibold text-dark">
                                                    {selectedInvoice.fee_month_name || selectedInvoice.fee_month?.slice(0, 7)}
                                                </span>
                                            </div>
                                            <hr className="my-2" />
                                            <div className="list-group-item bg-transparent px-0 py-2 d-flex justify-content-between">
                                                <span className="text-muted">Total Invoice Amount:</span>
                                                <span className="fw-semibold">₹{Number(selectedInvoice.total_amount || selectedInvoice.invoice_amount || 0).toFixed(2)}</span>
                                            </div>
                                            <div className="list-group-item bg-transparent px-0 py-2 d-flex justify-content-between text-success">
                                                <span>Already Paid:</span>
                                                <span className="fw-semibold">₹{Number(selectedInvoice.paid_amount || selectedInvoice.invoice_paid_amount || 0).toFixed(2)}</span>
                                            </div>
                                            <div className="list-group-item bg-transparent px-0 py-2 d-flex justify-content-between text-danger">
                                                <span className="fw-bold">Outstanding Balance:</span>
                                                <span className="fw-bold fs-6">₹{Number(selectedInvoice.due_amount || selectedInvoice.invoice_due_amount || 0).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-5 text-muted">
                                            <CreditCard size={40} className="mb-2 opacity-50" />
                                            <p className="mb-0 small">Select a fee invoice on the left to see details here.</p>
                                        </div>
                                    )}
                                </div>

                                <div className="alert alert-info border-0 small mb-0 mt-3">
                                    <CheckCircle2 size={16} className="me-1 d-inline" />
                                    A printable official receipt with a unique receipt number will be generated automatically upon recording this payment.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="d-flex gap-2 mt-4 pt-3 border-top">
                        <button
                            type="submit"
                            className="btn btn-success px-4 fw-semibold d-flex align-items-center gap-2"
                            disabled={loading || (!isEdit && !feeId)}
                        >
                            <CreditCard size={18} />
                            {loading ? "Recording..." : isEdit ? "Update Payment" : "Receive & Generate Receipt"}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary px-4"
                            onClick={() => router.push("/next_panel/player-payments")}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
