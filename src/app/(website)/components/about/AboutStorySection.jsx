export default function AboutStorySection({
  tag = "Our Story",
  title = "More Than a Cricket Academy",
  paragraphs = [
    "Founded with a simple belief that every young cricketer deserves quality coaching, CST Cricket Academy has grown into a multi-centre training hub. Our programme combines classical technique, match awareness and modern sports science.",
    "We focus on the whole player: skill, fitness, discipline and mindset, so our students grow into confident cricketers and better people.",
  ],
  bulletPoints = [
    "Certified and experienced coaching panel",
    "Turf wickets, astro pitches and bowling machines",
    "Fitness, nutrition and mental conditioning support",
  ],
  mainImage = "/images/website/program-one-to-two.jpg",
  mainImageAlt = "Coach correcting a young batter's stance in the nets",
  insetImage = "/images/website/program-high-performance.jpg",
  insetImageAlt = "Players training on the academy turf ground",
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
                alt={mainImageAlt}
                width="1000"
                height="746"
                loading="lazy"
              />
              <img
                className="inset"
                src={insetImage}
                alt={insetImageAlt}
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
            {paragraphs &&
              paragraphs.map((para, idx) => (
                <p className="text-secondary" key={idx}>
                  {para}
                </p>
              ))}
            {bulletPoints && bulletPoints.length > 0 && (
              <ul className="list-unstyled text-secondary mt-3">
                {bulletPoints.map((point, idx) => (
                  <li className="mb-2" key={idx}>
                    <i className="bi bi-check-circle-fill text-red me-2"></i>
                    {point}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
