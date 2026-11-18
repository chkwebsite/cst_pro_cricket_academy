"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import Slider from "react-slick";
import { ChevronLeft, ChevronRight, MapPin, Phone, Clock, Navigation } from "lucide-react";

const GROUND_PHOTOS = [
  "/images/uploads/grounds/1790854770374-50134.png",
  "/images/uploads/grounds/1790854818232-664323.png",
  "/images/uploads/grounds/1790854920554-712937.png",
  "/images/uploads/grounds/1790854770381-164112.png",
  "/images/uploads/grounds/1790854818236-328687.png",
];

const FALLBACK_BRANCHES = [
  {
    id: "branch-1",
    name: "CST Pro Cricket Academy (Main)",
    academy: "CST Pro Cricket Academy",
    tag: "MAIN CAMPUS & HQ",
    badgeClass: "badge--red",
    tagline: "High-Performance Center & Headquarters",
    address: "Maruti Kunj, Near DPS Maruti Kunj, Gurugram, Haryana, 122002",
    phone: "8285831503",
    hours: "Mon–Sat · 6:00 AM – 7:30 PM",
    status: "OPEN TODAY",
    image: "/images/uploads/grounds/1790854770374-50134.png",
    facilities: [
      "5 Turf Wickets",
      "BOLA Bowling Machine",
      "800-Lux Floodlights",
      "Hostel & Cafeteria",
      "Strength Gym",
    ],
  },
  {
    id: "branch-2",
    name: "Dhananjay Cricket Academy",
    academy: "CST Pro Cricket Academy",
    tag: "TRAINING CAMPUS",
    badgeClass: "badge--navy",
    tagline: "Elite Practice Nets & Skill Hub",
    address: "Prem Kunj, Maruti Kunj, Gurugram, Haryana, 122002",
    phone: "9971109868",
    hours: "Mon–Sat · 6:00 AM – 7:30 PM",
    status: "OPEN TODAY",
    image: "/images/uploads/grounds/1790854818232-664323.png",
    facilities: [
      "Curated Turf Wicket",
      "Speed Bowling Machine",
      "Cement Nets",
      "Dedicated Dugouts",
      "Safe Parking",
    ],
  },
  {
    id: "branch-3",
    name: "Sports Mantra Match Ground",
    academy: "Sports Mantra Cricket Academy",
    tag: "MATCH GROUND & COMPLEX",
    badgeClass: "",
    tagline: "Tournament Ground & Floodlit Arena",
    address: "Maruti Kunj, Sohna Road, Gurugram, Haryana, 122002",
    phone: "8285831503",
    hours: "All Days · 5:30 AM – 10:00 PM",
    status: "OPEN TODAY",
    image: "/images/uploads/grounds/1790854920554-712937.png",
    facilities: [
      "70m Boundary Ground",
      "Curated Match Turf",
      "Player Pavilion",
      "Digital Scoreboard",
      "Night Floodlights",
    ],
  },
  {
    id: "branch-4",
    name: "Sports Mantra Academy - Sec 48",
    academy: "Sports Mantra Cricket Academy",
    tag: "SKILLS HUB",
    badgeClass: "badge--navy",
    tagline: "Turf Practice & Bowling Automation",
    address: "Sector 48, Sohna Road, Gurugram, Haryana, 122018",
    phone: "8285831503",
    hours: "Mon–Sat · 6:00 AM – 8:00 PM",
    status: "OPEN TODAY",
    image: "/images/uploads/grounds/1790854770381-164112.png",
    facilities: [
      "3 Turf Pitches",
      "Automated Bowling Machine",
      "Video Analysis",
      "Fitness Studio",
    ],
  },
  {
    id: "branch-5",
    name: "CST Cricket Arena - South Campus",
    academy: "CST Pro Cricket Academy",
    tag: "OUTDOOR COMPLEX",
    badgeClass: "badge--red",
    tagline: "Turf Match Ground & Coaching Center",
    address: "Sohna South, Gurugram, Haryana, 122103",
    phone: "9971109868",
    hours: "All Days · 6:00 AM – 9:00 PM",
    status: "OPEN TODAY",
    image: "/images/uploads/grounds/1790854818236-328687.png",
    facilities: [
      "Curated Turf Pitch",
      "High-Lux Lights",
      "Indoor Nets",
      "Player Lounge",
    ],
  },
];

function resolveBranchImage(branch, idx) {
  const name = (branch.branch_name || branch.name || "").toLowerCase();
  if (name.includes("cst") || name.includes("main")) return GROUND_PHOTOS[0];
  if (name.includes("dhananjay")) return GROUND_PHOTOS[1];
  if (name.includes("mantra") || name.includes("match")) return GROUND_PHOTOS[2];
  return GROUND_PHOTOS[idx % GROUND_PHOTOS.length];
}

