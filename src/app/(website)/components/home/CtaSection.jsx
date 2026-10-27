import Link from "next/link";

export default function CtaSection({
  title = "Ready to Start Your Cricket Journey?",
  subtitle = "Book a free trial session and meet our coaches.",
  buttonText = "Book Free Trial",
  buttonLink = "/contact",
  phone = "+91 8285831503",
}) {
  return (
    <section>
      <div className="container">
        <div className="cta text-center reveal">
          <h2>{title}</h2>
          <p className="mb-4">{subtitle}</p>
          <div className="d-flex flex-wrap justify-content-center gap-3">
            <Link href={buttonLink} className="btn btn-outline-light-pill btn-lg">
              {buttonText}
            </Link>
            <a
              href={`tel:${phone.replace(/[^0-9+]/g, "")}`}
              className="btn btn-link text-white fw-semibold fs-5"
            >
              <i className="bi bi-telephone-fill me-2"></i>Call Us
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
