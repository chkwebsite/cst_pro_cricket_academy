"use client";

import { useState } from "react";
import Link from "next/link";

export default function BranchFaqSection({
  tag = "Got Questions?",
  title = "Frequently Asked Questions About Our Branches",
  subtitle = "Everything you need to know about visiting, transferring, amenities, and enrolling across CST Pro Cricket Academy campuses.",
}) {
  const [openIndex, setOpenIndex] = useState(0);

  const faqs = [
    {
      question: "Which branch should I select for my child's training?",
      answer:
        "We recommend choosing the branch center nearest to your home or school for convenience in daily attendance. All CST Pro branches follow the identical BCCI-certified coaching syllabus, training drills, physical fitness routines, and progress evaluations under the supervision of senior head coaches.",
    },
    {
      question: "Can a registered trainee transfer or attend sessions at another branch?",
      answer:
        "Yes, absolutely. If you relocate or prefer attending weekend match fixtures at our Main Campus, trainees can transfer or participate in combined weekend camps with prior intimation to the head coach without having to pay fresh admission charges.",
    },
    {
      question: "Is transport / van facility available for students?",
      answer:
        "Yes, dedicated academy vans provide safe pick-and-drop service covering Maruti Kunj, Sohna Road, Subhash Chowk, Badshahpur, Rajiv Chowk, and nearby sectors in Gurugram. Routes and timings are coordinated with school hours. You can enquire about route availability at your nearest branch desk.",
    },
    {
      question: "What equipment do I need to bring for my first free trial session?",
      answer:
        "For your trial session, you only need to bring sports shoes (rubber studs or running shoes) and comfortable sports clothing (track pants and t-shirt). The academy provides cricket bats, balls, helmets, batting pads, and gloves for your assessment.",
    },
    {
      question: "Do you offer residential hostel facilities for outstation players?",
      answer:
        "Yes! Our Main Campus at Maruti Kunj features a fully furnished, air-conditioned residential hostel with 24/7 security, disciplined warden supervision, study hours, and high-protein sports nutrition prepared by in-house chefs specifically for young athletes.",
    },
    {
      question: "Can corporate teams or private clubs book grounds and turf nets at your branches?",
      answerNode: (
        <>
          Yes! All our match grounds and floodlit turf nets are available for corporate leagues, weekend club fixtures, and private practice slots. You can check real-time date availability and reserve slots online directly on our{" "}
          <Link href="/ground-booking" className="text-red fw-semibold">
            Ground Booking Portal
          </Link>{" "}
          or call our Ground Coordinator at +91 8285831503.
        </>
      ),
    },
  ];

  const toggle = (idx) => {
    setOpenIndex(openIndex === idx ? -1 : idx);
  };

  return (
    <section className="bg-cream py-5" id="branch-faq">
      <div className="container py-3">
        {/* Header */}
        <div className="text-center mb-5 reveal">
          <span className="section-tag">{tag}</span>
          <h2 className="section-title">{title}</h2>
          <div className="divider"></div>
          {subtitle && (
            <p className="text-secondary max-w-700 mx-auto">{subtitle}</p>
          )}
        </div>

        {/* Accordion */}
        <div className="row justify-content-center">
          <div className="col-12 col-lg-8 reveal">
            <div className="accordion faq">
              {faqs.map((faq, idx) => (
                <div className="accordion-item shadow-sm mb-3 border rounded-3 overflow-hidden" key={idx}>
                  <h3 className="accordion-header">
                    <button
                      className={`accordion-button fw-bold text-navy ${
                        openIndex === idx ? "" : "collapsed"
                      }`}
                      type="button"
                      onClick={() => toggle(idx)}
                      aria-expanded={openIndex === idx}
                    >
                      <i className="bi bi-question-circle text-red me-2"></i>
                      {faq.question}
                    </button>
                  </h3>
                  <div
                    className={`accordion-collapse collapse ${
                      openIndex === idx ? "show" : ""
                    }`}
                  >
                    <div className="accordion-body text-secondary small lh-lg bg-white">
                      {faq.answerNode || faq.answer}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Helpdesk Footer */}
            <div className="text-center mt-4">
              <span className="text-muted small">
                Have a different question not answered here?{" "}
                <Link href="/contact" className="text-navy fw-bold text-decoration-underline">
                  Contact Our Support Desk
                </Link>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
