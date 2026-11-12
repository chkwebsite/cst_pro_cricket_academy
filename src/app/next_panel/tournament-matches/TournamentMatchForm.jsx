"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import useCurrentUser, { ROLES } from "../teams/useCurrentUser";
import useTeamOptions from "../team-players/useTeamOptions";
import useTournamentOptions from "../tournament-teams/useTournamentOptions";
import GroundBookingForm from "../ground-bookings/GroundBookingForm";

const ROUND_TYPES = ["League", "Round Robin", "Quarter Final", "Semi Final", "Final", "Qualifier", "Eliminator", "Custom"];
const MATCH_STATUSES = ["Scheduled", "Live", "Completed", "Cancelled", "Postponed"];

const isTodayMatch = (dateVal) => {
    if (!dateVal) return false;
    const d = String(dateVal).slice(0, 10);
    let todayIST = "";
    try {
        todayIST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    } catch {
        todayIST = "";
    }
    const todayLocal = new Date().toLocaleDateString("en-CA");
    return d === todayIST || d === todayLocal;
};

const EMPTY_FORM = {
    tournament_id: "",
    match_id: "",
    match_no: "",
    round_name: "",
    round_type: "League",
    team_a_id: "",
    team_b_id: "",
    scheduled_date: "",
    scheduled_time: "",
    ground_id: "",
    booking_id: "",
    status: "Scheduled",
    winner_team_id: "",
};

const optionalId = (value) => (String(value).trim() === "" ? null : Number(value));

