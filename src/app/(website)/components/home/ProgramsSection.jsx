"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import Slider from "react-slick";
import { ChevronLeft, ChevronRight, ArrowRight, MapPin, Sparkles } from "lucide-react";

const REAL_PROGRAM_FALLBACKS = [
  "/images/uploads/programs/program_1792399774106_508752.jpg",
  "/images/uploads/programs/program_1792403752607_500119.png",
  "/images/uploads/programs/program_1792403863372_287868.png",
  "/images/uploads/programs/program_1792403990418_65968.png",
  "/images/website/program-high-performance.jpg",
  "/images/website/program-one-to-one.jpg",
  "/images/website/program-small-group.jpg",
];

function resolveProgramImage(p, idx) {
  const img = p.program_image || p.image;
  if (img && typeof img === "string" && img.trim() && !img.endsWith(".svg")) {
    const clean = img.trim();
    if (clean.startsWith("http://") || clean.startsWith("https://") || clean.startsWith("/")) {
      return clean;
    }
    return `/images/uploads/programs/${clean}`;
  }
  return REAL_PROGRAM_FALLBACKS[idx % REAL_PROGRAM_FALLBACKS.length];
}

const FALLBACK_PROGRAMS = [
  {
    id: 1,
    title: "Junior Cricket Program",
    code: "CST-JNR",
    academy: "CST Pro Cricket Academy",
    branch: "Main Campus",
    desc: "Cricket training designed for young players with foundational batting and bowling skills.",
    image: "/images/uploads/programs/program_1792399774106_508752.jpg",
    price: "₹1,500",
    unit: "/ mo",
    badge: "",
  },
  {
    id: 2,
    title: "Beginner Cricket Training",
    code: "CST-BEG",
    academy: "CST Pro Cricket Academy",
    branch: "Dhananjay Campus",
    desc: "Learn basic cricket skills, grip, stance, footwork and rules under coach supervision.",
    image: "/images/uploads/programs/program_1792403752607_500119.png",
    price: "₹1,500",
    unit: "/ mo",
    badge: "badge--navy",
  },
  {
    id: 3,
    title: "Residential Academy",
    code: "CST-RES",
    academy: "Sports Mantra Cricket Academy",
    branch: "Match Ground",
    desc: "Full-immersion live-in training experience with hostel accommodation and nutrition.",
    image: "/images/uploads/programs/program_1792403863372_287868.png",
    price: "₹20,000",
    unit: "/ mo",
    badge: "",
  },
  {
    id: 4,
    title: "Day Mini Camp",
    code: "CST-CMP",
    academy: "CST Pro Cricket Academy",
    branch: "Main Campus",
    desc: "Intensive high-performance camp with match practice, fitness drills, and game tactical theory.",
    image: "/images/uploads/programs/program_1792403990418_65968.png",
    price: "₹5,500",
    unit: "/ camp",
    badge: "badge--navy",
  },
  {
    id: 5,
    title: "High Performance Elite Batch",
    code: "CST-ELT",
    academy: "Sports Mantra Cricket Academy",
    branch: "Match Arena",
    desc: "BCCI coach led advanced masterclasses, video analysis, and competitive tournament prep.",
    image: "/images/website/program-high-performance.jpg",
    price: "₹3,500",
    unit: "/ mo",
    badge: "",
  },
  {
    id: 6,
    title: "1-on-1 Specialist Coaching",
    code: "CST-1ON1",
    academy: "CST Pro Cricket Academy",
    branch: "All Campuses",
    desc: "Personalized batting technique correction and bowling biomechanics assessment.",
    image: "/images/website/program-one-to-one.jpg",
    price: "₹4,000",
    unit: "/ mo",
    badge: "badge--navy",
  },
];

