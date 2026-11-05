"use client";

import { useEffect, useState } from "react";

export default function ScrollProgressBar() {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY || window.pageYOffset;
      const max = document.body.scrollHeight - window.innerHeight;
      setScrollProgress(max > 0 ? y / max : 0);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className="progress"
      style={{
        transform: `scaleX(${scrollProgress})`,
        transformOrigin: "0 50%",
        position: "fixed",
        top: 0,
        left: 0,
        height: "3px",
        width: "100%",
        background: "linear-gradient(90deg, var(--green), var(--red))",
        zIndex: 1000,
        borderRadius: 0,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    />
  );
}
