"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Calendar, Clock, RefreshCw, X, ShieldAlert, IndianRupee } from "lucide-react";
import { useUser } from "./UserContext";

export default function GracePeriodModal() {
    const { user } = useUser();
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        // Show on every login/session if user belongs to an academy currently in grace period
        if (user && user.is_grace_period && !user.isSuperAdmin) {
            setIsOpen(true);
        }
    }, [user]);

    if (!isOpen || !user || !user.is_grace_period) {
        return null;
    }

    const academyName = user.subscription?.academy_name || "Your Academy";
    const planName = user.plan_name || user.subscription?.plan_name || "SaaS Subscription Plan";
    const expiryDate = user.subscription_end_date || user.subscription?.subscription_end_date || "Recently Expired";
    const graceEndDate = user.grace_end_date || user.subscription?.grace_end_date || "Within 5 Days";
    const daysRemaining = user.grace_days_remaining || user.subscription?.grace_days_remaining || 1;

    return (
        <div
            className="modal show d-block"
            tabIndex="-1"
            role="dialog"
            aria-modal="true"
            style={{ backgroundColor: "rgba(0,0,0,0.65)", zIndex: 1060 }}
        >
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content rounded-4 border-0 shadow-lg overflow-hidden">
                    {/* Header with amber alert background */}
                    <div className="bg-warning text-dark p-4 position-relative">
                        <button
                            type="button"
                            className="btn-close position-absolute top-0 end-0 m-3"
                            onClick={() => setIsOpen(false)}
                            aria-label="Close"
                        ></button>
                        <div className="d-flex align-items-center gap-3">
                            <div className="p-3 bg-white text-warning rounded-circle shadow-sm">
                                <AlertTriangle size={32} />
                            </div>
                            <div>
                                <span className="badge bg-dark text-warning mb-1 px-2.5 py-1 text-uppercase fw-bold" style={{ fontSize: "0.7rem", letterSpacing: "0.5px" }}>
                                    Urgent Action Required
                                </span>
                                <h5 className="modal-title fw-bold mb-0 text-dark">
                                    Subscription Grace Period Active
                                </h5>
                            </div>
                        </div>
                    </div>

                    <div className="modal-body p-4">
                        <div className="alert alert-warning-subtle border border-warning-subtle text-dark p-3 rounded-3 mb-3 small">
                            <p className="mb-0 fw-medium">
                                Your academy subscription has expired. You are currently using the <strong>5-day grace period</strong> ({daysRemaining} day{daysRemaining === 1 ? "" : "s"} remaining).
                                Please renew your subscription to continue using the academy management system without interruption.
                            </p>
                        </div>

                        {/* Subscription Details Table */}
                        <div className="bg-light rounded-3 p-3 border mb-3">
                            <div className="row g-2 small">
                                <div className="col-5 text-muted">Academy Name:</div>
                                <div className="col-7 fw-bold text-dark">{academyName}</div>

                                <div className="col-5 text-muted">Current Plan:</div>
                                <div className="col-7 fw-semibold text-primary">{planName}</div>

                                <div className="col-5 text-muted">Expiry Date:</div>
                                <div className="col-7 fw-bold text-danger">{expiryDate}</div>

                                <div className="col-5 text-muted">Grace End Date:</div>
                                <div className="col-7 fw-bold text-warning-emphasis">{graceEndDate}</div>

                                <div className="col-5 text-muted">Remaining Days:</div>
                                <div className="col-7">
                                    <span className="badge bg-warning text-dark px-2.5 py-1 rounded-pill fw-bold">
                                        <Clock size={12} className="me-1" />
                                        {daysRemaining} Day{daysRemaining === 1 ? "" : "s"} Remaining
                                    </span>
                                </div>
                            </div>
                        </div>

                        <p className="text-muted small mb-0" style={{ fontSize: "0.8rem" }}>
                            * After the grace period ends, administrative access for Academy Admins, Branch Admins, and staff will be automatically locked, and player accounts will be restricted to Read-Only mode.
                        </p>
                    </div>

                    <div className="modal-footer border-top px-4 py-3 bg-light d-flex justify-content-between">
                        <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => setIsOpen(false)}
                        >
                            Remind Me Later
                        </button>

                        {user.isAcademyAdmin || user.isSuperAdmin ? (
                            <Link
                                href="/next_panel/academy-subscriptions"
                                className="btn btn-warning fw-bold text-dark d-flex align-items-center gap-2"
                                onClick={() => setIsOpen(false)}
                            >
                                <RefreshCw size={16} /> Renew Subscription Now
                            </Link>
                        ) : (
                            <div className="text-secondary small fw-medium">
                                Contact to Academy Administrator to renew
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
