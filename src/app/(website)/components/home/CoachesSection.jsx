"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const GRADIENT_CLASSES = ["g1", "g2", "g3", "g4", "g5", "g6"];

const FALLBACK_COACHES = [
  {
    id: 1,
    initials: "DW",
    gradientClass: "g1",
    name: "Deepak Walia",
    role: "Batting & Fitness Coach",
  },
  {
    id: 2,
    initials: "RK",
    gradientClass: "g2",
    name: "Rajneesh Kumar",
    role: "Batting Specialist",
  },
  {
    id: 3,
    initials: "RS",
    gradientClass: "g3",
    name: "Rajesh Sharma",
    role: "Chief Mentor",
  },
  {
    id: 4,
    initials: "AK",
    gradientClass: "g4",
    name: "Anil Kapoor",
    role: "Bowling Coach",
  },
];

export default function CoachesSection({
  tag = "Our Team",
  title = "Meet the Coaches",
  coaches: propCoaches = null,
  buttonText = "All Coaches",
  buttonLink = "/coaches",
}) {
  const [coaches, setCoaches] = useState(propCoaches || []);
  const [loading, setLoading] = useState(!propCoaches);
  const [failedImages, setFailedImages] = useState({});

  useEffect(() => {
    if (propCoaches && propCoaches.length > 0) {
      setCoaches(propCoaches);
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function loadHomeCoaches() {
      try {
        const res = await fetch("/api/coaches?academy_id=1&status=1");
        if (!isMounted) return;

        const json = await res.json();
        if (
          isMounted &&
          res.ok &&
          json.success &&
          Array.isArray(json.data) &&
          json.data.length > 0
        ) {
          const list = json.data.slice(0, 4).map((c, idx) => {
            const initials = (c.coach_name || "Coach")
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();

            const specs = c.specialization
              ? c.specialization
                  .split(",")
                  .map((s) => s.trim())
                  .slice(0, 2)
                  .join(" & ") + " Coach"
              : "Cricket Coach";

            return {
              id: c.id,
              initials,
              gradientClass: GRADIENT_CLASSES[idx % GRADIENT_CLASSES.length],
              name: c.coach_name || "Cricket Coach",
              role: specs,
              profile_image: c.profile_image || null,
            };
          });
          setCoaches(list);
        } else if (isMounted && (!coaches || coaches.length === 0)) {
          setCoaches(FALLBACK_COACHES);
        }
      } catch (err) {
        if (!isMounted) return;
        if (!coaches || coaches.length === 0) {
          setCoaches(FALLBACK_COACHES);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadHomeCoaches();
    return () => {
      isMounted = false;
    };
  }, [propCoaches]);

  return (
    <section className="bg-navy">
      <div className="container">
        <div className="text-center mb-5 reveal visible">
          <span className="section-tag text-lime">{tag}</span>
          <h2 className="section-title text-white">{title}</h2>
          <div className="divider"></div>
        </div>

        {loading ? (
          <div className="row g-4 justify-content-center">
            {[1, 2, 3, 4].map((n) => (
              <div className="col-sm-6 col-lg-3" key={`coach-skel-${n}`}>
                <div className="card-x coach-card text-dark h-100 d-flex flex-column justify-content-between p-3 placeholder-glow border-0 shadow-sm">
                  <div className="text-center pt-2">
                    <div
                      className="placeholder rounded-circle bg-secondary opacity-25 mx-auto mb-3"
                      style={{ width: "96px", height: "96px", display: "block" }}
                    ></div>
                    <span
                      className="placeholder col-8 bg-secondary opacity-25 rounded mb-2 d-inline-block"
                      style={{ height: "20px" }}
                    ></span>
                    <span className="placeholder col-6 bg-secondary opacity-25 rounded d-inline-block"></span>
                  </div>
                  <div className="pt-3 mt-auto text-center">
                    <span
                      className="placeholder col-8 rounded-pill bg-secondary opacity-25 d-inline-block"
                      style={{ height: "30px" }}
                    ></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="row g-4 justify-content-center">
            {coaches.map((coach, idx) => (
              <div className="col-sm-6 col-lg-3 reveal visible" key={coach.id || idx}>
                <Link
                  href={coach.id ? `/coaches/${coach.id}` : "/coaches"}
                  className="text-decoration-none d-block h-100"
                >
                  <div className="card-x coach-card text-dark h-100 d-flex flex-column justify-content-between p-3">
                    <div>
                      <div
                        className={`coach-avatar ${coach.gradientClass} overflow-hidden position-relative shadow-sm`}
                      >
                        {coach.profile_image && !failedImages[coach.id] ? (
                          <img
                            src={coach.profile_image}
                            alt={coach.name}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                            onError={() => {
                              setFailedImages((prev) => ({
                                ...prev,
                                [coach.id]: true,
                              }));
                            }}
                          />
                        ) : (
                          coach.initials
                        )}
                      </div>
                      <h5 className="mb-1 text-dark">{coach.name}</h5>
                      <div className="role">{coach.role}</div>
                    </div>
                    <div className="pt-3 mt-auto">
                      <span className="btn btn-sm btn-outline-dark rounded-pill px-3 py-1 small fw-semibold">
                        View Profile <i className="bi bi-arrow-right ms-1"></i>
                      </span>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-5 reveal visible">
          <Link href={buttonLink} className="btn btn-outline-light btn-lg">
            {buttonText} <i className="bi bi-arrow-right ms-1"></i>
          </Link>
        </div>
      </div>
    </section>
  );
}
