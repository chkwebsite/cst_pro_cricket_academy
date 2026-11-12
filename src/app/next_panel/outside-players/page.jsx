"use client";

import { Edit, Search, SearchSlash, Trash2, UserPlus, Users, Phone } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import Pagination from "../components/Pagination";

export default function OutsidePlayersPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [players, setPlayers] = useState([]);
    const [ageGroups, setAgeGroups] = useState([]);

    // Filters (all supported server-side by GET /api/outside-players)
    const [playerName, setPlayerName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [ageGroupId, setAgeGroupId] = useState("");
    const [gender, setGender] = useState("");
    const [battingStyle, setBattingStyle] = useState("");
    const [bowlingStyle, setBowlingStyle] = useState("");
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    useEffect(() => {
        const controller = new AbortController();

        const loadAgeGroups = async () => {
            try {
                const res = await fetch("/api/age-groups", { signal: controller.signal });
                const json = await res.json();

                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Unable to load age groups.");
                }

                setAgeGroups(json.data || []);
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            }
        };

        loadAgeGroups();
        return () => controller.abort();
    }, []);

    // Debounced fetch so we don't hit the API on every keystroke
    useEffect(() => {
        const controller = new AbortController();

        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (playerName.trim()) params.set("player_name", playerName.trim());
                if (phone.trim()) params.set("phone", phone.trim());
                if (email.trim()) params.set("email", email.trim());
                if (ageGroupId) params.set("age_group_id", ageGroupId);
                if (gender) params.set("gender", gender);
                if (battingStyle.trim()) params.set("batting_style", battingStyle.trim());
                if (bowlingStyle.trim()) params.set("bowling_style", bowlingStyle.trim());
                if (status !== "") params.set("status", status);

                const query = params.toString();
                const res = await fetch(`/api/outside-players${query ? `?${query}` : ""}`, {
                    signal: controller.signal,
                });
                const json = await res.json();

                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Unable to load Outside Players.");
                }
                setPlayers(json.data || []);
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }, 300);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [playerName, phone, email, ageGroupId, gender, battingStyle, bowlingStyle, status]);

    const handleClear = (e) => {
        e.preventDefault();
        setPlayerName("");
        setPhone("");
        setEmail("");
        setAgeGroupId("");
        setGender("");
        setBattingStyle("");
        setBowlingStyle("");
        setStatus("");
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete player "${name}"?`)) return;
        setError(null);
        try {
            const res = await fetch(`/api/outside-players/${id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to delete player");
            }
            setPlayers((current) => current.filter((p) => p.id !== id));
        } catch (err) {
            setError(err.message);
        }
    };

    const totalPages = Math.ceil(players.length / PAGE_SIZE) || 1;
    const pagedPlayers = players.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
        <div className="container-fluid">
            <div className="row g-3">
                {/* Header */}
                <div className="col-sm-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center gap-3">
                            <div>
                                <h3 className="mb-0"><Users /> Outside Players</h3>
                                <p className="text-muted mb-0">Manage outside players, contacts, and playing styles.</p>
                            </div>
                            <Link href="/next_panel/outside-players/new" className="btn btn-primary px-4">
                                <UserPlus size={18} /> Add Player
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="col-sm-12">
                    <div className="d-flex flex-wrap align-items-center gap-3">
                        <div className="input-group" style={{ maxWidth: "260px" }}>
                            <span className="input-group-text bg-white"><Search size={18} /></span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Player name"
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                            />
                        </div>

                        <input
                            type="text"
                            className="form-control"
                            placeholder="Phone"
                            style={{ maxWidth: "160px" }}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />

                        <input
                            type="text"
                            className="form-control"
                            placeholder="Email"
                            style={{ maxWidth: "200px" }}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />

                        <select
                            className="form-select"
                            value={ageGroupId}
                            onChange={(e) => setAgeGroupId(e.target.value)}
                            style={{ maxWidth: "180px" }}
                        >
                            <option value="">Choose Age Group</option>
                            {ageGroups.map((item) => (
                                <option value={item.id} key={item.id}>
                                    {item.age_group}
                                </option>
                            ))}
                        </select>

                        <select
                            className="form-select"
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                            style={{ maxWidth: "160px" }}
                        >
                            <option value="">Choose Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>

                        <input
                            type="text"
                            className="form-control"
                            placeholder="Batting style"
                            style={{ maxWidth: "170px" }}
                            value={battingStyle}
                            onChange={(e) => setBattingStyle(e.target.value)}
                        />

                        <input
                            type="text"
                            className="form-control"
                            placeholder="Bowling style"
                            style={{ maxWidth: "170px" }}
                            value={bowlingStyle}
                            onChange={(e) => setBowlingStyle(e.target.value)}
                        />

                        <select
                            className="form-select"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            style={{ maxWidth: "180px" }}
                        >
                            <option value="">Choose Status</option>
                            <option value="1">Active</option>
                            <option value="0">Inactive</option>
                        </select>

                        <button
                            type="button"
                            className="btn btn-outline-danger"
                            onClick={handleClear}
                            aria-label="Clear filters"
                        >
                            <SearchSlash />
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="col-sm-12">
                    {error && <div className="alert alert-danger">{error}</div>}

                    {loading ? (
                        <div className="text-center py-5 text-muted">Loading players...</div>
                    ) : players.length === 0 ? (
                        <div className="text-center py-5 text-muted">No players found.</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table align-middle mb-0">
                                <thead className="table-success">
                                    <tr>
                                        <th>#</th>
                                        <th>Player</th>
                                        <th>Contact</th>
                                        <th>Gender</th>
                                        <th>Age Group</th>
                                        <th>Batting</th>
                                        <th>Bowling</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedPlayers.map((item, idx) => (
                                        <tr key={item.id}>
                                            <th>{(page - 1) * PAGE_SIZE + idx + 1}</th>
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    {item.profile_image ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={item.profile_image}
                                                            alt={item.player_name}
                                                            className="rounded-circle border"
                                                            style={{ width: 40, height: 40, objectFit: "cover" }}
                                                        />
                                                    ) : (
                                                        <div
                                                            className="rounded-circle bg-light border d-flex align-items-center justify-content-center text-muted fw-bold"
                                                            style={{ width: 40, height: 40 }}
                                                        >
                                                            {item.player_name?.[0]?.toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div>{item.player_name}</div>
                                                </div>
                                            </td>
                                            <td>
                                                {item.phone ? (
                                                    <small className="text-muted d-block">
                                                        <Phone size={12} className="me-1" />{item.phone}
                                                    </small>
                                                ) : null}
                                                {item.email ? (
                                                    <small className="text-muted d-block">{item.email}</small>
                                                ) : null}
                                                {!item.phone && !item.email && "—"}
                                            </td>
                                            <td>{item.gender || "—"}</td>
                                            <td>{item.age_group || "—"}</td>
                                            <td>{item.batting_style || "—"}</td>
                                            <td>{item.bowling_style || "—"}</td>
                                            <td>
                                                <span className={`badge ${Number(item.status) === 1 ? "bg-success" : "bg-secondary"}`}>
                                                    {Number(item.status) === 1 ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="d-flex justify-content-start gap-2">
                                                    <Link
                                                        href={`/next_panel/outside-players/${item.id}/edit`}
                                                        className="btn btn-outline-secondary"
                                                        aria-label="Edit player"
                                                    >
                                                        <Edit size={16} />
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-danger"
                                                        onClick={() => handleDelete(item.id, item.player_name)}
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
                    )}

                    {!loading && players.length > 0 && (
                        <div className="mt-3">
                            <Pagination
                                page={page}
                                totalPages={totalPages}
                                total={players.length}
                                onPageChange={setPage}
                                pageSize={PAGE_SIZE}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
