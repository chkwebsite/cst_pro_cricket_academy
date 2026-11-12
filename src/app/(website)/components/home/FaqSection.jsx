"use client";

import { useState } from "react";

const DEFAULT_FAQS = [
  {
    q: "Who can join the academy?",
    a: "Players of all ages and levels, from beginners to state-level aspirants, with batches arranged by skill.",
  },
  {
    q: "Is there a free trial session?",
    a: "Yes. Book a free trial and attend a session at any branch to meet the coaches and get a quick assessment.",
  },
  {
    q: "How many players are there in a batch?",
    a: "Batch sizes are kept small so every player gets coach attention. Ask us for current batch availability.",
  },
  {
    q: "How can I see fees and batch timings?",
    a: "Fees are listed on each program card. Call or WhatsApp us and we will share batch timings for your branch.",
  },
];

export default function FaqSection({
  tag = "FAQ",
  title = "QUESTIONS PARENTS ASK",
  faqs = DEFAULT_FAQS,
}) {
  const [openIdx, setOpenIdx] = useState(0);

  const toggle = (idx) => {
    setOpenIdx((prev) => (prev === idx ? null : idx));
  };

  return (
    <section className="section section--cream" id="faq">
      <div className="container">
        <div className="section-head" data-reveal>
          <span className="eyebrow">{tag}</span>
          <h2 className="title">
            QUESTIONS <em>PARENTS ASK</em>
          </h2>
        </div>

        <div className="faq" data-reveal>
          {faqs.map((item, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div key={idx} className={`faq__item ${isOpen ? "is-open" : ""}`}>
                <button
                  type="button"
                  className="faq__q"
                  onClick={() => toggle(idx)}
                  aria-expanded={isOpen}
                >
                  <span>{item.q}</span>
                  <i></i>
                </button>
                <div
                  className="faq__a"
                  style={{
                    height: isOpen ? "auto" : "0px",
                    overflow: "hidden",
                    transition: "height 0.4s cubic-bezier(.22,.8,.24,1)",
                  }}
                >
                  <p>{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
