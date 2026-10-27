"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

    // SUBMIT
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.age_group.trim()) {
            setError("Age group is required");
            return;
        }

        if (
            formData.min_age !== "" &&
            formData.max_age !== "" &&
            Number(formData.min_age) > Number(formData.max_age)
        ) {
            setError("Minimum age cannot be greater than maximum age");
            return;
        }

        try {
            setLoading(true);
            setError("");

            const url = isEdit
                ? `/api/age-groups/${id}`
                : `/api/age-groups`;

            const method = isEdit ? "PUT" : "POST";

            const payload = {
                age_group: formData.age_group.trim(),
                min_age: formData.min_age === "" ? null : Number(formData.min_age),
                max_age: formData.max_age === "" ? null : Number(formData.max_age),
                status: formData.status,
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

                <form onSubmit={handleSubmit}>

                    {/* Age Group Name */}
                    <div className="mb-3">
                        <label className="form-label">Age Group Name</label>
                        <input
                            type="text"
                            name="age_group"
                            className="form-control"
                            value={formData.age_group}
                            onChange={handleChange}
                            placeholder="e.g. Toddlers, Teens"
                            required
                        />
                    </div>

                    <div className="row">
                        {/* Min Age */}
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Minimum Age (optional)</label>
                            <input
                                type="number"
                                min="0"
                                name="min_age"
                                className="form-control"
                                value={formData.min_age}
                                onChange={handleChange}
                                placeholder="e.g. 3"
                            />
                        </div>

                        {/* Max Age */}
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Maximum Age (optional)</label>
                            <input
                                type="number"
                                min="0"
                                name="max_age"
                                className="form-control"
                                value={formData.max_age}
                                onChange={handleChange}
                                placeholder="e.g. 6"
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
