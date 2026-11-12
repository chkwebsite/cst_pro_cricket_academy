"use client";

import { useEffect, useState } from "react";

const emptyRole = {
    role_name: "",
    role_desc: "",
    academy_id: "",
    branch_id: "",
    status: 1,
};

export function getEmptyRole() {
    return { ...emptyRole };
}

// Builds the JSON payload matching the /api/roles route contract.
// academy_id / branch_id are sent as null when left unselected (global role).
export function buildRolePayload(values) {
    return {
        role_name: values.role_name.trim(),
        role_desc: values.role_desc.trim() || null,
        academy_id: values.academy_id ? Number(values.academy_id) : null,
        branch_id: values.branch_id ? Number(values.branch_id) : null,
        status: Number(values.status),
    };
}

export default function RoleForm({
    formId,
    values,
    onChange,
    onSubmit,
    error,
    loading = false,
}) {
    const [academies, setAcademies] = useState([]);
    const [academiesLoading, setAcademiesLoading] = useState(true);
    const [branches, setBranches] = useState([]);
    const [branchesLoading, setBranchesLoading] = useState(false);
    const [listError, setListError] = useState(null);

    useEffect(() => {
        async function loadAcademies() {
            setAcademiesLoading(true);

            try {
                const res = await fetch("/api/academies?status=1");
                const json = await res.json();
                if (!res.ok) throw new Error(json.message || "Unable to load academies.");
                setAcademies(json.data || []);
            } catch (err) {
                setListError(err.message);
            } finally {
                setAcademiesLoading(false);
            }
        }

        loadAcademies();
    }, []);

    // Reload branches whenever the selected academy changes.
    useEffect(() => {
        if (!values.academy_id) {
            setBranches([]);
            return;
        }

        async function loadBranches() {
            setBranchesLoading(true);

            try {
                const res = await fetch(`/api/branch?academy_id=${values.academy_id}&status=1`);
                const json = await res.json();
                if (!res.ok) throw new Error(json.message || "Unable to load branches.");
                setBranches(json.data || []);
            } catch (err) {
                setListError(err.message);
            } finally {
                setBranchesLoading(false);
            }
        }

        loadBranches();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [values.academy_id]);

    const handleChange = (field) => (event) => {
        const value = field === "status" ? Number(event.target.value) : event.target.value;

        if (field === "academy_id") {
            // Changing (or clearing) the academy invalidates the previously selected branch.
            onChange({ ...values, academy_id: value, branch_id: "" });
            return;
        }

        onChange({ ...values, [field]: value });
    };

    return (
        <form id={formId} onSubmit={onSubmit}>
            {error && <div className="alert alert-danger">{error}</div>}
            {listError && <div className="alert alert-warning">{listError}</div>}

            <div className="row g-3">
                <div className="col-md-6">
                    <label className="form-label">Role Name</label>
                    <input
                        className="form-control"
                        value={values.role_name}
                        onChange={handleChange("role_name")}
                        required
                        disabled={loading}
                    />
                </div>

                <div className="col-md-6">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={values.status} onChange={handleChange("status")} disabled={loading}>
                        <option value={1}>Active</option>
                        <option value={0}>Inactive</option>
                    </select>
                </div>

                <div className="col-12">
                    <label className="form-label">Description</label>
                    <textarea className="form-control" rows={3} value={values.role_desc} onChange={handleChange("role_desc")} disabled={loading} />
                </div>

                <div className="col-md-6">
                    <label className="form-label">Academy</label>
                    <select
                        className="form-select"
                        value={values.academy_id}
                        onChange={handleChange("academy_id")}
                        disabled={loading || academiesLoading}
                    >
                        <option value="0">{academiesLoading ? "Loading academies..." : "Global (All Academies)"}</option>
                        {academies.map((academy) => (
                            <option key={academy.id} value={academy.id}>
                                {academy.academy_name} ({academy.academy_code})
                            </option>
                        ))}
                    </select>
                    <small className="text-muted">Leave unselected to make this role available across all academies.</small>
                </div>

                <div className="col-md-6">
                    <label className="form-label">Branch</label>
                    <select
                        className="form-select"
                        value={values.branch_id}
                        onChange={handleChange("branch_id")}
                        disabled={loading || !values.academy_id || branchesLoading}
                    >
                        <option value="">
                            {!values.academy_id
                                ? "Select an academy first"
                                : branchesLoading
                                ? "Loading branches..."
                                : "All Branches"}
                        </option>
                        {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                                {branch.branch_name} ({branch.branch_code})
                            </option>
                        ))}
                    </select>
                    <small className="text-muted">Leave unselected to apply this role to the whole academy.</small>
                </div>
            </div>
        </form>
    );
}
