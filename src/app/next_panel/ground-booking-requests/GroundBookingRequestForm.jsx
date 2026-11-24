"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormError, RequiredLabel } from "@/app/components/form";
import {
    AlertCircle,
    ArrowLeft,
    Calendar,
    Check,
    Clock,
    FileText,
    Mail,
    Phone,
    Save,
    Trees,
    User,
    Users,
} from "lucide-react";
import {
    BOOKING_PURPOSES,
    REQUEST_STATUSES,
    toDateInput,
} from "./bookingRequestUtils";

export default function GroundBookingRequestForm({
    initialData = null,
    isEdit = false,
    requestId = null,
}) {
    const router = useRouter();

    const [formData, setFormData] = useState({
        customer_name: initialData?.customer_name || "",
        mobile: initialData?.mobile || "",
        email: initialData?.email || "",
        ground_id: initialData?.ground_id || "",
        booking_date: toDateInput(initialData?.booking_date) || "",
        start_time: initialData?.start_time ? String(initialData.start_time).slice(0, 5) : "06:00",
        end_time: initialData?.end_time ? String(initialData.end_time).slice(0, 5) : "10:00",
        booking_purpose: initialData?.booking_purpose || "Practice Session",
        number_of_players: initialData?.number_of_players || "",
        special_requirements: initialData?.special_requirements || "",
        request_status: initialData?.request_status || "Pending",
        admin_remarks: initialData?.admin_remarks || "",
    });

    const [grounds, setGrounds] = useState([]);
    const [loadingGrounds, setLoadingGrounds] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});

    const clearError = (name) => {
        if (fieldErrors[name]) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }
    };

    const validateField = (name, value) => {
        switch (name) {
            case "customer_name":
                return !value?.trim() ? "Customer name is required." : "";
            case "mobile":
                return !value?.trim()
                    ? "Mobile number is required."
                    : value.trim().length < 10
                    ? "Please enter a valid 10-digit mobile number."
                    : "";
            case "email":
                return value && !/^\S+@\S+\.\S+$/.test(value)
                    ? "Please enter a valid email address."
                    : "";
            case "ground_id":
                return !value ? "Please select a ground." : "";
            case "booking_date":
                return !value ? "Booking date is required." : "";
            case "start_time":
                return !value ? "Start time is required." : "";
            case "end_time":
                if (!value) return "End time is required.";
                if (formData.start_time && value <= formData.start_time)
                    return "End time must be after start time.";
                return "";
            case "booking_purpose":
                return !value ? "Please select a booking purpose." : "";
            case "number_of_players":
                if (value !== "" && value != null) {
                    const num = Number(value);
                    if (!Number.isInteger(num) || num < 1) {
                        return "Number of players must be a positive integer.";
                    }
                }
                return "";
            default:
                return "";
        }
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        const err = validateField(name, value);
        if (err) {
            setFieldErrors((prev) => ({ ...prev, [name]: err }));
        }
    };

    const validateAll = () => {
        const errs = {};
        const fieldsToValidate = [
            "customer_name",
            "mobile",
            "email",
            "ground_id",
            "booking_date",
            "start_time",
            "end_time",
            "booking_purpose",
            "number_of_players",
        ];

        fieldsToValidate.forEach((f) => {
            const err = validateField(f, formData[f]);
            if (err) errs[f] = err;
        });

        setFieldErrors(errs);

        if (Object.keys(errs).length > 0) {
            const firstKey = Object.keys(errs)[0];
            const el = document.querySelector(`[name="${firstKey}"]`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.focus();
            }
            return false;
        }

        return true;
    };

    // Fetch active grounds
    useEffect(() => {
        let isMounted = true;
        async function fetchGrounds() {
            try {
                const res = await fetch("/api/ground?status=1", { cache: "no-store" });
                const json = await res.json();
                if (isMounted && res.ok && json.success) {
                    setGrounds(json.data || []);
                    setFormData((prev) =>
                        !prev.ground_id && json.data?.length > 0
                            ? { ...prev, ground_id: json.data[0].id }
                            : prev
                    );
                }
            } catch (err) {
                console.error("Failed to load grounds", err);
            } finally {
                if (isMounted) setLoadingGrounds(false);
            }
        }

        fetchGrounds();
        return () => {
            isMounted = false;
        };
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
        clearError(name);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);

        if (!validateAll()) {
            return;
        }

        setSubmitting(true);

        try {
            const url = isEdit
                ? `/api/ground-booking-requests/${requestId}`
                : "/api/ground-booking-requests";

            const method = isEdit ? "PUT" : "POST";

            const payload = {
                ...formData,
                ground_id: Number(formData.ground_id),
                number_of_players: formData.number_of_players ? Number(formData.number_of_players) : null,
            };

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const result = await res.json();

            if (!res.ok || !result.success) {
                if (result.errors) {
                    setFieldErrors(result.errors);
                    const firstKey = Object.keys(result.errors)[0];
                    if (firstKey) {
                        const el = document.querySelector(`[name="${firstKey}"]`);
                        if (el) {
                            el.scrollIntoView({ behavior: "smooth", block: "center" });
                            el.focus();
                        }
                    }
                }
                throw new Error(result.message || "Failed to save booking request.");
            }

            setSuccessMessage(
                isEdit
                    ? "Booking request updated successfully!"
                    : `Booking request created successfully! (${result.data?.request_number || ""})`
            );

            setTimeout(() => {
                router.push("/next_panel/ground-booking-requests");
                router.refresh();
            }, 1000);
        } catch (err) {
            setError(err.message || "An unexpected error occurred.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            {error && (
                <div className="alert alert-danger d-flex align-items-center gap-2 mb-4">
                    <AlertCircle size={18} className="flex-shrink-0" />
                    <div>{error}</div>
                </div>
            )}

            {successMessage && (
                <div className="alert alert-success d-flex align-items-center gap-2 mb-4">
                    <Check size={18} className="flex-shrink-0" />
                    <div>{successMessage}</div>
                </div>
            )}

            <div className="row g-4">
                {/* Column 1: Customer Details */}
                <div className="col-12 col-lg-6">
                    <div className="card shadow-sm border-0 rounded-4 p-4 h-100">
                        <h5 className="fw-bold mb-3 d-flex align-items-center gap-2 text-dark">
                            <User size={20} className="text-primary" />
                            Customer Information
                        </h5>

                        <div className="mb-3">
                            <label className="form-label small fw-semibold text-secondary">
                                Customer Name <RequiredLabel />
                            </label>
                            <div className="input-group">
                                <span className="input-group-text bg-light">
                                    <User size={16} className="text-muted" />
                                </span>
                                <input
                                    type="text"
                                    name="customer_name"
                                    className={`form-control ${fieldErrors.customer_name ? "is-invalid border-danger" : ""}`}
                                    placeholder="e.g. Rahul Sharma"
                                    value={formData.customer_name}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                />
                            </div>
                            <FormError error={fieldErrors.customer_name} />
                        </div>

                        <div className="mb-3">
                            <label className="form-label small fw-semibold text-secondary">
                                Mobile Number <RequiredLabel />
                            </label>
                            <div className="input-group">
                                <span className="input-group-text bg-light">
                                    <Phone size={16} className="text-muted" />
                                </span>
                                <input
                                    type="tel"
                                    name="mobile"
                                    className={`form-control ${fieldErrors.mobile ? "is-invalid border-danger" : ""}`}
                                    placeholder="10-digit mobile number"
                                    maxLength={15}
                                    value={formData.mobile}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                />
                            </div>
                            <FormError error={fieldErrors.mobile} />
                        </div>

                        <div className="mb-3">
                            <label className="form-label small fw-semibold text-secondary">
                                Email Address
                            </label>
                            <div className="input-group">
                                <span className="input-group-text bg-light">
                                    <Mail size={16} className="text-muted" />
                                </span>
                                <input
                                    type="email"
                                    name="email"
                                    className={`form-control ${fieldErrors.email ? "is-invalid border-danger" : ""}`}
                                    placeholder="e.g. client@example.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                />
                            </div>
                            <FormError error={fieldErrors.email} />
                        </div>

                        <div className="mb-3">
                            <label className="form-label small fw-semibold text-secondary">
                                Expected Number of Players
                            </label>
                            <div className="input-group">
                                <span className="input-group-text bg-light">
                                    <Users size={16} className="text-muted" />
                                </span>
                                <input
                                    type="number"
                                    name="number_of_players"
                                    className={`form-control ${fieldErrors.number_of_players ? "is-invalid border-danger" : ""}`}
                                    min="1"
                                    max="200"
                                    placeholder="e.g. 22"
                                    value={formData.number_of_players}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                />
                            </div>
                            <FormError error={fieldErrors.number_of_players} />
                        </div>

                        <div>
                            <label className="form-label small fw-semibold text-secondary">
                                Special Requirements / Client Notes
                            </label>
                            <textarea
                                name="special_requirements"
                                className="form-control"
                                rows={4}
                                placeholder="e.g. Floodlights, match balls, umpires, pavillion access, live scoring setup..."
                                value={formData.special_requirements}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                </div>

                {/* Column 2: Ground & Slot Details */}
                <div className="col-12 col-lg-6">
                    <div className="card shadow-sm border-0 rounded-4 p-4 h-100">
                        <h5 className="fw-bold mb-3 d-flex align-items-center gap-2 text-dark">
                            <Trees size={20} className="text-success" />
                            Ground &amp; Schedule Details
                        </h5>

                        <div className="mb-3">
                            <label className="form-label small fw-semibold text-secondary">
                                Select Ground <RequiredLabel />
                            </label>
                            <div className="input-group">
                                <span className="input-group-text bg-light">
                                    <Trees size={16} className="text-muted" />
                                </span>
                                <select
                                    name="ground_id"
                                    className={`form-select ${fieldErrors.ground_id ? "is-invalid border-danger" : ""}`}
                                    value={formData.ground_id}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    disabled={loadingGrounds}
                                >
                                    <option value="">
                                        {loadingGrounds ? "Loading grounds..." : "-- Select a Ground --"}
                                    </option>
                                    {grounds.map((g) => (
                                        <option key={g.id} value={g.id}>
                                            {g.ground_name} {g.ground_code ? `(${g.ground_code})` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <FormError error={fieldErrors.ground_id} />
                        </div>

                        <div className="mb-3">
                            <label className="form-label small fw-semibold text-secondary">
                                Booking Date <RequiredLabel />
                            </label>
                            <div className="input-group">
                                <span className="input-group-text bg-light">
                                    <Calendar size={16} className="text-muted" />
                                </span>
                                <input
                                    type="date"
                                    name="booking_date"
                                    className={`form-control ${fieldErrors.booking_date ? "is-invalid border-danger" : ""}`}
                                    value={formData.booking_date}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                />
                            </div>
                            <FormError error={fieldErrors.booking_date} />
                        </div>

                        <div className="row g-2 mb-3">
                            <div className="col-6">
                                <label className="form-label small fw-semibold text-secondary">
                                    Start Time <RequiredLabel />
                                </label>
                                <div className="input-group">
                                    <span className="input-group-text bg-light">
                                        <Clock size={16} className="text-muted" />
                                    </span>
                                    <input
                                        type="time"
                                        name="start_time"
                                        className={`form-control ${fieldErrors.start_time ? "is-invalid border-danger" : ""}`}
                                        value={formData.start_time}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                    />
                                </div>
                                <FormError error={fieldErrors.start_time} />
                            </div>
                            <div className="col-6">
                                <label className="form-label small fw-semibold text-secondary">
                                    End Time <RequiredLabel />
                                </label>
                                <div className="input-group">
                                    <span className="input-group-text bg-light">
                                        <Clock size={16} className="text-muted" />
                                    </span>
                                    <input
                                        type="time"
                                        name="end_time"
                                        className={`form-control ${fieldErrors.end_time ? "is-invalid border-danger" : ""}`}
                                        value={formData.end_time}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                    />
                                </div>
                                <FormError error={fieldErrors.end_time} />
                            </div>
                        </div>

                        <div className="mb-3">
                            <label className="form-label small fw-semibold text-secondary">
                                Booking Purpose <RequiredLabel />
                            </label>
                            <select
                                name="booking_purpose"
                                className={`form-select ${fieldErrors.booking_purpose ? "is-invalid border-danger" : ""}`}
                                value={formData.booking_purpose}
                                onChange={handleChange}
                                onBlur={handleBlur}
                            >
                                {BOOKING_PURPOSES.map((purpose) => (
                                    <option key={purpose} value={purpose}>
                                        {purpose}
                                    </option>
                                ))}
                            </select>
                            <FormError error={fieldErrors.booking_purpose} />
                        </div>

                        {/* Admin Fields (Always present in Edit, optional in New) */}
                        <div className="pt-3 border-top mt-3">
                            <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-1">
                                <FileText size={16} className="text-secondary" />
                                Admin Review &amp; Status
                            </h6>

                            <div className="mb-3">
                                <label className="form-label small fw-semibold text-secondary">
                                    Request Status
                                </label>
                                <select
                                    name="request_status"
                                    className="form-select"
                                    value={formData.request_status}
                                    onChange={handleChange}
                                >
                                    {REQUEST_STATUSES.map((st) => (
                                        <option key={st} value={st}>
                                            {st}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="form-label small fw-semibold text-secondary">
                                    Admin Remarks / Follow-up Notes
                                </label>
                                <textarea
                                    name="admin_remarks"
                                    className="form-control"
                                    rows={3}
                                    placeholder="Internal notes, pricing agreement, call discussion details..."
                                    value={formData.admin_remarks}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Submit & Cancel Actions */}
                <div className="col-12">
                    <div className="d-flex justify-content-between align-items-center bg-white p-3 rounded-4 shadow-sm">
                        <Link
                            href="/next_panel/ground-booking-requests"
                            className="btn btn-outline-secondary px-4 d-inline-flex align-items-center gap-2"
                        >
                            <ArrowLeft size={16} />
                            Back to Requests
                        </Link>

                        <button
                            type="submit"
                            className="btn btn-primary px-4 py-2 d-inline-flex align-items-center gap-2 fw-semibold"
                            disabled={submitting}
                        >
                            <Save size={16} />
                            {submitting
                                ? "Saving..."
                                : isEdit
                                ? "Update Request"
                                : "Submit Request"}
                        </button>
                    </div>
                </div>
            </div>
        </form>
    );
}
