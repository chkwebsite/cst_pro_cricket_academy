"use client";

import { useEffect, useRef, useState } from "react";

function StatCard({ target, suffix = "", label }) {
  const [count, setCount] = useState(0);
  const cardRef = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const runCounter = () => {
      if (startedRef.current) return;
      startedRef.current = true;

      const duration = 1500;
      const stepTime = 25;
      const totalSteps = duration / stepTime;
      const stepValue = Math.max(1, Math.ceil(target / totalSteps));

      let current = 0;
      const timer = setInterval(() => {
        current += stepValue;
        if (current >= target) {
          current = target;
          clearInterval(timer);
        }
        setCount(current);
      }, stepTime);
    };

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            runCounter();
            observer.disconnect();
          }
        },
        { threshold: 0.2 }
      );
      observer.observe(el);
      return () => observer.disconnect();
    } else {
      runCounter();
    }
  }, [target]);

  return (
    <div className="stat-card" ref={cardRef}>
      <div className="num">
        {count}
        {suffix}
      </div>
      <small>{label}</small>
    </div>
  );
}

export default function StatsSection({
  stats = [
    { target: 25, suffix: "+", label: "Years Experience" },
    { target: 1150, suffix: "+", label: "Students Trained" },
    { target: 12, suffix: "", label: "Expert Coaches" },
    { target: 3, suffix: "", label: "Training Centres" },
  ],
}) {
  return (
    <section className="stats">
      <div className="container">
        <div className="row g-3 g-lg-4">
          {stats.map((item, idx) => (
            <div className="col-6 col-lg-3" key={idx}>
              <StatCard
                target={item.target}
                suffix={item.suffix}
                label={item.label}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
