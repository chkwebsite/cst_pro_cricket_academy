"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import useCurrentUser, { ROLES } from "../teams/useCurrentUser";
import useOrgOptions from "../teams/useOrgOptions";
import useTeamOptions from "../team-players/useTeamOptions";
import useTournamentOptions from "../tournament-teams/useTournamentOptions";
import GroundBookingForm from "../ground-bookings/GroundBookingForm";

const MATCH_TYPES = ["Practice", "Friendly", "League", "Tournament", "Knockout"];
const MATCH_STATUSES = ["Scheduled", "Live", "Completed", "Cancelled", "Postponed"];

const EMPTY_FORM = {
    match_no: "",
    match_type: "Friendly",
    status: "Scheduled",
    match_date: "",
    match_time: "",
    team_a_id: "",
    team_b_id: "",
    academy_id: "",
    branch_id: "",
    tournament_id: "",
    ground_id: "",
    booking_id: "",
    toss_winner: "", // "" | "A" | "B"  (converted to a team id on submit)
    toss_decision: "",
    remarks: "",
};

// optional ID field -> positive integer or null
const optionalId = (value) => (String(value).trim() === "" ? null : Number(value));

export default function MatchForm({ id = null, returnTo = "/next_panel/matches" }) {
    const router = useRouter();
    const isEdit = Boolean(id);
    const me = useCurrentUser();
    const { academies, error: academyError } = useOrgOptions(me);
    const { teams, error: teamError } = useTeamOptions(me);
    const { tournaments, error: tournamentError } = useTournamentOptions(me);
    const isSuper = me.role === ROLES.SUPER;

    const [formData, setFormData] = useState(EMPTY_FORM);
    const [bookings, setBookings] = useState([]);
    const [grounds, setGrounds] = useState([]);
    const [bookingsLoading, setBookingsLoading] = useState(false);
    const [bookingsReload, setBookingsReload] = useState(0);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState("");

    const teamOptions = teams.filter(
        (team) => !formData.academy_id || team.academy_id == null || Number(team.academy_id) === Number(formData.academy_id)
    );
    const teamBOptions = teamOptions.filter((team) => Number(team.id) !== Number(formData.team_a_id));
    const teamAName = teamOptions.find((team) => Number(team.id) === Number(formData.team_a_id))?.team_name;
    const teamBName = teamOptions.find((team) => Number(team.id) === Number(formData.team_b_id))?.team_name;
    const activeBookings = bookings.filter((booking) =>
        ["booked", "confirmed"].includes(String(booking.booking_status).toLowerCase())
    );
    const dateBookings = formData.match_date
        ? activeBookings.filter((booking) => String(booking.booking_date).slice(0, 10) === formData.match_date)
        : [];
    const bookingOptions = dateBookings.filter(
        (booking) => !formData.ground_id || Number(booking.ground_id) === Number(formData.ground_id)
    );
    const groundOptions = grounds;
    const selectedBooking = bookings.find((booking) => Number(booking.id) === Number(formData.booking_id));
    const groundUnavailable = Boolean(
        formData.match_date && formData.ground_id && dateBookings.some(
            (booking) => Number(booking.ground_id) === Number(formData.ground_id) &&
                Number(booking.id) !== Number(formData.booking_id)
        )
    );
    const academyValue = formData.academy_id || (!isSuper && me.academyId ? String(me.academyId) : "");
    const tournamentOptions = tournaments.filter(
        (tournament) => !academyValue || tournament.academy_id == null || Number(tournament.academy_id) === Number(academyValue)
    );

    useEffect(() => {
        if (!me.ready) return;
        if (!formData.match_date) return;

        const controller = new AbortController();
        const loadBookings = async () => {
            try {
                setBookingsLoading(true);
                const params = new URLSearchParams({ limit: "100" });
                const academyId = isSuper ? formData.academy_id : me.academyId;
                const branchId = me.role === ROLES.BRANCH ? me.branchId : formData.branch_id;
                if (academyId) params.set("academy_id", academyId);
                if (branchId) params.set("branch_id", branchId);
                if (formData.match_date) params.set("booking_date", formData.match_date);

                const fetchPage = async (page) => {
                    const pageParams = new URLSearchParams(params);
                    pageParams.set("page", String(page));
                    const res = await fetch(`/api/ground-bookings?${pageParams.toString()}`, {
                        signal: controller.signal,
                    });
                    const result = await res.json();
                    if (!res.ok || !result.success) {
                        throw new Error(result.message || "Unable to load ground bookings");
                    }
                    return result;
                };

                const firstPage = await fetchPage(1);
                const totalPages = Number(firstPage.pagination?.totalPages) || 1;
                const remainingPages = await Promise.all(
                    Array.from({ length: totalPages - 1 }, (_, index) => fetchPage(index + 2))
                );
                const allBookings = [
                    ...(firstPage.data || []),
                    ...remainingPages.flatMap((result) => result.data || []),
                ];
                setBookings([...new Map(allBookings.map((booking) => [Number(booking.id), booking])).values()]);
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            } finally {
                if (!controller.signal.aborted) setBookingsLoading(false);
            }
        };

        loadBookings();
        return () => controller.abort();
    }, [me.ready, me.role, me.academyId, me.branchId, isSuper, formData.academy_id, formData.branch_id, formData.match_date, bookingsReload]);

    useEffect(() => {
        if (!me.ready) return;

        const controller = new AbortController();
        const loadGrounds = async () => {
            try {
                const params = new URLSearchParams({ status: "1" });
                const academyId = isSuper ? formData.academy_id : me.academyId;
                const branchId = me.role === ROLES.BRANCH ? me.branchId : formData.branch_id;
                if (academyId) params.set("academy_id", academyId);
                if (branchId) params.set("branch_id", branchId);

                const res = await fetch(`/api/ground?${params.toString()}`, {
                    signal: controller.signal,
                });
                const result = await res.json();
                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Unable to load grounds");
                }
                setGrounds(result.data || []);
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            }
        };

        loadGrounds();
        return () => controller.abort();
    }, [me.ready, me.role, me.academyId, me.branchId, isSuper, formData.academy_id, formData.branch_id]);

    useEffect(() => {
        if (!formData.booking_id || !selectedBooking) return;

        const controller = new AbortController();
        const loadBookingTime = async () => {
            try {
                const params = new URLSearchParams();
                if (selectedBooking.academy_id) params.set("academy_id", selectedBooking.academy_id);
                if (selectedBooking.branch_id) params.set("branch_id", selectedBooking.branch_id);

                const query = params.toString();
                const res = await fetch(`/api/ground-slots${query ? `?${query}` : ""}`, {
                    signal: controller.signal,
                });
                const result = await res.json();
                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Unable to load the booking's ground slot");
                }

                const slot = (result.data || []).find(
                    (item) => Number(item.id) === Number(selectedBooking.slot_id) &&
                        Number(item.ground_id) === Number(selectedBooking.ground_id)
                );

                if (!slot) throw new Error("Ground slot for this booking was not found");

                setFormData((prev) => prev.booking_id === String(selectedBooking.id) || Number(prev.booking_id) === Number(selectedBooking.id)
                    ? {
                          ...prev,
                          ground_id: String(selectedBooking.ground_id),
                          match_time: String(slot.start_time).slice(0, 5),
                      }
                    : prev
                );
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            }
        };

        loadBookingTime();
        return () => controller.abort();
    }, [formData.booking_id, selectedBooking]);

    // GET SINGLE MATCH (edit mode)
    useEffect(() => {
        if (!id) return;

        const getMatch = async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/matches/${id}`);
                const result = await res.json();

                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Failed to fetch Match");
                }

                const d = result.data;
                let tossWinner = "";
                if (d.toss_winner_team_id) {
                    tossWinner = Number(d.toss_winner_team_id) === Number(d.team_a_id) ? "A" : "B";
                }

                setFormData({
                    match_no: d.match_no || "",
                    match_type: d.match_type || "Friendly",
                    status: d.status || "Scheduled",
                    match_date: d.match_date ? String(d.match_date).slice(0, 10) : "",
                    match_time: d.booking_id && d.match_time ? String(d.match_time).slice(0, 5) : "",
                    team_a_id: d.team_a_id ?? "",
                    team_b_id: d.team_b_id ?? "",
                    academy_id: d.academy_id ?? "",
                    branch_id: d.branch_id ?? "",
                    tournament_id: d.tournament_id ?? "",
                    ground_id: d.ground_id ?? "",
                    booking_id: d.booking_id ?? "",
                    toss_winner: tossWinner,
                    toss_decision: d.toss_decision || "",
                    remarks: d.remarks || "",
                });
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        };
        getMatch();
    }, [id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => {
            const next = { ...prev, [name]: value };
            if (name === "match_type" && value !== "Tournament") {
                next.tournament_id = "";
            }
            if (name === "team_a_id" && value && Number(value) === Number(prev.team_b_id)) {
                next.team_b_id = "";
                if (prev.toss_winner === "B") {
                    next.toss_winner = "";
                    next.toss_decision = "";
                }
            }
            if (name === "ground_id" && value !== prev.ground_id) {
                next.booking_id = "";
                next.match_time = "";
            }
            if (name === "match_date" && value !== prev.match_date) {
                next.ground_id = "";
                next.booking_id = "";
                next.match_time = "";
            }
            if (name === "booking_id") {
                const booking = bookings.find((item) => Number(item.id) === Number(value));
                next.booking_id = value || "";
                if (!value) next.match_time = "";
                if (booking) next.ground_id = String(booking.ground_id);
            }
            if (name === "academy_id") {
                next.branch_id = "";
                next.team_a_id = "";
                next.team_b_id = "";
                next.ground_id = "";
                next.booking_id = "";
                next.toss_winner = "";
                next.toss_decision = "";
            }
            // A toss decision makes no sense without a toss winner
            if (name === "toss_winner" && value === "") next.toss_decision = "";
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Mirrors the API's validation
        const teamA = Number(formData.team_a_id);
        const teamB = Number(formData.team_b_id);
        if (!Number.isInteger(teamA) || teamA <= 0) return setError("Please choose Team A");
        if (!Number.isInteger(teamB) || teamB <= 0) return setError("Please choose Team B");
        if (teamA === teamB) return setError("Team A and Team B must be different");
        if (!formData.match_date) return setError("Match date is required");

        for (const [label, value] of [
            ["Academy ID", formData.academy_id],
            ["Branch ID", formData.branch_id],
            ["Tournament ID", formData.tournament_id],
            ["Ground ID", formData.ground_id],
            ["Booking ID", formData.booking_id],
        ]) {
            const n = optionalId(value);
            if (n !== null && (!Number.isInteger(n) || n <= 0)) return setError(`Invalid ${label}`);
        }

        if (formData.toss_decision && !formData.toss_winner) {
            return setError("Select the toss winner before choosing a toss decision");
        }

        const tossWinnerTeamId =
            formData.toss_winner === "A" ? teamA : formData.toss_winner === "B" ? teamB : null;

        try {
            setLoading(true);
            setError("");

            const res = await fetch(isEdit ? `/api/matches/${id}` : `/api/matches`, {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    match_no: formData.match_no.trim() || null,
                    match_type: formData.match_type,
                    status: formData.status,
                    match_date: formData.match_date,
                    match_time: formData.match_time || null,
                    team_a_id: teamA,
                    team_b_id: teamB,
                    academy_id: optionalId(academyValue),
                    branch_id: optionalId(formData.branch_id),
                    tournament_id: optionalId(formData.tournament_id),
                    ground_id: optionalId(formData.ground_id),
                    booking_id: optionalId(formData.booking_id),
                    toss_winner_team_id: tossWinnerTeamId,
                    toss_decision: formData.toss_decision || null,
                    remarks: formData.remarks.trim() || null,
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || "Something went wrong");
            }

            alert(isEdit ? "Match updated successfully" : "Match created successfully");

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

    const teamsEntered = formData.team_a_id !== "" && formData.team_b_id !== "";

    return (
        <div className="card shadow-sm">
            <div className="card-header">
                <h5 className="mb-0">{isEdit ? "Edit Match" : "Add Match"}</h5>
            </div>

            <div className="card-body">
                {(error || academyError || teamError || tournamentError) && (
                    <div className="alert alert-danger">
                        {error || academyError || teamError || tournamentError}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Match No. (optional)</label>
                            <div className="input-group">
                                <input
                                    type="text"
                                    name="match_no"
                                    className="form-control"
                                    value={formData.match_no}
                                    onChange={handleChange}
                                    placeholder="e.g. M-001"
                                />
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={() => setFormData((prev) => ({ ...prev, match_no: "M-001" }))}
                                    title="Insert M-001"
                                >
                                    M-001
                                </button>
                            </div>
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Match Type</label>
                            <select
                                name="match_type"
                                className="form-select"
                                value={formData.match_type}
                                onChange={handleChange}
                            >
                                {MATCH_TYPES.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Status</label>
                            <select
                                name="status"
                                className="form-select"
                                value={formData.status}
                                onChange={handleChange}
                            >
                                {MATCH_STATUSES.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Team A</label>
                            <select
                                name="team_a_id"
                                className="form-select"
                                value={formData.team_a_id}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Choose Team A</option>
                                {teamOptions.map((team) => (
                                    <option key={team.id} value={team.id}>
                                        {team.team_name}{team.team_code ? ` (${team.team_code})` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-6 mb-3">
                            <label className="form-label">Team B</label>
                            <select
                                name="team_b_id"
                                className="form-select"
                                value={formData.team_b_id}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Choose Team B</option>
                                {teamBOptions.map((team) => (
                                    <option key={team.id} value={team.id}>
                                        {team.team_name}{team.team_code ? ` (${team.team_code})` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Match Date</label>
                            <input
                                type="date"
                                name="match_date"
                                className="form-control"
                                value={formData.match_date}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        {formData.booking_id && (
                            <div className="col-md-6 mb-3">
                                <label className="form-label">Match Time (optional)</label>
                                <input
                                    type="time"
                                    name="match_time"
                                    className="form-control"
                                    value={formData.match_time}
                                    onChange={handleChange}
                                />
                            </div>
                        )}
                    </div>

                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Academy ID (optional)</label>
                            <select
                                name="academy_id"
                                className="form-select"
                                value={academyValue}
                                onChange={handleChange}
                                disabled={!isSuper}
                            >
                                <option value="">Choose Academy</option>
                                {academies.map((academy) => (
                                    <option key={academy.id} value={academy.id}>{academy.academy_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Branch ID (optional)</label>
                            <input
                                type="number"
                                min="1"
                                name="branch_id"
                                className="form-control"
                                value={formData.branch_id}
                                onChange={handleChange}
                            />
                            <div className="form-text">Must belong to the selected academy.</div>
                        </div>

                        {formData.match_type === "Tournament" && (
                            <div className="col-md-4 mb-3">
                                <label className="form-label">Tournament ID (optional)</label>
                                <select
                                    name="tournament_id"
                                    className="form-select"
                                    value={formData.tournament_id}
                                    onChange={handleChange}
                                >
                                    <option value="">Choose Tournament</option>
                                    {tournamentOptions.map((tournament) => (
                                        <option key={tournament.id} value={tournament.id}>
                                            {tournament.tournament_name}{tournament.tournament_code ? ` (${tournament.tournament_code})` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Ground ID (optional)</label>
                            <select
                                name="ground_id"
                                className="form-select"
                                value={formData.ground_id}
                                onChange={handleChange}
                                disabled={!formData.match_date || groundOptions.length === 0}
                            >
                                <option value="">
                                    {!formData.match_date ? "Choose match date first" : groundOptions.length ? "Choose Ground" : "No grounds available"}
                                </option>
                                {groundOptions.map((ground) => (
                                    <option key={ground.id} value={ground.id}>{ground.ground_name}</option>
                                ))}
                            </select>
                            {groundUnavailable && (
                                <div className="text-danger small mt-1" role="alert">
                                    Not available ground for selected date. This ground already has a booking.
                                </div>
                            )}
                        </div>

                        <div className="col-md-6 mb-3">
                            <label className="form-label">Ground Booking ID (optional)</label>
                            <select
                                name="booking_id"
                                className="form-select"
                                value={formData.booking_id}
                                onChange={handleChange}
                                disabled={!formData.match_date || bookingsLoading || bookingOptions.length === 0}
                            >
                                <option value="">
                                    {!formData.match_date
                                        ? "Choose match date first"
                                        : bookingsLoading
                                            ? "Loading bookings..."
                                            : bookingOptions.length
                                                ? "Choose booking"
                                                : "No bookings for this date"}
                                </option>
                                {isEdit && formData.booking_id && !bookingOptions.some((booking) => Number(booking.id) === Number(formData.booking_id)) && (
                                    <option value={formData.booking_id}>Current booking #{formData.booking_id}</option>
                                )}
                                {bookingOptions.map((booking) => (
                                    <option key={booking.id} value={booking.id}>
                                        {booking.booking_no || `Booking #${booking.id}`} - {booking.ground_name} - {String(booking.booking_date).slice(0, 10)}
                                    </option>
                                ))}
                            </select>
                            <div className="form-text">Choose a booking to use its ground, or leave empty.</div>
                            {formData.match_date && formData.ground_id && !formData.booking_id && !bookingsLoading && !groundUnavailable && (
                                <button
                                    type="button"
                                    className="btn btn-outline-primary btn-sm mt-2"
                                    onClick={() => setShowBookingModal(true)}
                                >
                                    Create Ground Booking
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Toss Winner (optional)</label>
                            <select
                                name="toss_winner"
                                className="form-select"
                                value={formData.toss_winner}
                                onChange={handleChange}
                                disabled={!teamsEntered && !formData.toss_winner}
                            >
                                <option value="">Not decided</option>
                                <option value="A">{teamAName ? `Team A (${teamAName})` : "Team A"}</option>
                                <option value="B">{teamBName ? `Team B (${teamBName})` : "Team B"}</option>
                            </select>
                            {!teamsEntered && !formData.toss_winner && (
                                <div className="form-text">Enter both team IDs first.</div>
                            )}
                        </div>

                        <div className="col-md-6 mb-3">
                            <label className="form-label">Toss Decision (optional)</label>
                            <select
                                name="toss_decision"
                                className="form-select"
                                value={formData.toss_decision}
                                onChange={handleChange}
                                disabled={!formData.toss_winner}
                            >
                                <option value="">Not decided</option>
                                <option value="Bat">Bat</option>
                                <option value="Bowl">Bowl</option>
                            </select>
                        </div>
                    </div>

                    <div className="mb-3">
                        <label className="form-label">Remarks (optional)</label>
                        <textarea
                            name="remarks"
                            className="form-control"
                            rows={3}
                            value={formData.remarks}
                            onChange={handleChange}
                            placeholder="Enter remarks"
                        />
                    </div>

                    <div className="d-flex gap-2">
                        <button type="submit" className="btn btn-primary" disabled={loading || groundUnavailable}>
                            {loading ? "Saving..." : isEdit ? "Update Match" : "Add Match"}
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

            {showBookingModal && (
                <>
                    <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="match-booking-title">
                        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl">
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h5 className="modal-title" id="match-booking-title">Create Ground Booking</h5>
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
                                            tournaments={tournamentOptions}
                                            initialValues={{
                                                ground_id: formData.ground_id,
                                                booking_date: formData.match_date,
                                                match_id: id || "",
                                                tournament_id: formData.tournament_id,
                                            }}
                                            onCancel={() => setShowBookingModal(false)}
                                            onCreated={(booking) => {
                                                setFormData((prev) => ({ ...prev, booking_id: String(booking.id) }));
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
