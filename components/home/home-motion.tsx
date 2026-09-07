"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export function HomeMotion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const sections = Array.from(root.querySelectorAll<HTMLElement>("section"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const section of sections) section.classList.add("is-in");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.remove("will-reveal");
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
    );

    for (const section of sections) {
      const rect = section.getBoundingClientRect();
      const visible = rect.top < window.innerHeight * 0.9 && rect.bottom > 48;
      if (visible) {
        section.classList.add("is-in");
        continue;
      }
      section.classList.add("will-reveal");
      observer.observe(section);
    }

    return () => observer.disconnect();
  }, [pathname]);

  return (
    <div ref={rootRef} className="home-motion">
      {children}
    </div>
  );
}
