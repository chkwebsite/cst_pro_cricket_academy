"use client";

import {
    Activity,
    ArrowLeft,
    CheckCircle2,
    Clock,
    Edit,
    ExternalLink,
    Layers,
    Lock,
    MapPin,
    PlusCircle,
    RefreshCw,
    ShieldAlert,
    ShieldCheck,
    Trash2,
    Trophy,
    UserPlus,
    Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "./UserContext";
import {
    DISMISSAL_TYPES,
    INNINGS_STATUS_BADGE,
    INNINGS_STATUSES,
    ballsToOvers,
    calculateEconomy,
    calculateStrikeRate,
    formatDate,
    getPlayerDisplayName,
    isValidCricketOvers,
    oversToBalls,
} from "./cricketHelpers";

const isTodayMatch = (dateStr) => {
    if (!dateStr) return false;
    const d = String(dateStr).slice(0, 10);
    let todayIST = "";
    try {
        todayIST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    } catch {
        todayIST = "";
    }
    const todayLocal = new Date().toLocaleDateString("en-CA");
    return d === todayIST || d === todayLocal;
};

const isPastMatch = (dateStr) => {
    if (!dateStr) return false;
    const d = String(dateStr).slice(0, 10);
    let todayIST = "";
    try {
        todayIST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    } catch {
        todayIST = "";
    }
    const todayLocal = new Date().toLocaleDateString("en-CA");
    const cmpDate = todayIST || todayLocal;
    return Boolean(d && cmpDate && d < cmpDate);
};

const getEffectiveStatus = (m) => {
    const raw = String(m?.status || "").trim();
    const lower = raw.toLowerCase();
    if (lower === "cancelled") {
        return "Cancelled";
    }
    if (lower === "completed") {
        return "Completed";
    }
    if (isTodayMatch(m?.match_date)) {
        return "Live";
    }
    if (isPastMatch(m?.match_date)) {
        return "Completed";
    }
    return raw || "Scheduled";
};

export default function MatchCenterView({ initialMatchId = null }) {
    const { user } = useUser();
    const userRole = String(user?.role || user?.user_type || user?.role_name || "").toLowerCase();
    const isSuperAdmin = Boolean(user?.isSuperAdmin || userRole === "super_admin" || userRole === "super admin");
    const isAcademyAdmin = Boolean(user?.isAcademyAdmin || userRole === "academy_admin" || userRole === "academy admin");
    const canEditCompletedInnings = isSuperAdmin || isAcademyAdmin;

    const [matches, setMatches] = useState([]);
    const [selectedType, setSelectedType] = useState("Match"); // "Match" | "Tournament"
    const [tournaments, setTournaments] = useState([]);
    const [tournamentsLoading, setTournamentsLoading] = useState(false);
    const [selectedTournamentId, setSelectedTournamentId] = useState("");
    const [tournamentMatches, setTournamentMatches] = useState([]);
    const [tournamentMatchesLoading, setTournamentMatchesLoading] = useState(false);
    const [initializingFixtureId, setInitializingFixtureId] = useState(null);

    const [selectedMatchId, setSelectedMatchId] = useState(initialMatchId ? String(initialMatchId) : "");
    const [matchDetails, setMatchDetails] = useState(null);
    const [inningsList, setInningsList] = useState([]);
    const [activeInningsId, setActiveInningsId] = useState("");
    const [battingScores, setBattingScores] = useState([]);
    const [bowlingScores, setBowlingScores] = useState([]);
    const [matchPlayers, setMatchPlayers] = useState([]);

    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncingSquad, setSyncingSquad] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    // Modals
    const [showBatterModal, setShowBatterModal] = useState(false);
    const [editingBatter, setEditingBatter] = useState(null);
    const [showBowlerModal, setShowBowlerModal] = useState(false);
    const [editingBowler, setEditingBowler] = useState(null);

    const fetchMatchesList = async () => {
        try {
            const res = await fetch("/api/matches");
            const json = await res.json();
            if (res.ok && json.success) {
                setMatches(json.data || []);
                return json.data || [];
            }
        } catch {
            /* ignore */
        }
        return [];
    };

    const fetchTournamentsList = async () => {
        try {
            setTournamentsLoading(true);
            const res = await fetch("/api/tournaments");
            const json = await res.json();
            if (res.ok && json.success) {
                setTournaments(json.data || []);
            }
        } catch (err) {
            console.error("Failed to load tournaments", err);
        } finally {
            setTournamentsLoading(false);
        }
    };

    // Initial fetch of matches & tournaments
    useEffect(() => {
        (async () => {
            const mList = await fetchMatchesList();
            await fetchTournamentsList();
            if (!initialMatchId && !selectedMatchId && mList.length > 0) {
                const reg = mList.find((m) => !m.tournament_id) || mList[0];
                if (reg) setSelectedMatchId(String(reg.id));
            }
        })();
    }, []);

    // Filter tournaments whose score is NOT completed (exclude fully completed ones)
    const pendingTournaments = useMemo(() => {
        return tournaments.filter((t) => {
            const isCompletedStatus = String(t.status || "").toLowerCase() === "completed";
            const totalM = Number(t.total_matches) || 0;
            const pendM = Number(t.pending_matches) || 0;
            // Exclude if explicitly marked Completed and 0 pending matches
            if (isCompletedStatus && pendM === 0) return false;
            // Exclude if all tournament matches are completed
            if (totalM > 0 && pendM === 0) return false;
            return true;
        });
    }, [tournaments]);

    const availableTournaments = useMemo(() => {
        const list = [...pendingTournaments];
        if (selectedTournamentId && !list.some((t) => String(t.id) === String(selectedTournamentId))) {
            const currentT = tournaments.find((t) => String(t.id) === String(selectedTournamentId));
            if (currentT) list.unshift(currentT);
        }
        return list;
    }, [pendingTournaments, tournaments, selectedTournamentId]);

    const regularMatches = useMemo(() => {
        const reg = matches.filter((m) => !m.tournament_id);
        return reg.length > 0 ? reg : matches;
    }, [matches]);

    // Auto-detect whether current loaded match is a Tournament match or regular Match
    useEffect(() => {
        if (!matchDetails) return;
        if (matchDetails.tournament_id) {
            setSelectedType("Tournament");
            setSelectedTournamentId(String(matchDetails.tournament_id));
        }
    }, [matchDetails?.id, matchDetails?.tournament_id]);

    // Load tournament matches whenever selectedTournamentId changes in Tournament mode
    useEffect(() => {
        if (selectedType !== "Tournament" || !selectedTournamentId) {
            setTournamentMatches([]);
            return;
        }
        (async () => {
            try {
                setTournamentMatchesLoading(true);
                const res = await fetch(`/api/tournament-matches?tournament_id=${selectedTournamentId}`);
                const json = await res.json();
                if (res.ok && json.success) {
                    setTournamentMatches(json.data || []);
                }
            } catch (err) {
                console.error("Failed to load tournament matches", err);
            } finally {
                setTournamentMatchesLoading(false);
            }
        })();
    }, [selectedType, selectedTournamentId]);

    const handleSelectTournamentMatch = async (e) => {
        const val = e.target.value;
        if (!val) {
            setSelectedMatchId("");
            return;
        }

        const fixtureId = val.startsWith("tm_") ? Number(val.replace("tm_", "")) : null;
        const fixture = tournamentMatches.find((tm) => Number(tm.id) === fixtureId);

        if (!fixture) {
            setSelectedMatchId(val);
            return;
        }

        // If fixture already has match_id in cst_matches, just load it
        if (fixture.match_id) {
            setSelectedMatchId(String(fixture.match_id));
            return;
        }

        // Auto-initialize fixture into cst_matches with squad players & innings
        setInitializingFixtureId(fixture.id);
        setError("");
        setNotice(`Initializing fixture Match ${fixture.match_no} squad and scorecard...`);
        try {
            const res = await fetch(`/api/tournament-matches/${fixture.id}/scorecard`, {
                method: "POST",
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || "Failed to initialize tournament scorecard");
            }

            // Update fixture's match_id locally in tournamentMatches
            setTournamentMatches((prev) =>
                prev.map((item) => (item.id === fixture.id ? { ...item, match_id: data.match_id } : item))
            );

            // Refresh all matches list
            fetchMatchesList();

            setNotice("Tournament match initialized with squad players! Ready to enter scores.");
            setSelectedMatchId(String(data.match_id));
        } catch (err) {
            setError(err.message || "Unable to initialize tournament scorecard");
        } finally {
            setInitializingFixtureId(null);
        }
    };

    const handleFullRefresh = () => {
        fetchMatchesList();
        fetchTournamentsList();
        if (selectedTournamentId && selectedType === "Tournament") {
            (async () => {
                const res = await fetch(`/api/tournament-matches?tournament_id=${selectedTournamentId}`);
                const json = await res.json();
                if (res.ok && json.success) setTournamentMatches(json.data || []);
            })();
        }
        if (selectedMatchId) loadMatchData(selectedMatchId);
    };

    // Load full match data whenever selectedMatchId changes
    const loadMatchData = async (mId) => {
        if (!mId) return;
        setLoading(true);
        setError("");
        try {
            // 1. Fetch match details
            const mRes = await fetch(`/api/matches/${mId}`);
            const mJson = await mRes.json();
            if (mRes.ok && mJson.success) {
                setMatchDetails(mJson.data);
            }

            // 2. Fetch match players
            const pRes = await fetch(`/api/match-players?match_id=${mId}`);
            const pJson = await pRes.json();
            if (pRes.ok && pJson.success) {
                setMatchPlayers(pJson.data || []);
            }

            // 3. Fetch innings
            const iRes = await fetch(`/api/match-innings?match_id=${mId}`);
            const iJson = await iRes.json();
            if (iRes.ok && iJson.success) {
                const list = iJson.data || [];
                setInningsList(list);
                if (list.length > 0) {
                    setActiveInningsId((prev) => {
                        const exists = list.some((i) => String(i.id) === String(prev));
                        return exists ? prev : String(list[0].id);
                    });
                } else {
                    setActiveInningsId("");
                }
            }
        } catch (err) {
            setError(err.message || "Failed to load match center data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedMatchId) {
            loadMatchData(selectedMatchId);
        }
    }, [selectedMatchId]);

    // Load scorecards whenever activeInningsId changes
    const loadInningsScorecards = async (iId) => {
        if (!iId || !selectedMatchId) {
            setBattingScores([]);
            setBowlingScores([]);
            return;
        }

        try {
            const [batRes, bowlRes] = await Promise.all([
                fetch(`/api/match-scorecard?match_id=${selectedMatchId}&innings_id=${iId}`),
                fetch(`/api/match-bowling-scorecard?match_id=${selectedMatchId}&innings_id=${iId}`),
            ]);

            const batJson = await batRes.json();
            const bowlJson = await bowlRes.json();

            if (batRes.ok && batJson.success) setBattingScores(batJson.data || []);
            if (bowlRes.ok && bowlJson.success) setBowlingScores(bowlJson.data || []);
        } catch (err) {
            setError("Failed to load innings scorecard");
        }
    };

    useEffect(() => {
        if (activeInningsId) {
            loadInningsScorecards(activeInningsId);
        }
    }, [activeInningsId, selectedMatchId]);

    const activeInnings = inningsList.find((i) => String(i.id) === String(activeInningsId));
    const isInningsCompleted = activeInnings?.innings_status === "Completed";
    const isLockedForCurrentUser = isInningsCompleted && !canEditCompletedInnings;

    // Match Result Calculation when both innings are completed
    const matchResult = useMemo(() => {
        if (!inningsList || inningsList.length < 2) return null;
        const inn1 = inningsList.find((i) => Number(i.innings_no) === 1) || inningsList[0];
        const inn2 = inningsList.find((i) => Number(i.innings_no) === 2) || inningsList[1];
        if (!inn1 || !inn2) return null;

        const isBothCompleted = inn1.innings_status === "Completed" && inn2.innings_status === "Completed";
        const isMatchCompleted = String(matchDetails?.status || "").toLowerCase() === "completed";

        if (!isBothCompleted && !isMatchCompleted) {
            return null;
        }

        const r1 = Number(inn1.total_runs) || 0;
        const w1 = Number(inn1.total_wickets) || 0;
        const r2 = Number(inn2.total_runs) || 0;
        const w2 = Number(inn2.total_wickets) || 0;

        const team1Name = inn1.batting_team_name || matchDetails?.team_a_name || "Team 1";
        const team2Name = inn2.batting_team_name || matchDetails?.team_b_name || "Team 2";

        let winnerTeamName = "";
        let winnerTeamId = null;
        let resultText = "";
        let isTie = false;

        if (r2 > r1) {
            const wRemaining = Math.max(1, 10 - w2);
            winnerTeamName = team2Name;
            winnerTeamId = inn2.batting_team_id;
            resultText = `${team2Name} won by ${wRemaining} ${wRemaining === 1 ? "wicket" : "wickets"}`;
        } else if (r1 > r2) {
            const runDiff = r1 - r2;
            winnerTeamName = team1Name;
            winnerTeamId = inn1.batting_team_id;
            resultText = `${team1Name} won by ${runDiff} ${runDiff === 1 ? "run" : "runs"}`;
        } else {
            isTie = true;
            resultText = "Match Tied";
        }

        return {
            isBothCompleted,
            winnerTeamName,
            winnerTeamId,
            resultText,
            isTie,
            inn1: {
                team: team1Name,
                runs: r1,
                wickets: w1,
                overs: inn1.total_overs,
                balls: inn1.total_balls,
            },
            inn2: {
                team: team2Name,
                runs: r2,
                wickets: w2,
                overs: inn2.total_overs,
                balls: inn2.total_balls,
            },
        };
    }, [inningsList, matchDetails]);

    // Player lookup helper
    const getPlayerName = (pId) => {
        if (!pId) return null;
        const p = matchPlayers.find((m) => Number(m.id) === Number(pId));
        return p ? getPlayerDisplayName(p) : `Player #${pId}`;
    };

    // Filter batting team players & bowling team players
    const battingPlayers = useMemo(() => {
        if (!activeInnings) return matchPlayers;
        return matchPlayers.filter((p) => Number(p.team_id) === Number(activeInnings.batting_team_id));
    }, [matchPlayers, activeInnings]);

    const bowlingPlayers = useMemo(() => {
        if (!activeInnings) return matchPlayers;
        return matchPlayers.filter((p) => Number(p.team_id) === Number(activeInnings.bowling_team_id));
    }, [matchPlayers, activeInnings]);

    // Handle delete batter record
    const handleDeleteBatter = async (item) => {
        if (!confirm(`Remove ${item.player_name || `Batter #${item.match_player_id}`} from scorecard?`)) return;
        try {
            const res = await fetch(`/api/match-scorecard/${item.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message);
            setNotice("Batter record removed.");
            loadInningsScorecards(activeInningsId);
        } catch (err) {
            setError(err.message);
        }
    };

    // Handle delete bowler record
    const handleDeleteBowler = async (item) => {
        if (!confirm(`Remove ${item.player_name || `Bowler #${item.match_player_id}`} from bowling scorecard?`)) return;
        try {
            const res = await fetch(`/api/match-bowling-scorecard/${item.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message);
            setNotice("Bowler record removed.");
            loadInningsScorecards(activeInningsId);
        } catch (err) {
            setError(err.message);
        }
    };

    // Auto-Sync Innings Totals from Scorecard
    const handleSyncTotals = async () => {
        if (!activeInnings) return;
        setSyncing(true);
        setError("");
        setNotice("");

        try {
            // Batting runs + innings extras
            const batRuns = battingScores.reduce((sum, b) => sum + (Number(b.runs) || 0), 0);
            const totalRuns = batRuns + (Number(activeInnings.extras) || 0);

            // Total dismissals where dismissal_type !== 'Not Out' & !== 'Retired Hurt'
            const totalWickets = battingScores.filter(
                (b) => b.dismissal_type !== "Not Out" && b.dismissal_type !== "Retired Hurt"
            ).length;

            // Total balls bowled by all bowlers
            const totalBallsBowled = bowlingScores.reduce((sum, b) => sum + (Number(b.balls_bowled) || 0), 0);
            const totalOvers = ballsToOvers(totalBallsBowled);

            // Check if 10 dismissals or overs limit reached -> auto-mark Completed
            const matchOvers = matchDetails?.overs ? Number(matchDetails.overs) : 20;
            const maxBalls = matchOvers * 6;
            const isAllOut = totalWickets >= 10;
            const isOverLimit = totalBallsBowled >= maxBalls || (parseFloat(totalOvers) >= matchOvers && matchOvers > 0);

            let newInningsStatus = activeInnings.innings_status;
            if (isAllOut || isOverLimit) {
                newInningsStatus = "Completed";
            }

            const payload = {
                total_runs: totalRuns,
                total_wickets: totalWickets,
                total_overs: totalOvers,
                total_balls: totalBallsBowled,
                innings_status: newInningsStatus,
            };

            const res = await fetch(`/api/match-innings/${activeInnings.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message);

            if (newInningsStatus === "Completed" && activeInnings.innings_status !== "Completed") {
                setNotice("Innings totals synced and status automatically updated to 'Completed' (10 dismissals or overs limit reached).");
            } else {
                setNotice("Innings totals successfully synced with scorecard calculations!");
            }
            loadMatchData(selectedMatchId);
        } catch (err) {
            setError(err.message || "Failed to sync innings totals");
        } finally {
            setSyncing(false);
        }
    };

    const handleSyncTournamentSquad = async () => {
        if (!selectedMatchId) return;
        setSyncingSquad(true);
        setError("");
        setNotice("");
        try {
            const res = await fetch(`/api/matches/${selectedMatchId}/sync-tournament-squad`, {
                method: "POST",
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || "Failed to sync squad");
            setNotice(json.message || "Tournament squad synced successfully!");
            // Reload match players
            const pRes = await fetch(`/api/match-players?match_id=${selectedMatchId}`);
            const pJson = await pRes.json();
            if (pRes.ok && pJson.success) {
                setMatchPlayers(pJson.data || []);
            }
        } catch (err) {
            setError(err.message || "Failed to sync squad");
        } finally {
            setSyncingSquad(false);
        }
    };

    // Calculated Run Rate
    const crr = useMemo(() => {
        if (!activeInnings) return "0.00";
        const balls = Number(activeInnings.total_balls) || 0;
        const runs = Number(activeInnings.total_runs) || 0;
        if (balls <= 0) return "0.00";
        return ((runs * 6) / balls).toFixed(2);
    }, [activeInnings]);

    return (
        <div className="container-fluid">
            <div className="row g-3">
                {/* Header & Match Selector */}
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-2">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <div>
                                <Link href="/next_panel/match-management" className="btn btn-sm btn-outline-secondary mb-3">
                                    <ArrowLeft size={16} className="me-2" /> Back to Match Management
                                </Link>
                                <h3 className="mb-1 d-flex align-items-center gap-2">
                                    <Trophy className="text-primary" /> Match Scorecard Center
                                </h3>
                                <p className="text-muted mb-0">
                                    Comprehensive live scorecard management for innings, batting, and bowling.
                                </p>
                            </div>
                            {/* Dropdown Selection Controls */}
                            <div className="d-flex flex-wrap align-items-end gap-2 bg-light p-2 rounded-3 border">
                                {/* 1. Category / Type Dropdown */}
                                <div>
                                    <label className="form-label small text-muted mb-1 fw-semibold d-block">
                                        Type
                                    </label>
                                    <select
                                        className="form-select form-select-sm fw-semibold"
                                        style={{ minWidth: "130px" }}
                                        value={selectedType}
                                        onChange={(e) => {
                                            const newType = e.target.value;
                                            setSelectedType(newType);
                                            if (newType === "Match") {
                                                const firstReg = regularMatches[0];
                                                if (firstReg) setSelectedMatchId(String(firstReg.id));
                                            } else {
                                                if (!selectedTournamentId && availableTournaments.length > 0) {
                                                    setSelectedTournamentId(String(availableTournaments[0].id));
                                                }
                                            }
                                        }}
                                    >
                                        <option value="Match">Match</option>
                                        <option value="Tournament">Tournament</option>
                                    </select>
                                </div>

                                {/* 2. Tournament Dropdown (Visible only when selectedType === 'Tournament') */}
                                {selectedType === "Tournament" && (
                                    <div>
                                        <label className="form-label small text-muted mb-1 fw-semibold d-block">
                                            Tournament (Pending Scores)
                                        </label>
                                        <select
                                            className="form-select form-select-sm"
                                            style={{ minWidth: "220px", maxWidth: "270px" }}
                                            value={selectedTournamentId}
                                            onChange={(e) => {
                                                setSelectedTournamentId(e.target.value);
                                                setSelectedMatchId("");
                                            }}
                                            disabled={tournamentsLoading}
                                        >
                                            <option value="">
                                                {tournamentsLoading ? "Loading tournaments..." : availableTournaments.length === 0 ? "No pending tournaments" : "Choose Tournament..."}
                                            </option>
                                            {availableTournaments.map((t) => {
                                                const pend = Number(t.pending_matches) || 0;
                                                const total = Number(t.total_matches) || 0;
                                                const badge = pend > 0 ? ` (${pend} pending)` : total === 0 ? " (No matches)" : "";
                                                return (
                                                    <option key={t.id} value={t.id}>
                                                        {t.tournament_name}{badge}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                )}

                                {/* 3. Match Dropdown */}
                                <div>
                                    <label className="form-label small text-muted mb-1 fw-semibold d-block">
                                        {selectedType === "Tournament" ? "Tournament Fixture / Match" : "Select Match"}
                                    </label>
                                    {selectedType === "Tournament" ? (
                                        <select
                                            className="form-select form-select-sm"
                                            style={{ minWidth: "300px", maxWidth: "400px" }}
                                            value={(() => {
                                                const matchFixture = tournamentMatches.find(
                                                    (tm) => tm.match_id && String(tm.match_id) === String(selectedMatchId)
                                                );
                                                if (matchFixture) return `tm_${matchFixture.id}`;
                                                return selectedMatchId || "";
                                            })()}
                                            onChange={handleSelectTournamentMatch}
                                            disabled={!selectedTournamentId || tournamentMatchesLoading || initializingFixtureId !== null}
                                        >
                                            <option value="">
                                                {tournamentMatchesLoading
                                                    ? "Loading tournament matches..."
                                                    : !selectedTournamentId
                                                    ? "Choose a tournament first..."
                                                    : tournamentMatches.length === 0
                                                    ? "No matches found in tournament"
                                                    : "Select Tournament Match..."}
                                            </option>
                                            {tournamentMatches.map((tm) => {
                                                const effStatus = tm.status || "Scheduled";
                                                return (
                                                    <option key={tm.id} value={`tm_${tm.id}`}>
                                                        Match {tm.match_no}: {tm.team_a_name || "TBD"} vs {tm.team_b_name || "TBD"} {tm.group_name ? `(${tm.group_name})` : ""} · [{effStatus}]
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    ) : (
                                        <select
                                            className="form-select form-select-sm"
                                            style={{ minWidth: "280px", maxWidth: "360px" }}
                                            value={selectedMatchId}
                                            onChange={(e) => setSelectedMatchId(e.target.value)}
                                        >
                                            <option value="">Select a Match...</option>
                                            {regularMatches.map((m) => {
                                                const eff = getEffectiveStatus(m);
                                                return (
                                                    <option key={m.id} value={m.id}>
                                                        {m.match_no ? `Match ${m.match_no}` : `Match #${m.id}`}: {m.team_a_name} vs {m.team_b_name} {eff === "Live" ? "🔴 (Live)" : `(${eff})`}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    )}
                                </div>

                                {/* Refresh Button */}
                                <div>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={handleFullRefresh}
                                        title="Refresh matches and scorecards"
                                        disabled={loading || initializingFixtureId !== null}
                                    >
                                        <RefreshCw size={15} className={loading || initializingFixtureId !== null ? "spinner-border spinner-border-sm" : ""} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="col-12">
                        <div className="alert alert-danger mb-0">{error}</div>
                    </div>
                )}
                {notice && (
                    <div className="col-12">
                        <div className="alert alert-success mb-0">{notice}</div>
                    </div>
                )}

                {/* Match Details Banner */}
                {matchDetails && (() => {
                    const currentStatus = matchResult ? "Completed" : getEffectiveStatus(matchDetails);
                    const isLive = currentStatus === "Live";
                    const isCompleted = currentStatus === "Completed";

                    return (
                        <div className="col-12">
                            <div className="card border-0 rounded-4 shadow-sm p-4 bg-dark text-white">
                                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                                    <div>
                                        <div className="badge bg-primary px-3 py-1 mb-2">
                                            {matchDetails.match_type} Match · {matchDetails.match_no ? `Match ${matchDetails.match_no}` : `#${matchDetails.id}`}
                                        </div>
                                        <h2 className="fs-3 fw-bold mb-1">
                                            {matchDetails.team_a_name} <span className="text-warning">vs</span> {matchDetails.team_b_name}
                                        </h2>
                                        <div className="text-secondary small d-flex flex-wrap gap-3">
                                            <span>Date: {formatDate(matchDetails.match_date)}</span>
                                            {matchDetails.ground_name && <span>Venue: {matchDetails.ground_name}</span>}
                                            {matchDetails.toss_winner_team_name && (
                                                <span>
                                                    Toss: {matchDetails.toss_winner_team_name} ({matchDetails.toss_decision || "opted to bat"})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-end">
                                        <span className={`badge ${isLive ? "bg-danger d-inline-flex align-items-center gap-1" : isCompleted ? "bg-success" : "bg-secondary"} fs-6 px-3 py-2`}>
                                            {isLive && <span className="spinner-grow spinner-grow-sm" style={{ width: "8px", height: "8px" }} />}
                                            Status: {currentStatus}
                                        </span>
                                        {isCompleted && (!inningsList || inningsList.length === 0) && (
                                            <div className="mt-2">
                                                <span className="badge bg-warning text-dark px-2 py-1">
                                                    Wait to update records
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Winner & Match Result Banner (When both innings are completed) */}
                {matchResult && (
                    <div className="col-12">
                        <div
                            className="card border-0 rounded-4 shadow-sm p-4 text-white overflow-hidden position-relative"
                            style={{
                                background: "linear-gradient(135deg, #071E26 0%, #0A3C4A 55%, #0B4F60 100%)",
                                borderLeft: "6px solid #00F0FF",
                            }}
                        >
                            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                                <div className="d-flex align-items-center gap-3">
                                    <div
                                        className="rounded-circle d-flex align-items-center justify-content-center text-warning flex-shrink-0"
                                        style={{
                                            width: "60px",
                                            height: "60px",
                                            background: "rgba(255, 193, 7, 0.15)",
                                            border: "2px solid rgba(255, 193, 7, 0.4)",
                                        }}
                                    >
                                        <Trophy size={32} />
                                    </div>
                                    <div>
                                        <div className="d-flex align-items-center gap-2 mb-1">
                                            <span className="badge bg-success px-2 py-1 text-uppercase fw-bold" style={{ letterSpacing: "0.5px" }}>
                                                Match Completed
                                            </span>
                                            <span className="badge bg-info-subtle text-info border border-info-subtle px-2 py-1">
                                                Official Result
                                            </span>
                                        </div>
                                        <h3 className="fs-3 fw-bold mb-1 text-warning">
                                            {matchResult.resultText}
                                        </h3>
                                        <p className="mb-0 text-white-50 small">
                                            Both innings concluded · {matchResult.inn1.team}: {matchResult.inn1.runs}/{matchResult.inn1.wickets} ({matchResult.inn1.overs} ov) vs {matchResult.inn2.team}: {matchResult.inn2.runs}/{matchResult.inn2.wickets} ({matchResult.inn2.overs} ov)
                                        </p>
                                    </div>
                                </div>
                                <div className="d-flex align-items-center gap-3 bg-black bg-opacity-25 px-4 py-3 rounded-3 border border-white border-opacity-10">
                                    <div className="text-center">
                                        <div className="small text-white-50 text-truncate" style={{ maxWidth: "120px" }}>{matchResult.inn1.team}</div>
                                        <div className="fs-5 fw-bold">{matchResult.inn1.runs}/{matchResult.inn1.wickets}</div>
                                        <div className="text-secondary small">({matchResult.inn1.overs} ov)</div>
                                    </div>
                                    <div className="text-warning fw-bold fs-6">VS</div>
                                    <div className="text-center">
                                        <div className="small text-white-50 text-truncate" style={{ maxWidth: "120px" }}>{matchResult.inn2.team}</div>
                                        <div className="fs-5 fw-bold">{matchResult.inn2.runs}/{matchResult.inn2.wickets}</div>
                                        <div className="text-secondary small">({matchResult.inn2.overs} ov)</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Innings Tabs */}
                <div className="col-12">
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 border-bottom pb-2">
                        <ul className="nav nav-pills gap-2">
                            {inningsList.map((i) => (
                                <li className="nav-item" key={i.id}>
                                    <button
                                        type="button"
                                        className={`nav-link rounded-pill px-4 ${
                                            String(i.id) === String(activeInningsId)
                                                ? "active bg-primary fw-bold"
                                                : "bg-white text-dark shadow-sm border"
                                        }`}
                                        onClick={() => setActiveInningsId(String(i.id))}
                                    >
                                        Innings {i.innings_no}: {i.batting_team_name}{" "}
                                        <span className="ms-2 opacity-75">
                                            ({i.total_runs}/{i.total_wickets})
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>

                        <div className="d-flex flex-wrap gap-2">
                            {matchDetails?.tournament_id && (
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-info d-inline-flex align-items-center gap-1"
                                    onClick={handleSyncTournamentSquad}
                                    disabled={syncingSquad}
                                    title="Sync registered players from Tournament Team Players roster into this match"
                                >
                                    {syncingSquad ? <RefreshCw className="spinner-border spinner-border-sm" /> : <Users size={14} />}
                                    <span>Sync Tournament Squad</span>
                                </button>
                            )}
                            <Link
                                href={`/next_panel/match-innings/new${selectedMatchId ? `?match_id=${selectedMatchId}` : ""}`}
                                className="btn btn-sm btn-outline-primary"
                            >
                                <PlusCircle size={15} className="me-1" /> Add Innings
                            </Link>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="col-12 text-center py-5 text-muted">
                        <RefreshCw className="spinner-border spinner-border-sm me-2" /> Loading match data...
                    </div>
                ) : !activeInnings ? (
                    <div className="col-12">
                        <div className="bg-white rounded-4 shadow-sm p-5 text-center text-muted">
                            <Layers size={48} className="text-secondary opacity-50 mb-3" />
                            <h5>No Innings Found For This Match</h5>
                            <div className="my-2">
                                <span className="badge bg-warning text-dark border border-warning-subtle py-1 px-3">
                                    Wait to update records
                                </span>
                            </div>
                            <p>To begin scoring, start by creating the first innings for this match.</p>
                            <Link
                                href={`/next_panel/match-innings/new${selectedMatchId ? `?match_id=${selectedMatchId}` : ""}`}
                                className="btn btn-primary"
                            >
                                <PlusCircle size={16} className="me-1" /> Create 1st Innings
                            </Link>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Lock / Completion Notification */}
                        {isInningsCompleted && (
                            <div className="col-12">
                                {isLockedForCurrentUser ? (
                                    <div className="alert alert-warning border border-warning-subtle d-flex align-items-center gap-3 py-3 rounded-3 mb-0">
                                        <Lock size={22} className="text-warning flex-shrink-0" />
                                        <div>
                                            <strong>Innings Completed &amp; Scores Locked:</strong> 10 players have been dismissed or overs limit has been reached. Player scores are frozen and cannot be modified. Permission to edit or unlock is restricted to <strong>Super Admin</strong> and <strong>Academy Admin</strong>.
                                        </div>
                                    </div>
                                ) : (
                                    <div className="alert alert-primary bg-primary-subtle text-primary border border-primary-subtle d-flex align-items-center justify-content-between gap-3 py-2 px-3 rounded-3 mb-0">
                                        <div className="d-flex align-items-center gap-2 small">
                                            <ShieldAlert size={16} />
                                            <span><strong>Innings Completed (Locked for normal users):</strong> You are signed in with Administrative privileges (Super Admin / Academy Admin). Score editing mode is active.</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Innings Overview Banner */}
                        <div className="col-12">
                            <div className="bg-white rounded-4 shadow-sm p-4 border">
                                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                                    <div>
                                        <div className="d-flex align-items-baseline gap-3">
                                            <span className="fs-2 fw-bold text-dark">
                                                {activeInnings.total_runs}/{activeInnings.total_wickets}
                                            </span>
                                            <span className="fs-5 text-muted">
                                                ({activeInnings.total_overs} ov, {activeInnings.total_balls} balls)
                                            </span>
                                            <span
                                                className={`badge ${
                                                    INNINGS_STATUS_BADGE[activeInnings.innings_status] || "bg-secondary"
                                                }`}
                                            >
                                                {activeInnings.innings_status}
                                            </span>
                                        </div>
                                        <div className="mt-2 text-muted small d-flex flex-wrap gap-4">
                                            <span>
                                                <strong>Batting:</strong> {activeInnings.batting_team_name}
                                            </span>
                                            <span>
                                                <strong>Bowling:</strong> {activeInnings.bowling_team_name}
                                            </span>
                                            <span>
                                                <strong>CRR:</strong> {crr}
                                            </span>
                                            {activeInnings.target_runs && (
                                                <span className="text-primary fw-bold">
                                                    Target: {activeInnings.target_runs} runs
                                                </span>
                                            )}
                                            <span>
                                                <strong>Extras:</strong> {activeInnings.extras} (w {activeInnings.wides}, nb {activeInnings.no_balls}, b {activeInnings.byes}, lb {activeInnings.leg_byes})
                                            </span>
                                        </div>
                                    </div>
                                    <div className="d-flex gap-2">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-success"
                                            onClick={handleSyncTotals}
                                            disabled={syncing || isLockedForCurrentUser}
                                            title={isLockedForCurrentUser ? "Innings completed. Only Super Admin and Academy Admin can sync totals." : "Tally batting runs, wickets and bowler overs automatically"}
                                        >
                                            {syncing ? (
                                                <>
                                                    <RefreshCw className="spinner-border spinner-border-sm me-1" /> Syncing...
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle2 size={15} className="me-1" /> Sync Totals
                                                </>
                                            )}
                                        </button>
                                        {!isLockedForCurrentUser && (
                                            <Link
                                                href={`/next_panel/match-innings/${activeInnings.id}/edit`}
                                                className="btn btn-sm btn-outline-secondary"
                                            >
                                                <Edit size={14} className="me-1" /> Edit Innings
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Batting Scorecard Section */}
                        <div className="col-12">
                            <div className="bg-white rounded-4 shadow-sm p-4">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                                        <Trophy size={18} className="text-primary" /> Batting - {activeInnings.batting_team_name}
                                    </h5>
                                    {isLockedForCurrentUser ? (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-secondary opacity-75"
                                            disabled
                                            title="Innings completed. Only Super Admin and Academy Admin can add batters."
                                        >
                                            <Lock size={14} className="me-1" /> Add Batter (Locked)
                                        </button>
                                    ) : (
                                        <Link
                                            href={`/next_panel/match-scorecard/new?match_id=${selectedMatchId}&innings_id=${activeInnings.id}`}
                                            className="btn btn-sm btn-primary"
                                        >
                                            <PlusCircle size={15} className="me-1" /> Add Batter
                                        </Link>
                                    )}
                                </div>

                                {battingScores.length === 0 ? (
                                    <div className="text-center py-4 text-muted bg-light rounded-3">
                                        No batters recorded yet.
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table align-middle table-hover mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th style={{ width: "50px" }}>Pos</th>
                                                    <th>Batter</th>
                                                    <th>Dismissal</th>
                                                    <th className="text-center">R</th>
                                                    <th className="text-center">B</th>
                                                    <th className="text-center">4s</th>
                                                    <th className="text-center">6s</th>
                                                    <th className="text-center">SR</th>
                                                    <th className="text-end">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {battingScores.map((b) => {
                                                    const bowler = getPlayerName(b.dismissed_by_player_id);
                                                    const fielder = getPlayerName(b.fielder_player_id);

                                                    let dismissalStr = b.dismissal_type;
                                                    if (b.dismissal_type === "Not Out") dismissalStr = "not out";
                                                    else if (b.dismissal_type === "Bowled") dismissalStr = `b ${bowler || "Bowler"}`;
                                                    else if (b.dismissal_type === "LBW") dismissalStr = `lbw b ${bowler || "Bowler"}`;
                                                    else if (b.dismissal_type === "Caught") {
                                                        dismissalStr = fielder && bowler ? `c ${fielder} b ${bowler}` : bowler ? `c & b ${bowler}` : "caught";
                                                    } else if (b.dismissal_type === "Run Out") {
                                                        dismissalStr = fielder ? `run out (${fielder})` : "run out";
                                                    } else if (b.dismissal_type === "Stumped") {
                                                        dismissalStr = fielder && bowler ? `st ${fielder} b ${bowler}` : "stumped";
                                                    }

                                                    return (
                                                        <tr key={b.id}>
                                                            <td>
                                                                <span className="badge bg-light text-dark border">
                                                                    {b.batting_position || "—"}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className="fw-bold">{b.player_name || `Player #${b.match_player_id}`}</span>
                                                            </td>
                                                            <td>
                                                                <span className={b.dismissal_type === "Not Out" ? "text-success fw-medium" : "text-muted small"}>
                                                                    {dismissalStr}
                                                                </span>
                                                            </td>
                                                            <td className="text-center fw-bold">{b.runs}</td>
                                                            <td className="text-center text-muted">{b.balls}</td>
                                                            <td className="text-center">{b.fours}</td>
                                                            <td className="text-center">{b.sixes}</td>
                                                            <td className="text-center">{Number(b.strike_rate || 0).toFixed(2)}</td>
                                                            <td className="text-end">
                                                                {isLockedForCurrentUser ? (
                                                                    <span className="badge bg-light text-muted border py-1 px-2" title="Scores locked. Only Super Admin and Academy Admin can edit.">
                                                                        <Lock size={12} className="me-1" /> Locked
                                                                    </span>
                                                                ) : (
                                                                    <div className="d-flex justify-content-end gap-1">
                                                                        <Link
                                                                            href={`/next_panel/match-scorecard/${b.id}/edit`}
                                                                            className="btn btn-sm btn-outline-secondary py-0 px-2"
                                                                        >
                                                                            <Edit size={13} />
                                                                        </Link>
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-sm btn-outline-danger py-0 px-2"
                                                                            onClick={() => handleDeleteBatter(b)}
                                                                        >
                                                                            <Trash2 size={13} />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {/* Extras and Total Footer Rows */}
                                                <tr className="table-light fw-medium">
                                                    <td colSpan={3}>
                                                        Extras: {activeInnings.extras} (b {activeInnings.byes}, lb {activeInnings.leg_byes}, w {activeInnings.wides}, nb {activeInnings.no_balls}, p {activeInnings.penalty_runs})
                                                    </td>
                                                    <td className="text-center" colSpan={6}>
                                                        —
                                                    </td>
                                                </tr>
                                                <tr className="table-secondary fw-bold">
                                                    <td colSpan={3}>
                                                        Total: {activeInnings.total_runs}/{activeInnings.total_wickets} ({activeInnings.total_overs} Overs, RR: {crr})
                                                    </td>
                                                    <td className="text-center" colSpan={6}>
                                                        —
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bowling Scorecard Section */}
                        <div className="col-12">
                            <div className="bg-white rounded-4 shadow-sm p-4">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                                        <Activity size={18} className="text-primary" /> Bowling - {activeInnings.bowling_team_name}
                                    </h5>
                                    {isLockedForCurrentUser ? (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-secondary opacity-75"
                                            disabled
                                            title="Innings completed. Only Super Admin and Academy Admin can add bowlers."
                                        >
                                            <Lock size={14} className="me-1" /> Add Bowler (Locked)
                                        </button>
                                    ) : (
                                        <Link
                                            href={`/next_panel/match-bowling-scorecard/new?match_id=${selectedMatchId}&innings_id=${activeInnings.id}`}
                                            className="btn btn-sm btn-primary"
                                        >
                                            <PlusCircle size={15} className="me-1" /> Add Bowler
                                        </Link>
                                    )}
                                </div>

                                {bowlingScores.length === 0 ? (
                                    <div className="text-center py-4 text-muted bg-light rounded-3">
                                        No bowlers recorded yet.
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table align-middle table-hover mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Bowler</th>
                                                    <th className="text-center">O</th>
                                                    <th className="text-center">Balls</th>
                                                    <th className="text-center">M</th>
                                                    <th className="text-center">R</th>
                                                    <th className="text-center">W</th>
                                                    <th className="text-center">Econ</th>
                                                    <th className="text-center">WD</th>
                                                    <th className="text-center">NB</th>
                                                    <th className="text-end">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {bowlingScores.map((bw) => (
                                                    <tr key={bw.id}>
                                                        <td>
                                                            <span className="fw-bold">{bw.player_name || `Bowler #${bw.match_player_id}`}</span>
                                                        </td>
                                                        <td className="text-center fw-semibold">{bw.overs}</td>
                                                        <td className="text-center text-muted">{bw.balls_bowled}</td>
                                                        <td className="text-center">{bw.maidens}</td>
                                                        <td className="text-center">{bw.runs_conceded}</td>
                                                        <td className="text-center fw-bold text-danger">{bw.wickets}</td>
                                                        <td className="text-center fw-semibold">{Number(bw.economy || 0).toFixed(2)}</td>
                                                        <td className="text-center text-muted">{bw.wides}</td>
                                                        <td className="text-center text-muted">{bw.no_balls}</td>
                                                        <td className="text-end">
                                                            {isLockedForCurrentUser ? (
                                                                <span className="badge bg-light text-muted border py-1 px-2" title="Scores locked. Only Super Admin and Academy Admin can edit.">
                                                                    <Lock size={12} className="me-1" /> Locked
                                                                </span>
                                                            ) : (
                                                                <div className="d-flex justify-content-end gap-1">
                                                                    <Link
                                                                        href={`/next_panel/match-bowling-scorecard/${bw.id}/edit`}
                                                                        className="btn btn-sm btn-outline-secondary py-0 px-2"
                                                                    >
                                                                        <Edit size={13} />
                                                                    </Link>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-outline-danger py-0 px-2"
                                                                        onClick={() => handleDeleteBowler(bw)}
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
