"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useCurrentUser, { ROLES } from "../teams/useCurrentUser";
import useTeamOptions from "./useTeamOptions";
import usePlayerOptions from "./usePlayerOptions";

// Same list the API validates against
export const PLAYER_ROLES = ["Player", "Captain", "Vice Captain", "Wicket Keeper", "All Rounder", "Bowler", "Batter"];

const toDateInput = (v) => (v ? String(v).slice(0, 10) : "");

const EMPTY_FORM = {
    team_id: "",
    source: "user", // "user" -> user_id, "outside" -> outside_player_id
    user_id: "",
    outside_player_id: "",
    jersey_no: "",
    player_role: "Player",
    joined_date: "",
    left_date: "",
    status: 1,
};

export default function TeamPlayerForm({ id = null, returnTo = "/next_panel/team-players" }) {
    const router = useRouter();
    const isEdit = Boolean(id);

    const me = useCurrentUser();
    const { teams, error: teamError } = useTeamOptions(me);
    const { users, outsidePlayers, error: playerError } = usePlayerOptions(me);

    const isSuper = me.role === ROLES.SUPER;
    const isBranchAdmin = me.role === ROLES.BRANCH;
    const blocked = me.ready && (!me.role || (!isSuper && !me.academyId) || (isBranchAdmin && !me.branchId));

    const [formData, setFormData] = useState(EMPTY_FORM);
    const [current, setCurrent] = useState(null); // the saved record (edit) - fallback labels
    const [playerSearch, setPlayerSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [forbidden, setForbidden] = useState(false);
    const [error, setError] = useState("");

    // GET SINGLE TEAM PLAYER (edit mode)
    useEffect(() => {
        if (!id || !me.ready || blocked) return;

        (async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/team-players/${id}`);
                const result = await res.json();

                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Failed to fetch Team Player");
                }

                const d = result.data;

                // UX guard: scoped roles can only open records they are allowed to manage
                const isUnscopedTeam = d.academy_id == null && d.branch_id == null;
                if (!isSuper && !isUnscopedTeam && Number(d.academy_id) !== Number(me.academyId)) {
                    return setForbidden(true);
                }

                setCurrent(d);
                setFormData({
                    team_id: d.team_id ?? "",
                    source: d.user_id ? "user" : "outside",
                    user_id: d.user_id ?? "",
                    outside_player_id: d.outside_player_id ?? "",
                    jersey_no: d.jersey_no || "",
                    player_role: d.player_role || "Player",
                    joined_date: toDateInput(d.joined_date),
                    left_date: toDateInput(d.left_date),
                    status: d.status ?? 1,
                });
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        })();
    }, [id, me.ready, blocked, isSuper, isBranchAdmin, me.academyId, me.branchId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: name === "status" ? Number(value) : value }));
    };

    const setSource = (source) => {
        setPlayerSearch("");
        setFormData((prev) => ({ ...prev, source, user_id: "", outside_player_id: "" }));
    };

    // ---------- dropdown options ----------
    const teamId = Number(formData.team_id);
    let teamChoices = teams.filter(
        (t) =>
            (Number(t.status) === 1 || Number(t.id) === teamId)
    );
    if (current && !teamChoices.some((t) => Number(t.id) === Number(current.team_id))) {
        teamChoices = [{ id: current.team_id, team_name: current.team_name, team_code: current.team_code }, ...teamChoices];
    }

    const isUserSource = formData.source === "user";
    const selectedPlayerId = Number(isUserSource ? formData.user_id : formData.outside_player_id);
    const search = playerSearch.trim().toLowerCase();

    let playerChoices = (isUserSource ? users : outsidePlayers).filter(
        (p) =>
            !search ||
            Number(p.id) === selectedPlayerId ||
            `${p.label} ${p.email || ""}`.toLowerCase().includes(search)
    );
    // keep the saved player selectable even if the list API doesn't return them
    const savedId = isUserSource ? current?.user_id : current?.outside_player_id;
    if (savedId && !playerChoices.some((p) => Number(p.id) === Number(savedId))) {
        const label = isUserSource ? current.player_name : current.outside_player_name;
        playerChoices = [{ id: savedId, label: label || `#${savedId}` }, ...playerChoices];
    }

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.team_id) return setError("Please choose a team");
        if (!selectedPlayerId) return setError("Please choose a player");
        if (formData.joined_date && formData.left_date && formData.left_date < formData.joined_date) {
            return setError("Left date cannot be before joined date");
        }

        try {
            setLoading(true);
            setError("");

            // API accepts exactly one of user_id / outside_player_id
            const payload = {
                team_id: Number(formData.team_id),
                jersey_no: formData.jersey_no.trim() || null,
                player_role: formData.player_role,
                joined_date: formData.joined_date || null,
                left_date: formData.left_date || null,
                status: formData.status,
                ...(isUserSource ? { user_id: selectedPlayerId } : { outside_player_id: selectedPlayerId }),
            };

            const res = await fetch(isEdit ? `/api/team-players/${id}` : `/api/team-players`, {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || "Something went wrong");
            }

            alert(isEdit ? "Team player updated successfully" : "Player added to team successfully");

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
        return <div className="alert alert-danger">You do not have access to this team player.</div>;
    }

    const loadError = teamError || playerError;

    return (
        <div className="card shadow-sm">
            <div className="card-header">
                <h5 className="mb-0">{isEdit ? "Edit Team Player" : "Add Team Player"}</h5>
            </div>

            <div className="card-body">
                {(error || loadError) && <div className="alert alert-danger">{error || loadError}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label className="form-label">Team</label>
                        <select name="team_id" className="form-select" value={formData.team_id} onChange={handleChange} required>
                            <option value="">Choose Team</option>
                            {teamChoices.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.team_name}
                                    {t.team_code ? ` (${t.team_code})` : ""}
                                    {isSuper && t.academy_name ? ` — ${t.academy_name}` : ""}
                                    {t.branch_name ? ` / ${t.branch_name}` : ""}
                                </option>
                            ))}
                        </select>
                        {isBranchAdmin && <div className="form-text">All teams in your academy, including external teams, are listed.</div>}
                    </div>

                    {/* Player source */}
                    <div className="mb-2">
                        <label className="form-label d-block">Player Type</label>
                        <div className="form-check form-check-inline">
                            <input
                                className="form-check-input"
                                type="radio"
                                id="src-user"
                                checked={isUserSource}
                                onChange={() => setSource("user")}
                            />
                            <label className="form-check-label" htmlFor="src-user">Academy player</label>
                        </div>
                        <div className="form-check form-check-inline">
                            <input
                                className="form-check-input"
                                type="radio"
                                id="src-outside"
                                checked={!isUserSource}
                                onChange={() => setSource("outside")}
                            />
                            <label className="form-check-label" htmlFor="src-outside">Outside player</label>
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Search player..."
                                value={playerSearch}
                                onChange={(e) => setPlayerSearch(e.target.value)}
                            />
                        </div>
                        <div className="col-md-8 mb-3">
                            <select
                                name={isUserSource ? "user_id" : "outside_player_id"}
                                className="form-select"
                                value={isUserSource ? formData.user_id : formData.outside_player_id}
                                onChange={handleChange}
                                required
                            >
                                <option value="">{isUserSource ? "Choose Academy Player" : "Choose Outside Player"}</option>
                                {playerChoices.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.label}
                                        {p.email ? ` — ${p.email}` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Jersey No (optional)</label>
                            <input
                                type="text"
                                name="jersey_no"
                                className="form-control"
                                value={formData.jersey_no}
                                onChange={handleChange}
                                placeholder="e.g. 18"
                            />
                            <div className="form-text">Must be unique within the team.</div>
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Player Role</label>
                            <select name="player_role" className="form-select" value={formData.player_role} onChange={handleChange}>
                                {PLAYER_ROLES.map((r) => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Status</label>
                            <select name="status" className="form-select" value={formData.status} onChange={handleChange}>
                                <option value={1}>Active</option>
                                <option value={0}>Inactive</option>
                            </select>
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Joined Date (optional)</label>
                            <input
                                type="date"
                                name="joined_date"
                                className="form-control"
                                value={formData.joined_date}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Left Date (optional)</label>
                            <input
                                type="date"
                                name="left_date"
                                className="form-control"
                                value={formData.left_date}
                                min={formData.joined_date || undefined}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="d-flex gap-2">
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? "Saving..." : isEdit ? "Update Player" : "Add Player"}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => router.push(returnTo)}>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
