"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Award,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  GraduationCap,
  MapPin,
  Phone,
  Sparkles,
  User,
  X,
  ArrowRight,
} from "lucide-react";

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
  const searchParams = useSearchParams();
  const queryCoachId = searchParams.get("coach_id") || searchParams.get("id") || "";

  const [coaches, setCoaches] = useState(propCoaches || []);
  const [loading, setLoading] = useState(!propCoaches);
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedAcademyFilter, setSelectedAcademyFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [failedImages, setFailedImages] = useState({});

  // Active coach for Detail Modal
  const [modalCoach, setModalCoach] = useState(null);

  // Load active coaches across all academies
  useEffect(() => {
    if (propCoaches && propCoaches.length > 0) {
      setCoaches(propCoaches);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const loadCoaches = async () => {
      try {
        // Fetch all active coaches from all academies
        const res = await fetch("/api/coaches?status=1");
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
            } else if (c.designation) {
              role = c.designation;
            } else if (c.qualification) {
              role = `${c.qualification} Coach`;
            }

            return {
              id: c.id,
              initials: initials || "C",
              name: c.coach_name || "Cricket Coach",
              role,
              specialization: c.specialization || "",
              profile_image: c.profile_image || null,
              experience: c.experience_years ? Number(c.experience_years) : null,
              academy_id: c.academy_id || null,
              academy: c.academy_name || "Cricket Academy",
              branch_id: c.branch_id || null,
              branch: c.branch_name || null,
              phone: c.phone || null,
              email: c.email || null,
              qualification: c.qualification || null,
              certifications: c.certifications || null,
              bio: c.bio || null,
              coach_code: c.coach_code || null,
              employment_type: c.employment_type || null,
            };
          });

          if (isMounted) {
            setCoaches(mapped);

            // Auto-open modal if coach_id is present in URL
            if (queryCoachId) {
              const target = mapped.find((item) => String(item.id) === String(queryCoachId));
              if (target) {
                setModalCoach(target);
              }
            }
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
  }, [propCoaches, queryCoachId]);

  // Extract unique academies for academy filter
  const academiesList = useMemo(() => {
    const map = new Map();
    coaches.forEach((c) => {
      if (c.academy_id && c.academy) {
        map.set(String(c.academy_id), c.academy);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [coaches]);

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

  // Filter coaches by category, academy, and search query
  const filteredCoaches = useMemo(() => {
    return coaches.filter((c) => {
      const spec = ((c.specialization || "") + " " + (c.role || "")).toLowerCase();
      const name = (c.name || "").toLowerCase();
      const academyName = (c.academy || "").toLowerCase();
      const branchName = (c.branch || "").toLowerCase();

      // Category match
      let matchCat = true;
      if (activeCategory === "batting") {
        matchCat = spec.includes("batting");
      } else if (activeCategory === "bowling") {
        matchCat = spec.includes("bowling") || spec.includes("spin") || spec.includes("fast");
      } else if (activeCategory === "fitness") {
        matchCat = spec.includes("fitness") || spec.includes("fielding");
      }

      // Academy match
      let matchAcademy = true;
      if (selectedAcademyFilter !== "all") {
        matchAcademy = String(c.academy_id) === String(selectedAcademyFilter);
      }

      // Search match
      let matchSearch = true;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        matchSearch =
          name.includes(q) ||
          spec.includes(q) ||
          academyName.includes(q) ||
          branchName.includes(q);
      }

      return matchCat && matchAcademy && matchSearch;
    });
  }, [coaches, activeCategory, selectedAcademyFilter, searchQuery]);

  return (
    <section className="team-section-dark position-relative">
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

        {/* Filter Controls: Academy Filter & Specialization Filter */}
        <div className="d-flex flex-wrap justify-content-center align-items-center gap-3 mb-4">
          {/* Academy Selector if multiple academies exist */}
          {academiesList.length > 1 && (
            <div className="d-flex align-items-center gap-2 bg-dark bg-opacity-75 px-3 py-2 rounded-pill border border-secondary border-opacity-25">
              <Building2 size={16} className="text-cyan" />
              <select
                className="form-select form-select-sm bg-transparent text-white border-0 py-0 shadow-none"
                style={{ cursor: "pointer", minWidth: "160px" }}
                value={selectedAcademyFilter}
                onChange={(e) => setSelectedAcademyFilter(e.target.value)}
              >
                <option value="all" className="bg-dark text-white">All Academies</option>
                {academiesList.map((a) => (
                  <option key={a.id} value={a.id} className="bg-dark text-white">
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search Box */}
          <div
            className="d-flex align-items-center gap-2 bg-dark bg-opacity-75 px-3 py-2 rounded-pill border border-secondary border-opacity-25"
            style={{ minWidth: "220px" }}
          >
            <i className="bi bi-search text-cyan"></i>
            <input
              type="text"
              placeholder="Search coach by name or skill..."
              className="bg-transparent border-0 text-white small w-100"
              style={{ outline: "none" }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="btn btn-link text-white-50 p-0 text-decoration-none"
                onClick={() => setSearchQuery("")}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Category Pills Bar */}
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
                No coaching staff currently match your filter criteria.
              </p>
              <button
                type="button"
                className="coach-filter-pill active"
                onClick={() => {
                  setActiveCategory("all");
                  setSelectedAcademyFilter("all");
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
                  <div
                    className="modern-coach-card"
                    style={{ cursor: "pointer" }}
                    onClick={() => setModalCoach(c)}
                  >
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

                      {/* Academy & Branch Tag */}
                      <div className="small text-white-50 mb-2 d-flex align-items-center gap-1 flex-wrap">
                        <MapPin size={13} className="text-cyan" />
                        <strong className="text-light">{c.academy}</strong>
                        {c.branch && <span className="opacity-75">· {c.branch}</span>}
                      </div>

                      {/* Meta chips (experience / qualification) */}
                      <div className="coach-meta-chips">
                        {c.experience && (
                          <span className="coach-meta-chip">
                            <i className="bi bi-award"></i> {c.experience}+ Yrs Exp
                          </span>
                        )}
                        {c.qualification && (
                          <span className="coach-meta-chip">
                            <i className="bi bi-mortarboard"></i> {c.qualification}
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div
                        className="d-flex align-items-center gap-2 mt-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="btn-coach-view-profile"
                          onClick={() => setModalCoach(c)}
                        >
                          View Detail <i className="bi bi-arrow-right"></i>
                        </button>

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

      {/* COACH DETAIL MODAL - Displays full coach details on profile click */}
      {modalCoach && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{
            backgroundColor: "rgba(6, 20, 27, 0.85)",
            backdropFilter: "blur(8px)",
            zIndex: 99999,
            animation: "fadeIn 0.2s ease-in-out",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalCoach(null);
          }}
        >
          <div
            className="bg-white rounded-4 shadow-lg overflow-hidden position-relative text-dark"
            style={{
              width: "100%",
              maxWidth: "680px",
              maxHeight: "90vh",
              overflowY: "auto",
              animation: "scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Modal Header */}
            <div
              className="p-4 text-white position-relative"
              style={{
                background: "linear-gradient(135deg, #062f38 0%, #0d4b57 100%)",
                borderBottom: "3px solid var(--red, #e10600)",
              }}
            >
              <button
                type="button"
                onClick={() => setModalCoach(null)}
                aria-label="Close modal"
                className="btn-close btn-close-white position-absolute top-0 end-0 m-3"
              />

              <div className="d-flex align-items-center gap-3">
                <div
                  className="rounded-circle overflow-hidden flex-shrink-0 d-flex align-items-center justify-content-center"
                  style={{
                    width: "72px",
                    height: "72px",
                    background: "rgba(255,255,255,0.15)",
                    border: "2px solid var(--lime, #b6ff00)",
                  }}
                >
                  {modalCoach.profile_image && !failedImages[modalCoach.id] ? (
                    <img
                      src={modalCoach.profile_image}
                      alt={modalCoach.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span className="fs-3 fw-bold font-oswald text-white">
                      {modalCoach.initials}
                    </span>
                  )}
                </div>

                <div>
                  <span
                    className="badge text-uppercase fw-bold mb-1"
                    style={{ background: "var(--red, #e10600)", color: "#fff" }}
                  >
                    {modalCoach.role}
                  </span>
                  <h3 className="fw-bold mb-1 font-oswald text-white text-uppercase">
                    {modalCoach.name}
                  </h3>
                  <div className="small text-white-50 d-flex align-items-center gap-2 flex-wrap">
                    <span className="d-flex align-items-center gap-1 text-light">
                      <Building2 size={14} className="text-warning" />
                      {modalCoach.academy}
                    </span>
                    {modalCoach.branch && (
                      <span className="text-white-50">· 📍 {modalCoach.branch}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Body: Coach Highlights & Profile Details */}
            <div className="p-4">
              {/* Highlight Cards Grid */}
              <div className="row g-3 mb-4">
                <div className="col-sm-6 col-6">
                  <div className="p-3 rounded-3 bg-light border h-100">
                    <div className="d-flex align-items-center gap-2 text-danger small fw-bold mb-1">
                      <Award size={16} />
                      <span>Experience</span>
                    </div>
                    <div className="fs-5 fw-bold text-dark">
                      {modalCoach.experience ? `${modalCoach.experience}+ Years` : "Senior Coach"}
                    </div>
                    <small className="text-muted">High-performance training</small>
                  </div>
                </div>

                <div className="col-sm-6 col-6">
                  <div className="p-3 rounded-3 bg-light border h-100">
                    <div className="d-flex align-items-center gap-2 text-primary small fw-bold mb-1">
                      <GraduationCap size={16} />
                      <span>Qualification</span>
                    </div>
                    <div className="fs-5 fw-bold text-dark">
                      {modalCoach.qualification || "Certified Coach"}
                    </div>
                    <small className="text-muted">Cricket Board Certified</small>
                  </div>
                </div>
              </div>

              {/* Specializations */}
              {modalCoach.specialization && (
                <div className="mb-4">
                  <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                    <Sparkles size={16} className="text-danger" />
                    <span>Specialization & Core Disciplines</span>
                  </h6>
                  <div className="d-flex flex-wrap gap-2">
                    {modalCoach.specialization.split(",").map((spec, i) => (
                      <span
                        key={i}
                        className="badge px-3 py-2 rounded-pill fw-semibold"
                        style={{
                          background: "#e8f5e9",
                          color: "#1b5e20",
                          border: "1px solid #c8e6c9",
                          fontSize: "0.85rem",
                        }}
                      >
                        ✓ {spec.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Certifications (if any) */}
              {modalCoach.certifications && (
                <div className="mb-4">
                  <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                    <Award size={16} className="text-primary" />
                    <span>Accreditations & Certifications</span>
                  </h6>
                  <p className="text-secondary small mb-0 bg-light p-3 rounded-3 border">
                    {modalCoach.certifications}
                  </p>
                </div>
              )}

              {/* Bio & Coaching Philosophy */}
              <div className="mb-4">
                <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                  <BookOpen size={16} className="text-danger" />
                  <span>About & Coaching Philosophy</span>
                </h6>
                <p className="text-secondary mb-0" style={{ lineHeight: "1.7", fontSize: "0.95rem" }}>
                  {modalCoach.bio ||
                    `${modalCoach.name} is a dedicated high-performance cricket coach at ${modalCoach.academy}, mentoring aspiring junior and senior cricketers in modern batting, bowling, match temperament, and athletic fitness.`}
                </p>
              </div>

              {/* Action Buttons: Book Trial & Close */}
              <div className="d-flex justify-content-between align-items-center pt-3 border-top flex-wrap gap-2">
                <Link
                  href={`/coaches/${modalCoach.id}`}
                  className="btn btn-outline-dark px-3 rounded-pill btn-sm"
                  onClick={() => setModalCoach(null)}
                >
                  Full Profile Page
                </Link>

                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary px-3 rounded-pill"
                    onClick={() => setModalCoach(null)}
                  >
                    Close
                  </button>
                  <Link
                    href={`/book-free-trial?academy_id=${modalCoach.academy_id || 1}&branch_id=${modalCoach.branch_id || ""}`}
                    className="btn btn--red d-inline-flex align-items-center gap-2 px-4 rounded-pill fw-bold text-white text-decoration-none shadow-sm"
                    style={{ background: "var(--red, #e10600)" }}
                    onClick={() => setModalCoach(null)}
                  >
                    <span>Book Free Trial</span>
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes scaleIn {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </section>
  );
}
