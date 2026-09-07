"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

export function SmoothScroll() {
  const pathname = usePathname();
  const hasOwnScroller =
    pathname === "/find-a-professional" ||
    pathname === "/get-a-quote" ||
    /^\/services\/[^/]+$/.test(pathname);

  useEffect(() => {
    if (hasOwnScroller) return;

    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.075,
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.15,
      syncTouch: true,
      allowNestedScroll: true,
    });

    return () => lenis.destroy();
  }, [hasOwnScroller]);

  return null;
}
