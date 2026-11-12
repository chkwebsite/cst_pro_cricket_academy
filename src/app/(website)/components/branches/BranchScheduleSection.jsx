import Link from "next/link";

export default function BranchScheduleSection({
  tag = "Batch Timings",
  title = "Universal Training Schedule",
  subtitle = "Our training centers operate morning and evening shifts 6 days a week, offering flexible batch options for school students, college athletes, and working professionals.",
}) {
  const schedules = [
    {
      title: "Morning Elite Performance Batch",
      days: "Tuesday to Sunday",
      hours: "06:00 AM – 09:00 AM",
      badge: "Competitive",
      badgeClass: "bg-danger text-white",
      description:
        "High-intensity morning session focused on stamina conditioning, running between wickets, dedicated net sessions against pace & spin, and tactical match simulation.",
      idealFor: "State/District aspirants, U-16, U-19, and senior competitive cricketers.",
      highlights: [
        "45 mins physical conditioning & agility",
        "Dedicated turf net practice",
        "Specialized bowling machine sessions",
      ],
    },
    {
      title: "Evening Regular Academy Batch",
      days: "Tuesday to Saturday",
      hours: "04:00 PM – 07:00 PM",
      badge: "Most Popular",
      badgeClass: "bg-success text-white",
      description:
        "The primary developmental batch tailored for school and academy students. Covers technical batting drills, bowling run-up calibration, wicketkeeping, and ground fielding.",
      idealFor: "School students, age-group cricketers (U-12, U-14, U-16).",
      highlights: [
        "Structured strokeplay & grip fundamentals",
        "Targeted fielding & reflex catching drills",
        "Weekly performance assessment logs",
      ],
    },
    {
      title: "Weekend Junior & Grassroots Batch",
      days: "Saturday & Sunday",
      hours: "07:00 AM – 10:30 AM",
      badge: "Grassroots",
      badgeClass: "bg-warning text-dark",
      description:
        "Designed specifically for young beginners and working students. Focuses on hand-eye coordination, love for the game, cricket basics, and fun competitive mini-games.",
      idealFor: "Beginners aged 6 to 14 seeking weekend skill development.",
      highlights: [
        "Foundational batting and bowling basics",
        "Mini-match scenario games",
        "Safety gear training & basics",
      ],
    },
    {
      title: "Sunday Match Day & Tournament Fixtures",
      days: "Every Sunday",
      hours: "07:00 AM – 06:00 PM",
      badge: "Match Practice",
      badgeClass: "bg-navy text-lime",
      description:
        "Full 30-Over, 40-Over, and T20 inter-branch and academy league matches with certified umpires, turf wickets, colored kits, and real-time electronic scorecard updates.",
      idealFor: "All enrolled academy players eligible for match exposure.",
      highlights: [
        "Live tournament pressure simulation",
        "Video camera match recording",
        "Post-match coach debrief & scorecard review",
      ],
    },
  ];

  return (
    <section className="bg-cream py-5">
      <div className="container py-3">
        {/* Header */}
        <div className="text-center mb-5 reveal">
          <span className="section-tag">{tag}</span>
          <h2 className="section-title">{title}</h2>
          <div className="divider"></div>
          {subtitle && (
            <p className="text-secondary max-w-700 mx-auto">{subtitle}</p>
          )}
        </div>

        {/* Schedule Cards */}
        <div className="row g-4">
          {schedules.map((item, idx) => (
            <div className="col-12 col-lg-6 reveal" key={idx}>
              <div className="card-x h-100 p-4 p-md-4 rounded-4 bg-white shadow-sm border d-flex flex-column justify-content-between">
                <div>
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                    <span className={`badge px-3 py-1.5 rounded-pill small fw-semibold ${item.badgeClass}`}>
                      {item.badge}
                    </span>
                    <span className="text-muted small d-inline-flex align-items-center gap-1">
                      <i className="bi bi-calendar3 text-red"></i>
                      <strong>{item.days}</strong>
                    </span>
                  </div>

                  <h4 className="fw-bold text-navy mb-2 fs-5">{item.title}</h4>

                  <div className="d-inline-flex align-items-center gap-2 bg-light px-3 py-1.5 rounded-3 mb-3 border">
                    <i className="bi bi-clock-history text-red"></i>
                    <span className="fw-bold text-navy small">{item.hours}</span>
                  </div>

                  <p className="text-secondary small mb-3">{item.description}</p>

                  <div className="mb-3">
                    <span className="text-dark fw-semibold small d-block mb-1">
                      Session Highlights:
                    </span>
                    <ul className="list-unstyled mb-0 small text-secondary">
                      {item.highlights.map((hl, hIdx) => (
                        <li key={hIdx} className="d-flex align-items-center gap-2 mb-1">
                          <i className="bi bi-check2-circle text-success flex-shrink-0"></i>
                          <span>{hl}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-3 border-top mt-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
                  <span className="small text-muted">
                    <em>Ideal for: {item.idealFor}</em>
                  </span>
                  <Link
                    href="/contact"
                    className="btn btn-outline-navy btn-sm rounded-pill px-3"
                  >
                    Enquire for this Batch <i className="bi bi-arrow-right ms-1"></i>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Schedule Notice */}
        <div className="text-center mt-4 text-muted small">
          <i className="bi bi-info-circle me-1 text-red"></i>
          Batches are assigned strictly by age and skill level following a complimentary coach assessment. Private 1-on-1 personalized sessions can also be scheduled at any branch outside regular batch hours.
        </div>
      </div>
    </section>
  );
}
