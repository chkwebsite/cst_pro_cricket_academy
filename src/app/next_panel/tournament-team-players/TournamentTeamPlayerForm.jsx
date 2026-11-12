"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useCurrentUser from "../teams/useCurrentUser";
import useTournamentOptions from "../tournament-teams/useTournamentOptions";

const PLAYER_ROLES = ["Player", "Captain", "Vice Captain", "Wicket Keeper", "All Rounder", "Bowler", "Batter"];
const PAYMENT_STATUSES = ["Pending", "Partial", "Paid"];
const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque"];

const EMPTY_FORM = {
    tournament_id: "",
    tournament_team_id: "",
    team_id: "",
    player_source: "user", // "user" | "outside"
    user_id: "",
    outside_player_id: "",
    jersey_no: "",
    player_role: "Player",
    player_fee: 0,
    paid_amount: 0,
    payment_mode: "Cash",
    transaction_no: "",
    payment_status: "Pending",
    status: 1,
};

export default function TournamentTeamPlayerForm({ id = null, returnTo = "/next_panel/tournament-team-players" }) {
    const router = useRouter();
    const isEdit = Boolean(id);
    const me = useCurrentUser();
    const { tournaments, error: tournamentError } = useTournamentOptions(me);

    const [formData, setFormData] = useState(EMPTY_FORM);
    const [tournamentTeams, setTournamentTeams] = useState([]);
    const [enrolledTournamentPlayers, setEnrolledTournamentPlayers] = useState([]);
    const [registeredPlayers, setRegisteredPlayers] = useState([]);
    const [outsidePlayers, setOutsidePlayers] = useState([]);
    const [playerOptionsLoading, setPlayerOptionsLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState("");

    // GET SINGLE TOURNAMENT TEAM PLAYER (edit mode)
    useEffect(() => {
        if (!id) return;

        const getPlayer = async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/tournament-team-players/${id}`);
                const result = await res.json();

                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Failed to fetch Tournament Team Player");
                }

                const d = result.data;
                setFormData({
                    tournament_id: d.tournament_id ?? "",
                    tournament_team_id: d.tournament_team_id ?? "",
                    team_id: d.team_id ?? "",
                    player_source: d.user_id ? "user" : "outside",
                    user_id: d.user_id ?? "",
                    outside_player_id: d.outside_player_id ?? "",
                    jersey_no: d.jersey_no ?? "",
                    player_role: d.player_role || "Player",
                    player_fee: d.player_fee ?? 0,
                    paid_amount: d.paid_amount ?? 0,
                    payment_mode: "Cash",
                    transaction_no: "",
                    payment_status: d.payment_status || "Pending",
                    status: d.status ?? 1,
                });
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        };
        getPlayer();
    }, [id]);

    useEffect(() => {
        if (!formData.tournament_id) return;

        const controller = new AbortController();
        const loadTournamentData = async () => {
            try {
                const [teamsRes, playersRes] = await Promise.all([
                    fetch(`/api/tournament-teams?tournament_id=${formData.tournament_id}`, {
                        signal: controller.signal,
                    }),
                    fetch(`/api/tournament-team-players?tournament_id=${formData.tournament_id}`, {
                        signal: controller.signal,
                    }),
                ]);

                const teamsJson = await teamsRes.json();
                if (!teamsRes.ok || !teamsJson.success) {
                    throw new Error(teamsJson.message || "Unable to load tournament teams");
                }
                setTournamentTeams((teamsJson.data || []).filter((item) => !["Withdrawn", "Disqualified"].includes(item.status)));

                const playersJson = await playersRes.json();
                if (playersRes.ok && playersJson.success) {
                    setEnrolledTournamentPlayers(playersJson.data || []);
                }
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            }
        };

        loadTournamentData();
        return () => controller.abort();
    }, [formData.tournament_id]);

    useEffect(() => {
        const controller = new AbortController();

        const loadPlayers = async () => {
            try {
                setPlayerOptionsLoading(true);
                setError("");
                const endpoint = formData.player_source === "user"
                    ? "/api/users?user_type=Player"
                    : "/api/outside-players";
                const res = await fetch(endpoint, { signal: controller.signal });
                const result = await res.json();

                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Unable to load players");
                }

                if (formData.player_source === "user") {
                    setRegisteredPlayers(result.data || []);
                } else {
                    setOutsidePlayers(result.data || []);
                }
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            } finally {
                if (!controller.signal.aborted) setPlayerOptionsLoading(false);
            }
        };

        loadPlayers();
        return () => controller.abort();
    }, [formData.player_source]);

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === "player_source") {
            setFormData((prev) => ({
                ...prev,
                player_source: value,
                user_id: "",
                outside_player_id: "",
            }));
            return;
        }

        if (name === "tournament_id") {
            if (!value) {
                setTournamentTeams([]);
                setEnrolledTournamentPlayers([]);
            }
            setFormData((prev) => ({
                ...prev,
                tournament_id: value,
                tournament_team_id: "",
                team_id: "",
                user_id: "",
                outside_player_id: "",
            }));
            return;
        }

        if ((name === "user_id" || name === "outside_player_id") && value) {
            const selectedId = Number(value);
            const isUser = name === "user_id";
            const enrolled = enrolledTournamentPlayers.find((ttp) => {
                if (isEdit && Number(ttp.id) === Number(id)) return false;
                if (isUser && Number(ttp.user_id) === selectedId) return true;
                if (!isUser && Number(ttp.outside_player_id) === selectedId) return true;
                return false;
            });

            if (enrolled) {
                const teamName = enrolled.team_name || "another team";
                const msg = `Player is already enrolled in this tournament under team "${teamName}". A player cannot be enrolled twice in the same tournament.`;
                alert(msg);
                setError(msg);
                setFormData((prev) => ({
                    ...prev,
                    [name]: "",
                }));
                return;
            }
        }

        if (name === "tournament_team_id") {
            const registration = tournamentTeams.find((item) => Number(item.id) === Number(value));
            setFormData((prev) => ({
                ...prev,
                tournament_team_id: value,
                team_id: registration ? String(registration.team_id) : "",
            }));
            return;
        }

        setFormData((prev) => ({
            ...prev,
            [name]: name === "status" ? Number(value) : value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Mirrors the API's validation
        const tournamentTeamId = Number(formData.tournament_team_id);
        const teamId = Number(formData.team_id);
        const tournamentId = Number(formData.tournament_id);
        if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
            return setError("Please choose a tournament");
        }
        if (!Number.isInteger(tournamentTeamId) || tournamentTeamId <= 0) {
            return setError("Please enter a valid tournament team ID");
        }
        if (!Number.isInteger(teamId) || teamId <= 0) {
            return setError("Please enter a valid team ID");
        }

        const isUser = formData.player_source === "user";
        const playerId = Number(isUser ? formData.user_id : formData.outside_player_id);
        if (!Number.isInteger(playerId) || playerId <= 0) {
            return setError(isUser ? "Please enter a valid user ID" : "Please enter a valid outside player ID");
        }

        const enrolled = enrolledTournamentPlayers.find((ttp) => {
            if (isEdit && Number(ttp.id) === Number(id)) return false;
            if (isUser && Number(ttp.user_id) === playerId) return true;
            if (!isUser && Number(ttp.outside_player_id) === playerId) return true;
            return false;
        });

        if (enrolled) {
            const teamName = enrolled.team_name || "another team";
            const msg = `Player is already enrolled in this tournament under team "${teamName}". A player cannot be enrolled twice in the same tournament.`;
            setError(msg);
            alert(msg);
            return;
        }

        const fee = Number(formData.player_fee);
        if (!Number.isFinite(fee) || fee < 0) return setError("Player fee must be zero or greater");
        const paidAmount = Number(formData.paid_amount);
        if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > fee) {
            return setError("Paid amount must be between zero and player fee");
        }

        try {
            setLoading(true);
            setError("");

            const res = await fetch(isEdit ? `/api/tournament-team-players/${id}` : `/api/tournament-team-players`, {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tournament_team_id: tournamentTeamId,
                    tournament_id: tournamentId,
                    team_id: teamId,
                    // exactly one player source - the other is explicitly cleared
                    user_id: isUser ? playerId : null,
                    outside_player_id: isUser ? null : playerId,
                    jersey_no: String(formData.jersey_no).trim() || null,
                    player_role: formData.player_role,
                    player_fee: fee,
                    paid_amount: paidAmount,
                    payment_mode: formData.payment_mode,
                    transaction_no: String(formData.transaction_no).trim() || null,
                    created_by: me.id,
                    payment_status: formData.payment_status,
                    status: formData.status,
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || "Something went wrong");
            }

            alert(isEdit ? "Player updated successfully" : "Player added successfully");

            router.push(returnTo);
            router.refresh();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return <div className="text-center py-5">Loading...</div>;
    }

    const isUser = formData.player_source === "user";
    const playerOptions = isUser ? registeredPlayers : outsidePlayers;
    const teamChoices = tournamentTeams.filter(
        (registration) => Number(registration.tournament_id) === Number(formData.tournament_id)
    );

    return (
        <div className="card shadow-sm">
            <div className="card-header">
                <h5 className="mb-0">{isEdit ? "Edit Tournament Player" : "Add Tournament Player"}</h5>
            </div>

            <div className="card-body">
                {error && <div className="alert alert-danger">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Tournament</label>
                            <select
                                name="tournament_id"
                                className="form-select"
                                value={formData.tournament_id}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Choose Tournament</option>
                                {tournaments.map((tournament) => (
                                    <option key={tournament.id} value={tournament.id}>{tournament.tournament_name}</option>
                                ))}
                            </select>
                            {tournamentError && <div className="form-text text-danger">{tournamentError}</div>}
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Tournament Team</label>
                            <select
                                name="tournament_team_id"
                                className="form-select"
                                value={formData.tournament_team_id}
                                onChange={handleChange}
                                required
                                disabled={!formData.tournament_id}
                            >
                                <option value="">Choose Team</option>
                                {teamChoices.map((registration) => (
                                    <option key={registration.id} value={registration.id}>
                                        {registration.team_name}{registration.team_code ? ` (${registration.team_code})` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Team ID</label>
                            <input type="text" className="form-control" value={formData.team_id} readOnly />
                            <div className="form-text">Filled from the selected tournament team.</div>
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Player Type</label>
                            <select
                                name="player_source"
                                className="form-select"
                                value={formData.player_source}
                                onChange={handleChange}
                            >
                                <option value="user">Registered user</option>
                                <option value="outside">Outside player</option>
                            </select>
                        </div>

                        <div className="col-md-8 mb-3">
                            <label className="form-label">{isUser ? "Registered Player" : "Outside Player"}</label>
                            <select
                                name={isUser ? "user_id" : "outside_player_id"}
                                className="form-select"
                                value={isUser ? formData.user_id : formData.outside_player_id}
                                onChange={handleChange}
                                required
                                disabled={playerOptionsLoading}
                            >
                                <option value="">
                                    {playerOptionsLoading ? "Loading players..." : `Choose ${isUser ? "registered" : "outside"} player`}
                                </option>
                                {isUser
                                    ? playerOptions.map((player) => {
                                          const enrolled = enrolledTournamentPlayers.find(
                                              (ttp) => (!isEdit || Number(ttp.id) !== Number(id)) && Number(ttp.user_id) === Number(player.id)
                                          );
                                          return (
                                              <option
                                                  key={player.id}
                                                  value={player.id}
                                                  disabled={Boolean(enrolled)}
                                              >
                                                  {player.first_name} {player.last_name}
                                                  {player.appointment_no ? ` (${player.appointment_no})` : ""}
                                                  {player.phone ? ` - ${player.phone}` : ""}
                                                  {enrolled ? ` — [Already enrolled in ${enrolled.team_name || "another team"}]` : ""}
                                              </option>
                                          );
                                      })
                                    : playerOptions.map((player) => {
                                          const enrolled = enrolledTournamentPlayers.find(
                                              (ttp) => (!isEdit || Number(ttp.id) !== Number(id)) && Number(ttp.outside_player_id) === Number(player.id)
                                          );
                                          return (
                                              <option
                                                  key={player.id}
                                                  value={player.id}
                                                  disabled={Boolean(enrolled)}
                                              >
                                                  {player.player_name}
                                                  {player.phone ? ` - ${player.phone}` : ""}
                                                  {enrolled ? ` — [Already enrolled in ${enrolled.team_name || "another team"}]` : ""}
                                              </option>
                                          );
                                      })}
                            </select>
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Jersey No. (optional)</label>
                            <input
                                type="text"
                                name="jersey_no"
                                className="form-control"
                                value={formData.jersey_no}
                                onChange={handleChange}
                                placeholder="e.g. 7"
                            />
                            <div className="form-text">Must be unique within the team.</div>
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Player Role</label>
                            <select
                                name="player_role"
                                className="form-select"
                                value={formData.player_role}
                                onChange={handleChange}
                            >
                                {PLAYER_ROLES.map((r) => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-3 mb-3">
                            <label className="form-label">Player Fee (₹)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                name="player_fee"
                                className="form-control"
                                value={formData.player_fee}
                                onChange={handleChange}
                            />
                            {isEdit && (
                                <div className="form-text">Cannot be less than the amount already paid.</div>
                            )}
                        </div>

                        <div className="col-md-3 mb-3">
                            <label className="form-label">Paid Amount (₹)</label>
                            <input
                                type="number"
                                min="0"
                                max={formData.player_fee}
                                step="0.01"
                                name="paid_amount"
                                className="form-control"
                                value={formData.paid_amount}
                                onChange={handleChange}
                            />
                        </div>
                        {Number(formData.paid_amount) > 0 && !isEdit && (
                            <>
                                <div className="col-md-3 mb-3">
                                    <label className="form-label">Payment Mode</label>
                                    <select name="payment_mode" className="form-select" value={formData.payment_mode} onChange={handleChange} required>
                                        {PAYMENT_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                                    </select>
                                </div>
                                <div className="col-md-3 mb-3">
                                    <label className="form-label">Transaction No. (optional)</label>
                                    <input type="text" name="transaction_no" className="form-control" value={formData.transaction_no} onChange={handleChange} />
                                </div>
                            </>
                        )}
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
                            <label className="form-label">Status</label>
                            <select
                                name="status"
                                className="form-select"
                                value={formData.status}
                                onChange={handleChange}
                            >
                                <option value={1}>Active</option>
                                <option value={0}>Inactive</option>
                            </select>
                            {isEdit && (
                                <div className="form-text">Setting a player inactive cancels their fee record.</div>
                            )}
                        </div>
                    </div>

                    <div className="d-flex gap-2">
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? "Saving..." : isEdit ? "Update Player" : "Add Player"}
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
