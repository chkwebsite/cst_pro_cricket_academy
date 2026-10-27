"use client";

import { useState, useEffect } from "react";

export default function TestimonialsSection({
  tag = "Reviews",
  title = "Student & Parent Stories",
  testimonials = [
    {
      stars: 5,
      hasHalfStar: false,
      quote:
        "My son's technique and confidence improved within three months. The coaches are patient and the training is well structured.",
      author: "Parent of U-14 player",
    },
    {
      stars: 5,
      hasHalfStar: false,
      quote:
        "The one-on-one sessions helped me fix my footwork against spin. I made my district team this season.",
      author: "Aarav, U-16 batter",
    },
    {
      stars: 4,
      hasHalfStar: true,
      quote:
        "Excellent facilities and a disciplined environment. The fitness programme made a big difference to my bowling.",
      author: "Rohit, fast bowler",
    },
  ],
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (testimonials.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [testimonials.length]);

  const prevSlide = () => {
    setCurrentIndex((prev) =>
      prev === 0 ? testimonials.length - 1 : prev - 1
    );
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const current = testimonials[currentIndex] || testimonials[0];

  return (
    <section className="bg-cream">
      <div className="container">
        <div className="text-center mb-5 reveal">
          <span className="section-tag">{tag}</span>
          <h2 className="section-title">{title}</h2>
          <div className="divider"></div>
        </div>

        <div className="row justify-content-center">
          <div className="col-lg-8">
            <div className="testi-card">
              <div className="stars mb-2">
                {[...Array(current.stars)].map((_, i) => (
                  <i key={i} className="bi bi-star-fill me-1"></i>
                ))}
                {current.hasHalfStar && (
                  <i className="bi bi-star-half me-1"></i>
                )}
              </div>
              <p>{current.quote}</p>
              <p className="who">{current.author}</p>
            </div>
          </div>
        </div>

        {testimonials.length > 1 && (
          <div className="d-flex justify-content-center gap-2 mt-4">
            <button
              className="btn btn-sm btn-outline-dark rounded-circle"
              type="button"
              onClick={prevSlide}
              aria-label="Previous testimonial"
            >
              <i className="bi bi-chevron-left"></i>
            </button>
            <button
              className="btn btn-sm btn-outline-dark rounded-circle"
              type="button"
              onClick={nextSlide}
              aria-label="Next testimonial"
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
