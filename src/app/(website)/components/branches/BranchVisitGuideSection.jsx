import Link from "next/link";

export default function BranchVisitGuideSection({
  tag = "How It Works",
  title = "Visit & Enrollment Process",
  subtitle = "Joining CST Pro Cricket Academy is simple and transparent. Here is how you can visit any of our branches and begin your cricket training journey.",
}) {
  const steps = [
    {
      step: "01",
      icon: "bi-geo-alt",
      title: "Select Your Nearest Branch",
      desc: "Browse our branch centers in Gurugram / Maruti Kunj and pick the one nearest to your home or school for regular daily travel ease.",
      note: "Campus maps & directions available above",
    },
    {
      step: "02",
      icon: "bi-calendar-check",
      title: "Book a Complimentary Trial",
      desc: "Reserve a 60-minute free trial session via our online enquiry form or direct phone call. Experience the turf nets and meet our coaching staff.",
      note: "100% Free · No upfront fee required",
    },
    {
      step: "03",
      icon: "bi-clipboard2-check",
      title: "Skill Assessment & Batch Allotment",
      desc: "Our BCCI-certified senior coach reviews your batting/bowling basics, fitness level, and recommends the appropriate age-group batch.",
      note: "Personalized development plan",
    },
    {
      step: "04",
      icon: "bi-trophy",
      title: "Collect Kit & Start Training",
      desc: "Finalize registration, receive your official academy training jersey, player ID card, and start regular training sessions on the pitch.",
      note: "Welcome to the CST Pro family",
    },
  ];

  return (
    <section className="bg-white py-5 border-top">
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

        {/* Steps Grid */}
        <div className="row g-4">
          {steps.map((st, idx) => (
            <div className="col-12 col-md-6 col-lg-3 reveal" key={idx}>
              <div className="card-x h-100 p-4 rounded-4 bg-light border shadow-sm d-flex flex-column justify-content-between position-relative overflow-hidden">
                {/* Step Number Background Accent */}
                <span
                  className="position-absolute end-0 top-0 fw-bold text-navy opacity-10 pe-3 pt-2"
                  style={{ fontSize: "3.5rem", lineHeight: 1, userSelect: "none" }}
                >
                  {st.step}
                </span>

                <div>
                  <div
                    className="d-inline-flex align-items-center justify-content-center rounded-circle bg-navy text-lime mb-3 shadow-sm"
                    style={{ width: "50px", height: "50px", fontSize: "1.3rem" }}
                  >
                    <i className={`bi ${st.icon}`}></i>
                  </div>

                  <span className="badge bg-white text-danger border small fw-bold mb-2 d-inline-block">
                    STEP {st.step}
                  </span>

                  <h5 className="fw-bold text-navy mb-2 fs-6">{st.title}</h5>
                  <p className="text-secondary small mb-3 lh-base">{st.desc}</p>
                </div>

                <div className="pt-2 border-top">
                  <span className="text-muted small d-inline-flex align-items-center gap-1" style={{ fontSize: "0.75rem" }}>
                    <i className="bi bi-info-circle text-navy"></i>
                    {st.note}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action Button */}
        <div className="text-center mt-5">
          <Link
            href="/contact"
            className="btn btn-navy btn-md rounded-pill px-4 me-2 mb-2 shadow-sm"
          >
            <i className="bi bi-calendar-check me-1"></i> Book a Free Trial Session
          </Link>
          <a
            href="tel:+918285831503"
            className="btn btn-outline-danger btn-md rounded-pill px-4 mb-2"
          >
            <i className="bi bi-telephone-fill me-1"></i> Speak With Branch Coordinator
          </a>
        </div>
      </div>
    </section>
  );
}
