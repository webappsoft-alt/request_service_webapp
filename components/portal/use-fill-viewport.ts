"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * Height that makes an element reach exactly the bottom of the window, from
 * wherever it starts (headers, tab bars and record strips vary per page).
 * Re-measured on resize and when anything above it changes size.
 */
export function useFillViewport(ref: RefObject<HTMLElement | null>, { min = 420, gap = 0 } = {}) {
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = el.getBoundingClientRect().top + window.scrollY;
        setHeight(Math.max(min, Math.floor(window.innerHeight - top - gap)));
      });
    };
    measure();
    window.addEventListener("resize", measure);
    // Headers above can change height (open-record tabs wrap, banners appear).
    const observer = new ResizeObserver(measure);
    if (el.parentElement) observer.observe(el.parentElement);
    observer.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [ref, min, gap]);

  return height;
}
