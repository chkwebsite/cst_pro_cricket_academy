import Link from "next/link";

export default function BranchCtaSection() {
  return (
    <section className="bg-navy py-5 text-white position-relative overflow-hidden">
      <div className="container py-4 position-relative z-1">
        <div className="row align-items-center justify-content-between g-4">
          <div className="col-12 col-lg-7 text-center text-lg-start">
            <span className="badge bg-lime text-navy px-3 py-1.5 rounded-pill small fw-bold mb-3 text-uppercase">
              Take the Pitch With Confidence
            </span>
            <h2 className="display-6 fw-bold mb-3 text-white">
              Ready to Visit Your Nearest CST Pro Cricket Branch?
            </h2>
            <p className="lead text-white-50 mb-4 fs-6 max-w-600">
              Schedule your complimentary 60-minute skill evaluation today. Inspect our turf pitches, meet our BCCI-certified coaches, and find the perfect training batch for your cricket ambitions.
            </p>
            <div className="d-flex flex-wrap align-items-center justify-content-center justify-content-lg-start gap-3">
              <Link
                href="/contact"
                className="btn btn-red btn-md rounded-pill px-4 py-2.5 fw-semibold shadow-sm"
              >
                <i className="bi bi-calendar-check me-1"></i> Book a Free Trial Session
              </Link>
              <a
                href="tel:+918285831503"
                className="btn btn-outline-light btn-md rounded-pill px-4 py-2.5 fw-semibold"
              >
                <i className="bi bi-telephone-fill me-1"></i> Call +91 8285831503
              </a>
              <Link
                href="/ground-booking"
                className="btn btn-outline-lime btn-md rounded-pill px-4 py-2.5 fw-semibold text-lime border-lime"
              >
                <i className="bi bi-trophy me-1"></i> Book Match Ground
              </Link>
            </div>
          </div>

          <div className="col-12 col-lg-5">
            <div className="bg-white bg-opacity-10 rounded-4 p-4 p-md-4 border border-white border-opacity-25 shadow-lg backdrop-blur">
              <h5 className="fw-bold text-lime mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-clock-history fs-5"></i>
                Quick Campus Tour Checklist
              </h5>
              <ul className="list-unstyled mb-4 small text-white-75">
                <li className="d-flex align-items-start gap-2 mb-2">
                  <i className="bi bi-check-circle-fill text-lime flex-shrink-0 mt-0.5"></i>
                  <span>Inspect our international-spec turf &amp; cement practice nets</span>
                </li>
                <li className="d-flex align-items-start gap-2 mb-2">
                  <i className="bi bi-check-circle-fill text-lime flex-shrink-0 mt-0.5"></i>
                  <span>Test out our computerized BOLA bowling machine setup</span>
                </li>
                <li className="d-flex align-items-start gap-2 mb-2">
                  <i className="bi bi-check-circle-fill text-lime flex-shrink-0 mt-0.5"></i>
                  <span>Discuss personalized batting &amp; bowling goals with head coaches</span>
                </li>
                <li className="d-flex align-items-start gap-2 mb-0">
                  <i className="bi bi-check-circle-fill text-lime flex-shrink-0 mt-0.5"></i>
                  <span>Learn about van routes, hostel rooms, and weekend match leagues</span>
                </li>
              </ul>
              <div className="pt-3 border-top border-white border-opacity-25 d-flex align-items-center justify-content-between">
                <span className="small text-white-50">Operational Hours:</span>
                <span className="badge bg-white text-navy fw-bold small">
                  Mon–Sun · 6:00 AM – 8:00 PM
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
