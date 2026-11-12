"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "../components/UserContext";
import { Calculator, Calendar, DollarSign, User, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

const currentYearMonth = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
};

export default function PlayerProgramFeeForm({ id = null }) {
    const router = useRouter();
    const isEdit = Boolean(id);
    const { user } = useUser();

    const userAcademyId = user?.academy_id;
    const hasAssignedAcademy =
        userAcademyId !== null && userAcademyId !== undefined && userAcademyId !== "" && Number(userAcademyId) !== 0;

    const [enrollments, setEnrollments] = useState([]);
    const [loadingEnrollments, setLoadingEnrollments] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState("");
    const [existingRecord, setExistingRecord] = useState(null);

    // Form state
    const [userProgramId, setUserProgramId] = useState("");
    const [yearMonth, setYearMonth] = useState(currentYearMonth());
    const [feeAmount, setFeeAmount] = useState(0);
    const [registrationFee, setRegistrationFee] = useState(0);
    const [dailyFee, setDailyFee] = useState(0);
    const [kitFee, setKitFee] = useState(0);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [lateFee, setLateFee] = useState(0);
    const [dueDate, setDueDate] = useState("");
    const [remarks, setRemarks] = useState("");
    const [paymentStatus, setPaymentStatus] = useState("Pending");

    // Fetch enrollments
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoadingEnrollments(true);
                const params = new URLSearchParams({ limit: "100" });
                if (hasAssignedAcademy) params.set("academy_id", String(userAcademyId));
                const res = await fetch(`/api/user-programs?${params.toString()}`);
                const json = await res.json();
                if (!cancelled && res.ok && json.success) {
                    setEnrollments(Array.isArray(json.data) ? json.data : []);
                }
            } catch {
                if (!cancelled) setEnrollments([]);
            } finally {
                if (!cancelled) setLoadingEnrollments(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [hasAssignedAcademy, userAcademyId]);

    // Load existing record for edit
    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/player-program-fees/${id}`);
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.message || "Failed to load fee record.");

                const d = json.data;
                setExistingRecord(d);
                setUserProgramId(String(d.user_program_id || ""));
                if (d.fee_month) {
                    setYearMonth(d.fee_month.slice(0, 7));
                }
                setFeeAmount(Number(d.fee_amount) || 0);
                setRegistrationFee(Number(d.registration_fee) || 0);
                setDailyFee(Number(d.daily_fee) || 0);
                setKitFee(Number(d.kit_fee) || 0);
                setDiscountAmount(Number(d.discount_amount) || 0);
                setLateFee(Number(d.late_fee) || 0);
                setDueDate(d.due_date ? d.due_date.slice(0, 10) : "");
                setRemarks(d.remarks || "");
                setPaymentStatus(d.payment_status || "Pending");
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        })();
    }, [id]);

    // When an enrollment is selected in create mode, prefill program fee and registration fee
    const handleEnrollmentChange = (e) => {
        const selectedId = e.target.value;
        setUserProgramId(selectedId);
        const item = enrollments.find((en) => String(en.id) === String(selectedId));
        if (item) {
            setFeeAmount(Number(item.program_fee) || 0);
            setRegistrationFee(Number(item.registration_fee) || 0);
        }
    };

    // Calculate subtotal and total
    const calculation = useMemo(() => {
        const fee = Number(feeAmount) || 0;
        const reg = Number(registrationFee) || 0;
        const daily = Number(dailyFee) || 0;
        const kit = Number(kitFee) || 0;
        const discount = Number(discountAmount) || 0;
        const late = Number(lateFee) || 0;

        const subtotal = fee + reg + daily + kit;
        const isDiscountInvalid = discount > subtotal;
        const total = isDiscountInvalid ? 0 : Number((subtotal - discount + late).toFixed(2));
        const paid = existingRecord ? Number(existingRecord.paid_amount) || 0 : 0;
        const due = Number(Math.max(0, total - paid).toFixed(2));

        return {
            subtotal,
            isDiscountInvalid,
            total,
            paid,
            due,
        };
    }, [feeAmount, registrationFee, dailyFee, kitFee, discountAmount, lateFee, existingRecord]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!userProgramId) {
            return setError("Please select a player enrollment.");
        }
        if (!yearMonth) {
            return setError("Please select a fee month.");
        }
        if (calculation.isDiscountInvalid) {
            return setError("Discount amount cannot exceed the subtotal fees.");
        }

        const fee_month = `${yearMonth}-01`;

        try {
            setLoading(true);

            if (isEdit) {
                const payload = {
                    id: Number(id),
                    fee_amount: Number(feeAmount),
                    registration_fee: Number(registrationFee),
                    daily_fee: Number(dailyFee),
                    kit_fee: Number(kitFee),
                    discount_amount: Number(discountAmount),
                    late_fee: Number(lateFee),
                    payment_status: paymentStatus,
                    due_date: dueDate || null,
                    remarks: remarks.trim() || null,
                };

                const res = await fetch(`/api/player-program-fees/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.message || "Failed to update monthly fee invoice.");

                alert("Fee invoice updated successfully.");
                router.push(`/next_panel/player-program-fees/${id}`);
                router.refresh();
            } else {
                const payload = {
                    user_program_id: Number(userProgramId),
                    fee_month,
                    fee_amount: Number(feeAmount),
                    registration_fee: Number(registrationFee),
                    daily_fee: Number(dailyFee),
                    kit_fee: Number(kitFee),
                    discount_amount: Number(discountAmount),
                    late_fee: Number(lateFee),
                    due_date: dueDate || null,
                    remarks: remarks.trim() || null,
                };

                const res = await fetch("/api/player-program-fees", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const json = await res.json();
                if (!res.ok || !json.success) {
                    if (res.status === 409 && json.fee_id) {
                        if (confirm(`${json.message} Would you like to view this existing invoice?`)) {
                            return router.push(`/next_panel/player-program-fees/${json.fee_id}`);
                        }
                    }
                    throw new Error(json.message || "Failed to generate fee invoice.");
                }

                alert("Monthly fee invoice generated successfully.");
                const newId = json.data?.id;
                if (newId) {
                    router.push(`/next_panel/player-program-fees/${newId}`);
                } else {
                    router.push("/next_panel/player-program-fees");
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
                <p className="text-muted mb-0">Loading invoice details...</p>
            </div>
        );
    }

    const selectedEnrollment = enrollments.find((e) => String(e.id) === String(userProgramId));

    return (
        <div className="card shadow-sm border-0">
            <div className="card-header bg-white py-3 d-flex align-items-center justify-content-between">
                <div>
                    <h5 className="mb-0 fw-bold">{isEdit ? "Edit Fee Invoice" : "Generate Monthly Fee Invoice"}</h5>
                    <small className="text-muted">
                        {isEdit
                            ? `Updating invoice #${id} for ${existingRecord?.player_name || "player"}`
                            : "Create a monthly fee invoice for an enrolled academy player"}
                    </small>
                </div>
                <Link href="/next_panel/player-program-fees" className="btn btn-outline-secondary btn-sm">
                    <ArrowLeft size={16} className="me-1" /> Back to Fees
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
                    {/* Enrollment & Month Selection */}
                    <div className="row g-3 mb-4">
                        <div className="col-md-7">
                            <label className="form-label fw-semibold">
                                Player Enrollment <span className="text-danger">*</span>
                            </label>
                            {isEdit ? (
                                <input
                                    type="text"
                                    className="form-control bg-light"
                                    value={
                                        existingRecord
                                            ? `${existingRecord.player_name} (${existingRecord.admission_no}) — ${existingRecord.program_name}`
                                            : `Enrollment #${userProgramId}`
                                    }
                                    readOnly
                                />
                            ) : (
                                <select
                                    className="form-select"
                                    value={userProgramId}
                                    onChange={handleEnrollmentChange}
                                    required
                                >
                                    <option value="">
                                        {loadingEnrollments ? "Loading player enrollments..." : "Choose Player & Program"}
                                    </option>
                                    {enrollments.map((item) => {
                                        const pName =
                                            item.player_name ||
                                            [item.player_first_name, item.player_last_name].filter(Boolean).join(" ") ||
                                            [item.first_name, item.last_name].filter(Boolean).join(" ") ||
                                            `Player #${item.admission_players_id || item.user_id}`;
                                        const adm = item.admission_no ? `[${item.admission_no}]` : "";
                                        const prog = item.program_name || `Program #${item.program_id}`;
                                        return (
                                            <option key={item.id} value={item.id}>
                                                {pName} {adm} — {prog}
                                            </option>
                                        );
                                    })}
                                </select>
                            )}
                            <div className="form-text">
                                {selectedEnrollment
                                    ? `Branch: ${selectedEnrollment.branch_name || "Main"} · Start: ${selectedEnrollment.start_date || "—"}`
                                    : "Select an active player enrolled in a program."}
                            </div>
                        </div>

                        <div className="col-md-5">
                            <label className="form-label fw-semibold">
                                Fee Month <span className="text-danger">*</span>
                            </label>
                            <input
                                type="month"
                                className="form-control"
                                value={yearMonth}
                                onChange={(e) => setYearMonth(e.target.value)}
                                disabled={isEdit}
                                required
                            />
                            <div className="form-text">Invoice billing month (e.g. {yearMonth}-01)</div>
                        </div>
                    </div>

                    {/* Breakdown & Calculation */}
                    <div className="row g-4">
                        <div className="col-lg-8">
                            <div className="card border bg-light p-3 rounded-3 mb-3">
                                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                                    <DollarSign size={18} className="text-primary" /> Fee Breakdown
                                </h6>

                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <label className="form-label">
                                            Program Fee (₹) <span className="text-danger">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="form-control"
                                            value={feeAmount}
                                            onChange={(e) => setFeeAmount(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="col-md-6">
                                        <label className="form-label">Registration Fee (₹)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="form-control"
                                            value={registrationFee}
                                            onChange={(e) => setRegistrationFee(e.target.value)}
                                        />
                                    </div>

                                    <div className="col-md-6">
                                        <label className="form-label">Daily Fee (₹)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="form-control"
                                            value={dailyFee}
                                            onChange={(e) => setDailyFee(e.target.value)}
                                        />
                                    </div>

                                    <div className="col-md-6">
                                        <label className="form-label">Kit Fee (₹)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="form-control"
                                            value={kitFee}
                                            onChange={(e) => setKitFee(e.target.value)}
                                        />
                                    </div>

                                    <div className="col-md-6">
                                        <label className="form-label text-success fw-semibold">Discount Amount (₹)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className={`form-control ${calculation.isDiscountInvalid ? "is-invalid" : ""}`}
                                            value={discountAmount}
                                            onChange={(e) => setDiscountAmount(e.target.value)}
                                        />
                                        {calculation.isDiscountInvalid && (
                                            <div className="invalid-feedback">Cannot exceed subtotal ₹{calculation.subtotal.toFixed(2)}</div>
                                        )}
                                    </div>

                                    <div className="col-md-6">
                                        <label className="form-label text-danger fw-semibold">Late Fee (₹)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="form-control"
                                            value={lateFee}
                                            onChange={(e) => setLateFee(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">Payment Due Date</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                    />
                                    <div className="form-text">Optional deadline for paying this invoice.</div>
                                </div>

                                {isEdit && (
                                    <div className="col-md-6">
                                        <label className="form-label fw-semibold">Invoice Status</label>
                                        <select
                                            className="form-select"
                                            value={paymentStatus}
                                            onChange={(e) => setPaymentStatus(e.target.value)}
                                        >
                                            <option value="Pending">Pending</option>
                                            <option value="Partial">Partial</option>
                                            <option value="Paid">Paid</option>
                                            <option value="Cancelled">Cancelled</option>
                                        </select>
                                    </div>
                                )}

                                <div className="col-12">
                                    <label className="form-label fw-semibold">Remarks (optional)</label>
                                    <textarea
                                        rows="2"
                                        className="form-control"
                                        placeholder="Notes, scholarship concession details, or remarks..."
                                        value={remarks}
                                        onChange={(e) => setRemarks(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Financial summary card */}
                        <div className="col-lg-4">
                            <div className="card shadow-sm border-primary border-opacity-25 h-100">
                                <div className="card-header bg-primary text-white py-2">
                                    <h6 className="mb-0 fw-semibold d-flex align-items-center gap-2">
                                        <Calculator size={18} /> Invoice Summary
                                    </h6>
                                </div>
                                <div className="card-body d-flex flex-column justify-content-between">
                                    <div className="list-group list-group-flush mb-3">
                                        <div className="list-group-item d-flex justify-content-between px-0">
                                            <span className="text-muted">Subtotal (Fees + Kit)</span>
                                            <span className="fw-semibold">₹{calculation.subtotal.toFixed(2)}</span>
                                        </div>
                                        <div className="list-group-item d-flex justify-content-between px-0 text-success">
                                            <span>Discount</span>
                                            <span>- ₹{Number(discountAmount || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="list-group-item d-flex justify-content-between px-0 text-danger">
                                            <span>Late Fee</span>
                                            <span>+ ₹{Number(lateFee || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="list-group-item d-flex justify-content-between px-0 pt-3 border-top">
                                            <span className="fs-5 fw-bold">Total Invoiced</span>
                                            <span className="fs-5 fw-bold text-primary">₹{calculation.total.toFixed(2)}</span>
                                        </div>
                                        {isEdit && (
                                            <>
                                                <div className="list-group-item d-flex justify-content-between px-0 text-success">
                                                    <span>Already Paid</span>
                                                    <span className="fw-bold">₹{calculation.paid.toFixed(2)}</span>
                                                </div>
                                                <div className="list-group-item d-flex justify-content-between px-0 text-danger">
                                                    <span className="fw-bold">Remaining Due</span>
                                                    <span className="fw-bold">₹{calculation.due.toFixed(2)}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="alert alert-light border small text-muted mb-0">
                                        <strong>Formula:</strong> (Program Fee + Registration + Daily + Kit) - Discount + Late Fee.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="d-flex gap-2 mt-4 pt-3 border-top">
                        <button
                            type="submit"
                            className="btn btn-primary px-4 fw-semibold"
                            disabled={loading || calculation.isDiscountInvalid}
                        >
                            {loading ? "Saving..." : isEdit ? "Update Fee Invoice" : "Generate Invoice"}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary px-4"
                            onClick={() => router.push("/next_panel/player-program-fees")}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
