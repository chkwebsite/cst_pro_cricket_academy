"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    let isMounted = true;
    async function loadBranches() {
      try {
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
          const mapped = rawBranches.slice(0, 3).map((b, idx) => {
            const bName = b.branch_name || b.name || `Branch ${idx + 1}`;
            const addressParts = [
              b.address_line || b.address,
              b.city,
              b.state,
              b.pincode,
            ]
              .filter(Boolean)
              .join(", ");

            return {
              id: b.id || `branch-${idx}`,
              name: bName,
              tag:
                idx === 0
                  ? "MAIN CAMPUS & HQ"
                  : idx === 1
                  ? "TRAINING CAMPUS"
                  : "MATCH GROUND & COMPLEX",
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

          // If less than 3 returned from API, supplement with fallbacks
          if (mapped.length < 3) {
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

  return (
    <section
      className="section"
      id="branches"
      style={{ position: "relative", overflow: "hidden", background: "var(--cream)" }}
    >
      {/* Floating Bubble Wave Animation (10-15% Opacity) */}
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
        <div className="section-head" data-reveal>
          <span className="eyebrow">{tag}</span>
          <h2 className="title">{title}</h2>
          <p className="lead">{subtitle}</p>
        </div>

        <div
          className="grid grid--3"
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            alignItems: "stretch",
          }}
        >
          {branches.map((b, i) => (
            <article
              className="card branch"
              data-reveal
              style={{
                "--d": i,
                display: "flex",
                flexDirection: "column",
                height: "100%",
                background: "#ffffff",
                boxShadow: "0 10px 30px -10px rgba(7, 30, 38, 0.08)",
                transition: "transform 0.3s ease, box-shadow 0.3s ease",
              }}
              key={b.id || i}
            >
              {/* Media banner */}
              <div
                className="media"
                style={{
                  aspectRatio: "16/10",
                  overflow: "hidden",
                  position: "relative",
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
                className="branch__body"
                style={{
                  padding: "24px 22px",
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span className="branch__status-pill">
                    <span className="branch__status-dot"></span>
                    {b.status}
                  </span>
                </div>

                <h3
                  style={{
                    fontFamily: "var(--font)",
                    fontWeight: 700,
                    fontSize: "19px",
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
                    marginBottom: "12px",
                  }}
                >
                  {b.tagline}
                </p>

                {/* Location */}
                <div className="branch__meta-row">
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <path
                      d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="10" r="3" strokeWidth="2" />
                  </svg>
                  <span>{b.address}</span>
                </div>

                {/* Contact and hours */}
                <div className="branch__meta-row">
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <circle cx="12" cy="12" r="10" strokeWidth="2" />
                    <path d="M12 6v6l4 2" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span>
                    {b.phone} · {b.hours}
                  </span>
                </div>

                {/* Facilities tags */}
                <div className="branch__facilities">
                  {b.facilities.map((fac, idx) => (
                    <span key={idx} className="branch__tag">
                      {fac}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div
                  className="branch__actions"
                  style={{
                    display: "flex",
                    gap: "10px",
                    marginTop: "auto",
                    paddingTop: "16px",
                  }}
                >
                  <a
                    className="btn btn--navy btn--sm"
                    href={`tel:${b.phone}`}
                    style={{ flex: 1, textAlign: "center", justifyContent: "center" }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ marginRight: "4px" }}
                    >
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    Call Now
                  </a>
                  <a
                    className="btn btn--outline btn--sm"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${b.name}, ${b.address}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ flex: 1, textAlign: "center", justifyContent: "center" }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ marginRight: "4px" }}
                    >
                      <path d="m3 11 19-9-9 19-2-8-8-2z" />
                    </svg>
                    Directions
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="center" style={{ marginTop: "44px" }} data-reveal>
          <Link className="btn btn--navy" href="/branches">
            View All Branches &rarr;
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
            Talk to our team &rarr;
          </Link>
        </p>
      </div>
    </section>
  );
}
