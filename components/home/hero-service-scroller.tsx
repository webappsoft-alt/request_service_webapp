"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/shared/category-icon";
import { useHomeCategoryFilter } from "@/components/home/home-category-filter";
import { serviceCategories } from "@/lib/data/services";
import { cn } from "@/lib/utils";

const CHIP =
  "flex flex-col items-center gap-1 rounded-lg px-1.5 pt-1 pb-[5px] text-center text-[13px] leading-none whitespace-nowrap transition-colors";
const MIN_GAP = 12;
const MAX_GAP = 20;

function itemWidths(list: HTMLElement) {
  return [...list.children].map((child) => (child as HTMLElement).offsetWidth);
}

function sumRange(widths: number[], from: number, count: number) {
  let total = 0;
  for (let i = from; i < from + count; i += 1) {
    total += widths[i] ?? 0;
  }
  return total;
}

function fitCount(from: number, maxWidth: number, widths: number[]) {
  let used = 0;
  let count = 0;
  for (let i = from; i < widths.length; i += 1) {
    const next = used + (count > 0 ? MIN_GAP : 0) + widths[i];
    if (next > maxWidth) break;
    used = next;
    count += 1;
  }
  return Math.max(1, count);
}

function windowLayout(from: number, maxWidth: number, widths: number[]) {
  const count = fitCount(from, maxWidth, widths);
  const sum = sumRange(widths, from, count);
  const slots = Math.max(1, count - 1);
  const rawGap = count > 1 ? (maxWidth - sum) / slots : MIN_GAP;
  const gap = Math.min(MAX_GAP, Math.max(MIN_GAP, rawGap));
  const used = sum + gap * (count - 1);
  return { count, gap, used, fill: used >= maxWidth - 0.5 };
}

function offsetTo(start: number, widths: number[], gap: number) {
  let offset = 0;
  for (let i = 0; i < start; i += 1) {
    offset += widths[i] + gap;
  }
  return offset;
}

function lastStart(maxWidth: number, widths: number[]) {
  for (let i = 0; i < widths.length; i += 1) {
    if (i + fitCount(i, maxWidth, widths) >= widths.length) return i;
  }
  return Math.max(0, widths.length - 1);
}

export function HeroServiceScroller() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const startRef = useRef(0);
  const [shift, setShift] = useState(0);
  const [gap, setGap] = useState(MIN_GAP);
  const [clipWidth, setClipWidth] = useState<number | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const { selectedSlug, setSelectedSlug, pinDock } = useHomeCategoryFilter();

  const layout = useCallback((nextStart = startRef.current) => {
    const viewport = viewportRef.current;
    const list = listRef.current;
    if (!viewport || !list) return;

    const widths = itemWidths(list);
    if (!widths.length) return;

    const maxWidth = viewport.clientWidth;
    const end = lastStart(maxWidth, widths);
    const clamped = Math.max(0, Math.min(nextStart, end));
    const next = windowLayout(clamped, maxWidth, widths);

    startRef.current = clamped;
    setGap(next.gap);
    setShift(offsetTo(clamped, widths, next.gap));
    setClipWidth(next.fill ? maxWidth : next.used);
    setCanPrev(clamped > 0);
    setCanNext(clamped < end);
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    let cancelled = false;
    const onResize = () => {
      if (!cancelled) layout(startRef.current);
    };
    layout(startRef.current);
    const observer = new ResizeObserver(onResize);
    observer.observe(viewport);
    document.fonts?.ready.then(onResize).catch(() => undefined);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [layout]);

  function move(direction: -1 | 1) {
    const viewport = viewportRef.current;
    const list = listRef.current;
    if (!viewport || !list) return;

    const widths = itemWidths(list);
    const maxWidth = viewport.clientWidth;
    const current = startRef.current;

    if (direction > 0) {
      layout(current + fitCount(current, maxWidth, widths));
      return;
    }

    let used = 0;
    let count = 0;
    let index = current;
    while (index > 0) {
      const next = used + (count > 0 ? MIN_GAP : 0) + widths[index - 1];
      if (next > maxWidth) break;
      used = next;
      count += 1;
      index -= 1;
    }
    layout(index);
  }

  function selectCategory(slug: string | null) {
    setSelectedSlug(slug);
    pinDock();
    document.getElementById("browse-by-job")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 border-t pt-1.5">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Previous services"
        disabled={!canPrev}
        onClick={() => move(-1)}
        className="shrink-0 bg-card border-foreground/50 text-foreground disabled:opacity-70 [&_svg]:size-4"
      >
        <ChevronLeft strokeWidth={2.5} />
      </Button>
      <div ref={viewportRef} className="flex min-w-0 justify-center">
        <div className="overflow-hidden" style={{ width: clipWidth ?? "100%", maxWidth: "100%" }}>
          <ul
            ref={listRef}
            className="flex w-max items-start will-change-transform"
            style={{
              gap: `${gap}px`,
              transform: `translateX(-${shift}px)`,
              transition: "transform 280ms ease, gap 200ms ease",
            }}
          >
            <li className="shrink-0">
              <button
                type="button"
                onClick={() => selectCategory(null)}
                aria-pressed={selectedSlug === null}
                className={cn(
                  CHIP,
                  selectedSlug === null
                    ? "bg-primary/5 font-semibold text-primary"
                    : "font-medium text-muted-foreground hover:text-primary"
                )}
              >
                <span className="flex size-5 items-center justify-center">
                  <LayoutGrid className="size-4" aria-hidden="true" />
                </span>
                All
              </button>
            </li>
            {serviceCategories.map((category) => {
              const selected = selectedSlug === category.slug;
              return (
                <li key={category.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => selectCategory(category.slug)}
                    aria-pressed={selected}
                    className={cn(
                      CHIP,
                      selected
                        ? "bg-primary/5 font-semibold text-primary"
                        : "font-medium text-muted-foreground hover:text-primary"
                    )}
                  >
                    <CategoryIcon slug={category.slug} className="size-5 bg-current" />
                    {category.shortName}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Next services"
        disabled={!canNext}
        onClick={() => move(1)}
        className="shrink-0 bg-card border-foreground/50 text-foreground disabled:opacity-70 [&_svg]:size-4"
      >
        <ChevronRight strokeWidth={2.5} />
      </Button>
    </div>
  );
}
