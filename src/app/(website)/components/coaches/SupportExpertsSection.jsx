export default function SupportExpertsSection({
  tag = "Support Team",
  title = "Associated Experts",
  subtitle = "Our comprehensive cricket ecosystem is backed by leading sports medicine, psychology, and conditioning specialists.",
  experts = [
    {
      icon: "bi-egg-fried",
      title: "Nutritionist",
      desc: "Custom high-energy meal plans tailored for cricket athletes.",
    },
    {
      icon: "bi-brain",
      title: "Sports Psychologist",
      desc: "Match-temperament, mental toughness, and focus under pressure.",
    },
    {
      icon: "bi-bandaid",
      title: "Physiotherapist",
      desc: "Fast bowling recovery, injury prevention, and muscle rehab.",
    },
    {
      icon: "bi-clipboard2-pulse",
      title: "Sports Doctor",
      desc: "Biomechanical screening, regular fitness and endurance checks.",
    },
  ],
}) {
  return (
    <section className="support-section-dark">
      <div className="container">
        <div className="text-center mb-5">
          <div className="team-tag-cyan mb-2">
            <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>—</span> {tag.toUpperCase()}
          </div>
          <h2 className="team-title text-center">
            ASSOCIATED <span className="text-cyan">EXPERTS</span>
          </h2>
          <div className="team-title-bar mx-auto"></div>
          {subtitle && (
            <p className="text-light opacity-75 mt-3 mx-auto" style={{ maxWidth: "620px", fontSize: "0.92rem" }}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="row g-4 justify-content-center">
          {experts.map((exp, idx) => (
            <div className="col-sm-6 col-lg-3" key={idx}>
              <div className="support-card-dark">
                <div className="support-icon-wrap">
                  <i className={`bi ${exp.icon}`}></i>
                </div>
                <h5>{exp.title}</h5>
                <p>{exp.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
