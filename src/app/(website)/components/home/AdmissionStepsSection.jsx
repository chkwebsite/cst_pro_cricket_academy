export default function AdmissionStepsSection({
  tag = "Admission",
  title = "Start in 3 Simple Steps",
  steps = [
    {
      step: 1,
      icon: "bi-chat-dots-fill",
      title: "Enquire",
      desc: "Call, WhatsApp or fill the enquiry form. We reply with batch timings and fees.",
    },
    {
      step: 2,
      icon: "bi-calendar-check-fill",
      title: "Attend a Free Trial",
      desc: "Meet our coaches, try a session and get a quick skill assessment.",
    },
    {
      step: 3,
      icon: "bi-trophy-fill",
      title: "Join & Grow",
      desc: "Pick the program that fits and start training with regular progress reports.",
    },
  ],
}) {
  return (
    <section id="how">
      <div className="container">
        <div className="text-center mb-5 reveal">
          <span className="section-tag">{tag}</span>
          <h2 className="section-title">{title}</h2>
          <div className="divider"></div>
        </div>
        <div className="row g-4">
          {steps.map((st, idx) => (
            <div className="col-md-4 reveal" key={idx}>
              <div className="step-card">
                <span className="step-num">{st.step}</span>
                <i className={`bi ${st.icon}`}></i>
                <h5>{st.title}</h5>
                <p>{st.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
