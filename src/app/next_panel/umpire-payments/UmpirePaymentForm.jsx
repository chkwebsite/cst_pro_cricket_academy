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
import { FormError, RequiredLabel } from "@/app/components/form";

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
    const [fieldErrors, setFieldErrors] = useState({});
    const [successMsg, setSuccessMsg] = useState("");

    const clearError = (field) => {
        if (fieldErrors[field]) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    const validateField = (name, value) => {
        let err = "";
        const val = typeof value === "string" ? value.trim() : value;
        switch (name) {
            case "umpire_id":
                if (!val) err = "Please select an umpire.";
                break;
            case "amount":
                if (val === "" || val === undefined || val === null) err = "Payment amount is required.";
                else if (Number(val) <= 0) err = "Payment amount must be greater than ₹0.";
                break;
            case "payment_date":
                if (!val) err = "Payment date is required.";
                break;
            case "payment_mode":
                if (!val) err = "Payment mode is required.";
                break;
            default:
                break;
        }
        return err;
    };

    const handleBlur = (field) => {
        const val = field === "umpire_id" ? selectedUmpireId : field === "amount" ? amount : field === "payment_date" ? paymentDate : paymentMode;
        const err = validateField(field, val);
        if (err) {
            setFieldErrors((prev) => ({ ...prev, [field]: err }));
        }
    };

    const validateAll = () => {
        const errors = {};
        const uErr = validateField("umpire_id", selectedUmpireId);
        if (uErr) errors.umpire_id = uErr;

        const aErr = validateField("amount", amount);
        if (aErr) errors.amount = aErr;

        const dErr = validateField("payment_date", paymentDate);
        if (dErr) errors.payment_date = dErr;

        const mErr = validateField("payment_mode", paymentMode);
        if (mErr) errors.payment_mode = mErr;

        setFieldErrors(errors);

        if (Object.keys(errors).length > 0) {
            const firstKey = Object.keys(errors)[0];
            const el = document.querySelector(`[name="${firstKey}"]`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.focus();
            }
            return false;
        }
        return true;
    };

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
        clearError("umpire_id");
        setSelectedUmpireId(uId);
        setSelectedDutyKey("");
        setAmount("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");

        if (!validateAll()) {
            return;
        }

        const payNum = Number(amount);
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
                if (json.errors) {
                    setFieldErrors(json.errors);
                    const firstKey = Object.keys(json.errors)[0];
                    const el = document.querySelector(`[name="${firstKey}"]`);
                    if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                        el.focus();
                    }
                }
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
                        Select Umpire <RequiredLabel />
                    </label>
                    <select
                        name="umpire_id"
                        className={`form-select ${fieldErrors.umpire_id ? "is-invalid border-danger" : ""}`}
                        value={selectedUmpireId}
                        onChange={(e) => handleUmpireChange(e.target.value)}
                        onBlur={() => handleBlur("umpire_id")}
                    >
                        <option value="">Choose Umpire...</option>
                        {umpires.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.umpire_name} ({u.mobile}) {u.branch_name ? `· ${u.branch_name}` : ""}
                            </option>
                        ))}
                    </select>
                    <FormError error={fieldErrors.umpire_id} />
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
                        Payment Amount (₹) <RequiredLabel />
                    </label>
                    <div className="input-group">
                        <span className="input-group-text bg-white">₹</span>
                        <input
                            type="number"
                            name="amount"
                            step="0.01"
                            min="1"
                            className={`form-control ${fieldErrors.amount ? "is-invalid border-danger" : ""}`}
                            placeholder="Enter amount to pay"
                            value={amount}
                            onChange={(e) => {
                                clearError("amount");
                                setAmount(e.target.value);
                            }}
                            onBlur={() => handleBlur("amount")}
                        />
                    </div>
                    <FormError error={fieldErrors.amount} />
                </div>

                <div className="col-md-6">
                    <label className="form-label fw-semibold">
                        Payment Date <RequiredLabel />
                    </label>
                    <input
                        type="date"
                        name="payment_date"
                        className={`form-control ${fieldErrors.payment_date ? "is-invalid border-danger" : ""}`}
                        value={paymentDate}
                        onChange={(e) => {
                            clearError("payment_date");
                            setPaymentDate(e.target.value);
                        }}
                        onBlur={() => handleBlur("payment_date")}
                    />
                    <FormError error={fieldErrors.payment_date} />
                </div>

                <div className="col-md-6">
                    <label className="form-label fw-semibold">
                        Payment Mode <RequiredLabel />
                    </label>
                    <select
                        name="payment_mode"
                        className={`form-select ${fieldErrors.payment_mode ? "is-invalid border-danger" : ""}`}
                        value={paymentMode}
                        onChange={(e) => {
                            clearError("payment_mode");
                            setPaymentMode(e.target.value);
                        }}
                        onBlur={() => handleBlur("payment_mode")}
                    >
                        {PAYMENT_MODES.map((mode) => (
                            <option key={mode} value={mode}>
                                {mode}
                            </option>
                        ))}
                    </select>
                    <FormError error={fieldErrors.payment_mode} />
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
