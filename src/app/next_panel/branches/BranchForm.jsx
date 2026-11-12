"use client";

import { useEffect, useState } from "react";

const emptyBranch = {
    academy_id: "",
    branch_name: "",
    branch_code: "",
    directions: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pin_code: "",
    status: 1,
};

export function getEmptyBranch() {
    return { ...emptyBranch };
}

// Builds the JSON payload matching the /api/branch route contract.
export function buildBranchPayload(values) {
    return {
        academy_id: Number(values.academy_id),
        branch_name: values.branch_name.trim(),
        branch_code: values.branch_code.trim(),
        directions: values.directions?.trim() || null,
        email: values.email?.trim() || null,
        phone: values.phone?.trim() || null,
        address: values.address?.trim() || null,
        city: values.city?.trim() || null,
        state: values.state?.trim() || null,
        pin_code: values.pin_code?.trim() || null,
        status: Number(values.status),
    };
}

export default function BranchForm({
    formId,
    values,
    onChange,
    onSubmit,
    error,
    loading = false,
}) {
    const [academies, setAcademies] = useState([]);
    const [academiesLoading, setAcademiesLoading] = useState(true);
    const [academiesError, setAcademiesError] = useState(null);

    useEffect(() => {
        async function loadAcademies() {
            setAcademiesLoading(true);
            setAcademiesError(null);

            try {
                const res = await fetch("/api/academies?status=1");
                const json = await res.json();
                if (!res.ok) throw new Error(json.message || "Unable to load academies.");
                setAcademies(json.data || []);
            } catch (err) {
                setAcademiesError(err.message);
            } finally {
                setAcademiesLoading(false);
            }
        }

        loadAcademies();
    }, []);

    const handleChange = (field) => (event) => {
        const value = field === "status" ? Number(event.target.value) : event.target.value;
        onChange({ ...values, [field]: value });
    };

    return (
        <form id={formId} onSubmit={onSubmit}>
            {error && <div className="alert alert-danger">{error}</div>}
            {academiesError && <div className="alert alert-warning">{academiesError}</div>}

            <div className="row g-3">
                <div className="col-md-6">
                    <label className="form-label">Academy</label>
                    <select
                        className="form-select"
                        value={values.academy_id}
                        onChange={handleChange("academy_id")}
                        required
                        disabled={loading || academiesLoading}
                    >
                        <option value="">{academiesLoading ? "Loading academies..." : "Select an academy"}</option>
                        {academies.map((academy) => (
                            <option key={academy.id} value={academy.id}>
                                {academy.academy_name} ({academy.academy_code})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="col-md-6">
                    <label className="form-label">Branch Name</label>
                    <input
                        className="form-control"
                        value={values.branch_name}
                        onChange={handleChange("branch_name")}
                        required
                        disabled={loading}
                    />
                </div>

                <div className="col-md-6">
                    <label className="form-label">Branch Code</label>
                    <input
                        className="form-control"
                        value={values.branch_code}
                        onChange={handleChange("branch_code")}
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

                <div className="col-md-6">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-control" value={values.email || ""} onChange={handleChange("email")} disabled={loading} />
                </div>

                <div className="col-md-6">
                    <label className="form-label">Phone</label>
                    <input className="form-control" value={values.phone || ""} onChange={handleChange("phone")} disabled={loading} />
                </div>

                <div className="col-12">
                    <label className="form-label">Address</label>
                    <textarea className="form-control" rows={3} value={values.address || ""} onChange={handleChange("address")} disabled={loading} />
                </div>

                <div className="col-12">
                    <label className="form-label">Directions (Google Maps Link / Navigation URL)</label>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. https://maps.google.com/?q=... or driving directions"
                        value={values.directions || ""}
                        onChange={handleChange("directions")}
                        disabled={loading}
                    />
                    <div className="form-text">
                        Used for the &quot;Directions&quot; action button on the academy website branches section.
                    </div>
                </div>

                <div className="col-md-4">
                    <label className="form-label">City</label>
                    <input className="form-control" value={values.city || ""} onChange={handleChange("city")} disabled={loading} />
                </div>

                <div className="col-md-4">
                    <label className="form-label">State</label>
                    <input className="form-control" value={values.state || ""} onChange={handleChange("state")} disabled={loading} />
                </div>

                <div className="col-md-4">
                    <label className="form-label">Pin Code</label>
                    <input className="form-control" value={values.pin_code || ""} onChange={handleChange("pin_code")} disabled={loading} />
                </div>
            </div>
        </form>
    );
}
