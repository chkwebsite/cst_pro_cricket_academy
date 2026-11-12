"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    AlertCircle,
    ArrowLeft,
    Calendar,
    CalendarCheck,
    Check,
    CheckCircle2,
    Clock,
    Copy,
    CornerDownRight,
    Edit,
    FileText,
    HelpCircle,
    Loader2,
    Mail,
    MapPin,
    MessageCircle,
    Phone,
    Save,
    Trash2,
    Trees,
    User,
    Users,
    XCircle,
} from "lucide-react";
import {
    REQUEST_STATUSES,
    buildConvertBookingHref,
    formatDate,
    formatTime,
    formatTimeRange,
    purposeBadge,
    statusBadge,
} from "../bookingRequestUtils";

export default function GroundBookingRequestDetailPage({ params }) {
    const { id } = use(params);
    const router = useRouter();

    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);

    // Quick status & remarks state
    const [statusUpdating, setStatusUpdating] = useState(false);
    const [newStatus, setNewStatus] = useState("Pending");
    const [newRemarks, setNewRemarks] = useState("");
    const [updateSuccess, setUpdateSuccess] = useState(null);
    const [updateError, setUpdateError] = useState(null);

    useEffect(() => {
        let isMounted = true;

        async function loadRequest() {
            try {
                const res = await fetch(`/api/ground-booking-requests/${id}`, {
                    cache: "no-store",
                });
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Unable to fetch booking request");
                }
                if (isMounted) {
                    setRequest(json.data);
                    setNewStatus(json.data.request_status || "Pending");
                    setNewRemarks(json.data.admin_remarks || "");
                }
            } catch (err) {
                if (isMounted) setError(err.message);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadRequest();

        return () => {
            isMounted = false;
        };
    }, [id]);

    const handleCopyRef = () => {
        if (!request?.request_number) return;
        navigator.clipboard.writeText(request.request_number);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleQuickStatusUpdate = async (statusToSet = newStatus) => {
        setStatusUpdating(true);
        setUpdateSuccess(null);
        setUpdateError(null);

        try {
            const res = await fetch(`/api/ground-booking-requests/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    request_status: statusToSet,
                    admin_remarks: newRemarks,
                }),
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to update status");
            }

            setUpdateSuccess(`Status changed to ${statusToSet} successfully!`);
            setRequest((prev) => ({
                ...prev,
                request_status: statusToSet,
                admin_remarks: newRemarks,
            }));
            setNewStatus(statusToSet);
            setTimeout(() => setUpdateSuccess(null), 3500);
        } catch (err) {
            setUpdateError(err.message);
        } finally {
            setStatusUpdating(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete request ${request?.request_number}?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/ground-booking-requests/${id}`, {
                method: "DELETE",
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to delete request");
            }
            router.push("/next_panel/ground-booking-requests");
            router.refresh();
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    if (loading) {
        return (
            <div className="container-fluid py-5 text-center">
                <Loader2 className="spinner-border text-primary mb-2" size={32} />
                <p className="text-muted">Loading request details...</p>
            </div>
        );
    }

    if (error || !request) {
        return (
            <div className="container-fluid py-4">
                <div className="alert alert-danger">
                    <h5>Booking Request Not Found</h5>
                    <p>{error || "The requested booking does not exist or has been removed."}</p>
                    <Link
                        href="/next_panel/ground-booking-requests"
                        className="btn btn-outline-danger btn-sm"
                    >
                        Back to Requests List
                    </Link>
                </div>
            </div>
        );
    }

    // WhatsApp clean link (assuming India +91 if 10 digits)
    const cleanPhone = String(request.mobile || "").replace(/[^0-9]/g, "");
    const waNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const waMessage = encodeURIComponent(
        `Hello ${request.customer_name}, regarding your ground booking request (${request.request_number}) for ${request.ground_name} on ${request.booking_date?.slice(0, 10)}.`
    );
    const waLink = `https://wa.me/${waNumber}?text=${waMessage}`;

    // Link to convert to confirmed booking
    const convertHref = buildConvertBookingHref(request);

    return (
        <div className="container-fluid py-2">
            <div className="row g-3">
                {/* Header Banner */}
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-2">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <div className="d-flex align-items-center gap-3">
                                <Link
                                    href="/next_panel/ground-booking-requests"
                                    className="btn btn-sm btn-outline-secondary rounded-circle p-2"
                                    title="Back to all requests"
                                >
                                    <ArrowLeft size={18} />
                                </Link>
                                <div>
                                    <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                        <h3 className="mb-0 fw-bold text-dark">
                                            {request.request_number}
                                        </h3>
                                        <button
                                            type="button"
                                            className="btn btn-xs btn-outline-secondary p-1 rounded"
                                            onClick={handleCopyRef}
                                            title="Copy Reference Number"
                                        >
                                            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                                        </button>
                                        <span className={`badge px-3 py-1 ${statusBadge(request.request_status)}`}>
                                            {request.request_status}
                                        </span>
                                    </div>
                                    <p className="text-muted small mb-0">
                                        Submitted on: {formatDate(request.created_at)} at {formatTime(String(request.created_at).slice(11, 16))}
                                    </p>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="d-flex flex-wrap gap-2">
                                {request.request_status === "Approved" ? (
                                    <button
                                        type="button"
                                        className="btn btn-secondary px-3 d-inline-flex align-items-center gap-2"
                                        disabled
                                        style={{ cursor: "not-allowed" }}
                                        title="Already Confirmed &amp; Approved"
                                    >
                                        <CheckCircle2 size={16} className="text-success" />
                                        <span>Booking Confirmed &amp; Approved</span>
                                    </button>
                                ) : (
                                    <Link
                                        href={convertHref}
                                        className="btn btn-success px-3 d-inline-flex align-items-center gap-2"
                                        title="Create Confirmed Booking from this request"
                                    >
                                        <CalendarCheck size={16} />
                                        <span>Convert to Confirmed Booking</span>
                                    </Link>
                                )}

                                {request.request_status === "Approved" ? (
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary px-3 d-inline-flex align-items-center gap-2"
                                        disabled
                                        style={{ cursor: "not-allowed" }}
                                        title="Cannot edit approved request"
                                    >
                                        <Edit size={16} className="text-muted" />
                                        <span>Edit</span>
                                    </button>
                                ) : (
                                    <Link
                                        href={`/next_panel/ground-booking-requests/${id}/edit`}
                                        className="btn btn-outline-primary px-3 d-inline-flex align-items-center gap-2"
                                    >
                                        <Edit size={16} />
                                        <span>Edit</span>
                                    </Link>
                                )}

                                <button
                                    type="button"
                                    className="btn btn-outline-danger px-3 d-inline-flex align-items-center gap-2"
                                    onClick={handleDelete}
                                    disabled={request.request_status === "Approved"}
                                    style={request.request_status === "Approved" ? { cursor: "not-allowed", opacity: 0.5 } : {}}
                                    title={request.request_status === "Approved" ? "Cannot delete approved request" : "Delete Request"}
                                >
                                    <Trash2 size={16} />
                                    <span>Delete</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status Update Banner */}
                {updateSuccess && (
                    <div className="col-12">
                        <div className="alert alert-success d-flex align-items-center gap-2 mb-0">
                            <CheckCircle2 size={18} />
                            <span>{updateSuccess}</span>
                        </div>
                    </div>
                )}
                {updateError && (
                    <div className="col-12">
                        <div className="alert alert-danger d-flex align-items-center gap-2 mb-0">
                            <AlertCircle size={18} />
                            <span>{updateError}</span>
                        </div>
                    </div>
                )}

                {/* Main Content Grid */}
                <div className="col-12 col-lg-8">
                    {/* Booking Details Card */}
                    <div className="card shadow-sm border-0 rounded-4 p-4 mb-4">
                        <h5 className="fw-bold mb-3 d-flex align-items-center gap-2 text-dark">
                            <Calendar className="text-primary" size={20} />
                            Match &amp; Schedule Details
                        </h5>

                        <div className="row g-3">
                            <div className="col-12 col-sm-6 col-md-4">
                                <span className="text-muted small d-block">Ground Requested</span>
                                <h6 className="fw-bold text-dark mb-0">
                                    {request.ground_name || `Ground #${request.ground_id}`}
                                </h6>
                                {request.ground_code && (
                                    <span className="badge bg-light text-secondary border mt-1">
                                        {request.ground_code}
                                    </span>
                                )}
                            </div>

                            <div className="col-12 col-sm-6 col-md-4">
                                <span className="text-muted small d-block">Booking Date</span>
                                <h6 className="fw-bold text-dark mb-0">
                                    {formatDate(request.booking_date)}
                                </h6>
                                <small className="text-muted">{toDateInput(request.booking_date)}</small>
                            </div>

                            <div className="col-12 col-sm-6 col-md-4">
                                <span className="text-muted small d-block">Time Window</span>
                                <h6 className="fw-bold text-primary mb-0 d-flex align-items-center gap-1">
                                    <Clock size={16} />
                                    {formatTimeRange(request.start_time, request.end_time)}
                                </h6>
                                <small className="text-muted">
                                    {String(request.start_time).slice(0, 5)} - {String(request.end_time).slice(0, 5)}
                                </small>
                            </div>

                            <div className="col-12 col-sm-6 col-md-4">
                                <span className="text-muted small d-block">Purpose</span>
                                <span className={`badge mt-1 ${purposeBadge(request.booking_purpose)}`}>
                                    {request.booking_purpose}
                                </span>
                            </div>

                            <div className="col-12 col-sm-6 col-md-4">
                                <span className="text-muted small d-block">Players Expected</span>
                                <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-1">
                                    <Users size={16} className="text-secondary" />
                                    {request.number_of_players ? `${request.number_of_players} Players` : "Not specified"}
                                </h6>
                            </div>

                            <div className="col-12 col-sm-6 col-md-4">
                                <span className="text-muted small d-block">Current Status</span>
                                <span className={`badge mt-1 ${statusBadge(request.request_status)}`}>
                                    {request.request_status}
                                </span>
                            </div>
                        </div>

                        {/* Special Requirements */}
                        <div className="mt-4 pt-3 border-top">
                            <span className="text-muted small d-block mb-1 fw-semibold">
                                Special Requirements / Client Notes:
                            </span>
                            <div className="bg-light rounded-3 p-3 text-secondary small border">
                                {request.special_requirements ? (
                                    <p className="mb-0" style={{ whiteSpace: "pre-line" }}>
                                        {request.special_requirements}
                                    </p>
                                ) : (
                                    <em className="text-muted">No special requirements mentioned by client.</em>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Ground Facilities Card */}
                    <div className="card shadow-sm border-0 rounded-4 p-4 mb-4">
                        <h5 className="fw-bold mb-3 d-flex align-items-center gap-2 text-dark">
                            <Trees className="text-success" size={20} />
                            Ground Specifications &amp; Location
                        </h5>

                        <div className="row g-3">
                            <div className="col-12 col-sm-6">
                                <span className="text-muted small d-block">Ground Name</span>
                                <p className="fw-semibold text-dark mb-0">
                                    {request.ground_name || "—"}
                                </p>
                            </div>

                            <div className="col-12 col-sm-6">
                                <span className="text-muted small d-block">Ground Manager</span>
                                <p className="fw-semibold text-dark mb-0">
                                    {request.ground_contact_person || "Academy Admin"}
                                    {request.ground_contact_phone && (
                                        <span className="text-muted ms-2 small">({request.ground_contact_phone})</span>
                                    )}
                                </p>
                            </div>

                            {request.ground_address && (
                                <div className="col-12">
                                    <span className="text-muted small d-block">Address</span>
                                    <p className="text-secondary small mb-0 d-flex align-items-start gap-1">
                                        <MapPin size={16} className="text-danger flex-shrink-0 mt-1" />
                                        <span>{request.ground_address}</span>
                                    </p>
                                </div>
                            )}

                            {request.ground_facility && (
                                <div className="col-12">
                                    <span className="text-muted small d-block">Ground Facilities</span>
                                    <div className="d-flex flex-wrap gap-1 mt-1">
                                        {request.ground_facility.split(",").map((fac, fIdx) => (
                                            <span
                                                key={`fac-${fIdx}`}
                                                className="badge bg-light text-dark border small"
                                            >
                                                {fac.trim()}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Customer Info & Status Updater */}
                <div className="col-12 col-lg-4">
                    {/* Customer Profile Card */}
                    <div className="card shadow-sm border-0 rounded-4 p-4 mb-4">
                        <h5 className="fw-bold mb-3 d-flex align-items-center gap-2 text-dark">
                            <User className="text-primary" size={20} />
                            Customer Information
                        </h5>

                        <div className="mb-3">
                            <span className="text-muted small d-block">Name</span>
                            <h6 className="fw-bold text-dark mb-0">{request.customer_name}</h6>
                        </div>

                        <div className="mb-3">
                            <span className="text-muted small d-block">Phone / Mobile</span>
                            <h6 className="fw-semibold text-dark mb-1">{request.mobile}</h6>
                            <div className="d-flex gap-2 mt-2">
                                <a
                                    href={`tel:${cleanPhone}`}
                                    className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                                >
                                    <Phone size={14} /> Call
                                </a>
                                <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1"
                                >
                                    <MessageCircle size={14} /> WhatsApp
                                </a>
                            </div>
                        </div>

                        <div className="mb-3">
                            <span className="text-muted small d-block">Email</span>
                            {request.email ? (
                                <a
                                    href={`mailto:${request.email}`}
                                    className="fw-semibold text-primary text-decoration-none small d-inline-flex align-items-center gap-1"
                                >
                                    <Mail size={14} /> {request.email}
                                </a>
                            ) : (
                                <span className="text-muted small">No email provided</span>
                            )}
                        </div>
                    </div>

                    {/* Admin Status & Remarks Card */}
                    <div className="card shadow-sm border-0 rounded-4 p-4">
                        <h5 className="fw-bold mb-3 d-flex align-items-center gap-2 text-dark">
                            <FileText className="text-secondary" size={20} />
                            Admin Review &amp; Actions
                        </h5>

                        {/* Quick 1-Click Status Buttons */}
                        <div className="mb-3">
                            <span className="text-muted small d-block mb-2">Quick Status Action:</span>
                            <div className="d-grid gap-2">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-success d-flex align-items-center justify-content-center gap-2 py-2 fw-semibold"
                                    onClick={() => handleQuickStatusUpdate("Approved")}
                                    disabled={statusUpdating || request.request_status === "Approved"}
                                >
                                    <CheckCircle2 size={16} />
                                    <span>Approve Request</span>
                                </button>

                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center gap-2 py-2"
                                    onClick={() => handleQuickStatusUpdate("Rejected")}
                                    disabled={statusUpdating || request.request_status === "Rejected"}
                                >
                                    <XCircle size={16} />
                                    <span>Reject Request</span>
                                </button>
                            </div>
                        </div>

                        <hr className="my-3" />

                        {/* Custom Status & Remarks Form */}
                        <div className="mb-3">
                            <label className="form-label small fw-semibold text-secondary">
                                Change Status To
                            </label>
                            <select
                                className="form-select form-select-sm"
                                value={newStatus}
                                onChange={(e) => setNewStatus(e.target.value)}
                            >
                                {REQUEST_STATUSES.map((st) => (
                                    <option key={`st-${st}`} value={st}>
                                        {st}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="mb-3">
                            <label className="form-label small fw-semibold text-secondary">
                                Admin Remarks / Follow-up Notes
                            </label>
                            <textarea
                                className="form-control form-control-sm"
                                rows={4}
                                placeholder="Add follow-up notes, discussion remarks, or reason for rejection..."
                                value={newRemarks}
                                onChange={(e) => setNewRemarks(e.target.value)}
                            />
                        </div>

                        <button
                            type="button"
                            className="btn btn-primary btn-sm w-100 d-inline-flex align-items-center justify-content-center gap-2 fw-semibold py-2"
                            onClick={() => handleQuickStatusUpdate(newStatus)}
                            disabled={statusUpdating}
                        >
                            <Save size={15} />
                            <span>{statusUpdating ? "Saving..." : "Save Review Notes"}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
