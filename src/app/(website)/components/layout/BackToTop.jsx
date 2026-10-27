"use client";

import { useEffect, useState } from "react";

export default function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShow(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <button
      id="backTop"
      className={`back-top ${show ? "show" : ""}`}
      onClick={scrollToTop}
      aria-label="Back to top"
      type="button"
      title="Scroll to top"
    >
      <i className="bi bi-arrow-up"></i>
    </button>
  );
}
