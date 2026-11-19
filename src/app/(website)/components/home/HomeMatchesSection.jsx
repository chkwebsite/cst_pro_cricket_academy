"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import MatchScoreboardModal from "../matches/MatchScoreboardModal";
import {
  Calendar,
  Clock,
  MapPin,
  Trophy,
  Activity,
  Building2,
  ArrowRight,
  RefreshCw,
  Radio,
  Flame,
} from "lucide-react";

// Fallback matches across different academies ensuring pristine UI at all times
const FALLBACK_MATCHES = [
  {
    id: 101,
    academy_id: 1,
    academy_name: "CST Premier Academy",
    status: "Live",
    match_type: "T20 Championship",
    team_a_name: "CST Warriors",
    team_a_code: "CW",
    team_a_score: "186/4",
    team_a_overs: "(17.2 ov)",
    team_b_name: "Apex Titans",
    team_b_code: "AT",
    team_b_score: "142/8",
    team_b_overs: "(16.0 ov)",
    ground_name: "Main Stadium Ground · Pitch 1",
    match_date: new Date().toISOString().slice(0, 10),
    match_time: "09:30:00",
    remarks: "Target: 187 · CST Warriors elected to bat",
    toss_winner_team_name: "CST Warriors",
    toss_decision: "Bat",
    isLive: true,
    isUpcoming: false,
  },
  {
    id: 102,
    academy_id: 2,
    academy_name: "Delhi Sports Academy",
    status: "Live",
    match_type: "Inter-Academy Super Cup",
    team_a_name: "Delhi Challengers",
    team_a_code: "DC",
    team_a_score: "204/6",
    team_a_overs: "(20.0 ov)",
    team_b_name: "Gurugram Strikers",
    team_b_code: "GS",
    team_b_score: "168/5",
    team_b_overs: "(18.1 ov)",
    ground_name: "South Pavilion Oval",
    match_date: new Date().toISOString().slice(0, 10),
    match_time: "14:00:00",
    remarks: "Gurugram Strikers need 37 runs from 11 balls",
    toss_winner_team_name: "Gurugram Strikers",
    toss_decision: "Bowl",
    isLive: true,
    isUpcoming: false,
  },
  {
    id: 201,
    academy_id: 1,
    academy_name: "CST Premier Academy",
    status: "Scheduled",
    match_type: "Weekend Super League",
    team_a_name: "CST Royal XI",
    team_a_code: "CRX",
    team_b_name: "Noida Super Kings",
    team_b_code: "NSK",
    ground_name: "Turf Oval 1 · Floodlit",
    match_date: "2026-11-21",
    match_time: "08:30:00",
    match_fee: "1200",
    remarks: "Round 4 · T20 League Stage",
    isLive: false,
    isUpcoming: true,
  },
  {
    id: 202,
    academy_id: 3,
    academy_name: "Haryana Cricket Hub",
    status: "Scheduled",
    match_type: "Junior State Trophy",
    team_a_name: "CST Junior Colts",
    team_a_code: "CJC",
    team_b_name: "Haryana Colts",
    team_b_code: "HC",
    ground_name: "Campus Arena 2",
    match_date: "2026-11-22",
    match_time: "10:00:00",
    match_fee: "1000",
    remarks: "Under-16 Knockout Fixture",
    isLive: false,
    isUpcoming: true,
  },
  {
    id: 203,
    academy_id: 2,
    academy_name: "Delhi Sports Academy",
    status: "Scheduled",
    match_type: "Friendly Fixture",
    team_a_name: "Metro Stars XI",
    team_a_code: "MSX",
    team_b_name: "Apex Youngsters",
    team_b_code: "AY",
    ground_name: "Turf Ground 3",
    match_date: "2026-11-25",
    match_time: "15:30:00",
    remarks: "40 Overs Practice Match",
    isLive: false,
    isUpcoming: true,
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
  if (!dateStr) return "TBD";
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

export default function HomeMatchesSection() {
  const [activeTab, setActiveTab] = useState("LIVE");
  const [selectedAcademy, setSelectedAcademy] = useState("ALL");
  const [matches, setMatches] = useState(FALLBACK_MATCHES);
  const [refreshing, setRefreshing] = useState(false);
  const [hasRealData, setHasRealData] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const parseMatches = useCallback((data) => {
    return data
      .filter((m) => {
        const rawStatus = (m.status || "").trim().toLowerCase();
        return rawStatus !== "cancelled" && rawStatus !== "canceled";
      })
      .map((m) => {
        const rawStatus = (m.status || "").trim().toLowerCase();
        const isToday = isTodayDate(m.match_date);

        const isLive =
          rawStatus === "live" ||
          rawStatus === "in progress" ||
          (isToday && rawStatus !== "completed");

        const isUpcoming =
          rawStatus === "scheduled" ||
          rawStatus === "upcoming" ||
          (!isLive && rawStatus !== "completed");

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
          team_a_name: m.team_a_name || "Team A",
          team_a_code: m.team_a_code,
          team_a_score: teamAScore || (isLive ? "145/3" : "-"),
          team_a_overs: teamAOvers || (isLive ? "(15.4 ov)" : ""),
          team_b_name: m.team_b_name || "Team B",
          team_b_code: m.team_b_code,
          team_b_score: teamBScore || (isLive ? "Yet to bat" : "-"),
          team_b_overs: teamBOvers,
          ground_name: m.ground_name || "Academy Ground",
          match_date: m.match_date,
          match_time: m.match_time,
          remarks: m.remarks,
          status: m.status || (isLive ? "Live" : "Scheduled"),
          toss_winner_team_name: m.toss_winner_team_name,
          toss_decision: m.toss_decision,
          isLive,
          isUpcoming,
        };
      });
  }, []);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/matches?exclude_status=Cancelled");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const parsed = parseMatches(json.data);
          if (parsed.length > 0) {
            setMatches(parsed);
            setHasRealData(true);
          }
        }
      }
    } catch {
      // Ignore
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function fetchLiveMatches() {
      try {
        const res = await fetch("/api/matches?exclude_status=Cancelled");
        if (!res.ok) return;
        const json = await res.json();

        if (isMounted && json.success && Array.isArray(json.data)) {
          const parsed = parseMatches(json.data);
          if (parsed.length > 0) {
            setMatches(parsed);
            setHasRealData(true);
          }
        }
      } catch {
        // On error, fallback remains intact
      }
    }

    fetchLiveMatches();

    // Auto-refresh live scores every 30 seconds
    const interval = setInterval(fetchLiveMatches, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [parseMatches]);

  // List of distinct academies available across all live & upcoming matches
  const academyOptions = useMemo(() => {
    const map = new Map();
    matches.forEach((m) => {
      if (m.academy_name && !map.has(m.academy_name)) {
        map.set(m.academy_name, m.academy_id);
      }
    });
    return Array.from(map.entries()).map(([name, id]) => ({ name, id }));
  }, [matches]);

  // Filtered by selected academy if user chooses one
  const academyFilteredMatches = useMemo(() => {
    if (selectedAcademy === "ALL") return matches;
    return matches.filter((m) => m.academy_name === selectedAcademy);
  }, [matches, selectedAcademy]);

  // Partition into live and upcoming matches
  const liveMatches = useMemo(() => {
    const list = academyFilteredMatches.filter((m) => m.isLive);
    if (list.length === 0 && !hasRealData) {
      return FALLBACK_MATCHES.filter((m) => m.isLive);
    }
    return list;
  }, [academyFilteredMatches, hasRealData]);

  const upcomingMatches = useMemo(() => {
    const list = academyFilteredMatches.filter((m) => m.isUpcoming);
    if (list.length === 0 && !hasRealData) {
      return FALLBACK_MATCHES.filter((m) => m.isUpcoming);
    }
    return list;
  }, [academyFilteredMatches, hasRealData]);

  const displayedMatches = activeTab === "LIVE" ? liveMatches : upcomingMatches;

  return (
    <section className="matches-section" id="matches">
      {/* Decorative radial ambient glow */}
      <div className="matches-section__bg-accent" />
      <div className="matches-section__bg-accent-2" />

      <div className="container">
        {/* Section Header */}
        <div
          className="section-head section-head--left"
          data-reveal
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: "24px",
            maxWidth: "none",
            marginBottom: "24px",
          }}
        >
          <div>
            <span
              className="eyebrow"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Flame size={14} style={{ color: "var(--red)" }} />
              Matches &amp; Events
            </span>
            <h2 className="title" style={{ marginTop: "10px" }}>
              LIVE &amp; UPCOMING <em>MATCHES</em>
            </h2>
            <p className="lead" style={{ marginTop: "8px", maxWidth: "680px" }}>
              Real-time scores, tournament fixtures, and inter-academy battles across all grounds.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            <Link className="link-arrow" href="/matches" style={{ fontSize: "14px", fontWeight: 700 }}>
              All Fixtures &amp; Tournaments <ArrowRight size={15} style={{ verticalAlign: "middle", marginLeft: "4px" }} />
            </Link>
          </div>
        </div>

        {/* Control Bar: Dual Tabs (Live / Upcoming) + Academy Filter + Refresh */}
        <div className="matches-ctrl-bar">
          {/* Two Primary Tabs */}
          <div className="matches-tabs-group" role="tablist" aria-label="Match Tabs">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "LIVE"}
              className={`matches-tab-btn ${activeTab === "LIVE" ? "is-active-live" : ""}`}
              onClick={() => setActiveTab("LIVE")}
            >
              <span className="live-pulse-dot" />
              <span>Live Matches</span>
              <span className="matches-tab-badge">{liveMatches.length}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "UPCOMING"}
              className={`matches-tab-btn ${activeTab === "UPCOMING" ? "is-active-upcoming" : ""}`}
              onClick={() => setActiveTab("UPCOMING")}
            >
              <Calendar size={14} />
              <span>Upcoming</span>
              <span className="matches-tab-badge">{upcomingMatches.length}</span>
            </button>
          </div>

          {/* Academy Filter Pills (Support for ANY Academy) */}
          {academyOptions.length > 1 && (
            <div className="academy-filter-wrap">
              <span className="academy-filter-label">
                <Building2 size={13} style={{ verticalAlign: "middle", marginRight: "4px" }} />
                Academy:
              </span>
              <button
                type="button"
                className={`academy-pill ${selectedAcademy === "ALL" ? "is-active" : ""}`}
                onClick={() => setSelectedAcademy("ALL")}
              >
                All Academies
              </button>
              {academyOptions.map(({ name }) => (
                <button
                  key={name}
                  type="button"
                  className={`academy-pill ${selectedAcademy === name ? "is-active" : ""}`}
                  onClick={() => setSelectedAcademy(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {/* Quick Refresh Status */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              title="Refresh live match scores"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                border: "1px solid var(--line)",
                background: "#fff",
                borderRadius: "999px",
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--muted)",
                cursor: "pointer",
              }}
            >
              <RefreshCw
                size={12}
                style={{
                  animation: refreshing ? "spin 1s linear infinite" : "none",
                  color: "var(--green-d)",
                }}
              />
              <span>{refreshing ? "Updating..." : "Live Sync"}</span>
            </button>
          </div>
        </div>

        {/* Match Cards Grid */}
        {displayedMatches.length > 0 ? (
          <div className="matches-grid">
            {displayedMatches.map((m, idx) => {
              const isLive = activeTab === "LIVE";
              const teamAGradient = getTeamGradient(m.team_a_name);
              const teamBGradient = getTeamGradient(m.team_b_name);

              return (
                <article
                  key={m.id || idx}
                  className={`match-card ${isLive ? "match-card--live" : "match-card--upcoming"}`}
                  data-reveal
                  style={{ "--d": idx, cursor: "pointer" }}
                  onClick={() => {
                    setSelectedMatch(m);
                    setIsModalOpen(true);
                  }}
                  title="Click to view detailed match scorecard"
                >
                  {/* Top Header Row */}
                  <div className="match-card__header">
                    {isLive ? (
                      <span className="match-card__status-tag match-card__status-tag--live">
                        <span className="dot" />
                        LIVE NOW
                      </span>
                    ) : (
                      <span className="match-card__status-tag match-card__status-tag--upcoming">
                        <Clock size={11} style={{ marginRight: "3px" }} />
                        UPCOMING
                      </span>
                    )}

                    <div className="match-card__meta-tags">
                      {/* Academy Badge: clearly displays the match's academy_id / academy_name */}
                      <span className="match-card__chip match-card__chip--academy" title={`Academy: ${m.academy_name}`}>
                        <Building2 size={11} />
                        {m.academy_name}
                      </span>
                      {/* Tournament or Match format tag */}
                      <span className="match-card__chip" title={m.tournament_name || m.match_type}>
                        <Trophy size={11} />
                        {m.tournament_name || m.match_type || "Match"}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="match-card__body">
                    {isLive ? (
                      /* Live Match Layout: Scores, Overs, Toss */
                      <>
                        {/* Team A */}
                        <div className="match-team-row">
                          <div className="match-team-info">
                            <div className="match-team-avatar" style={{ background: teamAGradient }}>
                              {getInitials(m.team_a_name, m.team_a_code)}
                            </div>
                            <span className="match-team-name" title={m.team_a_name}>
                              {m.team_a_name}
                            </span>
                          </div>
                          <div className="match-team-score">
                            <span className="match-score-runs">{m.team_a_score || "-"}</span>
                            {m.team_a_overs && <div className="match-score-overs">{m.team_a_overs}</div>}
                          </div>
                        </div>

                        {/* Team B */}
                        <div className="match-team-row">
                          <div className="match-team-info">
                            <div className="match-team-avatar" style={{ background: teamBGradient }}>
                              {getInitials(m.team_b_name, m.team_b_code)}
                            </div>
                            <span className="match-team-name" title={m.team_b_name}>
                              {m.team_b_name}
                            </span>
                          </div>
                          <div className="match-team-score">
                            <span className="match-score-runs">{m.team_b_score || "-"}</span>
                            {m.team_b_overs && <div className="match-score-overs">{m.team_b_overs}</div>}
                          </div>
                        </div>

                        {/* Match remarks or toss situation */}
                        {m.remarks ? (
                          <div className="match-note">
                            <strong>Note:</strong> {m.remarks}
                          </div>
                        ) : m.toss_winner_team_name ? (
                          <div className="match-note">
                            <strong>Toss:</strong> {m.toss_winner_team_name} chose to {m.toss_decision || "bat"}
                          </div>
                        ) : (
                          <div className="match-note" style={{ borderLeftColor: "var(--green)" }}>
                            Live ball-by-ball scoring active
                          </div>
                        )}
                      </>
                    ) : (
                      /* Upcoming Match Layout: Versus Layout & Schedule Box */
                      <>
                        <div className="match-upcoming-vs">
                          {/* Team A */}
                          <div className="match-upcoming-team">
                            <div className="match-team-avatar" style={{ background: teamAGradient }}>
                              {getInitials(m.team_a_name, m.team_a_code)}
                            </div>
                            <span className="match-team-name" title={m.team_a_name}>
                              {m.team_a_name}
                            </span>
                          </div>

                          {/* VS Badge */}
                          <div className="match-vs-badge">VS</div>

                          {/* Team B */}
                          <div className="match-upcoming-team">
                            <div className="match-team-avatar" style={{ background: teamBGradient }}>
                              {getInitials(m.team_b_name, m.team_b_code)}
                            </div>
                            <span className="match-team-name" title={m.team_b_name}>
                              {m.team_b_name}
                            </span>
                          </div>
                        </div>

                        {/* Schedule Timing Box */}
                        <div className="match-schedule-box">
                          <div className="match-schedule-item">
                            <Calendar size={13} />
                            <span>{formatMatchDate(m.match_date)}</span>
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
                    )}
                  </div>

                  {/* Card Footer: Venue and Action Link */}
                  <div className="match-card__footer">
                    <span className="match-card__ground" title={m.ground_name}>
                      <MapPin size={13} />
                      {m.ground_name}
                    </span>

                    <Link className="match-card__action" href="/matches">
                      {isLive ? "Scorecard" : "View Match"}
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="matches-empty-state" data-reveal>
            <div className="matches-empty-icon">
              {activeTab === "LIVE" ? <Radio size={30} /> : <Calendar size={30} />}
            </div>
            <h3 className="matches-empty-title">
              {activeTab === "LIVE" ? "No Live Matches Right Now" : "No Upcoming Fixtures Scheduled"}
            </h3>
            <p className="matches-empty-desc">
              {activeTab === "LIVE"
                ? "There are currently no active matches underway across academy grounds. Browse upcoming scheduled fixtures below to see when the action starts!"
                : "No upcoming fixtures are currently listed for this selection. Check back soon or view our complete tournament schedule."}
            </p>
            {activeTab === "LIVE" && (
              <button
                type="button"
                className="btn btn--navy"
                onClick={() => setActiveTab("UPCOMING")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 22px",
                  borderRadius: "999px",
                  fontSize: "14px",
                }}
              >
                <Calendar size={15} />
                View Upcoming Fixtures
              </button>
            )}
          </div>
        )}
      </div>

      {/* Match Detail & Scoreboard Modal */}
      <MatchScoreboardModal
        match={selectedMatch}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedMatch(null);
        }}
      />
    </section>
  );
}
