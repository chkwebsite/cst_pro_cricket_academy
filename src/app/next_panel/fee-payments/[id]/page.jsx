import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Edit, Receipt } from "lucide-react";
import pool from "@/app/components/lib/db";

const STATUS_BADGE = {
    Paid: "bg-success",
    Refunded: "bg-warning text-dark",
    Cancelled: "bg-secondary",
};

const FEE_BADGE = {
    Pending: "bg-warning text-dark",
    Partial: "bg-info text-dark",
    Paid: "bg-success",
    Cancelled: "bg-secondary",
};

const money = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDateTime = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default async function FeePaymentDetailPage({ params }) {
    const { id } = await params;

    if (!Number.isInteger(Number(id)) || Number(id) <= 0) notFound();

    const connection = await pool.getConnection();
    let payment = null;
    let siblings = [];

    try {
        const [rows] = await connection.query(
            `
            SELECT
                fp.*,
                fs.academy_id,
                a.academy_name,
                fs.fee_type,
                fs.fee_amount,
                fs.paid_amount,
                fs.balance_amount,
                fs.status AS fee_status,
                u.first_name AS created_by_first_name,
                u.last_name AS created_by_last_name,
                pu.first_name,
                pu.last_name,
                op.player_name AS outside_player_name
            FROM cst_fee_payments fp
            INNER JOIN cst_fee_status fs ON fs.id = fp.fee_status_id
            LEFT JOIN cst_match_players mp ON mp.id = fs.match_player_id
            LEFT JOIN cst_tournament_team_players ttp ON ttp.id = fs.tournament_team_player_id
            LEFT JOIN cst_users pu ON pu.id = COALESCE(fs.user_id, mp.user_id, ttp.user_id)
            LEFT JOIN cst_outside_players op ON op.id = COALESCE(fs.outside_player_id, mp.outside_player_id, ttp.outside_player_id)
            LEFT JOIN cst_academy a ON a.id = fs.academy_id
            LEFT JOIN cst_users u ON u.id = fp.created_by
            WHERE fp.id = ?
            LIMIT 1
            `,
            [Number(id)]
        );

        if (!rows.length) notFound();
        payment = rows[0];

        // Other payments on the same fee, for context
        const [others] = await connection.query(
            `
            SELECT id, amount, payment_mode, payment_date, status
            FROM cst_fee_payments
            WHERE fee_status_id = ?
            ORDER BY payment_date DESC, id DESC
            `,
            [payment.fee_status_id]
        );
        siblings = others || [];
    } catch (error) {
        if (error?.digest?.startsWith?.("NEXT_")) throw error; // let notFound() through
        console.error("FEE PAYMENT DETAIL ERROR:", error);
        throw new Error("Failed to load payment details");
    } finally {
        connection.release();
    }

    const createdBy = `${payment.created_by_first_name || ""} ${payment.created_by_last_name || ""}`.trim();
    const playerName = `${payment.first_name || ""} ${payment.last_name || ""}`.trim() || payment.outside_player_name || "";
    const balance = payment.balance_amount ?? Number(payment.fee_amount || 0) - Number(payment.paid_amount || 0);

    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href="/next_panel/fee-payments" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to Fee Payments
                        </Link>
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <div>
                                <div className="d-flex align-items-center gap-2 mb-1">
                                    <Receipt size={22} />
                                    <h1 className="h4 mb-0">Payment Details</h1>
                                </div>
                                <p className="text-muted mb-0">Payment #{payment.id} · Fee #{payment.fee_status_id}</p>
                            </div>
                            <Link href={`/next_panel/fee-payments/${payment.id}/edit`} className="btn btn-primary">
                                <Edit size={16} className="me-2" /> Edit payment
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="col-lg-6">
                    <div className="bg-white rounded-4 shadow-sm p-4 h-100">
                        <h2 className="h6 mb-3">Payment</h2>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label className="text-muted small">Amount</label>
                                <div className="fw-semibold">₹{money(payment.amount)}</div>
                            </div>
                            <div className="col-md-6">
                                <label className="text-muted small">Status</label>
                                <div>
                                    <span className={`badge ${STATUS_BADGE[payment.status] || "bg-secondary"}`}>{payment.status}</span>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label className="text-muted small">Mode</label>
                                <div className="fw-semibold">{payment.payment_mode}</div>
                            </div>
                            <div className="col-md-6">
                                <label className="text-muted small">Transaction No.</label>
                                <div className="fw-semibold">{payment.transaction_no || "—"}</div>
                            </div>
                            <div className="col-md-6">
                                <label className="text-muted small">Payment Date</label>
                                <div className="fw-semibold">{formatDateTime(payment.payment_date)}</div>
                            </div>
                            <div className="col-md-6">
                                <label className="text-muted small">Recorded By</label>
                                <div className="fw-semibold">{createdBy || "—"}</div>
                            </div>
                            <div className="col-12">
                                <label className="text-muted small">Remarks</label>
                                <div>{payment.remarks || "—"}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-lg-6">
                    <div className="bg-white rounded-4 shadow-sm p-4 h-100">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h2 className="h6 mb-0">Fee</h2>
                            <Link href={`/next_panel/fee-status/${payment.fee_status_id}`} className="small">View fee</Link>
                        </div>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label className="text-muted small">Academy</label>
                                <div className="fw-semibold">{payment.academy_name || "—"}</div>
                            </div>
                            <div className="col-md-6">
                                <label className="text-muted small">Fee Type</label>
                                <div className="fw-semibold">{payment.fee_type}</div>
                            </div>
                            {playerName && (
                                <div className="col-md-6">
                                    <label className="text-muted small">Player</label>
                                    <div className="fw-semibold">{playerName}</div>
                                </div>
                            )}
                            <div className="col-md-4">
                                <label className="text-muted small">Fee Amount</label>
                                <div className="fw-semibold">₹{money(payment.fee_amount)}</div>
                            </div>
                            <div className="col-md-4">
                                <label className="text-muted small">Paid So Far</label>
                                <div className="fw-semibold">₹{money(payment.paid_amount)}</div>
                            </div>
                            <div className="col-md-4">
                                <label className="text-muted small">Balance</label>
                                <div className="fw-semibold">₹{money(balance)}</div>
                            </div>
                            <div className="col-md-6">
                                <label className="text-muted small">Fee Status</label>
                                <div>
                                    <span className={`badge ${FEE_BADGE[payment.fee_status] || "bg-secondary"}`}>{payment.fee_status}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {siblings.length > 1 && (
                    <div className="col-12">
                        <div className="bg-white rounded-4 shadow-sm p-4">
                            <h2 className="h6 mb-3">All payments on this fee</h2>
                            <div className="table-responsive">
                                <table className="table align-middle mb-0">
                                    <thead className="table-success">
                                        <tr>
                                            <th>Payment</th>
                                            <th>Date</th>
                                            <th>Mode</th>
                                            <th className="text-end">Amount</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {siblings.map((s) => (
                                            <tr key={s.id} className={s.id === payment.id ? "table-active" : ""}>
                                                <td>
                                                    {s.id === payment.id ? (
                                                        `#${s.id} (this)`
                                                    ) : (
                                                        <Link href={`/next_panel/fee-payments/${s.id}`}>#{s.id}</Link>
                                                    )}
                                                </td>
                                                <td>{formatDateTime(s.payment_date)}</td>
                                                <td>{s.payment_mode}</td>
                                                <td className="text-end">₹{money(s.amount)}</td>
                                                <td>
                                                    <span className={`badge ${STATUS_BADGE[s.status] || "bg-secondary"}`}>{s.status}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
