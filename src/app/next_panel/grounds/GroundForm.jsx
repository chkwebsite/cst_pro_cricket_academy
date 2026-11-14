"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "../components/UserContext";

const CODE_PREFIX = "GD-CODE-";

const EMPTY_FORM = {
    academy_id: "",
    branch_id: "",
    ground_name: "",
    ground_code: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    description: "",
    ground_facility: "",
    status: 1,
};

export default function GroundForm({ id = null, initialGroundCode = "", defaultAcademyId = "" }) {
    const router = useRouter();
    const isEdit = Boolean(id);
    const { user } = useUser();
    const isSuper = user?.role === "super_admin" || user?.role_name === "Super Admin" || user?.user_type === "super_admin";
    const userAcademyId = user?.academy_id ? String(user.academy_id) : "";

    const [suggestedGroundCode, setSuggestedGroundCode] = useState(initialGroundCode || "GD-CODE-001");
    const [manualCode, setManualCode] = useState(false);
    const [formData, setFormData] = useState(() => ({
        ...EMPTY_FORM,
        academy_id: !id && (defaultAcademyId || userAcademyId) ? Number(defaultAcademyId || userAcademyId) : "",
        ground_code: !id && initialGroundCode ? initialGroundCode : "",
    }));

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [academies, setAcademies] = useState([]);
    const [branches, setBranches] = useState([]);
    const [academiesLoading, setAcademiesLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState("");

    // Auto-set academy_id for non-super admins once user session is ready
    useEffect(() => {
        if (!isEdit && !formData.academy_id && userAcademyId) {
            setFormData((prev) => ({
                ...prev,
                academy_id: Number(userAcademyId),
            }));
        }
    }, [isEdit, userAcademyId, formData.academy_id]);

    // Keep initial ground code in sync if passed from server component
    useEffect(() => {
        if (initialGroundCode && !isEdit) {
            setSuggestedGroundCode(initialGroundCode);
            setFormData((prev) => {
                if (!manualCode || !prev.ground_code) {
                    return { ...prev, ground_code: initialGroundCode };
                }
                return prev;
            });
        }
    }, [initialGroundCode, isEdit, manualCode]);

    // Automatically fetch next ground code academy-wise whenever academy changes
    useEffect(() => {
        if (isEdit) return;

        const controller = new AbortController();
        const fetchNextCode = async () => {
            try {
                const currentAcademyId = formData.academy_id || defaultAcademyId || userAcademyId || "";
                const params = new URLSearchParams();
                if (currentAcademyId) params.set("academy_id", String(currentAcademyId));
                const query = params.toString();

                const res = await fetch(`/api/ground/next-code${query ? `?${query}` : ""}`, {
                    signal: controller.signal,
                });
                const result = await res.json();
                if (result.success && result.next_ground_code) {
                    setSuggestedGroundCode(result.next_ground_code);
                    setFormData((prev) => {
                        // If user hasn't typed a custom code or input is empty, auto-fill
                        if (!manualCode || !prev.ground_code) {
                            return { ...prev, ground_code: result.next_ground_code };
                        }
                        return prev;
                    });
                }
            } catch (err) {
                if (err.name !== "AbortError") {
                    console.error("Failed to fetch next ground code:", err);
                }
            }
        };

        fetchNextCode();
        return () => controller.abort();
    }, [isEdit, formData.academy_id, defaultAcademyId, userAcademyId, manualCode]);

    // GENERATE / REFRESH NEXT GROUND CODE ACADEMY-WISE
    const handleGenerateCode = async () => {
        try {
            setGenerating(true);
            setError("");
            setManualCode(false);

            const currentAcademyId = formData.academy_id || defaultAcademyId || userAcademyId || "";
            const params = new URLSearchParams();
            if (currentAcademyId) params.set("academy_id", String(currentAcademyId));
            const query = params.toString();

            const res = await fetch(`/api/ground/next-code${query ? `?${query}` : ""}`);
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to generate ground code");
            }

            const nextCode = json.next_ground_code || `${CODE_PREFIX}001`;
            setSuggestedGroundCode(nextCode);
            setFormData((prev) => ({ ...prev, ground_code: nextCode }));
        } catch (err) {
            setError(err.message);
        } finally {
            setGenerating(false);
        }
    };

    // LOAD ACADEMIES (once)
    useEffect(() => {
        const loadAcademies = async () => {
            try {
                const res = await fetch("/api/academies");
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to load academies");
                }
                setAcademies(Array.isArray(json.data) ? json.data : []);
            } catch (err) {
                setError(err.message);
            } finally {
                setAcademiesLoading(false);
            }
        };
        loadAcademies();
    }, []);

    // GET SINGLE GROUND (edit mode)
    useEffect(() => {
        if (!id) return;

        const getGround = async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/ground/${id}`);
                const result = await res.json();

                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Failed to fetch Ground");
                }

                const d = result.data;
                setFormData({
                    academy_id: d.academy_id ?? "",
                    branch_id: d.branch_id ?? "",
                    ground_name: d.ground_name || "",
                    ground_code: d.ground_code || "",
                    contact_person: d.contact_person || "",
                    phone: d.phone || "",
                    email: d.email || "",
                    address: d.address || "",
                    description: d.description || "",
                    ground_facility: d.ground_facility || "",
                    status: d.status ?? 1,
                });
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        };
        getGround();
    }, [id]);

    const filteredBranches = formData.academy_id
        ? branches.filter((branch) => Number(branch.academy_id) === Number(formData.academy_id))
        : [];

    useEffect(() => {
        if (!formData.academy_id) return;

        const loadBranches = async () => {
            try {
                const res = await fetch(`/api/branch?academy_id=${formData.academy_id}`);
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to load branches");
                }
                setBranches(json.data || []);
            } catch (err) {
                setBranches([]);
                setError(err.message);
            }
        };
        loadBranches();
    }, [formData.academy_id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === "ground_code") {
            setManualCode(true);
        }
        if (name === "academy_id") {
            setManualCode(false);
            setFormData((prev) => ({
                ...prev,
                academy_id: value === "" ? "" : Number(value),
                branch_id: "",
            }));
            return;
        }

        setFormData((prev) => ({
            ...prev,
            [name]:
                name === "status"
                    ? Number(value)
                    : name === "branch_id"
                        ? (value === "" ? "" : Number(value))
                        : value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Mirrors the API's required-field validation
        if (!formData.academy_id) return setError("Please select an academy");
        if (!formData.branch_id) return setError("Please select a branch");
        if (!formData.ground_name.trim()) return setError("Ground name is required");
        if (!formData.ground_code.trim()) return setError("Ground code is required");
        if (!formData.address.trim()) return setError("Address is required");
        if (formData.email.trim() && !/^\S+@\S+\.\S+$/.test(formData.email.trim())) {
            return setError("Please enter a valid email address");
        }

        try {
            setLoading(true);
            setError("");

            const res = await fetch(isEdit ? `/api/ground/${id}` : `/api/ground`, {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    academy_id: formData.academy_id,
                    branch_id: formData.branch_id,
                    ground_name: formData.ground_name.trim(),
                    ground_code: formData.ground_code.trim(),
                    contact_person: formData.contact_person.trim() || null,
                    phone: formData.phone.trim() || null,
                    email: formData.email.trim() || null,
                    address: formData.address.trim(),
                    description: formData.description.trim() || null,
                    ground_facility: formData.ground_facility.trim() || null,
                    status: formData.status,
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || "Something went wrong");
            }

            alert(isEdit ? "Ground updated successfully" : "Ground added successfully");

            router.push("/next_panel/grounds");
            router.refresh();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching || academiesLoading) {
        return <div className="text-center py-5">Loading...</div>;
    }

    return (
        <div className="card shadow-sm">
            <div className="card-header">
                <h5 className="mb-0">{isEdit ? "Edit Ground" : "Add Ground"}</h5>
            </div>

            <div className="card-body">
                {error && <div className="alert alert-danger">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label className="form-label">Academy</label>
                        <select
                            name="academy_id"
                            className="form-select"
                            value={formData.academy_id}
                            onChange={handleChange}
                            disabled={!isSuper && Boolean(userAcademyId)}
                            required
                        >
                            <option value="">Select Academy</option>
                            {academies.map((academy) => (
                                <option key={academy.id} value={academy.id}>
                                    {academy.academy_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="mb-3">
                        <label className="form-label">Branch</label>
                        <select
                            name="branch_id"
                            className="form-select"
                            value={formData.branch_id}
                            onChange={handleChange}
                            disabled={!formData.academy_id}
                            required
                        >
                            <option value="">
                                {formData.academy_id ? "Select Branch" : "Select an academy first"}
                            </option>
                            {filteredBranches.map((branch) => (
                                <option key={branch.id} value={branch.id}>
                                    {branch.branch_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Ground Name</label>
                            <input
                                type="text"
                                name="ground_name"
                                className="form-control"
                                value={formData.ground_name}
                                onChange={handleChange}
                                placeholder="Enter ground name"
                                required
                            />
                        </div>

                        <div className="col-md-6 mb-3">
                            <label className="form-label">Ground Code</label>
                            <div className="input-group">
                                <input
                                    type="text"
                                    name="ground_code"
                                    className="form-control"
                                    value={formData.ground_code}
                                    onChange={handleChange}
                                    placeholder="GD-CODE-001"
                                    disabled={isEdit}
                                    required
                                />
                                {!isEdit && (
                                    <button
                                        type="button"
                                        className="btn btn-outline-primary"
                                        onClick={handleGenerateCode}
                                        disabled={generating}
                                        title={`Generate next code (${suggestedGroundCode || "GD-CODE-001"})`}
                                    >
                                        <RefreshCw size={16} className={`me-1 ${generating ? "spin" : ""}`} />
                                        {generating ? "Generating..." : "Generate"}
                                    </button>
                                )}
                            </div>
                            {isEdit && (
                                <div className="form-text">Ground code cannot be changed after creation.</div>
                            )}
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Contact Person (optional)</label>
                            <input
                                type="text"
                                name="contact_person"
                                className="form-control"
                                value={formData.contact_person}
                                onChange={handleChange}
                                placeholder="Enter contact person"
                            />
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Phone (optional)</label>
                            <input
                                type="tel"
                                name="phone"
                                className="form-control"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="Enter phone number"
                            />
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Email (optional)</label>
                            <input
                                type="email"
                                name="email"
                                className="form-control"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="Enter email"
                            />
                        </div>
                    </div>

                    <div className="mb-3">
                        <label className="form-label">Address</label>
                        <textarea
                            name="address"
                            className="form-control"
                            rows={2}
                            value={formData.address}
                            onChange={handleChange}
                            placeholder="Enter full address"
                            required
                        />
                    </div>

                    <div className="mb-3">
                        <label className="form-label">Facilities (optional)</label>
                        <input
                            type="text"
                            name="ground_facility"
                            className="form-control"
                            value={formData.ground_facility}
                            onChange={handleChange}
                            placeholder="Comma separated, e.g. Floodlights, Parking, Washroom"
                        />
                        <div className="form-text">Separate each facility with a comma.</div>
                    </div>

                    <div className="mb-3">
                        <label className="form-label">Description (optional)</label>
                        <textarea
                            name="description"
                            className="form-control"
                            rows={3}
                            value={formData.description}
                            onChange={handleChange}
                            placeholder="Enter description"
                        />
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
                            {loading ? "Saving..." : isEdit ? "Update Ground" : "Add Ground"}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => router.push("/next_panel/grounds")}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