export default function ProgramsSection({
  tag = "Coaching Programs",
  title = "FIND YOUR PERFECT TRAINING PROGRAM",
  actionText = "Compare All Programs & Fees",
  actionLink = "/programs",
}) {
  const [programs, setPrograms] = useState(FALLBACK_PROGRAMS);
  const sliderRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPrograms() {
      try {
        // Fetch all active programs across all academies
        const res = await fetch("/api/programs?status=1");
        if (!res.ok) return;
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data) && json.data.length > 0) {
          const mapped = json.data.map((p, idx) => ({
            id: p.id,
            title: p.program_name,
            code: p.program_code || `PRG-${String(idx + 1).padStart(3, "0")}`,
            academy: p.academy_name || "Cricket Academy",
            branch: p.branch_name || "",
            desc: p.description || p.short_description || "High-performance structured cricket coaching.",
            image: resolveProgramImage(p, idx),
            price: p.program_fee ? `₹${Number(p.program_fee).toLocaleString("en-IN")}` : "₹1,500",
            unit: "/ mo",
            badge: idx % 2 === 1 ? "badge--navy" : "",
          }));

          // Supplement with fallbacks if fewer than 4 to keep slick slider smooth
          if (mapped.length < 4) {
            const remaining = FALLBACK_PROGRAMS.slice(mapped.length);
            setPrograms([...mapped, ...remaining]);
          } else {
            setPrograms(mapped);
          }
        }
      } catch (err) {
        // Fallback already in place
      }
    }

    loadPrograms();
    return () => {
      isMounted = false;
    };
  }, []);

  // Slick Slider Settings: 4 records on desktop, fully responsive on tablets & mobile
  const sliderSettings = {
    dots: false,
    infinite: programs.length > 4,
    speed: 500,
    slidesToShow: 4,
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
        breakpoint: 1200,
        settings: {
          slidesToShow: 3,
          slidesToScroll: 1,
          infinite: programs.length > 3,
        },
      },
      {
        breakpoint: 992,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1,
          infinite: programs.length > 2,
        },
      },
      {
        breakpoint: 576,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1,
          infinite: programs.length > 1,
          dots: false,
        },
      },
    ],
  };

  return (
    <section className="section section--cream position-relative overflow-hidden" id="programs">
      <div className="container">
        {/* Section Header with Responsive Navigation Controls */}
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
              FIND YOUR PERFECT <em>TRAINING PROGRAM</em>
            </h2>
          </div>

          {/* Slider Prev / Next Controls & Link */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="d-flex align-items-center gap-2 bg-white p-1 px-2 rounded-pill shadow-sm border">
              <button
                type="button"
                onClick={() => sliderRef.current?.slickPrev()}
                className="btn btn-sm btn-outline-secondary rounded-circle d-flex align-items-center justify-content-center p-0"
                style={{ width: "36px", height: "36px", transition: "all 0.2s ease" }}
                aria-label="Previous Programs"
                title="Previous Programs"
              >
                <ChevronLeft size={18} />
              </button>

              <button
                type="button"
                onClick={() => sliderRef.current?.slickNext()}
                className="btn btn-sm btn-outline-secondary rounded-circle d-flex align-items-center justify-content-center p-0"
                style={{ width: "36px", height: "36px", transition: "all 0.2s ease" }}
                aria-label="Next Programs"
                title="Next Programs"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <Link className="btn btn--outline btn--sm" href={actionLink}>
              All Programs →
            </Link>
          </div>
        </div>

        {/* Slick Slider Responsive Container */}
        <div className="cst-slider-wrapper">
          <Slider ref={sliderRef} {...sliderSettings}>
            {programs.map((p, i) => (
              <div key={p.id || i} className="h-100">
                <article
                  className="card program h-100 d-flex flex-column"
                  style={{
                    background: "#ffffff",
                    borderRadius: "20px",
                    overflow: "hidden",
                    boxShadow: "0 10px 30px -10px rgba(7, 30, 38, 0.08)",
                    transition: "transform 0.35s ease, box-shadow 0.35s ease",
                  }}
                >
                  <div
                    className="media ratio-43 position-relative"
                    style={{ background: "var(--navy)", overflow: "hidden" }}
                  >
                    <span className={`badge ${p.badge || ""}`}>{p.code}</span>
                    <img
                      src={p.image}
                      alt={p.title}
                      loading="lazy"
                      width="600"
                      height="450"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => {
                        e.currentTarget.src = "/images/website/program-high-performance.jpg";
                      }}
                    />
                  </div>

                  <div className="program__body d-flex flex-column flex-grow-1 p-3">
                    {/* Academy & Campus Badge */}
                    <div className="d-flex align-items-center gap-1 mb-2 text-muted small">
                      <MapPin size={13} className="text-danger flex-shrink-0" />
                      <span className="text-truncate fw-semibold" title={`${p.academy} ${p.branch ? `· ${p.branch}` : ""}`}>
                        {p.academy} {p.branch && `· ${p.branch}`}
                      </span>
                    </div>

                    <h3 className="h5 fw-bold mb-2 text-truncate" title={p.title} style={{ color: "var(--navy)" }}>
                      {p.title}
                    </h3>

                    <p
                      className="small text-muted mb-3 flex-grow-1"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        minHeight: "38px",
                      }}
                    >
                      {p.desc}
                    </p>

                    <div className="program__meta mt-auto pt-2 border-top d-flex align-items-center justify-content-between">
                      <span className="price fw-bold" style={{ color: "var(--red)", fontSize: "1.05rem" }}>
                        {p.price} <small className="text-muted fw-normal" style={{ fontSize: "0.8rem" }}>{p.unit || "/ mo"}</small>
                      </span>

                      <Link className="link-arrow small fw-bold" href={actionLink}>
                        Curriculum →
                      </Link>
                    </div>
                  </div>
                </article>
              </div>
            ))}
          </Slider>
        </div>

        {/* Bottom CTA */}
        <div className="center" style={{ marginTop: "40px" }} data-reveal>
          <Link className="btn btn--red" href={actionLink}>
            {actionText}{" "}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
