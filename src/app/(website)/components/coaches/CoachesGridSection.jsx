"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const GRADIENTS = ["g1", "g2", "g3", "g4", "g5", "g6"];

export default function CoachesGridSection({
  tag = "Elite Coaches",
  title = "Our Coaching Panel",
  subtitle = "Meet our certified cricket coaches, national players, and mentors dedicated to taking your cricket skills to the highest level.",
  coaches: propCoaches = null,
}) {
  const [coaches, setCoaches] = useState(propCoaches || []);
  const [loading, setLoading] = useState(!propCoaches);

  useEffect(() => {
    if (propCoaches && propCoaches.length > 0) {
      setCoaches(propCoaches);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const loadCoaches = async () => {
      try {
        const res = await fetch("/api/coaches?academy_id=1&status=1");
        const json = await res.json();
        if (res.ok && json.success && Array.isArray(json.data) && json.data.length > 0) {
          const mapped = json.data.map((c, idx) => {
            const initials = (c.coach_name || "Coach")
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();

            const role =
              c.specialization
                ? c.specialization
                    .split(",")
                    .map((s) => s.trim())
                    .slice(0, 2)
                    .join(" & ") + " Coach"
                : "Cricket Coach";

            const desc =
              c.bio && c.bio.length > 10
                ? c.bio.slice(0, 95) + (c.bio.length > 95 ? "..." : "")
                : `${c.experience_years ? `${Number(c.experience_years)}+ years coaching experience. ` : ""}${
                    c.qualification ? `${c.qualification}. ` : ""
                  }${c.branch_name ? `Based at ${c.branch_name}.` : ""}`;

            return {
              id: c.id,
              initials,
              gradient: GRADIENTS[idx % GRADIENTS.length],
              name: c.coach_name || "Cricket Coach",
              role,
              desc,
              profile_image: c.profile_image || null,
              experience: c.experience_years,
              branch: c.branch_name,
              socials: [
                { icon: "bi-eye", href: `/coaches/${c.id}`, label: "View Profile" },
                {
                  icon: "bi-telephone",
                  href: c.phone ? `tel:${c.phone}` : `/coaches/${c.id}`,
                  label: "Contact",
                },
              ],
            };
          });

          if (isMounted) {
            setCoaches(mapped);
          }
        }
      } catch (err) {
        console.error("Failed to load website coaches:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadCoaches();
    return () => {
      isMounted = false;
    };
  }, [propCoaches]);

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
              <span className="visually-hidden">Loading Coaches...</span>
            </div>
            <p className="text-muted mt-2 small">Loading coaching staff...</p>
          </div>
        ) : coaches.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <p>Our coaching panel is being updated. Please check back shortly.</p>
          </div>
        ) : (
          <div className="row g-4 justify-content-center">
            {coaches.map((c, idx) => (
              <div className="col-sm-6 col-lg-3 reveal" key={c.id || idx}>
                <div
                  className="card-x coach-card h-100 d-flex flex-column justify-content-between position-relative"
                  style={{ transition: "transform 0.3s ease, box-shadow 0.3s ease" }}
                >
                  <div>
                    <Link
                      href={`/coaches/${c.id}`}
                      className="text-decoration-none d-block"
                    >
                      <div
                        className={`coach-avatar ${c.gradient} position-relative overflow-hidden shadow-sm`}
                      >
                        {c.profile_image ? (
                          <img
                            src={c.profile_image}
                            alt={c.name}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        ) : (
                          c.initials
                        )}
                      </div>
                      <h5 className="mb-1 text-dark hover-primary">{c.name}</h5>
                    </Link>
                    <div className="role">{c.role}</div>
                    <p className="text-secondary small px-3 mt-2 mb-3">
                      {c.desc}
                    </p>
                  </div>

                  <div className="pt-2 border-top border-light mt-auto">
                    <Link
                      href={`/coaches/${c.id}`}
                      className="btn btn-sm btn-outline-dark rounded-pill px-3 py-1 small fw-semibold"
                    >
                      View Profile <i className="bi bi-arrow-right ms-1"></i>
                    </Link>
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
