"use client";

import { Edit, Search, SearchSlash, Trash2, Users, Trophy, Phone, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import useCurrentUser from "../teams/useCurrentUser";
import useTournamentOptions from "../tournament-teams/useTournamentOptions";
import Pagination from "../components/Pagination";

const PLAYER_ROLES = ["Player", "Captain", "Vice Captain", "Wicket Keeper", "All Rounder", "Bowler", "Batter"];
const PAYMENT_STATUSES = ["Pending", "Partial", "Paid"];

const PAYMENT_BADGE = {
    Pending: "bg-warning text-dark",
    Partial: "bg-info text-dark",
    Paid: "bg-success",
};

const formatAmount = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString("en-IN", { style: "currency", currency: "INR" });
};

// Registered user -> "First Last"; outside player -> player_name
const playerInfo = (item) => {
    if (item.user_id) {
        return {
            name: `${item.first_name || ""} ${item.last_name || ""}`.trim() || `User #${item.user_id}`,
            phone: item.phone,
            email: item.email,
            type: "Registered",
        };
    }
    return {
        name: item.outside_player_name || `Outside Player #${item.outside_player_id}`,
        phone: item.outside_player_phone,
        email: item.outside_player_email,
        type: "Outside",
    };
};

export default function TournamentTeamPlayersPage() {
    const me = useCurrentUser();
    const { tournaments, error: tournamentError } = useTournamentOptions(me);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [players, setPlayers] = useState([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    // Filters (all supported server-side by GET /api/tournament-team-players)
    const [tournamentId, setTournamentId] = useState("");
    const [tournamentTeams, setTournamentTeams] = useState([]);
    const [teamId, setTeamId] = useState("");
    const [jerseyNo, setJerseyNo] = useState("");
    const [playerRole, setPlayerRole] = useState("");
    const [paymentStatus, setPaymentStatus] = useState("");
    const [status, setStatus] = useState("");

    const selectedTournamentTeams = tournamentTeams.filter(
        (registration) => Number(registration.tournament_id) === Number(tournamentId)
    );

    // Name search is done on the loaded rows (the API has no name filter)
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (!tournamentId) return;

        const controller = new AbortController();
        const loadTournamentTeams = async () => {
            try {
                const res = await fetch(`/api/tournament-teams?tournament_id=${tournamentId}`, {
                    signal: controller.signal,
                });
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Unable to load tournament teams");
                }
                setTournamentTeams((json.data || []).filter((item) => !["Withdrawn", "Disqualified"].includes(item.status)));
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            }
        };

        loadTournamentTeams();
        return () => controller.abort();
    }, [tournamentId]);

    // Debounced fetch so we don't hit the API on every keystroke
    useEffect(() => {
        const controller = new AbortController();

        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (tournamentId) params.set("tournament_id", tournamentId);
                if (teamId) params.set("team_id", teamId);
                if (jerseyNo.trim()) params.set("jersey_no", jerseyNo.trim());
                if (playerRole) params.set("player_role", playerRole);
                if (paymentStatus) params.set("payment_status", paymentStatus);
                if (status !== "") params.set("status", status);

                const query = params.toString();
                const res = await fetch(`/api/tournament-team-players${query ? `?${query}` : ""}`, {
                    signal: controller.signal,
                });
                const json = await res.json();

                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Unable to load Tournament Team Players.");
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
    }, [tournamentId, teamId, jerseyNo, playerRole, paymentStatus, status]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return players;
        return players.filter((p) => playerInfo(p).name.toLowerCase().includes(q));
    }, [players, search]);

    useEffect(() => {
        setPage(1);
    }, [search, tournamentId, teamId, jerseyNo, playerRole, paymentStatus, status]);

    const totalPages = Math.ceil(visible.length / PAGE_SIZE) || 1;
    const pagedItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleClear = (e) => {
        e.preventDefault();
        setSearch("");
        setTournamentId("");
        setTeamId("");
        setJerseyNo("");
        setPlayerRole("");
        setPaymentStatus("");
        setStatus("");
    };

    const handleDelete = async (id, playerName) => {
        if (!confirm(`Remove player "${playerName}" from this team? Their fee record will be cancelled.`)) return;
        setError(null);
        try {
            const res = await fetch(`/api/tournament-team-players/${id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to delete tournament team player");
            }
            setPlayers((current) => current.filter((p) => p.id !== id));
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="container-fluid">
            <div className="row g-3">
                {/* Header */}
                <div className="col-sm-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center gap-3">
                            <div>
                                <Link href="tournament-management" className="btn btn-sm btn-outline-secondary mb-3">
                                <ArrowLeft size={16} className="me-2"/> Back to match management
                                </Link>
                                <h3 className="mb-0"><Users /> Tournament Team Players</h3>
                                <p className="text-muted mb-0">Manage players, roles, and fees for tournament teams.</p>
                            </div>
                            <Link href="/next_panel/tournament-team-players/new" className="btn btn-primary px-4">
                                <Users size={18} /> Add Player
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="col-sm-12">
                    <div className="d-flex flex-wrap align-items-center gap-3">
                        <div className="input-group" style={{ maxWidth: "240px" }}>
                            <span className="input-group-text bg-white"><Search size={18} /></span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Player name"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <select
                            className="form-select"
                            style={{ maxWidth: "240px" }}
                            value={tournamentId}
                            onChange={(e) => {
                                setTournamentId(e.target.value);
                                setTeamId("");
                            }}
                        >
                            <option value="">Choose Tournament</option>
                            {tournaments.map((tournament) => (
                                <option key={tournament.id} value={tournament.id}>{tournament.tournament_name}</option>
                            ))}
                        </select>

                        <select
                            className="form-select"
                            style={{ maxWidth: "240px" }}
                            value={teamId}
                            onChange={(e) => setTeamId(e.target.value)}
                            disabled={!tournamentId}
                        >
                            <option value="">Choose Tournament Team</option>
                            {selectedTournamentTeams.map((registration) => (
                                <option key={registration.id} value={registration.team_id}>
                                    {registration.team_name}{registration.team_code ? ` (${registration.team_code})` : ""}
                                </option>
                            ))}
                        </select>

                        <input
                            type="text"
                            className="form-control"
                            placeholder="Jersey no."
                            style={{ maxWidth: "130px" }}
                            value={jerseyNo}
                            onChange={(e) => setJerseyNo(e.target.value)}
                        />

                        <select
                            className="form-select"
                            value={playerRole}
                            onChange={(e) => setPlayerRole(e.target.value)}
                            style={{ maxWidth: "170px" }}
                        >
                            <option value="">Choose Role</option>
                            {PLAYER_ROLES.map((r) => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>

                        <select
                            className="form-select"
                            value={paymentStatus}
                            onChange={(e) => setPaymentStatus(e.target.value)}
                            style={{ maxWidth: "190px" }}
                        >
                            <option value="">Choose Payment</option>
                            {PAYMENT_STATUSES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>

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
                    {(error || tournamentError) && <div className="alert alert-danger">{error || tournamentError}</div>}

                    {loading ? (
                        <div className="text-center py-5 text-muted">Loading players...</div>
                    ) : visible.length === 0 ? (
                        <div className="text-center py-5 text-muted">No players found.</div>
                    ) : (
                        <>
                        <div className="table-responsive">
                            <table className="table align-middle mb-0">
                                <thead className="table-success">
                                    <tr>
                                        <th>#</th>
                                        <th>Player</th>
                                        <th>Tournament</th>
                                        <th>Team</th>
                                        <th>Jersey</th>
                                        <th>Role</th>
                                        <th className="text-end">Fee</th>
                                        <th>Payment</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedItems.map((item, idx) => {
                                        const player = playerInfo(item);
                                        return (
                                            <tr key={item.id}>
                                                <th>{(page - 1) * PAGE_SIZE + idx + 1}</th>
                                                <td>
                                                    <div>
                                                        {player.name}{" "}
                                                        <span className="badge text-bg-light border">{player.type}</span>
                                                    </div>
                                                    {player.phone && (
                                                        <small className="text-muted d-block">
                                                            <Phone size={12} className="me-1" />{player.phone}
                                                        </small>
                                                    )}
                                                    {player.email && (
                                                        <small className="text-muted d-block">{player.email}</small>
                                                    )}
                                                </td>
                                                <td>
                                                    <div><Trophy size={14} className="me-1 text-muted" />{item.tournament_name}</div>
                                                    <small className="text-muted">{item.registration_no}</small>
                                                </td>
                                                <td>
                                                    <div>{item.team_name}</div>
                                                    <small className="text-muted">{item.team_code}</small>
                                                </td>
                                                <td>{item.jersey_no || "—"}</td>
                                                <td>
                                                    <span className="badge text-bg-light border">{item.player_role}</span>
                                                </td>
                                                <td className="text-end">
                                                    <small className="d-block text-muted">Fee: {formatAmount(item.player_fee)}</small>
                                                    <small className="d-block">Paid: {formatAmount(item.paid_amount)}</small>
                                                    <small className="d-block">Balance: {formatAmount(item.balance_amount)}</small>
                                                </td>
                                                <td>
                                                    <span className={`badge ${PAYMENT_BADGE[item.payment_status] || "bg-secondary"}`}>
                                                        {item.payment_status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`badge ${Number(item.status) === 1 ? "bg-success" : "bg-secondary"}`}>
                                                        {Number(item.status) === 1 ? "Active" : "Inactive"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="d-flex justify-content-start gap-2">
                                                        <Link
                                                            href={`/next_panel/tournament-team-players/${item.id}/edit`}
                                                            className="btn btn-outline-secondary"
                                                            aria-label="Edit player"
                                                        >
                                                            <Edit size={16} />
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger"
                                                            onClick={() => handleDelete(item.id, player.name)}
                                                            aria-label="Delete player"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <Pagination
                            page={page}
                            totalPages={totalPages}
                            total={visible.length}
                            onPageChange={setPage}
                            pageSize={PAGE_SIZE}
                        />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
