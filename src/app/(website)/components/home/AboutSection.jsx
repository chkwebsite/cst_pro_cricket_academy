import Link from "next/link";

export default function AboutSection({
  tag = "About the Academy",
  title = "Building Cricketers, Shaping Character",
  description = "CST Cricket Academy blends traditional technique with modern sports science. From first grip to first-class ambition, every player follows a clear development pathway with regular assessments and personal feedback.",
  bulletPoints = [
    "Certified and experienced coaching panel",
    "Turf wickets, astro pitches and bowling machines",
    "Fitness, nutrition and mental conditioning support",
  ],
  buttonText = "Read More",
  buttonLink = "/about",
  mainImage = "/images/website/program-one-to-two.jpg",
  insetImage = "/images/website/program-high-performance.jpg",
  badgeYears = "25+",
  badgeText = "years of excellence",
}) {
  return (
    <section id="about">
      <div className="container">
        <div className="row align-items-center g-4 g-lg-5">
          <div className="col-lg-6 reveal">
            <div className="about-collage">
              <img
                className="main"
                src={mainImage}
                alt="Coach correcting a young batter's stance in the nets"
                width="1000"
                height="746"
                loading="lazy"
              />
              <img
                className="inset"
                src={insetImage}
                alt="Players training on the academy turf ground"
                width="1000"
                height="670"
                loading="lazy"
              />
              <span className="collage-badge">
                <b>{badgeYears}</b> {badgeText}
              </span>
            </div>
          </div>
          <div className="col-lg-6 reveal">
            <span className="section-tag">{tag}</span>
            <h2 className="section-title">{title}</h2>
            <div className="divider"></div>
            <p className="text-secondary">{description}</p>
            {bulletPoints && bulletPoints.length > 0 && (
              <ul className="list-unstyled text-secondary">
                {bulletPoints.map((point, idx) => (
                  <li className="mb-2" key={idx}>
                    <i className="bi bi-check-circle-fill text-red me-2"></i>
                    {point}
                  </li>
                ))}
              </ul>
            )}
            <Link href={buttonLink} className="btn btn-red mt-2">
              {buttonText}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
