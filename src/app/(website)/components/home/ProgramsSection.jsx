"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
    desc: "Intensive high-performance camp with match practice, fitness drills, and game tactical theory.",
    image: "/images/uploads/programs/program_1792403990418_65968.png",
    price: "₹5,500",
    unit: "/ camp",
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

  useEffect(() => {
    let isMounted = true;

    async function loadPrograms() {
      try {
        const res = await fetch("/api/programs?academy_id=1&status=1");
        if (!res.ok) return;
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data) && json.data.length > 0) {
          const mapped = json.data.slice(0, 4).map((p, idx) => ({
            id: p.id,
            title: p.program_name,
            code: p.program_code || `CST-00${idx + 1}`,
            desc: p.description || p.short_description || "High-performance cricket coaching.",
            image: resolveProgramImage(p, idx),
            price: p.program_fee ? `₹${Number(p.program_fee).toLocaleString("en-IN")}` : "₹1,500",
            unit: "/ mo",
            badge: idx % 2 === 1 ? "badge--navy" : "",
          }));
          setPrograms(mapped);
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

  return (
    <section className="section section--cream" id="programs">
      <div className="container">
        <div className="section-head" data-reveal>
          <span className="eyebrow">{tag}</span>
          <h2 className="title">
            FIND YOUR PERFECT <em>TRAINING PROGRAM</em>
          </h2>
        </div>
        <div className="grid grid--4">
          {programs.map((p, i) => (
            <article className="card program" data-reveal style={{ "--d": i }} key={p.id || i}>
              <div className="media ratio-43" style={{ background: "var(--navy)", overflow: "hidden" }}>
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
              <div className="program__body">
                <h3>{p.title}</h3>
                <p>{p.desc}</p>
                <div className="program__meta">
                  <span className="price">
                    {p.price} <small>{p.unit || "/ mo"}</small>
                  </span>
                </div>
                <Link className="link-arrow" href={actionLink}>
                  Details &amp; Curriculum →
                </Link>
              </div>
            </article>
          ))}
        </div>
        <div className="center" style={{ marginTop: "48px" }} data-reveal>
          <Link className="btn btn--red" href={actionLink}>
            {actionText}{" "}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
