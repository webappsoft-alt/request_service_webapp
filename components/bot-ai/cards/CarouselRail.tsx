"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Horizontal snap-scrolling rail. Arrows live in a control strip above the track, so
 * they never cover card content. Touch / trackpad scroll natively; mouse can drag.
 */
export function CarouselRail({
  children,
  label,
  count,
  className,
}: {
  children: ReactNode;
  /** Visible strip title, also the list's accessible name. */
  label: string;
  count: number;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const [index, setIndex] = useState(0);

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    const start = track.scrollLeft <= 4;
    const end = track.scrollLeft >= max - 4;
    setEdges((previous) => (previous.start === start && previous.end === end ? previous : { start, end }));
    const card = track.querySelector<HTMLElement>("[data-rail-item]");
    const step = (card?.offsetWidth ?? 1) + 8;
    setIndex(Math.min(count - 1, Math.round(track.scrollLeft / step)));
  }, [count]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    // ResizeObserver fires once on observe, which gives the initial measurement.
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [measure]);

  function scrollByCard(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>("[data-rail-item]");
    track.scrollBy({ left: ((card?.offsetWidth ?? 210) + 8) * direction, behavior: "smooth" });
  }

  // Mouse drag-to-scroll (touch already scrolls natively).
  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const track = trackRef.current;
    if (!track) return;
    dragRef.current = { x: event.clientX, left: track.scrollLeft, moved: false };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const track = trackRef.current;
    if (!drag || !track) return;
    const delta = event.clientX - drag.x;
    if (!drag.moved && Math.abs(delta) < 5) return;
    if (!drag.moved) {
      drag.moved = true;
      track.setPointerCapture(event.pointerId);
      track.style.scrollSnapType = "none";
      track.style.scrollBehavior = "auto";
    }
    track.scrollLeft = drag.left - delta;
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const track = trackRef.current;
    dragRef.current = null;
    if (!drag?.moved || !track) return;
    if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
    track.style.scrollSnapType = "";
    track.style.scrollBehavior = "";
    // Swallow the click that ends a drag so buttons under the cursor don't fire.
    const swallow = (click: MouseEvent) => {
      click.stopPropagation();
      click.preventDefault();
    };
    track.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => track.removeEventListener("click", swallow, { capture: true }), 0);
  }

  const scrollable = !(edges.start && edges.end);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2 pl-9">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
          <span className="ml-1.5 font-medium normal-case tabular-nums">
            {scrollable ? `${index + 1} / ${count}` : `${count}`}
          </span>
        </p>
        {scrollable ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollByCard(-1)}
              disabled={edges.start}
              aria-label={`Previous ${label.toLowerCase()}`}
              className="flex size-6 items-center justify-center rounded-full border bg-card text-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => scrollByCard(1)}
              disabled={edges.end}
              aria-label={`Next ${label.toLowerCase()}`}
              className="flex size-6 items-center justify-center rounded-full border bg-card text-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      <div className="relative">
        <div
          ref={trackRef}
          role="list"
          aria-label={label}
          onScroll={measure}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={cn(
            "flex snap-x snap-mandatory scroll-px-9 gap-2 overflow-x-auto scroll-smooth pt-2 pr-3 pb-1 pl-9",
            "scrollbar-none [&::-webkit-scrollbar]:hidden",
            scrollable && "cursor-grab active:cursor-grabbing",
          )}
        >
          {children}
        </div>
        {/* Thin edge fade hints at more cards without covering their content. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-3 bg-linear-to-l from-popover to-transparent transition-opacity",
            edges.end && "opacity-0",
          )}
        />
      </div>
    </div>
  );
}

export function RailItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="listitem" data-rail-item className={cn("w-51 shrink-0 snap-start select-none", className)}>
      {children}
    </div>
  );
}
