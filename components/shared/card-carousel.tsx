"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CardCarousel({
  countLabel,
  seeAllHref,
  seeAllLabel = "See all",
  ariaLabel,
  className,
  children,
}: {
  countLabel: string;
  seeAllHref: string;
  seeAllLabel?: string;
  ariaLabel: string;
  className?: string;
  children: React.ReactNode;
}) {
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const [progress, setProgress] = useState(0);

  const sync = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft < max - 8);
    setProgress(max <= 0 ? 1 : Math.min(1, el.scrollLeft / max));
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [sync]);

  function scrollByCard(direction: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector("li");
    const amount = card ? card.getBoundingClientRect().width + 20 : el.clientWidth * 0.75;
    el.scrollBy({ left: direction * amount, behavior: "smooth" });
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{countLabel}</p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous"
            disabled={!canPrev}
            onClick={() => scrollByCard(-1)}
          >
            <ArrowLeft />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next"
            disabled={!canNext}
            onClick={() => scrollByCard(1)}
          >
            <ArrowRight />
          </Button>
          <Button variant="outline" asChild>
            <Link href={seeAllHref}>{seeAllLabel}</Link>
          </Button>
        </div>
      </div>

      <div className="relative" role="region" aria-roledescription="carousel" aria-label={ariaLabel}>
        <ul
          ref={scrollerRef}
          className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto pb-1"
        >
          {children}
        </ul>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <span
            className="block h-full origin-left rounded-full bg-primary transition-transform duration-300 ease-out"
            style={{ transform: `scaleX(${0.22 + progress * 0.78})` }}
          />
        </div>
      </div>
    </div>
  );
}

export function CardCarouselItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <li
      className={
        className ??
        "w-[min(20.5rem,82vw)] shrink-0 snap-start sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-2.5rem)/3)]"
      }
    >
      {children}
    </li>
  );
}
