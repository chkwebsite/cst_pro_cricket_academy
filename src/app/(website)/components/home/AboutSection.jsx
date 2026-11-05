import Link from "next/link";

export default function AboutSection({
  tag = "About the Academy",
  description = "CST Cricket Academy blends traditional technique with modern sports science. From first grip to first-class ambition, every player follows a clear development pathway with regular assessments and personal feedback.",
  bulletPoints = [
    "Certified and experienced coaching panel",
    "Turf wickets, astro pitches and bowling machines",
    "Fitness, nutrition and mental conditioning support",
  ],
  buttonText = "Read More",
  buttonLink = "/about",
}) {
  return (
    <section className="section" id="about">
      <div className="container split">
        <div className="collage" data-reveal="left">
          <div className="media c1">
            <img
              src="/assets/img/about-1.jpg"
              alt="Academy players warming up on the main ground"
              loading="lazy"
              width="1000"
              height="670"
            />
          </div>
          <div className="media c3">
            <img
              src="/assets/img/about-3.jpg"
              alt="Coach guiding a young batter in the nets"
              loading="lazy"
              width="1000"
              height="746"
            />
          </div>
          <div className="media c2">
            <img
              src="/assets/img/about-2.jpg"
              alt="Coach correcting a batter's stance at the stumps"
              loading="lazy"
              width="1000"
              height="746"
            />
          </div>
          <div className="exp">
            <b>25+</b>
            <span>YEARS OF EXCELLENCE</span>
          </div>
        </div>
        <div data-reveal="right">
          <span className="eyebrow">{tag}</span>
          <h2 className="title">
            BUILDING CRICKETERS.
            <br />
            <em>SHAPING CHAMPIONS.</em>
          </h2>
          <p className="lead">{description}</p>
          {bulletPoints && bulletPoints.length > 0 && (
            <ul className="ticks">
              {bulletPoints.map((point, idx) => (
                <li key={idx}>{point}</li>
              ))}
            </ul>
          )}
          <Link className="btn btn--navy" style={{ marginTop: "36px" }} href={buttonLink}>
            {buttonText}{" "}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
