"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    IndianRupee,
    UserCheck,
    Calendar,
    Receipt,
    CheckCircle2,
    AlertCircle,
    ArrowLeft,
    CreditCard,
} from "lucide-react";

const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Card", "Cheque"];

const todayDate = () => {
    try {
        return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    } catch {
        return new Date().toISOString().slice(0, 10);
    }
};

export default function UmpirePaymentForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const paramUmpireId = searchParams.get("umpire_id") || "";
    const paramMatchId = searchParams.get("match_id") || "";
    const paramBookingId = searchParams.get("booking_id") || "";
    const paramDue = searchParams.get("due") || "";
    const paramUmpireName = searchParams.get("umpire_name") || "";
    const paramDutyNo = searchParams.get("duty_no") || "";

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    // Lists
    const [umpires, setUmpires] = useState([]);
    const [duties, setDuties] = useState([]);

    // Form state
    const [selectedUmpireId, setSelectedUmpireId] = useState(paramUmpireId);
    const [selectedDutyKey, setSelectedDutyKey] = useState(
        paramMatchId ? `match-${paramMatchId}` : paramBookingId ? `booking-${paramBookingId}` : ""
    );
    const [amount, setAmount] = useState(paramDue || "");
    const [paymentDate, setPaymentDate] = useState(todayDate());
    const [paymentMode, setPaymentMode] = useState("UPI");
    const [transactionNo, setTransactionNo] = useState("");
    const [remarks, setRemarks] = useState("");

    // Load initial umpires & duties
    useEffect(() => {
        let isMounted = true;

        async function initData() {
            setFetching(true);
            try {
                const [umpRes, payRes] = await Promise.all([
                    fetch("/api/umpires?limit=100&status=1").catch(() => null),
                    fetch("/api/umpire-payments?status=All").catch(() => null),
                ]);

                const [umpJson, payJson] = await Promise.all([
                    umpRes ? umpRes.json().catch(() => ({})) : {},
                    payRes ? payRes.json().catch(() => ({})) : {},
                ]);

                if (isMounted) {
                    setUmpires(umpJson?.data || []);
                    setDuties(payJson?.data?.duties || []);
                }
            } catch (err) {
                if (isMounted) setError(err.message);
            } finally {
                if (isMounted) setFetching(false);
            }
        }

        initData();
        return () => {
            isMounted = false;
        };
    }, []);

    // Filter duties for selected umpire
    const umpireDuties = duties.filter(
        (d) => String(d.umpire_id) === String(selectedUmpireId)
    );

    // Selected duty details
    const activeDuty = duties.find((d) => d.duty_key === selectedDutyKey) || null;

    // When active duty changes, auto-fill amount with remaining balance if empty or previously auto-filled
    const handleDutyChange = (dutyKey) => {
        setSelectedDutyKey(dutyKey);
        const duty = duties.find((d) => d.duty_key === dutyKey);
        if (duty) {
            setAmount(String(duty.balance_amount || duty.fee_amount || ""));
            if (!selectedUmpireId && duty.umpire_id) {
                setSelectedUmpireId(String(duty.umpire_id));
            }
        }
    };

    const handleUmpireChange = (uId) => {
        setSelectedUmpireId(uId);
        setSelectedDutyKey("");
        setAmount("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");

        if (!selectedUmpireId) {
            setError("Please select an umpire.");
            return;
        }

        const payNum = Number(amount);
        if (!Number.isFinite(payNum) || payNum <= 0) {
            setError("Please enter a valid payment amount greater than ₹0.");
            return;
        }

        if (!paymentDate) {
            setError("Please select a payment date.");
            return;
        }

        setLoading(true);

        try {
            const payload = {
                umpire_id: Number(selectedUmpireId),
                amount: payNum,
                payment_date: paymentDate,
                payment_mode: paymentMode,
                transaction_no: transactionNo.trim() || null,
                remarks: remarks.trim() || null,
                match_id: activeDuty?.match_id || (paramMatchId ? Number(paramMatchId) : null),
                booking_id: activeDuty?.booking_id || (paramBookingId ? Number(paramBookingId) : null),
                academy_id: activeDuty?.academy_id || null,
                branch_id: activeDuty?.branch_id || null,
                umpire_role: activeDuty?.umpire_role || null,
            };

            const res = await fetch("/api/umpire-payments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to record payment.");
            }

            setSuccessMsg(json.message || "Payment recorded successfully!");
            setTimeout(() => {
                router.push("/next_panel/umpire-payments");
            }, 1200);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-danger">{error}</div>}
            {successMsg && <div className="alert alert-success">{successMsg}</div>}

            <div className="row g-4">
                {/* 1. Umpire & Duty Selection */}
                <div className="col-md-6">
                    <label className="form-label fw-semibold">
                        Select Umpire <span className="text-danger">*</span>
                    </label>
                    <select
                        className="form-select"
                        value={selectedUmpireId}
                        onChange={(e) => handleUmpireChange(e.target.value)}
                        required
                    >
                        <option value="">Choose Umpire...</option>
                        {umpires.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.umpire_name} ({u.mobile}) {u.branch_name ? `· ${u.branch_name}` : ""}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="col-md-6">
                    <label className="form-label fw-semibold">
                        Select Match / Ground Duty
                    </label>
                    <select
                        className="form-select"
                        value={selectedDutyKey}
                        onChange={(e) => handleDutyChange(e.target.value)}
                    >
                        <option value="">General Payment / Choose specific assignment...</option>
                        {umpireDuties.map((d) => (
                            <option key={d.duty_key} value={d.duty_key}>
                                {d.match_no || d.booking_no} ({d.match_type}) · Fee: ₹{d.fee_amount} · Due: ₹{d.balance_amount} [{d.payment_status}]
                            </option>
                        ))}
                    </select>
                </div>

                {/* 2. Assignment Summary Card if duty selected */}
                {activeDuty && (
                    <div className="col-12">
                        <div className="p-3 rounded-4 bg-light border">
                            <div className="row g-3 text-center text-sm-start">
                                <div className="col-sm-3">
                                    <small className="text-muted d-block">Assignment</small>
                                    <strong className="text-dark">
                                        {activeDuty.match_no || activeDuty.booking_no} ({activeDuty.match_type})
                                    </strong>
                                </div>
                                <div className="col-sm-3">
                                    <small className="text-muted d-block">Agreed Fee</small>
                                    <strong className="text-dark">₹{Number(activeDuty.fee_amount).toLocaleString("en-IN")}</strong>
                                </div>
                                <div className="col-sm-3">
                                    <small className="text-muted d-block">Already Paid</small>
                                    <strong className="text-success">₹{Number(activeDuty.paid_amount).toLocaleString("en-IN")}</strong>
                                </div>
                                <div className="col-sm-3">
                                    <small className="text-muted d-block">Remaining Balance Due</small>
                                    <strong className="text-danger">₹{Number(activeDuty.balance_amount).toLocaleString("en-IN")}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. Payment Details */}
                <div className="col-md-6">
                    <label className="form-label fw-semibold">
                        Payment Amount (₹) <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                        <span className="input-group-text bg-white">₹</span>
                        <input
                            type="number"
                            step="0.01"
                            min="1"
                            className="form-control"
                            placeholder="Enter amount to pay"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </div>
                </div>

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
                            <option key={mode} value={mode}>
                                {mode}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="col-md-6">
                    <label className="form-label fw-semibold">
                        Transaction / Reference Number (UTR / Cheque No)
                    </label>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. UPI Ref / Bank TXN / Cheque #"
                        value={transactionNo}
                        onChange={(e) => setTransactionNo(e.target.value)}
                    />
                </div>

                <div className="col-12">
                    <label className="form-label fw-semibold">
                        Remarks / Notes
                    </label>
                    <textarea
                        rows={2}
                        className="form-control"
                        placeholder="Remarks, notes or receipt details..."
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                    />
                </div>

                {/* 4. Action Buttons */}
                <div className="col-12 border-top pt-3 d-flex justify-content-between align-items-center">
                    <Link href="/next_panel/umpire-payments" className="btn btn-outline-secondary">
                        <ArrowLeft size={16} className="me-1" /> Cancel
                    </Link>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary px-4 fw-semibold d-inline-flex align-items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <span className="spinner-border spinner-border-sm" role="status" />
                                Processing Payment...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 size={18} />
                                Record Umpire Payment
                            </>
                        )}
                    </button>
                </div>
            </div>
        </form>
    );
}
