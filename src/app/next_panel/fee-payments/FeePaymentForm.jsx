"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "../components/UserContext";

const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque"];
const PAYMENT_STATUSES = ["Paid", "Refunded", "Cancelled"];

const EMPTY_FORM = {
    fee_status_id: "",
    amount: "",
    payment_mode: "Cash",
    transaction_no: "",
    payment_date: "", // datetime-local, blank = server uses "now"
    status: "Paid",
    remarks: "",
};

const money = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ISO string from the API -> value for <input type="datetime-local"> in the browser's timezone
const toLocalInput = (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function FeePaymentForm({ id = null }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isEdit = Boolean(id);
    const { user } = useUser();

    const userAcademyId = user?.academy_id;
    const hasAssignedAcademy =
        userAcademyId !== null && userAcademyId !== undefined && userAcademyId !== "" && Number(userAcademyId) !== 0;

    const [formData, setFormData] = useState({
        ...EMPTY_FORM,
        fee_status_id: searchParams.get("fee_status_id") || "",
    });
    const [fees, setFees] = useState([]);
    const [originalStatus, setOriginalStatus] = useState("Paid"); // edit mode: a non-Paid payment can't go back to Paid
    const [editFee, setEditFee] = useState(null); // fee context shown in edit mode
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState("");

    const selectedFee = isEdit ? editFee : fees.find((f) => Number(f.id) === Number(formData.fee_status_id));
    const balance = selectedFee
        ? Number(selectedFee.balance_amount ?? Number(selectedFee.fee_amount || 0) - Number(selectedFee.paid_amount || 0))
        : null;

    // Create mode: fees that can still take a payment
    useEffect(() => {
        if (isEdit) return;
        (async () => {
            try {
                const params = new URLSearchParams();
                if (hasAssignedAcademy) params.set("academy_id", userAcademyId);
                const res = await fetch(`/api/fee-status${params.toString() ? `?${params}` : ""}`);
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.message || "Unable to load fee records");
                setFees(
                    (json.data || []).filter(
                        (f) =>
                            f.status !== "Cancelled" &&
                            Number(f.fee_amount || 0) - Number(f.paid_amount || 0) > 0
                    )
                );
            } catch (err) {
                setError(err.message);
            }
        })();
    }, [isEdit, hasAssignedAcademy, userAcademyId]);

    // Edit mode
    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/fee-payments/${id}`);
                const result = await res.json();
                if (!res.ok || !result.success) throw new Error(result.message || "Failed to fetch payment");

                const d = result.data;
                setOriginalStatus(d.status);
                setEditFee(d);
                setFormData({
                    fee_status_id: d.fee_status_id ?? "",
                    amount: d.amount ?? "",
                    payment_mode: d.payment_mode || "Cash",
                    transaction_no: d.transaction_no || "",
                    payment_date: toLocalInput(d.payment_date),
                    status: d.status || "Paid",
                    remarks: d.remarks || "",
                });
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        })();
    }, [id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const feeId = Number(formData.fee_status_id);
        const amount = Number(formData.amount);

        if (!Number.isInteger(feeId) || feeId <= 0) return setError("Please choose a fee record");
        if (!Number.isFinite(amount) || amount <= 0) return setError("Amount must be greater than zero");
        // Only new payments are checked against the balance here; the API checks edits against the fee total
        if (!isEdit && balance !== null && amount > balance) {
            return setError(`Payment amount cannot exceed the remaining balance of ₹${money(balance)}`);
        }

        const payload = {
            amount,
            payment_mode: formData.payment_mode,
            transaction_no: formData.transaction_no.trim() || null,
            remarks: formData.remarks.trim() || null,
        };
        if (formData.payment_date) payload.payment_date = new Date(formData.payment_date).toISOString();
        if (isEdit) payload.status = formData.status;
        else payload.fee_status_id = feeId; // fee can't be changed after creation

        try {
            setLoading(true);
            setError("");

            const res = await fetch(isEdit ? `/api/fee-payments/${id}` : "/api/fee-payments", {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Something went wrong");

            alert(isEdit ? "Payment updated successfully" : "Payment recorded successfully");
            router.push("/next_panel/fee-payments");
            router.refresh();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) return <div className="text-center py-5">Loading...</div>;

    const payerName = (f) => {
        if (!f) return "";
        const name = `${f.player_first_name || f.first_name || ""} ${f.player_last_name || f.last_name || ""}`.trim();
        if (name) return name;
        if (f.outside_player_name) return f.outside_player_name;
        if (f.player_name) return f.player_name;
        if (f.outside_player_id) return `Outside player #${f.outside_player_id}`;
        return "";
    };

    const feeLabel = (f) => {
        const who = payerName(f);
        const due = Number(f.fee_amount || 0) - Number(f.paid_amount || 0);
        return `#${f.id} · ${f.fee_type}${who ? ` · ${who}` : ""} · due ₹${money(due)}`;
    };

    const editWho = payerName(editFee);

    return (
        <div className="card shadow-sm">
            <div className="card-header">
                <h5 className="mb-0">{isEdit ? "Edit Payment" : "Record Payment"}</h5>
            </div>

            <div className="card-body">
                {error && <div className="alert alert-danger">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="row">
                        <div className="col-md-8 mb-3">
                            <label className="form-label">Fee Record</label>
                            {isEdit ? (
                                <input
                                    type="text"
                                    className="form-control"
                                    readOnly
                                    value={
                                        editFee
                                            ? `#${editFee.fee_status_id} · ${editFee.fee_type}${editWho ? ` · ${editWho}` : ""} · fee ₹${money(editFee.fee_amount)}`
                                            : ""
                                    }
                                />
                            ) : (
                                <select name="fee_status_id" className="form-select" value={formData.fee_status_id} onChange={handleChange} required>
                                    <option value="">Choose Fee Record</option>
                                    {fees.map((f) => (
                                        <option key={f.id} value={f.id}>{feeLabel(f)}</option>
                                    ))}
                                </select>
                            )}
                            <div className="form-text">
                                {isEdit
                                    ? "The fee a payment belongs to can't be changed."
                                    : "Only fees that are not cancelled and still have a balance are listed."}
                            </div>
                        </div>

                        {selectedFee && (
                            <div className="col-md-4 mb-3">
                                <label className="form-label">Fee Summary</label>
                                <div className="form-control-plaintext">
                                    ₹{money(selectedFee.paid_amount)} paid of ₹{money(selectedFee.fee_amount)}
                                    <br />
                                    <strong>Balance: ₹{money(balance)}</strong>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Amount (₹)</label>
                            <input type="number" min="0.01" step="0.01" name="amount" className="form-control" value={formData.amount} onChange={handleChange} required />
                            {!isEdit && balance !== null && (
                                <div className="form-text">
                                    <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setFormData((p) => ({ ...p, amount: String(balance) }))}>
                                        Pay full balance
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Payment Mode</label>
                            <select name="payment_mode" className="form-select" value={formData.payment_mode} onChange={handleChange}>
                                {PAYMENT_MODES.map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Transaction No. (optional)</label>
                            <input type="text" name="transaction_no" className="form-control" value={formData.transaction_no} onChange={handleChange} placeholder="UPI ref / cheque no." />
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Payment Date (optional)</label>
                            <input type="datetime-local" name="payment_date" className="form-control" value={formData.payment_date} onChange={handleChange} />
                            <div className="form-text">{isEdit ? "Leave unchanged to keep the date." : "Leave blank to use the current time."}</div>
                        </div>

                        {isEdit && (
                            <div className="col-md-4 mb-3">
                                <label className="form-label">Status</label>
                                <select name="status" className="form-select" value={formData.status} onChange={handleChange}>
                                    {PAYMENT_STATUSES.map((s) => (
                                        <option key={s} value={s} disabled={s === "Paid" && originalStatus !== "Paid"}>
                                            {s}
                                        </option>
                                    ))}
                                </select>
                                <div className="form-text">
                                    Refunded and Cancelled can't be set back to Paid; record a new payment instead.
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mb-3">
                        <label className="form-label">Remarks (optional)</label>
                        <textarea name="remarks" rows="3" className="form-control" value={formData.remarks} onChange={handleChange} placeholder="Enter remarks" />
                    </div>

                    <div className="d-flex gap-2">
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? "Saving..." : isEdit ? "Update Payment" : "Record Payment"}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => router.push("/next_panel/fee-payments")}>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
