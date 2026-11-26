"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Layers, ArrowLeft, CheckCircle2, AlertCircle, Save, Trash2 } from "lucide-react";

export default function EditSubscriptionPlanPage({ params }) {
    const resolvedParams = use(params);
    const id = resolvedParams.id;
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    const [formData, setFormData] = useState({
        plan_name: "",
        plan_code: "",
        duration_months: 1,
        price: "",
        description: "",
        features: "",
        status: 1,
    });

    useEffect(() => {
        async function fetchPlan() {
            setLoading(true);
            try {
                const res = await fetch(`/api/subscription-plans/${id}`);
                const json = await res.json();
                if (!res.ok) throw new Error(json.message || "Failed to load plan");

                const plan = json.data;
                setFormData({
                    plan_name: plan.plan_name,
                    plan_code: plan.plan_code,
                    duration_months: plan.duration_months,
                    price: plan.price,
                    description: plan.description || "",
                    features: Array.isArray(plan.features) ? plan.features.join("\n") : "",
                    status: plan.status,
                });
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        if (id) fetchPlan();
    }, [id]);

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

            const res = await fetch(`/api/subscription-plans/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to update subscription plan");

            setSuccessMsg("Subscription plan updated successfully!");
            setTimeout(() => {
                router.push("/next_panel/subscription-plans");
            }, 800);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="container-fluid py-5 text-center">
                <div className="spinner-border text-primary" role="status"></div>
                <p className="text-muted small mt-2">Loading plan details...</p>
            </div>
        );
    }

    return (
        <div className="container-fluid py-2">
            <div className="d-flex align-items-center justify-content-between mb-3">
                <Link
                    href="/next_panel/subscription-plans"
                    className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1.5"
                >
                    <ArrowLeft size={14} /> Back to Subscription Plans
                </Link>
            </div>

            <div className="card border-0 rounded-4 shadow-sm bg-white p-4 mb-4">
                <div className="d-flex align-items-center gap-2 mb-1">
                    <Layers className="text-primary" size={26} />
                    <h1 className="h4 mb-0 fw-bold">Edit Subscription Plan</h1>
                </div>
                <p className="text-muted small mb-4">
                    Modify subscription pricing, duration, feature sets, and active visibility.
                </p>

                {successMsg && (
                    <div className="alert alert-success alert-dismissible fade show rounded-3 small">
                        <CheckCircle2 size={16} className="me-1 inline" /> {successMsg}
                    </div>
                )}

                {error && (
                    <div className="alert alert-danger alert-dismissible fade show rounded-3 small">
                        <AlertCircle size={16} className="me-1 inline" /> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="row g-3">
                        <div className="col-12 col-md-6">
                            <label className="form-label fw-semibold small">
                                Plan Name <span className="text-danger">*</span>
                            </label>
                            <input
                                type="text"
                                className="form-control"
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
                                value={formData.plan_code}
                                onChange={(e) => setFormData({ ...formData, plan_code: e.target.value })}
                                required
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
                        </div>

                        <div className="col-12 col-md-4">
                            <label className="form-label fw-semibold small">
                                Subscription Price (₹ INR) <span className="text-danger">*</span>
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="form-control"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                required
                            />
                        </div>

                        <div className="col-12 col-md-4">
                            <label className="form-label fw-semibold small">Plan Status</label>
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
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            ></textarea>
                        </div>

                        <div className="col-12">
                            <label className="form-label fw-semibold small">
                                Plan Features (One feature per line)
                            </label>
                            <textarea
                                className="form-control font-monospace"
                                rows="6"
                                value={formData.features}
                                onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                            ></textarea>
                        </div>

                        <div className="col-12 pt-3 border-top d-flex gap-2 justify-content-end">
                            <Link href="/next_panel/subscription-plans" className="btn btn-outline-secondary">
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                className="btn btn-primary d-inline-flex align-items-center gap-1.5"
                                disabled={saving}
                            >
                                <Save size={15} />
                                {saving ? "Saving Changes..." : "Save Plan Changes"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
