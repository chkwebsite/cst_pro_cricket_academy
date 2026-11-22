"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { FormError, RequiredLabel } from "@/app/components/form";

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
    const [fieldErrors, setFieldErrors] = useState({});
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

        if (fieldErrors[name]) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }

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

    const handleBlur = (field) => () => {
        let err = null;
        if (field === "academy_id" && !formData.academy_id) err = "Please select an academy.";
        if (field === "program_name" && !formData.program_name?.trim()) err = "Program name is required.";
        if (field === "program_fee") {
            if (formData.program_fee === "" || formData.program_fee === null || formData.program_fee === undefined) {
                err = "Program fee is required.";
            } else if (isNaN(Number(formData.program_fee))) {
                err = "Program fee must be a valid number.";
            } else if (Number(formData.program_fee) < 0) {
                err = "Program fee cannot be negative.";
            }
        }
        if (err) {
            setFieldErrors((prev) => ({ ...prev, [field]: err }));
        }
    };

    const validateAll = () => {
        const errs = {};
        if (!formData.academy_id) errs.academy_id = "Please select an academy.";
        if (!formData.program_name?.trim()) errs.program_name = "Program name is required.";
        if (formData.program_fee === "" || formData.program_fee === null || formData.program_fee === undefined) {
            errs.program_fee = "Program fee is required.";
        } else if (isNaN(Number(formData.program_fee))) {
            errs.program_fee = "Program fee must be a valid number.";
        } else if (Number(formData.program_fee) < 0) {
            errs.program_fee = "Program fee cannot be negative.";
        }
        if (formData.registration_fee !== "" && Number(formData.registration_fee) < 0) {
            errs.registration_fee = "Fee cannot be negative.";
        }
        if (formData.daily_fee !== "" && Number(formData.daily_fee) < 0) {
            errs.daily_fee = "Fee cannot be negative.";
        }
        if (formData.kit_fee !== "" && Number(formData.kit_fee) < 0) {
            errs.kit_fee = "Fee cannot be negative.";
        }

        setFieldErrors(errs);
        if (Object.keys(errs).length > 0) {
            const firstKey = Object.keys(errs)[0];
            const el = document.querySelector(`[name="${firstKey}"]`);
            if (el) {
                el.focus();
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            return false;
        }
        return true;
    };

    // HANDLE IMAGE PICK
    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
            if (!allowed.includes(file.type)) {
                setFieldErrors((prev) => ({ ...prev, program_image: "Only JPG, JPEG, PNG, WEBP and GIF images are allowed." }));
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                setFieldErrors((prev) => ({ ...prev, program_image: "Image size must be less than 2MB." }));
                return;
            }
            if (fieldErrors.program_image) {
                setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.program_image;
                    return next;
                });
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

        if (!validateAll()) {
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
            payload.append("program_fee", formData.program_fee);
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
                if (data.errors) {
                    setFieldErrors(data.errors);
                    const firstKey = Object.keys(data.errors)[0];
                    const el = document.querySelector(`[name="${firstKey}"]`);
                    if (el) {
                        el.focus();
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                }
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
                        <label className="form-label fw-semibold">Program Image</label>
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
                                <small className="text-muted">JPG, PNG, WEBP or GIF. Max 2MB.</small>
                                <FormError error={fieldErrors.program_image} />
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
                            <label className="form-label">Academy <span className="text-danger ms-1">*</span></label>
                            <select
                                name="academy_id"
                                className={`form-select ${fieldErrors.academy_id ? "is-invalid border-danger" : ""}`}
                                value={formData.academy_id}
                                onChange={handleChange}
                                onBlur={handleBlur("academy_id")}
                                required
                            >
                                <option value="">Select Academy</option>
                                {academies.map((academy) => (
                                    <option key={academy.id} value={academy.id}>
                                        {academy.academy_name}
                                    </option>
                                ))}
                            </select>
                            <FormError error={fieldErrors.academy_id} />
                        </div>

                        {/* Branch */}
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Branch</label>
                            <select
                                name="branch_id"
                                className={`form-select ${fieldErrors.branch_id ? "is-invalid border-danger" : ""}`}
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
                            <FormError error={fieldErrors.branch_id} />
                        </div>
                    </div>

                    <div className="row">
                        {/* Program Name */}
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Program Name <span className="text-danger ms-1">*</span></label>
                            <input
                                type="text"
                                name="program_name"
                                className={`form-control ${fieldErrors.program_name ? "is-invalid border-danger" : ""}`}
                                value={formData.program_name}
                                onChange={handleChange}
                                onBlur={handleBlur("program_name")}
                                placeholder="Enter Program name"
                                required
                            />
                            <FormError error={fieldErrors.program_name} />
                        </div>

                        {/* Program Code */}
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Program Code</label>
                            <input
                                type="text"
                                name="program_code"
                                className={`form-control ${fieldErrors.program_code ? "is-invalid border-danger" : ""}`}
                                value={formData.program_code}
                                onChange={handleChange}
                                placeholder="Enter Program code"
                            />
                            <FormError error={fieldErrors.program_code} />
                        </div>
                    </div>

                    {/* Program Features */}
                    <div className="mb-3">
                        <label className="form-label">Program Features</label>
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
                        <label className="form-label">Description</label>
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
                            <label className="form-label">
                                Program Fee <span className="text-danger ms-1">*</span>
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                name="program_fee"
                                className={`form-control ${fieldErrors.program_fee ? "is-invalid border-danger" : ""}`}
                                value={formData.program_fee}
                                onChange={handleChange}
                                onBlur={handleBlur("program_fee")}
                                placeholder="0.00"
                                required
                            />
                            <FormError error={fieldErrors.program_fee} />
                        </div>

                        {/* Registration Fee */}
                        <div className="col-md-3 mb-3">
                            <label className="form-label">Registration Fee</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                name="registration_fee"
                                className={`form-control ${fieldErrors.registration_fee ? "is-invalid border-danger" : ""}`}
                                value={formData.registration_fee}
                                onChange={handleChange}
                                placeholder="0.00"
                            />
                            <FormError error={fieldErrors.registration_fee} />
                        </div>

                        {/* Daily Fee */}
                        <div className="col-md-3 mb-3">
                            <label className="form-label">Daily Fee</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                name="daily_fee"
                                className={`form-control ${fieldErrors.daily_fee ? "is-invalid border-danger" : ""}`}
                                value={formData.daily_fee}
                                onChange={handleChange}
                                placeholder="0.00"
                            />
                            <FormError error={fieldErrors.daily_fee} />
                        </div>

                        {/* Kit Fee */}
                        <div className="col-md-3 mb-3">
                            <label className="form-label">Kit Fee</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                name="kit_fee"
                                className={`form-control ${fieldErrors.kit_fee ? "is-invalid border-danger" : ""}`}
                                value={formData.kit_fee}
                                onChange={handleChange}
                                placeholder="0.00"
                            />
                            <FormError error={fieldErrors.kit_fee} />
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
