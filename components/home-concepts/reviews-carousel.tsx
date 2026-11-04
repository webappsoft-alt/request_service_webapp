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
 * Horizontal snap carousel: native swipe / scroll, plus arrow buttons and dots.
 * Slides size themselves (1 / 2 / 3 per view by breakpoint); this only tracks position.
 */
export function ReviewsCarousel({
  slides,
  label,
}: {
  slides: ReactNode[];
  label: string;
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const [lastIndex, setLastIndex] = useState(slides.length - 1);

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
    "flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white backdrop-blur-md transition-colors hover:border-white/30 hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 disabled:pointer-events-none disabled:opacity-35";

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label}>
      <ul
        ref={trackRef}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-6 overflow-x-auto px-4 py-2 sm:mx-0 sm:scroll-px-0 sm:px-0"
      >
        {slides.map((slide, index) => (
          <li
            key={index}
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${slides.length}`}
            className="flex w-[85%] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]"
          >
            {slide}
          </li>
        ))}
      </ul>

      <div className="mt-8 flex items-center justify-center gap-5">
        <button
          type="button"
          className={arrow}
          onClick={() => goTo(active - 1)}
          disabled={active === 0}
          aria-label="Previous reviews"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <div className="flex items-center gap-2">
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
                  ? "w-6 bg-sky-300"
                  : "w-1.5 bg-white/25 hover:bg-white/45",
              )}
            />
          ))}
        </div>
        <button
          type="button"
          className={arrow}
          onClick={() => goTo(active + 1)}
          disabled={active >= lastIndex}
          aria-label="Next reviews"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
