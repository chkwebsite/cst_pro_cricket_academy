"use client";

import { useEffect, useState, useMemo } from "react";
import PageHeader from "../components/layout/PageHeader";
import CtaSection from "../components/home/CtaSection";

const TOURNAMENTS = [
  { name: "CST Champions Trophy", format: "T20 · League + Knockout", dates: "Apr 10 – Apr 25", status: "Entries Open", statusStyle: "tag" },
  { name: "Junior Cricket League (U-14)", format: "40 Overs", dates: "May 5 – May 20", status: "Upcoming", statusStyle: "tag" },
  { name: "Gurugram Corporate Cup", format: "T20 Floodlight", dates: "Ongoing (Weekends)", status: "Active", statusStyle: "tag", customTagStyle: { background: "#FDE6EA", color: "var(--red)" } },
  { name: "Inter-Academy Summer Cup", format: "50 Overs State Level", dates: "June 2 – June 18", status: "Registration Soon", statusStyle: "tag" },
];

const FALLBACK_MATCHES = [
  {
    id: 1,
    status: "LIVE",
    team_a: "CST Warriors",
    team_a_score: "186/4 (17.2)",
    team_b: "Apex Titans",
    team_b_score: "142/8",
    venue: "Main Ground · Live Now",
    type: "live",
  },
  {
    id: 2,
    status: "UPCOMING",
    team_a: "CST XI",
    team_b: "Gurugram Lions",
    venue: "Turf Oval 1 · This Saturday, 8:30 AM",
    type: "up",
  },
  {
    id: 3,
    status: "RECENT RESULT",
    team_a: "CST Academy",
    team_b: "Delhi Stars",
    result: "Won by 4 wkts",
    venue: "Campus Arena · Yesterday",
    type: "recent",
  },
];

export default function MatchesPage() {
  const [matches, setMatches] = useState(FALLBACK_MATCHES);
  const [filterTab, setFilterTab] = useState("ALL");

  useEffect(() => {
    let isMounted = true;
    async function fetchMatches() {
      try {
        const res = await fetch("/api/matches");
        if (!res.ok) return;
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data) && json.data.length > 0) {
          const mapped = json.data.map((m) => {
            const rawStatus = (m.status || "").toLowerCase();
            const isLive = rawStatus === "live" || rawStatus === "in progress";
            const isCompleted = rawStatus === "completed";
            return {
              id: m.id,
              status: isLive ? "LIVE" : isCompleted ? "RECENT RESULT" : "UPCOMING",
              type: isLive ? "live" : isCompleted ? "recent" : "up",
              team_a: m.team_a_name || "Team A",
              team_a_score: m.team_a_score || "-",
              team_b: m.team_b_name || "Team B",
              team_b_score: m.team_b_score || "-",
              result: m.result_note,
              venue: `${m.ground_name || "Academy Ground"} · ${m.match_date || "Upcoming"}`,
            };
          });
          setMatches(mapped);
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

  return (
    <>
      <PageHeader
        title="Live Matches &amp; Fixtures"
        eyebrow="Matches &amp; Events"
        breadcrumbs={[{ label: "Home", href: "/" }]}
        current="Matches &amp; Events"
      />

      {/* Match Cards Grid */}
      <section className="section">
        <div className="container">
          <div className="section-head" data-reveal>
            <span className="eyebrow">On the pitch</span>
            <h2 className="title">
              LIVE &amp; <em>UPCOMING</em>
            </h2>
          </div>

          {/* Filter Pills */}
          <div className="filters" role="group" aria-label="Match filters">
            {["ALL", "LIVE", "UPCOMING", "RESULTS"].map((f) => (
              <button
                key={f}
                type="button"
                className={`filter ${filterTab === f ? "is-active" : ""}`}
                onClick={() => setFilterTab(f)}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="grid grid--3">
            {filteredMatches.map((m, idx) => {
              const isLive = m.type === "live";
              const isUp = m.type === "up";

              return (
                <article
                  key={m.id || idx}
                  className={`card match ${isLive ? "match--live" : isUp ? "match--up" : ""}`}
                  data-reveal
                  style={{ "--d": idx }}
                >
                  <span
                    className="match__status"
                    style={{ color: isUp ? "var(--green-d)" : undefined }}
                  >
                    {m.status}
                  </span>

                  {isLive ? (
                    <>
                      <div className="match__row">
                        <span>
                          <i></i>
                          {m.team_a}
                        </span>
                        <span style={{ fontSize: "22px" }}>{m.team_a_score}</span>
                      </div>
                      <div className="match__row">
                        <span>
                          <i></i>
                          {m.team_b}
                        </span>
                        <span style={{ fontSize: "22px" }}>{m.team_b_score}</span>
                      </div>
                    </>
                  ) : isUp ? (
                    <div className="match__row">
                      <span>
                        <i></i>
                        {m.team_a}
                      </span>
                      <span style={{ color: "var(--muted)", fontSize: "14px" }}>vs</span>
                      <span>
                        {m.team_b}
                        <i style={{ margin: "0 0 0 10px" }}></i>
                      </span>
                    </div>
                  ) : (
                    <div className="match__row">
                      <span>
                        <i></i>
                        {m.team_a}
                      </span>
                      <span style={{ color: "var(--muted)", fontSize: "14px" }}>
                        {m.result || "Completed"}
                      </span>
                      <span>
                        {m.team_b}
                        <i style={{ margin: "0 0 0 10px" }}></i>
                      </span>
                    </div>
                  )}

                  <div className="match__foot">{m.venue}</div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Tournaments & Leagues Section */}
      <section className="section section--cream" id="tournaments">
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
    </>
  );
}
