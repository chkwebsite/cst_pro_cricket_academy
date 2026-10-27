"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const FALLBACK_HOME_PROGRAMS = [
  {
    id: 1,
    title: "One-on-One",
    desc: "Personal coaching with a dedicated coach and video analysis.",
    image: "/images/website/program-one-to-one.jpg",
    price: "₹6,000",
    href: "/programs",
  },
  {
    id: 2,
    title: "Small Group",
    desc: "Batches of up to 10 players with focused attention and match play.",
    image: "/images/website/program-small-group.jpg",
    price: "₹3,000",
    href: "/programs",
  },
  {
    id: 3,
    title: "Mini Camp",
    desc: "5-day high-performance camp with match practice and fitness drills.",
    image: "/images/website/program-high-performance.jpg",
    price: "₹5,500",
    href: "/programs",
  },
  {
    id: 4,
    title: "Residential",
    desc: "Live-in training with meals, hostel and structured daily schedule.",
    image: "/images/website/scene-hostel.svg",
    price: "₹20,000",
    href: "/programs",
  },
];

export default function ProgramsSection({
  tag = "Coaching Programs",
  title = "Find the Right Program",
  programs: propPrograms = null,
  actionText = "Compare All Programs & Fees",
  actionLink = "/programs",
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

    async function loadHomePrograms() {
      try {
        const res = await fetch("/api/programs?academy_id=1&status=1");
        if (!isMounted) return;

        const json = await res.json();

        if (
          isMounted &&
          res.ok &&
          json.success &&
          Array.isArray(json.data) &&
          json.data.length > 0
        ) {
          const list = json.data.slice(0, 4).map((p) => {
            const rawFeatures = p.program_features
              ? p.program_features
                  .split(",")
                  .map((f) => f.trim())
                  .filter(Boolean)
              : [];

            const formattedPrice =
              p.program_fee && Number(p.program_fee) > 0
                ? `₹${Number(p.program_fee).toLocaleString("en-IN")}`
                : null;

            return {
              id: p.id,
              title: p.program_name,
              code: p.program_code,
              desc:
                p.description && p.description !== "Common all branch"
                  ? p.description
                  : rawFeatures.length > 0
                  ? rawFeatures.slice(0, 2).join(" • ")
                  : "Structured professional cricket development program.",
              image: p.program_image || "/images/website/program-one-to-one.jpg",
              price: formattedPrice,
              href: "/programs",
            };
          });

          setPrograms(list);
        } else if (isMounted && (!programs || programs.length === 0)) {
          setPrograms(FALLBACK_HOME_PROGRAMS);
        }
      } catch (err) {
        if (!isMounted) return;
        if (!programs || programs.length === 0) {
          setPrograms(FALLBACK_HOME_PROGRAMS);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadHomePrograms();
    return () => {
      isMounted = false;
    };
  }, [propPrograms]);

  return (
    <section className="bg-cream" id="programs">
      <div className="container">
        <div className="text-center mb-5 reveal visible">
          <span className="section-tag">{tag}</span>
          <h2 className="section-title">{title}</h2>
          <div className="divider"></div>
        </div>

        {loading ? (
          <div className="row g-4">
            {[1, 2, 3, 4].map((n) => (
              <div className="col-md-6 col-lg-3" key={`prog-skel-${n}`}>
                <div className="card-x h-100 placeholder-glow overflow-hidden d-flex flex-column justify-content-between p-0 shadow-sm border-0">
                  <div>
                    <div
                      className="placeholder w-100 bg-secondary opacity-25"
                      style={{ height: "190px", display: "block" }}
                    ></div>
                    <div className="p-4">
                      <span
                        className="placeholder col-8 bg-secondary opacity-25 rounded mb-2 d-block"
                        style={{ height: "22px" }}
                      ></span>
                      <span className="placeholder col-11 bg-secondary opacity-25 rounded mb-1 d-block"></span>
                      <span className="placeholder col-7 bg-secondary opacity-25 rounded mb-3 d-block"></span>
                      <span
                        className="placeholder col-4 bg-secondary opacity-25 rounded d-block"
                        style={{ height: "20px" }}
                      ></span>
                    </div>
                  </div>
                  <div className="px-4 pb-4 pt-0">
                    <span className="placeholder col-6 bg-secondary opacity-25 rounded d-block"></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="row g-4">
            {programs.map((prog, idx) => (
              <div className="col-md-6 col-lg-3 reveal visible" key={prog.id || idx}>
                <div className="card-x h-100 d-flex flex-column justify-content-between">
                  <div>
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
                        <span className="badge bg-navy text-lime position-absolute top-0 start-0 m-2 px-2.5 py-1 rounded-pill small fw-semibold shadow-sm">
                          {prog.code}
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <h5 className="mb-2 text-navy fw-bold">{prog.title}</h5>
                      <p className="text-secondary small mb-3">{prog.desc}</p>
                      {prog.price && (
                        <div className="price-tag fs-5 mb-2">
                          {prog.price}
                          <small className="text-secondary fs-6"> / mo</small>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="px-4 pb-4 pt-0">
                    <Link href={prog.href} className="fw-semibold text-red">
                      Details & Curriculum <i className="bi bi-arrow-right"></i>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-5 reveal visible">
          <Link href={actionLink} className="btn btn-red btn-lg">
            {actionText} <i className="bi bi-arrow-right ms-1"></i>
          </Link>
        </div>
      </div>
    </section>
  );
}
