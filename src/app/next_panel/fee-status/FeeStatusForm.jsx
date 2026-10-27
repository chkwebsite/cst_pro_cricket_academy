"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "../components/UserContext";

const FEE_TYPES = ["Tournament Team", "Tournament Player", "Match Team", "Match Player", "Ground Booking", "Other"];

// Fields the API requires for each fee type (mirrors validateFeeTypeReferences)
const REQUIRED_REFS = {
    "Tournament Team": ["tournament_id", "tournament_team_id"],
    "Tournament Player": ["tournament_id", "tournament_team_player_id"],
    "Match Team": ["match_id", "match_team_id"],
    "Match Player": ["match_id", "match_player_id"],
    "Ground Booking": ["ground_booking_id"],
    Other: [],
};

const REF_LABELS = {
    tournament_id: "Tournament",
    tournament_team_id: "Tournament Team",
    tournament_team_player_id: "Tournament Team Player",
    match_id: "Match",
    match_team_id: "Match Team",
    match_player_id: "Match Player",
    ground_booking_id: "Ground Booking",
};

const REF_FIELDS = Object.keys(REF_LABELS);

const EMPTY_FORM = {
    academy_id: "",
    branch_id: "",
    fee_type: "Other",
    tournament_id: "",
    tournament_team_id: "",
    tournament_team_player_id: "",
    match_id: "",
    match_team_id: "",
    match_player_id: "",
    ground_booking_id: "",
    payer_type: "user_id", // user_id | outside_player_id | none
    payer_id: "",
    fee_amount: "",
    paid_amount: "0",
    cancelled: false,
    remarks: "",
};

// Same rule as the API: status must follow the amounts unless cancelled
const calcStatus = (fee, paid) => {
    if (Number(paid) === 0) return "Pending";
    if (Number(paid) >= Number(fee)) return "Paid";
    return "Partial";
};

const optionalId = (value) => (String(value).trim() === "" ? null : Number(value));

