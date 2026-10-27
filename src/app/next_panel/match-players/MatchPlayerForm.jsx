"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import OutsidePlayerForm from "../outside-players/OutsidePlayerForm";
import useCurrentUser from "../teams/useCurrentUser";

const PLAYER_SOURCES = [
    { value: "user_id", label: "Registered user" },
    { value: "outside_player_id", label: "Outside player" },
];
const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque"];

const EMPTY_FORM = {
    match_id: "",
    team_id: "",
    player_source: "user_id",
    player_ref: "",
    jersey_no: "",
    player_fee: 0,
    paid_amount: 0,
    payment_status: "Not Generated",
    payment_mode: "Cash",
    transaction_no: "",
    selection: "playing_11", // playing_11 | substitute
    captain: false,
    vice_captain: false,
    wicket_keeper: false,
    status: "1",
};

export default function MatchPlayerForm({ id = null, returnTo = "/next_panel/match-players" }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isEdit = Boolean(id);
    const me = useCurrentUser();

    const [formData, setFormData] = useState({
        ...EMPTY_FORM,
        match_id: searchParams.get("match_id") || "",
    });
    const [matches, setMatches] = useState([]);
    const [registeredPlayers, setRegisteredPlayers] = useState([]);
    const [registeredPlayersTeamId, setRegisteredPlayersTeamId] = useState("");
    const [registeredPlayersLoading, setRegisteredPlayersLoading] = useState(false);
    const [outsidePlayers, setOutsidePlayers] = useState([]);
    const [outsidePlayersLoading, setOutsidePlayersLoading] = useState(false);
    const [showOutsidePlayerModal, setShowOutsidePlayerModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState("");

    const selectedMatch = matches.find((m) => Number(m.id) === Number(formData.match_id));
    const source = PLAYER_SOURCES.find((s) => s.value === formData.player_source) || {
        label: "Tournament team player (existing record)",
    };
    const isPlaying = formData.selection === "playing_11";
    const registeredPlayerOptions = registeredPlayersTeamId === String(formData.team_id)
        ? registeredPlayers.filter((player) => player.user_id)
        : [];

    useEffect(() => {
        const controller = new AbortController();
        (async () => {
            try {
                const res = await fetch("/api/matches", { signal: controller.signal });
                const result = await res.json();
                if (!res.ok || !result.success) throw new Error(result.message || "Unable to load matches");
                setMatches(result.data || []);
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            }
        })();
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!formData.team_id || formData.player_source !== "user_id") return;

        const controller = new AbortController();
        const loadTeamPlayers = async () => {
            try {
                setRegisteredPlayersLoading(true);
                const params = new URLSearchParams({ team_id: formData.team_id });
                const res = await fetch(`/api/team-players?${params.toString()}`, { signal: controller.signal });
                const result = await res.json();
                if (!res.ok || !result.success) throw new Error(result.message || "Unable to load this team's registered players");
                setRegisteredPlayers(result.data || []);
                setRegisteredPlayersTeamId(String(formData.team_id));
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            } finally {
                if (!controller.signal.aborted) setRegisteredPlayersLoading(false);
            }
        };

        loadTeamPlayers();
        return () => controller.abort();
    }, [formData.team_id, formData.player_source]);

    useEffect(() => {
        if (formData.player_source !== "outside_player_id") return;

        const controller = new AbortController();
        const loadOutsidePlayers = async () => {
            try {
                setOutsidePlayersLoading(true);
                const res = await fetch("/api/outside-players", { signal: controller.signal });
                const result = await res.json();
                if (!res.ok || !result.success) throw new Error(result.message || "Unable to load outside players");
                setOutsidePlayers(result.data || []);
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            } finally {
                if (!controller.signal.aborted) setOutsidePlayersLoading(false);
            }
        };

        loadOutsidePlayers();
        return () => controller.abort();
    }, [formData.player_source]);

    // Edit mode
    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/match-players/${id}`);
                const result = await res.json();
                if (!res.ok || !result.success) throw new Error(result.message || "Failed to fetch match player");

                const d = result.data;
                const playerSource = d.user_id
                    ? "user_id"
                    : d.outside_player_id
                    ? "outside_player_id"
                    : "tournament_team_player_id";

                setFormData({
                    match_id: d.match_id ?? "",
                    team_id: d.team_id ?? "",
                    player_source: playerSource,
                    player_ref: d[playerSource] ?? "",
                    jersey_no: d.jersey_no || "",
                    player_fee: d.player_fee ?? 0,
                    paid_amount: d.paid_amount ?? 0,
                    payment_status: d.payment_status || "Not Generated",
                    selection: d.substitute ? "substitute" : "playing_11",
                    captain: Boolean(d.captain),
                    vice_captain: Boolean(d.vice_captain),
                    wicket_keeper: Boolean(d.wicket_keeper),
                    status: String(d.status ?? 1),
                });
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        })();
    }, [id]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const registeredPlayer = name === "player_ref" && formData.player_source === "user_id"
            ? registeredPlayerOptions.find((player) => Number(player.user_id) === Number(value))
            : null;
        setFormData((prev) => {
            const next = { ...prev, [name]: type === "checkbox" ? checked : value };
            if (name === "match_id") {
                next.team_id = "";
                next.player_ref = "";
                next.jersey_no = "";
            }
            if (name === "team_id") {
                next.player_ref = "";
                next.jersey_no = "";
            }
            if (name === "player_source") {
                next.player_ref = "";
                next.jersey_no = "";
            }
            if (name === "player_ref" && formData.player_source === "user_id") {
                next.jersey_no = registeredPlayer?.jersey_no || "";
            }
            // Captain / vice-captain / keeper are only valid for the playing eleven
            if (name === "selection" && value !== "playing_11") {
                next.captain = false;
                next.vice_captain = false;
                next.wicket_keeper = false;
            }
            // A player cannot be both captain and vice-captain
            if (name === "captain" && checked) next.vice_captain = false;
            if (name === "vice_captain" && checked) next.captain = false;
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const matchId = Number(formData.match_id);
        const teamId = Number(formData.team_id);
        const ref = Number(formData.player_ref);

        if (!Number.isInteger(matchId) || matchId <= 0) return setError("Please choose a match");
        if (!Number.isInteger(teamId) || teamId <= 0) return setError("Please choose a team");
        if (!Number.isInteger(ref) || ref <= 0) return setError(`Enter a valid ${source.label} ID`);

        const playerFee = Number(formData.player_fee);
        if (!Number.isFinite(playerFee) || playerFee < 0) return setError("Player fee must be zero or greater");
        const paidAmount = isEdit ? 0 : Number(formData.paid_amount);
        if (!isEdit) {
            if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > playerFee) {
                return setError("Paid amount must be between zero and player fee");
            }
            if (paidAmount > 0 && !formData.payment_mode) {
                return setError("Payment mode is required when an initial amount is paid");
            }
        }

        try {
            setLoading(true);
            setError("");

            const res = await fetch(isEdit ? `/api/match-players/${id}` : "/api/match-players", {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    match_id: matchId,
                    team_id: teamId,
                    // exactly one player reference
                    [formData.player_source]: ref,
                    jersey_no: formData.jersey_no.trim() || null,
                    player_fee: playerFee,
                    ...(!isEdit ? {
                        paid_amount: paidAmount,
                        payment_mode: formData.payment_mode,
                        transaction_no: formData.transaction_no.trim() || null,
                        created_by: me.id,
                        academy_id: me.academyId,
                    } : {}),
                    playing_11: isPlaying,
                    substitute: !isPlaying,
                    captain: formData.captain,
                    vice_captain: formData.vice_captain,
                    wicket_keeper: formData.wicket_keeper,
                    status: Number(formData.status),
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Something went wrong");

            alert(isEdit ? "Match player updated successfully" : "Match player added successfully");
            router.push(returnTo);
            router.refresh();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) return <div className="text-center py-5">Loading...</div>;

    return (
        <>
        <div className="card shadow-sm">
            <div className="card-header">
                <h5 className="mb-0">{isEdit ? "Edit Match Player" : "Add Match Player"}</h5>
            </div>

            <div className="card-body">
                {error && <div className="alert alert-danger">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Match</label>
                            <select name="match_id" className="form-select" value={formData.match_id} onChange={handleChange} required>
                                <option value="">Choose Match</option>
                                {matches.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.match_no || `Match #${m.id}`} — {m.team_a_name} vs {m.team_b_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-6 mb-3">
                            <label className="form-label">Team</label>
                            <select name="team_id" className="form-select" value={formData.team_id} onChange={handleChange} required disabled={!selectedMatch}>
                                <option value="">Choose Team</option>
                                {selectedMatch && (
                                    <>
                                        <option value={selectedMatch.team_a_id}>{selectedMatch.team_a_name}</option>
                                        <option value={selectedMatch.team_b_id}>{selectedMatch.team_b_name}</option>
                                    </>
                                )}
                            </select>
                            <div className="form-text">Only the two teams playing this match.</div>
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-4 mb-3">
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
                        </div>
                        {isEdit && (
                            <>
                                <div className="col-md-4 mb-3">
                                    <label className="form-label">Paid Amount (₹)</label>
                                    <input type="text" className="form-control bg-light" value={formData.paid_amount} readOnly />
                                </div>
                                <div className="col-md-4 mb-3">
                                    <label className="form-label">Payment Status</label>
                                    <input type="text" className="form-control bg-light" value={formData.payment_status} readOnly />
                                </div>
                            </>
                        )}
                        {!isEdit && (
                            <div className="col-md-4 mb-3">
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
                        )}
                        {!isEdit && Number(formData.paid_amount) > 0 && (
                            <>
                                <div className="col-md-4 mb-3">
                                    <label className="form-label">Payment Mode</label>
                                    <select name="payment_mode" className="form-select" value={formData.payment_mode} onChange={handleChange} required>
                                        {PAYMENT_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                                    </select>
                                </div>
                                <div className="col-md-4 mb-3">
                                    <label className="form-label">Transaction No. (optional)</label>
                                    <input type="text" name="transaction_no" className="form-control" value={formData.transaction_no} onChange={handleChange} />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Player Type</label>
                            {formData.player_source === "tournament_team_player_id" ? (
                                <input className="form-control" value={source.label} readOnly />
                            ) : (
                                <select name="player_source" className="form-select" value={formData.player_source} onChange={handleChange}>
                                    {PLAYER_SOURCES.map((s) => (
                                        <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <div className="col-md-4 mb-3">
                            <label className="form-label">{source.label}</label>
                            {formData.player_source === "tournament_team_player_id" ? (
                                <input type="number" min="1" name="player_ref" className="form-control" value={formData.player_ref} onChange={handleChange} required />
                            ) : (
                                <select
                                    name="player_ref"
                                    className="form-select"
                                    value={formData.player_ref}
                                    onChange={handleChange}
                                    required
                                    disabled={!formData.team_id || (formData.player_source === "user_id" && registeredPlayersLoading) || (formData.player_source === "outside_player_id" && outsidePlayersLoading)}
                                >
                                    <option value="">
                                        {!formData.team_id
                                            ? "Choose team first"
                                            : formData.player_source === "user_id"
                                                ? registeredPlayersLoading ? "Loading team players..." : "Choose registered user"
                                                : outsidePlayersLoading ? "Loading outside players..." : "Choose outside player"}
                                    </option>
                                    {formData.player_source === "user_id" ? (
                                        <>
                                            {isEdit && formData.player_ref && !registeredPlayerOptions.some((player) => Number(player.user_id) === Number(formData.player_ref)) && (
                                                <option value={formData.player_ref}>User #{formData.player_ref}</option>
                                            )}
                                            {registeredPlayerOptions.map((player) => (
                                                <option key={player.id} value={player.user_id}>
                                                    {player.player_name || `User #${player.user_id}`}{player.player_email ? ` (${player.player_email})` : ""}
                                                </option>
                                            ))}
                                        </>
                                    ) : (
                                        <>
                                            {isEdit && formData.player_ref && !outsidePlayers.some((player) => Number(player.id) === Number(formData.player_ref)) && (
                                                <option value={formData.player_ref}>Outside player #{formData.player_ref}</option>
                                            )}
                                            {outsidePlayers.map((player) => (
                                                <option key={player.id} value={player.id}>
                                                    {player.player_name}{player.phone ? ` (${player.phone})` : ""}
                                                </option>
                                            ))}
                                        </>
                                    )}
                                </select>
                            )}
                            {formData.player_source === "tournament_team_player_id" && (
                                <div className="form-text">Tournament team player ID.</div>
                            )}
                            {formData.player_source === "outside_player_id" && (
                                <button
                                    type="button"
                                    className="btn btn-outline-primary btn-sm mt-2"
                                    onClick={() => setShowOutsidePlayerModal(true)}
                                >
                                    Add Outside Player
                                </button>
                            )}
                        </div>
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Jersey No. (optional)</label>
                            <input type="text" name="jersey_no" className="form-control" value={formData.jersey_no} onChange={handleChange} />
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Selection</label>
                            <select name="selection" className="form-select" value={formData.selection} onChange={handleChange}>
                                <option value="playing_11">Playing 11</option>
                                <option value="substitute">Substitute</option>
                            </select>
                            <div className="form-text">A team can have at most 11 active players in the playing eleven.</div>
                        </div>
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Status</label>
                            <select name="status" className="form-select" value={formData.status} onChange={handleChange}>
                                <option value="1">Active</option>
                                <option value="0">Inactive</option>
                            </select>
                        </div>
                    </div>

                    <div className="mb-3">
                        <label className="form-label d-block">Roles</label>
                        {[
                            ["captain", "Captain"],
                            ["vice_captain", "Vice-captain"],
                            ["wicket_keeper", "Wicket-keeper"],
                        ].map(([name, label]) => (
                            <div className="form-check form-check-inline" key={name}>
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id={`role-${name}`}
                                    name={name}
                                    checked={formData[name]}
                                    onChange={handleChange}
                                    disabled={!isPlaying}
                                />
                                <label className="form-check-label" htmlFor={`role-${name}`}>{label}</label>
                            </div>
                        ))}
                        {!isPlaying && <div className="form-text">Roles are only available for the playing eleven.</div>}
                    </div>

                    <div className="d-flex gap-2">
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? "Saving..." : isEdit ? "Update Match Player" : "Add Match Player"}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => router.push(returnTo)}>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
        {showOutsidePlayerModal && (
            <>
                <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="match-player-outside-title">
                    <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title" id="match-player-outside-title">Add Outside Player</h5>
                                <button type="button" className="btn-close" aria-label="Close" onClick={() => setShowOutsidePlayerModal(false)} />
                            </div>
                            <div className="modal-body">
                                <OutsidePlayerForm
                                    embedded
                                    onCancel={() => setShowOutsidePlayerModal(false)}
                                    onCreated={(player) => {
                                        setOutsidePlayers((current) => [
                                            { ...player, player_name: player.player_name, status: 1 },
                                            ...current.filter((item) => Number(item.id) !== Number(player.id)),
                                        ]);
                                        setFormData((prev) => ({ ...prev, player_ref: String(player.id) }));
                                        setShowOutsidePlayerModal(false);
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="modal-backdrop show" onClick={() => setShowOutsidePlayerModal(false)} />
            </>
        )}
        </>
    );
}
