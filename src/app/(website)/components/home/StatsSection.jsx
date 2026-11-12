"use client";

import { useEffect, useRef, useState } from "react";

function StatCard({ target, suffix = "", label, delay = 0 }) {
  const [count, setCount] = useState(0);
  const cardRef = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const runCounter = () => {
      if (startedRef.current) return;
      startedRef.current = true;

      const duration = 1800;
      const startTime = performance.now();

      const step = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        setCount(Math.round(target * eased));

        if (progress < 1) {
          requestAnimationFrame(step);
        }
      };

      requestAnimationFrame(step);
    };

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            runCounter();
            observer.disconnect();
          }
        },
        { threshold: 0.3 }
      );
      observer.observe(el);
      return () => observer.disconnect();
    } else {
      runCounter();
    }
  }, [target]);

  return (
    <div className="card stat" data-reveal style={{ "--d": delay }} ref={cardRef}>
      <b>
        {count.toLocaleString("en-IN")}
        {suffix}
      </b>
      <span>{label}</span>
    </div>
  );
}

const TICKER_ITEMS = [
  { label: "JUNIOR CRICKET PROGRAM", href: "/programs" },
  { label: "BEGINNER TRAINING", href: "/programs" },
  { label: "PROFESSIONAL COACHING", href: "/programs" },
  { label: "DAY & NIGHT CAMPS", href: "/matches" },
  { label: "RESIDENTIAL ACADEMY", href: "/facilities" },
  { label: "BOOK FREE TRIAL", href: "/book-free-trial" },
  { label: "EXPERT COACHES", href: "/coaches" },
  { label: "MATCH FIXTURES", href: "/matches" },
  { label: "CAMPUS & BRANCHES", href: "/branches" },
  { label: "PRO CRICKET STORE", href: "/shop" },
  { label: "MOMENTS GALLERY", href: "/gallery" },
];

export default function StatsSection({
  stats = [
    { target: 25, suffix: "+", label: "Years Experience" },
    { target: 1150, suffix: "+", label: "Students Trained" },
    { target: 12, suffix: "", label: "Expert Coaches" },
    { target: 3, suffix: "", label: "Training Centres" },
  ],
}) {
  // Duplicated list for seamless infinite marquee
  const marqueeItems = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <>
      <section className="stats">
        <div className="container">
          <div className="grid grid--4">
            {stats.map((item, idx) => (
              <StatCard
                key={idx}
                target={item.target}
                suffix={item.suffix}
                label={item.label}
                delay={idx}
              />
            ))}
          </div>
        </div>
      </section>

      <div className="ticker" style={{ marginTop: "64px" }} role="region" aria-label="Academy Highlights">
        <div className="ticker__track">
          {marqueeItems.map((item, idx) => (
            <a
              key={idx}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="ticker__link"
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
