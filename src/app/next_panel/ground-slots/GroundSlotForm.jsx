"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "../components/UserContext";
import { getFallbackContext, toApiTime, toInputTime } from "./slotUtils";

const EMPTY_FORM = {
    ground_id: "",
    slot_name: "",
    start_time: "",
    end_time: "",
    price: 0,
    status: 1,
};

export default function GroundSlotForm({ id = null }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isEdit = Boolean(id);
    const { user } = useUser();
    const hasSessionUser = Boolean(user);
    const userRole = String(user?.user_type || "")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ");
    const isSuperAdmin = ["super admin", "superadmin", "admin"].includes(userRole);
    const isBranchAdmin = userRole === "branch admin";
    const userAcademyId = user?.academy_id;
    const userBranchId = user?.branch_id;

    const [formData, setFormData] = useState({
        ...EMPTY_FORM,
        ground_id: searchParams.get("ground_id") || "",
    });
    const [grounds, setGrounds] = useState([]);
    // academy_id / branch_id travel with the record (the API validates them against the ground)
    const [scope, setScope] = useState({ academy_id: null, branch_id: null });

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState("");

    // Active grounds for the dropdown
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
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Unable to load grounds");
                }
                setGrounds(json.data || []);
            } catch (err) {
                setError(err.message);
            }
        })();
    }, [hasSessionUser, isSuperAdmin, isBranchAdmin, userAcademyId, userBranchId]);

    // Edit mode: the API has no GET-by-id, so load the list and pick the slot
    useEffect(() => {
        if (!id) return;

        (async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch("/api/ground-slots", { cache: "no-store" });
                const result = await res.json();

                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Failed to fetch slot");
                }

                const d = (result.data || []).find((s) => String(s.id) === String(id));
                if (!d) throw new Error("Ground slot not found");

                setFormData({
                    ground_id: String(d.ground_id),
                    slot_name: d.slot_name || "",
                    start_time: toInputTime(d.start_time),
                    end_time: toInputTime(d.end_time),
                    price: d.price ?? 0,
                    status: d.status ?? 1,
                });
                setScope({ academy_id: d.academy_id, branch_id: d.branch_id });
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        })();
    }, [id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: name === "status" ? Number(value) : value,
        }));
    };

    // Create mode: take academy/branch from the chosen ground
    const resolveScope = () => {
        if (scope.academy_id && scope.branch_id) return scope;
        const g = grounds.find((x) => String(x.id) === String(formData.ground_id));
        if (g?.academy_id && g?.branch_id) {
            return { academy_id: g.academy_id, branch_id: g.branch_id };
        }
        return getFallbackContext();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Mirrors the API validation
        if (!formData.ground_id) return setError("Please select a ground");
        if (!grounds.some((ground) => Number(ground.id) === Number(formData.ground_id))) {
            return setError("Please select a ground available to your account");
        }
        if (!formData.slot_name.trim()) return setError("Slot name is required");
        if (!formData.start_time) return setError("Start time is required");
        if (!formData.end_time) return setError("End time is required");
        if (formData.start_time >= formData.end_time) {
            return setError("End time must be greater than start time");
        }
        if (Number(formData.price) < 0) return setError("Price cannot be negative");

        const { academy_id, branch_id } = resolveScope();
        if (!academy_id || !branch_id) {
            return setError("Academy and branch could not be determined for this ground");
        }

        try {
            setLoading(true);
            setError("");

            const res = await fetch(isEdit ? `/api/ground-slots/${id}` : `/api/ground-slots`, {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
                body: JSON.stringify({
                    academy_id,
                    branch_id,
                    ground_id: Number(formData.ground_id),
                    slot_name: formData.slot_name.trim(),
                    start_time: toApiTime(formData.start_time),
                    end_time: toApiTime(formData.end_time),
                    price: Number(formData.price) || 0,
                    status: formData.status,
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                // 409 overlap responses include the clashing slot
                const clash = data.data?.slot_name
                    ? ` (${data.data.slot_name}: ${toInputTime(data.data.start_time)}–${toInputTime(data.data.end_time)})`
                    : "";
                throw new Error((data.message || "Something went wrong") + clash);
            }

            alert(isEdit ? "Slot updated successfully" : "Slot added successfully");

            router.push("/next_panel/ground-slots");
            router.refresh();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return <div className="text-center py-5">Loading...</div>;
    }

    return (
        <div className="card shadow-sm">
            <div className="card-header">
                <h5 className="mb-0">{isEdit ? "Edit Slot" : "Add Slot"}</h5>
            </div>

            <div className="card-body">
                {error && <div className="alert alert-danger">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Ground</label>
                            <select
                                name="ground_id"
                                className="form-select"
                                value={formData.ground_id}
                                onChange={handleChange}
                                disabled={isEdit}
                                required
                            >
                                <option value="">Select ground</option>
                                {grounds.map((g) => (
                                    <option key={g.id} value={g.id}>
                                        {g.ground_name} ({g.ground_code})
                                    </option>
                                ))}
                            </select>
                            {isEdit && (
                                <div className="form-text">A slot cannot be moved to another ground.</div>
                            )}
                        </div>

                        <div className="col-md-6 mb-3">
                            <label className="form-label">Slot Name</label>
                            <input
                                type="text"
                                name="slot_name"
                                className="form-control"
                                value={formData.slot_name}
                                onChange={handleChange}
                                placeholder="e.g. Morning Slot"
                                required
                            />
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Start Time</label>
                            <input
                                type="time"
                                name="start_time"
                                className="form-control"
                                value={formData.start_time}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">End Time</label>
                            <input
                                type="time"
                                name="end_time"
                                className="form-control"
                                value={formData.end_time}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Price (₹)</label>
                            <input
                                type="number"
                                name="price"
                                className="form-control"
                                min="0"
                                step="0.01"
                                value={formData.price}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="mb-3">
                        <label className="form-label">Status</label>
                        <select
                            name="status"
                            className="form-select"
                            value={formData.status}
                            onChange={handleChange}
                        >
                            <option value={1}>Active</option>
                            <option value={0}>Inactive</option>
                        </select>
                    </div>

                    <div className="d-flex gap-2">
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? "Saving..." : isEdit ? "Update Slot" : "Add Slot"}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => router.push("/next_panel/ground-slots")}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
