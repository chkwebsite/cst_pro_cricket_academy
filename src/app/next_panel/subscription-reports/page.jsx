"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    BarChart3,
    RefreshCw,
    Shield,
    IndianRupee,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Clock,
    TrendingUp,
    Calendar,
    Building2,
    ArrowUpRight,
    Layers,
    DollarSign,
} from "lucide-react";

export default function SubscriptionReportsPage() {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadReports = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/subscription-reports");
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to load subscription reports");
            setReport(json.data || null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReports();
    }, []);

    const formatINR = (val) => {
        return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(val || 0);
    };

    const kpis = report?.kpis || {
        total_academies: 0,
        active_subscriptions: 0,
        grace_period_subscriptions: 0,
        expired_subscriptions: 0,
        suspended_subscriptions: 0,
        inactive_academies: 0,
        total_revenue: 0,
    };

    return (
        <div className="container-fluid py-2">
            {/* Header */}
            <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                    <div>
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <BarChart3 className="text-primary" size={26} />
                            <h1 className="h4 mb-0 fw-bold">SaaS Subscription Reports & Analytics</h1>
                        </div>
                        <p className="text-muted mb-0 small">
                            High-level executive metrics, upcoming expirations, active subscriptions, and revenue breakdown.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={loadReports}
                        className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                    >
                        <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh Analytics
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status"></div>
                    <p className="text-muted mt-2 small">Loading subscription metrics...</p>
                </div>
            ) : error ? (
                <div className="alert alert-danger rounded-3 shadow-sm">{error}</div>
            ) : (
                <>
                    {/* KPI Cards Row */}
                    <div className="row g-3 mb-4">
                        <div className="col-12 col-sm-6 col-xl-2">
                            <div className="p-3 bg-white rounded-4 shadow-sm border-0 h-100">
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <span className="text-muted small">Total Academies</span>
                                    <Building2 size={18} className="text-primary" />
                                </div>
                                <div className="h3 fw-bold text-dark mb-0">{kpis.total_academies}</div>
                                <div className="text-muted small mt-1">
                                    {kpis.inactive_academies} Manually Inactive
                                </div>
                            </div>
                        </div>

                        <div className="col-12 col-sm-6 col-xl-2">
                            <div className="p-3 bg-white rounded-4 shadow-sm border-0 h-100">
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <span className="text-muted small">Active Subscriptions</span>
                                    <CheckCircle2 size={18} className="text-success" />
                                </div>
                                <div className="h3 fw-bold text-success mb-0">{kpis.active_subscriptions}</div>
                                <div className="text-success small mt-1">Full operational access</div>
                            </div>
                        </div>

                        <div className="col-12 col-sm-6 col-xl-2">
                            <div className="p-3 bg-white rounded-4 shadow-sm border-0 h-100">
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <span className="text-muted small">Grace Period</span>
                                    <AlertTriangle size={18} className="text-warning" />
                                </div>
                                <div className="h3 fw-bold text-warning mb-0">{kpis.grace_period_subscriptions}</div>
                                <div className="text-warning-emphasis small mt-1">Using 5-day grace</div>
                            </div>
                        </div>

                        <div className="col-12 col-sm-6 col-xl-2">
                            <div className="p-3 bg-white rounded-4 shadow-sm border-0 h-100">
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <span className="text-muted small">Expired Beyond Grace</span>
                                    <XCircle size={18} className="text-danger" />
                                </div>
                                <div className="h3 fw-bold text-danger mb-0">{kpis.expired_subscriptions}</div>
                                <div className="text-danger small mt-1">Players in Read-Only</div>
                            </div>
                        </div>

                        <div className="col-12 col-sm-6 col-xl-2">
                            <div className="p-3 bg-white rounded-4 shadow-sm border-0 h-100">
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <span className="text-muted small">Suspended</span>
                                    <Clock size={18} className="text-secondary" />
                                </div>
                                <div className="h3 fw-bold text-secondary mb-0">{kpis.suspended_subscriptions}</div>
                                <div className="text-muted small mt-1">Manually suspended</div>
                            </div>
                        </div>

                        <div className="col-12 col-sm-6 col-xl-2">
                            <div className="p-3 bg-white rounded-4 shadow-sm border-0 h-100">
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <span className="text-muted small">Total Revenue</span>
                                    <IndianRupee size={18} className="text-success" />
                                </div>
                                <div className="h4 fw-bold text-success mb-0">{formatINR(kpis.total_revenue)}</div>
                                <div className="text-muted small mt-1">Lifetime collections</div>
                            </div>
                        </div>
                    </div>

                    {/* Upcoming Expiries & Plan Distribution */}
                    <div className="row g-4 mb-4">
                        {/* Upcoming Expiries Alert Table */}
                        <div className="col-12 col-lg-8">
                            <div className="card border-0 rounded-4 shadow-sm h-100">
                                <div className="card-header bg-white border-0 pt-4 px-4 pb-2 d-flex justify-content-between align-items-center">
                                    <div>
                                        <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                                            <AlertTriangle size={18} className="text-warning" /> Upcoming Expirations (Next 30 Days)
                                        </h5>
                                        <p className="text-muted small mb-0">Academies requiring renewal attention</p>
                                    </div>
                                    <span className="badge bg-light text-secondary border">
                                        {(report?.upcoming_expiries || []).length} Academy(s)
                                    </span>
                                </div>
                                <div className="card-body px-0 py-0">
                                    <div className="table-responsive">
                                        <table className="table table-hover align-middle mb-0 small">
                                            <thead className="table-light text-muted">
                                                <tr>
                                                    <th className="ps-4">Academy</th>
                                                    <th>Plan</th>
                                                    <th>Expiry Date</th>
                                                    <th>Grace End</th>
                                                    <th>Status</th>
                                                    <th className="text-end pe-4">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(report?.upcoming_expiries || []).length === 0 ? (
                                                    <tr>
                                                        <td colSpan="6" className="text-center py-4 text-muted">
                                                            No subscriptions expiring in the next 30 days.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    report.upcoming_expiries.map((item, idx) => (
                                                        <tr key={idx}>
                                                            <td className="ps-4">
                                                                <div className="fw-semibold text-dark">{item.academy_name}</div>
                                                                <div className="text-muted font-monospace" style={{ fontSize: "0.75rem" }}>
                                                                    {item.academy_code}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <span className="badge bg-light text-secondary border">
                                                                    {item.plan_name}
                                                                </span>
                                                            </td>
                                                            <td className="fw-bold text-danger">
                                                                {item.subscription_end_date}
                                                            </td>
                                                            <td>
                                                                {item.grace_end_date}
                                                            </td>
                                                            <td>
                                                                {item.status === "grace_period" ? (
                                                                    <span className="badge bg-warning text-dark">
                                                                        In Grace ({item.days_remaining}d left)
                                                                    </span>
                                                                ) : (
                                                                    <span className="badge bg-success-subtle text-success border border-success-subtle">
                                                                        {item.days_remaining} day{item.days_remaining === 1 ? "" : "s"} left
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="text-end pe-4">
                                                                <Link
                                                                    href="/next_panel/academy-subscriptions"
                                                                    className="btn btn-sm btn-outline-primary"
                                                                >
                                                                    Renew
                                                                </Link>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Plan Distribution */}
                        <div className="col-12 col-lg-4">
                            <div className="card border-0 rounded-4 shadow-sm h-100">
                                <div className="card-header bg-white border-0 pt-4 px-4 pb-2">
                                    <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                                        <Layers size={18} className="text-primary" /> Plan Distribution
                                    </h5>
                                    <p className="text-muted small mb-0">Active academy plan breakdown</p>
                                </div>
                                <div className="card-body px-4 py-3">
                                    <ul className="list-group list-group-flush">
                                        {(report?.plan_distribution || []).map((p, idx) => (
                                            <li key={idx} className="list-group-item d-flex justify-content-between align-items-center px-0 py-3">
                                                <div>
                                                    <div className="fw-semibold text-dark">{p.plan_name}</div>
                                                    <div className="text-muted small">Subscribed Academies</div>
                                                </div>
                                                <span className="badge bg-primary text-white rounded-pill px-3 py-2 fs-6">
                                                    {p.count}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Monthly Revenue Trend */}
                    <div className="card border-0 rounded-4 shadow-sm mb-4">
                        <div className="card-header bg-white border-0 pt-4 px-4 pb-2 d-flex justify-content-between align-items-center">
                            <div>
                                <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                                    <TrendingUp size={18} className="text-success" /> Monthly Subscription Collections
                                </h5>
                                <p className="text-muted small mb-0">Revenue collection history over recent months</p>
                            </div>
                        </div>
                        <div className="card-body px-4 py-3">
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0 small">
                                    <thead className="table-light text-muted">
                                        <tr>
                                            <th>Month</th>
                                            <th>Total Payments Received</th>
                                            <th>Total Revenue (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(report?.monthly_revenue || []).length === 0 ? (
                                            <tr>
                                                <td colSpan="3" className="text-center py-4 text-muted">
                                                    No monthly revenue records available.
                                                </td>
                                            </tr>
                                        ) : (
                                            report.monthly_revenue.map((m, idx) => (
                                                <tr key={idx}>
                                                    <td className="fw-semibold text-dark font-monospace">{m.month}</td>
                                                    <td>{m.count} Transaction(s)</td>
                                                    <td className="fw-bold text-success">{formatINR(m.revenue)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
