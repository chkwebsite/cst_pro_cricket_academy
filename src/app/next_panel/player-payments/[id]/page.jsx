"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    Building2,
    Calendar,
    CheckCircle2,
    CreditCard,
    DollarSign,
    Edit,
    FileText,
    Printer,
    Receipt,
    User,
    AlertCircle,
} from "lucide-react";

export default function PaymentReceiptPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id;

    const [payment, setPayment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await fetch(`/api/player-payments/${id}`);
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.message || "Failed to load payment receipt.");
                setPayment(json.data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="container-fluid py-5 text-center">
                <div className="spinner-border text-primary mb-3" role="status" />
                <p className="text-muted">Loading receipt...</p>
            </div>
        );
    }

    if (error || !payment) {
        return (
            <div className="container-fluid py-5">
                <div className="alert alert-danger d-flex align-items-center gap-2">
                    <AlertCircle size={20} />
                    <div>{error || "Payment record not found."}</div>
                </div>
                <Link href="/next_panel/player-payments" className="btn btn-secondary">
                    <ArrowLeft size={16} className="me-1" /> Back to Payments
                </Link>
            </div>
        );
    }

    return (
        <div className="container-fluid py-4">
            {/* Top Bar (Hidden during printing) */}
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4 d-print-none">
                <div className="d-flex align-items-center gap-2">
                    <Link href="/next_panel/player-payments" className="btn btn-outline-secondary">
                        <ArrowLeft size={16} className="me-1" /> Back to Payments
                    </Link>
                    <h4 className="mb-0 fw-bold">Receipt {payment.receipt_no}</h4>
                    <span className="badge bg-success text-white px-3 py-2 ms-2">
                        {payment.payment_status || "Success"}
                    </span>
                </div>

                <div className="d-flex flex-wrap gap-2">
                    <button onClick={handlePrint} className="btn btn-primary d-flex align-items-center gap-1 fw-semibold">
                        <Printer size={16} /> Print Receipt
                    </button>
                    <Link
                        href={`/next_panel/player-program-fees/${payment.player_program_fee_id}`}
                        className="btn btn-outline-info d-flex align-items-center gap-1"
                    >
                        <FileText size={16} /> View Invoice
                    </Link>
                    <Link
                        href={`/next_panel/player-payments/${payment.id}/edit`}
                        className="btn btn-outline-secondary d-flex align-items-center gap-1"
                    >
                        <Edit size={16} /> Edit
                    </Link>
                </div>
            </div>

            {/* Official Printable Receipt Document */}
            <div
                className="card shadow border p-4 p-md-5 mx-auto bg-white"
                style={{ maxWidth: "800px", minHeight: "650px" }}
            >
                {/* Academy Header */}
                <div className="border-bottom pb-4 mb-4 text-center position-relative">
                    <div className="d-flex justify-content-center align-items-center gap-2 text-primary fw-bold fs-3 mb-1">
                        <Building2 size={32} />
                        <span>{payment.academy_name || "CST Cricket Academy"}</span>
                    </div>
                    <div className="text-muted small">
                        {payment.branch_name ? `Branch: ${payment.branch_name}` : "Main Training Campus"} · Official Fee Receipt
                    </div>
                    <div className="badge bg-light text-dark border px-3 py-1 mt-2 text-uppercase letter-spacing-1">
                        Receipt
                    </div>
                </div>

                {/* Receipt Metadata Bar */}
                <div className="row g-3 mb-4 p-3 bg-light rounded-3 border">
                    <div className="col-sm-6">
                        <div className="small text-muted text-uppercase fw-semibold">Receipt Number</div>
                        <div className="fw-bold fs-5 text-dark font-monospace">{payment.receipt_no}</div>
                    </div>
                    <div className="col-sm-6 text-sm-end">
                        <div className="small text-muted text-uppercase fw-semibold">Payment Date</div>
                        <div className="fw-bold fs-5 text-dark">{payment.payment_date?.slice(0, 10)}</div>
                    </div>
                </div>

                {/* Player & Enrollment Details */}
                <div className="row g-3 mb-4">
                    <div className="col-sm-6">
                        <h6 className="fw-bold text-muted small text-uppercase mb-2">Player Details</h6>
                        <div className="fw-bold fs-5 text-dark">{payment.player_name}</div>
                        <div className="text-muted small">Admission No: <strong className="text-dark">{payment.admission_no}</strong></div>
                    </div>

                    <div className="col-sm-6 text-sm-end">
                        <h6 className="fw-bold text-muted small text-uppercase mb-2">Program Details</h6>
                        <div className="fw-bold text-dark">{payment.program_name}</div>
                        <div className="text-muted small">
                            Fee Month: <strong className="text-dark">{payment.fee_month ? payment.fee_month.slice(0, 7) : "—"}</strong>
                        </div>
                    </div>
                </div>

                {/* Payment Breakdown Box */}
                <div className="table-responsive mb-4">
                    <table className="table table-bordered align-middle">
                        <thead className="table-light">
                            <tr>
                                <th>Description</th>
                                <th>Mode & Transaction Details</th>
                                <th className="text-end" style={{ width: "180px" }}>Amount Paid</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    <div className="fw-semibold">Monthly Program Training Fee</div>
                                    <div className="small text-muted">Invoice #{payment.player_program_fee_id}</div>
                                </td>
                                <td>
                                    <div className="fw-semibold">{payment.payment_mode}</div>
                                    {payment.transaction_no && (
                                        <div className="small text-muted font-monospace">Ref: {payment.transaction_no}</div>
                                    )}
                                </td>
                                <td className="text-end fw-bold fs-4 text-success">
                                    ₹{Number(payment.paid_amount).toFixed(2)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Invoice Status Summary */}
                <div className="card bg-light border-0 p-3 mb-4">
                    <div className="row text-center g-2">
                        <div className="col-4 border-end">
                            <div className="small text-muted">Total Invoice</div>
                            <div className="fw-semibold text-dark">₹{Number(payment.invoice_amount || 0).toFixed(2)}</div>
                        </div>
                        <div className="col-4 border-end">
                            <div className="small text-muted">Total Received</div>
                            <div className="fw-semibold text-success">₹{Number(payment.invoice_paid_amount || 0).toFixed(2)}</div>
                        </div>
                        <div className="col-4">
                            <div className="small text-muted">Remaining Balance</div>
                            <div className="fw-bold text-danger">₹{Number(payment.invoice_due_amount || 0).toFixed(2)}</div>
                        </div>
                    </div>
                </div>

                {/* Remarks */}
                {payment.remarks && (
                    <div className="small text-muted mb-4 p-2 bg-light rounded">
                        <strong>Note:</strong> {payment.remarks}
                    </div>
                )}

                {/* Signatures */}
                <div className="mt-auto pt-5">
                    <div className="row text-center">
                        <div className="col-6">
                            <div className="border-top pt-2 mx-auto" style={{ maxWidth: "200px" }}>
                                <div className="small fw-semibold text-dark">Player / Guardian</div>
                                <div className="text-muted extra-small" style={{ fontSize: "11px" }}>Signature</div>
                            </div>
                        </div>
                        <div className="col-6">
                            <div className="border-top pt-2 mx-auto" style={{ maxWidth: "200px" }}>
                                <div className="small fw-semibold text-dark">
                                    {payment.received_by_name?.trim() ? payment.received_by_name : "Authorized Signatory"}
                                </div>
                                <div className="text-muted extra-small" style={{ fontSize: "11px" }}>
                                    Academy Authority
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-center text-muted mt-4 pt-3 border-top" style={{ fontSize: "11px" }}>
                        This is a computer-generated receipt issued by {payment.academy_name || "CST Cricket Academy"}.
                    </div>
                </div>
            </div>
        </div>
    );
}
