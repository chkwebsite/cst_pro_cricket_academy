"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ScrollRevealInit() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    let observer = null;

    const observeElements = () => {
      const items = document.querySelectorAll(".reveal:not(.visible)");
      if (items.length === 0) return;

      if (!("IntersectionObserver" in window)) {
        items.forEach((item) => item.classList.add("visible"));
        return;
      }

      if (!observer) {
        observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add("visible");
                observer.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.05, rootMargin: "0px 0px 50px 0px" }
        );
      }

      items.forEach((item) => {
        // If element is already in or above viewport, show it right away
        const rect = item.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          item.classList.add("visible");
        } else {
          observer.observe(item);
        }
      });
    };

    // Initial runs for hydration
    observeElements();
    const t1 = setTimeout(observeElements, 100);
    const t2 = setTimeout(observeElements, 300);
    const t3 = setTimeout(observeElements, 800);

    // Watch for dynamically loaded content (e.g. API fetches completing)
    const mutationObserver = new MutationObserver(() => {
      observeElements();
    });

    if (document.body) {
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (observer) observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [pathname]);

  return null;
}
