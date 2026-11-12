"use client";

import { Edit, Search, SearchSlash, Trash2, UserCog } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function UsersPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [users, setUsers] = useState([]);

    const [search, setSearch] = useState("");
    const [userType, setUserType] = useState("");
    const [status, setStatus] = useState("");

    const loadUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set("search", search.trim());
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
        loadUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userType, status]);
    console.log(users);
    const handleSearch = (e) => {
        e.preventDefault();
        loadUsers();
    };

    const handleClear = (e) => {
        e.preventDefault();
        setSearch("");
        setUserType("");
        setStatus("");
        setTimeout(loadUsers, 0);
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete user "${name}"? This will also unlink any linked staff/player record.`)) return;
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

    const linkedTo = (item) => {
        if (item.user_type === "player" && item.admission_players_id) {
            return `Player: ${item.player_first_name || ""} ${item.player_last_name || ""}`.trim();
        }
        if ((item.user_type === "admin" || item.user_type === "staff") && item.staff_id) {
            return `Staff: ${item.staff_first_name || ""} ${item.staff_last_name || ""}`.trim();
        }
        return "—";
    };

    return (
        <div className="container-fluid">
            <div className="row g-3">
                <div className="col-sm-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center gap-3">
                            <div className="">
                                <h3 className="mb-0"><UserCog /> Users</h3>
                                <p className="text-muted mb-0">Manage login accounts and their linked staff/player records.</p>
                            </div>
                            <Link href="/next_panel/users/new" className="btn btn-primary px-4">
                                <UserCog size={18} /> Add User
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
                                placeholder="Name, email, phone, apointment no..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <button type="button" className="btn btn-outline-secondary" onClick={handleSearch}><Search /></button>
                            <button type="button" className="btn btn-outline-danger" onClick={handleClear}><SearchSlash /></button>
                        </div>

                        <select className="form-select" value={userType} onChange={(e) => setUserType(e.target.value)} style={{ maxWidth: '180px' }}>
                            <option value="">All User Types</option>
                            <option value="admin">Admin</option>
                            <option value="staff">Staff</option>
                            <option value="player">Player</option>
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
                                            <th>Apointment No</th>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>User Type</th>
                                            <th>Linked To</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((item, idx) => (
                                            <tr key={item.id}>
                                                <th>{idx + 1}</th>
                                                <td>{item.appointment_no}</td>
                                                <td>
                                                    <div className="d-flex align-items-center gap-2">
                                                        {item.profile_image && (
                                                            <img
                                                                src={item.profile_image}
                                                                alt={item.first_name}
                                                                width={32}
                                                                height={32}
                                                                className="rounded-circle"
                                                                style={{ objectFit: "cover" }}
                                                            />
                                                        )}
                                                        <span>{item.first_name} {item.last_name || ""}</span>
                                                    </div>
                                                </td>
                                                <td>{item.email || "—"}</td>
                                                <td>
                                                    <span className="badge bg-info text-dark text-capitalize">{item.user_type}</span>
                                                </td>
                                                <td>{linkedTo(item)}</td>
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
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
