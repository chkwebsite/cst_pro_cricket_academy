export default function WhyChooseUsSection({
  tag = "Why Choose Us",
  title = "Everything a Cricketer Needs",
  features = [
    {
      icon: "bi-award-fill",
      title: "Expert Coaches",
      desc: "Former first-class and international players on the panel.",
    },
    {
      icon: "bi-grid-3x3-gap-fill",
      title: "Quality Facilities",
      desc: "Turf pitches, nets, bowling machines and floodlights.",
    },
    {
      icon: "bi-heart-pulse-fill",
      title: "Fitness & Care",
      desc: "Strength, conditioning, nutrition and injury support.",
    },
    {
      icon: "bi-graph-up-arrow",
      title: "Progress Tracking",
      desc: "Regular assessments and parent feedback reports.",
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
          {features.map((item, idx) => (
            <div className="col-sm-6 col-lg-3 reveal" key={idx}>
              <div className="feature-box">
                <i className={`bi ${item.icon}`}></i>
                <h5 className="mt-3">{item.title}</h5>
                <p>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
