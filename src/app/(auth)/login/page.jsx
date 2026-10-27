"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab State: 'academy' or 'public'
  const initialTab = searchParams.get("tab") === "public" ? "public" : "academy";
  const [activeTab, setActiveTab] = useState(initialTab);

  // Academy User Form State
  const [academyLogin, setAcademyLogin] = useState("");
  const [academyPassword, setAcademyPassword] = useState("");
  const [showAcademyPassword, setShowAcademyPassword] = useState(false);
  const [rememberMeAcademy, setRememberMeAcademy] = useState(false);
  const [academyError, setAcademyError] = useState("");
  const [isSubmittingAcademy, setIsSubmittingAcademy] = useState(false);

  // Public User Form State
  const [publicLogin, setPublicLogin] = useState("");
  const [publicPassword, setPublicPassword] = useState("");
  const [showPublicPassword, setShowPublicPassword] = useState(false);
  const [rememberMePublic, setRememberMePublic] = useState(false);
  const [publicError, setPublicError] = useState("");
  const [isSubmittingPublic, setIsSubmittingPublic] = useState(false);

  const [justRegistered, setJustRegistered] = useState(false);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "public" || tabParam === "academy") {
      setActiveTab(tabParam);
    }
    if (searchParams.get("registered") === "1") {
      setJustRegistered(true);
    }

    if (typeof window !== "undefined") {
      const savedAcademy = localStorage.getItem("remembered_login");
      if (savedAcademy) {
        setAcademyLogin(savedAcademy);
        setRememberMeAcademy(true);
      }
      const savedPublic = localStorage.getItem("remembered_public_login");
      if (savedPublic) {
        setPublicLogin(savedPublic);
        setRememberMePublic(true);
      }
    }
  }, [searchParams]);

  // 1. ACADEMY USER SUBMIT
  async function handleAcademySubmit(event) {
    event.preventDefault();
    setAcademyError("");
    setIsSubmittingAcademy(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: academyLogin, password: academyPassword }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Invalid credentials. Please try again.");
      }

      const rawUser = result.user || {};
      const fullName =
        [rawUser.first_name, rawUser.last_name].filter(Boolean).join(" ") ||
        rawUser.name ||
        rawUser.appointment_no ||
        "Academy User";

      const fullUser = {
        ...rawUser,
        name: fullName,
        is_public: false,
      };

      const session = {
        user: fullUser,
        permissions: result.permissions || [],
      };

      const sessionStr = JSON.stringify(session);
      const userStr = JSON.stringify(fullUser);
      const permStr = JSON.stringify(session.permissions || []);

      sessionStorage.setItem("auth_session", sessionStr);
      sessionStorage.setItem("auth_user", userStr);
      sessionStorage.setItem("auth_permissions", permStr);

      localStorage.setItem("auth_session", sessionStr);
      localStorage.setItem("auth_user", userStr);
      localStorage.setItem("auth_permissions", permStr);

      window.dispatchEvent(new Event("auth-session-change"));

      if (rememberMeAcademy) {
        localStorage.setItem("remembered_login", academyLogin);
      } else {
        localStorage.removeItem("remembered_login");
      }

      const redirectPath = searchParams.get("redirect");
      window.location.href = redirectPath || "/next_panel/dashboard";
    } catch (requestError) {
      setAcademyError(requestError.message);
    } finally {
      setIsSubmittingAcademy(false);
    }
  }

  // 2. PUBLIC USER SUBMIT
  async function handlePublicSubmit(event) {
    event.preventDefault();
    setPublicError("");
    setIsSubmittingPublic(true);

    try {
      // Send to /api/public-auth/login
      const response = await fetch("/api/public-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: publicLogin, password: publicPassword }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Invalid mobile number/email or password.");
      }

      const session = result.session || {
        user: {
          id: result.user.id,
          name: result.user.name,
          first_name: result.user.first_name || result.user.name?.split(" ")[0],
          last_name: result.user.last_name || result.user.name?.split(" ").slice(1).join(" "),
          email: result.user.email,
          phone: result.user.phone,
          user_type: result.user.user_type || "Public User",
          profile_image: result.user.profile_image || null,
          is_public: true,
        },
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

      if (rememberMePublic) {
        localStorage.setItem("remembered_public_login", publicLogin);
      } else {
        localStorage.removeItem("remembered_public_login");
      }

      // Requirement: Redirect public user to Landing / Home page
      const redirectPath = searchParams.get("redirect");
      window.location.href = redirectPath || "/";
    } catch (requestError) {
      setPublicError(requestError.message);
    } finally {
      setIsSubmittingPublic(false);
    }
  }

  return (
    <main className="auth-wrapper">
      <div className="container" style={{ maxWidth: "1080px" }}>
        <div className="card auth-card border-0">
          <div className="row g-0">
            {/* Left Brand Showcase Column */}
            <div className="col-lg-5 d-none d-lg-flex auth-left-brand">
              <div style={{ position: "relative", zIndex: 2 }}>
                <div className="d-flex align-items-center justify-content-between mb-4">
                  <Link href="/" className="logo-badge">
                    <img
                      src="/images/website/logo.png"
                      alt="ST Cricket Academy"
                    />
                  </Link>
                </div>

                <div className="mb-4">
                  <span
                    className="badge mb-2"
                    style={{
                      background: "rgba(0, 188, 212, 0.15)",
                      color: "var(--cyan)",
                      border: "1px solid var(--cyan)",
                      borderRadius: "50px",
                      padding: "0.35rem 0.9rem",
                      fontSize: "0.8rem",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    {activeTab === "academy"
                      ? "Academy Portal Access"
                      : "Public Grounds & Matches"}
                  </span>
                  <h2
                    className="display-font mt-2"
                    style={{
                      fontSize: "2rem",
                      lineHeight: "1.15",
                      color: "#ffffff",
                    }}
                  >
                    Train Like a <span className="text-cyan">Champion.</span>
                    <br />
                    Play Like a <span className="text-red">Pro.</span>
                  </h2>
                  <p
                    className="small mt-2"
                    style={{ color: "#cfd8e8", lineHeight: "1.6" }}
                  >
                    {activeTab === "academy"
                      ? "Centralized platform for academy players, coaches, staff, schedules, fee payments, and match administration."
                      : "Direct portal for match ground slots, friendly match fixtures, live scoreboards, and public booking orders."}
                  </p>
                </div>

                <div className="pt-2">
                  <div className="brand-feature-item">
                    <i className="bi bi-shield-check"></i>
                    <span>
                      {activeTab === "academy"
                        ? "Real-time player attendance & training status"
                        : "Instant match ground slot confirmation"}
                    </span>
                  </div>
                  <div className="brand-feature-item">
                    <i className="bi bi-trophy"></i>
                    <span>
                      {activeTab === "academy"
                        ? "Match fixtures, scores & tournament analytics"
                        : "Weekend tournaments & corporate leagues"}
                    </span>
                  </div>
                  <div className="brand-feature-item">
                    <i className="bi bi-wallet2"></i>
                    <span>
                      {activeTab === "academy"
                        ? "Seamless fee tracking & admission records"
                        : "Online booking request tracking & receipts"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Batsman Graphic & Quick Contact Info */}
              <div
                className="mt-auto text-center"
                style={{ position: "relative", zIndex: 2 }}
              >
                <img
                  src="/images/website/hero-batter.png"
                  alt="Cricket Batsman"
                  className="hero-batter-auth"
                />
                <div
                  className="mt-3 pt-3 border-top"
                  style={{
                    borderColor: "rgba(255,255,255,0.15)",
                    fontSize: "0.82rem",
                    color: "#aeb9cc",
                  }}
                >
                  <span>Need help? Contact support: </span>
                  <a
                    href="tel:+918285831503"
                    className="text-white fw-semibold ms-1"
                  >
                    +91 8285831503
                  </a>
                </div>
              </div>
            </div>

            {/* Right Form Column */}
            <div className="col-lg-7 d-flex align-items-center">
              <div className="w-100 p-4 p-sm-5">
                {/* Back Link & Mobile Logo Header */}
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <Link
                    href="/"
                    className="text-secondary small d-inline-flex align-items-center fw-medium"
                    style={{ textDecoration: "none" }}
                  >
                    <i className="bi bi-arrow-left me-1"></i> Back to Website
                  </Link>

                  <div className="d-lg-none">
                    <Link href="/" className="logo-badge">
                      <img
                        src="/images/website/logo.png"
                        alt="ST Cricket Academy"
                        style={{ height: "36px" }}
                      />
                    </Link>
                  </div>
                </div>

                {/* Title & Subtitle */}
                <div className="mb-3">
                  <span className="portal-badge mb-2">Portal Access</span>
                  <h1
                    className="display-font fw-bold mt-2 mb-1"
                    style={{
                      color: "var(--navy)",
                      fontSize: "2rem",
                      letterSpacing: "0.5px",
                    }}
                  >
                    SIGN IN TO ACCOUNT
                  </h1>
                  <p className="text-muted small mb-0">
                    Choose your account type below to proceed to your portal.
                  </p>
                </div>

                {/* ============================================================ */}
                {/* TAB SWITCHER: 1. ACADEMY USER  vs  2. PUBLIC USER */}
                {/* ============================================================ */}
                <div className="bg-light p-1 rounded-pill mb-4 border d-flex">
                  <button
                    type="button"
                    className={`btn flex-fill rounded-pill py-2 small fw-bold d-flex align-items-center justify-content-center gap-1.5 transition-all ${
                      activeTab === "academy"
                        ? "btn-navy shadow-sm"
                        : "btn-light text-muted border-0"
                    }`}
                    onClick={() => {
                      setActiveTab("academy");
                      setAcademyError("");
                      setPublicError("");
                    }}
                  >
                    <i className="bi bi-shield-shaded"></i>
                    <span>1. Academy User</span>
                  </button>

                  <button
                    type="button"
                    className={`btn flex-fill rounded-pill py-2 small fw-bold d-flex align-items-center justify-content-center gap-1.5 transition-all ${
                      activeTab === "public"
                        ? "btn-navy shadow-sm"
                        : "btn-light text-muted border-0"
                    }`}
                    onClick={() => {
                      setActiveTab("public");
                      setAcademyError("");
                      setPublicError("");
                    }}
                  >
                    <i className="bi bi-person-fill"></i>
                    <span>2. Public User</span>
                  </button>
                </div>

                {/* Notifications */}
                {justRegistered && (
                  <div
                    className="alert alert-success d-flex align-items-center py-2 px-3 mb-3 rounded-3"
                    role="alert"
                    style={{ fontSize: "0.9rem" }}
                  >
                    <i className="bi bi-check-circle-fill me-2 fs-5"></i>
                    <div>Account created successfully! Please sign in below.</div>
                  </div>
                )}

                {/* ============================================================ */}
                {/* TAB 1: ACADEMY USER LOGIN FORM */}
                {/* ============================================================ */}
                {activeTab === "academy" && (
                  <div>
                    {academyError && (
                      <div
                        className="alert alert-danger d-flex align-items-center py-2 px-3 mb-3 rounded-3"
                        role="alert"
                        style={{ fontSize: "0.9rem" }}
                      >
                        <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
                        <div>{academyError}</div>
                      </div>
                    )}

                    <form onSubmit={handleAcademySubmit} noValidate>
                      {/* Email / Appointment input */}
                      <div className="mb-3">
                        <label
                          className="form-label fw-semibold small text-dark mb-1"
                          htmlFor="academy_login"
                        >
                          Email or Appointment Number
                        </label>
                        <div className="auth-input-group">
                          <i className="bi bi-person-badge input-icon"></i>
                          <input
                            id="academy_login"
                            type="text"
                            className="form-control"
                            placeholder="e.g. player@example.com or APP-1001"
                            value={academyLogin}
                            onChange={(event) => setAcademyLogin(event.target.value)}
                            autoComplete="username"
                            required
                            disabled={isSubmittingAcademy}
                          />
                        </div>
                      </div>

                      {/* Password input */}
                      <div className="mb-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <label
                            className="form-label fw-semibold small text-dark mb-0"
                            htmlFor="academy_password"
                          >
                            Password
                          </label>
                          <a
                            href="mailto:chandankeshri100@gmail.com?subject=Password%20Reset%20Request%20-%20CST%20Pro"
                            className="small text-red"
                            style={{ fontSize: "0.82rem" }}
                          >
                            Forgot password?
                          </a>
                        </div>
                        <div className="auth-input-group">
                          <i className="bi bi-shield-lock input-icon"></i>
                          <input
                            id="academy_password"
                            type={showAcademyPassword ? "text" : "password"}
                            className="form-control"
                            placeholder="Enter your account password"
                            value={academyPassword}
                            onChange={(event) => setAcademyPassword(event.target.value)}
                            autoComplete="current-password"
                            required
                            disabled={isSubmittingAcademy}
                          />
                          <button
                            type="button"
                            className="auth-password-toggle"
                            onClick={() => setShowAcademyPassword((prev) => !prev)}
                            aria-label={showAcademyPassword ? "Hide password" : "Show password"}
                            tabIndex={-1}
                          >
                            <i
                              className={`bi ${
                                showAcademyPassword ? "bi-eye-slash-fill" : "bi-eye-fill"
                              }`}
                            ></i>
                          </button>
                        </div>
                      </div>

                      {/* Remember Me */}
                      <div className="d-flex align-items-center mb-4">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="rememberMeAcademy"
                            checked={rememberMeAcademy}
                            onChange={(e) => setRememberMeAcademy(e.target.checked)}
                            style={{ cursor: "pointer" }}
                          />
                          <label
                            className="form-check-label small text-secondary"
                            htmlFor="rememberMeAcademy"
                            style={{ cursor: "pointer", userSelect: "none" }}
                          >
                            Remember my login ID
                          </label>
                        </div>
                      </div>

                      {/* Submit Button */}
                      <button
                        className="btn btn-red w-100 py-3 d-flex align-items-center justify-content-center"
                        type="submit"
                        disabled={isSubmittingAcademy || !academyLogin || !academyPassword}
                      >
                        {isSubmittingAcademy ? (
                          <>
                            <span
                              className="spinner-border spinner-border-sm me-2"
                              role="status"
                              aria-hidden="true"
                            ></span>
                            Signing in to Academy Portal...
                          </>
                        ) : (
                          <>
                            Sign In as Academy User <i className="bi bi-arrow-right ms-2"></i>
                          </>
                        )}
                      </button>
                    </form>

                    {/* Footer links */}
                    <div className="text-center mt-4 pt-2 border-top">
                      <p className="text-secondary small mb-2">
                        Need an academy account?{" "}
                        <Link href="/register?tab=academy" className="text-red fw-bold">
                          Register with Appointment No.
                        </Link>
                      </p>
                      <p className="text-muted mb-0" style={{ fontSize: "0.78rem" }}>
                        <i className="bi bi-shield-fill-check text-teal me-1"></i>
                        Secure SSL encrypted • CST Pro Academy Portal
                      </p>
                    </div>
                  </div>
                )}

                {/* ============================================================ */}
                {/* TAB 2: PUBLIC USER LOGIN FORM */}
                {/* ============================================================ */}
                {activeTab === "public" && (
                  <div>
                    {publicError && (
                      <div
                        className="alert alert-danger d-flex align-items-center py-2 px-3 mb-3 rounded-3"
                        role="alert"
                        style={{ fontSize: "0.9rem" }}
                      >
                        <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
                        <div>{publicError}</div>
                      </div>
                    )}

                    <form onSubmit={handlePublicSubmit} noValidate>
                      {/* Email or Mobile Number */}
                      <div className="mb-3">
                        <label
                          className="form-label fw-semibold small text-dark mb-1"
                          htmlFor="public_login"
                        >
                          Email Address or Mobile Number
                        </label>
                        <div className="auth-input-group">
                          <i className="bi bi-person input-icon"></i>
                          <input
                            id="public_login"
                            type="text"
                            className="form-control"
                            placeholder="e.g. rahul@example.com or 9876543210"
                            value={publicLogin}
                            onChange={(event) => setPublicLogin(event.target.value)}
                            autoComplete="username"
                            required
                            disabled={isSubmittingPublic}
                          />
                        </div>
                      </div>

                      {/* Password input */}
                      <div className="mb-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <label
                            className="form-label fw-semibold small text-dark mb-0"
                            htmlFor="public_password"
                          >
                            Password
                          </label>
                          <a
                            href="mailto:chandankeshri100@gmail.com?subject=Password%20Reset%20Request%20-%20Public%20Account"
                            className="small text-red"
                            style={{ fontSize: "0.82rem" }}
                          >
                            Forgot password?
                          </a>
                        </div>
                        <div className="auth-input-group">
                          <i className="bi bi-shield-lock input-icon"></i>
                          <input
                            id="public_password"
                            type={showPublicPassword ? "text" : "password"}
                            className="form-control"
                            placeholder="Enter your public account password"
                            value={publicPassword}
                            onChange={(event) => setPublicPassword(event.target.value)}
                            autoComplete="current-password"
                            required
                            disabled={isSubmittingPublic}
                          />
                          <button
                            type="button"
                            className="auth-password-toggle"
                            onClick={() => setShowPublicPassword((prev) => !prev)}
                            aria-label={showPublicPassword ? "Hide password" : "Show password"}
                            tabIndex={-1}
                          >
                            <i
                              className={`bi ${
                                showPublicPassword ? "bi-eye-slash-fill" : "bi-eye-fill"
                              }`}
                            ></i>
                          </button>
                        </div>
                      </div>

                      {/* Remember Me */}
                      <div className="d-flex align-items-center mb-4">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="rememberMePublic"
                            checked={rememberMePublic}
                            onChange={(e) => setRememberMePublic(e.target.checked)}
                            style={{ cursor: "pointer" }}
                          />
                          <label
                            className="form-check-label small text-secondary"
                            htmlFor="rememberMePublic"
                            style={{ cursor: "pointer", userSelect: "none" }}
                          >
                            Remember my login ID
                          </label>
                        </div>
                      </div>

                      {/* Submit Button */}
                      <button
                        className="btn btn-navy w-100 py-3 d-flex align-items-center justify-content-center"
                        type="submit"
                        disabled={isSubmittingPublic || !publicLogin || !publicPassword}
                      >
                        {isSubmittingPublic ? (
                          <>
                            <span
                              className="spinner-border spinner-border-sm me-2"
                              role="status"
                              aria-hidden="true"
                            ></span>
                            Signing in...
                          </>
                        ) : (
                          <>
                            Sign In as Public User <i className="bi bi-arrow-right ms-2"></i>
                          </>
                        )}
                      </button>
                    </form>

                    {/* Footer links */}
                    <div className="text-center mt-4 pt-2 border-top">
                      <p className="text-secondary small mb-2">
                        New to CST Pro?{" "}
                        <Link href="/register?tab=public" className="text-red fw-bold">
                          Create a Public Account
                        </Link>
                      </p>
                      <p className="text-muted mb-0" style={{ fontSize: "0.78rem" }}>
                        <i className="bi bi-shield-fill-check text-teal me-1"></i>
                        Fast &amp; secure login for ground bookings &amp; visitors
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-vh-100 bg-cream d-flex align-items-center justify-content-center">
          <div className="spinner-border text-navy" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
