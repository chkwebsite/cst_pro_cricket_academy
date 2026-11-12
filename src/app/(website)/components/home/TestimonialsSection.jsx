"use client";

import { useState, useEffect } from "react";

const TESTIMONIALS = [
  {
    quote: "The one-on-one sessions helped me fix my footwork against spin. I made my district team this season.",
    author: "Aarav, U-16 batter",
    stars: "★★★★★",
  },
  {
    quote: "My son's technique and confidence improved within three months. The coaches are patient and the training is well structured.",
    author: "Parent of U-14 player",
    stars: "★★★★★",
  },
  {
    quote: "Excellent turf facilities, match simulations, and a disciplined environment. The fitness drills made a huge difference to my bowling pace.",
    author: "Rohit, fast bowler",
    stars: "★★★★★",
  },
];

export default function TestimonialsSection({
  tag = "Reviews",
  title = "STUDENT & PARENT STORIES",
}) {
  const [cur, setCur] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCur((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const go = (n) => {
    setCur((n + TESTIMONIALS.length) % TESTIMONIALS.length);
  };

  return (
    <section className="section section--cream">
      <div className="container">
        <div className="section-head" data-reveal>
          <span className="eyebrow">{tag}</span>
          <h2 className="title">
            STUDENT &amp; PARENT <em>STORIES</em>
          </h2>
        </div>

        <div className="slider" data-reveal="zoom" aria-roledescription="carousel" aria-label="Reviews">
          <div className="slides">
            {TESTIMONIALS.map((item, idx) => (
              <figure
                key={idx}
                className={`slide ${idx === cur ? "is-active" : ""}`}
                style={{ margin: 0, display: idx === cur ? "block" : "none" }}
              >
                <div className="quote-mark" aria-hidden="true">
                  “
                </div>
                <div className="stars" aria-label="5 out of 5 stars">
                  {item.stars}
                </div>
                <p>{item.quote}</p>
                <b>{item.author}</b>
              </figure>
            ))}
          </div>

          <div className="slider__nav">
            <button
              type="button"
              className="round s-prev"
              onClick={() => go(cur - 1)}
              aria-label="Previous review"
            >
              ←
            </button>
            <div className="dots">
              {TESTIMONIALS.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={idx === cur ? "is-active" : ""}
                  onClick={() => go(idx)}
                  aria-label={`Review ${idx + 1}`}
                />
              ))}
            </div>
            <button
              type="button"
              className="round s-next"
              onClick={() => go(cur + 1)}
              aria-label="Next review"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
