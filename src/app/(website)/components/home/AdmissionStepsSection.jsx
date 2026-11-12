export default function AdmissionStepsSection({
  tag = "Admission",
  title = "START IN 3 SIMPLE STEPS",
}) {
  const steps = [
    {
      no: 1,
      title: "Enquire",
      desc: "Call, WhatsApp or fill the enquiry form. We reply with batch timings and fees.",
    },
    {
      no: 2,
      title: "Attend a Free Trial",
      desc: "Meet our coaches, try a session and get a quick skill assessment.",
    },
    {
      no: 3,
      title: "Join & Grow",
      desc: "Pick the program that fits and start training with regular progress reports.",
    },
  ];

  return (
    <section className="section" id="steps">
      <div className="container">
        <div className="section-head" data-reveal>
          <span className="eyebrow">{tag}</span>
          <h2 className="title">
            START IN <em>3 SIMPLE STEPS</em>
          </h2>
        </div>
        <div className="grid grid--3 steps" style={{ maxWidth: "1100px", margin: "0 auto" }}>
          {steps.map((step, idx) => (
            <div className="card step" data-reveal style={{ "--d": idx }} key={idx}>
              <div className="step__no">{step.no}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
