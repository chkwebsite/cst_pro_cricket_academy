"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";

const CATEGORIES = [
  { id: "all", label: "All Specialists" },
  { id: "batting", label: "Batting Coaches" },
  { id: "bowling", label: "Bowling Masters" },
  { id: "fitness", label: "Fitness & Fielding" },
];

export default function CoachesGridSection({
  tag = "Elite Coaches",
  title = "Our Coaching Panel",
  subtitle = "Learn from BCCI-certified mentors, former state cricketers, and high-performance coaches dedicated to taking your cricket skills to the highest level.",
  coaches: propCoaches = null,
}) {
  const [coaches, setCoaches] = useState(propCoaches || []);
  const [loading, setLoading] = useState(!propCoaches);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [failedImages, setFailedImages] = useState({});

  useEffect(() => {
    if (propCoaches && propCoaches.length > 0) {
      setCoaches(propCoaches);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const loadCoaches = async () => {
      try {
        const res = await fetch("/api/coaches?academy_id=1&status=1");
        const json = await res.json();
        if (res.ok && json.success && Array.isArray(json.data) && json.data.length > 0) {
          const mapped = json.data.map((c) => {
            const initials = (c.coach_name || "Coach")
              .split(" ")
              .filter(Boolean)
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();

            let role = "Cricket Coach";
            if (c.specialization) {
              const parts = c.specialization
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              if (parts.length > 0) {
                role = parts.slice(0, 2).join(" & ") + " Coach";
              }
            }

            return {
              id: c.id,
              initials: initials || "C",
              name: c.coach_name || "Cricket Coach",
              role,
              specialization: c.specialization || "",
              profile_image: c.profile_image || null,
              experience: c.experience_years ? Number(c.experience_years) : null,
              branch: c.branch_name || null,
              phone: c.phone || null,
              qualification: c.qualification || null,
            };
          });

          if (isMounted) {
            setCoaches(mapped);
          }
        }
      } catch (err) {
        console.error("Failed to load website coaches:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadCoaches();
    return () => {
      isMounted = false;
    };
  }, [propCoaches]);

  // Compute category counts
  const categoryCounts = useMemo(() => {
    const counts = { all: coaches.length, batting: 0, bowling: 0, fitness: 0 };
    coaches.forEach((c) => {
      const spec = ((c.specialization || "") + " " + (c.role || "")).toLowerCase();
      if (spec.includes("batting")) counts.batting++;
      if (spec.includes("bowling") || spec.includes("spin") || spec.includes("fast")) counts.bowling++;
      if (spec.includes("fitness") || spec.includes("fielding")) counts.fitness++;
    });
    return counts;
  }, [coaches]);

  // Filter coaches
  const filteredCoaches = useMemo(() => {
    return coaches.filter((c) => {
      const spec = ((c.specialization || "") + " " + (c.role || "")).toLowerCase();
      const name = (c.name || "").toLowerCase();

      // Category match
      let matchCat = true;
      if (activeCategory === "batting") {
        matchCat = spec.includes("batting");
      } else if (activeCategory === "bowling") {
        matchCat = spec.includes("bowling") || spec.includes("spin") || spec.includes("fast");
      } else if (activeCategory === "fitness") {
        matchCat = spec.includes("fitness") || spec.includes("fielding");
      }

      // Search match
      let matchSearch = true;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        matchSearch = name.includes(q) || spec.includes(q) || (c.branch && c.branch.toLowerCase().includes(q));
      }

      return matchCat && matchSearch;
    });
  }, [coaches, activeCategory, searchQuery]);

  return (
    <section className="team-section-dark">
      <div className="container">
        {/* Section Header */}
        <div className="text-center mb-4">
          <div className="team-tag-cyan mb-2">
            <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>—</span> {tag.toUpperCase()}
          </div>
          <h2 className="team-title text-center">
            OUR COACHING <span className="text-cyan">PANEL</span>
          </h2>
          <div className="team-title-bar mx-auto"></div>
          {subtitle && (
            <p className="text-light opacity-75 mt-3 mx-auto" style={{ maxWidth: "680px", fontSize: "0.95rem" }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Filter Pills Bar */}
        <div className="coach-filter-pills-bar">
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.id] ?? 0;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`coach-filter-pill ${isActive ? "active" : ""}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span>{cat.label}</span>
                <span className="coach-filter-count">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="row g-4 justify-content-center">
            {[1, 2, 3, 4].map((n) => (
              <div className="col-12 col-lg-6" key={`coach-skel-${n}`}>
                <div className="modern-coach-card placeholder-glow" style={{ minHeight: "228px" }}>
                  <div
                    className="placeholder rounded-4 opacity-25"
                    style={{
                      width: "140px",
                      height: "180px",
                      backgroundColor: "rgba(34, 211, 238, 0.2)",
                    }}
                  ></div>
                  <div className="modern-coach-info-area w-100 ps-2">
                    <span
                      className="placeholder col-4 rounded-pill opacity-25 mb-3"
                      style={{ height: "24px", backgroundColor: "#e11d48" }}
                    ></span>
                    <span
                      className="placeholder col-8 rounded opacity-25 mb-3"
                      style={{ height: "30px", backgroundColor: "#ffffff" }}
                    ></span>
                    <span
                      className="placeholder col-5 rounded-pill opacity-25"
                      style={{ height: "38px", backgroundColor: "#e11d48" }}
                    ></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredCoaches.length === 0 ? (
          <div className="text-center py-5">
            <div
              className="p-5 rounded-4 mx-auto"
              style={{
                maxWidth: "520px",
                background: "rgba(6, 29, 33, 0.6)",
                border: "1px dashed rgba(34, 211, 238, 0.25)",
              }}
            >
              <i className="bi bi-people text-cyan" style={{ fontSize: "2.6rem" }}></i>
              <h4 className="text-white mt-3">No Coaches Found</h4>
              <p className="text-light opacity-75 small mb-3">
                No coaching staff currently listed in this category.
              </p>
              <button
                type="button"
                className="coach-filter-pill active"
                onClick={() => {
                  setActiveCategory("all");
                  setSearchQuery("");
                }}
              >
                View All Coaches
              </button>
            </div>
          </div>
        ) : (
          <div className="row g-4 justify-content-center">
            {filteredCoaches.map((c, idx) => {
              const numStr = String(idx + 1).padStart(2, "0");
              const hasImg = c.profile_image && !failedImages[c.id];

              return (
                <div className="col-12 col-lg-6" key={c.id || idx}>
                  <div className="modern-coach-card">
                    {/* Watermark number (01, 02, etc.) */}
                    <span className="modern-coach-watermark">{numStr}</span>

                    {/* Left Photo box */}
                    <div className="modern-coach-photo-box">
                      {hasImg ? (
                        <img
                          src={c.profile_image}
                          alt={c.name}
                          className="modern-coach-photo-img"
                          onError={() => {
                            setFailedImages((prev) => ({
                              ...prev,
                              [c.id]: true,
                            }));
                          }}
                        />
                      ) : (
                        <>
                          <span className="modern-coach-initials">{c.initials}</span>
                          <span className="modern-coach-photo-label">PHOTO</span>
                        </>
                      )}
                    </div>

                    {/* Right Info Area */}
                    <div className="modern-coach-info-area">
                      <span className="modern-coach-role-badge">
                        {c.role}
                      </span>
                      <h3 className="modern-coach-name">
                        {c.name}
                      </h3>

                      {/* Meta chips (experience / branch) */}
                      <div className="coach-meta-chips">
                        {c.experience && (
                          <span className="coach-meta-chip">
                            <i className="bi bi-award"></i> {c.experience}+ Yrs Exp
                          </span>
                        )}
                        {c.branch && (
                          <span className="coach-meta-chip">
                            <i className="bi bi-geo-alt"></i> {c.branch}
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="d-flex align-items-center gap-2 mt-1">
                        <Link
                          href={`/coaches/${c.id}`}
                          className="btn-coach-view-profile"
                        >
                          View Profile <i className="bi bi-arrow-right"></i>
                        </Link>

                        {c.phone && (
                          <a
                            href={`tel:${c.phone}`}
                            className="btn-coach-call"
                            title={`Call ${c.name}`}
                          >
                            <i className="bi bi-telephone-fill"></i>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
