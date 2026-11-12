"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function RolePermissionForm({ id = null }) {
    const router = useRouter();

    const [formData, setFormData] = useState({
        role_id: "",
        permission_id: "",
    });

    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [optionsLoading, setOptionsLoading] = useState(true);
    const [error, setError] = useState("");
    const isEdit = Boolean(id);

    // LOAD DROPDOWN OPTIONS (roles + permissions)
    useEffect(() => {
        const loadOptions = async () => {
            setOptionsLoading(true);
            try {
                const [rolesRes, permissionsRes] = await Promise.all([
                    fetch("/api/roles"),
                    fetch("/api/permissions"),
                ]);

                const rolesJson = await rolesRes.json();
                const permissionsJson = await permissionsRes.json();

                if (!rolesRes.ok || !rolesJson.success) {
                    throw new Error(rolesJson.message || "Failed to load roles");
                }
                if (!permissionsRes.ok || !permissionsJson.success) {
                    throw new Error(permissionsJson.message || "Failed to load permissions");
                }

                setRoles(rolesJson.data || []);
                setPermissions(permissionsJson.data || []);
            } catch (error) {
                setError(error.message);
            } finally {
                setOptionsLoading(false);
            }
        };
        loadOptions();
    }, []);

    // GET SINGLE ROLE PERMISSION (edit mode)
    useEffect(() => {
        if (!id) return;
        const getRolePermission = async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/role-permissions/${id}`);
                const result = await res.json();
                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Failed to fetch Role Permission");
                }
                const data = result.data;
                setFormData({
                    role_id: data.role_id ?? "",
                    permission_id: data.permission_id ?? "",
                });
            } catch (error) {
                setError(error.message);
            } finally {
                setFetching(false);
            }
        };
        getRolePermission();
    }, [id]);

    // HANDLE INPUT
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value === "" ? "" : Number(value),
        }));
    };

    // SUBMIT
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.role_id || !formData.permission_id) {
            setError("Please select both a role and a permission");
            return;
        }

        try {
            setLoading(true);
            setError("");

            const url = isEdit
                ? `/api/role-permissions/${id}`
                : `/api/role-permissions`;

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
                throw new Error(data.message || "Something went wrong");
            }

            alert(
                isEdit
                    ? "Role permission updated successfully"
                    : "Permission assigned to role successfully"
            );

            router.push("/next_panel/role-permissions");
            router.refresh();

        } catch (error) {
            setError(error.message);

        } finally {
            setLoading(false);
        }
    };

    if (fetching || optionsLoading) {
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
                    {isEdit ? "Edit Role Permission" : "Assign Permission to Role"}
                </h5>
            </div>

            <div className="card-body">

                {error && (
                    <div className="alert alert-danger">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>

                    {/* Role */}
                    <div className="mb-3">
                        <label className="form-label">
                            Role
                        </label>

                        <select
                            name="role_id"
                            className="form-select"
                            value={formData.role_id}
                            onChange={handleChange}
                            required
                        >
                            <option value="">Select Role</option>
                            {roles.map((role) => (
                                <option key={role.id} value={role.id}>
                                    {role.role_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Permission */}
                    <div className="mb-3">
                        <label className="form-label">
                            Permission
                        </label>

                        <select
                            name="permission_id"
                            className="form-select"
                            value={formData.permission_id}
                            onChange={handleChange}
                            required
                        >
                            <option value="">Select Permission</option>
                            {permissions.map((permission) => (
                                <option key={permission.id} value={permission.id}>
                                    {permission.module_name} - {permission.permission_name}
                                </option>
                            ))}
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
                                    ? "Update Role Permission"
                                    : "Assign Permission"
                            }
                        </button>

                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() =>
                                router.push("/next_panel/role-permissions")
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
