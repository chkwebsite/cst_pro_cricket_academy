export default function CoreValuesSection({
  tag = "Core Values",
  title = "What We Stand For",
  values = [
    {
      icon: "bi-shield-check",
      title: "Discipline",
      desc: "Punctuality and respect on and off the field.",
    },
    {
      icon: "bi-stars",
      title: "Excellence",
      desc: "Constant improvement through quality practice.",
    },
    {
      icon: "bi-people",
      title: "Teamwork",
      desc: "Learning to win and lose together.",
    },
    {
      icon: "bi-hand-thumbs-up",
      title: "Fair Play",
      desc: "Spirit of cricket in every session.",
    },
  ],
}) {
  return (
    <section>
      <div className="container">
        <div className="text-center mb-5 reveal">
          <span className="section-tag">{tag}</span>
          <h2 className="section-title">{title}</h2>
          <div className="divider"></div>
        </div>
        <div className="row g-4">
          {values.map((val, idx) => (
            <div className="col-sm-6 col-lg-3 reveal" key={idx}>
              <div className="feature-box">
                <i className={`bi ${val.icon}`}></i>
                <h5 className="mt-3">{val.title}</h5>
                <p>{val.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
