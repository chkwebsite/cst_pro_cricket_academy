"use client";

import { Clock, Edit, Search, SearchSlash, Trash2, Trees } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useUser } from "../components/UserContext";
import { formatPrice, formatTime } from "./slotUtils";

function GroundSlotsList() {
    const searchParams = useSearchParams();
    const { user } = useUser();
    const hasSessionUser = Boolean(user);
    const userAcademyId = user?.academy_id;
    const userBranchId = user?.branch_id;
    const userRole = String(user?.user_type || "")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ");
    const isSuperAdmin = ["super admin", "superadmin", "admin"].includes(userRole);
    const isBranchAdmin = userRole === "branch admin";
    const hasAssignedAcademy =
        userAcademyId !== null &&
        userAcademyId !== undefined &&
        userAcademyId !== "" &&
        Number(userAcademyId) !== 0;
    const effectiveAcademyId = hasAssignedAcademy ? String(userAcademyId) : "";

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [slots, setSlots] = useState([]);
    const [grounds, setGrounds] = useState([]);

    // Filters (slot_name / start_time / status are server-side; ground is client-side
    // because GET /api/ground-slots has no ground_id filter)
    const [slotName, setSlotName] = useState("");
    const [startTime, setStartTime] = useState("");
    const [status, setStatus] = useState("");
    const [groundId, setGroundId] = useState(searchParams.get("ground_id") || "");

    // Grounds for the filter dropdown
    useEffect(() => {
        if (!hasSessionUser) return;

        (async () => {
            try {
                const params = new URLSearchParams({ status: "1" });
                if (!isSuperAdmin) {
                    if (isBranchAdmin) {
                        params.set("branch_id", String(userBranchId || 0));
                    } else {
                        params.set("academy_id", String(userAcademyId || 0));
                    }
                }

                const res = await fetch(`/api/ground?${params.toString()}`, {
                    cache: "no-store",
                });
                const json = await res.json();
                if (res.ok && json.success) setGrounds(json.data || []);
            } catch {
                /* dropdown just stays empty */
            }
        })();
    }, [hasSessionUser, isSuperAdmin, isBranchAdmin, userAcademyId, userBranchId]);

    // Debounced fetch
    useEffect(() => {
        if (!hasSessionUser) return;

        const controller = new AbortController();

        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (effectiveAcademyId) params.set("academy_id", effectiveAcademyId);
                if (isBranchAdmin && userBranchId) params.set("branch_id", String(userBranchId));
                if (slotName.trim()) params.set("slot_name", slotName.trim());
                if (startTime) params.set("start_time", `${startTime}:00`);
                if (status !== "") params.set("status", status);

                const query = params.toString();
                const res = await fetch(`/api/ground-slots${query ? `?${query}` : ""}`, {
                    signal: controller.signal,
                    cache: "no-store",
                });
                const json = await res.json();

                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Unable to load ground slots.");
                }
                setSlots(json.data || []);
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
    }, [hasSessionUser, effectiveAcademyId, isBranchAdmin, userBranchId, slotName, startTime, status]);

    const handleClear = (e) => {
        e.preventDefault();
        setSlotName("");
        setStartTime("");
        setStatus("");
        setGroundId("");
    };

    const handleDelete = async (slot) => {
        if (!confirm(`Delete slot "${slot.slot_name}" of ${slot.ground_name}?`)) return;
        setError(null);
        try {
            // API soft-deletes (status = 0) and requires academy_id + branch_id in the body
            const res = await fetch(`/api/ground-slots/${slot.id}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    academy_id: slot.academy_id,
                    branch_id: slot.branch_id,
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to delete slot");
            }
            // Soft delete -> mark inactive locally instead of removing the row
            setSlots((current) =>
                current.map((s) => (s.id === slot.id ? { ...s, status: 0 } : s))
            );
        } catch (err) {
            setError(err.message);
        }
    };

    const visible = groundId
        ? slots.filter((s) => String(s.ground_id) === String(groundId))
        : slots;

    const selectedGround = grounds.find((g) => String(g.id) === String(groundId));
    const addHref = `/next_panel/ground-slots/new${groundId ? `?ground_id=${groundId}` : ""}`;

    return (
        <div className="container-fluid">
            <div className="row g-3">
                {/* Header */}
                <div className="col-sm-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center gap-3">
                            <div>
                                <h3 className="mb-0"><Clock /> Ground Slots</h3>
                                <p className="text-muted mb-0">
                                    {selectedGround
                                        ? `Time slots and pricing for ${selectedGround.ground_name}.`
                                        : "Manage bookable time slots and pricing for each ground."}
                                </p>
                            </div>
                            <div className="d-flex gap-2">
                                <Link href="/next_panel/grounds" className="btn btn-outline-secondary px-3">
                                    <Trees size={18} /> Grounds
                                </Link>
                                <Link href={addHref} className="btn btn-primary px-4">
                                    <Clock size={18} /> Add Slot
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="col-sm-12">
                    <div className="d-flex flex-wrap align-items-center gap-3">
                        <select
                            className="form-select"
                            style={{ maxWidth: "220px" }}
                            value={groundId}
                            onChange={(e) => setGroundId(e.target.value)}
                        >
                            <option value="">All grounds</option>
                            {grounds.map((g) => (
                                <option key={g.id} value={g.id}>
                                    {g.ground_name} ({g.ground_code})
                                </option>
                            ))}
                        </select>

                        <div className="input-group" style={{ maxWidth: "240px" }}>
                            <span className="input-group-text bg-white"><Search size={18} /></span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Slot name"
                                value={slotName}
                                onChange={(e) => setSlotName(e.target.value)}
                            />
                        </div>

                        <div className="input-group" style={{ maxWidth: "230px" }}>
                            <span className="input-group-text bg-white small">Starts from</span>
                            <input
                                type="time"
                                className="form-control"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                            />
                        </div>

                        <select
                            className="form-select"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            style={{ maxWidth: "180px" }}
                        >
                            <option value="">Choose Status</option>
                            <option value="1">Active</option>
                            <option value="0">Inactive</option>
                        </select>

                        <button
                            type="button"
                            className="btn btn-outline-danger"
                            onClick={handleClear}
                            aria-label="Clear filters"
                        >
                            <SearchSlash />
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="col-sm-12">
                    {error && <div className="alert alert-danger">{error}</div>}

                    {loading ? (
                        <div className="text-center py-5 text-muted">Loading slots...</div>
                    ) : visible.length === 0 ? (
                        <div className="text-center py-5 text-muted">No slots found.</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table align-middle mb-0">
                                <thead className="table-success">
                                    <tr>
                                        <th>#</th>
                                        <th>Ground</th>
                                        <th>Slot</th>
                                        <th>Time</th>
                                        <th>Price</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visible.map((item, idx) => (
                                        <tr key={item.id}>
                                            <th>{idx + 1}</th>
                                            <td>
                                                <div>{item.ground_name}</div>
                                                <small className="text-muted">{item.ground_code}</small>
                                            </td>
                                            <td>{item.slot_name}</td>
                                            <td>
                                                <Clock size={14} className="me-1 text-muted" />
                                                {formatTime(item.start_time)} – {formatTime(item.end_time)}
                                            </td>
                                            <td>{formatPrice(item.price)}</td>
                                            <td>
                                                <span className={`badge ${Number(item.status) === 1 ? "bg-success" : "bg-secondary"}`}>
                                                    {Number(item.status) === 1 ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="d-flex justify-content-start gap-2">
                                                    <Link
                                                        href={`/next_panel/ground-slots/${item.id}/edit`}
                                                        className="btn btn-outline-secondary"
                                                        aria-label="Edit slot"
                                                    >
                                                        <Edit size={16} />
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-danger"
                                                        onClick={() => handleDelete(item)}
                                                        disabled={Number(item.status) === 0}
                                                        aria-label="Delete slot"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function GroundSlotsPage() {
    // useSearchParams needs a Suspense boundary for production builds
    return (
        <Suspense fallback={<div className="text-center py-5 text-muted">Loading...</div>}>
            <GroundSlotsList />
        </Suspense>
    );
}
