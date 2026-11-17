"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Award, MapPin, ArrowRight } from "lucide-react";

const REAL_COACH_FALLBACKS = [
  "/assets/img/about-2.jpg",
  "/assets/img/about-3.jpg",
  "/images/website/program-one-to-one.jpg",
  "/images/website/program-high-performance.jpg",
];

function resolveCoachImage(c, idx) {
  const img = c.profile_image || c.image || c.image_path;
  if (img && typeof img === "string" && img.trim() && !img.endsWith(".svg")) {
    const clean = img.trim();
    if (clean.startsWith("http://") || clean.startsWith("https://") || clean.startsWith("/")) {
      return clean;
    }
    return `/images/uploads/users/${clean}`;
  }
  return REAL_COACH_FALLBACKS[idx % REAL_COACH_FALLBACKS.length];
}

const FALLBACK_COACHES = [
  {
    id: 2,
    name: "Rajneesh Kumar",
    role: "Head Batting Coach",
    academy: "CST pro Cricket Academy",
    branch: "Main Campus",
    experience: 10,
    image: "/assets/img/about-2.jpg",
  },
  {
    id: 1,
    name: "Deepak Walia",
    role: "Batting & Fitness Coach",
    academy: "CST pro Cricket Academy",
    branch: "Dhananjay Campus",
    experience: 15,
    image: "/assets/img/about-3.jpg",
  },
];

export default function CoachesSection({
  tag = "Our Team",
  title = "LEARN FROM THE BEST",
}) {
  const [coaches, setCoaches] = useState(FALLBACK_COACHES);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadCoaches() {
      try {
        // Fetch active coaches across all academies
        const res = await fetch("/api/coaches?status=1");
        if (!res.ok) return;
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data) && json.data.length > 0) {
          const mapped = json.data.map((c, idx) => {
            const name =
              c.coach_name ||
              [c.first_name, c.last_name].filter(Boolean).join(" ") ||
              c.name ||
              "Senior Coach";

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
              name,
              role,
              academy: c.academy_name || "Cricket Academy",
              branch: c.branch_name || "",
              experience: c.experience_years ? Number(c.experience_years) : null,
              image: resolveCoachImage(c, idx),
            };
          });
          setCoaches(mapped);
        }
      } catch (err) {
        console.error("Failed to load coaches for homepage:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadCoaches();
    return () => {
      isMounted = false;
    };
  }, []);

  // Split coaches into pairs (2 profiles per slide)
  const slides = [];
  for (let i = 0; i < coaches.length; i += 2) {
    slides.push(coaches.slice(i, i + 2));
  }
  const totalSlides = Math.max(1, slides.length);

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  };

  const currentPair = slides[currentSlide] || [];

  return (
    <section className="section section--dark position-relative overflow-hidden" id="coaches">
      <div className="container">
        {/* Section Header with Slider Navigation */}
        <div
          className="section-head section-head--left mb-4"
          data-reveal
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "end",
            gap: "20px",
            maxWidth: "none",
          }}
        >
          <div>
            <span className="eyebrow">{tag}</span>
            <h2 className="title mb-0">
              LEARN FROM THE <em>BEST</em>
            </h2>
          </div>

          {/* Slider Prev / Next Controls & All Coaches Link */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="d-flex align-items-center gap-2 bg-dark bg-opacity-50 p-1 px-2 rounded-pill border border-secondary border-opacity-25">
              <button
                type="button"
                onClick={handlePrev}
                disabled={totalSlides <= 1}
                className="btn btn-sm btn-outline-light rounded-circle d-flex align-items-center justify-content-center p-0"
                style={{ width: "36px", height: "36px", transition: "all 0.2s ease" }}
                aria-label="Previous Coaches"
                title="Previous Coaches"
              >
                <ChevronLeft size={18} />
              </button>

              <span className="text-white small fw-bold px-2 user-select-none">
                {currentSlide + 1} / {totalSlides}
              </span>

              <button
                type="button"
                onClick={handleNext}
                disabled={totalSlides <= 1}
                className="btn btn-sm btn-outline-light rounded-circle d-flex align-items-center justify-content-center p-0"
                style={{ width: "36px", height: "36px", transition: "all 0.2s ease" }}
                aria-label="Next Coaches"
                title="Next Coaches"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <Link className="btn btn--ghost btn--sm ms-md-2" href="/coaches">
              All Coaches →
            </Link>
          </div>
        </div>

        {/* Slider Row - 2 Profiles in a Row */}
        <div className="row g-4 align-items-stretch" key={currentSlide}>
          {currentPair.map((c, i) => {
            const overallIndex = currentSlide * 2 + i + 1;
            const numStr = String(overallIndex).padStart(2, "0");

            return (
              <div className="col-12 col-md-6" key={c.id || i}>
                <article
                  className="coach h-100 position-relative"
                  style={{
                    animation: "fadeInCoach 0.35s ease-in-out",
                    minHeight: "440px",
                  }}
                >
                  <div className="media" style={{ background: "var(--navy)", overflow: "hidden" }}>
                    <img
                      src={c.image}
                      alt={c.name}
                      loading="lazy"
                      width="800"
                      height="600"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => {
                        e.currentTarget.src =
                          i % 2 === 0 ? "/assets/img/about-2.jpg" : "/assets/img/about-3.jpg";
                      }}
                    />
                  </div>

                  {/* Watermark Coach Number */}
                  <span className="coach__no">{numStr}</span>

                  {/* Coach Info Overlay */}
                  <div className="coach__info">
                    <div className="d-flex align-items-center justify-content-between gap-2 mb-1 flex-wrap">
                      <small className="fw-bold" style={{ color: "var(--lime, #b6ff00)" }}>
                        {c.role}
                      </small>
                      {c.experience && (
                        <span
                          className="badge bg-dark bg-opacity-75 text-light small border border-secondary border-opacity-25"
                          style={{ fontSize: "0.75rem" }}
                        >
                          <Award size={12} className="me-1 text-warning" />
                          {c.experience}+ Yrs Exp
                        </span>
                      )}
                    </div>

                    <h3 className="text-white mb-2">{c.name}</h3>

                    {/* Academy & Branch Information Badge */}
                    <div className="d-flex align-items-center gap-2 mb-3 text-white-50 small flex-wrap">
                      <span className="d-flex align-items-center gap-1">
                        <MapPin size={13} style={{ color: "var(--red, #e10600)" }} />
                        <strong className="text-light">{c.academy}</strong>
                      </span>
                      {c.branch && (
                        <span className="text-white-50">· {c.branch}</span>
                      )}
                    </div>

                    <Link
                      className="btn btn--red btn--sm d-inline-flex align-items-center gap-2"
                      href={c.id ? `/coaches?coach_id=${c.id}` : "/coaches"}
                    >
                      <span>View Detail</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </article>
              </div>
            );
          })}
        </div>

        {/* Slide Indicator Dots */}
        {totalSlides > 1 && (
          <div className="d-flex justify-content-center align-items-center gap-2 mt-4">
            {slides.map((_, dotIdx) => (
              <button
                key={dotIdx}
                type="button"
                onClick={() => setCurrentSlide(dotIdx)}
                className="border-0 p-0 rounded-pill transition-all"
                style={{
                  width: currentSlide === dotIdx ? "32px" : "10px",
                  height: "8px",
                  background: currentSlide === dotIdx ? "var(--red, #e10600)" : "rgba(255,255,255,0.25)",
                  transition: "all 0.3s ease",
                  cursor: "pointer",
                }}
                aria-label={`Go to slide ${dotIdx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeInCoach {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
}
