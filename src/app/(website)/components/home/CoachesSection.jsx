"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
    name: "Rajneesh Kumar",
    role: "Head Batting Coach",
    image: "/assets/img/about-2.jpg",
  },
  {
    name: "Deepak Walia",
    role: "Batting & Fitness Coach",
    image: "/assets/img/about-3.jpg",
  },
];

export default function CoachesSection({
  tag = "Our Team",
  title = "LEARN FROM THE BEST",
}) {
  const [coaches, setCoaches] = useState(FALLBACK_COACHES);

  useEffect(() => {
    let isMounted = true;
    async function loadCoaches() {
      try {
        const res = await fetch("/api/coaches?academy_id=1&status=1");
        if (!res.ok) return;
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data) && json.data.length > 0) {
          const mapped = json.data.slice(0, 2).map((c, idx) => {
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
              name,
              role,
              image: resolveCoachImage(c, idx),
            };
          });
          setCoaches(mapped);
        }
      } catch (err) {
        // Fallback in place
      }
    }
    loadCoaches();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="section section--dark" id="coaches">
      <div className="container">
        <div
          className="section-head section-head--left"
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
            <h2 className="title">
              LEARN FROM THE <em>BEST</em>
            </h2>
          </div>
          <Link className="btn btn--ghost btn--sm" href="/coaches">
            All Coaches →
          </Link>
        </div>

        <div className="grid grid--2">
          {coaches.map((c, i) => (
            <article className="coach" data-reveal style={{ "--d": i }} key={i}>
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
                      i === 0 ? "/assets/img/about-2.jpg" : "/assets/img/about-3.jpg";
                  }}
                />
              </div>
              <span className="coach__no">0{i + 1}</span>
              <div className="coach__info">
                <small>{c.role}</small>
                <h3>{c.name}</h3>
                <Link className="btn btn--red btn--sm" href="/coaches">
                  View Profile
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
