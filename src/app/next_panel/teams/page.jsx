"use client";

import { ArrowLeft, Edit, Lock, Plus, Search, SearchSlash, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TEAM_TYPES } from "./TeamForm";
import useCurrentUser, { ROLES } from "./useCurrentUser";
import useOrgOptions, { inAcademy } from "./useOrgOptions";
import Pagination from "../components/Pagination";

export default function TeamsPage() {
    const me = useCurrentUser();
    const { academies, branches, error: orgError } = useOrgOptions(me);

    const isSuper = me.role === ROLES.SUPER;
    const isBranchAdmin = me.role === ROLES.BRANCH;
    // Fail closed: never list teams if we can't tell who is logged in
    const blocked = me.ready && (!me.role || (!isSuper && !me.academyId) || (isBranchAdmin && !me.branchId));

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [teams, setTeams] = useState([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    // Filters (all supported server-side by GET /api/teams)
    const [teamName, setTeamName] = useState("");
    const [teamCode, setTeamCode] = useState("");
    const [teamType, setTeamType] = useState("");
    const [category, setCategory] = useState("");
    const [ageGroup, setAgeGroup] = useState("");
    const [academyId, setAcademyId] = useState(""); // only used by super admin
    const [branchId, setBranchId] = useState("");
    const [status, setStatus] = useState("");

    // Super admin: chosen academy. Academy / branch admin: always their own academy.
    const effectiveAcademyId = isSuper ? academyId : me.academyId ?? "";
    const branchOptions = branches.filter((b) => !effectiveAcademyId || inAcademy(b, effectiveAcademyId));

    // Branch admin sees the whole academy, but only manages their own branch's teams
    const isMine = (t) => isBranchAdmin && Number(t.branch_id) === Number(me.branchId);
    const canManage = (t) => !isBranchAdmin || isMine(t);

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
            setPage(1);
            try {
                const params = new URLSearchParams();
                if (effectiveAcademyId) params.set("academy_id", effectiveAcademyId);
                if (branchId) params.set("branch_id", branchId);
                if (teamName.trim()) params.set("team_name", teamName.trim());
                if (teamCode.trim()) params.set("team_code", teamCode.trim());
                if (teamType) params.set("team_type", teamType);
                if (category.trim()) params.set("category", category.trim());
                if (ageGroup.trim()) params.set("age_group", ageGroup.trim());
                if (status !== "") params.set("status", status);

                const query = params.toString();
                const res = await fetch(`/api/teams${query ? `?${query}` : ""}`, { signal: controller.signal });
                const json = await res.json();

                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Unable to load Teams.");
                }
                setTeams(json.data || []);
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
    }, [me.ready, blocked, effectiveAcademyId, branchId, teamName, teamCode, teamType, category, ageGroup, status]);

    const handleAcademyChange = (e) => {
        setAcademyId(e.target.value);
        setBranchId(""); // branch list depends on the academy
    };

    const handleClear = (e) => {
        e.preventDefault();
        setTeamName("");
        setTeamCode("");
        setTeamType("");
        setCategory("");
        setAgeGroup("");
        setAcademyId("");
        setBranchId("");
        setStatus("");
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete team "${name}"?`)) return;
        setError(null);
        try {
            const res = await fetch(`/api/teams/${id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to delete team");
            }
            setTeams((current) => current.filter((t) => t.id !== id));
        } catch (err) {
            setError(err.message);
        }
    };

    const totalPages = Math.ceil(teams.length / PAGE_SIZE) || 1;
    const pagedTeams = teams.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
                                <h3 className="mb-0"><Users /> Teams</h3>
                                <p className="text-muted mb-0">
                                    {isSuper && "All teams across every academy."}
                                    {me.role === ROLES.ACADEMY && "All teams in your academy."}
                                    {isBranchAdmin && "All teams in your academy. Teams from your branch are highlighted."}
                                    {!me.role && "Manage teams."}
                                </p>
                            </div>
                            {!blocked && (
                                <Link href="/next_panel/teams/new" className="btn btn-primary px-4">
                                    <Plus size={18} /> Add Team
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
                                <div className="input-group" style={{ maxWidth: "240px" }}>
                                    <span className="input-group-text bg-white"><Search size={18} /></span>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Team name"
                                        value={teamName}
                                        onChange={(e) => setTeamName(e.target.value)}
                                    />
                                </div>

                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Code"
                                    style={{ maxWidth: "130px" }}
                                    value={teamCode}
                                    onChange={(e) => setTeamCode(e.target.value)}
                                />

                                {isSuper && (
                                    <select
                                        className="form-select"
                                        value={academyId}
                                        onChange={handleAcademyChange}
                                        style={{ maxWidth: "200px" }}
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
                                    onChange={(e) => setBranchId(e.target.value)}
                                    style={{ maxWidth: "200px" }}
                                >
                                    <option value="">Choose Branch</option>
                                    {branchOptions.map((b) => (
                                        <option key={b.id} value={b.id}>{b.branch_name}</option>
                                    ))}
                                </select>

                                <select
                                    className="form-select"
                                    value={teamType}
                                    onChange={(e) => setTeamType(e.target.value)}
                                    style={{ maxWidth: "160px" }}
                                >
                                    <option value="">Choose Type</option>
                                    {TEAM_TYPES.map((t) => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>

                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Category"
                                    style={{ maxWidth: "140px" }}
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                />

                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Age group"
                                    style={{ maxWidth: "130px" }}
                                    value={ageGroup}
                                    onChange={(e) => setAgeGroup(e.target.value)}
                                />

                                <select
                                    className="form-select"
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
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
                            {(error || orgError) && <div className="alert alert-danger">{error || orgError}</div>}

                            {loading || !me.ready ? (
                                <div className="text-center py-5 text-muted">Loading teams...</div>
                            ) : teams.length === 0 ? (
                                <div className="text-center py-5 text-muted">No teams found.</div>
                            ) : (
                                <>
                                <div className="table-responsive">
                                    <table className="table align-middle mb-0">
                                        <thead className="table-success">
                                            <tr>
                                                <th>#</th>
                                                <th>Team</th>
                                                {isSuper && <th>Academy</th>}
                                                <th>Branch</th>
                                                <th>Type</th>
                                                <th>Category</th>
                                                <th>Age Group</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pagedTeams.map((item, idx) => (
                                                <tr key={item.id} className={isMine(item) ? "table-warning" : ""}>
                                                    <th>{(page - 1) * PAGE_SIZE + idx + 1}</th>
                                                    <td>
                                                        <div>{item.team_name}</div>
                                                        <small className="text-muted">{item.team_code || "—"}</small>
                                                    </td>
                                                    {isSuper && <td>{item.academy_name || "—"}</td>}
                                                    <td>
                                                        {item.branch_name || "—"}
                                                        {isMine(item) && (
                                                            <span className="badge bg-warning text-dark ms-2">My Branch</span>
                                                        )}
                                                    </td>
                                                    <td>{item.team_type || "—"}</td>
                                                    <td>{item.category || "—"}</td>
                                                    <td>{item.age_group || "—"}</td>
                                                    <td>
                                                        <span className={`badge ${Number(item.status) === 1 ? "bg-success" : "bg-secondary"}`}>
                                                            {Number(item.status) === 1 ? "Active" : "Inactive"}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="d-flex justify-content-start gap-2">
                                                            {canManage(item) ? (
                                                                <>
                                                                    <Link
                                                                        href={`/next_panel/teams/${item.id}/edit`}
                                                                        className="btn btn-outline-secondary"
                                                                        aria-label="Edit team"
                                                                    >
                                                                        <Edit size={16} />
                                                                    </Link>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-outline-danger"
                                                                        onClick={() => handleDelete(item.id, item.team_name)}
                                                                        aria-label="Delete team"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-outline-secondary"
                                                                    disabled
                                                                    title="Only teams from your own branch can be changed"
                                                                >
                                                                    <Lock size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <Pagination
                                    page={page}
                                    totalPages={totalPages}
                                    total={teams.length}
                                    onPageChange={setPage}
                                    pageSize={PAGE_SIZE}
                                />
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
