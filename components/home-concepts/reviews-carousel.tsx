"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Reviews marquee: the cards glide right to left in one continuous loop (the list is drawn
 * twice and slides by half its width, so the seam never shows). It pauses on hover or focus,
 * the edges fade out, and the row fades up the first time it scrolls into view. With reduced
 * motion it stands still and scrolls by hand instead (see `.rs-review-marquee` in globals.css).
 */
export function ReviewsCarousel({
  slides,
  label,
  header,
}: {
  slides: ReactNode[];
  label: string;
  /** The section heading, above the row. */
  header?: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} role="region" aria-label={label}>
      {header ? <div className="mb-6">{header}</div> : null}
      <div
        className={cn(
          "rs-review-fade -mx-4 overflow-hidden sm:-mx-16",
          "motion-safe:transition-[opacity,translate] motion-safe:duration-700 motion-safe:ease-out",
          !revealed && "motion-safe:translate-y-6 motion-safe:opacity-0",
        )}
      >
        <div className="rs-review-marquee flex w-max pt-2 pb-6">
          {[0, 1].map((copy) => (
            <ul
              key={copy}
              className="flex shrink-0 gap-4 pr-4"
              aria-hidden={copy === 1 ? true : undefined}
            >
              {slides.map((slide, index) => (
                <li
                  key={index}
                  className="flex w-[80vw] max-w-sm shrink-0 sm:w-[22rem] lg:w-[24rem]"
                >
                  {slide}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  );
}
