export default function FacilitiesSection({
  tag = "Facilities",
  title = "World-Class Training Infrastructure",
  facilities = [
    { icon: "bi-grid-3x3", title: "Turf Pitches" },
    { icon: "bi-bounding-box", title: "Practice Nets" },
    { icon: "bi-gear-wide-connected", title: "Bowling Machines" },
    { icon: "bi-lightbulb", title: "Floodlights" },
    { icon: "bi-activity", title: "Fitness Gym" },
    { icon: "bi-camera-video", title: "Video Analysis" },
    { icon: "bi-house-door", title: "Hostel" },
    { icon: "bi-bandaid", title: "Physio Support" },
  ],
}) {
  return (
    <section className="bg-navy">
      <div className="container">
        <div className="text-center mb-5 reveal">
          <span className="section-tag text-lime">{tag}</span>
          <h2 className="section-title">{title}</h2>
          <div className="divider"></div>
        </div>
        <div className="row g-4 text-center">
          {facilities.map((fac, idx) => (
            <div className="col-6 col-lg-3 reveal" key={idx}>
              <i className={`bi ${fac.icon} text-lime fs-1`}></i>
              <h5 className="mt-2">{fac.title}</h5>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
