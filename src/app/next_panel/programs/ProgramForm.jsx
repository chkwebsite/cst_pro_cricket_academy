"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";

const EMPTY_FORM = {
    academy_id: "",
    branch_id: "",
    program_name: "",
    program_code: "",
    program_features: "",
    description: "",
    program_fee: "",
    registration_fee: "",
    daily_fee: "",
    kit_fee: "",
    status: 1,
};

export default function ProgramForm({ id = null }) {
    const router = useRouter();
    const fileInputRef = useRef(null);

    const [formData, setFormData] = useState(EMPTY_FORM);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    const [academies, setAcademies] = useState([]);
    const [branches, setBranches] = useState([]);

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [academiesLoading, setAcademiesLoading] = useState(true);
    const [error, setError] = useState("");
    const isEdit = Boolean(id);

    // LOAD ACADEMIES (once)
    useEffect(() => {
        const loadAcademies = async () => {
            setAcademiesLoading(true);
            try {
                const res = await fetch("/api/academies");
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to load academies");
                }
                if (res.ok && json.success) {
                    const acd = (json.data || []).filter(
                        (itm) => Number(itm.status) === 1
                    );

                    setAcademies(acd || []);
                }
            } catch (error) {
                setError(error.message);
            } finally {
                setAcademiesLoading(false);
            }
        };
        loadAcademies();
    }, []);

    // LOAD BRANCHES WHENEVER SELECTED ACADEMY CHANGES
    useEffect(() => {
        if (!formData.academy_id) {
            setBranches([]);
            return;
        }
        const loadBranches = async () => {
            try {
                const res = await fetch(`/api/branch?academy_id=${formData.academy_id}`);
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to load branches");
                }
                setBranches(json.data || []);
            } catch (error) {
                setError(error.message);
            }
        };
        loadBranches();
    }, [formData.academy_id]);

    // GET SINGLE PROGRAM (edit mode)
    useEffect(() => {
        if (!id) return;
        const getProgram = async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/programs/${id}`);
                const result = await res.json();
                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Failed to fetch Program");
                }
                const data = result.data;
                setFormData({
                    academy_id: data.academy_id ?? "",
                    branch_id: data.branch_id ?? "",
                    program_name: data.program_name || "",
                    program_code: data.program_code || "",
                    program_features: data.program_features || "",
                    description: data.description || "",
                    program_fee: data.program_fee ?? "",
                    registration_fee: data.registration_fee ?? "",
                    daily_fee: data.daily_fee ?? "",
                    kit_fee: data.kit_fee ?? "",
                    status: data.status ?? 1,
                });

                if (data.program_image) {
                    setImagePreview(
                        data.program_image.startsWith("/")
                            ? data.program_image
                            : `/images/uploads/programs/${data.program_image}`
                    );
                } else {
                    setImagePreview(null);
                }
            } catch (error) {
                setError(error.message);
            } finally {
                setFetching(false);
            }
        };
        getProgram();
    }, [id]);

    // HANDLE INPUT
    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === "academy_id") {
            // changing academy invalidates the previously selected branch
            setFormData((prev) => ({
                ...prev,
                academy_id: value === "" ? "" : Number(value),
                branch_id: "",
            }));
            return;
        }

        if (name === "branch_id" || name === "status") {
            setFormData((prev) => ({
                ...prev,
                [name]: value === "" ? "" : Number(value),
            }));
            return;
        }

        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    // HANDLE IMAGE PICK
    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
            if (!allowed.includes(file.type)) {
                setError("Only JPG, JPEG, PNG, WEBP and GIF images are allowed");
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                setError("Image size must be less than 5MB");
                return;
            }
            setError("");
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    // REMOVE IMAGE
    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // SUBMIT
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.academy_id) {
            setError("Please select an academy");
            return;
        }
        if (!formData.program_name.trim()) {
            setError("Program name is required");
            return;
        }

        try {
            setLoading(true);
            setError("");

            const url = isEdit
                ? `/api/programs/${id}`
                : `/api/programs`;

            const method = isEdit ? "PUT" : "POST";

            const payload = new FormData();
            payload.append("academy_id", formData.academy_id);
            if (formData.branch_id) {
                payload.append("branch_id", formData.branch_id);
            }
            payload.append("program_name", formData.program_name.trim());
            if (formData.program_code && formData.program_code.trim()) {
                payload.append("program_code", formData.program_code.trim());
            }
            if (formData.program_features && formData.program_features.trim()) {
                payload.append("program_features", formData.program_features.trim());
            } else {
                payload.append("program_features", "");
            }
            if (formData.description && formData.description.trim()) {
                payload.append("description", formData.description.trim());
            }
            payload.append("program_fee", formData.program_fee === "" ? "0" : formData.program_fee);
            payload.append("registration_fee", formData.registration_fee === "" ? "0" : formData.registration_fee);
            payload.append("daily_fee", formData.daily_fee === "" ? "0" : formData.daily_fee);
            payload.append("kit_fee", formData.kit_fee === "" ? "0" : formData.kit_fee);
            payload.append("status", String(formData.status));

            if (imageFile) {
                payload.append("program_image", imageFile);
            } else if (!imagePreview) {
                // user removed image or no image set
                payload.append("program_image", "");
            }

            const res = await fetch(url, {
                method,
                body: payload,
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || "Something went wrong");
            }

            alert(
                isEdit
                    ? "Program updated successfully"
                    : "Program added successfully"
            );

            router.push("/next_panel/programs");
            router.refresh();

        } catch (error) {
            setError(error.message);

        } finally {
            setLoading(false);
        }
    };

    if (fetching || academiesLoading) {
        return (
            <div className="text-center py-5">
                Loading...
            </div>
        );
    }

    return (
        <div className="card shadow-sm">
            <div className="card-header">
                <h5 className="mb-0">
                    {isEdit ? "Edit Program" : "Add Program"}
                </h5>
            </div>

            <div className="card-body">

                {error && (
                    <div className="alert alert-danger">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>

                    {/* Program Image */}
                    <div className="mb-4">
                        <label className="form-label fw-semibold">Program Image (optional)</label>
                        <div className="d-flex align-items-center gap-3">
                            <div
                                className="d-flex align-items-center justify-content-center bg-light rounded-3 border overflow-hidden flex-shrink-0"
                                style={{ width: 88, height: 88 }}
                            >
                                {imagePreview ? (
                                    <img
                                        src={imagePreview}
                                        alt="Program preview"
                                        className="w-100 h-100"
                                        style={{ objectFit: "cover" }}
                                    />
                                ) : (
                                    <ImageIcon size={32} className="text-muted" />
                                )}
                            </div>
                            <div className="d-flex flex-column gap-2">
                                <div className="d-flex gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary btn-sm"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={loading}
                                    >
                                        <Upload size={14} className="me-1" />
                                        {imagePreview ? "Change Image" : "Upload Image"}
                                    </button>
                                    {imagePreview && (
                                        <button
                                            type="button"
                                            className="btn btn-outline-danger btn-sm"
                                            onClick={handleRemoveImage}
                                            disabled={loading}
                                        >
                                            <X size={14} className="me-1" /> Remove
                                        </button>
                                    )}
                                </div>
                                <small className="text-muted">JPG, PNG, WEBP or GIF. Max 5MB.</small>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                                className="d-none"
                                onChange={handleImageChange}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className="row">
                        {/* Academy */}
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Academy</label>
                            <select
                                name="academy_id"
                                className="form-select"
                                value={formData.academy_id}
                                onChange={handleChange}
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

                        {/* Branch */}
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Branch (optional)</label>
                            <select
                                name="branch_id"
                                className="form-select"
                                value={formData.branch_id}
                                onChange={handleChange}
                                disabled={!formData.academy_id}
                            >
                                <option value="">Select Branch</option>
                                {branches.map((branch) => (
                                    <option key={branch.id} value={branch.id}>
                                        {branch.branch_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="row">
                        {/* Program Name */}
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Program Name</label>
                            <input
                                type="text"
                                name="program_name"
                                className="form-control"
                                value={formData.program_name}
                                onChange={handleChange}
                                placeholder="Enter Program name"
                                required
                            />
                        </div>

                        {/* Program Code */}
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Program Code (optional)</label>
                            <input
                                type="text"
                                name="program_code"
                                className="form-control"
                                value={formData.program_code}
                                onChange={handleChange}
                                placeholder="Enter Program code"
                            />
                        </div>
                    </div>

                    {/* Program Features */}
                    <div className="mb-3">
                        <label className="form-label">Program Features (optional)</label>
                        <textarea
                            name="program_features"
                            className="form-control"
                            rows={3}
                            value={formData.program_features}
                            onChange={handleChange}
                            placeholder="Enter key features (e.g. Dedicated coach, Video analysis, Flexible timings)"
                        />
                        <div className="form-text text-muted">
                            Add key features for this program (comma-separated or line-by-line).
                        </div>
                    </div>

                    {/* Description */}
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

                    <div className="row">
                        {/* Program Fee */}
                        <div className="col-md-3 mb-3">
                            <label className="form-label">Program Fee</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                name="program_fee"
                                className="form-control"
                                value={formData.program_fee}
                                onChange={handleChange}
                                placeholder="0.00"
                            />
                        </div>

                        {/* Registration Fee */}
                        <div className="col-md-3 mb-3">
                            <label className="form-label">Registration Fee</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                name="registration_fee"
                                className="form-control"
                                value={formData.registration_fee}
                                onChange={handleChange}
                                placeholder="0.00"
                            />
                        </div>

                        {/* Daily Fee */}
                        <div className="col-md-3 mb-3">
                            <label className="form-label">Daily Fee</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                name="daily_fee"
                                className="form-control"
                                value={formData.daily_fee}
                                onChange={handleChange}
                                placeholder="0.00"
                            />
                        </div>

                        {/* Kit Fee */}
                        <div className="col-md-3 mb-3">
                            <label className="form-label">Kit Fee</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                name="kit_fee"
                                className="form-control"
                                value={formData.kit_fee}
                                onChange={handleChange}
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    {/* Status */}
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

                    {/* Buttons */}
                    <div className="d-flex gap-2">
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading
                                ? "Saving..."
                                : isEdit
                                    ? "Update Program"
                                    : "Add Program"
                            }
                        </button>

                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() =>
                                router.push("/next_panel/programs")
                            }
                        >
                            Cancel
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
