"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type Lenis from "lenis";
import "lenis/dist/lenis.css";
import { afterLoadIdle } from "@/lib/idle";
import { proPaths } from "@/lib/pro-paths";

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
    pathname === "/verify-forgot-otp" ||
    pathname === "/verify-otp" ||
    pathname === "/reset-password" ||
    pathname === "/pro/login" ||
    pathname === proPaths.join ||
    pathname === "/pro/verify-otp" ||
    pathname === "/pro/forgot-password" ||
    pathname === "/pro/verify-forgot-otp" ||
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
  const lenisRef = useRef<Lenis | null>(null);

  // Global scroll restoration and reload handling
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const resetToTop = () => {
      window.scrollTo(0, 0);
      if (lenisRef.current) {
        lenisRef.current.scrollTo(0, { immediate: true });
      }
    };

    // Scroll to top immediately on mount
    resetToTop();

    // Before unload (reload / navigate away), force position to top
    const handleBeforeUnload = () => {
      window.scrollTo(0, 0);
    };

    const handlePageShow = () => {
      resetToTop();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("load", resetToTop);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("load", resetToTop);
    };
  }, []);

  // Whenever route changes, scroll immediately to top
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true });
    }
  }, [pathname]);

  // Initialize Lenis
  useEffect(() => {
    if (skip) {
      lenisRef.current = null;
      return;
    }

    // Lenis restyles the whole document when it starts (~1s main thread on mobile), so it is
    // loaded on the visitor's first scroll intent — after window load — never during page load (TBT).
    let cancelled = false;
    let lenis: Lenis | null = null;
    // Real scrolling only — not taps/typing in the hero search.
    const intents = ["wheel", "touchmove", "scroll"] as const;
    let cancelIdle = () => {};
    const start = () => {
      for (const type of intents) window.removeEventListener(type, start);
      cancelIdle = afterLoadIdle(load, 300);
    };
    for (const type of intents) window.addEventListener(type, start, { passive: true });

    const load = () => void import("lenis").then(({ default: LenisClass }) => {
      if (cancelled) return;
      lenis = new LenisClass({
        autoRaf: true,
        lerp: 0.075,
        smoothWheel: true,
        wheelMultiplier: 0.9,
        touchMultiplier: 1.15,
        syncTouch: true,
        allowNestedScroll: true,
      });

      lenisRef.current = lenis;

      // Scroll to top upon Lenis initialization — unless the visitor already
      // started scrolling while Lenis was loading.
      if (window.scrollY < 4) lenis.scrollTo(0, { immediate: true });
    });

    return () => {
      cancelled = true;
      for (const type of intents) window.removeEventListener(type, start);
      cancelIdle();
      lenis?.destroy();
      lenisRef.current = null;
    };
  }, [skip]);

  return null;
}
