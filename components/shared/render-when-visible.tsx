"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Mounts its children (and so starts their data loads) only once they near the viewport.
 * For panels low on a page — e.g. notes — that shouldn't compete with the content above them.
 * Without IntersectionObserver, children mount right away.
 */
export function RenderWhenVisible({
  children,
  rootMargin = "300px 0px",
  minHeight = 96,
}: {
  children: ReactNode;
  rootMargin?: string;
  /** Placeholder height until mounted, so the panel is reachable by scrolling. */
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const node = ref.current;
    if (!node || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  if (visible) return <>{children}</>;
  return <div ref={ref} style={{ minHeight }} aria-busy="true" />;
}
