"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const FEATURES_DATA = [
  {
    id: "expert-coaches",
    tag: "Coaching Excellence",
    title: "Expert Coaches",
    desc: "Former first-class and international players on the panel.",
    image: "/images/website/program-one-to-one.jpg",
    subtitle:
      "Learn from BCCI & ICC certified master coaches and former first-class cricketers dedicated to grooming champions.",
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="5" />
        <path d="M8.5 13 7 22l5-3 5 3-1.5-9" />
      </svg>
    ),
    points: [
      {
        title: "BCCI & ICC Certified Mentors",
        desc: "Coaches with Level 1, 2, and 3 certifications holding decades of elite domestic and first-class match experience.",
      },
      {
        title: "Personalized 1-on-1 Attention",
        desc: "Low coach-to-player ratio (1:8) ensuring focused net practice, individualized feedback, and match simulation.",
      },
      {
        title: "Video Biomechanics Analysis",
        desc: "Slow-motion camera breakdown of batting grip, bat swing speed, bowling run-up, and release mechanics.",
      },
      {
        title: "Position-Specific Specialists",
        desc: "Dedicated mentors for top-order batting, fast-bowling seam control, spin variations, and wicketkeeping.",
      },
    ],
    chips: [
      "BCCI Level 2 Certified",
      "1:8 Coach Ratio",
      "Video Analysis",
      "Ranji Trophy Veterans",
    ],
  },
  {
    id: "quality-facilities",
    tag: "World-Class Infrastructure",
    title: "Quality Facilities",
    desc: "Turf pitches, nets, bowling machines and floodlights.",
    image: "/images/uploads/grounds/1790854770374-50134.png",
    subtitle:
      "Pristine natural turf wickets, automated speed bowling machines, and floodlit nets built to international training standards.",
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    points: [
      {
        title: "Natural Grass & Curated Turf Pitches",
        desc: "Multi-strip practice pitches prepared for true bounce, genuine seam movement, and spin variations.",
      },
      {
        title: "Programmable Bowling Machines",
        desc: "Dual-wheel automated bowling machines delivering speeds up to 145 km/h with in-swing and out-swing modes.",
      },
      {
        title: "High-Intensity 800-Lux Floodlights",
        desc: "Day-night net practice and match simulations under uniform, flicker-free stadium floodlighting.",
      },
      {
        title: "Modern Covered Nets & Pavilion",
        desc: "Multi-lane all-weather training bays, player dugouts, clean locker rooms, and spectator pavilion.",
      },
    ],
    chips: [
      "5 Turf Wickets",
      "BOLA Machines",
      "800-Lux Lights",
      "Indoor Pavilion",
    ],
  },
  {
    id: "fitness-care",
    tag: "Athlete Wellness & Conditioning",
    title: "Fitness & Care",
    desc: "Strength, conditioning, nutrition and injury support.",
    image: "/images/website/program-high-performance.jpg",
    subtitle:
      "Specialized sports physio, strength & endurance conditioning, and tailored nutrition to keep players peak-fit.",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M3 12h4l2-5 4 10 2-5h6" />
      </svg>
    ),
    points: [
      {
        title: "Cricket-Specific S&C Programs",
        desc: "Core strength, rotational power, sprint acceleration, and endurance tailored to fast bowling and quick running.",
      },
      {
        title: "On-Field Sports Physiotherapy",
        desc: "Rapid injury assessment, joint mobilization, shoulder-elbow care, and structured return-to-play protocols.",
      },
      {
        title: "Injury Prevention & Recovery",
        desc: "Dynamic warm-up routines, foam rolling, ice therapy, and weekly bowler workload monitoring.",
      },
      {
        title: "Sports Nutrition & Hydration Guidance",
        desc: "Customized diet plans, pre-match carb intake strategies, and hydration charts designed for youth athletes.",
      },
    ],
    chips: [
      "Strength & Conditioning",
      "On-Site Physio",
      "Agility Drills",
      "Custom Diet Plans",
    ],
  },
  {
    id: "progress-tracking",
    tag: "Data-Driven Player Growth",
    title: "Progress Tracking",
    desc: "Regular assessments and parent feedback reports.",
    image: "/images/website/program-small-group.jpg",
    subtitle:
      "Quarterly video benchmarks, radar speed telemetry, parent progress portals, and transparent developmental feedback.",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M15 7h6v6" />
      </svg>
    ),
    points: [
      {
        title: "Quarterly Assessment Scorecards",
        desc: "Comprehensive evaluation of batting strike rate, bowling economy, bowling accuracy, fielding agility, and fitness scores.",
      },
      {
        title: "Bowling Speed & Bat Velocity Tracking",
        desc: "Pocket radar telemetry recording ball release speed in km/h and high-speed video analyzing bat swing path.",
      },
      {
        title: "Monthly Parent-Coach Conclaves",
        desc: "Structured one-on-one sessions between parents and head coaches discussing match performance and milestone roadmaps.",
      },
      {
        title: "Direct Match & Tournament Pathway",
        desc: "Top performers earn immediate selection for academy XI squads in state-level invitation cups and corporate leagues.",
      },
    ],
    chips: [
      "Speed Gun Telemetry",
      "Quarterly Scorecards",
      "Parent Portal",
      "Tournament Drafts",
    ],
  },
];

