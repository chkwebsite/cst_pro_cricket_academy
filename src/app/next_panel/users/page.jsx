"use client";

import { Edit, Search, SearchSlash, Trash2, Users as UsersIcon } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useUser } from "../components/UserContext";
import Pagination from "../components/Pagination";

const USER_TYPES = [
    { value: "admin", label: "Admin" },
    { value: "staff", label: "Staff" },
    { value: "coach", label: "Coach" },
    { value: "player", label: "Player" },
];

export default function UsersPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [users, setUsers] = useState([]);
    const [academies, setAcademies] = useState([]);
    const [branches, setBranches] = useState([]);
    const [roles, setRoles] = useState([]);

    const [search, setSearch] = useState("");
    const [academyId, setAcademyId] = useState("");
    const [branchId, setBranchId] = useState("");
    const [userType, setUserType] = useState("");
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    const {user} = useUser();
    const hasSessionUser = Boolean(user);
    const userAcademyId = user?.academy_id;
    const hasAssignedAcademy =
        userAcademyId !== null &&
        userAcademyId !== undefined &&
        userAcademyId !== "" &&
        Number(userAcademyId) !== 0;
    const effectiveAcademyId = hasAssignedAcademy ? String(userAcademyId) : academyId;

    useEffect(() => {
        if (!hasSessionUser) return;

        const loadFilterOptions = async () => {
            try {
                const [academyRes, branchRes, roleRes] = await Promise.all([
                    fetch("/api/academies"),
                    fetch("/api/branch"),
                    fetch("/api/roles"),
                ]);
                const academyJson = await academyRes.json();
                const branchJson = await branchRes.json();
                const rolesJson = await roleRes.json();
                if (academyRes.ok && academyJson.success) {
                    const academyList = academyJson.data || [];
                    setAcademies(
                        hasAssignedAcademy
                            ? academyList.filter((academy) => Number(academy.id) === Number(userAcademyId))
                            : academyList
                    );
                }
                if (branchRes.ok && branchJson.success) setBranches(branchJson.data || []);
                if (roleRes.ok && rolesJson.success) setRoles(rolesJson.data || []);
            } catch {
                // non-fatal — filters just won't populate
            }
        };
        loadFilterOptions();
    }, [hasSessionUser, hasAssignedAcademy, userAcademyId]);

    const filteredBranches = effectiveAcademyId
        ? branches.filter((b) => Number(b.academy_id) === Number(effectiveAcademyId))
        : branches;

    const loadUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set("search", search.trim());
            if (effectiveAcademyId) params.set("academy_id", effectiveAcademyId);
            if (branchId) params.set("branch_id", branchId);
            if (userType) params.set("user_type", userType);
            if (status !== "") params.set("status", status);

            const query = params.toString();
            const res = await fetch(`/api/users${query ? `?${query}` : ""}`);
            const json = await res.json();

            if (!res.ok || !json.success) throw new Error(json.message || "Unable to load Users.");

            setUsers(json.data || []);
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!hasSessionUser) return;

        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasSessionUser, effectiveAcademyId, branchId, userType, status]);

    const handleSearch = (e) => {
        e.preventDefault();
        loadUsers();
    };

    const handleClear = (e) => {
        e.preventDefault();
        setSearch("");
        setAcademyId("");
        setBranchId("");
        setUserType("");
        setStatus("");
        setTimeout(loadUsers, 0);
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete user "${name}"?`)) return;
        setError(null);
        try {
            const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Unable to delete user");
            setUsers((current) => current.filter((u) => u.id !== id));
        } catch (error) {
            setError(error.message);
        }
    };

    const userTypeLabel = (value) =>
        USER_TYPES.find((t) => t.value === value)?.label || value || "—";

    const totalPages = Math.ceil(users.length / PAGE_SIZE) || 1;
    const pagedUsers = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

   
    console.log("uuss",user);
    return (
        <div className="container-fluid">
            <div className="row g-3">
                <div className="col-sm-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center gap-3">
                            <div className="">
                                <h3 className="mb-0"><UsersIcon /> Users</h3>
                                <p className="text-muted mb-0">Manage user logins across academies and branches.</p>
                            </div>
                            <Link href="/next_panel/users/new" className="btn btn-primary px-4">
                                <UsersIcon size={18} /> Add User
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
                                placeholder="Name, appointment no, email, phone..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <button type="button" className="btn btn-outline-secondary" onClick={handleSearch}><Search /></button>
                            <button type="button" className="btn btn-outline-danger" onClick={handleClear}><SearchSlash /></button>
                        </div>

                        <select
                            className="form-select"
                            value={effectiveAcademyId}
                            disabled={hasAssignedAcademy}
                            onChange={(e) => {
                                setAcademyId(e.target.value);
                                setBranchId("");
                            }}
                            style={{ maxWidth: '200px' }}
                        >
                            {!hasAssignedAcademy && <option value="">All Academies</option>}
                            {academies.map((a) => (
                                <option key={a.id} value={a.id}>{a.academy_name}</option>
                            ))}
                        </select>

                        <select
                            className="form-select"
                            value={branchId}
                            onChange={(e) => setBranchId(e.target.value)}
                            style={{ maxWidth: '200px' }}
                        >
                            <option value="">All Branches</option>
                            {filteredBranches.map((b) => (
                                <option key={b.id} value={b.id}>{b.branch_name}</option>
                            ))}
                        </select>

                        <select className="form-select" value={userType} onChange={(e) => setUserType(e.target.value)} style={{ maxWidth: '180px' }}>
                            <option value="">All Types</option>
                            {roles.map((t) => (
                                <option key={t.id} value={t.role_name}>{t.role_name}</option>
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
                        <div className="text-center py-5 text-muted">Loading users...</div>
                    ) : (
                        users.length === 0 ? (
                            <div className="text-center py-5 text-muted">No users found yet.</div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table align-middle mb-0">
                                    <thead className="table-success">
                                        <tr>
                                            <th>#</th>
                                            <th>Photo</th>
                                            <th>Appointment No</th>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Phone</th>
                                            <th>Type</th>
                                            <th>Branch</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedUsers.map((item, idx) => (
                                            <tr key={item.id}>
                                                <th>{(page - 1) * PAGE_SIZE + idx + 1}</th>
                                                <td>
                                                    {item.profile_image ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={`${item.profile_image}`}
                                                            alt={item.first_name}
                                                            width={36}
                                                            height={36}
                                                            className="rounded-circle object-fit-cover"
                                                        />
                                                    ) : (
                                                        <span className="text-muted">—</span>
                                                    )}
                                                </td>
                                                <td>{item.appointment_no}</td>
                                                <td>{item.first_name} {item.last_name || ""}</td>
                                                <td>{item.email || "—"}</td>
                                                <td>{item.phone || "—"}</td>
                                                <td>{userTypeLabel(item.user_type)}</td>
                                                <td>{item.academy_name || "—"}-{item.branch_name || "—"}</td>
                                                <td>
                                                    <span className={`badge ${item.status === 1 ? "bg-success" : "bg-secondary"}`}>
                                                        {item.status === 1 ? "Active" : "Inactive"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="d-flex justify-content-start gap-2">
                                                        <Link
                                                            href={`/next_panel/users/${item.id}/edit`}
                                                            className="btn btn-outline-secondary"
                                                            aria-label="Edit user"
                                                        >
                                                            <Edit size={16} />
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger"
                                                            onClick={() => handleDelete(item.id, `${item.first_name} ${item.last_name || ""}`.trim())}
                                                            aria-label="Delete user"
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
                            <div className="mt-3">
                                <Pagination
                                    page={page}
                                    totalPages={totalPages}
                                    total={users.length}
                                    onPageChange={setPage}
                                    pageSize={PAGE_SIZE}
                                />
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
