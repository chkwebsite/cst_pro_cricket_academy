"use client";

import { Edit, Search, SearchSlash, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useUser } from "../components/UserContext";

export default function AdmissionPlayersPage() {
    // STATES
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [players, setPlayers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [roles, setRoles] = useState([]);

    const [search, setSearch] = useState("");
    const [branchId, setBranchId] = useState("");
    const [roleId, setRoleId] = useState("");
    const [status, setStatus] = useState("");
    const [underAge, setUnderAge] = useState("");
    const {user} = useUser();
    const hasSessionUser = Boolean(user);
    const userAcademyId = user?.academy_id;
    const hasAssignedAcademy =
        userAcademyId !== null &&
        userAcademyId !== undefined &&
        userAcademyId !== "" &&
        Number(userAcademyId) !== 0;
    const effectiveAcademyId = hasAssignedAcademy ? String(userAcademyId) : "";

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
                if (branchRes.ok && branchJson.success) setBranches(branchJson.data || []);
                if (roleRes.ok && roleJson.success) setRoles(roleJson.data || []);
            } catch {
                // non-fatal — filters just won't populate
            }
        };
        loadFilterOptions();
    }, [hasSessionUser, effectiveAcademyId]);

    const loadPlayers = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set("search", search.trim());
            if (branchId) params.set("branch_id", branchId);
            if (effectiveAcademyId) params.set("academy_id", effectiveAcademyId);
            if (roleId) params.set("role_id", roleId);
            if (status !== "") params.set("status", status);
            if (underAge !== "") params.set("under_age", underAge);

            const query = params.toString();
            const res = await fetch(`/api/admission-players${query ? `?${query}` : ""}`, {
                cache: "no-store",
            });
            const json = await res.json();

            if (!res.ok || !json.success) throw new Error(json.message || "Unable to load Players.");

            setPlayers(json.data || []);
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!hasSessionUser) return;

        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadPlayers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasSessionUser, effectiveAcademyId, branchId, roleId, status, underAge]);

    const handleSearch = (e) => {
        e.preventDefault();
        loadPlayers();
    };

    const handleClear = (e) => {
        e.preventDefault();
        setSearch("");
        setBranchId("");
        setRoleId("");
        setStatus("");
        setUnderAge("");
        // loadPlayers runs via the effect once the filter states above settle;
        // call directly too since "search" isn't a dependency of that effect
        setTimeout(loadPlayers, 0);
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete admission player "${name}"?`)) return;
        setError(null);
        try {
            const res = await fetch(`/api/admission-players/${id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Unable to delete player");
            setPlayers((current) => current.filter((p) => p.id !== id));
        } catch (error) {
            setError(error.message);
        }
    };

    return (
        <div className="container-fluid">
            <div className="row g-3">
                <div className="col-sm-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center gap-3">
                            <div className="">
                                <h3 className="mb-0"><Users /> Admission Players</h3>
                                <p className="text-muted mb-0">Manage player admissions across branches.</p>
                            </div>
                            <Link href="/next_panel/admission-players/new" className="btn btn-primary px-4">
                                <Users size={18} /> Add Player
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
                                placeholder="Name, admission no, phone..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <button type="button" className="btn btn-outline-secondary" onClick={handleSearch}><Search /></button>
                            <button type="button" className="btn btn-outline-danger" onClick={handleClear}><SearchSlash /></button>
                        </div>

                        <select className="form-select" value={branchId} onChange={(e) => setBranchId(e.target.value)} style={{ maxWidth: '180px' }}>
                            <option value="">All Branches</option>
                            {/* {branches.map((b) => (
                                <option key={b.id} value={b.id}>{b.branch_name}</option>
                            ))} */}
                            {branches
    .filter((br) => {

        // No academy assigned → show all branches
        if (!user.academy_id) {
            return true;
        }

        // Academy Admin → show all branches
        // of his academy
        if (user.user_type === "Academy Admin") {
            return (
                Number(br.academy_id) ===
                Number(user.academy_id)
            );
        }

        // Other users → academy + branch restriction
        return (
            Number(br.academy_id) ===
                Number(user.academy_id) &&
            Number(br.id) ===
                Number(user.branch_id)
        );
    })
    .map((branch) => (
        <option
            key={branch.id}
            value={branch.id}
        >
            {branch.branch_name}
        </option>
    ))}
                        </select>

                        <select className="form-select" value={roleId} onChange={(e) => setRoleId(e.target.value)} style={{ maxWidth: '180px' }}>
                            <option value="">All Roles</option>
                            {roles.map((r) => (
                                <option key={r.id} value={r.id}>{r.role_name}</option>
                            ))}
                        </select>

                        <select className="form-select" value={underAge} onChange={(e) => setUnderAge(e.target.value)} style={{ maxWidth: '160px' }}>
                            <option value="">Any Age Type</option>
                            <option value="1">Under Age</option>
                            <option value="0">Not Under Age</option>
                        </select>

                        <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: '160px' }}>
                            <option value="">Choose Status</option>
                            <option value="1">Active</option>
                            <option value="0">Inactive</option>
                        </select>
                    </div>
                </div>
                <div className="col-sm-12">
                    {error && <div className="alert alert-danger">{error}</div>}
                    {loading ? (
                        <div className="text-center py-5 text-muted">Loading players...</div>
                    ) : (
                        players.length === 0 ? (
                            <div className="text-center py-5 text-muted">No admission players found yet.</div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table align-middle mb-0">
                                    <thead className="table-success">
                                        <tr>
                                            <th>#</th>
                                            <th>Admission No</th>
                                            <th>User ID</th>
                                            <th>Name</th>
                                            <th>Branch</th>
                                            <th>Role</th>
                                            <th>Phone</th>
                                            <th>Under Age</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {players.map((item, idx) => (
                                            <tr key={item.id}>
                                                <th>{idx + 1}</th>
                                                <td>{item.admission_no}</td>
                                                <td>{item.user_id ? item.user_id : "Not Registered"}</td>
                                                <td>{item.first_name} {item.last_name || ""}</td>
                                                <td>{item.branch_name}</td>
                                                <td>{item.role_name}</td>
                                                <td>{item.phone || "—"}</td>
                                                <td>
                                                    <span className={`badge ${item.under_age === 1 ? "bg-warning text-dark" : "bg-light text-dark"}`}>
                                                        {item.under_age === 1 ? "Yes" : "No"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`badge ${item.status === 1 ? "bg-success" : "bg-secondary"}`}>
                                                        {item.status === 1 ? "Active" : "Inactive"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="d-flex justify-content-start gap-2">
                                                        <Link
                                                            href={`/next_panel/admission-players/${item.id}/edit`}
                                                            className="btn btn-outline-secondary"
                                                            aria-label="Edit player"
                                                        >
                                                            <Edit size={16} />
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger"
                                                            onClick={() => handleDelete(item.id, `${item.first_name} ${item.last_name || ""}`.trim())}
                                                            aria-label="Delete player"
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
