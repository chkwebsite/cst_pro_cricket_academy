"use client";

import { Calendar, CreditCard, Edit, Eye, Search, SearchSlash, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "../components/UserContext";
import Pagination from "../components/Pagination";

const FEE_TYPES = ["Tournament Team", "Tournament Player", "Match Team", "Match Player", "Ground Booking", "Program Fee", "Other"];
const FEE_STATUSES = ["Pending", "Partial", "Paid", "Cancelled"];

const STATUS_BADGE = {
    Pending: "bg-warning text-dark",
    Partial: "bg-info text-dark",
    Paid: "bg-success",
    Cancelled: "bg-secondary",
};

const money = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (value) => {
    if (!value) return "";
    const clean = String(value).slice(0, 10);
    const parts = clean.split("-");
    if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yy = d.getFullYear();
        return `${dd}/${mm}/${yy}`;
    }
    return String(value);
};

const getFeeDateInfo = (f) => {
    if (f.match_date) {
        return {
            date: formatDate(f.match_date),
            time: f.match_time ? String(f.match_time).slice(0, 5) : null,
            label: "Match Date",
            isMatch: true,
        };
    }
    if (f.fee_type === "Tournament Player" || f.fee_type === "Tournament Team") {
        if (f.tournament_start_date) {
            const start = formatDate(f.tournament_start_date);
            const end = formatDate(f.tournament_end_date);
            const range = end && end !== start ? `${start} - ${end}` : start;
            return {
                date: range,
                time: null,
                label: "Tournament Date",
                isMatch: false,
            };
        }
    }
    if (f.fee_type === "Program Fee") {
        return {
            date: formatDate(f.due_date || f.fee_month || f.created_at),
            time: null,
            label: f.due_date ? "Due Date" : "Fee Month",
            isMatch: false,
        };
    }
    if (f.booking_date) {
        return {
            date: formatDate(f.booking_date),
            time: null,
            label: "Booking Date",
            isMatch: false,
        };
    }
    if (f.created_at) {
        return {
            date: formatDate(f.created_at),
            time: null,
            label: "Date",
            isMatch: false,
        };
    }
    return {
        date: "—",
        time: null,
        label: "",
        isMatch: false,
    };
};

// What the fee is for, as one readable line
const reference = (f) => {
    switch (f.fee_type) {
        case "Tournament Team":
            return [f.tournament_name || `Tournament #${f.tournament_id}`, f.tournament_team_name].filter(Boolean).join(" · ");
        case "Tournament Player":
            return f.tournament_name || `Tournament #${f.tournament_id}`;
        case "Match Team":
            return [f.match_no || `Match #${f.match_id}`, f.match_team_name].filter(Boolean).join(" · ");
        case "Match Player":
            return f.match_no || `Match #${f.match_id}`;
        case "Ground Booking":
            return f.ground_name || `Booking #${f.ground_booking_id}`;
        case "Program Fee": {
            const parts = [f.program_name || "Training Program"];
            if (f.fee_month) {
                const d = new Date(f.fee_month);
                if (!Number.isNaN(d.getTime())) {
                    parts.push(d.toLocaleDateString("en-US", { month: "short", year: "numeric" }));
                }
            }
            return parts.join(" · ");
        }
        default:
            return f.remarks || "—";
    }
};

const payer = (f) => {
    if (f.player_name && f.player_name.trim()) return f.player_name.trim();
    if (f.first_name || f.last_name) return `${f.first_name || ""} ${f.last_name || ""}`.trim();
    if (f.outside_player_name) return f.outside_player_name;
    if (f.outside_player_id) return `Outside player #${f.outside_player_id}`;
    if (f.tournament_team_name) return f.tournament_team_name;
    if (f.match_team_name) return f.match_team_name;
    return "—";
};

