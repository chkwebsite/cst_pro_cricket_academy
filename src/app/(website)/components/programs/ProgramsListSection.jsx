"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const FALLBACK_PROGRAMS = [
  {
    id: 1,
    title: "One-on-One (1:1)",
    code: "CST-001",
    desc: "Personal sessions tailored to your game.",
    image: "/images/website/program-one-to-one.jpg",
    features: [
      "Dedicated personal coach",
      "Video analysis & drills",
      "Flexible training timings",
    ],
    price: "₹6,000",
    period: "/ month",
    enquireLink: "/contact",
  },
  {
    id: 2,
    title: "Small Group",
    code: "CST-002",
    desc: "Up to 10 players per batch.",
    image: "/images/website/program-small-group.jpg",
    features: [
      "Skill drills & practice",
      "Match awareness training",
      "Monthly performance assessment",
    ],
    price: "₹3,000",
    period: "/ month",
    enquireLink: "/contact",
  },
  {
    id: 3,
    title: "5-Day Mini Camp",
    code: "CST-003",
    desc: "Intensive high-performance camp.",
    image: "/images/website/program-high-performance.jpg",
    features: [
      "Intensive daily sessions",
      "Fitness testing drills",
      "Certificate of participation",
    ],
    price: "₹5,500",
    period: "/ camp",
    enquireLink: "/contact",
  },
  {
    id: 4,
    title: "Residential",
    code: "CST-004",
    desc: "Live-in training experience.",
    image: "/images/website/scene-hostel.svg",
    features: [
      "Hostel & nutritious meals",
      "Daily double practice sessions",
      "Academic study support",
    ],
    price: "₹20,000",
    period: "/ month",
    enquireLink: "/contact",
  },
];

export default function ProgramsListSection({
  tag = "Coaching Programs",
  title = "Choose Your Training Path",
  subtitle = "Professional coaching programs designed for beginners, intermediate, and advanced cricket athletes.",
  programs: propPrograms = null,
}) {
  const [programs, setPrograms] = useState(propPrograms || []);
  const [loading, setLoading] = useState(!propPrograms);

  useEffect(() => {
    if (propPrograms && propPrograms.length > 0) {
      setPrograms(propPrograms);
      setLoading(false);
      return;
    }

    let isMounted = true;
    async function loadPrograms() {
      try {
        const res = await fetch("/api/programs?academy_id=1&status=1");
        const json = await res.json();

        if (
          isMounted &&
          res.ok &&
          json.success &&
          Array.isArray(json.data) &&
          json.data.length > 0
        ) {
          const list = json.data.map((p) => {
            const rawFeatures = p.program_features
              ? p.program_features
                  .split(",")
                  .map((f) => f.trim())
                  .filter(Boolean)
              : [];

            const formattedPrice =
              p.program_fee && Number(p.program_fee) > 0
                ? `₹${Number(p.program_fee).toLocaleString("en-IN")}`
                : "Contact for Fees";

            return {
              id: p.id,
              title: p.program_name,
              code: p.program_code,
              desc:
                p.description && p.description !== "Common all branch"
                  ? p.description
                  : rawFeatures.length > 0
                  ? rawFeatures.slice(0, 2).join(" • ")
                  : "Structured cricket training programme.",
              image: p.program_image || "/images/website/program-one-to-one.jpg",
              features:
                rawFeatures.length > 0
                  ? rawFeatures.slice(0, 4)
                  : [
                      "Certified professional coaching",
                      "Turf & net practice sessions",
                      "Regular progress assessment",
                    ],
              price: formattedPrice,
              period: "/ month",
              registration_fee: p.registration_fee,
              enquireLink: "/contact",
            };
          });

          setPrograms(list);
        } else if (isMounted && (!programs || programs.length === 0)) {
          setPrograms(FALLBACK_PROGRAMS);
        }
      } catch (err) {
        console.error("Failed to load programs:", err);
        if (isMounted && (!programs || programs.length === 0)) {
          setPrograms(FALLBACK_PROGRAMS);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPrograms();
    return () => {
      isMounted = false;
    };
  }, [propPrograms]);

  return (
    <section>
      <div className="container">
        <div className="text-center mb-5 reveal">
          <span className="section-tag">{tag}</span>
          <h2 className="section-title">{title}</h2>
          <div className="divider"></div>
          {subtitle && <p className="text-secondary">{subtitle}</p>}
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading Programs...</span>
            </div>
            <p className="text-muted mt-2 small">Loading coaching programs...</p>
          </div>
        ) : (
          <div className="row g-4">
            {programs.map((prog, idx) => (
              <div className="col-md-6 col-lg-4 reveal" key={prog.id || idx}>
                <div className="card-x d-flex flex-column h-100 shadow-sm border border-light">
                  <div className="program-thumb position-relative overflow-hidden">
                    <img
                      src={prog.image}
                      alt={prog.title}
                      loading="lazy"
                      width="1000"
                      height="746"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "/images/website/program-one-to-one.jpg";
                      }}
                    />
                    {prog.code && (
                      <span className="badge bg-navy text-lime position-absolute top-0 start-0 m-3 px-2.5 py-1.5 rounded-pill small fw-semibold shadow-sm">
                        {prog.code}
                      </span>
                    )}
                  </div>
                  <div className="p-4 d-flex flex-column flex-grow-1">
                    <h5 className="mb-2 fw-bold text-navy">{prog.title}</h5>
                    <p className="text-secondary small mb-3">{prog.desc}</p>
                    <ul className="list-unstyled small text-secondary mb-4 flex-grow-1">
                      {prog.features.map((feat, fIdx) => (
                        <li className="mb-2 d-flex align-items-start" key={fIdx}>
                          <i className="bi bi-check2 text-red me-2 flex-shrink-0 mt-0.5"></i>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-3 border-top border-light">
                      <div className="d-flex justify-content-between align-items-baseline mb-2">
                        <div className="price-tag">
                          {prog.price}
                          {prog.price !== "Contact for Fees" && (
                            <small className="text-secondary fs-6">
                              {" "}
                              {prog.period}
                            </small>
                          )}
                        </div>
                        {prog.registration_fee &&
                          Number(prog.registration_fee) > 0 && (
                            <div className="text-muted small">
                              +₹{Number(prog.registration_fee).toLocaleString("en-IN")} reg.
                            </div>
                          )}
                      </div>
                      <Link
                        href={prog.enquireLink}
                        className="btn btn-red btn-sm mt-2 w-100 py-2.5"
                      >
                        Enquire Now
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
