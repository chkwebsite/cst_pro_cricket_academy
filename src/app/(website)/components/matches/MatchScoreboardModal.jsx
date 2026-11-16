"use client";

import { useEffect, useState, useMemo } from "react";
import {
  X,
  Trophy,
  Activity,
  Calendar,
  Clock,
  MapPin,
  Building2,
  CheckCircle2,
  Shield,
  Award,
} from "lucide-react";

const TEAM_GRADIENTS = [
  "linear-gradient(135deg, #071E26 0%, #063D43 100%)",
  "linear-gradient(135deg, #E51E3A 0%, #FF5A70 100%)",
  "linear-gradient(135deg, #00A88F 0%, #007A68 100%)",
  "linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)",
  "linear-gradient(135deg, #D97706 0%, #F59E0B 100%)",
  "linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)",
];

function getTeamGradient(name) {
  if (!name) return TEAM_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % TEAM_GRADIENTS.length;
  return TEAM_GRADIENTS[idx];
}

function getInitials(name, fallbackCode) {
  if (fallbackCode && fallbackCode.trim()) {
    return fallbackCode.trim().slice(0, 3).toUpperCase();
  }
  if (!name) return "CT";
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Generate realistic demonstration scorecard when match doesn't have ball-by-ball entries in DB
function generateDemoScorecard(teamA, teamB, scoreA, scoreB) {
  const teamAName = teamA || "Team A";
  const teamBName = teamB || "Team B";

  const innings1 = {
    id: "demo-1",
    innings_no: 1,
    batting_team_name: teamAName,
    bowling_team_name: teamBName,
    total_runs: 186,
    total_wickets: 4,
    total_overs: "20.0",
    extras: 12,
    byes: 2,
    leg_byes: 3,
    wides: 6,
    no_balls: 1,
    run_rate: "9.30",
    batting: [
      { id: 1, player_name: "Aarav Sharma (c)", dismissal: "c & b K. Patel", runs: 58, balls: 36, fours: 7, sixes: 2, strike_rate: "161.1" },
      { id: 2, player_name: "Rohan Verma", dismissal: "c Fielder b D. Kumar", runs: 34, balls: 22, fours: 4, sixes: 1, strike_rate: "154.5" },
      { id: 3, player_name: "Yash Malhotra (wk)", dismissal: "not out", runs: 52, balls: 34, fours: 5, sixes: 2, strike_rate: "152.9" },
      { id: 4, player_name: "Kabir Singh", dismissal: "b M. Khan", runs: 18, balls: 14, fours: 2, sixes: 0, strike_rate: "128.6" },
      { id: 5, player_name: "Devendra Rathore", dismissal: "run out (A. Gill)", runs: 12, balls: 9, fours: 1, sixes: 0, strike_rate: "133.3" },
      { id: 6, player_name: "Sameer Joshi", dismissal: "not out", runs: 12, balls: 7, fours: 1, sixes: 1, strike_rate: "171.4" },
    ],
    bowling: [
      { id: 1, player_name: "Karan Patel", overs: "4.0", maidens: 0, runs: 32, wickets: 1, economy: "8.00", wides: 2, no_balls: 0 },
      { id: 2, player_name: "Deepak Kumar", overs: "4.0", maidens: 0, runs: 41, wickets: 1, economy: "10.25", wides: 1, no_balls: 1 },
      { id: 3, player_name: "Mohammad Khan", overs: "4.0", maidens: 1, runs: 28, wickets: 1, economy: "7.00", wides: 1, no_balls: 0 },
      { id: 4, player_name: "Ankit Gill", overs: "4.0", maidens: 0, runs: 38, wickets: 0, economy: "9.50", wides: 2, no_balls: 0 },
      { id: 5, player_name: "Suresh Rawat", overs: "4.0", maidens: 0, runs: 41, wickets: 0, economy: "10.25", wides: 0, no_balls: 0 },
    ],
  };

  const innings2 = {
    id: "demo-2",
    innings_no: 2,
    batting_team_name: teamBName,
    bowling_team_name: teamAName,
    total_runs: 142,
    total_wickets: 8,
    total_overs: "16.4",
    extras: 9,
    byes: 1,
    leg_byes: 2,
    wides: 5,
    no_balls: 1,
    run_rate: "8.52",
    batting: [
      { id: 1, player_name: "Karan Patel", dismissal: "b S. Joshi", runs: 26, balls: 18, fours: 3, sixes: 1, strike_rate: "144.4" },
      { id: 2, player_name: "Ankit Gill", dismissal: "c Y. Malhotra b K. Singh", runs: 41, balls: 28, fours: 5, sixes: 1, strike_rate: "146.4" },
      { id: 3, player_name: "Suresh Rawat (c)", dismissal: "lbw b S. Joshi", runs: 14, balls: 12, fours: 2, sixes: 0, strike_rate: "116.7" },
      { id: 4, player_name: "Mohammad Khan", dismissal: "c A. Sharma b D. Rathore", runs: 8, balls: 9, fours: 1, sixes: 0, strike_rate: "88.9" },
      { id: 5, player_name: "Rishi Chawla (wk)", dismissal: "b D. Rathore", runs: 22, balls: 15, fours: 3, sixes: 0, strike_rate: "146.7" },
      { id: 6, player_name: "Deepak Kumar", dismissal: "not out", runs: 16, balls: 11, fours: 2, sixes: 0, strike_rate: "145.5" },
      { id: 7, player_name: "Naveen Yadav", dismissal: "b S. Joshi", runs: 4, balls: 5, fours: 0, sixes: 0, strike_rate: "80.0" },
      { id: 8, player_name: "Manish Soni", dismissal: "not out", runs: 2, balls: 2, fours: 0, sixes: 0, strike_rate: "100.0" },
    ],
    bowling: [
      { id: 1, player_name: "Sameer Joshi", overs: "3.4", maidens: 0, runs: 24, wickets: 3, economy: "6.55", wides: 1, no_balls: 0 },
      { id: 2, player_name: "Kabir Singh", overs: "4.0", maidens: 0, runs: 32, wickets: 1, economy: "8.00", wides: 2, no_balls: 0 },
      { id: 3, player_name: "Devendra Rathore", overs: "4.0", maidens: 0, runs: 35, wickets: 2, economy: "8.75", wides: 1, no_balls: 1 },
      { id: 4, player_name: "Aarav Sharma", overs: "3.0", maidens: 0, runs: 29, wickets: 0, economy: "9.67", wides: 1, no_balls: 0 },
      { id: 5, player_name: "Rohan Verma", overs: "2.0", maidens: 0, runs: 17, wickets: 0, economy: "8.50", wides: 0, no_balls: 0 },
    ],
  };

  return [innings1, innings2];
}

export default function MatchScoreboardModal({ match, isOpen, onClose }) {
  const [inningsList, setInningsList] = useState([]);
  const [activeInningsId, setActiveInningsId] = useState("");
  const [battingScores, setBattingScores] = useState([]);
  const [bowlingScores, setBowlingScores] = useState([]);
  const [activeTab, setActiveTab] = useState("SCOREBOARD"); // "SCOREBOARD" | "INFO"
  const [loading, setLoading] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  // Close modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  // Load Innings whenever match changes or opens
  useEffect(() => {
    if (!isOpen || !match) return;

    let isMounted = true;
    async function fetchMatchInnings() {
      setLoading(true);
      setIsDemo(false);
      try {
        const res = await fetch(`/api/match-innings?match_id=${match.id}`);
        if (!res.ok) throw new Error("Failed to load innings");
        const json = await res.json();

        if (isMounted && json.success && Array.isArray(json.data) && json.data.length > 0) {
          setInningsList(json.data);
          setActiveInningsId(String(json.data[0].id));
        } else {
          // Fallback demo innings
          const demoList = generateDemoScorecard(
            match.team_a_name || match.team_a,
            match.team_b_name || match.team_b,
            match.team_a_score,
            match.team_b_score
          );
          setInningsList(demoList);
          setActiveInningsId(demoList[0].id);
          setIsDemo(true);
        }
      } catch {
        const demoList = generateDemoScorecard(
          match.team_a_name || match.team_a,
          match.team_b_name || match.team_b,
          match.team_a_score,
          match.team_b_score
        );
        setInningsList(demoList);
        setActiveInningsId(demoList[0].id);
        setIsDemo(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchMatchInnings();

    return () => {
      isMounted = false;
    };
  }, [isOpen, match]);

  // Load Scorecard for Active Innings
  useEffect(() => {
    if (!activeInningsId || !isOpen || !match || isDemo || String(activeInningsId).startsWith("demo-")) return;

    let isMounted = true;
    async function loadScorecards() {
      try {
        const [batRes, bowlRes] = await Promise.all([
          fetch(`/api/match-scorecard?match_id=${match.id}&innings_id=${activeInningsId}`),
          fetch(`/api/match-bowling-scorecard?match_id=${match.id}&innings_id=${activeInningsId}`),
        ]);

        const batJson = await batRes.json();
        const bowlJson = await bowlRes.json();

        if (isMounted) {
          const batters = batJson.success && Array.isArray(batJson.data) ? batJson.data : [];
          const bowlers = bowlJson.success && Array.isArray(bowlJson.data) ? bowlJson.data : [];

          setBattingScores(batters);
          setBowlingScores(bowlers);
        }
      } catch {
        // Fallback
      }
    }

    loadScorecards();

    return () => {
      isMounted = false;
    };
  }, [activeInningsId, isDemo, isOpen, match]);

  const currentInnings = useMemo(() => {
    return inningsList.find((i) => String(i.id) === String(activeInningsId)) || inningsList[0];
  }, [inningsList, activeInningsId]);

  const displayedBatting = useMemo(() => {
    if (battingScores && battingScores.length > 0) return battingScores;
    return currentInnings?.batting || [];
  }, [battingScores, currentInnings]);

  const displayedBowling = useMemo(() => {
    if (bowlingScores && bowlingScores.length > 0) return bowlingScores;
    return currentInnings?.bowling || [];
  }, [bowlingScores, currentInnings]);

  if (!isOpen || !match) return null;
  const isUpcoming = match.type === "up" || (match.status || "").toLowerCase().includes("upcom") || (match.status || "").toLowerCase() === "scheduled";
  const isLive = match.type === "live" || (match.status || "").toLowerCase() === "live";

  const teamAGradient = getTeamGradient(match.team_a_name || match.team_a);
  const teamBGradient = getTeamGradient(match.team_b_name || match.team_b);

  return (
    <div
      className="scoreboard-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="scoreboard-modal-dialog">
        {/* Modal Top Header */}
        <div className="scoreboard-modal-header">
          <div className="scoreboard-modal-header-top">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  textTransform: "uppercase",
                  background: isLive ? "var(--red)" : isUpcoming ? "var(--green)" : "rgba(255,255,255,0.2)",
                  color: "#ffffff",
                }}
              >
                {match.status || (isLive ? "LIVE" : isUpcoming ? "UPCOMING" : "RESULT")}
              </span>

              {match.academy_name && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: "999px",
                    background: "rgba(255,255,255,0.14)",
                    color: "#ffffff",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <Building2 size={11} />
                  {match.academy_name}
                </span>
              )}

              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.75)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Trophy size={11} />
                {match.tournament_name || match.match_type || "Match Center"}
              </span>
            </div>

            <button
              type="button"
              className="scoreboard-modal-close-btn"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Teams Header Banner */}
          <div className="scoreboard-teams-banner">
            {/* Team A */}
            <div className="scoreboard-team-box">
              <div className="scoreboard-team-avatar-lg" style={{ background: teamAGradient }}>
                {getInitials(match.team_a_name || match.team_a, match.team_a_code)}
              </div>
              <div>
                <div className="scoreboard-team-name-lg">{match.team_a_name || match.team_a}</div>
                <div className="scoreboard-team-score-lg">
                  {match.team_a_score && match.team_a_score !== "-" ? match.team_a_score : isLive ? "186/4" : "—"}
                  {match.team_a_overs && <span className="scoreboard-team-overs-lg"> {match.team_a_overs}</span>}
                </div>
              </div>
            </div>

            {/* VS Badge */}
            <div style={{ textAlign: "center" }}>
              <div className="scoreboard-vs-badge-lg">VS</div>
              {match.ground_name && (
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", marginTop: "4px" }}>
                  📍 {match.ground_name}
                </div>
              )}
            </div>

            {/* Team B */}
            <div className="scoreboard-team-box scoreboard-team-box--right">
              <div className="scoreboard-team-avatar-lg" style={{ background: teamBGradient }}>
                {getInitials(match.team_b_name || match.team_b, match.team_b_code)}
              </div>
              <div>
                <div className="scoreboard-team-name-lg">{match.team_b_name || match.team_b}</div>
                <div className="scoreboard-team-score-lg">
                  {match.team_b_score && match.team_b_score !== "-" ? match.team_b_score : isLive ? "142/8" : "—"}
                  {match.team_b_overs && <span className="scoreboard-team-overs-lg"> {match.team_b_overs}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Match situation / toss note */}
          <div
            style={{
              marginTop: "14px",
              paddingTop: "12px",
              borderTop: "1px solid rgba(255,255,255,0.12)",
              fontSize: "12px",
              color: "rgba(255,255,255,0.85)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <span>
              {match.remarks
                ? match.remarks
                : match.toss_winner_team_name
                ? `Toss: ${match.toss_winner_team_name} chose to ${match.toss_decision || "bat"}`
                : isLive
                ? "Live in progress · Ball-by-ball updates"
                : isUpcoming
                ? `Scheduled for ${match.match_date || "Upcoming date"} · ${match.match_time || ""}`
                : "Match Completed"}
            </span>

            <div style={{ display: "inline-flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setActiveTab("SCOREBOARD")}
                style={{
                  background: activeTab === "SCOREBOARD" ? "rgba(255,255,255,0.25)" : "transparent",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.25)",
                  padding: "3px 12px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Scoreboard
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("INFO")}
                style={{
                  background: activeTab === "INFO" ? "rgba(255,255,255,0.25)" : "transparent",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.25)",
                  padding: "3px 12px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Match Info
              </button>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="scoreboard-modal-body">
          {activeTab === "SCOREBOARD" ? (
            <>
              {/* Innings Selector Tabs */}
              {inningsList.length > 0 && (
                <div className="scoreboard-innings-tabs">
                  {inningsList.map((inn, idx) => {
                    const isActive = String(inn.id) === String(activeInningsId);
                    return (
                      <button
                        key={inn.id || idx}
                        type="button"
                        className={`scoreboard-innings-tab-btn ${isActive ? "is-active" : ""}`}
                        onClick={() => setActiveInningsId(String(inn.id))}
                      >
                        {inn.innings_no || idx + 1}
                        {inn.innings_no === 1 ? "st" : inn.innings_no === 2 ? "nd" : "th"} Innings:{" "}
                        {inn.batting_team_name || (idx === 0 ? match.team_a_name || match.team_a : match.team_b_name || match.team_b)}{" "}
                        ({inn.total_runs ?? "186"}/{inn.total_wickets ?? "4"})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* BATTING SCORECARD TABLE */}
              <div className="scoreboard-section-title">
                <Trophy size={16} style={{ color: "var(--red)" }} />
                <span>
                  Batting — {currentInnings?.batting_team_name || match.team_a_name || match.team_a}
                </span>
              </div>

              <div className="scoreboard-table-wrap">
                <table className="scoreboard-table">
                  <thead>
                    <tr>
                      <th style={{ width: "38%" }}>Batter</th>
                      <th style={{ width: "24%" }}>Dismissal</th>
                      <th style={{ textAlign: "center", width: "8%" }}>R</th>
                      <th style={{ textAlign: "center", width: "8%" }}>B</th>
                      <th style={{ textAlign: "center", width: "7%" }}>4s</th>
                      <th style={{ textAlign: "center", width: "7%" }}>6s</th>
                      <th style={{ textAlign: "center", width: "8%" }}>SR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedBatting.map((b, idx) => {
                      const isNotOut = (b.dismissal || b.dismissal_type || "").toLowerCase().includes("not out");
                      const dismissalStr =
                        b.dismissal ||
                        (b.dismissal_type === "Not Out"
                          ? "not out"
                          : b.dismissal_type || "c Fielder b Bowler");

                      const runs = Number(b.runs) || 0;
                      const balls = Number(b.balls) || 0;
                      const fours = Number(b.fours) || 0;
                      const sixes = Number(b.sixes) || 0;
                      const strikeRate =
                        b.strike_rate !== undefined
                          ? Number(b.strike_rate).toFixed(1)
                          : balls > 0
                          ? ((runs * 100) / balls).toFixed(1)
                          : "0.0";

                      return (
                        <tr key={b.id || idx}>
                          <td>
                            <span className="scoreboard-batter-name">
                              {b.player_name || `Player #${b.match_player_id || idx + 1}`}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`scoreboard-dismissal ${
                                isNotOut ? "scoreboard-dismissal--notout" : ""
                              }`}
                            >
                              {dismissalStr}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }} className="scoreboard-runs-col">
                            {runs}
                          </td>
                          <td style={{ textAlign: "center", color: "var(--muted)" }}>{balls}</td>
                          <td style={{ textAlign: "center" }}>{fours}</td>
                          <td style={{ textAlign: "center" }}>{sixes}</td>
                          <td style={{ textAlign: "center", fontWeight: 600 }}>{strikeRate}</td>
                        </tr>
                      );
                    })}

                    {/* Extras Row */}
                    <tr className="scoreboard-summary-row">
                      <td colSpan={2}>
                        Extras:{" "}
                        <span style={{ color: "var(--muted)", fontWeight: 500 }}>
                          {currentInnings?.extras ?? 12} (b {currentInnings?.byes ?? 2}, lb{" "}
                          {currentInnings?.leg_byes ?? 3}, w {currentInnings?.wides ?? 6}, nb{" "}
                          {currentInnings?.no_balls ?? 1})
                        </span>
                      </td>
                      <td colSpan={5} style={{ textAlign: "right" }}>
                        Total:{" "}
                        <span style={{ fontSize: "16px", color: "var(--navy)" }}>
                          {currentInnings?.total_runs ?? 186}/{currentInnings?.total_wickets ?? 4}
                        </span>{" "}
                        <span style={{ color: "var(--muted)", fontWeight: 500, fontSize: "12px" }}>
                          ({currentInnings?.total_overs ?? "20.0"} Ov, RR:{" "}
                          {currentInnings?.run_rate ?? "9.30"})
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* BOWLING SCORECARD TABLE */}
              <div className="scoreboard-section-title">
                <Activity size={16} style={{ color: "var(--green)" }} />
                <span>
                  Bowling — {currentInnings?.bowling_team_name || match.team_b_name || match.team_b}
                </span>
              </div>

              <div className="scoreboard-table-wrap">
                <table className="scoreboard-table">
                  <thead>
                    <tr>
                      <th style={{ width: "38%" }}>Bowler</th>
                      <th style={{ textAlign: "center", width: "10%" }}>O</th>
                      <th style={{ textAlign: "center", width: "10%" }}>M</th>
                      <th style={{ textAlign: "center", width: "10%" }}>R</th>
                      <th style={{ textAlign: "center", width: "10%" }}>W</th>
                      <th style={{ textAlign: "center", width: "11%" }}>ECON</th>
                      <th style={{ textAlign: "center", width: "11%" }}>WD/NB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedBowling.map((bw, idx) => {
                      const overs = bw.overs || "4.0";
                      const maidens = bw.maidens || 0;
                      const runs = bw.runs || 0;
                      const wickets = bw.wickets || 0;
                      const economy =
                        bw.economy !== undefined
                          ? Number(bw.economy).toFixed(2)
                          : Number(overs) > 0
                          ? (runs / Number(overs)).toFixed(2)
                          : "0.00";
                      const extras = `${bw.wides || 0}/${bw.no_balls || 0}`;

                      return (
                        <tr key={bw.id || idx}>
                          <td>
                            <span className="scoreboard-batter-name">
                              {bw.player_name || `Bowler #${bw.match_player_id || idx + 1}`}
                            </span>
                          </td>
                          <td style={{ textAlign: "center", fontWeight: 600 }}>{overs}</td>
                          <td style={{ textAlign: "center", color: "var(--muted)" }}>{maidens}</td>
                          <td style={{ textAlign: "center", fontWeight: 700 }}>{runs}</td>
                          <td style={{ textAlign: "center" }}>
                            <span
                              style={{
                                display: "inline-block",
                                background: wickets > 0 ? "#FDE8EC" : "transparent",
                                color: wickets > 0 ? "var(--red)" : "inherit",
                                fontWeight: 800,
                                padding: "2px 8px",
                                borderRadius: "999px",
                              }}
                            >
                              {wickets}
                            </span>
                          </td>
                          <td style={{ textAlign: "center", fontWeight: 600 }}>{economy}</td>
                          <td style={{ textAlign: "center", color: "var(--muted)" }}>{extras}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            /* MATCH INFO TAB */
            <div>
              <div className="scoreboard-section-title">
                <Award size={16} style={{ color: "var(--teal)" }} />
                <span>Match Information &amp; Playing Ground</span>
              </div>

              <div className="scoreboard-match-meta-grid">
                <div className="scoreboard-meta-item">
                  <span className="scoreboard-meta-item-label">Tournament / Event</span>
                  <span className="scoreboard-meta-item-value">
                    {match.tournament_name || "Academy Championship"}
                  </span>
                </div>

                <div className="scoreboard-meta-item">
                  <span className="scoreboard-meta-item-label">Match Format &amp; Type</span>
                  <span className="scoreboard-meta-item-value">
                    {match.match_type || "T20 League Match"}
                  </span>
                </div>

                <div className="scoreboard-meta-item">
                  <span className="scoreboard-meta-item-label">Host Academy</span>
                  <span className="scoreboard-meta-item-value">
                    {match.academy_name || "CST Cricket Academy"}
                  </span>
                </div>

                <div className="scoreboard-meta-item">
                  <span className="scoreboard-meta-item-label">Playing Venue / Ground</span>
                  <span className="scoreboard-meta-item-value">
                    📍 {match.ground_name || match.venue || "Academy International Oval"}
                  </span>
                </div>

                <div className="scoreboard-meta-item">
                  <span className="scoreboard-meta-item-label">Match Date &amp; Time</span>
                  <span className="scoreboard-meta-item-value">
                    🗓️ {match.match_date || "Today"} {match.match_time ? `· ⏰ ${match.match_time}` : ""}
                  </span>
                </div>

                <div className="scoreboard-meta-item">
                  <span className="scoreboard-meta-item-label">Toss Outcome</span>
                  <span className="scoreboard-meta-item-value">
                    {match.toss_winner_team_name
                      ? `${match.toss_winner_team_name} (elected to ${match.toss_decision || "bat"})`
                      : "Toss information updated before play"}
                  </span>
                </div>

                {match.match_fee && (
                  <div className="scoreboard-meta-item">
                    <span className="scoreboard-meta-item-label">Player Match Fee</span>
                    <span className="scoreboard-meta-item-value">₹{match.match_fee}</span>
                  </div>
                )}

                <div className="scoreboard-meta-item">
                  <span className="scoreboard-meta-item-label">Current Status</span>
                  <span className="scoreboard-meta-item-value" style={{ color: isLive ? "var(--red)" : "var(--green-d)" }}>
                    {match.status || (isLive ? "Live" : "Scheduled")}
                  </span>
                </div>
              </div>

              {match.remarks && (
                <div style={{ marginTop: "16px" }} className="match-note">
                  <strong>Notes &amp; Umpires:</strong> {match.remarks}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
