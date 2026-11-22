"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FormError, RequiredLabel } from "@/app/components/form";

const EMPTY_FORM = {
    age_group: "",
    min_age: "",
    max_age: "",
    status: 1,
};

export default function AgeGroupForm({ id = null }) {
    const router = useRouter();

    const [formData, setFormData] = useState(EMPTY_FORM);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const isEdit = Boolean(id);

    // GET SINGLE AGE GROUP (edit mode)
    useEffect(() => {
        if (!id) return;
        const getAgeGroup = async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/age-groups/${id}`);
                const result = await res.json();
                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Failed to fetch Age Group");
                }
                const data = result.data;
                setFormData({
                    age_group: data.age_group || "",
                    min_age: data.min_age ?? "",
                    max_age: data.max_age ?? "",
                    status: data.status ?? 1,
                });
            } catch (error) {
                setError(error.message);
            } finally {
                setFetching(false);
            }
        };
        getAgeGroup();
    }, [id]);

    // HANDLE INPUT
    const handleChange = (e) => {
        const { name, value } = e.target;

        if (fieldErrors[name]) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next[name];
                if ((name === "min_age" || name === "max_age") && next.min_age === "Minimum age cannot be greater than maximum age.") {
                    delete next.min_age;
                }
                return next;
            });
        }

        if (name === "status") {
            setFormData((prev) => ({
                ...prev,
                status: Number(value),
            }));
            return;
        }

        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        if (name === "age_group" && !value.trim()) {
            setFieldErrors((prev) => ({ ...prev, age_group: "Age group name is required." }));
        }
        if (name === "min_age") {
            if (value === "" || value === null || value === undefined) {
                setFieldErrors((prev) => ({ ...prev, min_age: "Minimum age is required." }));
            } else if (Number(value) < 0) {
                setFieldErrors((prev) => ({ ...prev, min_age: "Minimum age cannot be negative." }));
            } else if (
                formData.max_age !== "" &&
                formData.max_age !== null &&
                formData.max_age !== undefined &&
                Number(value) > Number(formData.max_age)
            ) {
                setFieldErrors((prev) => ({ ...prev, min_age: "Minimum age cannot be greater than maximum age." }));
            } else {
                setFieldErrors((prev) => {
                    const next = { ...prev };
                    if (next.min_age) delete next.min_age;
                    return next;
                });
            }
        }
        if (name === "max_age") {
            if (value === "" || value === null || value === undefined) {
                setFieldErrors((prev) => ({ ...prev, max_age: "Maximum age is required." }));
            } else if (Number(value) < 0) {
                setFieldErrors((prev) => ({ ...prev, max_age: "Maximum age cannot be negative." }));
            } else if (
                formData.min_age !== "" &&
                formData.min_age !== null &&
                formData.min_age !== undefined &&
                Number(formData.min_age) > Number(value)
            ) {
                setFieldErrors((prev) => ({ ...prev, min_age: "Minimum age cannot be greater than maximum age." }));
            } else {
                setFieldErrors((prev) => {
                    const next = { ...prev };
                    if (next.max_age) delete next.max_age;
                    if (next.min_age === "Minimum age cannot be greater than maximum age.") {
                        delete next.min_age;
                    }
                    return next;
                });
            }
        }
    };

    // SUBMIT
    const handleSubmit = async (e) => {
        e.preventDefault();

        const errs = {};
        if (!formData.age_group.trim()) {
            errs.age_group = "Age group name is required.";
        }

        if (formData.min_age === "" || formData.min_age === null || formData.min_age === undefined) {
            errs.min_age = "Minimum age is required.";
        } else if (Number(formData.min_age) < 0) {
            errs.min_age = "Minimum age cannot be negative.";
        }

        if (formData.max_age === "" || formData.max_age === null || formData.max_age === undefined) {
            errs.max_age = "Maximum age is required.";
        } else if (Number(formData.max_age) < 0) {
            errs.max_age = "Maximum age cannot be negative.";
        }

        if (!errs.min_age && !errs.max_age && Number(formData.min_age) > Number(formData.max_age)) {
            errs.min_age = "Minimum age cannot be greater than maximum age.";
        }

        if (Object.keys(errs).length > 0) {
            setFieldErrors(errs);
            const firstKey = Object.keys(errs)[0];
            const el = document.querySelector(`[name="${firstKey}"]`);
            if (el) {
                el.focus();
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            return;
        }

        try {
            setLoading(true);
            setError("");
            setFieldErrors({});

            const url = isEdit
                ? `/api/age-groups/${id}`
                : `/api/age-groups`;

            const method = isEdit ? "PUT" : "POST";

            const payload = {
                age_group: formData.age_group.trim(),
                min_age: Number(formData.min_age),
                max_age: Number(formData.max_age),
                status: Number(formData.status),
            };

            const res = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
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
                    ? "Age group updated successfully"
                    : "Age group added successfully"
            );

            router.push("/next_panel/age-groups");
            router.refresh();

        } catch (error) {
            setError(error.message);

        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
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
                    {isEdit ? "Edit Age Group" : "Add Age Group"}
                </h5>
            </div>

            <div className="card-body">

                {error && (
                    <div className="alert alert-danger">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate>

                    {/* Age Group Name */}
                    <div className="mb-3">
                        <label className="form-label fw-semibold">
                            Age Group Name <span style={{ color: "#dc3545" }}>*</span>
                        </label>
                        <input
                            type="text"
                            name="age_group"
                            className={`form-control ${fieldErrors.age_group ? "is-invalid border-danger" : ""}`}
                            value={formData.age_group}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            placeholder="e.g. Toddlers, Teens"
                        />
                        <FormError error={fieldErrors.age_group} />
                    </div>

                    <div className="row">
                        {/* Min Age */}
                        <div className="col-md-6 mb-3">
                            <label className="form-label fw-semibold">
                                Minimum Age <span style={{ color: "#dc3545" }}>*</span>
                            </label>
                            <input
                                type="number"
                                min="0"
                                name="min_age"
                                className={`form-control ${fieldErrors.min_age ? "is-invalid border-danger" : ""}`}
                                value={formData.min_age}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                placeholder="e.g. 3"
                            />
                            <FormError error={fieldErrors.min_age} />
                        </div>

                        {/* Max Age */}
                        <div className="col-md-6 mb-3">
                            <label className="form-label fw-semibold">
                                Maximum Age <span style={{ color: "#dc3545" }}>*</span>
                            </label>
                            <input
                                type="number"
                                min="0"
                                name="max_age"
                                className={`form-control ${fieldErrors.max_age ? "is-invalid border-danger" : ""}`}
                                value={formData.max_age}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                placeholder="e.g. 6"
                            />
                            <FormError error={fieldErrors.max_age} />
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
                                    ? "Update Age Group"
                                    : "Add Age Group"
                            }
                        </button>

                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() =>
                                router.push("/next_panel/age-groups")
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
