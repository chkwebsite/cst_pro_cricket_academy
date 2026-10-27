import Link from "next/link";
import pool from "@/app/components/lib/db";
import PageHeader from "../../components/layout/PageHeader";

async function getCoach(id) {
  try {
    const [rows] = await pool.query(
      `SELECT
          c.*,
          CONCAT_WS(' ', u.first_name, u.last_name) AS coach_name,
          u.first_name,
          u.last_name,
          u.email,
          u.phone,
          u.profile_image,
          u.user_type,
          a.academy_name,
          b.branch_name
       FROM cst_coaches c
       LEFT JOIN cst_users u ON u.id = c.user_id
       LEFT JOIN cst_academy a ON a.id = c.academy_id
       LEFT JOIN cst_branch b ON b.id = c.branch_id
       WHERE c.id = ?
         AND c.is_deleted = 0
         AND (c.academy_id = 1 OR c.academy_id IS NULL)
       LIMIT 1`,
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (err) {
    console.error("Error fetching coach detail:", err);
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const coach = await getCoach(id);

  if (!coach) {
    return {
      title: "Coach Not Found | ST Cricket Academy",
    };
  }

  return {
    title: `${coach.coach_name || "Coach"} - Profile | ST Cricket Academy`,
    description:
      coach.bio ||
      `Learn more about ${coach.coach_name || "our coach"}, ${
        coach.specialization || "Cricket Specialist"
      } at ST Cricket Academy.`,
  };
}

export default async function CoachDetailPage({ params }) {
  const { id } = await params;
  const coach = await getCoach(id);

  if (!coach) {
    return (
      <>
        <PageHeader
          title="Coach Not Found"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Coaches", href: "/coaches" },
          ]}
          current="Not Found"
        />
        <section className="bg-cream">
          <div className="container py-5 text-center">
            <div
              className="bg-white rounded-4 shadow-sm p-5 mx-auto"
              style={{ maxWidth: "560px" }}
            >
              <i className="bi bi-person-x display-1 text-danger mb-3"></i>
              <h2 className="mb-3">Coach Profile Not Available</h2>
              <p className="text-secondary mb-4">
                The coach profile you are looking for may have been updated or is no longer listed.
              </p>
              <Link href="/coaches" className="btn btn-red px-4">
                View All Coaches
              </Link>
            </div>
          </div>
        </section>
      </>
    );
  }

  const specializations = coach.specialization
    ? coach.specialization.split(",").map((s) => s.trim()).filter(Boolean)
    : ["All Rounder"];

  const initials = (coach.coach_name || "Coach")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <PageHeader
        title={coach.coach_name || "Coach Profile"}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Coaches", href: "/coaches" },
        ]}
        current={coach.coach_name || "Profile"}
      />

      <section className="bg-cream">
        <div className="container">
          <div className="row g-4 g-lg-5">
            {/* Left Column: Coach Identity Card */}
            <div className="col-lg-4">
              <div
                className="bg-white rounded-4 shadow-sm p-4 text-center sticky-top border border-light"
                style={{ top: "110px", zIndex: 10 }}
              >
                <div
                  className="coach-avatar g1 mx-auto overflow-hidden position-relative shadow"
                  style={{
                    width: "150px",
                    height: "150px",
                    margin: "10px auto 18px",
                    border: "5px solid #fff",
                    boxShadow: "0 8px 24px rgba(6,47,56,0.18)",
                  }}
                >
                  {coach.profile_image ? (
                    <img
                      src={coach.profile_image}
                      alt={coach.coach_name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        fontSize: "2.8rem",
                        fontFamily: "var(--font-oswald), sans-serif",
                        color: "#fff",
                      }}
                    >
                      {initials}
                    </span>
                  )}
                </div>

                <h2
                  className="h4 fw-bold mb-1"
                  style={{
                    color: "var(--navy)",
                    fontFamily: "var(--font-oswald), sans-serif",
                    letterSpacing: "0.5px",
                  }}
                >
                  {coach.coach_name}
                </h2>

                <div
                  className="text-red fw-bold text-uppercase small mb-2"
                  style={{ letterSpacing: "1px" }}
                >
                  {specializations.join(" & ")} Coach
                </div>

                {coach.coach_code && (
                  <span className="badge bg-light text-secondary border px-3 py-1.5 rounded-pill small mb-3">
                    ID: {coach.coach_code}
                  </span>
                )}

                <hr className="my-3 opacity-25" />

                {/* Contact & Location Details */}
                <div className="contact-info text-start small mb-4">
                  <div className="d-flex align-items-center mb-3">
                    <i className="bi bi-geo-alt-fill"></i>
                    <div>
                      <strong className="d-block text-dark">Academy Location</strong>
                      <span className="text-secondary">
                        {coach.academy_name || "ST Cricket Academy"}
                        {coach.branch_name ? ` • ${coach.branch_name}` : ""}
                      </span>
                    </div>
                  </div>

                  {coach.email && (
                    <div className="d-flex align-items-center mb-3">
                      <i className="bi bi-envelope-fill"></i>
                      <div>
                        <strong className="d-block text-dark">Email</strong>
                        <a
                          href={`mailto:${coach.email}`}
                          className="text-secondary text-break"
                        >
                          {coach.email}
                        </a>
                      </div>
                    </div>
                  )}

                  {coach.phone && (
                    <div className="d-flex align-items-center mb-3">
                      <i className="bi bi-telephone-fill"></i>
                      <div>
                        <strong className="d-block text-dark">Contact Phone</strong>
                        <a href={`tel:${coach.phone}`} className="text-secondary">
                          {coach.phone}
                        </a>
                      </div>
                    </div>
                  )}

                  <div className="d-flex align-items-center mb-3">
                    <i className="bi bi-person-badge-fill"></i>
                    <div>
                      <strong className="d-block text-dark">Engagement</strong>
                      <span className="text-secondary">
                        {coach.employment_type || "Full Time"}
                      </span>
                    </div>
                  </div>

                  {coach.experience_years && Number(coach.experience_years) > 0 && (
                    <div className="d-flex align-items-center">
                      <i className="bi bi-award-fill"></i>
                      <div>
                        <strong className="d-block text-dark">Experience</strong>
                        <span className="text-secondary">
                          {Number(coach.experience_years)} Years Active Coaching
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="d-grid gap-2">
                  <Link href="/contact" className="btn btn-red w-100 py-2.5">
                    Book Training Session
                  </Link>
                  <Link
                    href="/coaches"
                    className="btn btn-outline-dark rounded-pill w-100 py-2"
                  >
                    <i className="bi bi-arrow-left me-1"></i> View All Coaches
                  </Link>
                </div>
              </div>
            </div>

            {/* Right Column: Detailed Credentials, Bio & Highlights */}
            <div className="col-lg-8">
              {/* Highlight Stats Row using ST Academy .stat-card */}
              <div className="row g-3 mb-4">
                <div className="col-6 col-md-3">
                  <div className="stat-card p-3">
                    <div className="num" style={{ fontSize: "2.2rem" }}>
                      {Number(coach.experience_years || 0)}
                    </div>
                    <small>Years Exp.</small>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="stat-card p-3">
                    <div
                      className="num text-truncate"
                      style={{ fontSize: "1.3rem", lineHeight: "2.2rem" }}
                    >
                      {specializations[0] || "All Round"}
                    </div>
                    <small>Speciality</small>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="stat-card p-3">
                    <div
                      className="num text-truncate"
                      style={{ fontSize: "1.25rem", lineHeight: "2.2rem" }}
                    >
                      {coach.employment_type || "Full Time"}
                    </div>
                    <small>Engagement</small>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="stat-card p-3">
                    <div
                      className="num text-success"
                      style={{ fontSize: "1.3rem", lineHeight: "2.2rem" }}
                    >
                      Active
                    </div>
                    <small>Status</small>
                  </div>
                </div>
              </div>

              {/* Bio & Coaching Philosophy */}
              <div className="bg-white rounded-4 shadow-sm p-4 p-md-5 mb-4 border border-light">
                <span className="section-tag">Coaching Profile</span>
                <h3 className="section-title mb-2">About {coach.coach_name}</h3>
                <div className="divider"></div>
                <div
                  className="text-secondary fs-6"
                  style={{ lineHeight: "1.85", whiteSpace: "pre-line" }}
                >
                  {coach.bio ||
                    `Coach ${coach.coach_name} is an integral member of the coaching panel at ${
                      coach.academy_name || "ST Cricket Academy"
                    }, specializing in ${specializations.join(
                      " and "
                    )} development. With ${
                      coach.experience_years || "multiple"
                    } years of dedicated mentorship experience, they help junior, intermediate, and advanced players master modern cricketing techniques, game awareness, and winning match temperament.`}
                </div>
              </div>

              {/* Core Disciplines & Focus Areas */}
              <div className="bg-white rounded-4 shadow-sm p-4 p-md-5 mb-4 border border-light">
                <span className="section-tag">Specialization</span>
                <h3 className="section-title mb-2">Core Disciplines</h3>
                <div className="divider"></div>
                <div className="row g-3">
                  {specializations.map((spec, i) => (
                    <div className="col-sm-6" key={i}>
                      <div className="p-3 bg-cream rounded-3 d-flex align-items-center gap-3">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center text-white flex-shrink-0"
                          style={{
                            width: "42px",
                            height: "42px",
                            background: "var(--red)",
                          }}
                        >
                          <i className="bi bi-check-lg fs-5"></i>
                        </div>
                        <div>
                          <strong className="d-block text-navy">
                            {spec} Coaching
                          </strong>
                          <small className="text-muted">
                            Specialized drills & technique enhancement
                          </small>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Credentials & Qualifications */}
              <div className="bg-white rounded-4 shadow-sm p-4 p-md-5 mb-4 border border-light">
                <span className="section-tag">Credentials</span>
                <h3 className="section-title mb-2">Qualifications & Background</h3>
                <div className="divider"></div>
                <div className="row g-3">
                  {coach.qualification && (
                    <div className="col-md-6">
                      <div className="p-3 bg-cream rounded-3 h-100">
                        <span className="text-muted small text-uppercase fw-semibold d-block">
                          Highest Qualification
                        </span>
                        <strong className="fs-6 text-navy mt-1 d-block">
                          {coach.qualification}
                        </strong>
                      </div>
                    </div>
                  )}

                  {coach.previous_academy && (
                    <div className="col-md-6">
                      <div className="p-3 bg-cream rounded-3 h-100">
                        <span className="text-muted small text-uppercase fw-semibold d-block">
                          Previous Academy / Club
                        </span>
                        <strong className="fs-6 text-navy mt-1 d-block">
                          {coach.previous_academy}
                        </strong>
                      </div>
                    </div>
                  )}

                  {coach.certifications && (
                    <div className="col-12">
                      <div className="p-3 bg-cream rounded-3">
                        <span className="text-muted small text-uppercase fw-semibold d-block">
                          Certifications & Accreditations
                        </span>
                        <div className="text-secondary mt-1">
                          {coach.certifications}
                        </div>
                      </div>
                    </div>
                  )}

                  {coach.gender && (
                    <div className="col-md-6">
                      <div className="p-3 bg-cream rounded-3 h-100">
                        <span className="text-muted small text-uppercase fw-semibold d-block">
                          Gender & Date of Birth
                        </span>
                        <strong className="fs-6 text-navy mt-1 d-block">
                          {coach.gender}{" "}
                          {coach.date_of_birth
                            ? `• ${new Date(
                                coach.date_of_birth
                              ).toLocaleDateString()}`
                            : ""}
                        </strong>
                      </div>
                    </div>
                  )}

                  {coach.joining_date && (
                    <div className="col-md-6">
                      <div className="p-3 bg-cream rounded-3 h-100">
                        <span className="text-muted small text-uppercase fw-semibold d-block">
                          Joined CST Academy
                        </span>
                        <strong className="fs-6 text-navy mt-1 d-block">
                          {new Date(coach.joining_date).toLocaleDateString()}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Training Programs CTA Card */}
              <div
                className="rounded-4 p-4 p-md-5 text-white"
                style={{
                  background:
                    "linear-gradient(135deg, #062f38 0%, #0a4a55 100%)",
                  boxShadow: "var(--shadow)",
                }}
              >
                <div className="row align-items-center g-3">
                  <div className="col-lg-8">
                    <span className="section-tag text-lime mb-2 d-inline-block">
                      Personal Mentorship
                    </span>
                    <h3
                      className="text-white mb-2"
                      style={{ fontFamily: "var(--font-oswald), sans-serif" }}
                    >
                      Ready to Train Under Coach{" "}
                      {coach.first_name || coach.coach_name}?
                    </h3>
                    <p className="text-white-50 mb-0">
                      Enroll in regular batches, summer camps, or book personalized one-on-one sessions at{" "}
                      {coach.branch_name || "our academy facilities"}.
                    </p>
                  </div>
                  <div className="col-lg-4 text-lg-end">
                    <Link href="/contact" className="btn btn-red px-4 py-2.5">
                      Enquire Today
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