export default function FeeStatusPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(() => {
        if (typeof window !== "undefined") {
            const p = new URLSearchParams(window.location.search);
            return p.get("notice") || null;
        }
        return null;
    });
    const [fees, setFees] = useState([]);
    const [refreshIndex, setRefreshIndex] = useState(0);

    // Filters (all supported server-side by GET /api/fee-status)
    const [search, setSearch] = useState(""); // client-side only
    const [feeType, setFeeType] = useState("");
    const [status, setStatus] = useState("");
    const [batchId, setBatchId] = useState("");
    const [batches, setBatches] = useState([]);
    const [academyId, setAcademyId] = useState("");
    const [academies, setAcademies] = useState([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    const { user } = useUser();
    const hasSessionUser = Boolean(user);
    const userRole = String(user?.user_type || "").trim().toLowerCase().replace(/[_-]+/g, " ");
    const isPlayer = userRole.includes("player") || String(user?.user_type) === "7";
    const isCoach = userRole.includes("coach") || String(user?.user_type) === "3" || Boolean(user?.isCoach);

    // Clean notice param from browser URL without triggering reload
    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            if (params.get("notice")) {
                const cleanUrl = window.location.pathname;
                window.history.replaceState({}, "", cleanUrl);
            }
        }
    }, []);

    const availableFeeTypes = isPlayer
        ? FEE_TYPES.filter((t) => t !== "Tournament Team" && t !== "Match Team")
        : FEE_TYPES;

    const userAcademyId = user?.academy_id;
    const hasAssignedAcademy =
        userAcademyId !== null && userAcademyId !== undefined && userAcademyId !== "" && Number(userAcademyId) !== 0;
    const effectiveAcademyId = hasAssignedAcademy ? String(userAcademyId) : academyId;

    useEffect(() => {
        if (!hasSessionUser) return;
        (async () => {
            try {
                const res = await fetch("/api/academies");
                const json = await res.json();
                if (res.ok && json.success) {
                    const list = Array.isArray(json.data) ? json.data : [];
                    setAcademies(hasAssignedAcademy ? list.filter((a) => Number(a.id) === Number(userAcademyId)) : list);
                }
            } catch {
                /* filter just stays empty */
            }
        })();
    }, [hasSessionUser, hasAssignedAcademy, userAcademyId]);

    // Batches
    useEffect(() => {
        if (!hasSessionUser) return;
        (async () => {
            try {
                const res = await fetch("/api/batches");
                const json = await res.json();
                if (res.ok && json.success) {
                    setBatches(Array.isArray(json.data) ? json.data : []);
                }
            } catch {
                /* filter just stays empty */
            }
        })();
    }, [hasSessionUser]);

    useEffect(() => {
        if (!hasSessionUser) return;

        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (effectiveAcademyId) params.set("academy_id", effectiveAcademyId);
                if (feeType) params.set("fee_type", feeType);
                if (status) params.set("status", status);
                if (batchId) params.set("batch_id", batchId);
                if (isPlayer) {
                    params.set("exclude_team_fees", "true");
                    if (user?.id) params.set("user_id", String(user.id));
                }
                params.set("_t", String(Date.now()));

                const query = params.toString();
                const res = await fetch(`/api/fee-status${query ? `?${query}` : ""}`, {
                    signal: controller.signal,
                    cache: "no-store",
                });
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.message || "Unable to load fee records.");
                setFees(json.data || []);
                setPage(1);
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }, 300);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [hasSessionUser, effectiveAcademyId, feeType, status, batchId, isPlayer, user?.id, refreshIndex]);

    // The API has no text search, so this filters the loaded rows
    const needle = search.trim().toLowerCase();
    const rawVisible = isPlayer
        ? fees.filter((f) => f.fee_type !== "Tournament Team" && f.fee_type !== "Match Team")
        : fees;

    const visible = needle
        ? rawVisible.filter((f) => {
              const dateInfo = getFeeDateInfo(f);
              return [
                  payer(f),
                  reference(f),
                  dateInfo.date,
                  f.match_date,
                  f.tournament_start_date,
                  f.academy_name,
                  f.branch_name,
                  f.batch_name,
                  f.remarks,
              ]
                  .filter(Boolean)
                  .some((v) => String(v).toLowerCase().includes(needle));
          })
        : rawVisible;

    const totalPages = Math.ceil(visible.length / PAGE_SIZE) || 1;
    const pagedItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const totals = visible.reduce(
        (acc, f) => {
            if (f.status === "Cancelled") return acc;
            acc.fee += Number(f.fee_amount || 0);
            acc.paid += Number(f.paid_amount || 0);
            return acc;
        },
        { fee: 0, paid: 0 }
    );

    const handleClear = (e) => {
        e.preventDefault();
        setSearch("");
        setFeeType("");
        setStatus("");
        setBatchId("");
        setAcademyId("");
    };

    const handleDelete = async (item) => {
        if (!confirm(`Delete this ${item.fee_type} fee record (₹${money(item.fee_amount)})? This cannot be undone.`)) return;
        setError(null);
        setNotice(null);
        try {
            const isPpf = item.fee_type === "Program Fee";
            const targetId = isPpf ? (item.program_fee_id || String(item.id).replace("ppf_", "")) : item.id;
            const endpoint = isPpf ? `/api/player-program-fees/${targetId}` : `/api/fee-status/${targetId}`;
            const res = await fetch(endpoint, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Unable to delete fee record");
            setFees((current) => current.filter((f) => f.id !== item.id));
            setNotice("Fee record deleted.");
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="container-fluid">
            <div className="row g-3">
                <div className="col-sm-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center gap-3">
                            <div>
                                <h3 className="mb-0"><Wallet /> {isPlayer ? "My Fee Status" : "Fee Status"}</h3>
                                <p className="text-muted mb-0">
                                    {isPlayer
                                        ? "Track your personal fee dues, program subscriptions, tournament and match fee history."
                                        : "Track fees charged for tournaments, matches and ground bookings."}
                                </p>
                            </div>
                            {!isPlayer && (
                                <Link href="/next_panel/fee-status/new" className="btn btn-primary px-4">
                                    <Wallet size={18} /> Add Fee
                                </Link>
                            )}
                        </div>
                    </div>
                </div>

                <div className="col-sm-12">
                    <div className="d-flex flex-wrap align-items-center gap-3">
                        <select
                            className="form-select"
                            value={effectiveAcademyId}
                            disabled={hasAssignedAcademy}
                            onChange={(e) => setAcademyId(e.target.value)}
                            style={{ maxWidth: "220px" }}
                        >
                            {!hasAssignedAcademy && <option value="">All Academies</option>}
                            {academies.map((a) => (
                                <option key={a.id} value={a.id}>{a.academy_name}</option>
                            ))}
                        </select>

                        <div className="input-group" style={{ maxWidth: "260px" }}>
                            <span className="input-group-text bg-white"><Search size={18} /></span>
                            <input type="text" className="form-control" placeholder="Payer, tournament, match" value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>

                        <select className="form-select" value={feeType} onChange={(e) => { setFeeType(e.target.value); setPage(1); }} style={{ maxWidth: "200px" }}>
                            <option value="">Choose Fee Type</option>
                            {availableFeeTypes.map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>

                        <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: "180px" }}>
                            <option value="">Choose Status</option>
                            {FEE_STATUSES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>

                        <select
                            className="form-select"
                            value={batchId}
                            onChange={(e) => { setBatchId(e.target.value); setPage(1); }}
                            style={{ maxWidth: "200px" }}
                        >
                            <option value="">{isCoach ? "All My Batches" : "All Batches"}</option>
                            {batches.map((b) => (
                                <option key={b.id} value={b.id}>{b.batch_name}</option>
                            ))}
                        </select>

                        <button type="button" className="btn btn-outline-danger" onClick={handleClear} aria-label="Clear filters">
                            <SearchSlash />
                        </button>
                    </div>
                </div>

                <div className="col-sm-12">
                    {error && <div className="alert alert-danger">{error}</div>}
                    {notice && <div className="alert alert-success">{notice}</div>}

                    {loading ? (
                        <div className="text-center py-5 text-muted">Loading fee records...</div>
                    ) : visible.length === 0 ? (
                        <div className="text-center py-5 text-muted">No fee records found.</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table align-middle mb-0">
                                <thead className="table-success">
                                    <tr>
                                        <th>#</th>
                                        <th>Academy</th>
                                        <th>Fee For</th>
                                        <th>Match Date</th>
                                        <th>Payer</th>
                                        <th className="text-end">Fee</th>
                                        <th className="text-end">Paid</th>
                                        <th className="text-end">Due</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedItems.map((item, idx) => {
                                        const due = Number(item.fee_amount || 0) - Number(item.paid_amount || 0);
                                        const isPendingOrPartial =
                                            item.status === "Pending" ||
                                            item.status === "Partial" ||
                                            (due > 0 && item.status !== "Paid" && item.status !== "Cancelled");
                                        const dateInfo = getFeeDateInfo(item);
                                        return (
                                            <tr key={item.id}>
                                                <th>{(page - 1) * PAGE_SIZE + idx + 1}</th>
                                                <td>
                                                    <div>{item.academy_name || "—"}</div>
                                                    {item.branch_name && <small className="text-muted">{item.branch_name}</small>}
                                                </td>
                                                <td>
                                                    <span className="badge text-bg-light border">{item.fee_type}</span>
                                                    <small className="text-muted d-block mt-1">{reference(item)}</small>
                                                </td>
                                                <td>
                                                    <div className="d-flex align-items-center gap-1 text-nowrap">
                                                        <Calendar size={14} className={dateInfo.isMatch ? "text-primary" : "text-secondary"} />
                                                        <span className="fw-medium">{dateInfo.date}</span>
                                                        {dateInfo.time && <small className="text-muted ms-1">({dateInfo.time})</small>}
                                                    </div>
                                                    {dateInfo.label && (
                                                        <small
                                                            className={`badge ${
                                                                dateInfo.isMatch
                                                                    ? "bg-primary-subtle text-primary border border-primary-subtle"
                                                                    : "bg-light text-secondary border"
                                                            } mt-1`}
                                                            style={{ fontSize: "10.5px" }}
                                                        >
                                                            {dateInfo.label}
                                                        </small>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="fw-semibold text-dark">{payer(item)}</div>
                                                    {item.batch_name && (
                                                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle mt-1" style={{ fontSize: "10.5px" }}>
                                                            {item.batch_name}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="text-end">₹{money(item.fee_amount)}</td>
                                                <td className="text-end">₹{money(item.paid_amount)}</td>
                                                <td className="text-end">{item.status === "Cancelled" ? "—" : `₹${money(due)}`}</td>
                                                <td>
                                                    <span className={`badge ${STATUS_BADGE[item.status] || "bg-secondary"}`}>{item.status}</span>
                                                </td>
                                                <td>
                                                    <div className="d-flex justify-content-start align-items-center gap-2">
                                                        <Link
                                                            href={
                                                                item.fee_type === "Program Fee"
                                                                    ? `/next_panel/player-program-fees/${item.program_fee_id || String(item.id).replace("ppf_", "")}`
                                                                    : `/next_panel/fee-status/${item.id}`
                                                            }
                                                            className="btn btn-outline-primary"
                                                            aria-label="View fee details"
                                                            title="View Details"
                                                        >
                                                            <Eye size={16} />
                                                        </Link>
                                                        {isPendingOrPartial && !isPlayer && (
                                                            <Link
                                                                href={
                                                                    item.fee_type === "Program Fee"
                                                                        ? `/next_panel/player-payments/new?player_program_fee_id=${item.program_fee_id || String(item.id).replace("ppf_", "")}&amount=${due > 0 ? due : ""}&from=fee-status`
                                                                        : `/next_panel/fee-payments/new?fee_status_id=${item.id}&amount=${due > 0 ? due : ""}&from=fee-status`
                                                                }
                                                                className="btn btn-outline-success"
                                                                aria-label="Record Payment"
                                                                title={`Record Payment (Due: ₹${money(due)})`}
                                                            >
                                                                <CreditCard size={16} />
                                                            </Link>
                                                        )}
                                                        {!isPlayer && (
                                                            <>
                                                                <Link
                                                                    href={
                                                                        item.fee_type === "Program Fee"
                                                                            ? `/next_panel/player-program-fees/${item.program_fee_id || String(item.id).replace("ppf_", "")}/edit`
                                                                            : `/next_panel/fee-status/${item.id}/edit`
                                                                    }
                                                                    className="btn btn-outline-secondary"
                                                                    aria-label="Edit fee"
                                                                    title="Edit Fee"
                                                                >
                                                                    <Edit size={16} />
                                                                </Link>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-outline-danger"
                                                                    onClick={() => handleDelete(item)}
                                                                    aria-label="Delete fee"
                                                                    title="Delete Fee"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="fw-semibold">
                                        <td colSpan={5} className="text-end">Total (excluding cancelled)</td>
                                        <td className="text-end">₹{money(totals.fee)}</td>
                                        <td className="text-end">₹{money(totals.paid)}</td>
                                        <td className="text-end">₹{money(totals.fee - totals.paid)}</td>
                                        <td colSpan={2}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {!loading && visible.length > 0 && (
                        <div className="mt-3">
                            <Pagination
                                page={page}
                                totalPages={totalPages}
                                total={visible.length}
                                onPageChange={setPage}
                                pageSize={PAGE_SIZE}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
