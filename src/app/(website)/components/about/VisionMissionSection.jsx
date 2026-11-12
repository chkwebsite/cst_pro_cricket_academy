export default function VisionMissionSection({
  vision = {
    icon: "bi-eye-fill",
    title: "Our Vision",
    desc: "To be the most trusted cricket academy, producing skilled players who represent their district, state and country.",
  },
  mission = {
    icon: "bi-flag-fill",
    title: "Our Mission",
    desc: "To provide affordable, scientific and enjoyable coaching that develops talent from the grassroots level.",
  },
}) {
  return (
    <section className="bg-cream">
      <div className="container">
        <div className="row g-4">
          <div className="col-md-6 reveal">
            <div className="feature-box text-start">
              <i className={`bi ${vision.icon}`}></i>
              <h4 className="mt-3">{vision.title}</h4>
              <p>{vision.desc}</p>
            </div>
          </div>
          <div className="col-md-6 reveal">
            <div className="feature-box text-start">
              <i className={`bi ${mission.icon}`}></i>
              <h4 className="mt-3">{mission.title}</h4>
              <p>{mission.desc}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
