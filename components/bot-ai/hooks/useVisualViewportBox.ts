"use client";

import { useEffect, useState, type CSSProperties } from "react";

/**
 * Phones only: size a full-screen fixed panel to the *visible* viewport. `100dvh` ignores the
 * on-screen keyboard, so on iOS the input ended up under the keyboard (or the panel was
 * scrolled up off-screen). Tracking `visualViewport` keeps the input right above the keyboard.
 * Returns undefined on ≥640px (desktop keeps its docked layout) or when unsupported.
 */
export function useVisualViewportBox(active: boolean): CSSProperties | undefined {
  const [box, setBox] = useState<{ height: number; top: number } | null>(null);

  useEffect(() => {
    const viewport = typeof window !== "undefined" ? window.visualViewport : null;
    if (!active || !viewport) return;
    const mobile = window.matchMedia("(max-width: 639px)");

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setBox(mobile.matches ? { height: Math.round(viewport.height), top: Math.round(viewport.offsetTop) } : null);
      });
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    mobile.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      mobile.removeEventListener("change", update);
    };
  }, [active]);

  return active && box ? { height: box.height, top: box.top, bottom: "auto" } : undefined;
}
