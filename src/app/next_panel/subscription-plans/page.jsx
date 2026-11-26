"use client";

import { useEffect, useState } from "react";
import {
    Layers,
    Plus,
    Edit2,
    Trash2,
    CheckCircle2,
    XCircle,
    Calendar,
    IndianRupee,
    ShieldCheck,
    AlertCircle,
    RefreshCw,
} from "lucide-react";

export default function SubscriptionPlansPage() {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [saving, setSaving] = useState(false);

    // Form fields
    const [formData, setFormData] = useState({
        plan_name: "",
        plan_code: "",
        duration_months: 1,
        price: "",
        description: "",
        features: "",
        status: 1,
    });

    const loadPlans = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/subscription-plans");
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to load plans");
            setPlans(json.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPlans();
    }, []);

    const openCreateModal = () => {
        setEditingPlan(null);
        setFormData({
            plan_name: "",
            plan_code: "",
            duration_months: 1,
            price: "",
            description: "",
            features: "Full Player Management\nBranch & Batch Management\nAttendance Tracking\nFee Status Matrix\nGround Bookings",
            status: 1,
        });
        setShowModal(true);
    };

    const openEditModal = (plan) => {
        setEditingPlan(plan);
        setFormData({
            plan_name: plan.plan_name,
            plan_code: plan.plan_code,
            duration_months: plan.duration_months,
            price: plan.price,
            description: plan.description || "",
            features: Array.isArray(plan.features) ? plan.features.join("\n") : "",
            status: plan.status,
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccessMsg(null);

        try {
            const featuresArray = formData.features
                .split("\n")
                .map((f) => f.trim())
                .filter(Boolean);

            const payload = {
                plan_name: formData.plan_name.trim(),
                plan_code: formData.plan_code.trim(),
                duration_months: Number(formData.duration_months),
                price: Number(formData.price),
                description: formData.description.trim(),
                features: featuresArray,
                status: Number(formData.status),
            };

            const url = editingPlan
                ? `/api/subscription-plans/${editingPlan.id}`
                : "/api/subscription-plans";
            const method = editingPlan ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to save plan");

            setSuccessMsg(editingPlan ? "Plan updated successfully!" : "Plan created successfully!");
            setShowModal(false);
            loadPlans();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (plan) => {
        if (!confirm(`Are you sure you want to delete plan "${plan.plan_name}"?`)) return;
        setError(null);
        setSuccessMsg(null);

        try {
            const res = await fetch(`/api/subscription-plans/${plan.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to delete plan");
            setSuccessMsg(`Plan "${plan.plan_name}" deleted.`);
            loadPlans();
        } catch (err) {
            setError(err.message);
        }
    };

    const formatINR = (val) => {
        return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(val || 0);
    };

    return (
        <div className="container-fluid py-2">
            {/* Page Header */}
            <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                    <div>
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <Layers className="text-primary" size={26} />
                            <h1 className="h4 mb-0 fw-bold">SaaS Subscription Plans</h1>
                        </div>
                        <p className="text-muted mb-0 small">
                            Configure flexible academy subscription tiers, dynamic pricing, durations, and features.
                        </p>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <button
                            type="button"
                            onClick={loadPlans}
                            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                            title="Refresh plans"
                        >
                            <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
                        </button>
                        <button
                            type="button"
                            onClick={openCreateModal}
                            className="btn btn-primary d-flex align-items-center gap-2"
                        >
                            <Plus size={16} /> Create New Plan
                        </button>
                    </div>
                </div>
            </div>

            {/* Alerts */}
            {successMsg && (
                <div className="alert alert-success alert-dismissible fade show rounded-3 shadow-sm" role="alert">
                    <div className="d-flex align-items-center gap-2">
                        <CheckCircle2 size={18} />
                        <span>{successMsg}</span>
                    </div>
                    <button type="button" className="btn-close" onClick={() => setSuccessMsg(null)}></button>
                </div>
            )}

            {error && (
                <div className="alert alert-danger alert-dismissible fade show rounded-3 shadow-sm" role="alert">
                    <div className="d-flex align-items-center gap-2">
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                    <button type="button" className="btn-close" onClick={() => setError(null)}></button>
                </div>
            )}

            {/* Plans Grid */}
            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading plans...</span>
                    </div>
                    <p className="text-muted mt-2 small">Loading subscription plans...</p>
                </div>
            ) : plans.length === 0 ? (
                <div className="bg-white rounded-4 shadow-sm p-5 text-center">
                    <Layers size={48} className="text-muted mb-3" />
                    <h5 className="fw-semibold">No Subscription Plans Found</h5>
                    <p className="text-muted small">Get started by creating your first academy subscription plan.</p>
                    <button type="button" onClick={openCreateModal} className="btn btn-primary mt-2">
                        <Plus size={16} className="me-1" /> Create Plan
                    </button>
                </div>
            ) : (
                <div className="row g-4">
                    {plans.map((plan) => (
                        <div key={plan.id} className="col-12 col-md-6 col-xl-3">
                            <div className="card h-100 border-0 rounded-4 shadow-sm hover-shadow transition">
                                <div className="card-header bg-white border-0 pt-4 px-4 pb-0 d-flex justify-content-between align-items-start">
                                    <div>
                                        <span className={`badge px-2.5 py-1.5 rounded-pill ${plan.status === 1 ? "bg-success-subtle text-success border border-success-subtle" : "bg-secondary-subtle text-secondary"}`}>
                                            {plan.status === 1 ? "Active" : "Inactive"}
                                        </span>
                                        <h5 className="fw-bold mt-2 mb-0 text-dark">{plan.plan_name}</h5>
                                        <span className="text-muted font-monospace" style={{ fontSize: "0.75rem" }}>
                                            {plan.plan_code}
                                        </span>
                                    </div>
                                    <div className="d-flex align-items-center gap-1">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-secondary p-1.5 rounded-2"
                                            onClick={() => openEditModal(plan)}
                                            title="Edit Plan"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-danger p-1.5 rounded-2"
                                            onClick={() => handleDelete(plan)}
                                            title="Delete Plan"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="card-body px-4 pt-3 pb-4 d-flex flex-column">
                                    {/* Price & Duration */}
                                    <div className="p-3 rounded-3 bg-light border mb-3">
                                        <div className="d-flex align-items-baseline gap-1">
                                            <span className="h3 fw-bold text-primary mb-0">
                                                {formatINR(plan.price)}
                                            </span>
                                            <span className="text-muted small">
                                                / {plan.duration_months} mo{plan.duration_months > 1 ? "s" : ""}
                                            </span>
                                        </div>
                                        <div className="text-muted d-flex align-items-center gap-1 mt-1" style={{ fontSize: "0.8rem" }}>
                                            <Calendar size={13} />
                                            <span>Duration: {plan.duration_months} Month{plan.duration_months > 1 ? "s" : ""}</span>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    {plan.description && (
                                        <p className="text-muted small mb-3" style={{ minHeight: "2.5rem" }}>
                                            {plan.description}
                                        </p>
                                    )}

                                    {/* Features List */}
                                    <div className="mt-auto">
                                        <h6 className="fw-semibold text-dark small mb-2 d-flex align-items-center gap-1">
                                            <ShieldCheck size={14} className="text-success" /> Features Included:
                                        </h6>
                                        <ul className="list-unstyled mb-0" style={{ fontSize: "0.825rem" }}>
                                            {(plan.features || []).slice(0, 6).map((feat, idx) => (
                                                <li key={idx} className="d-flex align-items-start gap-2 mb-1.5 text-secondary">
                                                    <CheckCircle2 size={14} className="text-success flex-shrink-0 mt-0.5" />
                                                    <span>{feat}</span>
                                                </li>
                                            ))}
                                            {(plan.features || []).length > 6 && (
                                                <li className="text-muted fst-italic" style={{ fontSize: "0.75rem" }}>
                                                    + {(plan.features || []).length - 6} more features
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal: Create / Edit Plan */}
            {showModal && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content rounded-4 border-0 shadow">
                            <div className="modal-header border-bottom px-4 pt-4 pb-3">
                                <h5 className="modal-title fw-bold">
                                    {editingPlan ? "Edit Subscription Plan" : "Create New Subscription Plan"}
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setShowModal(false)}
                                    disabled={saving}
                                ></button>
                            </div>

                            <form onSubmit={handleSubmit}>
                                <div className="modal-body px-4 py-3">
                                    <div className="row g-3">
                                        <div className="col-12 col-md-6">
                                            <label className="form-label fw-semibold small">
                                                Plan Name <span className="text-danger">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="e.g. Monthly Plan, Yearly Pro"
                                                value={formData.plan_name}
                                                onChange={(e) => setFormData({ ...formData, plan_name: e.target.value })}
                                                required
                                            />
                                        </div>

                                        <div className="col-12 col-md-6">
                                            <label className="form-label fw-semibold small">
                                                Plan Code
                                            </label>
                                            <input
                                                type="text"
                                                className="form-control font-monospace"
                                                placeholder="e.g. PLAN_MONTHLY (auto-generated if blank)"
                                                value={formData.plan_code}
                                                onChange={(e) => setFormData({ ...formData, plan_code: e.target.value })}
                                            />
                                        </div>

                                        <div className="col-12 col-md-4">
                                            <label className="form-label fw-semibold small">
                                                Duration (Months) <span className="text-danger">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="60"
                                                className="form-control"
                                                value={formData.duration_months}
                                                onChange={(e) => setFormData({ ...formData, duration_months: e.target.value })}
                                                required
                                            />
                                            <small className="text-muted" style={{ fontSize: "0.75rem" }}>
                                                1 = Monthly, 3 = Quarterly, 6 = Half-Yearly, 12 = Yearly
                                            </small>
                                        </div>

                                        <div className="col-12 col-md-4">
                                            <label className="form-label fw-semibold small">
                                                Price (₹ INR) <span className="text-danger">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                className="form-control"
                                                placeholder="e.g. 2999"
                                                value={formData.price}
                                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                                required
                                            />
                                        </div>

                                        <div className="col-12 col-md-4">
                                            <label className="form-label fw-semibold small">Status</label>
                                            <select
                                                className="form-select"
                                                value={formData.status}
                                                onChange={(e) => setFormData({ ...formData, status: Number(e.target.value) })}
                                            >
                                                <option value={1}>Active</option>
                                                <option value={0}>Inactive</option>
                                            </select>
                                        </div>

                                        <div className="col-12">
                                            <label className="form-label fw-semibold small">Description</label>
                                            <textarea
                                                className="form-control"
                                                rows="2"
                                                placeholder="Brief overview of who this plan is suitable for..."
                                                value={formData.description}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            ></textarea>
                                        </div>

                                        <div className="col-12">
                                            <label className="form-label fw-semibold small">
                                                Features Included (One feature per line)
                                            </label>
                                            <textarea
                                                className="form-control font-monospace"
                                                rows="5"
                                                placeholder="Full Player Management&#10;Branch & Batch Management&#10;Player Attendance & Performance&#10;Fee Status Matrix&#10;5-Day Grace Period"
                                                value={formData.features}
                                                onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                                            ></textarea>
                                        </div>
                                    </div>
                                </div>

                                <div className="modal-footer border-top px-4 py-3">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        onClick={() => setShowModal(false)}
                                        disabled={saving}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary d-flex align-items-center gap-2"
                                        disabled={saving}
                                    >
                                        {saving ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm" role="status"></span>
                                                Saving...
                                            </>
                                        ) : editingPlan ? (
                                            "Update Plan"
                                        ) : (
                                            "Create Plan"
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
