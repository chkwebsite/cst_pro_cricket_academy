export default function SupportExpertsSection({
  tag = "Support Team",
  title = "Associated Experts",
  experts = [
    {
      icon: "bi-egg-fried",
      title: "Nutritionist",
      desc: "Diet plans for young athletes.",
    },
    {
      icon: "bi-brain",
      title: "Sports Psychologist",
      desc: "Focus, pressure and confidence.",
    },
    {
      icon: "bi-bandaid",
      title: "Physiotherapist",
      desc: "Recovery and injury care.",
    },
    {
      icon: "bi-clipboard2-pulse",
      title: "Sports Doctor",
      desc: "Medical checks and advice.",
    },
  ],
}) {
  return (
    <section className="bg-cream">
      <div className="container">
        <div className="text-center mb-5 reveal">
          <span className="section-tag">{tag}</span>
          <h2 className="section-title">{title}</h2>
          <div className="divider"></div>
        </div>
        <div className="row g-4">
          {experts.map((exp, idx) => (
            <div className="col-sm-6 col-lg-3 reveal" key={idx}>
              <div className="feature-box">
                <i className={`bi ${exp.icon}`}></i>
                <h5 className="mt-3">{exp.title}</h5>
                <p>{exp.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
