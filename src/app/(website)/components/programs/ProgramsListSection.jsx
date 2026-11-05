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
    desc: "Intensive high-performance camp with match practice, fitness drills, and game tactics.",
    image: "/images/uploads/programs/program_1792403990418_65968.png",
    price: "₹5,500",
    unit: "/ camp",
    badge: "badge--navy",
  },
];

export default function ProgramsListSection() {
  const [programs, setPrograms] = useState(FALLBACK_PROGRAMS);

  useEffect(() => {
    let isMounted = true;
    async function fetchDynamic() {
      try {
        const res = await fetch("/api/programs?academy_id=1&status=1");
        if (!res.ok) return;
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data) && json.data.length > 0) {
          const list = json.data.map((p, idx) => ({
            id: p.id,
            title: p.program_name,
            code: p.program_code || `CST-00${idx + 1}`,
            desc: p.description || p.short_description || "High-performance cricket coaching.",
            image: resolveProgramImage(p, idx),
            price: p.program_fee ? `₹${Number(p.program_fee).toLocaleString("en-IN")}` : "₹1,500",
            unit: "/ mo",
            badge: idx % 2 === 1 ? "badge--navy" : "",
          }));
          setPrograms(list);
        }
      } catch (err) {
        // Fallback in place
      }
    }
    fetchDynamic();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      {/* Program Cards Grid */}
      <section className="section">
        <div className="container">
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
                  <Link className="link-arrow" href="/book-free-trial">
                    Enroll or Book Trial →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Program Comparison Table */}
      <section className="section section--cream">
        <div className="container">
          <div className="section-head" data-reveal>
            <span className="eyebrow">Program Comparison</span>
            <h2 className="title">
              CHOOSE THE RIGHT <em>TRAINING PATHWAY</em>
            </h2>
          </div>
          <div className="table-wrap" data-reveal>
            <table>
              <thead>
                <tr>
                  <th>Features</th>
                  <th>Junior (U-12)</th>
                  <th>Beginner</th>
                  <th>Residential</th>
                  <th>Mini Camp</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Age Group</td>
                  <td>6 – 12 yrs</td>
                  <td>10+ yrs</td>
                  <td>12 – 19 yrs</td>
                  <td>All Ages</td>
                </tr>
                <tr>
                  <td>Weekly Sessions</td>
                  <td>3 Sessions</td>
                  <td>4 Sessions</td>
                  <td>Daily (6 days)</td>
                  <td>Intensive (7 days)</td>
                </tr>
                <tr>
                  <td>Turf Pitch Practice</td>
                  <td>✓</td>
                  <td>✓</td>
                  <td>✓ (Unlimited)</td>
                  <td>✓</td>
                </tr>
                <tr>
                  <td>Bowling Machine Access</td>
                  <td>Limited</td>
                  <td>✓</td>
                  <td>✓</td>
                  <td>✓</td>
                </tr>
                <tr>
                  <td>Video Biomechanics</td>
                  <td>Quarterly</td>
                  <td>Quarterly</td>
                  <td>Weekly</td>
                  <td>Camp End</td>
                </tr>
                <tr>
                  <td>Hostel Accommodation</td>
                  <td>—</td>
                  <td>—</td>
                  <td>Included</td>
                  <td>Optional</td>
                </tr>
                <tr>
                  <td>Parent Feedback Reports</td>
                  <td>Monthly</td>
                  <td>Monthly</td>
                  <td>Bi-weekly</td>
                  <td>Comprehensive</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="center" style={{ marginTop: "36px" }} data-reveal>
            <Link className="btn btn--red" href="/contact">
              Talk to Our Head Coach →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
