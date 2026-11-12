"use client";

import { ArrowLeft, Edit, Lock, Plus, Search, SearchSlash, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import useCurrentUser, { ROLES } from "../teams/useCurrentUser";
import useOrgOptions, { inAcademy } from "../teams/useOrgOptions";
import { PLAYER_ROLES } from "./TeamPlayerForm";
import useTeamOptions from "./useTeamOptions";

const fmtDate = (v) => (v ? String(v).slice(0, 10) : "—");

export default function TeamPlayersPage() {
    const me = useCurrentUser();
    const { branches, academies, error: orgError } = useOrgOptions(me);
    const { teams, error: teamError } = useTeamOptions(me);

    const isSuper = me.role === ROLES.SUPER;
    const isBranchAdmin = me.role === ROLES.BRANCH;
    // Fail closed: never list anything if we can't tell who is logged in
    const blocked = me.ready && (!me.role || (!isSuper && !me.academyId) || (isBranchAdmin && !me.branchId));

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [rows, setRows] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Filters. team/jersey/role/status/academy/branch are server-side; name is client-side
    const [search, setSearch] = useState("");
    const [teamId, setTeamId] = useState("");
    const [jerseyNo, setJerseyNo] = useState("");
    const [playerRole, setPlayerRole] = useState("");
    const [status, setStatus] = useState("");
    const [academyId, setAcademyId] = useState(""); // super admin only
    const [branchId, setBranchId] = useState("");

    const effectiveAcademyId = isSuper ? academyId : me.academyId ?? "";
    const branchOptions = branches.filter((b) => !effectiveAcademyId || inAcademy(b, effectiveAcademyId));
    const teamOptions = teams.filter(
        (t) => {
            const isUnassignedTeam = t.academy_id == null && t.branch_id == null;
            return (
                (!effectiveAcademyId || Number(t.academy_id) === Number(effectiveAcademyId) || isUnassignedTeam) &&
                (!branchId || Number(t.branch_id) === Number(branchId) || isUnassignedTeam)
            );
        }
    );

    // Branch admin sees the whole academy, but only manages their own branch's teams
    const isMine = (r) => isBranchAdmin && Number(r.branch_id) === Number(me.branchId);
    const canManage = (r) =>
        isSuper ||
        Number(r.academy_id) === Number(me.academyId) ||
        (r.academy_id == null && r.branch_id == null);

    // Debounced fetch so we don't hit the API on every keystroke
    useEffect(() => {
        if (!me.ready) return;
        if (blocked) {
            setLoading(false);
            return;
        }

        const controller = new AbortController();

        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (effectiveAcademyId) params.set("academy_id", effectiveAcademyId);
                if (branchId) params.set("branch_id", branchId);
                if (teamId) params.set("team_id", teamId);
                if (jerseyNo.trim()) params.set("jersey_no", jerseyNo.trim());
                if (playerRole) params.set("player_role", playerRole);
                if (status !== "") params.set("status", status);

                const query = params.toString();
                const res = await fetch(`/api/team-players${query ? `?${query}` : ""}`, { signal: controller.signal });
                const json = await res.json();

                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Unable to load Team Players.");
                }
                setRows(json.data || []);
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
    }, [me.ready, blocked, effectiveAcademyId, branchId, teamId, jerseyNo, playerRole, status]);

    const handleAcademyChange = (e) => {
        setAcademyId(e.target.value);
        setBranchId("");
        setTeamId("");
        setPage(1);
    };

    const handleBranchChange = (e) => {
        setBranchId(e.target.value);
        setTeamId("");
        setPage(1);
    };

    const handleClear = (e) => {
        e.preventDefault();
        setSearch("");
        setTeamId("");
        setJerseyNo("");
        setPlayerRole("");
        setStatus("");
        setAcademyId("");
        setBranchId("");
        setPage(1);
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Remove "${name}" from this team?`)) return;
        setError(null);
        try {
            const res = await fetch(`/api/team-players/${id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to remove player");
            }
            setRows((current) => current.filter((r) => r.id !== id));
        } catch (err) {
            setError(err.message);
        }
    };

    // A row is either an academy user or an outside player
    const info = (r) =>
        r.user_id
            ? {
                  name: r.player_name?.trim() || `User #${r.user_id}`,
                  image: r.user_profile_image,
                  email: r.player_email,
                  phone: r.player_phone,
                  type: "Academy",
              }
            : {
                  name: r.outside_player_name || `Outside #${r.outside_player_id}`,
                  image: r.outside_profile_image,
                  email: r.outside_player_email,
                  phone: r.outside_player_phone,
                  type: "Outside",
              };

    const needle = search.trim().toLowerCase();
    const visible = rows.filter((r) => !needle || info(r).name.toLowerCase().includes(needle));
    const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const firstVisibleIndex = (currentPage - 1) * pageSize;
    const pageRows = visible.slice(firstVisibleIndex, firstVisibleIndex + pageSize);

    return (
        <div className="container-fluid">
            <div className="row g-3">
                {/* Header */}
                <div className="col-sm-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center gap-3">
                            <div>
                                <Link href="match-management" className="btn btn-sm btn-outline-secondary mb-3">
                                <ArrowLeft size={16} className="me-2"/> Back to match management
                                </Link>
                                <h3 className="mb-0"><Users /> Team Players</h3>
                                <p className="text-muted mb-0">
                                    {isSuper && "Players of every team across all academies."}
                                    {me.role === ROLES.ACADEMY && "Players of all teams in your academy."}
                                    {isBranchAdmin && "Players of all teams in your academy. Your branch's players are highlighted."}
                                    {!me.role && "Manage team players."}
                                </p>
                            </div>
                            {!blocked && (
                                <Link href="/next_panel/team-players/new" className="btn btn-primary px-4">
                                    <Plus size={18} /> Add Player
                                </Link>
                            )}
                        </div>
                    </div>
                </div>

                {blocked ? (
                    <div className="col-sm-12">
                        <div className="alert alert-warning">
                            Unable to determine your role / academy / branch. Please log in again.
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Filters */}
                        <div className="col-sm-12">
                            <div className="d-flex flex-wrap align-items-center gap-3">
                                <div className="input-group" style={{ maxWidth: "230px" }}>
                                    <span className="input-group-text bg-white"><Search size={18} /></span>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Player name"
                                        value={search}
                                        onChange={(e) => {
                                            setSearch(e.target.value);
                                            setPage(1);
                                        }}
                                    />
                                </div>

                                {isSuper && (
                                    <select
                                        className="form-select"
                                        value={academyId}
                                        onChange={handleAcademyChange}
                                        style={{ maxWidth: "190px" }}
                                    >
                                        <option value="">Choose Academy</option>
                                        {academies.map((a) => (
                                            <option key={a.id} value={a.id}>{a.academy_name}</option>
                                        ))}
                                    </select>
                                )}

                                <select
                                    className="form-select"
                                    value={branchId}
                                    onChange={handleBranchChange}
                                    style={{ maxWidth: "190px" }}
                                >
                                    <option value="">Choose Branch</option>
                                    {branchOptions.map((b) => (
                                        <option key={b.id} value={b.id}>{b.branch_name}</option>
                                    ))}
                                </select>

                                <select
                                    className="form-select"
                                    value={teamId}
                                    onChange={(e) => {
                                        setTeamId(e.target.value);
                                        setPage(1);
                                    }}
                                    style={{ maxWidth: "200px" }}
                                >
                                    <option value="">Choose Team</option>
                                    {teamOptions.map((t) => (
                                        <option key={t.id} value={t.id}>{t.team_name}</option>
                                    ))}
                                </select>

                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Jersey no"
                                    style={{ maxWidth: "120px" }}
                                    value={jerseyNo}
                                    onChange={(e) => {
                                        setJerseyNo(e.target.value);
                                        setPage(1);
                                    }}
                                />

                                <select
                                    className="form-select"
                                    value={playerRole}
                                    onChange={(e) => {
                                        setPlayerRole(e.target.value);
                                        setPage(1);
                                    }}
                                    style={{ maxWidth: "170px" }}
                                >
                                    <option value="">Choose Role</option>
                                    {PLAYER_ROLES.map((r) => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>

                                <select
                                    className="form-select"
                                    value={status}
                                    onChange={(e) => {
                                        setStatus(e.target.value);
                                        setPage(1);
                                    }}
                                    style={{ maxWidth: "160px" }}
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
                            {(error || orgError || teamError) && (
                                <div className="alert alert-danger">{error || orgError || teamError}</div>
                            )}

                            {loading || !me.ready ? (
                                <div className="text-center py-5 text-muted">Loading team players...</div>
                            ) : visible.length === 0 ? (
                                <div className="text-center py-5 text-muted">No team players found.</div>
                            ) : (
                                <>
                                <div className="table-responsive">
                                    <table className="table align-middle mb-0">
                                        <thead className="table-success">
                                            <tr>
                                                <th>#</th>
                                                <th>Player</th>
                                                <th>Team</th>
                                                {isSuper && <th>Academy</th>}
                                                <th>Branch</th>
                                                <th>Jersey</th>
                                                <th>Role</th>
                                                <th>Joined</th>
                                                <th>Left</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pageRows.map((r, idx) => {
                                                const p = info(r);
                                                return (
                                                    <tr key={r.id} className={isMine(r) ? "table-warning" : ""}>
                                                        <th>{firstVisibleIndex + idx + 1}</th>
                                                        <td>
                                                            <div className="d-flex align-items-center gap-2">
                                                                {p.image ? (
                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img
                                                                        src={p.image}
                                                                        alt={p.name}
                                                                        className="rounded-circle border"
                                                                        style={{ width: 40, height: 40, objectFit: "cover" }}
                                                                    />
                                                                ) : (
                                                                    <div
                                                                        className="rounded-circle bg-light border d-flex align-items-center justify-content-center text-muted fw-bold"
                                                                        style={{ width: 40, height: 40 }}
                                                                    >
                                                                        {p.name?.[0]?.toUpperCase()}
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <div>
                                                                        {p.name}
                                                                        <span
                                                                            className={`badge ms-2 ${p.type === "Academy" ? "bg-primary" : "bg-info text-dark"}`}
                                                                        >
                                                                            {p.type}
                                                                        </span>
                                                                    </div>
                                                                    <small className="text-muted">{p.email || p.phone || ""}</small>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div>{r.team_name}</div>
                                                            <small className="text-muted">{r.team_code || "—"}</small>
                                                        </td>
                                                        {isSuper && <td>{r.academy_name || "—"}</td>}
                                                        <td>
                                                            {r.branch_name || "—"}
                                                            {isMine(r) && (
                                                                <span className="badge bg-warning text-dark ms-2">My Branch</span>
                                                            )}
                                                        </td>
                                                        <td>{r.jersey_no || "—"}</td>
                                                        <td>{r.player_role || "—"}</td>
                                                        <td>{fmtDate(r.joined_date)}</td>
                                                        <td>{fmtDate(r.left_date)}</td>
                                                        <td>
                                                            <span className={`badge ${Number(r.status) === 1 ? "bg-success" : "bg-secondary"}`}>
                                                                {Number(r.status) === 1 ? "Active" : "Inactive"}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="d-flex justify-content-start gap-2">
                                                                {canManage(r) ? (
                                                                    <>
                                                                        <Link
                                                                            href={`/next_panel/team-players/${r.id}/edit`}
                                                                            className="btn btn-outline-secondary"
                                                                            aria-label="Edit team player"
                                                                        >
                                                                            <Edit size={16} />
                                                                        </Link>
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-outline-danger"
                                                                            onClick={() => handleDelete(r.id, p.name)}
                                                                            aria-label="Remove player from team"
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-outline-secondary"
                                                                        disabled
                                                                        title="Only players of your own branch can be changed"
                                                                    >
                                                                        <Lock size={16} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mt-3">
                                    <div className="d-flex align-items-center gap-2">
                                        <label htmlFor="team-player-page-size" className="form-label mb-0">Show</label>
                                        <select
                                            id="team-player-page-size"
                                            className="form-select"
                                            value={pageSize}
                                            onChange={(e) => {
                                                setPageSize(Number(e.target.value));
                                                setPage(1);
                                            }}
                                            style={{ width: 90 }}
                                        >
                                            {[10, 20, 50, 100].map((size) => (
                                                <option key={size} value={size}>{size}</option>
                                            ))}
                                        </select>
                                        <span className="text-muted">per page</span>
                                    </div>
                                    <div className="d-flex align-items-center gap-3">
                                        <span className="text-muted">
                                            Showing {firstVisibleIndex + 1}-{Math.min(firstVisibleIndex + pageSize, visible.length)} of {visible.length}
                                        </span>
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary"
                                            onClick={() => setPage((current) => Math.max(1, current - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            Previous
                                        </button>
                                        <span>Page {currentPage} of {totalPages}</span>
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary"
                                            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
