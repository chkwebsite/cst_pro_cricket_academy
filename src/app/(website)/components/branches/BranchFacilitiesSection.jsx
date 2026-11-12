import Link from "next/link";

export default function BranchFacilitiesSection({
  tag = "World-Class Infrastructure",
  title = "Standard Amenities Across All Branches",
  subtitle = "Every CST Pro Cricket Academy branch is engineered to deliver professional training environments with international-standard pitches, specialized equipment, and player comfort.",
}) {
  const facilities = [
    {
      icon: "bi-grid-3x3",
      title: "Turf & Cement Practice Wickets",
      desc: "Curated red-soil turf pitches alongside high-bounce cement wickets for complete exposure to pace, bounce, and spin variations.",
      tag: "Pitch Quality",
    },
    {
      icon: "bi-gear-wide-connected",
      title: "BOLA Automated Bowling Machines",
      desc: "Programmable machines delivering speeds up to 140+ km/h with inswing, outswing, and spin for targeted strokeplay perfection.",
      tag: "Technology",
    },
    {
      icon: "bi-lightbulb",
      title: "800-Lux LED Tower Floodlights",
      desc: "Day-standard lighting across practice nets and match grounds for extended evening training and thrilling day-night T20 matches.",
      tag: "Night Training",
    },
    {
      icon: "bi-camera-video",
      title: "Video Biomechanics Analysis",
      desc: "High-frame-rate cameras for slow-motion breakdown of batting backlift, trigger movement, front-foot plant, and bowling release.",
      tag: "Player Tech",
    },
    {
      icon: "bi-activity",
      title: "Cricket Gymnasium & Agility Zone",
      desc: "Custom strength, core stability, running-between-wickets acceleration, and injury-prevention conditioning routines.",
      tag: "Fitness",
    },
    {
      icon: "bi-house-door",
      title: "Residential Hostels & Cafeteria",
      desc: "Clean, air-conditioned accommodation with nutritious high-protein athlete meals and 24/7 warden supervision at our Main Campus.",
      tag: "Boarding",
    },
    {
      icon: "bi-bandaid",
      title: "Physiotherapy & Sports First-Aid",
      desc: "Dedicated sports physiotherapist support, rehabilitation guidance, ice bath recovery, and immediate on-field emergency care.",
      tag: "Health & Safety",
    },
    {
      icon: "bi-trophy",
      title: "Full Match Ground & Dugouts",
      desc: "Lush green boundary-fenced match grounds with electronic digital scoreboards, umpire lounges, and shaded team dugouts.",
      tag: "Match Day",
    },
  ];

  return (
    <section className="bg-white py-5 border-top">
      <div className="container py-3">
        {/* Section Heading */}
        <div className="text-center mb-5 reveal">
          <span className="section-tag">{tag}</span>
          <h2 className="section-title">{title}</h2>
          <div className="divider"></div>
          {subtitle && (
            <p className="text-secondary max-w-700 mx-auto">{subtitle}</p>
          )}
        </div>

        {/* Facilities Grid */}
        <div className="row g-4">
          {facilities.map((fac, idx) => (
            <div className="col-12 col-md-6 col-lg-3 reveal" key={idx}>
              <div className="card-x h-100 p-4 d-flex flex-column justify-content-between border rounded-4 shadow-sm bg-light hover-lift">
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div
                      className="d-inline-flex align-items-center justify-content-center rounded-3 bg-navy text-lime"
                      style={{ width: "48px", height: "48px", fontSize: "1.4rem" }}
                    >
                      <i className={`bi ${fac.icon}`}></i>
                    </div>
                    <span className="badge bg-white text-navy border small fw-semibold">
                      {fac.tag}
                    </span>
                  </div>
                  <h5 className="fw-bold text-navy mb-2 fs-6">{fac.title}</h5>
                  <p className="text-secondary small mb-0 lh-base">{fac.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Facility Highlight Banner */}
        <div className="mt-5 p-4 rounded-4 bg-navy text-white shadow-sm reveal">
          <div className="row align-items-center justify-content-between g-3">
            <div className="col-lg-8">
              <h5 className="fw-bold text-lime mb-1 d-flex align-items-center gap-2">
                <i className="bi bi-shield-check fs-4"></i>
                BCCI Certified Coaching Curriculum at All Centers
              </h5>
              <p className="small text-white-50 mb-0">
                Whether you train at our Main Campus or any regional branch, the coaching methodology, player development benchmarks, and progress tracking remain 100% unified.
              </p>
            </div>
            <div className="col-lg-4 text-lg-end">
              <Link
                href="/programs"
                className="btn btn-lime btn-sm rounded-pill px-4 fw-semibold text-navy"
              >
                View Training Programs <i className="bi bi-arrow-right ms-1"></i>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
