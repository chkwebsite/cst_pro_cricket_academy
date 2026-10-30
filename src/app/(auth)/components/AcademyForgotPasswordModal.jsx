"use client";

import { useState, useEffect } from "react";
import {
    Shield,
    Key,
    Clock,
    Lock,
    Eye,
    EyeOff,
    CheckCircle2,
    AlertCircle,
    X,
    ArrowRight,
    ArrowLeft,
    RefreshCw,
} from "lucide-react";

export default function AcademyForgotPasswordModal({ isOpen, onClose, onSuccess }) {
    // Steps: 1 = Request Code (Input Appt/Email/Phone), 2 = Enter 6-digit Code, 3 = Set New Password
    const [step, setStep] = useState(1);

    // Form inputs
    const [identifier, setIdentifier] = useState("");
    const [otpCode, setOtpCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    // Server returned state
    const [userId, setUserId] = useState(null);
    const [userName, setUserName] = useState("");
    const [appointmentNo, setAppointmentNo] = useState("");
    const [resetToken, setResetToken] = useState("");

    // UI Feedback
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    // 10-Minute countdown timer (in seconds)
    const [timeLeft, setTimeLeft] = useState(600);

    // Reset internal state when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setIdentifier("");
            setOtpCode("");
            setNewPassword("");
            setConfirmPassword("");
            setShowPassword(false);
            setUserId(null);
            setUserName("");
            setAppointmentNo("");
            setResetToken("");
            setError("");
            setSuccessMsg("");
            setTimeLeft(600);
        }
    }, [isOpen]);

    // Timer countdown effect in Step 2
    useEffect(() => {
        if (!isOpen || step !== 2 || timeLeft <= 0) return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isOpen, step, timeLeft]);

    if (!isOpen) return null;

    // STEP 1: Verify user and request 6-digit code
    const handleRequestCode = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");

        if (!identifier.trim()) {
            setError("Please enter your Appointment Number, Email, or Phone Number.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/auth/forgot-password/request-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier: identifier.trim() }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || "Unable to find account.");
            }

            setUserId(data.user_id);
            setUserName(data.user_name || "");
            setAppointmentNo(data.appointment_no || "");
            setTimeLeft(data.expires_in_seconds || 600);
            setStep(2);
            setSuccessMsg(data.message);
        } catch (err) {
            setError(err.message || "Failed to process request. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // STEP 2: Verify 6-digit code
    const handleVerifyCode = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");

        const cleanCode = otpCode.trim();
        if (!cleanCode || cleanCode.length !== 6) {
            setError("Please enter the complete 6-digit verification code.");
            return;
        }

        if (timeLeft <= 0) {
            setError("The 10-minute code validity has expired. Please request a new code.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/auth/forgot-password/verify-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: userId,
                    otp_code: cleanCode,
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || "Invalid or expired code.");
            }

            setResetToken(data.reset_token);
            setStep(3);
            setSuccessMsg("Code verified successfully! Please enter your new password below.");
        } catch (err) {
            setError(err.message || "Verification failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // STEP 3: Set new password
    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");

        if (!newPassword || newPassword.length < 6) {
            setError("New password must be at least 6 characters long.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("New password and confirmation password do not match.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/auth/forgot-password/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    reset_token: resetToken,
                    new_password: newPassword,
                    confirm_password: confirmPassword,
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || "Failed to reset password.");
            }

            if (onSuccess) {
                onSuccess({
                    userType: "academy",
                    identifier: appointmentNo || identifier.trim(),
                    message: data.message,
                });
            }
        } catch (err) {
            setError(err.message || "Failed to update password. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Timer formatting
    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? "0" : ""}${s}`;
    };

    return (
        <div
            className="modal show d-block"
            tabIndex="-1"
            style={{ backgroundColor: "rgba(10, 25, 47, 0.7)", zIndex: 1055, backdropFilter: "blur(4px)" }}
        >
            <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: "460px" }}>
                <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                    {/* Header */}
                    <div
                        className="modal-header border-0 text-white p-4"
                        style={{
                            background: "linear-gradient(135deg, #0a2540 0%, #1e3a8a 100%)",
                        }}
                    >
                        <div className="d-flex align-items-center gap-3">
                            <div className="bg-white bg-opacity-20 rounded-3 p-2 d-flex align-items-center justify-content-center">
                                <Shield size={24} className="text-white" />
                            </div>
                            <div>
                                <h5 className="modal-title fw-bold mb-0">Reset Academy Password</h5>
                                <p className="mb-0 small text-white-50">
                                    {step === 1 && "Step 1 of 3: Account Verification"}
                                    {step === 2 && "Step 2 of 3: Enter 6-Digit Code"}
                                    {step === 3 && "Step 3 of 3: Set New Password"}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="btn-close btn-close-white"
                            onClick={onClose}
                            disabled={loading}
                            aria-label="Close"
                        ></button>
                    </div>

                    {/* Body */}
                    <div className="modal-body p-4 bg-white">
                        {/* Error Alert */}
                        {error && (
                            <div className="alert alert-danger d-flex align-items-center py-2 px-3 mb-3 rounded-3" style={{ fontSize: "0.88rem" }}>
                                <AlertCircle size={18} className="me-2 flex-shrink-0 text-danger" />
                                <div>{error}</div>
                            </div>
                        )}

                        {/* Success Message Banner */}
                        {successMsg && !error && (
                            <div className="alert alert-success d-flex align-items-center py-2 px-3 mb-3 rounded-3" style={{ fontSize: "0.88rem" }}>
                                <CheckCircle2 size={18} className="me-2 flex-shrink-0 text-success" />
                                <div>{successMsg}</div>
                            </div>
                        )}

                        {/* ========================================================= */}
                        {/* STEP 1: Verify Account (Appt No, Email, or Phone) */}
                        {/* ========================================================= */}
                        {step === 1 && (
                            <form onSubmit={handleRequestCode}>
                                <div className="mb-3">
                                    <label className="form-label fw-semibold small text-dark mb-1">
                                        Appointment No, Email, or Phone Number <span className="text-danger">*</span>
                                    </label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-light text-muted">
                                            <Shield size={16} />
                                        </span>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. APP-1001, player@example.com, or 9876543210"
                                            value={identifier}
                                            onChange={(e) => setIdentifier(e.target.value)}
                                            autoFocus
                                            required
                                            disabled={loading}
                                        />
                                    </div>
                                    <div className="form-text text-muted" style={{ fontSize: "0.78rem" }}>
                                        Enter any registered credential for your Academy account.
                                    </div>
                                </div>

                                <div className="p-3 bg-light rounded-3 mb-4 border">
                                    <div className="d-flex align-items-start gap-2">
                                        <Clock size={16} className="text-primary mt-1 flex-shrink-0" />
                                        <p className="small text-muted mb-0" style={{ fontSize: "0.82rem" }}>
                                            Upon verification, a secure <strong>6-digit code</strong> will be generated. You can receive this code directly from your <strong>Branch Admin</strong> or <strong>Academy Admin</strong>.
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-danger w-100 py-2 d-flex align-items-center justify-content-center gap-2 fw-semibold"
                                    disabled={loading || !identifier.trim()}
                                >
                                    {loading ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm" role="status"></span>
                                            <span>Verifying Account...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Verify &amp; Generate Code</span>
                                            <ArrowRight size={16} />
                                        </>
                                    )}
                                </button>
                            </form>
                        )}

                        {/* ========================================================= */}
                        {/* STEP 2: Enter 6-Digit Code */}
                        {/* ========================================================= */}
                        {step === 2 && (
                            <form onSubmit={handleVerifyCode}>
                                <div className="card bg-primary-subtle border-0 rounded-3 p-3 mb-3">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <div className="small fw-semibold text-primary">Account Verified:</div>
                                            <div className="fw-bold text-dark">{userName || appointmentNo}</div>
                                            {appointmentNo && (
                                                <div className="small text-muted">Appt No: {appointmentNo}</div>
                                            )}
                                        </div>
                                        <div className="text-end">
                                            <div className="small text-muted">Valid for</div>
                                            <div
                                                className={`fw-bold font-monospace fs-5 ${
                                                    timeLeft < 120 ? "text-danger" : "text-primary"
                                                }`}
                                            >
                                                {formatTime(timeLeft)}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="alert alert-info py-2 px-3 rounded-3 small mb-3">
                                    <div className="d-flex align-items-start gap-2">
                                        <Key size={16} className="text-primary flex-shrink-0 mt-1" />
                                        <span>
                                            Please ask your <strong>Branch Admin</strong> or <strong>Academy Admin</strong> to provide your 6-digit verification code.
                                        </span>
                                    </div>
                                </div>

                                <div className="mb-3 text-center">
                                    <label className="form-label fw-semibold small text-dark mb-2">
                                        Enter 6-Digit Code
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={6}
                                        className="form-control text-center fw-bold fs-3 font-monospace tracking-wider"
                                        style={{ letterSpacing: "8px", maxWidth: "240px", margin: "0 auto" }}
                                        placeholder="------"
                                        value={otpCode}
                                        onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                                        autoFocus
                                        required
                                        disabled={loading || timeLeft <= 0}
                                    />
                                    {timeLeft <= 0 && (
                                        <div className="text-danger small mt-2">
                                            Code has expired after 10 minutes. Please request a new code.
                                        </div>
                                    )}
                                </div>

                                <div className="d-flex gap-2 mt-4">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary d-flex align-items-center gap-1 px-3"
                                        onClick={() => setStep(1)}
                                        disabled={loading}
                                    >
                                        <ArrowLeft size={16} />
                                        <span>Back</span>
                                    </button>

                                    <button
                                        type="submit"
                                        className="btn btn-danger flex-grow-1 py-2 d-flex align-items-center justify-content-center gap-2 fw-semibold"
                                        disabled={loading || otpCode.length !== 6 || timeLeft <= 0}
                                    >
                                        {loading ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm" role="status"></span>
                                                <span>Verifying Code...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Confirm &amp; Proceed</span>
                                                <ArrowRight size={16} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* ========================================================= */}
                        {/* STEP 3: Create New Password */}
                        {/* ========================================================= */}
                        {step === 3 && (
                            <form onSubmit={handleResetPassword}>
                                <div className="mb-3">
                                    <label className="form-label fw-semibold small text-dark mb-1">
                                        New Password <span className="text-danger">*</span>
                                    </label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-light text-muted">
                                            <Lock size={16} />
                                        </span>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            className="form-control"
                                            placeholder="Minimum 6 characters"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            autoFocus
                                            required
                                            disabled={loading}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-light border"
                                            onClick={() => setShowPassword((prev) => !prev)}
                                            tabIndex={-1}
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="form-label fw-semibold small text-dark mb-1">
                                        Confirm New Password <span className="text-danger">*</span>
                                    </label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-light text-muted">
                                            <Lock size={16} />
                                        </span>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            className="form-control"
                                            placeholder="Re-type new password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            disabled={loading}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-success w-100 py-2 d-flex align-items-center justify-content-center gap-2 fw-semibold"
                                    disabled={
                                        loading ||
                                        !newPassword ||
                                        newPassword.length < 6 ||
                                        newPassword !== confirmPassword
                                    }
                                >
                                    {loading ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm" role="status"></span>
                                            <span>Updating Password...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 size={16} />
                                            <span>Update Password &amp; Sign In</span>
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
