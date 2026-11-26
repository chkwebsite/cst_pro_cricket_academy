"use client";

import { useEffect, useState } from "react";
import {
    Calendar,
    RefreshCw,
    Search,
    History,
    ArrowRight,
    UserCheck,
    Filter,
    Shield,
    Layers,
    CreditCard,
} from "lucide-react";

export default function SubscriptionHistoryPage() {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [search, setSearch] = useState("");
    const [eventType, setEventType] = useState("");

    const loadHistory = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set("search", search.trim());
            if (eventType) params.set("event_type", eventType);

            const res = await fetch(`/api/subscription-history?${params.toString()}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to load history");

            setHistory(json.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHistory();
    }, [eventType]);

    const handleSearch = (e) => {
        e.preventDefault();
        loadHistory();
    };

    const renderDiff = (item) => {
        const prev = item.previous_values;
        const next = item.new_values;

        if (!prev && !next) return <span className="text-muted small">No diff recorded</span>;

        return (
            <div className="small font-monospace bg-light p-2 rounded-2" style={{ fontSize: "0.75rem" }}>
                {prev && (
                    <div className="text-danger mb-1">
                        <strong>Before:</strong> {JSON.stringify(prev).replace(/"/g, "")}
                    </div>
                )}
                {next && (
                    <div className="text-success">
                        <strong>After:</strong> {JSON.stringify(next).replace(/"/g, "")}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="container-fluid py-2">
            {/* Header */}
            <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                    <div>
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <History className="text-primary" size={26} />
                            <h1 className="h4 mb-0 fw-bold">Subscription Audit & Change History</h1>
                        </div>
                        <p className="text-muted mb-0 small">
                            Full historical audit trail of plan assignments, renewals, extensions, status updates, and manual activations.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={loadHistory}
                        className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                    >
                        <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh Logs
                    </button>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-white rounded-4 shadow-sm p-3 mb-4">
                <form onSubmit={handleSearch} className="row g-2 align-items-center">
                    <div className="col-12 col-md-6">
                        <div className="input-group">
                            <span className="input-group-text bg-light border-end-0">
                                <Search size={16} className="text-muted" />
                            </span>
                            <input
                                type="text"
                                className="form-control border-start-0 ps-0"
                                placeholder="Search by academy, event type, or remarks..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <select
                            className="form-select"
                            value={eventType}
                            onChange={(e) => setEventType(e.target.value)}
                        >
                            <option value="">All Event Types</option>
                            <option value="renewal">Renewal</option>
                            <option value="initial_assignment">Initial Assignment</option>
                            <option value="expiry_extended">Expiry Extended</option>
                            <option value="status_update">Status Update</option>
                            <option value="payment_recorded">Payment Recorded</option>
                            <option value="manual_academy_activated">Academy Activated</option>
                            <option value="manual_academy_deactivated">Academy Deactivated</option>
                            <option value="plan_created">Plan Created</option>
                            <option value="plan_updated">Plan Updated</option>
                        </select>
                    </div>
                    <div className="col-6 col-md-3 d-flex gap-2">
                        <button type="submit" className="btn btn-primary flex-fill">
                            Search
                        </button>
                        <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => {
                                setSearch("");
                                setEventType("");
                                setTimeout(() => loadHistory(), 0);
                            }}
                        >
                            Reset
                        </button>
                    </div>
                </form>
            </div>

            {/* Table */}
            <div className="bg-white rounded-4 shadow-sm overflow-hidden mb-4">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light text-muted small text-uppercase">
                            <tr>
                                <th className="ps-4">Timestamp</th>
                                <th>Academy</th>
                                <th>Event Type</th>
                                <th>Plan</th>
                                <th>Changed By</th>
                                <th>Changes (Diff)</th>
                                <th className="pe-4">Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="text-center py-5">
                                        <div className="spinner-border text-primary spinner-border-sm me-2" role="status"></div>
                                        <span className="text-muted small">Loading history logs...</span>
                                    </td>
                                </tr>
                            ) : history.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="text-center py-5 text-muted">
                                        No subscription audit logs found.
                                    </td>
                                </tr>
                            ) : (
                                history.map((item) => (
                                    <tr key={item.id}>
                                        <td className="ps-4 small text-muted">
                                            {new Date(item.created_at).toLocaleString()}
                                        </td>
                                        <td>
                                            <div className="fw-semibold text-dark">
                                                {item.academy_name || "System Level"}
                                            </div>
                                            {item.academy_code && (
                                                <div className="text-muted font-monospace" style={{ fontSize: "0.75rem" }}>
                                                    {item.academy_code}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <span className="badge bg-light text-dark border px-2 py-1 text-capitalize">
                                                {String(item.event_type).replace(/_/g, " ")}
                                            </span>
                                        </td>
                                        <td>
                                            {item.plan_name ? (
                                                <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                                    {item.plan_name}
                                                </span>
                                            ) : (
                                                <span className="text-muted small">-</span>
                                            )}
                                        </td>
                                        <td className="small">
                                            <div className="fw-medium text-dark">{item.changed_by_name}</div>
                                            {item.user_email && (
                                                <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                                    {item.user_email}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ maxWidth: "340px" }}>
                                            {renderDiff(item)}
                                        </td>
                                        <td className="pe-4 small text-secondary">
                                            {item.remarks || "-"}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