export default function TournamentMatchForm({ id = null, returnTo = "/next_panel/tournament-matches" }) {
    const router = useRouter();
    const isEdit = Boolean(id);
    const me = useCurrentUser();
    const isSuper = me.role === ROLES.SUPER;
    const { tournaments, error: tournamentError } = useTournamentOptions(me);
    const { teams, error: teamError } = useTeamOptions(me);

    const [formData, setFormData] = useState(EMPTY_FORM);
    const [grounds, setGrounds] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [matches, setMatches] = useState([]);
    const [bookingsLoading, setBookingsLoading] = useState(false);
    const [bookingsReload, setBookingsReload] = useState(0);
    const [bookingsDate, setBookingsDate] = useState("");
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState("");

    const selectedTournament = tournaments.find((t) => Number(t.id) === Number(formData.tournament_id));
    const teamOptions = teams.filter(
        (team) =>
            !selectedTournament?.academy_id ||
            team.academy_id == null ||
            Number(team.academy_id) === Number(selectedTournament.academy_id)
    );
    const teamBOptions = teamOptions.filter((team) => Number(team.id) !== Number(formData.team_a_id));
    const teamA = teams.find((t) => Number(t.id) === Number(formData.team_a_id));
    const teamB = teams.find((t) => Number(t.id) === Number(formData.team_b_id));
    const activeBookings = bookings.filter((booking) =>
        ["booked", "confirmed"].includes(String(booking.booking_status).toLowerCase())
    );
    const dateBookings = activeBookings.filter(
        (booking) => String(booking.booking_date).slice(0, 10) === formData.scheduled_date
    );
    const selectedBooking = bookings.find((booking) => Number(booking.id) === Number(formData.booking_id));
    const groundUnavailable = Boolean(
        formData.scheduled_date && formData.ground_id && dateBookings.some(
            (booking) => Number(booking.ground_id) === Number(formData.ground_id) &&
                Number(booking.id) !== Number(formData.booking_id)
        )
    );
    const canCreateBooking = Boolean(
        formData.scheduled_date && formData.ground_id && !bookingsLoading &&
            bookingsDate === formData.scheduled_date && !groundUnavailable && !formData.booking_id
    );

    // Grounds available to the current user's academy or branch.
    useEffect(() => {
        if (!me.ready) return;

        const controller = new AbortController();
        (async () => {
            try {
                const params = new URLSearchParams({ status: "1" });
                if (me.role === ROLES.BRANCH && me.branchId) {
                    params.set("branch_id", String(me.branchId));
                } else if (!isSuper) {
                    params.set("academy_id", String(me.academyId || 0));
                } else if (selectedTournament?.academy_id) {
                    params.set("academy_id", String(selectedTournament.academy_id));
                }

                const res = await fetch(`/api/ground?${params.toString()}`, { signal: controller.signal });
                const result = await res.json();
                if (!res.ok || !result.success) throw new Error(result.message || "Unable to load grounds");
                setGrounds(result.data || []);
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            }
        })();
        return () => controller.abort();
    }, [me.ready, me.role, me.academyId, me.branchId, isSuper, selectedTournament?.academy_id]);

    // Load bookings for the selected date to determine ground availability.
    useEffect(() => {
        if (!me.ready || !formData.scheduled_date) return;

        const controller = new AbortController();
        (async () => {
            try {
                setBookingsLoading(true);
                const params = new URLSearchParams({ booking_date: formData.scheduled_date, limit: "100", page: "1" });
                const academyId = isSuper ? selectedTournament?.academy_id : me.academyId;
                const branchId = me.role === ROLES.BRANCH ? me.branchId : null;
                if (academyId) params.set("academy_id", String(academyId));
                if (branchId) params.set("branch_id", String(branchId));
                const res = await fetch(`/api/ground-bookings?${params.toString()}`, { signal: controller.signal });
                const result = await res.json();
                if (!res.ok || !result.success) throw new Error(result.message || "Unable to load ground bookings");

                const totalPages = Number(result.pagination?.totalPages) || 1;
                const remainingPages = await Promise.all(
                    Array.from({ length: totalPages - 1 }, async (_, index) => {
                        const pageParams = new URLSearchParams(params);
                        pageParams.set("page", String(index + 2));
                        const pageRes = await fetch(`/api/ground-bookings?${pageParams.toString()}`, { signal: controller.signal });
                        const pageResult = await pageRes.json();
                        if (!pageRes.ok || !pageResult.success) {
                            throw new Error(pageResult.message || "Unable to load ground bookings");
                        }
                        return pageResult.data || [];
                    })
                );
                setBookings([...(result.data || []), ...remainingPages.flat()]);
                setBookingsDate(formData.scheduled_date);
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            } finally {
                if (!controller.signal.aborted) setBookingsLoading(false);
            }
        })();
        return () => controller.abort();
    }, [me.ready, me.role, me.academyId, me.branchId, isSuper, selectedTournament?.academy_id, formData.scheduled_date, bookingsReload]);

    // Resolve a selected booking's ground slot to its scheduled start time.
    useEffect(() => {
        if (!formData.booking_id || !selectedBooking) return;

        const controller = new AbortController();
        (async () => {
            try {
                const params = new URLSearchParams();
                if (selectedBooking.academy_id) params.set("academy_id", selectedBooking.academy_id);
                if (selectedBooking.branch_id) params.set("branch_id", selectedBooking.branch_id);
                const query = params.toString();
                const res = await fetch(`/api/ground-slots${query ? `?${query}` : ""}`, { signal: controller.signal });
                const result = await res.json();
                if (!res.ok || !result.success) throw new Error(result.message || "Unable to load the booking's ground slot");

                const slot = (result.data || []).find(
                    (item) => Number(item.id) === Number(selectedBooking.slot_id) &&
                        Number(item.ground_id) === Number(selectedBooking.ground_id)
                );
                if (!slot) throw new Error("Ground slot for this booking was not found");

                setFormData((prev) => Number(prev.booking_id) === Number(selectedBooking.id)
                    ? {
                          ...prev,
                          ground_id: String(selectedBooking.ground_id),
                          scheduled_time: String(slot.start_time).slice(0, 5),
                      }
                    : prev
                );
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            }
        })();
        return () => controller.abort();
    }, [formData.booking_id, selectedBooking]);

    // Existing scheduled matches of the chosen tournament, for the optional "link match" field
    useEffect(() => {
        if (!formData.tournament_id) {
            setMatches([]);
            return;
        }
        const controller = new AbortController();
        (async () => {
            try {
                const res = await fetch(`/api/matches?tournament_id=${formData.tournament_id}`, { signal: controller.signal });
                const result = await res.json();
                if (!res.ok || !result.success) throw new Error(result.message || "Unable to load matches");
                setMatches(result.data || []);
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            }
        })();
        return () => controller.abort();
    }, [formData.tournament_id]);

    // Edit mode
    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/tournament-matches/${id}`);
                const result = await res.json();
                if (!res.ok || !result.success) throw new Error(result.message || "Failed to fetch tournament match");

                const d = result.data;
                setFormData({
                    tournament_id: d.tournament_id ?? "",
                    match_id: d.match_id ?? "",
                    match_no: d.match_no ?? "",
                    round_name: d.round_name || "",
                    round_type: d.round_type || "League",
                    team_a_id: d.team_a_id ?? "",
                    team_b_id: d.team_b_id ?? "",
                    scheduled_date: d.scheduled_date ? String(d.scheduled_date).slice(0, 10) : "",
                    scheduled_time: d.scheduled_time ? String(d.scheduled_time).slice(0, 5) : "",
                    ground_id: d.ground_id ?? "",
                    booking_id: d.booking_id ?? "",
                    status: d.status || "Scheduled",
                    winner_team_id: d.winner_team_id ?? "",
                });
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        })();
    }, [id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => {
            const next = { ...prev, [name]: value };
            if (name === "ground_id" && value !== prev.ground_id) {
                next.booking_id = "";
                next.scheduled_time = "";
            }
            if (name === "scheduled_date" && value !== prev.scheduled_date) {
                next.ground_id = "";
                next.booking_id = "";
                next.scheduled_time = "";
                if (isTodayMatch(value) && (!prev.status || prev.status === "Scheduled")) {
                    next.status = "Live";
                }
            }
            if (name === "booking_id") {
                const booking = bookings.find((item) => Number(item.id) === Number(value));
                next.booking_id = value || "";
                next.scheduled_time = booking?.start_time ? String(booking.start_time).slice(0, 5) : "";
                if (booking) next.ground_id = String(booking.ground_id);
            }
            if (name === "tournament_id") {
                next.match_id = "";
                next.team_a_id = "";
                next.team_b_id = "";
                next.winner_team_id = "";
            }
            if (name === "team_a_id" && value && Number(value) === Number(prev.team_b_id)) next.team_b_id = "";
            // Winner must stay one of the two teams
            if (name === "team_a_id" || name === "team_b_id") {
                const a = name === "team_a_id" ? value : prev.team_a_id;
                const b = name === "team_b_id" ? value : prev.team_b_id;
                if (prev.winner_team_id && ![a, b].some((t) => Number(t) === Number(prev.winner_team_id))) {
                    next.winner_team_id = "";
                }
            }
            // Picking a linked match pre-fills schedule / teams / ground when still empty
            if (name === "match_id" && value) {
                const m = matches.find((x) => Number(x.id) === Number(value));
                if (m) {
                    if (!prev.team_a_id) next.team_a_id = m.team_a_id ?? "";
                    if (!prev.team_b_id) next.team_b_id = m.team_b_id ?? "";
                    if (!prev.scheduled_date && m.match_date) next.scheduled_date = String(m.match_date).slice(0, 10);
                    if (!prev.scheduled_time && m.match_time) next.scheduled_time = String(m.match_time).slice(0, 5);
                    if (!prev.ground_id && m.ground_id) next.ground_id = m.ground_id;
                }
            }
            // Result only makes sense for completed fixtures
            if (name === "status" && value !== "Completed") next.winner_team_id = "";
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const tournamentId = Number(formData.tournament_id);
        const matchNo = Number(formData.match_no);
        const a = optionalId(formData.team_a_id);
        const b = optionalId(formData.team_b_id);
        const winner = optionalId(formData.winner_team_id);

        if (!Number.isInteger(tournamentId) || tournamentId <= 0) return setError("Please choose a tournament");
        if (!Number.isInteger(matchNo) || matchNo <= 0) return setError("Match number must be a positive integer");
        if (a !== null && a === b) return setError("Team A and Team B must be different");
        if (winner !== null && winner !== a && winner !== b) return setError("Winner must be Team A or Team B");

        let submitStatus = formData.status;
        if (isTodayMatch(formData.scheduled_date) && submitStatus === "Scheduled") {
            submitStatus = "Live";
        }

        try {
            setLoading(true);
            setError("");

            const res = await fetch(isEdit ? `/api/tournament-matches/${id}` : "/api/tournament-matches", {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tournament_id: tournamentId,
                    match_id: optionalId(formData.match_id),
                    match_no: matchNo,
                    round_name: formData.round_name.trim() || null,
                    round_type: formData.round_type,
                    team_a_id: a,
                    team_b_id: b,
                    scheduled_date: formData.scheduled_date || null,
                    scheduled_time: formData.scheduled_time || null,
                    ground_id: optionalId(formData.ground_id),
                    booking_id: optionalId(formData.booking_id),
                    status: submitStatus,
                    winner_team_id: winner,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Something went wrong");

            alert(isEdit ? "Tournament match updated successfully" : "Tournament match created successfully");
            router.push(returnTo);
            router.refresh();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) return <div className="text-center py-5">Loading...</div>;

    const teamLabel = (t) => `${t.team_name}${t.team_code ? ` (${t.team_code})` : ""}`;

    return (
        <div className="card shadow-sm">
            <div className="card-header">
                <h5 className="mb-0">{isEdit ? "Edit Tournament Match" : "Add Tournament Match"}</h5>
            </div>

            <div className="card-body">
                {(error || tournamentError || teamError) && (
                    <div className="alert alert-danger">{error || tournamentError || teamError}</div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Tournament</label>
                            <select name="tournament_id" className="form-select" value={formData.tournament_id} onChange={handleChange} required>
                                <option value="">Choose Tournament</option>
                                {tournaments.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.tournament_name}{t.tournament_code ? ` (${t.tournament_code})` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-3 mb-3">
                            <label className="form-label">Match No.</label>
                            <input type="number" min="1" name="match_no" className="form-control" value={formData.match_no} onChange={handleChange} required />
                            <div className="form-text">Unique within the tournament.</div>
                        </div>

                        <div className="col-md-3 mb-3">
                            <label className="form-label">Status</label>
                            <select name="status" className="form-select" value={formData.status} onChange={handleChange}>
                                {MATCH_STATUSES.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Round Type</label>
                            <select name="round_type" className="form-select" value={formData.round_type} onChange={handleChange}>
                                {ROUND_TYPES.map((r) => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Round Name (optional)</label>
                            <input type="text" name="round_name" className="form-control" value={formData.round_name} onChange={handleChange} placeholder="e.g. Group A – Match 3" />
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Team A (optional)</label>
                            <select name="team_a_id" className="form-select" value={formData.team_a_id} onChange={handleChange}>
                                <option value="">TBD</option>
                                {teamOptions.map((t) => (
                                    <option key={t.id} value={t.id}>{teamLabel(t)}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Team B (optional)</label>
                            <select name="team_b_id" className="form-select" value={formData.team_b_id} onChange={handleChange}>
                                <option value="">TBD</option>
                                {teamBOptions.map((t) => (
                                    <option key={t.id} value={t.id}>{teamLabel(t)}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Scheduled Date (optional)</label>
                            <input type="date" name="scheduled_date" className="form-control" value={formData.scheduled_date} onChange={handleChange} />
                        </div>
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Ground (optional)</label>
                            <select
                                name="ground_id"
                                className="form-select"
                                value={formData.ground_id}
                                onChange={handleChange}
                                disabled={!formData.scheduled_date || grounds.length === 0}
                            >
                                <option value="">
                                    {!formData.scheduled_date ? "Choose date first" : grounds.length ? "Choose Ground" : "No grounds available"}
                                </option>
                                {grounds.map((g) => (
                                    <option key={g.id} value={g.id}>
                                        {g.ground_name}{g.ground_code ? ` (${g.ground_code})` : ""}
                                    </option>
                                ))}
                            </select>
                            {groundUnavailable && (
                                <div className="text-danger small mt-1" role="alert">
                                    Not available ground for selected date. This ground already has a booking.
                                </div>
                            )}
                        </div>
                        {!canCreateBooking && (
                            <div className="col-md-4 mb-3">
                                <label className="form-label">Scheduled Time (optional)</label>
                                <input type="time" name="scheduled_time" className="form-control" value={formData.scheduled_time} onChange={handleChange} />
                            </div>
                        )}
                    </div>

                    {canCreateBooking && (
                        <div className="mb-3">
                            <button
                                type="button"
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => setShowBookingModal(true)}
                            >
                                Create Ground Booking
                            </button>
                        </div>
                    )}

                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Linked Match (optional)</label>
                            <select name="match_id" className="form-select" value={formData.match_id} onChange={handleChange} disabled={!formData.tournament_id}>
                                <option value="">None</option>
                                {matches.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.match_no || `Match #${m.id}`} — {m.team_a_name} vs {m.team_b_name}
                                    </option>
                                ))}
                            </select>
                            <div className="form-text">Each match can belong to only one tournament fixture.</div>
                        </div>

                        {formData.status === "Completed" && (
                            <div className="col-md-6 mb-3">
                                <label className="form-label">Winner (optional)</label>
                                <select name="winner_team_id" className="form-select" value={formData.winner_team_id} onChange={handleChange} disabled={!teamA && !teamB}>
                                    <option value="">No result / tie</option>
                                    {teamA && <option value={teamA.id}>{teamA.team_name}</option>}
                                    {teamB && <option value={teamB.id}>{teamB.team_name}</option>}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="d-flex gap-2">
                        <button type="submit" className="btn btn-primary" disabled={loading || groundUnavailable}>
                            {loading ? "Saving..." : isEdit ? "Update Tournament Match" : "Add Tournament Match"}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => router.push(returnTo)}>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>

            {showBookingModal && (
                <>
                    <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="tournament-match-booking-title">
                        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl">
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h5 className="modal-title" id="tournament-match-booking-title">Create Ground Booking</h5>
                                    <button
                                        type="button"
                                        className="btn-close"
                                        aria-label="Close"
                                        onClick={() => setShowBookingModal(false)}
                                    />
                                </div>
                                <div className="modal-body">
                                    <Suspense fallback={<div className="text-center py-4">Loading booking form...</div>}>
                                        <GroundBookingForm
                                            embedded
                                            tournaments={selectedTournament ? [selectedTournament] : tournaments}
                                            initialValues={{
                                                ground_id: formData.ground_id,
                                                booking_date: formData.scheduled_date,
                                                match_id: formData.match_id || "",
                                                tournament_id: formData.tournament_id,
                                            }}
                                            onCancel={() => setShowBookingModal(false)}
                                            onCreated={(booking) => {
                                                setFormData((prev) => ({ ...prev, booking_id: String(booking.id) }));
                                                setBookingsDate("");
                                                setBookingsReload((count) => count + 1);
                                                setShowBookingModal(false);
                                            }}
                                        />
                                    </Suspense>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="modal-backdrop show" onClick={() => setShowBookingModal(false)} />
                </>
            )}
        </div>
    );
}
