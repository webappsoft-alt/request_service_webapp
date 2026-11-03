"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Container, Section } from "@/components/layout/container";
import { customerWorkflow } from "@/lib/data/navigation";
import { cn } from "@/lib/utils";

/** Rows on show before the list scrolls. */
const VISIBLE_ROWS = 4;
/** Height of the sticky site header (h-17), which the section pins beneath. */
const HEADER_PX = 68;

/**
 * v1's "Peace of mind" statement beside the numbered job steps. The section pins under the header
 * while page scrolling moves the list (scrollbar hidden), then releases at the last row.
 * `children` are the sections that follow: they pin too, so they fill the screen below the list
 * instead of a gap. If the window is too short to pin the whole list section, the list falls back
 * to scrolling on its own.
 */
export function PeaceOfMindList({ children }: { children?: ReactNode }) {
  const labelId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);
  const [trackHeight, setTrackHeight] = useState<number | null>(null);
  const [atEnd, setAtEnd] = useState(false);
  const pinned = trackHeight !== null;

  const syncEnd = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    setAtEnd(scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1);
  }, []);

  // Row heights change with text wrapping, and the sections below load in, so re-measure on resize.
  useEffect(() => {
    const pin = pinRef.current;
    const section = sectionRef.current;
    const scroller = scrollerRef.current;
    const list = listRef.current;
    if (!pin || !section || !scroller || !list) return;
    const measure = () => {
      const first = list.children[0];
      const firstHidden = list.children[VISIBLE_ROWS];
      if (!first || !firstHidden) return;
      const rowsHeight = firstHidden.getBoundingClientRect().top - first.getBoundingClientRect().top;
      const sectionHeight = section.offsetHeight - scroller.offsetHeight + rowsHeight;
      const fits = sectionHeight + HEADER_PX <= window.innerHeight;
      setMaxHeight(rowsHeight);
      // One pixel of page scroll moves the list one pixel, so the track allows for the full list.
      setTrackHeight(fits ? pin.offsetHeight - scroller.offsetHeight + list.offsetHeight : null);
      syncEnd();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(pin);
    observer.observe(list);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [syncEnd]);

  useEffect(() => {
    if (!pinned) return;
    const track = trackRef.current;
    const scroller = scrollerRef.current;
    if (!track || !scroller) return;
    // The browser clamps scrollTop to the list's range, so this holds at both ends.
    const follow = () => {
      scroller.scrollTop = HEADER_PX - track.getBoundingClientRect().top;
    };
    follow();
    window.addEventListener("scroll", follow, { passive: true });
    return () => window.removeEventListener("scroll", follow);
  }, [pinned, trackHeight]);

  return (
    <div ref={trackRef} style={pinned ? { height: trackHeight } : undefined}>
      <div ref={pinRef} className={cn(pinned && "sticky")} style={pinned ? { top: HEADER_PX } : undefined}>
        <div ref={sectionRef}>
          <Section density="tight" className="bg-background">
            <Container className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-24">
              <div className="flex flex-col gap-4">
                <p className="eyebrow text-primary">Peace of mind</p>
                <h2 id={labelId} className="text-balance text-3xl font-semibold tracking-tight md:text-[3rem] md:leading-[1.08]">
                  You stay in control at every step.
                </h2>
                <p className="max-w-md text-sm leading-7 text-muted-foreground md:text-base">
                  Thumbtack-simple for finding help. Contractor-grade clarity once the work is quoted. Request Service keeps both
                  sides on the same project file.
                </p>
              </div>

              <div className="relative">
                <div
                  ref={scrollerRef}
                  role="region"
                  aria-labelledby={labelId}
                  tabIndex={pinned ? undefined : 0}
                  onScroll={syncEnd}
                  className={cn(
                    "no-scrollbar max-h-108 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    pinned ? "overflow-y-hidden" : "overflow-y-auto",
                  )}
                  style={maxHeight === null ? undefined : { maxHeight }}
                >
                  <ol ref={listRef} className="flex flex-col">
                    {customerWorkflow.map((item) => (
                      <li
                        key={item.step}
                        className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3 border-t border-border/60 py-4 first:border-t-0 sm:grid-cols-[3.5rem_minmax(0,1fr)]"
                      >
                        <span className="text-2xl font-semibold tracking-tight text-primary/25 tabular-nums sm:text-3xl">
                          {String(item.step).padStart(2, "0")}
                        </span>
                        <div className="flex flex-col gap-1">
                          <h3 className="text-base font-semibold tracking-tight sm:text-lg">{item.title}</h3>
                          <p className="max-w-lg text-sm leading-6 text-muted-foreground">{item.body}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
                {/* With no scrollbar, the fade is the cue that more rows follow. */}
                <div
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-background to-transparent transition-opacity duration-300",
                    atEnd && "opacity-0",
                  )}
                />
              </div>
            </Container>
          </Section>
        </div>
        {children}
      </div>
    </div>
  );
}
