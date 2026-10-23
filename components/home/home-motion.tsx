"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Give up waiting on sections React has not hydrated after this long (they stay un-animated). */
const HYDRATION_WAIT_MS = 5000;

/**
 * React tags every DOM node it has hydrated. Pages with a loading.tsx stream their content in a
 * Suspense boundary that hydrates after this layout-level effect runs — touching those sections'
 * className first makes React report a hydration mismatch.
 */
function isHydrated(node: HTMLElement) {
  return Object.keys(node).some((key) => key.startsWith("__reactFiber$"));
}

export function HomeMotion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const pending = new Set(root.querySelectorAll<HTMLElement>("section"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const startedAt = performance.now();
    let frame = 0;

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

    function setup() {
      for (const section of pending) {
        if (!isHydrated(section)) continue;
        pending.delete(section);
        const rect = section.getBoundingClientRect();
        const visible = rect.top < window.innerHeight * 0.9 && rect.bottom > 48;
        if (reducedMotion || visible) {
          section.classList.add("is-in");
          continue;
        }
        section.classList.add("will-reveal");
        observer.observe(section);
      }
      if (pending.size && performance.now() - startedAt < HYDRATION_WAIT_MS) {
        frame = window.requestAnimationFrame(setup);
      }
    }
    setup();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [pathname]);

  return (
    <div ref={rootRef} className="home-motion">
      {children}
    </div>
  );
}