export default function WhyChooseUsSection({
  tag = "Why Choose Us",
  title = "EVERYTHING A CRICKETER NEEDS",
}) {
  const [selectedFeature, setSelectedFeature] = useState(null);

  // Lock body scroll and handle Escape key
  useEffect(() => {
    if (selectedFeature) {
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e) => {
        if (e.key === "Escape") setSelectedFeature(null);
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleKeyDown);
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [selectedFeature]);

  return (
    <section className="section" id="features">
      <div className="container">
        <div className="section-head" data-reveal>
          <span className="eyebrow">{tag}</span>
          <h2 className="title">
            EVERYTHING A <em>CRICKETER NEEDS</em>
          </h2>
        </div>

        <div className="grid grid--4">
          {FEATURES_DATA.map((item, idx) => (
            <div
              className="feature feature--clickable"
              data-reveal
              style={{ "--d": idx }}
              key={item.id}
              onClick={() => setSelectedFeature(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedFeature(item);
                }
              }}
              aria-label={`View details for ${item.title}`}
            >
              <div className="feature__icon">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
              <span className="feature__more">
                View Details
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Centered Popup Modal (size: lg) */}
      {selectedFeature && (
        <div
          className="feature-modal-backdrop"
          onClick={() => setSelectedFeature(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="feature-modal-title"
        >
          <div
            className="feature-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="feature-modal__close"
              onClick={() => setSelectedFeature(null)}
              aria-label="Close modal"
            >
              &times;
            </button>

            <div className="feature-modal__grid">
              {/* Media column */}
              <div className="feature-modal__media">
                <img
                  src={selectedFeature.image}
                  alt={selectedFeature.title}
                  loading="lazy"
                />
              </div>

              {/* Content column */}
              <div className="feature-modal__body">
                <div>
                  <span className="eyebrow" style={{ marginBottom: "8px" }}>
                    {selectedFeature.tag}
                  </span>
                  <h3
                    id="feature-modal-title"
                    style={{
                      fontFamily: "var(--font)",
                      fontWeight: 800,
                      color: "var(--navy)",
                      fontSize: "24px",
                      marginTop: "6px",
                      marginBottom: "10px",
                    }}
                  >
                    {selectedFeature.title}
                  </h3>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "var(--muted)",
                      lineHeight: 1.6,
                      marginBottom: "16px",
                    }}
                  >
                    {selectedFeature.subtitle}
                  </p>
                </div>

                {/* Key feature points */}
                <ul className="feature-modal__points">
                  {selectedFeature.points.map((pt, i) => (
                    <li key={i} className="feature-modal__point">
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="var(--green)" strokeWidth="2" />
                        <path d="m9 12 2 2 4-4" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div>
                        <strong style={{ display: "block", color: "var(--navy)", fontSize: "14px" }}>
                          {pt.title}
                        </strong>
                        <span style={{ fontSize: "13px", color: "var(--muted)" }}>
                          {pt.desc}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Chips */}
                <div className="feature-modal__chips">
                  {selectedFeature.chips.map((chip, i) => (
                    <span key={i} className="feature-modal__chip">
                      {chip}
                    </span>
                  ))}
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: "12px", marginTop: "auto", flexWrap: "wrap" }}>
                  <Link
                    href="/book-free-trial"
                    className="btn btn--red btn--sm"
                    onClick={() => setSelectedFeature(null)}
                  >
                    Book Free Trial Session
                  </Link>
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    onClick={() => setSelectedFeature(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
