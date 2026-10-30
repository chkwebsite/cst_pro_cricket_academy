"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PublicRegisterForm({ onSuccessRedirect = "/" }) {
    const router = useRouter();

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
    });

    const [profileImage, setProfileImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(true);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (error) setError("");
    };

    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            setError("Image size cannot exceed 2MB.");
            e.target.value = "";
            return;
        }

        setProfileImage(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");

        if (!formData.name.trim()) {
            setError("Please enter your full name.");
            return;
        }

        if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
            setError("Please enter a valid email address.");
            return;
        }

        const cleanPhone = formData.phone.replace(/[^0-9]/g, "");
        if (cleanPhone.length < 10) {
            setError("Please enter a valid 10-digit mobile number.");
            return;
        }

        if (!formData.password || formData.password.length < 6) {
            setError("Password must be at least 6 characters long.");
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match. Please verify your password.");
            return;
        }

        if (!agreedToTerms) {
            setError("Please accept the terms & conditions to proceed.");
            return;
        }

        setSubmitting(true);

        try {
            let res;

            if (profileImage) {
                const data = new FormData();
                data.append("name", formData.name.trim());
                data.append("email", formData.email.trim());
                data.append("phone", cleanPhone);
                data.append("password", formData.password);
                data.append("profile_image", profileImage);

                res = await fetch("/api/public-auth/register", {
                    method: "POST",
                    body: data,
                });
            } else {
                res = await fetch("/api/public-auth/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: formData.name.trim(),
                        email: formData.email.trim(),
                        phone: cleanPhone,
                        password: formData.password,
                    }),
                });
            }

            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Registration failed. Please try again.");
            }

            // Save public user session in sessionStorage
            const session = json.session || {
                user: json.user,
                permissions: ["public_user", "ground_booking"],
            };

            const sessionStr = JSON.stringify(session);
            const userStr = JSON.stringify(session.user);
            const permStr = JSON.stringify(session.permissions || []);

            sessionStorage.setItem("auth_session", sessionStr);
            sessionStorage.setItem("auth_user", userStr);
            sessionStorage.setItem("auth_permissions", permStr);

            localStorage.setItem("auth_session", sessionStr);
            localStorage.setItem("auth_user", userStr);
            localStorage.setItem("auth_permissions", permStr);

            window.dispatchEvent(new Event("auth-session-change"));

            setSuccessMsg("Public account created successfully! Redirecting...");

            setTimeout(() => {
                window.location.href = onSuccessRedirect || "/";
            }, 1200);
        } catch (err) {
            setError(err.message || "An unexpected error occurred.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="card border-0 shadow-lg rounded-4 overflow-hidden">
            {/* Form Header */}
            <div
                className="p-4 p-md-4 text-white"
                style={{
                    background: "linear-gradient(135deg, var(--navy) 0%, var(--navy-2) 100%)",
                }}
            >
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div>
                        <span
                            className="badge bg-lime text-navy fw-bold mb-1 text-uppercase"
                            style={{ fontSize: "0.72rem", letterSpacing: "1px" }}
                        >
                            Open Public Access
                        </span>
                        <h4 className="fw-bold mb-0 text-white display-font" style={{ fontSize: "1.5rem" }}>
                            CREATE PUBLIC ACCOUNT
                        </h4>
                        <p className="small text-white-50 mb-0 mt-1">
                            Book cricket grounds, track match slots, and join open tournaments.
                        </p>
                    </div>
                    <div className="d-none d-sm-block">
                        <i className="bi bi-person-fill-check fs-1 text-lime opacity-75"></i>
                    </div>
                </div>
            </div>

            <div className="card-body p-4 p-md-5 bg-white">
                {error && (
                    <div className="alert alert-danger d-flex align-items-center py-2.5 px-3 mb-4 rounded-3" role="alert">
                        <i className="bi bi-exclamation-triangle-fill fs-5 me-2 flex-shrink-0"></i>
                        <div className="small">{error}</div>
                    </div>
                )}

                {successMsg && (
                    <div className="alert alert-success d-flex align-items-center py-2.5 px-3 mb-4 rounded-3" role="alert">
                        <i className="bi bi-check-circle-fill fs-5 me-2 flex-shrink-0"></i>
                        <div className="small">{successMsg}</div>
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                    <div className="row g-3">
                        {/* Full Name */}
                        <div className="col-12 col-md-6">
                            <label className="form-label fw-semibold small text-navy mb-1" htmlFor="public_name">
                                Full Name <span className="text-danger">*</span>
                            </label>
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0 text-muted">
                                    <i className="bi bi-person"></i>
                                </span>
                                <input
                                    type="text"
                                    id="public_name"
                                    name="name"
                                    className="form-control border-start-0"
                                    placeholder="e.g. Rahul Sharma"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                    disabled={submitting}
                                />
                            </div>
                        </div>

                        {/* Mobile Number */}
                        <div className="col-12 col-md-6">
                            <label className="form-label fw-semibold small text-navy mb-1" htmlFor="public_phone">
                                Mobile Number <span className="text-danger">*</span>
                            </label>
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0 text-muted">
                                    <i className="bi bi-telephone"></i>
                                </span>
                                <input
                                    type="tel"
                                    id="public_phone"
                                    name="phone"
                                    className="form-control border-start-0"
                                    placeholder="10-digit mobile number"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    maxLength={15}
                                    required
                                    disabled={submitting}
                                />
                            </div>
                        </div>

                        {/* Email Address */}
                        <div className="col-12">
                            <label className="form-label fw-semibold small text-navy mb-1" htmlFor="public_email">
                                Email Address <span className="text-danger">*</span>
                            </label>
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0 text-muted">
                                    <i className="bi bi-envelope"></i>
                                </span>
                                <input
                                    type="email"
                                    id="public_email"
                                    name="email"
                                    className="form-control border-start-0"
                                    placeholder="e.g. rahul.sharma@example.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    disabled={submitting}
                                />
                            </div>
                            <div className="form-text small text-muted">
                                Your booking confirmations and invoices will be sent to this email.
                            </div>
                        </div>

                        {/* Password */}
                        <div className="col-12 col-md-6">
                            <label className="form-label fw-semibold small text-navy mb-1" htmlFor="public_password">
                                Create Password <span className="text-danger">*</span>
                            </label>
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0 text-muted">
                                    <i className="bi bi-shield-lock"></i>
                                </span>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="public_password"
                                    name="password"
                                    className="form-control border-start-0 border-end-0"
                                    placeholder="At least 6 characters"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    disabled={submitting}
                                />
                                <button
                                    type="button"
                                    className="input-group-text bg-light border-start-0 text-muted"
                                    onClick={() => setShowPassword((p) => !p)}
                                    tabIndex={-1}
                                    aria-label="Toggle password visibility"
                                >
                                    <i className={`bi ${showPassword ? "bi-eye-slash-fill" : "bi-eye-fill"}`}></i>
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div className="col-12 col-md-6">
                            <label className="form-label fw-semibold small text-navy mb-1" htmlFor="public_confirm_password">
                                Confirm Password <span className="text-danger">*</span>
                            </label>
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0 text-muted">
                                    <i className="bi bi-shield-check"></i>
                                </span>
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    id="public_confirm_password"
                                    name="confirmPassword"
                                    className="form-control border-start-0 border-end-0"
                                    placeholder="Re-enter password"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                    disabled={submitting}
                                />
                                <button
                                    type="button"
                                    className="input-group-text bg-light border-start-0 text-muted"
                                    onClick={() => setShowConfirmPassword((p) => !p)}
                                    tabIndex={-1}
                                    aria-label="Toggle confirm password visibility"
                                >
                                    <i className={`bi ${showConfirmPassword ? "bi-eye-slash-fill" : "bi-eye-fill"}`}></i>
                                </button>
                            </div>
                        </div>

                        {/* Optional Profile Photo */}
                        <div className="col-12">
                            <label className="form-label fw-semibold small text-navy mb-1">
                                Profile Photo <span className="text-muted fw-normal">(Optional)</span>
                            </label>
                            <div className="d-flex align-items-center gap-3">
                                {imagePreview ? (
                                    <img
                                        src={imagePreview}
                                        alt="Preview"
                                        className="rounded-circle object-fit-cover border"
                                        style={{ width: "52px", height: "52px" }}
                                    />
                                ) : (
                                    <div
                                        className="rounded-circle bg-light border d-flex align-items-center justify-content-center text-muted"
                                        style={{ width: "52px", height: "52px" }}
                                    >
                                        <i className="bi bi-camera fs-5"></i>
                                    </div>
                                )}
                                <div className="flex-grow-1">
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        className="form-control form-control-sm"
                                        onChange={handleImageChange}
                                        disabled={submitting}
                                    />
                                    <div className="form-text small text-muted" style={{ fontSize: "0.75rem" }}>
                                        JPG, PNG or WEBP (max 2MB).
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Terms checkbox */}
                        <div className="col-12 mt-3">
                            <div className="form-check">
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id="public_terms"
                                    checked={agreedToTerms}
                                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                                    style={{ cursor: "pointer" }}
                                />
                                <label className="form-check-label small text-secondary" htmlFor="public_terms" style={{ cursor: "pointer" }}>
                                    I agree to the{" "}
                                    <Link href="/rules" className="text-navy fw-semibold text-decoration-underline" target="_blank">
                                        Academy Rules &amp; Regulations
                                    </Link>{" "}
                                    and Terms of Ground Booking.
                                </label>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="col-12 mt-4 pt-2">
                            <div className="d-flex flex-wrap align-items-center gap-3">
                                <button
                                    type="submit"
                                    className="btn btn-red py-3 px-5 d-inline-flex align-items-center justify-content-center rounded-pill fw-semibold shadow-sm"
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                            Creating Public Account...
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-person-check-fill me-2"></i>
                                            Create Public Account
                                        </>
                                    )}
                                </button>

                                <Link
                                    href="/login?tab=public"
                                    className="btn btn-outline-dark py-3 px-4 rounded-pill small fw-semibold"
                                >
                                    Already Registered? Sign In
                                </Link>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
