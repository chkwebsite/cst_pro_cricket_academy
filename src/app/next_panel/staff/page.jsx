"use client";

import { Edit, Search, SearchSlash, Trash2, Briefcase } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useUser } from "../components/UserContext";

export default function StaffPage() {
    // STATES
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [staff, setStaff] = useState([]);
    const [branches, setBranches] = useState([]);
    const [roles, setRoles] = useState([]);

    const [search, setSearch] = useState("");
    const [branchId, setBranchId] = useState("");
    const [roleId, setRoleId] = useState("");
    const [status, setStatus] = useState("");
    const {user} = useUser();
    const hasSessionUser = Boolean(user);
    const userAcademyId = user?.academy_id;
    const userBranchId = user?.branch_id;
    const hasAssignedAcademy =
        userAcademyId !== null &&
        userAcademyId !== undefined &&
        userAcademyId !== "" &&
        Number(userAcademyId) !== 0;
    const isAcademyAdmin = user?.user_type === "Academy Admin";
    const effectiveAcademyId = hasAssignedAcademy ? String(userAcademyId) : "";
    const hasAssignedBranch =
        userBranchId !== null &&
        userBranchId !== undefined &&
        userBranchId !== "" &&
        Number(userBranchId) > 0;
    const isBranchRestricted = hasAssignedAcademy && !isAcademyAdmin;
    const effectiveBranchId = isBranchRestricted
        ? hasAssignedBranch ? String(userBranchId) : "0"
        : branchId;

    // LOAD BRANCHES + ROLES (once, for filters)
    useEffect(() => {
        if (!hasSessionUser) return;

        const loadFilterOptions = async () => {
            try {
                const branchUrl = effectiveAcademyId
                    ? `/api/branch?academy_id=${effectiveAcademyId}`
                    : "/api/branch";
                const [branchRes, roleRes] = await Promise.all([
                    fetch(branchUrl),
                    fetch("/api/roles"),
                ]);
                const branchJson = await branchRes.json();
                const roleJson = await roleRes.json();
                if (branchRes.ok && branchJson.success) {
                    const branchList = branchJson.data || [];
                    setBranches(
                        isBranchRestricted
                            ? branchList.filter((branch) => Number(branch.id) === Number(userBranchId))
                            : branchList
                    );
                }
                if (roleRes.ok && roleJson.success) setRoles(roleJson.data || []);
            } catch {
                // non-fatal — filters just won't populate
            }
        };
        loadFilterOptions();
    }, [hasSessionUser, effectiveAcademyId, isBranchRestricted, userBranchId]);

    const loadStaff = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set("search", search.trim());
            if (effectiveAcademyId) params.set("academy_id", effectiveAcademyId);
            if (effectiveBranchId) params.set("branch_id", effectiveBranchId);
            if (roleId) params.set("role_id", roleId);
            if (status !== "") params.set("status", status);

            const query = params.toString();
            const res = await fetch(`/api/staff${query ? `?${query}` : ""}`, {
                cache: "no-store",
            });
            const json = await res.json();

            if (!res.ok || !json.success) throw new Error(json.message || "Unable to load Staff.");

            setStaff(json.data || []);
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!hasSessionUser) return;

        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadStaff();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasSessionUser, effectiveAcademyId, effectiveBranchId, roleId, status]);

    const handleSearch = (e) => {
        e.preventDefault();
        loadStaff();
    };

    const handleClear = (e) => {
        e.preventDefault();
        setSearch("");
        setBranchId("");
        setRoleId("");
        setStatus("");
        setTimeout(loadStaff, 0);
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete staff "${name}"?`)) return;
        setError(null);
        try {
            const res = await fetch(`/api/staff/${id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Unable to delete staff");
            setStaff((current) => current.filter((s) => s.id !== id));
        } catch (error) {
            setError(error.message);
        }
    };

    const formatSalary = (value) => {
        const num = Number(value ?? 0);
        return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    };
    console.log("staff", staff);
    return (
        <div className="container-fluid">
            <div className="row g-3">
                <div className="col-sm-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center gap-3">
                            <div className="">
                                <h3 className="mb-0"><Briefcase /> Staff</h3>
                                <p className="text-muted mb-0">Manage staff appointments across branches.</p>
                            </div>
                            <Link href="/next_panel/staff/new" className="btn btn-primary px-4">
                                <Briefcase size={18} /> Add Staff
                            </Link>
                        </div>
                    </div>
                </div>
                <div className="col-sm-12">
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                        <div className="input-group" style={{ maxWidth: '320px' }}>
                            <span className="input-group-text bg-white"> <Search /></span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Name, appointment no, speciality..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <button type="button" className="btn btn-outline-secondary" onClick={handleSearch}><Search /></button>
                            <button type="button" className="btn btn-outline-danger" onClick={handleClear}><SearchSlash /></button>
                        </div>

                        <select
                            className="form-select"
                            value={effectiveBranchId}
                            disabled={isBranchRestricted}
                            onChange={(e) => setBranchId(e.target.value)}
                            style={{ maxWidth: '200px' }}
                        >
                            {!isBranchRestricted && <option value="">All Branches</option>}
                            {isBranchRestricted && !hasAssignedBranch && (
                                <option value="0">No branch assigned</option>
                            )}
                            {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>{branch.branch_name}</option>
                            ))}
                        </select>

                        <select className="form-select" value={roleId} onChange={(e) => setRoleId(e.target.value)} style={{ maxWidth: '200px' }}>
                            <option value="">All Roles</option>
                            {roles.map((r) => (
                                <option key={r.id} value={r.id}>{r.role_name}</option>
                            ))}
                        </select>

                        <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: '180px' }}>
                            <option value="">Choose Status</option>
                            <option value="1">Active</option>
                            <option value="0">Inactive</option>
                        </select>
                    </div>
                </div>
                <div className="col-sm-12">
                    {error && <div className="alert alert-danger">{error}</div>}
                    {loading ? (
                        <div className="text-center py-5 text-muted">Loading staff...</div>
                    ) : (
                        staff.length === 0 ? (
                            <div className="text-center py-5 text-muted">No staff found yet.</div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table align-middle mb-0">
                                    <thead className="table-success">
                                        <tr>
                                            <th>#</th>
                                            <th>Appointment No</th>
                                            <th>Name</th>
                                            <th>Role</th>
                                            <th>Branch</th>
                                            <th>Speciality</th>
                                            <th>Current Salary</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {staff.map((item, idx) => (
                                            <tr key={item.id}>
                                                <th>{idx + 1}</th>
                                                <td>{item.appointment_no}</td>
                                                <td>{item.first_name} {item.last_name || ""}</td>
                                                <td>{item.role_name || "—"}</td>
                                                <td>{item.academy_name}-{item.branch_name || "—"}</td>
                                                <td>{item.speciality || "—"}</td>
                                                <td>{formatSalary(item.current_salary)}</td>
                                                <td>
                                                    <span className={`badge ${item.status === 1 ? "bg-success" : "bg-secondary"}`}>
                                                        {item.status === 1 ? "Active" : "Inactive"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="d-flex justify-content-start gap-2">
                                                        <Link
                                                            href={`/next_panel/staff/${item.id}/edit`}
                                                            className="btn btn-outline-secondary"
                                                            aria-label="Edit staff"
                                                        >
                                                            <Edit size={16} />
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger"
                                                            onClick={() => handleDelete(item.id, `${item.first_name} ${item.last_name || ""}`.trim())}
                                                            aria-label="Delete staff"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
