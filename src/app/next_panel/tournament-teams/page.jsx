"use client";

import { ArrowLeft, Edit, Lock, Plus, Search, SearchSlash, Trash2, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import useCurrentUser, { ROLES } from "../teams/useCurrentUser";
import useOrgOptions, { inAcademy } from "../teams/useOrgOptions";
import { PAYMENT_STATUSES, REG_STATUSES } from "./TournamentTeamForm";
import useTeamOptions from "./useTeamOptions";
import useTournamentOptions from "./useTournamentOptions";

const fmtDate = (v) => (v ? String(v).slice(0, 10) : "—");
const fmtFee = (v) => (v === null || v === undefined || v === "" ? "—" : Number(v).toLocaleString("en-IN"));

const PAYMENT_BADGE = { Paid: "bg-success", Partial: "bg-warning text-dark", Pending: "bg-secondary", Cancelled: "bg-danger" };
const STATUS_BADGE = {
    Registered: "bg-info text-dark",
    Confirmed: "bg-primary",
    Completed: "bg-success",
    Withdrawn: "bg-secondary",
    Disqualified: "bg-danger",
};

export default function TournamentTeamsPage() {
    const me = useCurrentUser();
    const { academies, branches, error: orgError } = useOrgOptions(me);
    const { tournaments, error: tournamentError } = useTournamentOptions(me);
    const { teams, error: teamError } = useTeamOptions(me);

    const isSuper = me.role === ROLES.SUPER;
    const isBranchAdmin = me.role === ROLES.BRANCH;
    // Fail closed: never list anything if we can't tell who is logged in
    const blocked = me.ready && (!me.role || (!isSuper && !me.academyId) || (isBranchAdmin && !me.branchId));

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [rows, setRows] = useState([]);

    // Filters (all supported server-side by GET /api/tournament-teams)
    const [tournamentId, setTournamentId] = useState("");
    const [teamId, setTeamId] = useState("");
    const [registrationNo, setRegistrationNo] = useState("");
    const [paymentStatus, setPaymentStatus] = useState("");
    const [status, setStatus] = useState("");
    const [academyId, setAcademyId] = useState(""); // super admin only
    const [branchId, setBranchId] = useState("");

    const effectiveAcademyId = isSuper ? academyId : me.academyId ?? "";
    const branchOptions = branches.filter((b) => !effectiveAcademyId || inAcademy(b, effectiveAcademyId));
    // Academy / branch here refer to the TOURNAMENT's academy / branch (that is how the API filters)
    const tournamentOptions = tournaments.filter(
        (t) =>
            (!effectiveAcademyId || Number(t.academy_id) === Number(effectiveAcademyId)) &&
            (!branchId || Number(t.branch_id) === Number(branchId))
    );
    const teamOptions = teams;

    // Branch admin sees the whole academy, but only manages their own branch's registrations
    const isMine = (r) => isBranchAdmin && Number(r.branch_id) === Number(me.branchId);
    const canManage = (r) => !isBranchAdmin || isMine(r);

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
                if (tournamentId) params.set("tournament_id", tournamentId);
                if (teamId) params.set("team_id", teamId);
                if (registrationNo.trim()) params.set("registration_no", registrationNo.trim());
                if (paymentStatus) params.set("payment_status", paymentStatus);
                if (status) params.set("status", status);

                const query = params.toString();
                const res = await fetch(`/api/tournament-teams${query ? `?${query}` : ""}`, { signal: controller.signal });
                const json = await res.json();

                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Unable to load Tournament Teams.");
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
    }, [me.ready, blocked, effectiveAcademyId, branchId, tournamentId, teamId, registrationNo, paymentStatus, status]);

    const handleAcademyChange = (e) => {
        setAcademyId(e.target.value);
        setBranchId("");
        setTournamentId("");
        setTeamId("");
    };

    const handleBranchChange = (e) => {
        setBranchId(e.target.value);
        setTournamentId("");
    };

    const handleClear = (e) => {
        e.preventDefault();
        setTournamentId("");
        setTeamId("");
        setRegistrationNo("");
        setPaymentStatus("");
        setStatus("");
        setAcademyId("");
        setBranchId("");
    };

    const handleDelete = async (r) => {
        if (!confirm(`Remove "${r.team_name}" from "${r.tournament_name}"? The registration will be marked Withdrawn.`)) return;
        setError(null);
        try {
            const res = await fetch(`/api/tournament-teams/${r.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to remove registration");
            }
            setRows((current) => current.filter((x) => x.id !== r.id));
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
                                <h3 className="mb-0"><Trophy /> Tournament Teams</h3>
                                <p className="text-muted mb-0">
                                    {isSuper && "Team registrations across all academies."}
                                    {me.role === ROLES.ACADEMY && "Team registrations for your academy's tournaments."}
                                    {isBranchAdmin && "Registrations for your academy's tournaments. Your branch's tournaments are highlighted."}
                                    {!me.role && "Manage tournament team registrations."}
                                </p>
                            </div>
                            {!blocked && (
                                <Link href="/next_panel/tournament-teams/new" className="btn btn-primary px-4">
                                    <Plus size={18} /> Register Team
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
                                <div className="input-group" style={{ maxWidth: "210px" }}>
                                    <span className="input-group-text bg-white"><Search size={18} /></span>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Registration no"
                                        value={registrationNo}
                                        onChange={(e) => setRegistrationNo(e.target.value)}
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
                                    value={tournamentId}
                                    onChange={(e) => setTournamentId(e.target.value)}
                                    style={{ maxWidth: "210px" }}
                                >
                                    <option value="">Choose Tournament</option>
                                    {tournamentOptions.map((t) => (
                                        <option key={t.id} value={t.id}>{t.tournament_name}</option>
                                    ))}
                                </select>

                                <select
                                    className="form-select"
                                    value={teamId}
                                    onChange={(e) => setTeamId(e.target.value)}
                                    style={{ maxWidth: "190px" }}
                                >
                                    <option value="">Choose Team</option>
                                    {teamOptions.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.team_name}{t.academy_name ? ` (${t.academy_name})` : ""}
                                            </option>
                                    ))}
                                </select>

                                <select
                                    className="form-select"
                                    value={paymentStatus}
                                    onChange={(e) => setPaymentStatus(e.target.value)}
                                    style={{ maxWidth: "170px" }}
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
                                    style={{ maxWidth: "170px" }}
                                >
                                    <option value="">Choose Status</option>
                                    {REG_STATUSES.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
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
                            {(error || orgError || tournamentError || teamError) && (
                                <div className="alert alert-danger">{error || orgError || tournamentError || teamError}</div>
                            )}

                            {loading || !me.ready ? (
                                <div className="text-center py-5 text-muted">Loading tournament teams...</div>
                            ) : rows.length === 0 ? (
                                <div className="text-center py-5 text-muted">No tournament teams found.</div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table align-middle mb-0">
                                        <thead className="table-success">
                                            <tr>
                                                <th>#</th>
                                                <th>Tournament</th>
                                                {isSuper && <th>Academy</th>}
                                                <th>Branch</th>
                                                <th>Team</th>
                                                <th>Reg. No</th>
                                                <th>Registered</th>
                                                <th>Fee</th>
                                                <th>Payment</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((r, idx) => (
                                                <tr key={r.id} className={isMine(r) ? "table-warning" : ""}>
                                                    <th>{idx + 1}</th>
                                                    <td>
                                                        <div>{r.tournament_name}</div>
                                                        <small className="text-muted">{r.tournament_code || "—"}</small>
                                                    </td>
                                                    {isSuper && <td>{r.academy_name || "—"}</td>}
                                                    <td>
                                                        {r.branch_name || "—"}
                                                        {isMine(r) && (
                                                            <span className="badge bg-warning text-dark ms-2">My Branch</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div>{r.team_name}</div>
                                                        <small className="text-muted">
                                                            {[r.team_code, r.age_group, r.category].filter(Boolean).join(" · ") || "—"}
                                                        </small>
                                                    </td>
                                                    <td>{r.registration_no || "—"}</td>
                                                    <td>{fmtDate(r.registered_date)}</td>
                                                    <td>{fmtFee(r.team_fee)}</td>
                                                    <td>
                                                        <span className={`badge ${PAYMENT_BADGE[r.payment_status] || "bg-secondary"}`}>
                                                            {r.payment_status}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`badge ${STATUS_BADGE[r.status] || "bg-secondary"}`}>
                                                            {r.status}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="d-flex justify-content-start gap-2">
                                                            {canManage(r) ? (
                                                                <>
                                                                    <Link
                                                                        href={`/next_panel/tournament-teams/${r.id}/edit`}
                                                                        className="btn btn-outline-secondary"
                                                                        aria-label="Edit registration"
                                                                    >
                                                                        <Edit size={16} />
                                                                    </Link>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-outline-danger"
                                                                        onClick={() => handleDelete(r)}
                                                                        aria-label="Remove registration"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-outline-secondary"
                                                                    disabled
                                                                    title="Only registrations of your own branch can be changed"
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
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
