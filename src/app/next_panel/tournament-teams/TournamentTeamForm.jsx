"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import useCurrentUser, { ROLES } from "../teams/useCurrentUser";
import useTeamOptions from "./useTeamOptions";
import useTournamentOptions from "./useTournamentOptions";

// Same lists the API validates against
export const PAYMENT_STATUSES = ["Pending", "Partial", "Paid", "Cancelled"];
export const REG_STATUSES = ["Registered", "Confirmed", "Withdrawn", "Disqualified", "Completed"];

const OPEN_STATUS = "Registration Open";
const toDateInput = (v) => (v ? String(v).slice(0, 10) : "");
const todayLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const EMPTY_FORM = {
    tournament_id: "",
    team_id: "",
    registration_no: "",
    registered_date: "",
    team_fee: "",
    payment_status: "Pending",
    status: "Registered",
};

export default function TournamentTeamForm({ id = null, returnTo = "/next_panel/tournament-teams" }) {
    const router = useRouter();
    const isEdit = Boolean(id);

    const me = useCurrentUser();
    const { tournaments, error: tournamentError } = useTournamentOptions(me);
    const { teams, error: teamError } = useTeamOptions(me);

    const isSuper = me.role === ROLES.SUPER;
    const isBranchAdmin = me.role === ROLES.BRANCH;
    const blocked = me.ready && (!me.role || (!isSuper && !me.academyId) || (isBranchAdmin && !me.branchId));

    const [formData, setFormData] = useState({ ...EMPTY_FORM, registered_date: todayLocal() });
    const [current, setCurrent] = useState(null); // saved record (edit mode)
    const [registrations, setRegistrations] = useState([]); // existing registrations of the chosen tournament
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [forbidden, setForbidden] = useState(false);
    const [error, setError] = useState("");

    // GET SINGLE REGISTRATION (edit mode)
    useEffect(() => {
        if (!id || !me.ready || blocked) return;

        (async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/tournament-teams/${id}`);
                const result = await res.json();

                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Failed to fetch registration");
                }

                const d = result.data;

                // UX guard: scoped roles can only open registrations they are allowed to manage
                if (!isSuper && Number(d.academy_id) !== Number(me.academyId)) return setForbidden(true);
                if (isBranchAdmin && Number(d.branch_id) !== Number(me.branchId)) return setForbidden(true);

                setCurrent(d);
                setFormData({
                    tournament_id: d.tournament_id ?? "",
                    team_id: d.team_id ?? "",
                    registration_no: d.registration_no || "",
                    registered_date: toDateInput(d.registered_date),
                    team_fee: d.team_fee ?? "",
                    payment_status: d.payment_status || "Pending",
                    status: d.status || "Registered",
                });
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        })();
    }, [id, me.ready, blocked, isSuper, isBranchAdmin, me.academyId, me.branchId]);

    // CREATE: load who is already registered in the chosen tournament (avoids 409s + shows capacity)
    useEffect(() => {
        if (isEdit || !formData.tournament_id) {
            setRegistrations([]);
            return;
        }
        const controller = new AbortController();
        (async () => {
            try {
                const res = await fetch(`/api/tournament-teams?tournament_id=${formData.tournament_id}`, {
                    signal: controller.signal,
                });
                const json = await res.json();
                if (res.ok && json.success) setRegistrations(json.data || []);
            } catch {
                /* hints only - the API still validates */
            }
        })();
        return () => controller.abort();
    }, [isEdit, formData.tournament_id]);

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === "tournament_id" && !isEdit) {
            const t = tournaments.find((x) => Number(x.id) === Number(value));
            // new tournament -> reset team, prefill its fee
            return setFormData((prev) => ({ ...prev, tournament_id: value, team_id: "", team_fee: t?.team_fee ?? "" }));
        }

        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    // ---------- dropdown options (create) ----------
    const tournament = tournaments.find((x) => Number(x.id) === Number(formData.tournament_id));

    const tournamentChoices = tournaments.filter(
        (t) => t.status === OPEN_STATUS && (!isBranchAdmin || Number(t.branch_id) === Number(me.branchId))
    );

    const registeredTeamIds = new Set(registrations.map((r) => Number(r.team_id)));
    const activeCount = registrations.filter((r) => r.status !== "Withdrawn" && r.status !== "Disqualified").length;
    const maxTeams = Number(tournament?.max_teams) || 0;
    const isFull = !isEdit && maxTeams > 0 && activeCount >= maxTeams;

    const teamChoices = !tournament
        ? []
        : teams.filter(
              (t) =>
                  Number(t.status) === 1 &&
                  !registeredTeamIds.has(Number(t.id)) &&
                  (!isBranchAdmin || Number(t.branch_id) === Number(me.branchId))
          );

    const registrationTournamentId = formData.tournament_id || current?.tournament_id;

    const handleGenerateRegistrationNo = () => {
        if (!registrationTournamentId) return;
        setFormData((prev) => ({
            ...prev,
            registration_no: `TR-${registrationTournamentId}-${Date.now()}`,
        }));
        setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!isEdit) {
            if (!formData.tournament_id) return setError("Please choose a tournament");
            if (!formData.team_id) return setError("Please choose a team");
            if (isFull) return setError("Maximum team registration limit reached for this tournament");
        }
        if (formData.team_fee !== "" && (!Number.isFinite(Number(formData.team_fee)) || Number(formData.team_fee) < 0)) {
            return setError("Team fee must be a valid amount");
        }

        try {
            setLoading(true);
            setError("");

            const common = {
                payment_status: formData.payment_status,
                status: formData.status,
                registered_date: formData.registered_date || null,
                // blank fee -> API uses the tournament's fee (create) / keeps current fee (edit)
                ...(formData.team_fee !== "" ? { team_fee: Number(formData.team_fee) } : {}),
                // blank number -> auto-generated (create) / kept as is (edit)
                ...(formData.registration_no.trim() ? { registration_no: formData.registration_no.trim() } : {}),
            };

            // On edit, tournament & team are locked (changing them would skip the
            // "Registration Open" and max-teams checks), so they are not sent.
            const payload = isEdit
                ? common
                : {
                      ...common,
                      tournament_id: Number(formData.tournament_id),
                      team_id: Number(formData.team_id),
                      ...(me.id ? { created_by: me.id } : {}),
                  };

            const res = await fetch(isEdit ? `/api/tournament-teams/${id}` : `/api/tournament-teams`, {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || "Something went wrong");
            }

            alert(isEdit ? "Registration updated successfully" : "Team registered successfully");

            router.push(returnTo);
            router.refresh();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!me.ready || fetching) {
        return <div className="text-center py-5">Loading...</div>;
    }

    if (blocked) {
        return <div className="alert alert-warning">Unable to determine your role / academy / branch. Please log in again.</div>;
    }

    if (forbidden) {
        return <div className="alert alert-danger">You do not have access to this registration.</div>;
    }

    const loadError = isEdit ? "" : tournamentError || teamError;

    return (
        <div className="card shadow-sm">
            <div className="card-header">
                <h5 className="mb-0">{isEdit ? "Edit Registration" : "Register Team"}</h5>
            </div>

            <div className="card-body">
                {(error || loadError) && <div className="alert alert-danger">{error || loadError}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Tournament</label>
                            {isEdit ? (
                                <input
                                    type="text"
                                    className="form-control"
                                    disabled
                                    value={`${current?.tournament_name || ""}${current?.tournament_code ? ` (${current.tournament_code})` : ""}`}
                                />
                            ) : (
                                <select
                                    name="tournament_id"
                                    className="form-select"
                                    value={formData.tournament_id}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="">Choose Tournament</option>
                                    {tournamentChoices.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.tournament_name}
                                            {t.tournament_code ? ` (${t.tournament_code})` : ""}
                                        </option>
                                    ))}
                                </select>
                            )}
                            <div className="form-text">
                                {isEdit
                                    ? "Tournament and team cannot be changed. Remove and register again instead."
                                    : "Only tournaments with status “Registration Open” are listed."}
                            </div>
                        </div>

                        <div className="col-md-6 mb-3">
                            <label className="form-label">Team</label>
                            {isEdit ? (
                                <input
                                    type="text"
                                    className="form-control"
                                    disabled
                                    value={`${current?.team_name || ""}${current?.team_code ? ` (${current.team_code})` : ""}`}
                                />
                            ) : (
                                <select name="team_id" className="form-select" value={formData.team_id} onChange={handleChange} required>
                                    <option value="">{tournament ? "Choose Team" : "Choose tournament first"}</option>
                                    {teamChoices.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.team_name}
                                            {t.team_code ? ` (${t.team_code})` : ""}
                                            {t.branch_name ? ` — ${t.branch_name}` : ""}
                                            {t.academy_name ? ` · ${t.academy_name}` : ""}
                                        </option>
                                    ))}
                                </select>
                            )}
                            {!isEdit && tournament && (
                                <div className={`form-text ${isFull ? "text-danger" : ""}`}>
                                    {maxTeams > 0
                                        ? `${activeCount} / ${maxTeams} teams registered${isFull ? " — registration is full" : ""}`
                                        : `${activeCount} team(s) registered`}
                                    {teamChoices.length === 0 && !isFull ? " · no eligible teams available" : ""}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Registration No (optional)</label>
                            <div className="input-group">
                                <input
                                    type="text"
                                    name="registration_no"
                                    className="form-control"
                                    value={formData.registration_no}
                                    onChange={handleChange}
                                    placeholder="Auto-generated if empty"
                                />
                                <button
                                    type="button"
                                    className="btn btn-outline-primary"
                                    onClick={handleGenerateRegistrationNo}
                                    disabled={!registrationTournamentId || loading}
                                    title="Generate registration number"
                                >
                                    <RefreshCw size={16} /> Generate
                                </button>
                            </div>
                            <div className="form-text">Must be unique within the tournament.</div>
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Registered Date (optional)</label>
                            <input
                                type="date"
                                name="registered_date"
                                className="form-control"
                                value={formData.registered_date}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Team Fee (optional)</label>
                            <input
                                type="number"
                                name="team_fee"
                                className="form-control"
                                min="0"
                                step="0.01"
                                value={formData.team_fee}
                                onChange={handleChange}
                                placeholder="Tournament fee if empty"
                            />
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Payment Status</label>
                            <select
                                name="payment_status"
                                className="form-select"
                                value={formData.payment_status}
                                onChange={handleChange}
                            >
                                {PAYMENT_STATUSES.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-6 mb-3">
                            <label className="form-label">Registration Status</label>
                            <select name="status" className="form-select" value={formData.status} onChange={handleChange}>
                                {REG_STATUSES.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="d-flex gap-2">
                        <button type="submit" className="btn btn-primary" disabled={loading || isFull}>
                            {loading ? "Saving..." : isEdit ? "Update Registration" : "Register Team"}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => router.push(returnTo)}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
