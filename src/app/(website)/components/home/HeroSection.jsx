import Link from "next/link";

export default function HeroSection({
  badge = "ADMISSIONS OPEN 2026-27",
  description = "Professional cricket coaching, world-class facilities, and expert guidance to transform your cricketing potential into performance.",
  primaryBtn = {
    text: "Book Free Trial",
    href: "/book-free-trial",
  },
  secondaryBtn = {
    text: "Explore Programs",
    href: "/programs",
  },
  checks = [
    "Certified Coaches",
    "Professional Turf & Nets",
    "All Ages & Skill Levels",
  ],
  heroImage = "/assets/img/hero-player.png",
  heroImageAlt = "CST Cricket Academy player playing a cover drive",
}) {
  return (
    <section className="hero" id="top">
      <div className="hero__bg" aria-hidden="true"></div>
      <div className="hero__grid" aria-hidden="true"></div>
      <div className="container hero__inner">
        <div>
          <span className="pill">
            <i aria-hidden="true"></i>
            {badge}
          </span>
          <h1>
            <span className="line">
              <span>TRAIN LIKE A</span>
            </span>
            <span className="line">
              <span>CHAMPION.</span>
            </span>
            <span className="line">
              <span className="red">PLAY LIKE A PRO.</span>
            </span>
          </h1>
          <p className="lead">{description}</p>
          <div className="hero__cta">
            <Link className="btn btn--red" href={primaryBtn.href}>
              {primaryBtn.text}
            </Link>
            <Link className="btn btn--ghost" href={secondaryBtn.href}>
              {secondaryBtn.text}{" "}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </Link>
          </div>
          {checks && checks.length > 0 && (
            <ul className="checks">
              {checks.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="hero__visual">
          <div className="hero__ring" aria-hidden="true"></div>
          <div className="hero__orb">
            <img
              src={heroImage}
              alt={heroImageAlt}
              width="442"
              height="419"
              fetchPriority="high"
            />
          </div>
          <div className="chip chip--a">
            <b>25+</b>Years of Experience
          </div>
          <div className="chip chip--b">
            <b>Turf &amp; Astro</b>Pitches
          </div>
        </div>
      </div>
    </section>
  );
}
