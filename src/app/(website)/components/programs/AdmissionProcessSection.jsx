export default function AdmissionProcessSection({
  tag = "Admission",
  title = "How to Join",
  steps = [
    { num: "01", text: "Book a free trial" },
    { num: "02", text: "Skill assessment" },
    { num: "03", text: "Choose a program" },
    { num: "04", text: "Complete registration" },
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
        <div className="row g-4 text-center">
          {steps.map((st, idx) => (
            <div className="col-md-3 reveal" key={idx}>
              <div className="stat-card">
                <div className="num">{st.num}</div>
                <p className="mb-0 mt-2">{st.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
