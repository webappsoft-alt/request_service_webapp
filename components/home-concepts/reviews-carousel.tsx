"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Manual snap carousel: swipe / scroll, arrow buttons beside the heading, and dots below. No
 * autoplay. The edges fade out, and the cards fade up one after another the first time the
 * carousel scrolls into view. Slides size themselves (1 / 2 / 3 per view by breakpoint); this
 * only tracks position.
 */
export function ReviewsCarousel({
  slides,
  label,
  header,
}: {
  slides: ReactNode[];
  label: string;
  /** Shown left of the arrows (the section heading). */
  header?: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const [lastIndex, setLastIndex] = useState(slides.length - 1);
  const [revealed, setRevealed] = useState(false);

  const measure = useCallback(() => {
    const track = trackRef.current;
    const first = track?.firstElementChild as HTMLElement | null;
    if (!track || !first) return null;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const step = first.offsetWidth + gap;
    const perView = Math.max(1, Math.round((track.clientWidth + gap) / step));
    return { track, step, last: Math.max(0, slides.length - perView) };
  }, [slides.length]);

  const sync = useCallback(() => {
    const m = measure();
    if (!m) return;
    setLastIndex(m.last);
    setActive(Math.min(m.last, Math.round(m.track.scrollLeft / m.step)));
  }, [measure]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    sync();
    track.addEventListener("scroll", sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(track);
    return () => {
      track.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [sync]);

  // Cards fade up the first time the carousel comes into view.
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

  const goTo = (index: number) => {
    const m = measure();
    if (!m) return;
    const target = Math.max(0, Math.min(m.last, index));
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    m.track.scrollTo({
      left: target * m.step,
      behavior: reduce ? "auto" : "smooth",
    });
  };

  const arrow =
    "flex size-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-all duration-200 hover:border-primary hover:bg-primary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-40 dark:border-border dark:bg-card dark:text-foreground";

  return (
    <div
      ref={rootRef}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
    >
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="min-w-0">{header}</div>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <button
            type="button"
            className={arrow}
            onClick={() => goTo(active - 1)}
            disabled={active === 0}
            aria-label="Previous reviews"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={arrow}
            onClick={() => goTo(active + 1)}
            disabled={active >= lastIndex}
            aria-label="Next reviews"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      {/* The track runs a little past the content on both sides, where its edges fade out. */}
      <ul
        ref={trackRef}
        className="rs-review-fade no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pt-2 pb-6 sm:-mx-16 sm:scroll-px-16 sm:px-16"
      >
        {slides.map((slide, index) => (
          <li
            key={index}
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${slides.length}`}
            className={cn(
              "flex w-[85%] shrink-0 snap-start sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]",
              "motion-safe:transition-[opacity,translate] motion-safe:duration-700 motion-safe:ease-out",
              !revealed && "motion-safe:translate-y-6 motion-safe:opacity-0",
            )}
            style={{
              transitionDelay: revealed
                ? `${Math.min(index, 3) * 120}ms`
                : undefined,
            }}
          >
            {slide}
          </li>
        ))}
      </ul>

      {lastIndex > 0 ? (
        <div className="mt-1 flex items-center justify-center gap-2">
          {Array.from({ length: lastIndex + 1 }).map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Go to review ${index + 1}`}
              aria-current={index === active ? "true" : undefined}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                index === active
                  ? "w-6 bg-primary"
                  : "w-1.5 bg-slate-300 hover:bg-slate-400 dark:bg-white/25",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
