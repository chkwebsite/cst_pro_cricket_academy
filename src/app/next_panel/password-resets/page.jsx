"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Shield,
    Key,
    RefreshCw,
    Copy,
    Check,
    Clock,
    User,
    Phone,
    Mail,
    Building2,
    Trash2,
    Search,
    AlertCircle,
    CheckCircle2,
} from "lucide-react";

export default function PasswordResetsPage() {
    const [resets, setResets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [copiedId, setCopiedId] = useState(null);
    const [adminInfo, setAdminInfo] = useState(null);
    const [now, setNow] = useState(Date.now());

    // Update current timestamp every second to render live countdown timers
    useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const fetchResets = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/password-resets", { cache: "no-store" });
            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || "Failed to load password reset codes.");
            }

            const fetchTime = Date.now();
            const mapped = (data.data || []).map((r) => {
                const sec = Number(r.seconds_remaining);
                const expiryTs = sec > 0
                    ? fetchTime + sec * 1000
                    : r.expires_at_iso
                    ? new Date(r.expires_at_iso).getTime()
                    : new Date(String(r.expires_at).replace(" ", "T") + "Z").getTime();
                return {
                    ...r,
                    localExpiryTs: expiryTs,
                };
            });

            setResets(mapped);
            setAdminInfo({
                role: data.admin_role,
                academyId: data.admin_academy_id,
                branchId: data.admin_branch_id,
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchResets();
        // Auto-refresh every 12 seconds
        const poll = setInterval(fetchResets, 12000);
        return () => clearInterval(poll);
    }, [fetchResets]);

    const handleCopyCode = async (id, code) => {
        try {
            await navigator.clipboard.writeText(code);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (e) {
            // Fallback
            const el = document.createElement("textarea");
            el.value = code;
            document.body.appendChild(el);
            el.select();
            document.execCommand("copy");
            document.body.removeChild(el);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        }
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Are you sure you want to revoke/delete the reset code for "${name}"?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/password-resets?id=${id}`, {
                method: "DELETE",
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || "Failed to delete reset code.");
            }

            setNotice(`Verification code revoked successfully.`);
            setTimeout(() => setNotice(null), 3500);
            setResets((prev) => prev.filter((r) => r.id !== id));
        } catch (err) {
            alert(err.message);
        }
    };

    // Calculate remaining seconds for a reset record
    const getSecondsRemaining = (item) => {
        if (!item) return 0;
        if (typeof item === "object") {
            if (item.localExpiryTs) {
                return Math.max(0, Math.ceil((item.localExpiryTs - now) / 1000));
            }
            if (item.seconds_remaining != null) {
                return Math.max(0, Number(item.seconds_remaining));
            }
        }
        const str = typeof item === "string" ? item : (item.expires_at_iso || item.expires_at || "");
        if (!str) return 0;
        const expiry = str.endsWith("Z")
            ? new Date(str).getTime()
            : new Date(String(str).replace(" ", "T") + "Z").getTime();
        return Math.max(0, Math.floor((expiry - now) / 1000));
    };

    const formatRemaining = (seconds) => {
        if (seconds <= 0) return "Expired";
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? "0" : ""}${s}`;
    };

    // Filter resets by search term
    const filteredResets = resets.filter((r) => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        const fullName = `${r.first_name || ""} ${r.last_name || ""}`.toLowerCase();
        const appNo = String(r.appointment_no || "").toLowerCase();
        const email = String(r.email || "").toLowerCase();
        const phone = String(r.phone || "").toLowerCase();
        const code = String(r.otp_code || "");
        return (
            fullName.includes(q) ||
            appNo.includes(q) ||
            email.includes(q) ||
            phone.includes(q) ||
            code.includes(q)
        );
    });

    return (
        <div className="container-fluid py-3 px-3 px-md-4">
            {/* Top Header Card */}
            <div className="bg-white rounded-4 shadow-sm p-4 mb-4 border">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div className="d-flex align-items-center gap-3">
                        <div
                            className="rounded-3 d-inline-flex align-items-center justify-content-center p-3 text-white shadow-sm"
                            style={{ background: "linear-gradient(135deg, #0a2540 0%, #1e40af 100%)" }}
                        >
                            <Key size={26} />
                        </div>
                        <div>
                            <div className="d-flex align-items-center gap-2">
                                <h3 className="mb-0 fw-bold text-dark">Password Reset Codes</h3>
                                <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1 rounded-pill small">
                                    Live (10-Min Window)
                                </span>
                            </div>
                            <p className="text-muted small mb-0 mt-1">
                                Active 6-digit OTP codes requested by Academy Users (Players, Coaches, Staff). Codes hard-delete automatically after 10 minutes.
                            </p>
                        </div>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        <button
                            type="button"
                            className="btn btn-outline-secondary d-flex align-items-center gap-2 px-3 py-2 rounded-3 shadow-sm"
                            onClick={fetchResets}
                            disabled={loading}
                        >
                            <RefreshCw size={16} className={loading ? "spin" : ""} />
                            <span>{loading ? "Refreshing..." : "Refresh Codes"}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Notice Alert */}
            {notice && (
                <div className="alert alert-success d-flex align-items-center py-2 px-3 mb-4 rounded-3 shadow-sm">
                    <CheckCircle2 size={18} className="me-2 text-success flex-shrink-0" />
                    <div>{notice}</div>
                </div>
            )}

            {/* Error Alert */}
            {error && (
                <div className="alert alert-danger d-flex align-items-center py-2 px-3 mb-4 rounded-3 shadow-sm">
                    <AlertCircle size={18} className="me-2 text-danger flex-shrink-0" />
                    <div>{error}</div>
                </div>
            )}

            {/* Stats Cards */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-xl-4">
                    <div className="card border-0 shadow-sm rounded-4 h-100 p-3 bg-white border-start border-4 border-primary">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <div className="text-muted small fw-semibold">Active Reset Requests</div>
                                <div className="fs-3 fw-bold text-dark mt-1">{filteredResets.length}</div>
                            </div>
                            <div className="p-3 bg-primary-subtle text-primary rounded-3">
                                <Key size={24} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-4">
                    <div className="card border-0 shadow-sm rounded-4 h-100 p-3 bg-white border-start border-4 border-warning">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <div className="text-muted small fw-semibold">Expiring in &lt; 3 Mins</div>
                                <div className="fs-3 fw-bold text-dark mt-1">
                                    {
                                        filteredResets.filter((r) => {
                                            const sec = getSecondsRemaining(r);
                                            return sec > 0 && sec < 180;
                                        }).length
                                    }
                                </div>
                            </div>
                            <div className="p-3 bg-warning-subtle text-warning rounded-3">
                                <Clock size={24} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-4">
                    <div className="card border-0 shadow-sm rounded-4 h-100 p-3 bg-white border-start border-4 border-info">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <div className="text-muted small fw-semibold">Admin Access Scope</div>
                                <div className="fs-6 fw-bold text-dark mt-2">
                                    {adminInfo?.role === "SUPER_ADMIN" && "Super Admin (All Academies)"}
                                    {adminInfo?.role === "ACADEMY_ADMIN" && "Academy Admin"}
                                    {adminInfo?.role === "BRANCH_ADMIN" && "Branch Admin (Assigned Branch)"}
                                    {!adminInfo?.role && "Admin Portal"}
                                </div>
                            </div>
                            <div className="p-3 bg-info-subtle text-info rounded-3">
                                <Shield size={24} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Search Bar */}
            <div className="card border-0 shadow-sm rounded-4 mb-4 bg-white p-3">
                <div className="row g-2 align-items-center">
                    <div className="col-12 col-md-6 col-lg-5">
                        <div className="input-group">
                            <span className="input-group-text bg-light border-end-0">
                                <Search size={16} className="text-muted" />
                            </span>
                            <input
                                type="text"
                                className="form-control border-start-0 ps-0 bg-light"
                                placeholder="Search by name, appointment no, phone, or OTP code..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    {searchTerm && (
                        <div className="col-auto">
                            <button
                                type="button"
                                className="btn btn-sm btn-light border"
                                onClick={() => setSearchTerm("")}
                            >
                                Clear Search
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Active Resets Table Card */}
            <div className="card border-0 shadow-sm rounded-4 bg-white overflow-hidden">
                <div className="card-header bg-white py-3 px-4 border-bottom d-flex justify-content-between align-items-center">
                    <h5 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                        <span>Active Reset Verification Codes</span>
                        <span className="badge bg-secondary rounded-pill fs-7">{filteredResets.length}</span>
                    </h5>
                    <span className="text-muted small">Auto-refreshes every 12 seconds</span>
                </div>

                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light text-muted small text-uppercase">
                            <tr>
                                <th style={{ minWidth: "150px" }} className="ps-4">6-Digit Code</th>
                                <th style={{ minWidth: "220px" }}>User Details</th>
                                <th style={{ minWidth: "160px" }}>Contact Info</th>
                                <th style={{ minWidth: "180px" }}>Academy &amp; Branch</th>
                                <th style={{ minWidth: "140px" }}>Time Remaining</th>
                                <th style={{ minWidth: "110px" }} className="text-end pe-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && resets.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-5">
                                        <div className="spinner-border text-primary" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                        <p className="text-muted small mt-2 mb-0">Checking for active password reset requests...</p>
                                    </td>
                                </tr>
                            ) : filteredResets.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-5">
                                        <div className="py-4">
                                            <Shield size={48} className="text-muted opacity-50 mb-3" />
                                            <h6 className="fw-semibold text-secondary mb-1">No Active Reset Requests</h6>
                                            <p className="text-muted small mb-0">
                                                When an Academy User clicks &quot;Forgot password?&quot; on the login page, their 6-digit code will show up here instantly.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredResets.map((r) => {
                                    const secRemaining = getSecondsRemaining(r);
                                    const isUrgent = secRemaining < 180;
                                    const isCopied = copiedId === r.id;
                                    const fullName = `${r.first_name || ""} ${r.last_name || ""}`.trim() || "Academy User";

                                    return (
                                        <tr key={r.id}>
                                            {/* 6-Digit Code Column */}
                                            <td className="ps-4">
                                                <div className="d-flex align-items-center gap-2">
                                                    <div
                                                        className="px-3 py-2 rounded-3 fw-bold font-monospace text-center fs-5 text-white shadow-sm"
                                                        style={{
                                                            background: "linear-gradient(135deg, #0a2540 0%, #1e3a8a 100%)",
                                                            letterSpacing: "3px",
                                                            minWidth: "110px",
                                                        }}
                                                    >
                                                        {r.otp_code}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className={`btn btn-sm ${isCopied ? "btn-success" : "btn-outline-primary"} d-flex align-items-center gap-1 px-2 py-2 rounded-3 shadow-sm`}
                                                        title="Copy OTP to clipboard"
                                                        onClick={() => handleCopyCode(r.id, r.otp_code)}
                                                    >
                                                        {isCopied ? <Check size={14} /> : <Copy size={14} />}
                                                        <span style={{ fontSize: "0.78rem" }}>{isCopied ? "Copied" : "Copy"}</span>
                                                    </button>
                                                </div>
                                            </td>

                                            {/* User Details */}
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    <div
                                                        className="rounded-circle d-flex align-items-center justify-content-center text-primary bg-primary-subtle fw-bold"
                                                        style={{ width: "36px", height: "36px", fontSize: "0.85rem" }}
                                                    >
                                                        {fullName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="fw-bold text-dark">{fullName}</div>
                                                        <div className="text-muted small">
                                                            Appt No: <span className="fw-semibold text-primary">{r.appointment_no || "N/A"}</span>
                                                        </div>
                                                        {r.user_type && (
                                                            <span className="badge bg-light text-secondary border mt-1" style={{ fontSize: "0.72rem" }}>
                                                                {r.user_type}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Contact Info */}
                                            <td>
                                                <div className="small">
                                                    {r.phone && (
                                                        <div className="d-flex align-items-center gap-1 text-dark mb-1">
                                                            <Phone size={13} className="text-muted flex-shrink-0" />
                                                            <span>{r.phone}</span>
                                                        </div>
                                                    )}
                                                    {r.email && (
                                                        <div className="d-flex align-items-center gap-1 text-muted text-truncate" style={{ maxWidth: "200px" }}>
                                                            <Mail size={13} className="text-muted flex-shrink-0" />
                                                            <span>{r.email}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Academy & Branch */}
                                            <td>
                                                <div className="small">
                                                    <div className="fw-semibold text-dark d-flex align-items-center gap-1">
                                                        <Building2 size={13} className="text-muted flex-shrink-0" />
                                                        <span>{r.academy_name || "CST Pro Cricket Academy"}</span>
                                                    </div>
                                                    <div className="text-muted ms-3">
                                                        Branch: <span className="fw-medium text-dark">{r.branch_name || "Main Branch"}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Time Remaining */}
                                            <td>
                                                <div className="d-inline-flex align-items-center gap-1">
                                                    <span
                                                        className={`badge px-2 py-1 rounded-pill d-flex align-items-center gap-1 ${
                                                            isUrgent
                                                                ? "bg-danger-subtle text-danger border border-danger-subtle"
                                                                : "bg-success-subtle text-success border border-success-subtle"
                                                        }`}
                                                        style={{ fontSize: "0.85rem", fontVariantNumeric: "tabular-nums" }}
                                                    >
                                                        <Clock size={13} />
                                                        <span>{formatRemaining(secRemaining)}</span>
                                                    </span>
                                                </div>
                                                <div className="text-muted mt-1" style={{ fontSize: "0.72rem" }}>
                                                    Requested: {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                </div>
                                            </td>

                                            {/* Actions */}
                                            <td className="text-end pe-4">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1 rounded-3 px-2 py-1"
                                                    title="Revoke / Delete Code"
                                                    onClick={() => handleDelete(r.id, fullName)}
                                                >
                                                    <Trash2 size={14} />
                                                    <span style={{ fontSize: "0.78rem" }}>Revoke</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
