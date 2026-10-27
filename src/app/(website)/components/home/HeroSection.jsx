import Link from "next/link";

export default function HeroSection({
  badge = "Admissions Open 2026-27",
  title = {
    line1: "Train Like a",
    highlight1: "Champion.",
    line2: "Play Like a",
    highlight2: "Pro.",
  },
  description = "Structured, professional cricket coaching for beginners to state-level players, delivered by experienced coaches on quality turf and practice nets.",
  primaryBtn = {
    text: "Book Free Trial",
    href: "/contact",
    icon: "bi-calendar-check",
  },
  secondaryBtn = {
    text: "View Programs",
    href: "/programs",
    icon: "bi-play-circle",
  },
  points = [
    "Certified coaches",
    "Turf & astro pitches",
    "All ages, all levels",
  ],
  heroImage = "/images/website/hero-batter.png",
  heroImageAlt = "ST Cricket Academy batter playing a cover drive",
}) {
  return (
    <header className="hero">
      <div className="container">
        <div className="row align-items-center g-4 g-lg-5">
          <div className="col-lg-6">
            {badge && <span className="hero-badge">{badge}</span>}
            <h1 className="mt-3">
              {title.line1} <span className="text-lime">{title.highlight1}</span>
              <br />
              {title.line2} <span className="text-red">{title.highlight2}</span>
            </h1>
            <p className="lead my-4">{description}</p>
            <div className="hero-actions">
              <Link href={primaryBtn.href} className="btn btn-red">
                <i className={`bi ${primaryBtn.icon}`}></i>
                {primaryBtn.text}
              </Link>
              <Link href={secondaryBtn.href} className="btn btn-outline-light-pill">
                <i className={`bi ${secondaryBtn.icon}`}></i>
                {secondaryBtn.text}
              </Link>
            </div>
            {points && points.length > 0 && (
              <ul className="hero-points">
                {points.map((point, idx) => (
                  <li key={idx}>
                    <i className="bi bi-check-circle-fill"></i>
                    {point}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="col-lg-6">
            <img
              src={heroImage}
              className="hero-art"
              alt={heroImageAlt}
              width="546"
              height="518"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
