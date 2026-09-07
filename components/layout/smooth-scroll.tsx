"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

function shouldSkipLenis(pathname: string) {
  // Nested / page-owned scrollers — Lenis syncTouch makes touch scroll intermittent.
  if (
    pathname === "/find-a-professional" ||
    pathname === "/get-a-quote" ||
    /^\/services\/[^/]+$/.test(pathname)
  ) {
    return true;
  }

  // Auth forms must use native page scroll on mobile.
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/pro/login" ||
    pathname === "/pro/register" ||
    pathname === "/pro/forgot-password" ||
    pathname === "/pro/reset-password"
  ) {
    return true;
  }

  // Portal has its own sticky chrome; keep native scroll.
  if (pathname.startsWith("/pro/dashboard")) {
    return true;
  }

  return false;
}

export function SmoothScroll() {
  const pathname = usePathname();
  const skip = shouldSkipLenis(pathname);

  useEffect(() => {
    if (skip) return;

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
  }, [skip]);

  return null;
}
