"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { afterLoadIdle } from "@/lib/idle";

/**
 * Keeps the server-rendered HTML of below-the-fold content (fully crawlable) but postpones
 * its React hydration until it nears the viewport, the visitor interacts with it, or — if it
 * rendered nothing on the server — the browser is idle after load. Cuts main-thread work (TBT)
 * on first load. On client-side navigation (no server HTML) children render immediately.
 */
export function DeferredHydration({
  children,
  rootMargin = "400px 0px",
}: {
  children: ReactNode;
  rootMargin?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  // Server: render children. Client: defer only when this node's server HTML is on the page.
  const [ready, setReady] = useState(
    () => typeof document === "undefined" || !document.getElementById(id),
  );

  useEffect(() => {
    if (ready) return;
    const node = ref.current;
    const target = node?.firstElementChild;
    const hydrate = () => setReady(true);

    // Interaction always wins (e.g. a click on a footer link before it scrolled in).
    node?.addEventListener("pointerover", hydrate, { once: true });
    node?.addEventListener("focusin", hydrate, { once: true });

    let observer: IntersectionObserver | undefined;
    let cancelIdle: (() => void) | undefined;
    if (target && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) hydrate();
        },
        { rootMargin },
      );
      observer.observe(target);
    } else {
      cancelIdle = afterLoadIdle(hydrate);
    }

    return () => {
      node?.removeEventListener("pointerover", hydrate);
      node?.removeEventListener("focusin", hydrate);
      observer?.disconnect();
      cancelIdle?.();
    };
  }, [ready, rootMargin]);

  if (!ready) {
    // Leaves the server markup untouched (React skips children of dangerouslySetInnerHTML).
    return (
      <div
        key="server"
        id={id}
        ref={ref}
        style={{ display: "contents" }}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: "" }}
      />
    );
  }

  // New key: React swaps the static server node for the live tree instead of appending to it.
  return (
    <div key="live" id={id} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
