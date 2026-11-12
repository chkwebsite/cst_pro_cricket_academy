"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";

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
      facilities: [
        "Turf & Cement Nets",
        "BOLA Bowling Machine",
        "800-Lux Floodlights",
        "Hostel & Cafeteria",
        "Gym & Physio",
      ],
      sortPriority: 1,
    };
  }

  // 2. Dhananjay Cricket Academy (Training Campus)
  if (name.includes("dhananjay") || code.includes("ggn-br-000002")) {
    return {
      badge: "Training Campus",
      image: "/images/website/scene-batting.svg",
      facilities: [
        "Cement Practice Nets",
        "Turf Wicket",
        "Bowling Machine",
        "Dedicated Dugouts",
        "Safe Parking",
      ],
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
      facilities: [
        "Full Match Ground",
        "Curated Turf Pitch",
        "Player Pavilion",
        "Digital Scoreboard",
        "Night Floodlights",
      ],
      sortPriority: 3,
    };
  }

  // Default fallback for any other branch
  const defaultFacilitiesList = [
    [
      "Turf & Cement Nets",
      "BOLA Bowling Machine",
      "800-Lux Floodlights",
      "Hostel & Cafeteria",
      "Gym & Physio",
    ],
    [
      "Cement Practice Nets",
      "Turf Wicket",
      "Bowling Machine",
      "Dedicated Dugouts",
      "Safe Parking",
    ],
    [
      "Full Match Ground",
      "Curated Turf Pitch",
      "Player Pavilion",
      "Digital Scoreboard",
      "Night Floodlights",
    ],
  ];

  return {
    badge: b.city ? b.city : b.state ? b.state : "Branch",
    image: BRANCH_IMAGES[idx % BRANCH_IMAGES.length],
    facilities: defaultFacilitiesList[idx % defaultFacilitiesList.length],
    sortPriority: 10 + idx,
  };
}

const FALLBACK_BRANCHES = [
  {
    id: "branch-1",
    rawId: 1,
    branchCode: "GGN-Br-000001",
    badge: "Main Campus",
    image: "/images/website/scene-night.svg",
    name: "CST Pro Cricket Academy (Main)",
    address: "Maruti Kunj, Gurugram, Haryana - 122002",
    city: "Gurugram",
    phone: "+91 8285831503",
    email: "chandankeshri100@gmail.com",
    hours: "Mon–Sat · 6:00 AM – 7:30 PM",
    facilities: [
      "Turf & Cement Nets",
      "BOLA Bowling Machine",
      "800-Lux Floodlights",
      "Hostel & Cafeteria",
      "Gym & Physio",
    ],
    directionsUrl: "https://www.google.com/maps/search/?api=1&query=Maruti+Kunj+Gurugram",
  },
  {
    id: "branch-2",
    rawId: 2,
    branchCode: "GGN-Br-000002",
    badge: "Training Campus",
    image: "/images/website/scene-batting.svg",
    name: "Dhananjay Cricket Academy",
    address: "Prem Kunj, Maruti Kunj, Gurugram, Haryana - 122002",
    city: "Gurugram",
    phone: "+91 9971109868",
    email: "deepak@gmail.com",
    hours: "Mon–Sat · 6:30 AM – 7:00 PM",
    facilities: [
      "Cement Practice Nets",
      "Turf Wicket",
      "Bowling Machine",
      "Dedicated Dugouts",
      "Safe Parking",
    ],
    directionsUrl: "https://www.google.com/maps/search/?api=1&query=Prem+Kunj+Maruti+Kunj+Gurugram",
  },
  {
    id: "branch-3",
    rawId: 3,
    branchCode: "SM-BR-000001",
    badge: "Match Ground",
    image: "/images/website/scene-bowling.svg",
    name: "Sports Mantra Cricket Complex",
    address: "Kadirpur, Gurugram, Haryana - 122002",
    city: "Gurugram",
    phone: "+91 9966552218",
    email: "sportsmantra@gmail.com",
    hours: "All Days · 6:00 AM – 8:00 PM",
    facilities: [
      "Full Match Ground",
      "Curated Turf Pitch",
      "Player Pavilion",
      "Digital Scoreboard",
      "Night Floodlights",
    ],
    directionsUrl: "https://www.google.com/maps/search/?api=1&query=Kadirpur+Gurugram",
  },
];

