"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const BRANCH_IMAGES = [
  "/images/website/scene-night.svg",
  "/images/website/scene-batting.svg",
  "/images/website/scene-bowling.svg",
  "/images/website/scene-hostel.svg",
];

function getBranchMetadata(b, idx) {
  const name = (b.branch_name || b.name || "").toLowerCase();
  const code = (b.branch_code || b.branchCode || "").toLowerCase();

  // 1. CST Pro Cricket Academy (Main Campus)
  if (
    name.includes("cst") ||
    (name.includes("main") && !name.includes("mantra")) ||
    code.includes("ggn-br-000001")
  ) {
    return {
      badge: "Main Campus",
      image: "/images/website/scene-night.svg",
      sortPriority: 1,
    };
  }

  // 2. Dhananjay Cricket Academy (Training Campus)
  if (name.includes("dhananjay") || code.includes("ggn-br-000002")) {
    return {
      badge: "Training Campus",
      image: "/images/website/scene-batting.svg",
      sortPriority: 2,
    };
  }

  // 3. Sports Mantra (Match Ground / Cricket Complex)
  if (
    name.includes("sports mantra") ||
    name.includes("mantra") ||
    code.includes("sm-br")
  ) {
    return {
      badge: "Match Ground",
      image: "/images/website/scene-bowling.svg",
      sortPriority: 3,
    };
  }

  return {
    badge: b.city ? b.city : b.state ? b.state : "Branch",
    image: BRANCH_IMAGES[idx % BRANCH_IMAGES.length],
    sortPriority: 10 + idx,
  };
}

const FALLBACK_BRANCHES = [
  {
    id: "branch-1",
    badge: "Head Office",
    image: "/images/website/scene-night.svg",
    name: "CST pro Cricket Academy(Main)",
    address: "Maruti Kunj, Gurugram, Haryana - 122002",
    phone: "+91 8285831503",
    hours: "Mon–Sat · 6 AM – 7:30 PM",
    directionsUrl:
      "https://www.google.com/maps/search/?api=1&query=Maruti+Kunj+Gurugram",
  },
  {
    id: "branch-2",
    badge: "Gurugram",
    image: "/images/website/scene-batting.svg",
    name: "Dhananjay Cricket Academy",
    address: "Prem Kunj, Maruti Kunj, Gurugram, Haryana - 122002",
    phone: "+91 9971109868",
    hours: "Mon–Sat · 6:30 AM – 7 PM",
    directionsUrl:
      "https://www.google.com/maps/search/?api=1&query=Prem+Kunj+Maruti+Kunj+Gurugram",
  },
];

