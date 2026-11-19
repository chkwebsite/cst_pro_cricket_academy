"use client";

import { useEffect, useState, useMemo } from "react";
import PageHeader from "../components/layout/PageHeader";
import CtaSection from "../components/home/CtaSection";
import MatchScoreboardModal from "../components/matches/MatchScoreboardModal";
import {
  Calendar,
  Clock,
  MapPin,
  Trophy,
  Building2,
  ArrowRight,
  Radio,
  Sparkles,
} from "lucide-react";

const TOURNAMENTS = [
  { name: "CST Champions Trophy", format: "T20 · League + Knockout", dates: "Apr 10 – Apr 25", status: "Entries Open", statusStyle: "tag" },
  { name: "Junior Cricket League (U-14)", format: "40 Overs", dates: "May 5 – May 20", status: "Upcoming", statusStyle: "tag" },
  { name: "Gurugram Corporate Cup", format: "T20 Floodlight", dates: "Ongoing (Weekends)", status: "Active", statusStyle: "tag", customTagStyle: { background: "#FDE6EA", color: "var(--red)" } },
  { name: "Inter-Academy Summer Cup", format: "50 Overs State Level", dates: "June 2 – June 18", status: "Registration Soon", statusStyle: "tag" },
];

const FALLBACK_MATCHES = [
  {
    id: 1,
    academy_id: 1,
    academy_name: "CST Premier Academy",
    status: "LIVE",
    type: "live",
    match_type: "T20 Championship",
    team_a: "CST Warriors",
    team_a_name: "CST Warriors",
    team_a_code: "CW",
    team_a_score: "186/4",
    team_a_overs: "(17.2 ov)",
    team_b: "Apex Titans",
    team_b_name: "Apex Titans",
    team_b_code: "AT",
    team_b_score: "142/8",
    team_b_overs: "(16.0 ov)",
    ground_name: "Main Ground · Pitch 1",
    venue: "Main Ground · Pitch 1",
    match_date: new Date().toISOString().slice(0, 10),
    match_time: "09:30:00",
    remarks: "Target: 187 runs · Live 2nd Innings",
    toss_winner_team_name: "CST Warriors",
    toss_decision: "Bat",
  },
  {
    id: 2,
    academy_id: 1,
    academy_name: "CST Premier Academy",
    status: "UPCOMING",
    type: "up",
    match_type: "Weekend League",
    team_a: "CST XI",
    team_a_name: "CST XI",
    team_a_code: "CXI",
    team_b: "Gurugram Lions",
    team_b_name: "Gurugram Lions",
    team_b_code: "GL",
    ground_name: "Turf Oval 1",
    venue: "Turf Oval 1 · This Saturday, 8:30 AM",
    match_date: "2026-11-21",
    match_time: "08:30:00",
    remarks: "Round 4 League Fixture",
  },
  {
    id: 3,
    academy_id: 2,
    academy_name: "Delhi Sports Academy",
    status: "RECENT RESULT",
    type: "recent",
    match_type: "Inter-Academy Cup",
    team_a: "CST Academy",
    team_a_name: "CST Academy",
    team_a_code: "CA",
    team_a_score: "172/6",
    team_a_overs: "(19.2 ov)",
    team_b: "Delhi Stars",
    team_b_name: "Delhi Stars",
    team_b_code: "DS",
    team_b_score: "168/9",
    team_b_overs: "(20.0 ov)",
    result: "CST Academy won by 4 wkts",
    remarks: "CST Academy won by 4 wkts",
    ground_name: "Campus Arena",
    venue: "Campus Arena · Yesterday",
    match_date: "2026-11-15",
    match_time: "10:00:00",
  },
];

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

function formatMatchDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr).slice(0, 10);
    return d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(dateStr).slice(0, 10);
  }
}

