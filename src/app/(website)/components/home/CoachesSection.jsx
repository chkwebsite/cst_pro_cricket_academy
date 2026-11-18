"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import Slider from "react-slick";
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
    academy: "CST Pro Cricket Academy",
    branch: "Main Campus",
    experience: 10,
    image: "/assets/img/about-2.jpg",
  },
  {
    id: 1,
    name: "Deepak Walia",
    role: "Batting & Fitness Coach",
    academy: "CST Pro Cricket Academy",
    branch: "Dhananjay Campus",
    experience: 15,
    image: "/assets/img/about-3.jpg",
  },
  {
    id: 3,
    name: "Amit Sharma",
    role: "Fast Bowling Specialist",
    academy: "Sports Mantra Cricket Academy",
    branch: "Match Ground",
    experience: 8,
    image: "/images/website/program-high-performance.jpg",
  },
  {
    id: 4,
    name: "Sanjay Verma",
    role: "Spin Bowling Mentor",
    academy: "Sports Mantra Cricket Academy",
    branch: "Sector 48 Campus",
    experience: 12,
    image: "/images/website/program-one-to-one.jpg",
  },
  {
    id: 5,
    name: "Manoj Rawat",
    role: "Fielding & High Performance",
    academy: "CST Pro Cricket Academy",
    branch: "South Campus",
    experience: 9,
    image: "/assets/img/about-2.jpg",
  },
];

export default function CoachesSection({
  tag = "Our Team",
  title = "LEARN FROM THE BEST",
}) {
  const [coaches, setCoaches] = useState(FALLBACK_COACHES);
  const sliderRef = useRef(null);

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

          // If less than 4, add fallbacks to ensure rich responsive slider
          if (mapped.length < 4) {
            const remaining = FALLBACK_COACHES.slice(mapped.length);
            setCoaches([...mapped, ...remaining]);
          } else {
            setCoaches(mapped);
          }
        }
      } catch (err) {
        console.error("Failed to load coaches for homepage:", err);
      }
    }
    loadCoaches();
    return () => {
      isMounted = false;
    };
  }, []);

  // Slick Slider Settings: 3 records on desktop, responsive across tablets and phones
  const sliderSettings = {
    dots: false,
    infinite: coaches.length > 3,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 4000,
    pauseOnHover: true,
    swipe: true,
    swipeToSlide: true,
    touchMove: true,
    touchThreshold: 10,
    arrows: false,
    adaptiveHeight: false,
    responsive: [
      {
        breakpoint: 992,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1,
          infinite: coaches.length > 2,
        },
      },
      {
        breakpoint: 640,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1,
          infinite: coaches.length > 1,
          dots: false,
        },
      },
    ],
  };

  return (
    <section className="section section--dark position-relative overflow-hidden" id="coaches">
      <div className="container">
        {/* Section Header with Responsive Slider Navigation */}
        <div
          className="section-head section-head--left mb-4"
          data-reveal
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "end",
            gap: "16px",
            maxWidth: "none",
          }}
        >
          <div style={{ flex: "1 1 280px" }}>
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
                onClick={() => sliderRef.current?.slickPrev()}
                className="btn btn-sm btn-outline-light rounded-circle d-flex align-items-center justify-content-center p-0"
                style={{ width: "36px", height: "36px", transition: "all 0.2s ease" }}
                aria-label="Previous Coaches"
                title="Previous Coaches"
              >
                <ChevronLeft size={18} />
              </button>

              <button
                type="button"
                onClick={() => sliderRef.current?.slickNext()}
                className="btn btn-sm btn-outline-light rounded-circle d-flex align-items-center justify-content-center p-0"
                style={{ width: "36px", height: "36px", transition: "all 0.2s ease" }}
                aria-label="Next Coaches"
                title="Next Coaches"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <Link className="btn btn--ghost btn--sm" href="/coaches">
              All Coaches →
            </Link>
          </div>
        </div>

        {/* Slick Slider Responsive Container */}
        <div className="cst-slider-wrapper">
          <Slider ref={sliderRef} {...sliderSettings}>
            {coaches.map((c, i) => {
              const numStr = String(i + 1).padStart(2, "0");

              return (
                <div key={c.id || i} className="h-100">
                  <article
                    className="coach h-100 position-relative"
                    style={{
                      minHeight: "420px",
                      borderRadius: "22px",
                      overflow: "hidden",
                    }}
                  >
                    <div className="media" style={{ background: "var(--navy)", overflow: "hidden", height: "100%" }}>
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
          </Slider>
        </div>
      </div>
    </section>
  );
}
