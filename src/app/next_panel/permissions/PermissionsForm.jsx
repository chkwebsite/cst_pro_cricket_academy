"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function PermissionsForm({ id = null }) {
    const router = useRouter();

    const [formData, setFormData] = useState({
        module_name: "",
        permission_name: "",
        status: ""
    });
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState("");
    const isEdit = Boolean(id);

    //GET SINGLE PERMISSION
    useEffect(() => {
        if (!id) return;
        const getPermission = async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/permissions/${id}`);
                const result = await res.json();
                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Failed to fetch Permission");
                }
                const data = result.data || result; // adjust based on actual API response shape
                setFormData({
                    module_name: data.module_name || "",
                    permission_name: data.permission_name || "",
                    status: data.status ?? 1
                });
            } catch (error) {
                setError(error.message);
            } finally {
                setFetching(false);
            }
        };
        getPermission();
    }, [id]);

    // HANDLE INPUT
    console.log(id);
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: name === "status" ? Number(value) : value,
        }))
    }

    // SUBMIT

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            setLoading(true);
            setError("");

            const url = isEdit
                ? `/api/permissions/${id}`
                : `/api/permissions`;

            const method = isEdit ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.message || "Something went wrong"
                );
            }

            alert(
                isEdit
                    ? "Permission updated successfully"
                    : "Permission added successfully"
            );

            router.push("/next_panel/permissions");
            router.refresh();

        } catch (error) {
            setError(error.message);

        } finally {
            setLoading(false);
        }
    };

    // LOADING EDIT DATA

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
                    {isEdit ? "Edit Permission" : "Add Permission"}
                </h5>
            </div>

            <div className="card-body">

                {error && (
                    <div className="alert alert-danger">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>

                    {/* Permission Name */}
                    <div className="mb-3">
                        <label className="form-label">
                            Module name
                        </label>

                        <input
                            type="text"
                            name="module_name"
                            className="form-control"
                            value={formData.module_name}
                            onChange={handleChange}
                            placeholder="Enter Module name"
                            required
                        />
                    </div>

                    <div className="mb-3">
                        <label className="form-label">
                            Permission name
                        </label>

                        <input
                            type="text"
                            name="permission_name"
                            className="form-control"
                            value={formData.permission_name}
                            onChange={handleChange}
                            placeholder="Enter Permission name"
                            required
                        />
                    </div>

                    {/* Status */}
                    <div className="mb-3">
                        <label className="form-label">
                            Status
                        </label>

                        <select
                            name="status"
                            className="form-select"
                            value={formData.status}
                            onChange={handleChange}
                        >
                            <option>Select Status</option>
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
                                    ? "Update Permission"
                                    : "Add Permission"
                            }
                        </button>

                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() =>
                                router.push("/next_panel/permissions")
                            }
                        >
                            Cancel
                        </button>

                    </div>

                </form>
            </div>
        </div>
    )
}