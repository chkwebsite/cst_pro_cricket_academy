"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    CheckCircle2,
    Clock,
    DollarSign,
    Edit,
    FileText,
    Printer,
    Receipt,
    User,
    Calendar,
    AlertCircle,
    Building2,
    CreditCard,
} from "lucide-react";

const STATUS_BADGE = {
    Paid: "bg-success text-white",
    Partial: "bg-warning text-dark",
    Pending: "bg-secondary text-white",
    Cancelled: "bg-danger text-white",
};

export default function PlayerProgramFeeDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id;

    const [fee, setFee] = useState(null);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadData = async () => {
        if (!id) return;
        try {
            setLoading(true);
            setError(null);

            // Fetch Fee record
            const feeRes = await fetch(`/api/player-program-fees/${id}`);
            const feeJson = await feeRes.json();
            if (!feeRes.ok || !feeJson.success) {
                throw new Error(feeJson.message || "Failed to load fee invoice.");
            }
            setFee(feeJson.data);

            // Fetch Payments made for this invoice
            const payRes = await fetch(`/api/player-payments?player_program_fee_id=${id}`);
            const payJson = await payRes.json();
            if (payRes.ok && payJson.success) {
                setPayments(payJson.data || []);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="container-fluid py-5 text-center">
                <div className="spinner-border text-primary mb-3" role="status" />
                <p className="text-muted">Loading invoice details...</p>
            </div>
        );
    }

    if (error || !fee) {
        return (
            <div className="container-fluid py-5">
                <div className="alert alert-danger d-flex align-items-center gap-2">
                    <AlertCircle size={20} />
                    <div>{error || "Fee record not found."}</div>
                </div>
                <Link href="/next_panel/player-program-fees" className="btn btn-secondary">
                    <ArrowLeft size={16} className="me-1" /> Back to Fees
                </Link>
            </div>
        );
    }

    const dueAmount = Number(fee.due_amount) || 0;
    const canPay = dueAmount > 0 && fee.payment_status !== "Cancelled";

    return (
        <div className="container-fluid py-4">
            {/* Action Bar (Hidden on print) */}
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4 d-print-none">
                <div className="d-flex align-items-center gap-2">
                    <Link href="/next_panel/player-program-fees" className="btn btn-outline-secondary">
                        <ArrowLeft size={16} className="me-1" /> Back
                    </Link>
                    <h4 className="mb-0 fw-bold">Invoice #{fee.id}</h4>
                    <span className={`badge ${STATUS_BADGE[fee.payment_status] || "bg-secondary"} px-3 py-2 ms-2`}>
                        {fee.payment_status}
                    </span>
                </div>

                <div className="d-flex flex-wrap gap-2">
                    {canPay && (
                        <Link
                            href={`/next_panel/player-payments/new?player_program_fee_id=${fee.id}`}
                            className="btn btn-success d-flex align-items-center gap-1 fw-semibold"
                        >
                            <CreditCard size={16} /> Receive Payment
                        </Link>
                    )}
                    <button onClick={handlePrint} className="btn btn-outline-dark d-flex align-items-center gap-1">
                        <Printer size={16} /> Print Invoice
                    </button>
                    <Link
                        href={`/next_panel/player-program-fees/${fee.id}/edit`}
                        className="btn btn-primary d-flex align-items-center gap-1"
                    >
                        <Edit size={16} /> Edit Invoice
                    </Link>
                </div>
            </div>

            {/* Printable Invoice Card */}
            <div className="card shadow-sm border-0 mb-4 p-4 p-md-5 bg-white">
                {/* Header */}
                <div className="d-flex flex-wrap justify-content-between align-items-start border-bottom pb-4 mb-4 gap-3">
                    <div>
                        <div className="d-flex align-items-center gap-2 text-primary fw-bold fs-4 mb-1">
                            <Building2 size={28} />
                            <span>{fee.academy_name || "CST Cricket Academy"}</span>
                        </div>
                        <div className="text-muted small">
                            {fee.branch_name ? `Branch: ${fee.branch_name}` : "Main Training Ground"}
                        </div>
                    </div>
                    <div className="text-md-end">
                        <h4 className="fw-bold mb-1 text-uppercase text-secondary">Fee Invoice</h4>
                        <div className="fw-semibold text-dark">Invoice ID: #{fee.id}</div>
                        <div className="text-muted small">
                            Billing Month: <strong>{fee.fee_month_name || fee.fee_month?.slice(0, 7)}</strong>
                        </div>
                        {fee.due_date && (
                            <div className="text-danger small">
                                Due Date: <strong>{fee.due_date?.slice(0, 10)}</strong>
                            </div>
                        )}
                    </div>
                </div>

                {/* Player Information & Status */}
                <div className="row g-4 mb-4">
                    <div className="col-md-6">
                        <div className="p-3 bg-light rounded-3 h-100 border">
                            <h6 className="fw-bold text-muted text-uppercase small mb-2 d-flex align-items-center gap-1">
                                <User size={16} /> Billed To (Player)
                            </h6>
                            <h5 className="fw-bold text-dark mb-1">{fee.player_name}</h5>
                            <div className="text-muted small">Admission No: <span className="fw-semibold text-dark">{fee.admission_no}</span></div>
                            <div className="text-muted small">Program: <span className="fw-semibold text-dark">{fee.program_name}</span></div>
                            {fee.start_date && (
                                <div className="text-muted small">
                                    Enrolled: {fee.start_date?.slice(0, 10)} {fee.end_date ? `to ${fee.end_date?.slice(0, 10)}` : ""}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="col-md-6">
                        <div className="p-3 bg-light rounded-3 h-100 border d-flex flex-column justify-content-between">
                            <div>
                                <h6 className="fw-bold text-muted text-uppercase small mb-2 d-flex align-items-center gap-1">
                                    <Receipt size={16} /> Payment Status
                                </h6>
                                <div className="d-flex align-items-center gap-2 mb-2">
                                    <span className={`badge ${STATUS_BADGE[fee.payment_status] || "bg-secondary"} fs-6 px-3 py-2`}>
                                        {fee.payment_status}
                                    </span>
                                </div>
                            </div>
                            <div className="small text-muted">
                                Generated on: {new Date(fee.created_at).toLocaleDateString()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Breakdown Table */}
                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                    <FileText size={18} /> Fee Breakdown
                </h6>
                <div className="table-responsive mb-4">
                    <table className="table table-bordered align-middle">
                        <thead className="table-light">
                            <tr>
                                <th>Item Description</th>
                                <th className="text-end" style={{ width: "220px" }}>Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Monthly Program Fee ({fee.program_name})</td>
                                <td className="text-end fw-semibold">₹{Number(fee.fee_amount || 0).toFixed(2)}</td>
                            </tr>
                            {Number(fee.registration_fee) > 0 && (
                                <tr>
                                    <td>Registration Fee</td>
                                    <td className="text-end">₹{Number(fee.registration_fee).toFixed(2)}</td>
                                </tr>
                            )}
                            {Number(fee.daily_fee) > 0 && (
                                <tr>
                                    <td>Daily Session Fee</td>
                                    <td className="text-end">₹{Number(fee.daily_fee).toFixed(2)}</td>
                                </tr>
                            )}
                            {Number(fee.kit_fee) > 0 && (
                                <tr>
                                    <td>Player Kit / Equipment Fee</td>
                                    <td className="text-end">₹{Number(fee.kit_fee).toFixed(2)}</td>
                                </tr>
                            )}
                            {Number(fee.discount_amount) > 0 && (
                                <tr className="text-success">
                                    <td>Concession / Discount</td>
                                    <td className="text-end">- ₹{Number(fee.discount_amount).toFixed(2)}</td>
                                </tr>
                            )}
                            {Number(fee.late_fee) > 0 && (
                                <tr className="text-danger">
                                    <td>Late Payment Surcharge</td>
                                    <td className="text-end">+ ₹{Number(fee.late_fee).toFixed(2)}</td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="table-light">
                            <tr>
                                <th className="text-end">Total Invoice Amount:</th>
                                <th className="text-end fs-5 text-primary">₹{Number(fee.total_amount || 0).toFixed(2)}</th>
                            </tr>
                            <tr>
                                <th className="text-end text-success">Total Amount Paid:</th>
                                <th className="text-end fs-5 text-success">₹{Number(fee.paid_amount || 0).toFixed(2)}</th>
                            </tr>
                            <tr>
                                <th className="text-end text-danger">Remaining Balance Due:</th>
                                <th className="text-end fs-5 text-danger">₹{Number(fee.due_amount || 0).toFixed(2)}</th>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {fee.remarks && (
                    <div className="p-3 bg-light rounded-3 mb-4 border">
                        <strong className="text-dark">Remarks:</strong> {fee.remarks}
                    </div>
                )}

                {/* Payments History on this invoice */}
                <div className="mt-4">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
                            <Receipt size={18} className="text-success" /> Payment Receipts ({payments.length})
                        </h6>
                        {canPay && (
                            <Link
                                href={`/next_panel/player-payments/new?player_program_fee_id=${fee.id}`}
                                className="btn btn-sm btn-outline-success d-print-none"
                            >
                                + Record Payment
                            </Link>
                        )}
                    </div>

                    {payments.length === 0 ? (
                        <div className="alert alert-light border text-muted small mb-0">
                            No payments have been recorded for this invoice yet.
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover table-sm align-middle border mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>Receipt No</th>
                                        <th>Date</th>
                                        <th>Mode</th>
                                        <th>Txn / Ref No</th>
                                        <th>Received By</th>
                                        <th className="text-end">Paid Amount</th>
                                        <th className="text-center d-print-none" style={{ width: "120px" }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((p) => (
                                        <tr key={p.id}>
                                            <td className="fw-semibold">
                                                <Link href={`/next_panel/player-payments/${p.id}`} className="text-decoration-none">
                                                    {p.receipt_no}
                                                </Link>
                                            </td>
                                            <td>{p.payment_date?.slice(0, 10)}</td>
                                            <td><span className="badge bg-light text-dark border">{p.payment_mode}</span></td>
                                            <td className="text-muted small">{p.transaction_no || "—"}</td>
                                            <td className="text-muted small">{p.received_by_name || "Staff"}</td>
                                            <td className="text-end fw-bold text-success">₹{Number(p.paid_amount).toFixed(2)}</td>
                                            <td className="text-center d-print-none">
                                                <Link
                                                    href={`/next_panel/player-payments/${p.id}`}
                                                    className="btn btn-outline-primary btn-sm py-0 px-2"
                                                >
                                                    Receipt
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer notes for print */}
                <div className="mt-5 pt-4 border-top text-center text-muted small d-print-block">
                    Thank you for training with {fee.academy_name || "CST Cricket Academy"}. For any fee queries, contact the administration office.
                </div>
            </div>
        </div>
    );
}