export default function FeeStatusForm({ id = null }) {
    const router = useRouter();
    const isEdit = Boolean(id);
    const { user } = useUser();

    const userAcademyId = user?.academy_id;
    const hasAssignedAcademy =
        userAcademyId !== null && userAcademyId !== undefined && userAcademyId !== "" && Number(userAcademyId) !== 0;

    const [formData, setFormData] = useState(EMPTY_FORM);
    const [academies, setAcademies] = useState([]);
    const [branches, setBranches] = useState([]);
    const [tournaments, setTournaments] = useState([]);
    const [tournamentTeams, setTournamentTeams] = useState([]);
    const [tournamentPlayers, setTournamentPlayers] = useState([]);
    const [matches, setMatches] = useState([]);
    const [matchTeams, setMatchTeams] = useState([]);
    const [matchPlayers, setMatchPlayers] = useState([]);
    const [groundBookings, setGroundBookings] = useState([]);
    const [users, setUsers] = useState([]);
    const [outsidePlayers, setOutsidePlayers] = useState([]);

    const [loadingTournamentTeams, setLoadingTournamentTeams] = useState(false);
    const [loadingTournamentPlayers, setLoadingTournamentPlayers] = useState(false);
    const [loadingMatchTeams, setLoadingMatchTeams] = useState(false);
    const [loadingMatchPlayers, setLoadingMatchPlayers] = useState(false);
    const [loadingGroundBookings, setLoadingGroundBookings] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [loadingOutsidePlayers, setLoadingOutsidePlayers] = useState(false);

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState("");

    const academyValue = formData.academy_id || (hasAssignedAcademy ? String(userAcademyId) : "");
    const required = REQUIRED_REFS[formData.fee_type] || [];
    const status = formData.cancelled ? "Cancelled" : calcStatus(formData.fee_amount || 0, formData.paid_amount || 0);
    const due = Math.max(Number(formData.fee_amount || 0) - Number(formData.paid_amount || 0), 0);

    // Academies
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/academies");
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.message || "Failed to load academies");
                const list = Array.isArray(json.data) ? json.data : [];
                setAcademies(hasAssignedAcademy ? list.filter((a) => Number(a.id) === Number(userAcademyId)) : list);
            } catch (err) {
                setError(err.message);
            }
        })();
    }, [hasAssignedAcademy, userAcademyId]);

    // Branches
    useEffect(() => {
        if (!academyValue) {
            setBranches([]);
            return;
        }
        (async () => {
            try {
                const res = await fetch(`/api/branch?academy_id=${academyValue}`);
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.message || "Failed to load branches");
                setBranches(json.data || []);
            } catch (err) {
                setBranches([]);
                setError(err.message);
            }
        })();
    }, [academyValue]);

    // Tournament & Match requirements
    const needsTournament = required.includes("tournament_id");
    const needsTournamentTeam = required.includes("tournament_team_id");
    const needsTournamentPlayer = required.includes("tournament_team_player_id");
    const needsMatch = required.includes("match_id");
    const needsMatchTeam = required.includes("match_team_id");
    const needsMatchPlayer = required.includes("match_player_id");
    const needsGroundBooking = required.includes("ground_booking_id");

    // Fetch tournaments
    useEffect(() => {
        if (!needsTournament) return;
        (async () => {
            try {
                const res = await fetch("/api/tournaments");
                const json = await res.json();
                if (res.ok && json.success) setTournaments(Array.isArray(json.data) ? json.data : []);
            } catch {
                /* ignore */
            }
        })();
    }, [needsTournament]);

    // Fetch tournament teams when tournament_id changes
    useEffect(() => {
        if (!needsTournamentTeam || !formData.tournament_id) {
            setTournamentTeams([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                setLoadingTournamentTeams(true);
                const res = await fetch(`/api/tournament-teams?tournament_id=${formData.tournament_id}`);
                const json = await res.json();
                if (!cancelled && res.ok && json.success) {
                    setTournamentTeams(Array.isArray(json.data) ? json.data : []);
                }
            } catch {
                if (!cancelled) setTournamentTeams([]);
            } finally {
                if (!cancelled) setLoadingTournamentTeams(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [needsTournamentTeam, formData.tournament_id]);

    // Fetch tournament team players when tournament_id changes
    useEffect(() => {
        if (!needsTournamentPlayer || !formData.tournament_id) {
            setTournamentPlayers([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                setLoadingTournamentPlayers(true);
                const res = await fetch(`/api/tournament-team-players?tournament_id=${formData.tournament_id}`);
                const json = await res.json();
                if (!cancelled && res.ok && json.success) {
                    setTournamentPlayers(Array.isArray(json.data) ? json.data : []);
                }
            } catch {
                if (!cancelled) setTournamentPlayers([]);
            } finally {
                if (!cancelled) setLoadingTournamentPlayers(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [needsTournamentPlayer, formData.tournament_id]);

    // Fetch matches
    useEffect(() => {
        if (!needsMatch) return;
        (async () => {
            try {
                const res = await fetch("/api/matches");
                const json = await res.json();
                if (res.ok && json.success) setMatches(Array.isArray(json.data) ? json.data : []);
            } catch {
                /* ignore */
            }
        })();
    }, [needsMatch]);

    // Fetch match teams when match_id changes
    useEffect(() => {
        if (!needsMatchTeam || !formData.match_id) {
            setMatchTeams([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                setLoadingMatchTeams(true);
                const res = await fetch(`/api/match-teams?match_id=${formData.match_id}`);
                const json = await res.json();
                if (!cancelled && res.ok && json.success) {
                    setMatchTeams(Array.isArray(json.data) ? json.data : []);
                }
            } catch {
                if (!cancelled) setMatchTeams([]);
            } finally {
                if (!cancelled) setLoadingMatchTeams(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [needsMatchTeam, formData.match_id]);

    // Fetch match players when match_id changes
    useEffect(() => {
        if (!needsMatchPlayer || !formData.match_id) {
            setMatchPlayers([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                setLoadingMatchPlayers(true);
                const res = await fetch(`/api/match-players?match_id=${formData.match_id}`);
                const json = await res.json();
                if (!cancelled && res.ok && json.success) {
                    setMatchPlayers(Array.isArray(json.data) ? json.data : []);
                }
            } catch {
                if (!cancelled) setMatchPlayers([]);
            } finally {
                if (!cancelled) setLoadingMatchPlayers(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [needsMatchPlayer, formData.match_id]);

    // Fetch ground bookings when needed
    useEffect(() => {
        if (!needsGroundBooking) return;
        let cancelled = false;
        (async () => {
            try {
                setLoadingGroundBookings(true);
                const params = new URLSearchParams();
                if (academyValue) params.set("academy_id", academyValue);
                const res = await fetch(`/api/ground-bookings?${params.toString()}`);
                const json = await res.json();
                if (!cancelled && res.ok && json.success) {
                    setGroundBookings(Array.isArray(json.data) ? json.data : []);
                }
            } catch {
                if (!cancelled) setGroundBookings([]);
            } finally {
                if (!cancelled) setLoadingGroundBookings(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [needsGroundBooking, academyValue]);

    // Fetch registered players when payer_type === "user_id"
    useEffect(() => {
        if (formData.payer_type !== "user_id") return;
        if (users.length > 0) return;
        let cancelled = false;
        (async () => {
            try {
                setLoadingUsers(true);
                const res = await fetch("/api/users?user_type=Player");
                const json = await res.json();
                if (!cancelled && res.ok && json.success) {
                    setUsers(Array.isArray(json.data) ? json.data : []);
                }
            } catch {
                if (!cancelled) setUsers([]);
            } finally {
                if (!cancelled) setLoadingUsers(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [formData.payer_type, users.length]);

    // Fetch outside players when payer_type === "outside_player_id"
    useEffect(() => {
        if (formData.payer_type !== "outside_player_id") return;
        if (outsidePlayers.length > 0) return;
        let cancelled = false;
        (async () => {
            try {
                setLoadingOutsidePlayers(true);
                const res = await fetch("/api/outside-players");
                const json = await res.json();
                if (!cancelled && res.ok && json.success) {
                    setOutsidePlayers(Array.isArray(json.data) ? json.data : []);
                }
            } catch {
                if (!cancelled) setOutsidePlayers([]);
            } finally {
                if (!cancelled) setLoadingOutsidePlayers(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [formData.payer_type, outsidePlayers.length]);

    // Edit mode: fetch existing fee record
    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/fee-status/${id}`);
                const result = await res.json();
                if (!res.ok || !result.success) throw new Error(result.message || "Failed to fetch fee record");

                const d = result.data;
                setFormData({
                    academy_id: d.academy_id ?? "",
                    branch_id: d.branch_id ?? "",
                    fee_type: d.fee_type || "Other",
                    tournament_id: d.tournament_id ?? "",
                    tournament_team_id: d.tournament_team_id ?? "",
                    tournament_team_player_id: d.tournament_team_player_id ?? "",
                    match_id: d.match_id ?? "",
                    match_team_id: d.match_team_id ?? "",
                    match_player_id: d.match_player_id ?? "",
                    ground_booking_id: d.ground_booking_id ?? "",
                    payer_type: d.user_id ? "user_id" : d.outside_player_id ? "outside_player_id" : "none",
                    payer_id: d.user_id ?? d.outside_player_id ?? "",
                    fee_amount: d.fee_amount ?? "",
                    paid_amount: d.paid_amount ?? "0",
                    cancelled: d.status === "Cancelled",
                    remarks: d.remarks || "",
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
        setFormData((prev) => {
            const next = { ...prev, [name]: type === "checkbox" ? checked : value };

            if (name === "academy_id") {
                next.branch_id = "";
            }

            // Clear references that the new fee type doesn't use
            if (name === "fee_type") {
                const keep = REQUIRED_REFS[value] || [];
                for (const f of REF_FIELDS) {
                    if (!keep.includes(f)) next[f] = "";
                }
            }

            // Clear dependent fields when tournament changes
            if (name === "tournament_id") {
                next.tournament_team_id = "";
                next.tournament_team_player_id = "";
            }

            // Clear dependent fields when match changes
            if (name === "match_id") {
                next.match_team_id = "";
                next.match_player_id = "";
            }

            // Auto-fill fee amount when tournament team is selected
            if (name === "tournament_team_id" && value) {
                const selectedTeam = tournamentTeams.find((t) => String(t.id) === String(value));
                if (selectedTeam && (!prev.fee_amount || prev.fee_amount === "0") && selectedTeam.team_fee) {
                    next.fee_amount = String(selectedTeam.team_fee);
                }
            }

            // Auto-fill payer and fee amount when tournament player is selected
            if (name === "tournament_team_player_id" && value) {
                const selectedPlayer = tournamentPlayers.find((p) => String(p.id) === String(value));
                if (selectedPlayer) {
                    if (selectedPlayer.user_id) {
                        next.payer_type = "user_id";
                        next.payer_id = String(selectedPlayer.user_id);
                    } else if (selectedPlayer.outside_player_id) {
                        next.payer_type = "outside_player_id";
                        next.payer_id = String(selectedPlayer.outside_player_id);
                    }
                    if (selectedPlayer.tournament_team_id && !next.tournament_team_id) {
                        next.tournament_team_id = String(selectedPlayer.tournament_team_id);
                    }
                    if ((!prev.fee_amount || prev.fee_amount === "0") && selectedPlayer.player_fee) {
                        next.fee_amount = String(selectedPlayer.player_fee);
                    }
                }
            }

            // Auto-fill fee amount when match team is selected
            if (name === "match_team_id" && value) {
                const selectedMt = matchTeams.find((mt) => String(mt.id) === String(value));
                if (selectedMt && (!prev.fee_amount || prev.fee_amount === "0") && selectedMt.match_fee && Number(selectedMt.match_fee) > 0) {
                    next.fee_amount = String(selectedMt.match_fee);
                }
            }

            // Auto-fill payer and fee amount when match player is selected
            if (name === "match_player_id" && value) {
                const selectedMp = matchPlayers.find((mp) => String(mp.id) === String(value));
                if (selectedMp) {
                    if (selectedMp.user_id) {
                        next.payer_type = "user_id";
                        next.payer_id = String(selectedMp.user_id);
                    } else if (selectedMp.outside_player_id) {
                        next.payer_type = "outside_player_id";
                        next.payer_id = String(selectedMp.outside_player_id);
                    }
                    if ((!prev.fee_amount || prev.fee_amount === "0") && selectedMp.player_fee && Number(selectedMp.player_fee) > 0) {
                        next.fee_amount = String(selectedMp.player_fee);
                    }
                }
            }

            if (name === "payer_type") {
                next.payer_id = "";
            }

            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!academyValue) return setError("Please select an academy");

        const feeAmount = Number(formData.fee_amount);
        const paidAmount = Number(formData.paid_amount || 0);
        if (!Number.isFinite(feeAmount) || feeAmount < 0) return setError("Fee amount must be a non-negative number");
        if (!Number.isFinite(paidAmount) || paidAmount < 0) return setError("Paid amount must be a non-negative number");
        if (paidAmount > feeAmount) return setError("Paid amount cannot exceed fee amount");

        for (const field of required) {
            const n = optionalId(formData[field]);
            if (n === null || !Number.isInteger(n) || n <= 0) return setError(`${REF_LABELS[field]} is required for ${formData.fee_type} fees`);
        }

        let payerId = null;
        if (formData.payer_type !== "none" && String(formData.payer_id).trim() !== "") {
            payerId = Number(formData.payer_id);
            if (!Number.isInteger(payerId) || payerId <= 0) return setError("Payer ID must be a positive integer");
        }

        // Always send every reference (null when unused) so PUT clears stale ones
        const refs = Object.fromEntries(
            REF_FIELDS.map((f) => [f, required.includes(f) || formData[f] !== "" ? optionalId(formData[f]) : null])
        );

        try {
            setLoading(true);
            setError("");

            const res = await fetch(isEdit ? `/api/fee-status/${id}` : "/api/fee-status", {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    academy_id: Number(academyValue),
                    branch_id: optionalId(formData.branch_id),
                    fee_type: formData.fee_type,
                    ...refs,
                    user_id: formData.payer_type === "user_id" ? payerId : null,
                    outside_player_id: formData.payer_type === "outside_player_id" ? payerId : null,
                    fee_amount: feeAmount,
                    paid_amount: paidAmount,
                    // PUT falls back to the old status when omitted, so always send it
                    status,
                    remarks: formData.remarks.trim() || null,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Something went wrong");

            alert(isEdit ? "Fee record updated successfully" : "Fee record created successfully");
            router.push("/next_panel/fee-status");
            router.refresh();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) return <div className="text-center py-5">Loading...</div>;

    const idInput = (name) => (
        <div className="col-md-4 mb-3" key={name}>
            <label className="form-label">{REF_LABELS[name]}</label>
            <input type="number" min="1" name={name} className="form-control" value={formData[name]} onChange={handleChange} required />
        </div>
    );

    return (
        <div className="card shadow-sm">
            <div className="card-header">
                <h5 className="mb-0">{isEdit ? "Edit Fee" : "Add Fee"}</h5>
            </div>

            <div className="card-body">
                {error && <div className="alert alert-danger">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Academy</label>
                            <select name="academy_id" className="form-select" value={academyValue} onChange={handleChange} disabled={hasAssignedAcademy} required>
                                <option value="">Select Academy</option>
                                {academies.map((a) => (
                                    <option key={a.id} value={a.id}>{a.academy_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Branch (optional)</label>
                            <select name="branch_id" className="form-select" value={formData.branch_id} onChange={handleChange} disabled={!academyValue}>
                                <option value="">{academyValue ? "Select Branch" : "Select an academy first"}</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>{b.branch_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Fee Type</label>
                            <select name="fee_type" className="form-select" value={formData.fee_type} onChange={handleChange}>
                                {FEE_TYPES.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {required.length > 0 && (
                        <div className="row">
                            {required.map((field) => {
                                if (field === "tournament_id") {
                                    return (
                                        <div className="col-md-4 mb-3" key={field}>
                                            <label className="form-label">Tournament</label>
                                            <select name="tournament_id" className="form-select" value={formData.tournament_id} onChange={handleChange} required>
                                                <option value="">Choose Tournament</option>
                                                {tournaments
                                                    .filter((t) => !academyValue || t.academy_id == null || Number(t.academy_id) === Number(academyValue))
                                                    .map((t) => (
                                                        <option key={t.id} value={t.id}>{t.tournament_name}</option>
                                                    ))}
                                            </select>
                                        </div>
                                    );
                                }

                                if (field === "tournament_team_id") {
                                    return (
                                        <div className="col-md-4 mb-3" key={field}>
                                            <label className="form-label">Tournament Team</label>
                                            <select
                                                name="tournament_team_id"
                                                className="form-select"
                                                value={formData.tournament_team_id}
                                                onChange={handleChange}
                                                disabled={!formData.tournament_id}
                                                required
                                            >
                                                <option value="">
                                                    {!formData.tournament_id
                                                        ? "Select a tournament first"
                                                        : loadingTournamentTeams
                                                        ? "Loading teams..."
                                                        : "Choose Tournament Team"}
                                                </option>
                                                {tournamentTeams.map((t) => (
                                                    <option key={t.id} value={t.id}>
                                                        {t.team_name} {t.registration_no ? `(${t.registration_no})` : `(#${t.id})`}
                                                    </option>
                                                ))}
                                                {formData.tournament_team_id &&
                                                    !tournamentTeams.some((t) => String(t.id) === String(formData.tournament_team_id)) && (
                                                        <option value={formData.tournament_team_id}>
                                                            Selected Team #{formData.tournament_team_id}
                                                        </option>
                                                    )}
                                            </select>
                                            <div className="form-text">
                                                {!formData.tournament_id
                                                    ? "Choose a tournament first to see registered teams"
                                                    : `${tournamentTeams.length} registered team${tournamentTeams.length === 1 ? "" : "s"}`}
                                            </div>
                                        </div>
                                    );
                                }

                                if (field === "tournament_team_player_id") {
                                    return (
                                        <div className="col-md-4 mb-3" key={field}>
                                            <label className="form-label">Tournament Team Player</label>
                                            <select
                                                name="tournament_team_player_id"
                                                className="form-select"
                                                value={formData.tournament_team_player_id}
                                                onChange={handleChange}
                                                disabled={!formData.tournament_id}
                                                required
                                            >
                                                <option value="">
                                                    {!formData.tournament_id
                                                        ? "Select a tournament first"
                                                        : loadingTournamentPlayers
                                                        ? "Loading players..."
                                                        : "Choose Tournament Player"}
                                                </option>
                                                {tournamentPlayers.map((p) => {
                                                    const pName =
                                                        [p.first_name, p.last_name].filter(Boolean).join(" ") ||
                                                        p.outside_player_name ||
                                                        `Player #${p.id}`;
                                                    const pTeam = p.team_name ? ` — ${p.team_name}` : "";
                                                    const pRole = p.player_role ? ` (${p.player_role})` : "";
                                                    return (
                                                        <option key={p.id} value={p.id}>
                                                            {pName}{pTeam}{pRole}
                                                        </option>
                                                    );
                                                })}
                                                {formData.tournament_team_player_id &&
                                                    !tournamentPlayers.some((p) => String(p.id) === String(formData.tournament_team_player_id)) && (
                                                        <option value={formData.tournament_team_player_id}>
                                                            Selected Player #{formData.tournament_team_player_id}
                                                        </option>
                                                    )}
                                            </select>
                                            <div className="form-text">
                                                {!formData.tournament_id
                                                    ? "Choose a tournament first to see its players"
                                                    : `${tournamentPlayers.length} tournament player${tournamentPlayers.length === 1 ? "" : "s"}`}
                                            </div>
                                        </div>
                                    );
                                }

                                if (field === "match_id") {
                                    return (
                                        <div className="col-md-4 mb-3" key={field}>
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
                                    );
                                }

                                if (field === "match_team_id") {
                                    return (
                                        <div className="col-md-4 mb-3" key={field}>
                                            <label className="form-label">Match Team</label>
                                            <select
                                                name="match_team_id"
                                                className="form-select"
                                                value={formData.match_team_id}
                                                onChange={handleChange}
                                                disabled={!formData.match_id}
                                                required
                                            >
                                                <option value="">
                                                    {!formData.match_id
                                                        ? "Select a match first"
                                                        : loadingMatchTeams
                                                        ? "Loading teams..."
                                                        : "Choose Match Team"}
                                                </option>
                                                {matchTeams.map((mt) => (
                                                    <option key={mt.id} value={mt.id}>
                                                        {mt.team_name} (Team {mt.team_side})
                                                    </option>
                                                ))}
                                                {formData.match_team_id &&
                                                    !matchTeams.some((mt) => String(mt.id) === String(formData.match_team_id)) && (
                                                        <option value={formData.match_team_id}>
                                                            Selected Match Team #{formData.match_team_id}
                                                        </option>
                                                    )}
                                            </select>
                                            <div className="form-text">
                                                {!formData.match_id ? "Choose a match first to select a participating team" : "Teams playing in this match"}
                                            </div>
                                        </div>
                                    );
                                }

                                if (field === "match_player_id") {
                                    return (
                                        <div className="col-md-4 mb-3" key={field}>
                                            <label className="form-label">Match Player</label>
                                            <select
                                                name="match_player_id"
                                                className="form-select"
                                                value={formData.match_player_id}
                                                onChange={handleChange}
                                                disabled={!formData.match_id}
                                                required
                                            >
                                                <option value="">
                                                    {!formData.match_id
                                                        ? "Select a match first"
                                                        : loadingMatchPlayers
                                                        ? "Loading players..."
                                                        : "Choose Match Player"}
                                                </option>
                                                {matchPlayers.map((mp) => {
                                                    const pName =
                                                        [mp.first_name, mp.last_name].filter(Boolean).join(" ") ||
                                                        mp.outside_player_name ||
                                                        `Player #${mp.id}`;
                                                    const pTeam = mp.team_name ? ` — ${mp.team_name}` : "";
                                                    const pRole = mp.captain
                                                        ? " (Captain)"
                                                        : mp.vice_captain
                                                        ? " (Vice Captain)"
                                                        : mp.wicket_keeper
                                                        ? " (WK)"
                                                        : "";
                                                    const pJersey = mp.jersey_no ? ` [#${mp.jersey_no}]` : "";
                                                    return (
                                                        <option key={mp.id} value={mp.id}>
                                                            {pName}{pTeam}{pRole}{pJersey}
                                                        </option>
                                                    );
                                                })}
                                                {formData.match_player_id &&
                                                    !matchPlayers.some((mp) => String(mp.id) === String(formData.match_player_id)) && (
                                                        <option value={formData.match_player_id}>
                                                            Selected Match Player #{formData.match_player_id}
                                                        </option>
                                                    )}
                                            </select>
                                            <div className="form-text">
                                                {!formData.match_id
                                                    ? "Choose a match first to select a player"
                                                    : `${matchPlayers.length} match player${matchPlayers.length === 1 ? "" : "s"}`}
                                            </div>
                                        </div>
                                    );
                                }

                                if (field === "ground_booking_id") {
                                    return (
                                        <div className="col-md-4 mb-3" key={field}>
                                            <label className="form-label">Ground Booking</label>
                                            <select
                                                name="ground_booking_id"
                                                className="form-select"
                                                value={formData.ground_booking_id}
                                                onChange={handleChange}
                                                required
                                            >
                                                <option value="">{loadingGroundBookings ? "Loading bookings..." : "Choose Ground Booking"}</option>
                                                {groundBookings.map((b) => (
                                                    <option key={b.id} value={b.id}>
                                                        {b.booking_no || `Booking #${b.id}`} — {b.ground_name} ({b.booking_date})
                                                    </option>
                                                ))}
                                                {formData.ground_booking_id &&
                                                    !groundBookings.some((b) => String(b.id) === String(formData.ground_booking_id)) && (
                                                        <option value={formData.ground_booking_id}>
                                                            Booking #{formData.ground_booking_id}
                                                        </option>
                                                    )}
                                            </select>
                                        </div>
                                    );
                                }

                                return idInput(field);
                            })}
                        </div>
                    )}

                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Payer Type</label>
                            <select name="payer_type" className="form-select" value={formData.payer_type} onChange={handleChange}>
                                <option value="user_id">Registered user</option>
                                <option value="outside_player_id">Outside player</option>
                                <option value="none">Not applicable</option>
                            </select>
                        </div>
                        {formData.payer_type === "user_id" && (
                            <div className="col-md-4 mb-3">
                                <label className="form-label">User ID (optional)</label>
                                <select
                                    name="payer_id"
                                    className="form-select"
                                    value={formData.payer_id}
                                    onChange={handleChange}
                                >
                                    <option value="">{loadingUsers ? "Loading players..." : "Choose Player"}</option>
                                    {users
                                        .filter(
                                            (u) =>
                                                (!academyValue || !u.academy_id || Number(u.academy_id) === Number(academyValue)) &&
                                                String(u.user_type || "").toLowerCase() === "player"
                                        )
                                        .map((u) => {
                                            const uName = [u.first_name, u.last_name].filter(Boolean).join(" ") || `Player #${u.id}`;
                                            const detail = u.phone ? `(${u.phone})` : u.email ? `(${u.email})` : `(#${u.id})`;
                                            return (
                                                <option key={u.id} value={u.id}>
                                                    {uName} {detail}
                                                </option>
                                            );
                                        })}
                                    {formData.payer_id && !users.some((u) => String(u.id) === String(formData.payer_id)) && (
                                        <option value={formData.payer_id}>
                                            Selected Player #{formData.payer_id}
                                        </option>
                                    )}
                                </select>
                                <div className="form-text">Only registered players</div>
                            </div>
                        )}
                        {formData.payer_type === "outside_player_id" && (
                            <div className="col-md-4 mb-3">
                                <label className="form-label">Outside Player ID (optional)</label>
                                <select
                                    name="payer_id"
                                    className="form-select"
                                    value={formData.payer_id}
                                    onChange={handleChange}
                                >
                                    <option value="">{loadingOutsidePlayers ? "Loading players..." : "Choose Outside Player"}</option>
                                    {outsidePlayers.map((op) => {
                                        const detail = op.phone ? `(${op.phone})` : op.email ? `(${op.email})` : `(#${op.id})`;
                                        return (
                                            <option key={op.id} value={op.id}>
                                                {op.player_name || `Outside Player #${op.id}`} {detail}
                                            </option>
                                        );
                                    })}
                                    {formData.payer_id && !outsidePlayers.some((op) => String(op.id) === String(formData.payer_id)) && (
                                        <option value={formData.payer_id}>
                                            Selected Outside Player #{formData.payer_id}
                                        </option>
                                    )}
                                </select>
                                <div className="form-text">Select outside player paying the fee</div>
                            </div>
                        )}
                    </div>

                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Fee Amount (₹)</label>
                            <input type="number" min="0" step="0.01" name="fee_amount" className="form-control" value={formData.fee_amount} onChange={handleChange} required />
                        </div>
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Paid Amount (₹)</label>
                            <input type="number" min="0" step="0.01" name="paid_amount" className="form-control" value={formData.paid_amount} onChange={handleChange} />
                            <div className="form-text">Due: ₹{due.toFixed(2)}</div>
                        </div>
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Status</label>
                            <input type="text" className="form-control" value={status} readOnly />
                            <div className="form-check mt-2">
                                <input className="form-check-input" type="checkbox" id="fee-cancelled" name="cancelled" checked={formData.cancelled} onChange={handleChange} />
                                <label className="form-check-label" htmlFor="fee-cancelled">Mark as cancelled</label>
                            </div>
                            <div className="form-text">Otherwise set automatically from the amounts.</div>
                        </div>
                    </div>

                    <div className="mb-3">
                        <label className="form-label">Remarks (optional)</label>
                        <textarea name="remarks" rows="3" className="form-control" value={formData.remarks} onChange={handleChange} placeholder="Enter remarks" />
                    </div>

                    <div className="d-flex gap-2">
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? "Saving..." : isEdit ? "Update Fee" : "Add Fee"}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => router.push("/next_panel/fee-status")}>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
