"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ScrollRevealInit() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Enable JS animation class
    document.documentElement.classList.add("js");

    let observer = null;

    const observeElements = () => {
      const items = document.querySelectorAll(
        "[data-reveal]:not(.is-in), .reveal:not(.visible)"
      );
      if (items.length === 0) return;

      if (!("IntersectionObserver" in window)) {
        items.forEach((item) => {
          item.classList.add("is-in", "visible");
        });
        return;
      }

      if (!observer) {
        observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-in", "visible");
                observer.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.1, rootMargin: "0px 0px -4% 0px" }
        );
      }

      items.forEach((item) => {
        const rect = item.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          item.classList.add("is-in", "visible");
        } else {
          observer.observe(item);
        }
      });
    };

    // Initial check
    observeElements();
    const t1 = setTimeout(observeElements, 100);
    const t2 = setTimeout(observeElements, 400);
    const t3 = setTimeout(observeElements, 900);

    // Watch for dynamically loaded content
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