export default function BranchesSection({
  tag = "Find Us",
  title = "Our Branches",
  subtitle = "Train close to home. Visit any branch for a free trial session.",
  branches: propBranches = null,
  footerText = "Not sure which branch suits you?",
  footerLink = { text: "Talk to our team", href: "/contact" },
}) {
  const [branches, setBranches] = useState(propBranches || []);
  const [loading, setLoading] = useState(!propBranches);

  useEffect(() => {
    if (propBranches && propBranches.length > 0) {
      setBranches(propBranches);
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function loadBranches() {
      try {
        const res = await fetch("/api/branch?academy_id=1&status=1");
        if (!isMounted) return;

        const json = await res.json();

        if (
          isMounted &&
          res.ok &&
          json.success &&
          Array.isArray(json.data) &&
          json.data.length > 0
        ) {
          const list = json.data.map((b, idx) => {
            const fullAddress = [b.address, b.city, b.state, b.pin_code]
              .filter(Boolean)
              .join(", ");

            let directionsUrl = "";
            if (b.directions && typeof b.directions === "string" && b.directions.trim()) {
              const d = b.directions.trim();
              if (d.startsWith("http://") || d.startsWith("https://")) {
                directionsUrl = d;
              } else {
                directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  d
                )}`;
              }
            } else {
              directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                fullAddress || b.branch_name
              )}`;
            }

            const meta = getBranchMetadata(b, idx);

            return {
              id: `branch-${b.id}`,
              badge: meta.badge,
              image: meta.image,
              name: b.branch_name,
              address: fullAddress || "Maruti Kunj, Gurugram",
              phone: b.phone || "+91 8285831503",
              hours: "Mon–Sat · 6 AM – 7:30 PM",
              directionsUrl,
              sortPriority: meta.sortPriority,
            };
          });

          list.sort((a, b) => a.sortPriority - b.sortPriority);

          setBranches(list);
        } else if (isMounted && (!branches || branches.length === 0)) {
          setBranches(FALLBACK_BRANCHES);
        }
      } catch (err) {
        if (!isMounted) return;
        if (!branches || branches.length === 0) {
          setBranches(FALLBACK_BRANCHES);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadBranches();
    return () => {
      isMounted = false;
    };
  }, [propBranches]);

  return (
    <section className="bg-cream" id="branches">
      <div className="container">
        <div className="text-center mb-5 reveal visible">
          <span className="section-tag">{tag}</span>
          <h2 className="section-title">{title}</h2>
          <div className="divider"></div>
          {subtitle && <p className="text-secondary">{subtitle}</p>}
        </div>

        {loading ? (
          <div className="row g-4 justify-content-center">
            {[1, 2].map((n) => (
              <div className="col-md-6 col-lg-4" key={`branch-skel-${n}`}>
                <div className="card-x branch-card d-flex flex-column h-100 placeholder-glow overflow-hidden shadow-sm border-0">
                  <div
                    className="placeholder w-100 bg-secondary opacity-25"
                    style={{ height: "190px", display: "block" }}
                  ></div>
                  <div className="p-4 d-flex flex-column flex-grow-1 justify-content-between">
                    <div>
                      <span
                        className="placeholder col-8 bg-secondary opacity-25 rounded mb-3 d-block"
                        style={{ height: "22px" }}
                      ></span>
                      <span className="placeholder col-11 bg-secondary opacity-25 rounded mb-2 d-block"></span>
                      <span className="placeholder col-9 bg-secondary opacity-25 rounded mb-2 d-block"></span>
                      <span className="placeholder col-6 bg-secondary opacity-25 rounded mb-4 d-block"></span>
                    </div>
                    <div className="d-flex gap-2 pt-3 border-top">
                      <span
                        className="placeholder col-6 bg-secondary opacity-25 rounded-pill d-block"
                        style={{ height: "36px" }}
                      ></span>
                      <span
                        className="placeholder col-6 bg-secondary opacity-25 rounded-pill d-block"
                        style={{ height: "36px" }}
                      ></span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="row g-4 justify-content-center">
            {branches.map((b, idx) => (
              <div className="col-md-6 col-lg-4 reveal visible" key={b.id || idx}>
                <article
                  id={b.id}
                  className="card-x branch-card d-flex flex-column h-100"
                >
                  <div className="branch-img position-relative overflow-hidden">
                    <img
                      src={b.image}
                      alt={`${b.name} ground`}
                      loading="lazy"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = BRANCH_IMAGES[0];
                      }}
                    />
                    <span className="branch-badge">
                      <i className="bi bi-geo-alt-fill"></i>
                      {b.badge}
                    </span>
                  </div>

                  <div className="p-4 d-flex flex-column flex-grow-1 justify-content-between">
                    <div>
                      <h4 className="h5 fw-bold mb-3">{b.name}</h4>
                      <ul className="branch-meta list-unstyled mb-0">
                        <li>
                          <i className="bi bi-geo-alt"></i>
                          <span>{b.address}</span>
                        </li>
                        <li>
                          <i className="bi bi-telephone"></i>
                          <a href={`tel:${b.phone}`}>{b.phone}</a>
                        </li>
                        <li>
                          <i className="bi bi-clock"></i>
                          <span>{b.hours}</span>
                        </li>
                      </ul>
                    </div>

                    <div className="branch-actions d-flex gap-2 pt-3 border-top mt-3">
                      <a
                        href={`tel:${b.phone}`}
                        className="btn btn-navy btn-sm flex-fill rounded-pill"
                      >
                        <i className="bi bi-telephone-fill me-1"></i> Call
                      </a>
                      <a
                        href={b.directionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline-navy btn-sm flex-fill rounded-pill"
                      >
                        <i className="bi bi-compass-fill me-1"></i> Directions
                      </a>
                    </div>
                  </div>
                </article>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-5 reveal visible">
          <Link href="/branches" className="btn btn-navy btn-lg">
            View All Branches <i className="bi bi-arrow-right ms-1"></i>
          </Link>
        </div>

        {footerText && (
          <div className="text-center mt-3 reveal visible">
            <p className="text-secondary small mb-0">
              {footerText}{" "}
              {footerLink && (
                <Link
                  href={footerLink.href}
                  className="fw-bold text-navy text-decoration-underline"
                >
                  {footerLink.text} &rarr;
                </Link>
              )}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