function formatMatchTime(timeStr) {
  if (!timeStr) return "";
  const parts = String(timeStr).split(":");
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const mins = parts[1];
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${mins} ${ampm}`;
  }
  return timeStr;
}

function isTodayDate(dateStr) {
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
}

export default function MatchesPage() {
  const [matches, setMatches] = useState(FALLBACK_MATCHES);
  const [filterTab, setFilterTab] = useState("ALL");
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchMatches() {
      try {
        const res = await fetch("/api/matches?exclude_status=Cancelled");
        if (!res.ok) return;
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data)) {
          // Filter out any cancelled matches so they never appear on the public website
          const activeMatches = json.data.filter((m) => {
            const rawStatus = (m.status || "").trim().toLowerCase();
            return rawStatus !== "cancelled" && rawStatus !== "canceled";
          });

          if (activeMatches.length > 0) {
            const mapped = activeMatches.map((m) => {
              const rawStatus = (m.status || "").trim().toLowerCase();
              const isToday = isTodayDate(m.match_date);

              const isLive =
                rawStatus === "live" ||
                rawStatus === "in progress" ||
                (isToday && rawStatus !== "completed");

              const isCompleted = rawStatus === "completed";

              // Extract score and overs cleanly
              let teamAScore = m.team_a_score || "";
              let teamAOvers = "";
              if (teamAScore.includes("(")) {
                const parts = teamAScore.split("(");
                teamAScore = parts[0].trim();
                teamAOvers = `(${parts[1]}`;
              }

              let teamBScore = m.team_b_score || "";
              let teamBOvers = "";
              if (teamBScore.includes("(")) {
                const parts = teamBScore.split("(");
                teamBScore = parts[0].trim();
                teamBOvers = `(${parts[1]}`;
              }

              return {
                id: m.id,
                academy_id: m.academy_id || 1,
                academy_name: m.academy_name || "CST Cricket Academy",
                branch_name: m.branch_name,
                tournament_name: m.tournament_name,
                match_type: m.match_type || "Match",
                status: isLive ? "LIVE" : isCompleted ? "RECENT RESULT" : "UPCOMING",
                type: isLive ? "live" : isCompleted ? "recent" : "up",
                team_a: m.team_a_name || "Team A",
                team_a_name: m.team_a_name || "Team A",
                team_a_code: m.team_a_code,
                team_a_score: teamAScore || (isLive ? "145/3" : isCompleted ? "180/7" : "-"),
                team_a_overs: teamAOvers || (isLive ? "(15.4 ov)" : isCompleted ? "(20.0 ov)" : ""),
                team_b: m.team_b_name || "Team B",
                team_b_name: m.team_b_name || "Team B",
                team_b_code: m.team_b_code,
                team_b_score: teamBScore || (isLive ? "Yet to bat" : isCompleted ? "162/8" : "-"),
                team_b_overs: teamBOvers || (isCompleted ? "(20.0 ov)" : ""),
                result: m.result_note || m.remarks || (isCompleted ? "Match Completed" : ""),
                remarks: m.remarks,
                ground_name: m.ground_name || "Academy Ground",
                venue: `${m.ground_name || "Academy Ground"} · ${m.match_date ? formatMatchDate(m.match_date) : "Upcoming"}`,
                match_date: m.match_date,
                match_time: m.match_time,
                toss_winner_team_name: m.toss_winner_team_name,
                toss_decision: m.toss_decision,
              };
            });
            setMatches(mapped);
          } else if (json.data.length > 0) {
            // All matches in database were cancelled
            setMatches([]);
          }
        }
      } catch (e) {
        // Fallback in place
      }
    }
    fetchMatches();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredMatches = useMemo(() => {
    if (filterTab === "ALL") return matches;
    if (filterTab === "LIVE") return matches.filter((m) => m.type === "live");
    if (filterTab === "UPCOMING") return matches.filter((m) => m.type === "up");
    if (filterTab === "RESULTS") return matches.filter((m) => m.type === "recent");
    return matches;
  }, [matches, filterTab]);

  const counts = useMemo(() => {
    return {
      all: matches.length,
      live: matches.filter((m) => m.type === "live").length,
      upcoming: matches.filter((m) => m.type === "up").length,
      results: matches.filter((m) => m.type === "recent").length,
    };
  }, [matches]);

  const handleCardClick = (m) => {
    setSelectedMatch(m);
    setIsModalOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Live Matches &amp; Fixtures"
        eyebrow="Matches &amp; Events"
        breadcrumbs={[{ label: "Home", href: "/" }]}
        current="Matches &amp; Events"
      />

      {/* Match Cards Grid */}
      <section className="section section--cream">
        <div className="container">
          <div className="section-head" data-reveal>
            <span className="eyebrow">On the pitch</span>
            <h2 className="title">
              LIVE &amp; <em>UPCOMING</em>
            </h2>
            <p className="lead">
              Click any match card to view detailed ball-by-ball scorecards, batter strike rates, and bowler statistics.
            </p>
          </div>

          {/* Filter Pills with Count Badges */}
          <div className="filters" role="group" aria-label="Match filters">
            {[
              { id: "ALL", label: "ALL", count: counts.all },
              { id: "LIVE", label: "LIVE", count: counts.live },
              { id: "UPCOMING", label: "UPCOMING", count: counts.upcoming },
              { id: "RESULTS", label: "RESULTS", count: counts.results },
            ].map(({ id, label, count }) => (
              <button
                key={id}
                type="button"
                className={`filter ${filterTab === id ? "is-active" : ""}`}
                onClick={() => setFilterTab(id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                }}
              >
                {id === "LIVE" && (
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "var(--red)",
                      display: "inline-block",
                    }}
                  />
                )}
                <span>{label}</span>
                <span
                  style={{
                    background: filterTab === id ? "rgba(255,255,255,0.25)" : "rgba(7,30,38,0.08)",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* Redesigned Match Cards Grid */}
          <div className="matches-grid">
            {filteredMatches.length === 0 ? (
              <div
                style={{
                  gridColumn: "1 / -1",
                  textAlign: "center",
                  padding: "50px 20px",
                  background: "#ffffff",
                  borderRadius: "16px",
                  border: "1px dashed rgba(7,30,38,0.15)",
                }}
              >
                <Trophy size={42} style={{ margin: "0 auto 12px", opacity: 0.35, color: "var(--teal)" }} />
                <h4 style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: 700, color: "var(--dark)" }}>
                  No Active Matches
                </h4>
                <p style={{ margin: 0, fontSize: "14px", color: "var(--muted)" }}>
                  {filterTab === "ALL"
                    ? "There are currently no active matches scheduled."
                    : `There are currently no matches in the ${filterTab} category.`}
                </p>
              </div>
            ) : (
              filteredMatches.map((m, idx) => {
              const isLive = m.type === "live";
              const isUp = m.type === "up";
              const isRecent = m.type === "recent";
              const teamAGradient = getTeamGradient(m.team_a || m.team_a_name);
              const teamBGradient = getTeamGradient(m.team_b || m.team_b_name);

              return (
                <article
                  key={m.id || idx}
                  className={`match-card ${
                    isLive
                      ? "match-card--live"
                      : isUp
                      ? "match-card--upcoming"
                      : ""
                  }`}
                  data-reveal
                  style={{
                    "--d": idx,
                    cursor: "pointer",
                    borderTop: isRecent ? "4px solid var(--navy)" : undefined,
                  }}
                  onClick={() => handleCardClick(m)}
                  title="Click to view detailed match scorecard"
                >
                  {/* Top Bar of Card */}
                  <div className="match-card__header">
                    {isLive ? (
                      <span className="match-card__status-tag match-card__status-tag--live">
                        <span className="dot" />
                        LIVE NOW
                      </span>
                    ) : isUp ? (
                      <span className="match-card__status-tag match-card__status-tag--upcoming">
                        <Clock size={11} style={{ marginRight: "3px" }} />
                        UPCOMING
                      </span>
                    ) : (
                      <span
                        className="match-card__status-tag"
                        style={{ background: "#EEF2F4", color: "var(--navy)" }}
                      >
                        <Trophy size={11} style={{ marginRight: "4px" }} />
                        RECENT RESULT
                      </span>
                    )}

                    <div className="match-card__meta-tags">
                      {/* Academy Badge */}
                      <span className="match-card__chip match-card__chip--academy" title={m.academy_name}>
                        <Building2 size={11} />
                        {m.academy_name || "CST Academy"}
                      </span>
                      {/* Tournament / Format Chip */}
                      <span className="match-card__chip">
                        <Trophy size={11} />
                        {m.tournament_name || m.match_type || "Match"}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="match-card__body">
                    {isLive ? (
                      /* Live Match Layout */
                      <>
                        <div className="match-team-row">
                          <div className="match-team-info">
                            <div className="match-team-avatar" style={{ background: teamAGradient }}>
                              {getInitials(m.team_a, m.team_a_code)}
                            </div>
                            <span className="match-team-name" title={m.team_a}>
                              {m.team_a}
                            </span>
                          </div>
                          <div className="match-team-score">
                            <span className="match-score-runs">{m.team_a_score || "-"}</span>
                            {m.team_a_overs && <div className="match-score-overs">{m.team_a_overs}</div>}
                          </div>
                        </div>

                        <div className="match-team-row">
                          <div className="match-team-info">
                            <div className="match-team-avatar" style={{ background: teamBGradient }}>
                              {getInitials(m.team_b, m.team_b_code)}
                            </div>
                            <span className="match-team-name" title={m.team_b}>
                              {m.team_b}
                            </span>
                          </div>
                          <div className="match-team-score">
                            <span className="match-score-runs">{m.team_b_score || "-"}</span>
                            {m.team_b_overs && <div className="match-score-overs">{m.team_b_overs}</div>}
                          </div>
                        </div>

                        <div className="match-note">
                          <strong>Match Situation:</strong>{" "}
                          {m.remarks || (m.toss_winner_team_name ? `Toss: ${m.toss_winner_team_name} chose to ${m.toss_decision || "bat"}` : "Live ball-by-ball in progress")}
                        </div>
                      </>
                    ) : isUp ? (
                      /* Upcoming Match Layout */
                      <>
                        <div className="match-upcoming-vs">
                          <div className="match-upcoming-team">
                            <div className="match-team-avatar" style={{ background: teamAGradient }}>
                              {getInitials(m.team_a, m.team_a_code)}
                            </div>
                            <span className="match-team-name" title={m.team_a}>
                              {m.team_a}
                            </span>
                          </div>

                          <div className="match-vs-badge">VS</div>

                          <div className="match-upcoming-team">
                            <div className="match-team-avatar" style={{ background: teamBGradient }}>
                              {getInitials(m.team_b, m.team_b_code)}
                            </div>
                            <span className="match-team-name" title={m.team_b}>
                              {m.team_b}
                            </span>
                          </div>
                        </div>

                        <div className="match-schedule-box">
                          <div className="match-schedule-item">
                            <Calendar size={13} />
                            <span>{m.match_date ? formatMatchDate(m.match_date) : "Upcoming"}</span>
                          </div>
                          {m.match_time && (
                            <div className="match-schedule-item">
                              <Clock size={13} />
                              <span>{formatMatchTime(m.match_time)}</span>
                            </div>
                          )}
                        </div>

                        {m.remarks && (
                          <div className="match-note" style={{ borderLeftColor: "var(--teal)" }}>
                            {m.remarks}
                          </div>
                        )}
                      </>
                    ) : (
                      /* Recent Result Layout */
                      <>
                        <div className="match-team-row">
                          <div className="match-team-info">
                            <div className="match-team-avatar" style={{ background: teamAGradient }}>
                              {getInitials(m.team_a, m.team_a_code)}
                            </div>
                            <span className="match-team-name" title={m.team_a}>
                              {m.team_a}
                            </span>
                          </div>
                          <div className="match-team-score">
                            <span className="match-score-runs">{m.team_a_score || "172/6"}</span>
                            {m.team_a_overs && <div className="match-score-overs">{m.team_a_overs}</div>}
                          </div>
                        </div>

                        <div className="match-team-row">
                          <div className="match-team-info">
                            <div className="match-team-avatar" style={{ background: teamBGradient }}>
                              {getInitials(m.team_b, m.team_b_code)}
                            </div>
                            <span className="match-team-name" title={m.team_b}>
                              {m.team_b}
                            </span>
                          </div>
                          <div className="match-team-score">
                            <span className="match-score-runs">{m.team_b_score || "168/9"}</span>
                            {m.team_b_overs && <div className="match-score-overs">{m.team_b_overs}</div>}
                          </div>
                        </div>

                        <div className="match-note" style={{ borderLeftColor: "var(--navy)" }}>
                          <strong>Outcome:</strong> {m.result || m.remarks || "Match completed successfully"}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="match-card__footer">
                    <span className="match-card__ground" title={m.venue}>
                      <MapPin size={13} />
                      {m.ground_name || m.venue}
                    </span>

                    <span className="match-card__action">
                      View Scorecard
                      <ArrowRight size={13} />
                    </span>
                  </div>
                </article>
              );
            }))}
          </div>
        </div>
      </section>

      {/* Tournaments & Leagues Section */}
      <section className="section" id="tournaments">
        <div className="container">
          <div className="section-head" data-reveal>
            <span className="eyebrow">Tournaments</span>
            <h2 className="title">
              ACADEMY <em>CUPS &amp; LEAGUES</em>
            </h2>
          </div>
          <div className="table-wrap" data-reveal>
            <table>
              <thead>
                <tr>
                  <th>Tournament</th>
                  <th>Format</th>
                  <th>Dates</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {TOURNAMENTS.map((t, idx) => (
                  <tr key={idx}>
                    <td>
                      <b>{t.name}</b>
                    </td>
                    <td>{t.format}</td>
                    <td>{t.dates}</td>
                    <td>
                      <span className="tag" style={t.customTagStyle}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <CtaSection />

      {/* Match Detail & Scoreboard Modal */}
      <MatchScoreboardModal
        match={selectedMatch}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedMatch(null);
        }}
      />
    </>
  );
}