export default function BranchesGridSection({
  tag = "Training Centers",
  title = "Our Cricket Academy Branches",
  subtitle = "State-of-the-art turf wickets, computerized bowling machines, and certified coaching available across all our branch locations in Gurugram.",
}) {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");

  useEffect(() => {
    let isMounted = true;

    async function fetchBranches() {
      try {
        const res = await fetch("/api/branch?status=1");
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
              rawId: b.id,
              branchCode: b.branch_code,
              badge: meta.badge,
              image: meta.image,
              name: b.branch_name,
              address: fullAddress || "Maruti Kunj, Gurugram",
              city: b.city || "Gurugram",
              phone: b.phone || "+91 8285831503",
              email: b.email || "info@cstcricket.com",
              hours: "Mon–Sat · 6:00 AM – 7:30 PM",
              facilities: meta.facilities,
              directionsUrl,
              sortPriority: meta.sortPriority,
            };
          });

          // Sort so Main Campus is first, Training Campus second, Match Ground third
          list.sort((a, b) => a.sortPriority - b.sortPriority);

          setBranches(list);
        } else if (isMounted) {
          setBranches(FALLBACK_BRANCHES);
        }
      } catch (err) {
        if (isMounted) setBranches(FALLBACK_BRANCHES);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchBranches();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered branches
  const filteredBranches = useMemo(() => {
    return branches.filter((b) => {
      const matchesSearch =
        searchFilter.trim() === "" ||
        b.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        b.address.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (b.branchCode && b.branchCode.toLowerCase().includes(searchFilter.toLowerCase()));

      const matchesCity =
        selectedCity === "all" ||
        b.city.toLowerCase() === selectedCity.toLowerCase() ||
        b.address.toLowerCase().includes(selectedCity.toLowerCase());

      return matchesSearch && matchesCity;
    });
  }, [branches, searchFilter, selectedCity]);

  return (
    <section className="bg-cream py-5">
      <div className="container py-3">
        {/* Section Header */}
        <div className="text-center mb-5 reveal visible">
          <span className="section-tag">{tag}</span>
          <h2 className="section-title">{title}</h2>
          <div className="divider"></div>
          {subtitle && <p className="text-secondary max-w-700 mx-auto">{subtitle}</p>}
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-4 p-3 p-md-4 mb-4 shadow-sm border reveal visible">
          <div className="row g-3 align-items-center justify-content-between">
            {/* Search Input */}
            <div className="col-12 col-md-7 col-lg-6">
              <div className="input-group">
                <span className="input-group-text bg-light border-end-0 text-muted">
                  <i className="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0 bg-light"
                  placeholder="Search by branch name, location or campus code..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
                {searchFilter && (
                  <button
                    className="btn btn-light border border-start-0 text-muted"
                    type="button"
                    onClick={() => setSearchFilter("")}
                  >
                    <i className="bi bi-x-lg"></i>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Filter Badges */}
            <div className="col-12 col-md-5 col-lg-6 d-flex flex-wrap align-items-center justify-content-md-end gap-2">
              <span className="text-muted small fw-semibold me-1">Quick Filter:</span>
              <button
                type="button"
                className={`btn btn-sm rounded-pill px-3 fw-semibold ${
                  selectedCity === "all" ? "btn-navy" : "btn-outline-secondary"
                }`}
                onClick={() => setSelectedCity("all")}
              >
                All Branches ({branches.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm rounded-pill px-3 fw-semibold ${
                  selectedCity === "maruti kunj" ? "btn-navy" : "btn-outline-secondary"
                }`}
                onClick={() => setSelectedCity("maruti kunj")}
              >
                Maruti Kunj
              </button>
              <button
                type="button"
                className={`btn btn-sm rounded-pill px-3 fw-semibold ${
                  selectedCity === "gurugram" ? "btn-navy" : "btn-outline-secondary"
                }`}
                onClick={() => setSelectedCity("gurugram")}
              >
                Gurugram
              </button>
            </div>
          </div>
        </div>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="row g-4 justify-content-center">
            {[1, 2, 3].map((n) => (
              <div className="col-md-6 col-lg-4" key={`branch-skel-${n}`}>
                <div className="card-x branch-card d-flex flex-column h-100 placeholder-glow overflow-hidden shadow-sm border-0">
                  <div
                    className="placeholder w-100 bg-secondary opacity-25"
                    style={{ height: "210px", display: "block" }}
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
                        style={{ height: "38px" }}
                      ></span>
                      <span
                        className="placeholder col-6 bg-secondary opacity-25 rounded-pill d-block"
                        style={{ height: "38px" }}
                      ></span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredBranches.length === 0 ? (
          <div className="text-center py-5 text-muted bg-white rounded-4 border p-4 shadow-sm">
            <i className="bi bi-geo-alt fs-1 text-secondary opacity-50 mb-3 d-block"></i>
            <h5 className="fw-semibold text-navy">No Branches Found Matching Your Search</h5>
            <p className="small text-secondary mb-3">
              Try clearing filters or search keywords, or connect with our head office directly.
            </p>
            <button
              type="button"
              className="btn btn-outline-navy btn-sm rounded-pill px-4 me-2"
              onClick={() => {
                setSearchFilter("");
                setSelectedCity("all");
              }}
            >
              Reset Filters
            </button>
            <Link href="/contact" className="btn btn-navy btn-sm rounded-pill px-4">
              Contact Us
            </Link>
          </div>
        ) : (
          <div className="row g-4 justify-content-center">
            {filteredBranches.map((b, idx) => (
              <div className="col-12 col-md-6 col-lg-4 reveal visible" key={b.id || idx}>
                <article
                  id={b.id}
                  className="card-x branch-card d-flex flex-column h-100 shadow-sm border bg-white rounded-4 overflow-hidden"
                >
                  {/* Branch Artwork / Image */}
                  <div className="branch-img position-relative overflow-hidden" style={{ height: "200px" }}>
                    <img
                      src={b.image}
                      alt={`${b.name} facility`}
                      className="w-100 h-100 object-fit-cover"
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
                    {b.branchCode && (
                      <span className="badge bg-navy text-lime position-absolute top-0 end-0 m-2 px-2.5 py-1 rounded-pill small fw-semibold shadow-sm">
                        {b.branchCode}
                      </span>
                    )}
                  </div>

                  <div className="p-4 d-flex flex-column flex-grow-1 justify-content-between">
                    <div>
                      <h4 className="h5 fw-bold mb-2 text-navy">{b.name}</h4>

                      {/* Facilities Badges */}
                      {b.facilities && b.facilities.length > 0 && (
                        <div className="d-flex flex-wrap gap-1 mb-3">
                          {b.facilities.map((fac, fIdx) => (
                            <span
                              key={fIdx}
                              className="facility-pill badge bg-light text-navy border"
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 600,
                                color: "var(--navy)",
                                backgroundColor: "#f1f5f9",
                                borderColor: "#cbd5e1",
                              }}
                            >
                              <span className="check-icon me-1">✓</span>
                              <span>{fac}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      <ul className="branch-meta list-unstyled mb-0 small">
                        <li className="d-flex align-items-start gap-2 mb-2">
                          <i className="bi bi-geo-alt text-red flex-shrink-0 mt-0.5"></i>
                          <span className="text-secondary">{b.address}</span>
                        </li>
                        <li className="d-flex align-items-center gap-2 mb-2">
                          <i className="bi bi-telephone text-red flex-shrink-0"></i>
                          <a href={`tel:${b.phone}`} className="fw-semibold text-navy text-decoration-none">
                            {b.phone}
                          </a>
                        </li>
                        {b.email && (
                          <li className="d-flex align-items-center gap-2 mb-2">
                            <i className="bi bi-envelope text-red flex-shrink-0"></i>
                            <a href={`mailto:${b.email}`} className="text-secondary text-truncate text-decoration-none">
                              {b.email}
                            </a>
                          </li>
                        )}
                        <li className="d-flex align-items-center gap-2 mb-1">
                          <i className="bi bi-clock text-red flex-shrink-0"></i>
                          <span className="text-secondary">{b.hours}</span>
                        </li>
                      </ul>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-top mt-3">
                      <div className="d-flex gap-2 mb-2">
                        <a
                          href={`tel:${b.phone}`}
                          className="btn btn-navy btn-sm flex-fill rounded-pill fw-semibold py-1.5"
                        >
                          <i className="bi bi-telephone-fill me-1"></i> Call Now
                        </a>
                        <a
                          href={b.directionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-outline-navy btn-sm flex-fill rounded-pill fw-semibold py-1.5"
                        >
                          <i className="bi bi-compass-fill me-1"></i> Directions
                        </a>
                      </div>
                      <Link
                        href={`/contact?branch=${encodeURIComponent(b.name)}`}
                        className="btn btn-outline-danger btn-sm w-100 rounded-pill fw-semibold py-1.5"
                      >
                        <i className="bi bi-calendar-check me-1"></i> Book Free Trial at This Branch
                      </Link>
                    </div>
                  </div>
                </article>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
