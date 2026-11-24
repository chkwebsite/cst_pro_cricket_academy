"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FormError, RequiredLabel } from "@/app/components/form";

export default function PermissionsForm({ id = null }) {
    const router = useRouter();

    const [formData, setFormData] = useState({
        module_name: "",
        permission_name: "",
        status: 1
    });
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const isEdit = Boolean(id);

    const clearError = (name) => {
        if (fieldErrors[name]) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }
    };

    const validateField = (name, value) => {
        switch (name) {
            case "module_name":
                return !String(value || "").trim() ? "Module name is required." : "";
            case "permission_name":
                return !String(value || "").trim() ? "Permission name is required." : "";
            default:
                return "";
        }
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        const err = validateField(name, value);
        if (err) {
            setFieldErrors((prev) => ({ ...prev, [name]: err }));
        }
    };

    const validateAll = () => {
        const errs = {};
        const modErr = validateField("module_name", formData.module_name);
        if (modErr) errs.module_name = modErr;
        const permErr = validateField("permission_name", formData.permission_name);
        if (permErr) errs.permission_name = permErr;

        setFieldErrors(errs);

        if (Object.keys(errs).length > 0) {
            const firstKey = Object.keys(errs)[0];
            const el = document.querySelector(`[name="${firstKey}"]`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.focus();
            }
            return false;
        }
        return true;
    };

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
                const data = result.data || result;
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
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: name === "status" ? Number(value) : value,
        }));
        clearError(name);
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

            if (!res.ok || !data.success) {
                if (data.errors) {
                    setFieldErrors(data.errors);
                    const firstKey = Object.keys(data.errors)[0];
                    if (firstKey) {
                        const el = document.querySelector(`[name="${firstKey}"]`);
                        if (el) {
                            el.scrollIntoView({ behavior: "smooth", block: "center" });
                            el.focus();
                        }
                    }
                }
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
                    {/* Module Name */}
                    <div className="mb-3">
                        <label className="form-label">
                            Module name <RequiredLabel />
                        </label>

                        <input
                            type="text"
                            name="module_name"
                            className={`form-control ${fieldErrors.module_name ? "is-invalid border-danger" : ""}`}
                            value={formData.module_name}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            placeholder="Enter Module name"
                        />
                        <FormError error={fieldErrors.module_name} />
                    </div>

                    {/* Permission Name */}
                    <div className="mb-3">
                        <label className="form-label">
                            Permission name <RequiredLabel />
                        </label>

                        <input
                            type="text"
                            name="permission_name"
                            className={`form-control ${fieldErrors.permission_name ? "is-invalid border-danger" : ""}`}
                            value={formData.permission_name}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            placeholder="Enter Permission name"
                        />
                        <FormError error={fieldErrors.permission_name} />
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
    );
}