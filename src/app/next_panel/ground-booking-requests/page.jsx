"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    AlertCircle,
    Calendar,
    CalendarCheck,
    CalendarPlus,
    Check,
    CheckCircle2,
    Clock,
    Copy,
    Edit,
    Eye,
    Filter,
    Loader2,
    Mail,
    MapPin,
    MessageCircle,
    Phone,
    RefreshCw,
    Search,
    SearchSlash,
    Trash2,
    Trees,
    User,
    Users,
    X,
    XCircle,
} from "lucide-react";
import {
    BOOKING_PURPOSES,
    REQUEST_STATUSES,
    buildConvertBookingHref,
    formatDate,
    formatTime,
    formatTimeRange,
    purposeBadge,
    statusBadge,
    toDateInput,
} from "./bookingRequestUtils";
import Pagination from "../components/Pagination";

function GroundBookingRequestsList() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [requests, setRequests] = useState([]);
    const [grounds, setGrounds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
    const [selectedGround, setSelectedGround] = useState(searchParams.get("ground_id") || "");
    const [selectedStatus, setSelectedStatus] = useState(searchParams.get("status") || "");
    const [selectedDate, setSelectedDate] = useState(searchParams.get("date") || "");
    const [selectedPurpose, setSelectedPurpose] = useState("");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    // Modal state for quick view & status update
    const [activeModalRequest, setActiveModalRequest] = useState(null);
    const [modalStatus, setModalStatus] = useState("Pending");
    const [modalRemarks, setModalRemarks] = useState("");
    const [modalSubmitting, setModalSubmitting] = useState(false);
    const [modalMessage, setModalMessage] = useState(null);
    const [copiedId, setCopiedId] = useState(null);

    // Fetch Grounds
    useEffect(() => {
        let isMounted = true;
        async function loadGrounds() {
            try {
                const res = await fetch("/api/ground?status=1", { cache: "no-store" });
                const json = await res.json();
                if (isMounted && res.ok && json.success) {
                    setGrounds(json.data || []);
                }
            } catch (err) {
                console.error("Failed to load grounds", err);
            }
        }
        loadGrounds();
        return () => {
            isMounted = false;
        };
    }, []);

    // Fetch Requests with debouncing
    const fetchRequests = useCallback(async (isManualRefresh = false) => {
        if (isManualRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (searchTerm.trim()) params.set("search", searchTerm.trim());
            if (selectedGround) params.set("ground_id", selectedGround);
            if (selectedStatus) params.set("status", selectedStatus);
            if (selectedDate) params.set("booking_date", selectedDate);

            const res = await fetch(`/api/ground-booking-requests?${params.toString()}`, {
                cache: "no-store",
            });
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to fetch ground booking requests");
            }

            setRequests(json.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [searchTerm, selectedGround, selectedStatus, selectedDate]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchRequests();
        }, 250);
        return () => clearTimeout(timer);
    }, [fetchRequests]);

    // Filter by Purpose on client side (if selected)
    const filteredRequests = useMemo(() => {
        if (!selectedPurpose) return requests;
        return requests.filter((r) => r.booking_purpose === selectedPurpose);
    }, [requests, selectedPurpose]);

    const totalPages = Math.ceil(filteredRequests.length / PAGE_SIZE) || 1;
    const pagedRequests = filteredRequests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // KPI Counters
    const kpis = useMemo(() => {
        const total = requests.length;
        const pending = requests.filter((r) => r.request_status === "Pending").length;
        const approved = requests.filter((r) => r.request_status === "Approved").length;
        const rejected = requests.filter((r) => r.request_status === "Rejected").length;
        const cancelled = requests.filter((r) => r.request_status === "Cancelled").length;
        return { total, pending, approved, rejected, cancelled };
    }, [requests]);

    const handleClearFilters = () => {
        setSearchTerm("");
        setSelectedGround("");
        setSelectedStatus("");
        setSelectedDate("");
        setSelectedPurpose("");
    };

    const handleCopyRef = (refNo, e) => {
        if (e) e.stopPropagation();
        navigator.clipboard.writeText(refNo);
        setCopiedId(refNo);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Open Quick View Modal
    const handleOpenModal = (req) => {
        setActiveModalRequest(req);
        setModalStatus(req.request_status || "Pending");
        setModalRemarks(req.admin_remarks || "");
        setModalMessage(null);
    };

    const handleCloseModal = () => {
        setActiveModalRequest(null);
        setModalMessage(null);
    };

    // Quick Status Update
    const handleSaveModalStatus = async (statusOverride = null) => {
        if (!activeModalRequest) return;
        const targetStatus = statusOverride || modalStatus;

        setModalSubmitting(true);
        setModalMessage(null);

        try {
            const res = await fetch(`/api/ground-booking-requests/${activeModalRequest.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    request_status: targetStatus,
                    admin_remarks: modalRemarks,
                }),
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to update status");
            }

            setModalMessage({ type: "success", text: `Status updated to ${targetStatus}!` });

            // Update in local state
            setRequests((prev) =>
                prev.map((r) =>
                    r.id === activeModalRequest.id
                        ? { ...r, request_status: targetStatus, admin_remarks: modalRemarks }
                        : r
                )
            );

            setActiveModalRequest((prev) =>
                prev ? { ...prev, request_status: targetStatus, admin_remarks: modalRemarks } : null
            );
            setModalStatus(targetStatus);

            setTimeout(() => {
                setModalMessage(null);
            }, 3000);
        } catch (err) {
            setModalMessage({ type: "danger", text: err.message });
        } finally {
            setModalSubmitting(false);
        }
    };

    // Delete Request
    const handleDelete = async (req, e) => {
        if (e) e.stopPropagation();
        if (!confirm(`Are you sure you want to delete request ${req.request_number}?`)) return;

        try {
            const res = await fetch(`/api/ground-booking-requests/${req.id}`, {
                method: "DELETE",
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to delete request");
            }
            setRequests((prev) => prev.filter((r) => r.id !== req.id));
            if (activeModalRequest?.id === req.id) {
                handleCloseModal();
            }
        } catch (err) {
            alert(`Error deleting request: ${err.message}`);
        }
    };

    return (
        <div className="container-fluid py-2">
            <div className="row g-3">
                {/* 1. Page Header */}
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-2">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <div>
                                <h3 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                                    <CalendarCheck className="text-primary" size={26} />
                                    Ground Booking Requests
                                </h3>
                                <p className="text-muted small mb-0">
                                    Review, approve, and convert online ground inquiries and match bookings into confirmed slots.
                                </p>
                            </div>

                            <div className="d-flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary d-inline-flex align-items-center gap-1"
                                    onClick={() => fetchRequests(true)}
                                    disabled={refreshing}
                                    title="Refresh Data"
                                >
                                    <RefreshCw size={15} className={refreshing ? "spinner-border spinner-border-sm" : ""} />
                                    <span>Refresh</span>
                                </button>

                                <Link
                                    href="/next_panel/ground-bookings"
                                    className="btn btn-outline-secondary d-inline-flex align-items-center gap-1"
                                >
                                    <Calendar size={15} />
                                    <span>Confirmed Bookings</span>
                                </Link>

                                <Link
                                    href="/next_panel/grounds"
                                    className="btn btn-outline-secondary d-inline-flex align-items-center gap-1"
                                >
                                    <Trees size={15} />
                                    <span>Grounds</span>
                                </Link>

                                <Link
                                    href="/next_panel/ground-booking-requests/new"
                                    className="btn btn-primary d-inline-flex align-items-center gap-1 px-3 fw-semibold"
                                >
                                    <CalendarPlus size={16} />
                                    <span>New Request</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. KPI Summary Cards */}
                <div className="col-12">
                    <div className="row g-2">
                        {/* Total */}
                        <div className="col-6 col-md-3">
                            <div
                                className={`card shadow-sm border-0 rounded-4 p-3 h-100 ${
                                    selectedStatus === "" ? "border-primary border-2" : ""
                                }`}
                                style={{ cursor: "pointer" }}
                                onClick={() => setSelectedStatus("")}
                            >
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <span className="text-muted small d-block">Total Requests</span>
                                        <h4 className="fw-bold text-dark mb-0">{kpis.total}</h4>
                                    </div>
                                    <div className="bg-light p-2 rounded-3 text-secondary">
                                        <Calendar size={22} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Pending */}
                        <div className="col-6 col-md-3">
                            <div
                                className={`card shadow-sm border-0 rounded-4 p-3 h-100 ${
                                    selectedStatus === "Pending" ? "border-warning border-2" : ""
                                }`}
                                style={{ cursor: "pointer" }}
                                onClick={() => setSelectedStatus("Pending")}
                            >
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <span className="text-muted small d-block">Pending Review</span>
                                        <h4 className="fw-bold text-warning mb-0">{kpis.pending}</h4>
                                    </div>
                                    <div className="bg-warning bg-opacity-10 p-2 rounded-3 text-warning">
                                        <AlertCircle size={22} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Approved */}
                        <div className="col-6 col-md-3">
                            <div
                                className={`card shadow-sm border-0 rounded-4 p-3 h-100 ${
                                    selectedStatus === "Approved" ? "border-success border-2" : ""
                                }`}
                                style={{ cursor: "pointer" }}
                                onClick={() => setSelectedStatus("Approved")}
                            >
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <span className="text-muted small d-block">Approved</span>
                                        <h4 className="fw-bold text-success mb-0">{kpis.approved}</h4>
                                    </div>
                                    <div className="bg-success bg-opacity-10 p-2 rounded-3 text-success">
                                        <CheckCircle2 size={22} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Rejected / Cancelled */}
                        <div className="col-6 col-md-3">
                            <div
                                className={`card shadow-sm border-0 rounded-4 p-3 h-100 ${
                                    selectedStatus === "Rejected" ? "border-danger border-2" : ""
                                }`}
                                style={{ cursor: "pointer" }}
                                onClick={() => setSelectedStatus("Rejected")}
                            >
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <span className="text-muted small d-block">Rejected / Cancelled</span>
                                        <h4 className="fw-bold text-danger mb-0">
                                            {kpis.rejected + kpis.cancelled}
                                        </h4>
                                    </div>
                                    <div className="bg-danger bg-opacity-10 p-2 rounded-3 text-danger">
                                        <XCircle size={22} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Filter Toolbar */}
                <div className="col-12">
                    <div className="card shadow-sm border-0 rounded-4 p-3 mb-2">
                        <div className="d-flex flex-wrap align-items-center gap-2">
                            {/* Search */}
                            <div className="input-group" style={{ maxWidth: "260px" }}>
                                <span className="input-group-text bg-white">
                                    <Search size={16} className="text-muted" />
                                </span>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Customer, mobile, ref..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            {/* Ground Filter */}
                            <select
                                className="form-select"
                                style={{ maxWidth: "210px" }}
                                value={selectedGround}
                                onChange={(e) => setSelectedGround(e.target.value)}
                            >
                                <option value="">All Grounds</option>
                                {grounds.map((g) => (
                                    <option key={`flt-g-${g.id}`} value={g.id}>
                                        {g.ground_name}
                                    </option>
                                ))}
                            </select>

                            {/* Status Filter */}
                            <select
                                className="form-select"
                                style={{ maxWidth: "160px" }}
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                            >
                                <option value="">All Statuses</option>
                                {REQUEST_STATUSES.map((st) => (
                                    <option key={`flt-st-${st}`} value={st}>
                                        {st}
                                    </option>
                                ))}
                            </select>

                            {/* Purpose Filter */}
                            <select
                                className="form-select"
                                style={{ maxWidth: "180px" }}
                                value={selectedPurpose}
                                onChange={(e) => setSelectedPurpose(e.target.value)}
                            >
                                <option value="">All Purposes</option>
                                {BOOKING_PURPOSES.map((p) => (
                                    <option key={`flt-p-${p}`} value={p}>
                                        {p}
                                    </option>
                                ))}
                            </select>

                            {/* Date Filter */}
                            <input
                                type="date"
                                className="form-control"
                                style={{ maxWidth: "165px" }}
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                title="Filter by booking date"
                            />

                            {/* Clear Filter Button */}
                            {(searchTerm || selectedGround || selectedStatus || selectedDate || selectedPurpose) && (
                                <button
                                    type="button"
                                    className="btn btn-outline-danger d-inline-flex align-items-center gap-1"
                                    onClick={handleClearFilters}
                                    title="Reset all filters"
                                >
                                    <SearchSlash size={16} />
                                    <span>Clear</span>
                                </button>
                            )}

                            <span className="ms-auto text-muted small">
                                Showing <strong>{filteredRequests.length}</strong> request{filteredRequests.length === 1 ? "" : "s"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 4. Requests Data Table */}
                <div className="col-12">
                    <div className="card shadow-sm border-0 rounded-4 overflow-hidden mb-4">
                        {error && (
                            <div className="alert alert-danger m-3 mb-0 d-flex align-items-center gap-2">
                                <AlertCircle size={18} />
                                <span>{error}</span>
                            </div>
                        )}

                        {loading ? (
                            <div className="text-center py-5 text-muted">
                                <Loader2 className="spinner-border text-primary mb-2" size={32} />
                                <p className="mb-0">Loading ground booking requests...</p>
                            </div>
                        ) : filteredRequests.length === 0 ? (
                            <div className="text-center py-5 text-muted">
                                <SearchSlash size={40} className="mb-2 text-secondary opacity-50" />
                                <h6 className="fw-bold text-dark">No ground booking requests found</h6>
                                <p className="small mb-3">
                                    Try adjusting your search filters or record a new booking request.
                                </p>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={handleClearFilters}
                                >
                                    Reset Filters
                                </button>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table align-middle table-hover mb-0">
                                    <thead className="table-light">
                                        <tr className="small text-uppercase text-secondary">
                                            <th style={{ minWidth: "150px" }}>Reference</th>
                                            <th style={{ minWidth: "190px" }}>Customer</th>
                                            <th style={{ minWidth: "170px" }}>Ground</th>
                                            <th style={{ minWidth: "160px" }}>Date &amp; Slot</th>
                                            <th style={{ minWidth: "150px" }}>Purpose</th>
                                            <th style={{ minWidth: "110px" }}>Status</th>
                                            <th style={{ minWidth: "160px" }} className="text-end">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedRequests.map((req) => {
                                            const cleanPhone = String(req.mobile || "").replace(/[^0-9]/g, "");
                                            const waNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                                            const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(
                                                `Hello ${req.customer_name}, regarding your ground booking request ${req.request_number} at CST Academy.`
                                            )}`;

                                            const isBooked = req.request_status === "Approved";
                                            const convertHref = buildConvertBookingHref(req);

                                            return (
                                                <tr
                                                    key={`req-${req.id}`}
                                                    className={isBooked ? "table-success" : ""}
                                                    style={{
                                                        cursor: "pointer",
                                                        backgroundColor: isBooked ? "#e8f5e9" : undefined,
                                                    }}
                                                    onClick={() => handleOpenModal(req)}
                                                >
                                                    {/* Reference & Created Time */}
                                                    <td>
                                                        <div className="d-flex align-items-center gap-1">
                                                            <span className="fw-bold text-dark font-monospace small">
                                                                {req.request_number}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className="btn btn-link text-muted p-0 ms-1"
                                                                onClick={(e) => handleCopyRef(req.request_number, e)}
                                                                title="Copy Reference"
                                                            >
                                                                {copiedId === req.request_number ? (
                                                                    <Check size={13} className="text-success" />
                                                                ) : (
                                                                    <Copy size={13} />
                                                                )}
                                                            </button>
                                                        </div>
                                                        <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                                                            {formatDate(req.created_at)}
                                                        </span>
                                                    </td>

                                                    {/* Customer Name & Phone */}
                                                    <td>
                                                        <div className="fw-semibold text-dark">{req.customer_name}</div>
                                                        <div className="d-flex align-items-center gap-2 mt-1">
                                                            <a
                                                                href={`tel:${cleanPhone}`}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="text-decoration-none small text-muted d-inline-flex align-items-center gap-1 hover-primary"
                                                                title="Call Customer"
                                                            >
                                                                <Phone size={12} />
                                                                <span>{req.mobile}</span>
                                                            </a>
                                                            <a
                                                                href={waLink}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="text-success p-0"
                                                                title="Chat on WhatsApp"
                                                            >
                                                                <MessageCircle size={14} />
                                                            </a>
                                                        </div>
                                                    </td>

                                                    {/* Ground */}
                                                    <td>
                                                        <div className="fw-semibold text-dark small">
                                                            {req.ground_name || `Ground #${req.ground_id}`}
                                                        </div>
                                                        {req.ground_code && (
                                                            <span className="badge bg-light text-secondary border" style={{ fontSize: "0.7rem" }}>
                                                                {req.ground_code}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Date & Time Slot */}
                                                    <td>
                                                        <div className="fw-semibold text-dark small">
                                                            {formatDate(req.booking_date)}
                                                        </div>
                                                        <div className="text-primary small d-flex align-items-center gap-1 mt-1">
                                                            <Clock size={12} />
                                                            <span>{formatTimeRange(req.start_time, req.end_time)}</span>
                                                        </div>
                                                    </td>

                                                    {/* Purpose & Players */}
                                                    <td>
                                                        <span className={`badge ${purposeBadge(req.booking_purpose)}`} style={{ fontSize: "0.75rem" }}>
                                                            {req.booking_purpose}
                                                        </span>
                                                        {req.number_of_players && (
                                                            <div className="text-muted small mt-1">
                                                                {req.number_of_players} Players
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Status Badge */}
                                                    <td>
                                                        <span className={`badge px-2 py-1 ${statusBadge(req.request_status)}`}>
                                                            {req.request_status}
                                                        </span>
                                                        {req.admin_remarks && (
                                                            <div
                                                                className="text-muted text-truncate mt-1"
                                                                style={{ maxWidth: "120px", fontSize: "0.7rem" }}
                                                                title={req.admin_remarks}
                                                            >
                                                                💬 {req.admin_remarks}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Action Buttons */}
                                                    <td className="text-end" onClick={(e) => e.stopPropagation()}>
                                                        <div className="btn-group btn-group-sm">
                                                            {/* View Modal */}
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-secondary"
                                                                onClick={() => handleOpenModal(req)}
                                                                title="Quick Review"
                                                            >
                                                                <Eye size={14} />
                                                            </button>

                                                            {/* Convert to Confirmed Booking */}
                                                            {isBooked ? (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-light text-muted border"
                                                                    disabled
                                                                    title="Already Confirmed &amp; Approved"
                                                                    style={{ cursor: "not-allowed" }}
                                                                >
                                                                    <CalendarCheck size={14} className="text-success opacity-75" />
                                                                </button>
                                                            ) : (
                                                                <Link
                                                                    href={convertHref}
                                                                    className="btn btn-outline-success"
                                                                    title="Convert to Confirmed Booking"
                                                                >
                                                                    <CalendarCheck size={14} />
                                                                </Link>
                                                            )}

                                                            {/* Edit */}
                                                            {isBooked ? (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-light text-muted border"
                                                                    disabled
                                                                    title="Cannot edit approved request"
                                                                    style={{ cursor: "not-allowed" }}
                                                                >
                                                                    <Edit size={14} className="opacity-50" />
                                                                </button>
                                                            ) : (
                                                                <Link
                                                                    href={`/next_panel/ground-booking-requests/${req.id}/edit`}
                                                                    className="btn btn-outline-primary"
                                                                    title="Edit Request"
                                                                >
                                                                    <Edit size={14} />
                                                                </Link>
                                                            )}

                                                            {/* Delete */}
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-danger"
                                                                onClick={(e) => handleDelete(req, e)}
                                                                disabled={isBooked}
                                                                title={isBooked ? "Cannot delete approved request" : "Delete Request"}
                                                                style={isBooked ? { cursor: "not-allowed", opacity: 0.5 } : {}}
                                                            >
                                                                <Trash2 size={14} className={isBooked ? "text-muted" : ""} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {!loading && filteredRequests.length > 0 && (
                            <div className="p-3 border-top">
                                <Pagination
                                    page={page}
                                    totalPages={totalPages}
                                    total={filteredRequests.length}
                                    onPageChange={setPage}
                                    pageSize={PAGE_SIZE}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ========================================================= */}
            {/* 5. Quick Review Modal / Dialog                            */}
            {/* ========================================================= */}
            {activeModalRequest && (
                <div
                    className="modal fade show d-block"
                    tabIndex="-1"
                    style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 1055 }}
                    onClick={handleCloseModal}
                >
                    <div
                        className="modal-dialog modal-lg modal-dialog-centered"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-content rounded-4 border-0 shadow-lg">
                            {/* Modal Header */}
                            <div className="modal-header border-bottom py-3 px-4">
                                <div>
                                    <div className="d-flex align-items-center gap-2">
                                        <h5 className="modal-title fw-bold text-dark mb-0">
                                            Request #{activeModalRequest.request_number}
                                        </h5>
                                        <span className={`badge ${statusBadge(activeModalRequest.request_status)}`}>
                                            {activeModalRequest.request_status}
                                        </span>
                                    </div>
                                    <span className="text-muted small">
                                        Received: {formatDate(activeModalRequest.created_at)}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={handleCloseModal}
                                    aria-label="Close"
                                />
                            </div>

                            {/* Modal Body */}
                            <div className="modal-body p-4">
                                {modalMessage && (
                                    <div className={`alert alert-${modalMessage.type} py-2 small mb-3`}>
                                        {modalMessage.text}
                                    </div>
                                )}

                                <div className="row g-3 mb-4">
                                    {/* Customer Box */}
                                    <div className="col-12 col-md-6">
                                        <div className="p-3 bg-light rounded-3 border h-100">
                                            <span className="text-muted small fw-semibold text-uppercase d-block mb-1">
                                                Customer Details
                                            </span>
                                            <h6 className="fw-bold text-dark mb-1">
                                                {activeModalRequest.customer_name}
                                            </h6>
                                            <div className="small text-secondary mb-1">
                                                <strong>Mobile:</strong> {activeModalRequest.mobile}
                                            </div>
                                            {activeModalRequest.email && (
                                                <div className="small text-secondary mb-2">
                                                    <strong>Email:</strong> {activeModalRequest.email}
                                                </div>
                                            )}
                                            <div className="d-flex gap-2 mt-2">
                                                <a
                                                    href={`tel:${String(activeModalRequest.mobile || "").replace(/[^0-9]/g, "")}`}
                                                    className="btn btn-xs btn-outline-primary py-1 px-2 small d-inline-flex align-items-center gap-1"
                                                >
                                                    <Phone size={12} /> Call
                                                </a>
                                                <a
                                                    href={`https://wa.me/91${String(activeModalRequest.mobile || "").replace(/[^0-9]/g, "")}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn-xs btn-outline-success py-1 px-2 small d-inline-flex align-items-center gap-1"
                                                >
                                                    <MessageCircle size={12} /> WhatsApp
                                                </a>
                                                {activeModalRequest.email && (
                                                    <a
                                                        href={`mailto:${activeModalRequest.email}`}
                                                        className="btn btn-xs btn-outline-secondary py-1 px-2 small d-inline-flex align-items-center gap-1"
                                                    >
                                                        <Mail size={12} /> Email
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Match / Slot Box */}
                                    <div className="col-12 col-md-6">
                                        <div className="p-3 bg-light rounded-3 border h-100">
                                            <span className="text-muted small fw-semibold text-uppercase d-block mb-1">
                                                Ground &amp; Schedule
                                            </span>
                                            <h6 className="fw-bold text-dark mb-1">
                                                {activeModalRequest.ground_name || `Ground #${activeModalRequest.ground_id}`}
                                            </h6>
                                            <div className="small text-secondary mb-1">
                                                <strong>Date:</strong> {formatDate(activeModalRequest.booking_date)}
                                            </div>
                                            <div className="small text-primary mb-1 fw-semibold">
                                                <strong>Time:</strong> {formatTimeRange(activeModalRequest.start_time, activeModalRequest.end_time)}
                                            </div>
                                            <div className="small text-secondary">
                                                <strong>Purpose:</strong> {activeModalRequest.booking_purpose}
                                                {activeModalRequest.number_of_players ? ` (${activeModalRequest.number_of_players} Players)` : ""}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Special Requirements */}
                                    {activeModalRequest.special_requirements && (
                                        <div className="col-12">
                                            <span className="text-muted small fw-semibold text-uppercase d-block mb-1">
                                                Special Requirements
                                            </span>
                                            <div className="p-3 bg-white rounded-3 border small text-dark">
                                                {activeModalRequest.special_requirements}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Status Updater Form */}
                                <div className="border-top pt-3">
                                    <h6 className="fw-bold text-dark mb-2">Update Status &amp; Admin Remarks:</h6>
                                    <div className="row g-2 align-items-center mb-3">
                                        <div className="col-12 col-sm-4">
                                            <select
                                                className="form-select form-select-sm"
                                                value={modalStatus}
                                                onChange={(e) => setModalStatus(e.target.value)}
                                            >
                                                {REQUEST_STATUSES.map((st) => (
                                                    <option key={`m-st-${st}`} value={st}>
                                                        {st}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-12 col-sm-8 d-flex gap-2">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-success flex-grow-1"
                                                onClick={() => handleSaveModalStatus("Approved")}
                                                disabled={modalSubmitting || activeModalRequest.request_status === "Approved"}
                                            >
                                                Quick Approve
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-danger flex-grow-1"
                                                onClick={() => handleSaveModalStatus("Rejected")}
                                                disabled={modalSubmitting || activeModalRequest.request_status === "Rejected"}
                                            >
                                                Quick Reject
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mb-2">
                                        <label className="form-label small text-muted mb-1">
                                            Admin Follow-up Remarks:
                                        </label>
                                        <textarea
                                            className="form-control form-control-sm"
                                            rows={2}
                                            placeholder="Notes about discussion, terms, or rejection reason..."
                                            value={modalRemarks}
                                            onChange={(e) => setModalRemarks(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="modal-footer border-top py-2 px-4 d-flex justify-content-between">
                                {activeModalRequest.request_status === "Approved" ? (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-secondary d-inline-flex align-items-center gap-1"
                                        disabled
                                        style={{ cursor: "not-allowed" }}
                                    >
                                        <CheckCircle2 size={14} className="text-success" />
                                        <span>Booking Already Confirmed &amp; Approved</span>
                                    </button>
                                ) : (
                                    <Link
                                        href={buildConvertBookingHref(activeModalRequest)}
                                        className="btn btn-sm btn-success d-inline-flex align-items-center gap-1"
                                    >
                                        <CalendarCheck size={14} />
                                        <span>Convert to Confirmed Booking</span>
                                    </Link>
                                )}

                                <div className="d-flex gap-2">
                                    <Link
                                        href={`/next_panel/ground-booking-requests/${activeModalRequest.id}`}
                                        className="btn btn-sm btn-outline-primary"
                                    >
                                        Open Full Page
                                    </Link>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-primary"
                                        onClick={() => handleSaveModalStatus()}
                                        disabled={modalSubmitting}
                                    >
                                        {modalSubmitting ? "Saving..." : "Save Remarks"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function GroundBookingRequestsPage() {
    return (
        <Suspense fallback={<div className="p-4 text-center text-muted">Loading ground booking requests...</div>}>
            <GroundBookingRequestsList />
        </Suspense>
    );
}
