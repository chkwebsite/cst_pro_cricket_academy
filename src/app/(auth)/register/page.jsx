"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import UserForm from "../../next_panel/users/UserForm";
import PublicRegisterForm from "./PublicRegisterForm";

function RegisterContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "public" ? "public" : "academy";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "public" || tabParam === "academy") {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  return (
    <main className="min-vh-100 bg-cream py-4 py-md-5">
      <div className="container" style={{ maxWidth: "1140px" }}>
        {/* Top Navigation */}
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4 pb-2">
          <Link
            href="/"
            className="text-secondary small d-inline-flex align-items-center fw-medium"
            style={{ textDecoration: "none" }}
          >
            <i className="bi bi-arrow-left me-1"></i> Back to Website
          </Link>

          <Link href="/" className="logo-badge">
            <img
              src="/images/website/logo.png"
              alt="ST Cricket Academy"
              style={{ height: "44px" }}
            />
          </Link>

          <div>
            <span className="text-secondary small me-2 d-none d-sm-inline">
              Already have an account?
            </span>
            <Link
              href={activeTab === "public" ? "/login?tab=public" : "/login?tab=academy"}
              className="btn btn-outline-dark btn-sm rounded-pill px-3 fw-semibold"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Hero Header Card */}
        <div
          className="card border-0 mb-4 overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, rgba(6, 47, 56, 0.98) 0%, rgba(10, 74, 85, 0.93) 100%), url('/images/website/hero-pattern.svg') center/cover",
            borderRadius: "22px",
            boxShadow: "var(--shadow)",
            color: "#ffffff",
          }}
        >
          <div className="card-body p-4 p-md-5 text-center text-md-start">
            <div className="row align-items-center g-4">
              <div className="col-md-8">
                <span
                  className="badge mb-2"
                  style={{
                    background: "rgba(0, 188, 212, 0.15)",
                    color: "var(--cyan)",
                    border: "1px solid var(--cyan)",
                    borderRadius: "50px",
                    padding: "0.35rem 0.9rem",
                    fontSize: "0.78rem",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                  }}
                >
                  {activeTab === "academy"
                    ? "Academy Enrolled User Registration"
                    : "General Public & Match Booker Registration"}
                </span>
                <h1
                  className="display-font mt-2 mb-2"
                  style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)" }}
                >
                  JOIN <span className="text-cyan">ST CRICKET ACADEMY</span>
                </h1>
                <p
                  className="mb-0"
                  style={{
                    color: "#cfd8e8",
                    fontSize: "0.98rem",
                    lineHeight: "1.6",
                    maxWidth: "680px",
                  }}
                >
                  {activeTab === "academy"
                    ? "Enter your assigned appointment or admission number to automatically load your player or staff profile details and create your portal login credentials."
                    : "Create a direct public account to book cricket grounds, view slot schedules, participate in open tournament matches, and manage your booking orders."}
                </p>
              </div>

              <div className="col-md-4 text-center d-none d-md-block">
                <img
                  src="/images/website/hero-batter.png"
                  alt="Cricket Batsman"
                  style={{
                    maxHeight: "150px",
                    width: "auto",
                    filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.35))",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* TAB SWITCHER: 1. ACADEMY USER  vs  2. PUBLIC USER */}
        {/* ============================================================ */}
        <div className="bg-white rounded-4 p-2 shadow-sm border mb-4">
          <div className="row g-2">
            {/* Tab 1: Academy User */}
            <div className="col-12 col-md-6">
              <button
                type="button"
                className={`btn w-100 py-3 px-3 rounded-3 text-start d-flex align-items-center justify-content-between transition-all ${
                  activeTab === "academy"
                    ? "btn-navy shadow"
                    : "btn-light border text-muted"
                }`}
                onClick={() => setActiveTab("academy")}
                style={{
                  transition: "all 0.25s ease",
                }}
              >
                <div className="d-flex align-items-center gap-3">
                  <div
                    className={`rounded-circle d-flex align-items-center justify-content-center ${
                      activeTab === "academy"
                        ? "bg-lime text-navy"
                        : "bg-white text-navy border"
                    }`}
                    style={{ width: "42px", height: "42px", fontSize: "1.2rem" }}
                  >
                    <i className="bi bi-shield-shaded"></i>
                  </div>
                  <div>
                    <div
                      className={`fw-bold ${
                        activeTab === "academy" ? "text-white" : "text-navy"
                      }`}
                    >
                      1. Academy User
                    </div>
                    <small
                      className={
                        activeTab === "academy" ? "text-white-50" : "text-muted"
                      }
                      style={{ fontSize: "0.78rem" }}
                    >
                      Players, coaches &amp; staff with appointment ID
                    </small>
                  </div>
                </div>
                {activeTab === "academy" && (
                  <span className="badge bg-lime text-navy rounded-pill px-2.5 py-1 small fw-bold">
                    Active
                  </span>
                )}
              </button>
            </div>

            {/* Tab 2: Public User */}
            <div className="col-12 col-md-6">
              <button
                type="button"
                className={`btn w-100 py-3 px-3 rounded-3 text-start d-flex align-items-center justify-content-between transition-all ${
                  activeTab === "public"
                    ? "btn-navy shadow"
                    : "btn-light border text-muted"
                }`}
                onClick={() => setActiveTab("public")}
                style={{
                  transition: "all 0.25s ease",
                }}
              >
                <div className="d-flex align-items-center gap-3">
                  <div
                    className={`rounded-circle d-flex align-items-center justify-content-center ${
                      activeTab === "public"
                        ? "bg-lime text-navy"
                        : "bg-white text-navy border"
                    }`}
                    style={{ width: "42px", height: "42px", fontSize: "1.2rem" }}
                  >
                    <i className="bi bi-person-fill-check"></i>
                  </div>
                  <div>
                    <div
                      className={`fw-bold ${
                        activeTab === "public" ? "text-white" : "text-navy"
                      }`}
                    >
                      2. Public User
                    </div>
                    <small
                      className={
                        activeTab === "public" ? "text-white-50" : "text-muted"
                      }
                      style={{ fontSize: "0.78rem" }}
                    >
                      General public, ground bookings &amp; visitors
                    </small>
                  </div>
                </div>
                {activeTab === "public" && (
                  <span className="badge bg-lime text-navy rounded-pill px-2.5 py-1 small fw-bold">
                    Active
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: ACADEMY USER REGISTRATION */}
        {/* ============================================================ */}
        {activeTab === "academy" && (
          <div>
            {/* 3 Step Guide Cards for Academy User */}
            <div className="row g-3 mb-4">
              <div className="col-md-4">
                <div
                  className="card border-0 h-100 p-3 shadow-sm rounded-4"
                  style={{
                    borderLeft: "4px solid var(--teal)",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                      style={{
                        width: "40px",
                        height: "40px",
                        background: "var(--navy)",
                        fontFamily: "var(--font-oswald), sans-serif",
                      }}
                    >
                      01
                    </div>
                    <div>
                      <h6 className="fw-bold mb-0 text-navy">Enter ID Number</h6>
                      <small className="text-muted">
                        Type your appointment or admission no.
                      </small>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-md-4">
                <div
                  className="card border-0 h-100 p-3 shadow-sm rounded-4"
                  style={{
                    borderLeft: "4px solid var(--cyan)",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                      style={{
                        width: "40px",
                        height: "40px",
                        background: "var(--navy)",
                        fontFamily: "var(--font-oswald), sans-serif",
                      }}
                    >
                      02
                    </div>
                    <div>
                      <h6 className="fw-bold mb-0 text-navy">Automatic Lookup</h6>
                      <small className="text-muted">
                        Profile details load instantly from records.
                      </small>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-md-4">
                <div
                  className="card border-0 h-100 p-3 shadow-sm rounded-4"
                  style={{
                    borderLeft: "4px solid var(--red)",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                      style={{
                        width: "40px",
                        height: "40px",
                        background: "var(--red)",
                        fontFamily: "var(--font-oswald), sans-serif",
                      }}
                    >
                      03
                    </div>
                    <div>
                      <h6 className="fw-bold mb-0 text-navy">Set Password</h6>
                      <small className="text-muted">
                        Choose password &amp; complete sign up.
                      </small>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Existing Academy UserForm (Super Admin role removed) */}
            <div className="row justify-content-center">
              <div className="col-12">
                <UserForm
                  id={null}
                  redirectPath="/login?tab=academy&registered=1"
                  isPublicRegister={true}
                  hideSuperAdmin={true}
                />
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: PUBLIC USER REGISTRATION */}
        {/* ============================================================ */}
        {activeTab === "public" && (
          <div>
            {/* 3 Step Guide Cards for Public User */}
            <div className="row g-3 mb-4">
              <div className="col-md-4">
                <div
                  className="card border-0 h-100 p-3 shadow-sm rounded-4"
                  style={{
                    borderLeft: "4px solid var(--teal)",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                      style={{
                        width: "40px",
                        height: "40px",
                        background: "var(--navy)",
                        fontFamily: "var(--font-oswald), sans-serif",
                      }}
                    >
                      01
                    </div>
                    <div>
                      <h6 className="fw-bold mb-0 text-navy">Enter Details</h6>
                      <small className="text-muted">
                        Full name, email &amp; mobile number.
                      </small>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-md-4">
                <div
                  className="card border-0 h-100 p-3 shadow-sm rounded-4"
                  style={{
                    borderLeft: "4px solid var(--cyan)",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                      style={{
                        width: "40px",
                        height: "40px",
                        background: "var(--navy)",
                        fontFamily: "var(--font-oswald), sans-serif",
                      }}
                    >
                      02
                    </div>
                    <div>
                      <h6 className="fw-bold mb-0 text-navy">Set Password</h6>
                      <small className="text-muted">
                        Create secure account password.
                      </small>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-md-4">
                <div
                  className="card border-0 h-100 p-3 shadow-sm rounded-4"
                  style={{
                    borderLeft: "4px solid var(--lime)",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                      style={{
                        width: "40px",
                        height: "40px",
                        background: "var(--navy)",
                        fontFamily: "var(--font-oswald), sans-serif",
                      }}
                    >
                      03
                    </div>
                    <div>
                      <h6 className="fw-bold mb-0 text-navy">Instant Access</h6>
                      <small className="text-muted">
                        Book grounds &amp; manage match orders.
                      </small>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Public User Registration Form calling api/public-auth/register */}
            <div className="row justify-content-center">
              <div className="col-12">
                <PublicRegisterForm onSuccessRedirect="/" />
              </div>
            </div>
          </div>
        )}

        {/* Help & Support Footer */}
        <div className="text-center mt-5 pt-3">
          <p className="text-secondary small mb-1">
            Need help with your registration? Contact our support team:
          </p>
          <p className="small mb-3">
            <a
              href="tel:+918285831503"
              className="text-navy fw-semibold me-3 text-decoration-none"
            >
              <i className="bi bi-telephone-fill text-red me-1"></i> +91 8285831503
            </a>
            <a
              href="mailto:chandankeshri100@gmail.com"
              className="text-navy fw-semibold text-decoration-none"
            >
              <i className="bi bi-envelope-fill text-red me-1"></i>{" "}
              chandankeshri100@gmail.com
            </a>
          </p>
          <div
            className="text-muted small"
            style={{ fontSize: "0.8rem", opacity: 0.8 }}
          >
            <i className="bi bi-shield-check text-teal me-1"></i>
            256-Bit SSL Encrypted Registration • CST Pro Cricket Academy
          </div>
        </div>
      </div>
    </main>
  );
}

export default function RegisterPage() {
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
      <RegisterContent />
    </Suspense>
  );
}
