"use client";

import { useState } from "react";
import Link from "next/link";

export default function FaqSection({
  tag = "FAQ",
  title = "Questions Parents Ask",
  faqs = [
    {
      question: "Who can join the academy?",
      answer:
        "Players of all ages and levels, from beginners to state-level aspirants, with batches arranged by skill.",
    },
    {
      question: "Is there a free trial session?",
      answer:
        "Yes. Book a free trial from the enquiry form and meet our coaches before you decide.",
    },
    {
      question: "How many players are there in a batch?",
      answer:
        "Small Group batches have up to 10 players. One-on-One sessions are fully personal with a dedicated coach.",
    },
    {
      question: "How can I see fees and batch timings?",
      answerNode: (
        <>
          See the <Link href="/programs">Programs page</Link> for fees and
          sample timings, or <Link href="/contact">contact us</Link> for the
          latest details.
        </>
      ),
    },
  ],
}) {
  const [openIndex, setOpenIndex] = useState(0);

  const toggle = (idx) => {
    setOpenIndex(openIndex === idx ? -1 : idx);
  };

  return (
    <section className="bg-cream" id="faq">
      <div className="container">
        <div className="text-center mb-5 reveal">
          <span className="section-tag">{tag}</span>
          <h2 className="section-title">{title}</h2>
          <div className="divider"></div>
        </div>

        <div className="row justify-content-center">
          <div className="col-lg-8 reveal">
            <div className="accordion faq">
              {faqs.map((faq, idx) => (
                <div className="accordion-item" key={idx}>
                  <h3 className="accordion-header">
                    <button
                      className={`accordion-button ${
                        openIndex === idx ? "" : "collapsed"
                      }`}
                      type="button"
                      onClick={() => toggle(idx)}
                      aria-expanded={openIndex === idx}
                    >
                      {faq.question}
                    </button>
                  </h3>
                  <div
                    className={`accordion-collapse collapse ${
                      openIndex === idx ? "show" : ""
                    }`}
                  >
                    <div className="accordion-body">
                      {faq.answerNode || faq.answer}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
