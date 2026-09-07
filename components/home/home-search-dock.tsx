"use client";

import { useEffect, useRef } from "react";
import { HeroServiceScroller } from "@/components/home/hero-service-scroller";
import { useHomeCategoryFilter } from "@/components/home/home-category-filter";
import { Container } from "@/components/layout/container";
import { ServiceSearchForm } from "@/components/shared/service-search-form";
import { cn } from "@/lib/utils";

export function HomeSearchDock() {
  const { dockPinned, unpinDock } = useHomeCategoryFilter();
  const ignoreUntilRef = useRef(0);

  useEffect(() => {
    if (!dockPinned) return;

    ignoreUntilRef.current = Date.now() + 700;
    let startY = 0;

    const onWheel = (event: WheelEvent) => {
      if (Date.now() < ignoreUntilRef.current) return;
      if (Math.abs(event.deltaY) < 10) return;
      unpinDock();
    };

    const onTouchStart = (event: TouchEvent) => {
      startY = event.touches[0]?.clientY ?? 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (Date.now() < ignoreUntilRef.current) return;
      const y = event.touches[0]?.clientY ?? startY;
      if (Math.abs(y - startY) > 16) unpinDock();
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [dockPinned, unpinDock]);

  return (
    <div className={cn(dockPinned ? "sticky top-17 z-40" : "relative z-20")}>
      <Container className="enter-visual relative -mt-14 lg:-mt-16">
        <div className="relative z-40 mx-auto w-full max-w-3xl overflow-visible rounded-xl border border-foreground/30 bg-card p-1.5 shadow-2xl md:p-2">
          <ServiceSearchForm />
          <div className="relative z-0">
            <HeroServiceScroller />
          </div>
        </div>
      </Container>
    </div>
  );
}