function resolveBranchFacilities(branch, idx) {
  const name = (branch.branch_name || branch.name || "").toLowerCase();
  if (name.includes("cst") || name.includes("main")) {
    return [
      "5 Turf Wickets",
      "BOLA Bowling Machine",
      "800-Lux Floodlights",
      "Hostel & Cafeteria",
    ];
  }
  if (name.includes("dhananjay")) {
    return [
      "Curated Turf Wicket",
      "Speed Bowling Machine",
      "Cement Nets",
      "Dedicated Dugouts",
    ];
  }
  if (name.includes("mantra") || name.includes("match")) {
    return [
      "70m Match Ground",
      "Match Turf Pitch",
      "Player Pavilion",
      "Digital Scoreboard",
    ];
  }
  return ["Turf Practice Pitch", "Automated Bowling Machine", "Floodlights", "Safety Nets"];
}

export default function BranchesSection({
  tag = "Find Us",
  title = "OUR BRANCHES",
  subtitle = "Train close to home. Visit any branch for a free trial session.",
}) {
  const [branches, setBranches] = useState(FALLBACK_BRANCHES);
  const sliderRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    async function loadBranches() {
      try {
        // Fetch all active branches across all academies
        const res = await fetch("/api/branch?status=1");
        if (!res.ok) return;
        const json = await res.json();
        const rawBranches = Array.isArray(json.data)
          ? json.data
          : Array.isArray(json.branches)
          ? json.branches
          : Array.isArray(json)
          ? json
          : [];

        if (isMounted && rawBranches.length > 0) {
          const mapped = rawBranches.map((b, idx) => {
            const bName = b.branch_name || b.name || `Branch ${idx + 1}`;
            const addressParts = [
              b.address_line || b.address,
              b.city,
              b.state,
              b.pin_code || b.pincode,
            ]
              .filter(Boolean)
              .join(", ");

            return {
              id: b.id || `branch-${idx}`,
              name: bName,
              academy: b.academy_name || "Cricket Academy",
              tag:
                idx === 0
                  ? "MAIN CAMPUS & HQ"
                  : idx === 1
                  ? "TRAINING CAMPUS"
                  : idx === 2
                  ? "MATCH GROUND & COMPLEX"
                  : "BRANCH CAMPUS",
              badgeClass:
                idx === 0 ? "badge--red" : idx === 1 ? "badge--navy" : "",
              tagline:
                idx === 0
                  ? "High-Performance Center & Headquarters"
                  : idx === 1
                  ? "Elite Practice Nets & Skill Hub"
                  : "Tournament Ground & Floodlit Arena",
              address: addressParts || "Gurugram, Haryana",
              phone: b.phone || b.contact_number || "8285831503",
              hours: b.operating_hours || "Mon–Sat · 6:00 AM – 7:30 PM",
              status: "OPEN TODAY",
              image: resolveBranchImage(b, idx),
              facilities: resolveBranchFacilities(b, idx),
            };
          });

          // If less than 4 returned, supplement with fallbacks for smooth carousel
          if (mapped.length < 4) {
            const remaining = FALLBACK_BRANCHES.slice(mapped.length);
            setBranches([...mapped, ...remaining]);
          } else {
            setBranches(mapped);
          }
        }
      } catch (e) {
        // Fallback in place
      }
    }

    loadBranches();
    return () => {
      isMounted = false;
    };
  }, []);

  // Slick Slider Settings: 3 records on desktop, responsive across tablets and phones
  const sliderSettings = {
    dots: false,
    infinite: branches.length > 3,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 4500,
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
          infinite: branches.length > 2,
        },
      },
      {
        breakpoint: 640,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1,
          infinite: branches.length > 1,
          dots: false,
        },
      },
    ],
  };

  return (
    <section
      className="section"
      id="branches"
      style={{ position: "relative", overflow: "hidden", background: "var(--cream)" }}
    >
      {/* Floating Bubble Wave Animation */}
      <div className="bubble-wave-container" aria-hidden="true">
        <span className="bubble-wave-item b1"></span>
        <span className="bubble-wave-item b2"></span>
        <span className="bubble-wave-item b3"></span>
        <span className="bubble-wave-item b4"></span>
        <span className="bubble-wave-item b5"></span>
        <span className="bubble-wave-item b6"></span>
        <span className="bubble-wave-item b7"></span>
        <span className="bubble-wave-item b8"></span>
        <span className="bubble-wave-item b9"></span>
        <span className="bubble-wave-item b10"></span>
      </div>

      <div className="container" style={{ position: "relative", zIndex: 2 }}>
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
            <h2 className="title mb-0">{title}</h2>
            <p className="lead mt-2 mb-0">{subtitle}</p>
          </div>

          {/* Slider Prev / Next Controls & View All */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="d-flex align-items-center gap-2 bg-white p-1 px-2 rounded-pill shadow-sm border">
              <button
                type="button"
                onClick={() => sliderRef.current?.slickPrev()}
                className="btn btn-sm btn-outline-secondary rounded-circle d-flex align-items-center justify-content-center p-0"
                style={{ width: "36px", height: "36px", transition: "all 0.2s ease" }}
                aria-label="Previous Branches"
                title="Previous Branches"
              >
                <ChevronLeft size={18} />
              </button>

              <button
                type="button"
                onClick={() => sliderRef.current?.slickNext()}
                className="btn btn-sm btn-outline-secondary rounded-circle d-flex align-items-center justify-content-center p-0"
                style={{ width: "36px", height: "36px", transition: "all 0.2s ease" }}
                aria-label="Next Branches"
                title="Next Branches"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <Link className="btn btn--outline btn--sm" href="/branches">
              All Branches →
            </Link>
          </div>
        </div>

        {/* Slick Slider Responsive Container */}
        <div className="cst-slider-wrapper">
          <Slider ref={sliderRef} {...sliderSettings}>
            {branches.map((b, i) => (
              <div key={b.id || i} className="h-100">
                <article
                  className="card branch h-100 d-flex flex-column"
                  style={{
                    background: "#ffffff",
                    borderRadius: "20px",
                    overflow: "hidden",
                    boxShadow: "0 10px 30px -10px rgba(7, 30, 38, 0.08)",
                    transition: "transform 0.3s ease, box-shadow 0.3s ease",
                  }}
                >
                  {/* Media banner */}
                  <div
                    className="media position-relative"
                    style={{
                      aspectRatio: "16/10",
                      overflow: "hidden",
                      background: "var(--navy)",
                    }}
                  >
                    <span
                      className={`badge ${b.badgeClass}`}
                      style={{
                        position: "absolute",
                        top: "14px",
                        left: "14px",
                        zIndex: 2,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {b.tag}
                    </span>
                    <img
                      src={b.image}
                      alt={b.name}
                      loading="lazy"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transition: "transform 0.5s ease",
                      }}
                    />
                  </div>

                  {/* Branch body */}
                  <div
                    className="branch__body d-flex flex-column flex-grow-1"
                    style={{
                      padding: "20px 18px",
                    }}
                  >
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="branch__status-pill">
                        <span className="branch__status-dot"></span>
                        {b.status}
                      </span>
                      <small className="text-muted fw-semibold text-truncate ms-2" title={b.academy}>
                        {b.academy}
                      </small>
                    </div>

                    <h3
                      style={{
                        fontFamily: "var(--font)",
                        fontWeight: 700,
                        fontSize: "18px",
                        color: "var(--navy)",
                        marginBottom: "4px",
                        lineHeight: 1.3,
                      }}
                    >
                      {b.name}
                    </h3>
                    <p
                      style={{
                        fontSize: "12.5px",
                        color: "var(--green-d)",
                        fontWeight: 600,
                        marginBottom: "10px",
                      }}
                    >
                      {b.tagline}
                    </p>

                    {/* Location */}
                    <div className="branch__meta-row mb-2">
                      <MapPin size={15} className="text-danger flex-shrink-0" />
                      <span className="small text-muted text-truncate" title={b.address}>{b.address}</span>
                    </div>

                    {/* Contact and hours */}
                    <div className="branch__meta-row mb-3">
                      <Clock size={15} className="text-muted flex-shrink-0" />
                      <span className="small text-muted text-truncate">
                        {b.phone} · {b.hours}
                      </span>
                    </div>

                    {/* Facilities tags */}
                    <div className="branch__facilities mb-3 flex-grow-1">
                      {b.facilities.map((fac, idx) => (
                        <span key={idx} className="branch__tag">
                          {fac}
                        </span>
                      ))}
                    </div>

                    {/* Actions */}
                    <div
                      className="branch__actions mt-auto pt-3 border-top d-flex gap-2"
                    >
                      <a
                        className="btn btn--navy btn--sm flex-fill justify-content-center text-center"
                        href={`tel:${b.phone}`}
                      >
                        <Phone size={14} className="me-1" />
                        Call Now
                      </a>
                      <a
                        className="btn btn--outline btn--sm flex-fill justify-content-center text-center"
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${b.name}, ${b.address}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Navigation size={14} className="me-1" />
                        Directions
                      </a>
                    </div>
                  </div>
                </article>
              </div>
            ))}
          </Slider>
        </div>

        {/* Bottom CTA */}
        <div className="center" style={{ marginTop: "40px" }} data-reveal>
          <Link className="btn btn--navy" href="/branches">
            View All Branches →
          </Link>
        </div>

        <p
          className="center"
          style={{
            fontSize: "13px",
            color: "var(--muted)",
            marginTop: "14px",
          }}
        >
          Not sure which branch suits you?{" "}
          <Link
            href="/contact"
            style={{
              color: "var(--navy)",
              fontWeight: 600,
              textDecoration: "underline",
            }}
          >
            Talk to our team →
          </Link>
        </p>
      </div>
    </section>
  );
}
