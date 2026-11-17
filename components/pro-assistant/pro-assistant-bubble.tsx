"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { usePathname } from "next/navigation";
import { Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Floating "Pro Co-pilot" bubble (client spec):
 *  - starts bottom-right; drag it ANYWHERE (free x / y, no snapping) — the spot is saved in
 *    localStorage and kept on screen when the window resizes;
 *  - smart collision: when a button, link, field, pagination control… is under the bubble, it
 *    slides up smoothly to the nearest clear spot (and back down when the space is free again);
 *  - while a dialog / side sheet is open it fades away, so it never sits over their actions.
 * A click opens the co-pilot; a drag never does.
 */

const SIZE = 52;
const EDGE = 16;
const DRAG_THRESHOLD = 6;
const STORAGE_KEY = "rs-pro-copilot-bubble:v1";
const LIFT_STEP = 8;
const MAX_LIFT = 280;
/** What counts as something the bubble must not cover. */
const INTERACTIVE =
  'button, a[href], input, select, textarea, label, summary, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="switch"], [role="combobox"], [role="menuitem"], [contenteditable="true"], nav[aria-label*="agination" i], [data-slot="pagination"]';
/** Open overlays the bubble hides for (our own panel excluded). */
const OVERLAY = '[role="dialog"]:not(.pa-panel), [role="alertdialog"], [data-slot="dialog-content"], [data-slot="sheet-content"]';

/**
 * Which side it sits on + distance from the bottom. Client: "only right side or left side, not in
 * the centre" — a drop snaps to the nearer side (right window edge, or the left edge of the page
 * content, past the sidebar); up / down stays free.
 * Previous: free x — `type Spot = { right: number; bottom: number }`.
 */
type Side = "left" | "right";
type Spot = { side: Side; bottom: number };
const DEFAULT_SPOT: Spot = { side: "right", bottom: EDGE + 4 };
const SIDE_GAP = EDGE + 4;

/** Left edge of the page content (the portal sidebar is skipped so the pill never covers its menu). */
function contentLeft(): number {
  const main = document.querySelector("main");
  const left = main ? main.getBoundingClientRect().left : 0;
  return Math.max(0, Math.round(left)) + SIDE_GAP;
}

function readSpot(): Spot {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (parsed && (parsed.side === "left" || parsed.side === "right") && Number.isFinite(parsed.bottom)) {
      // Right side only (client). Previous: return { side: parsed.side, bottom: parsed.bottom };
      return { side: "right", bottom: parsed.bottom };
    }
    // Spot saved by the free-x version → the nearer side.
    if (parsed && Number.isFinite(parsed.right) && Number.isFinite(parsed.bottom)) {
      // Previous: side: parsed.right < window.innerWidth / 2 ? "right" : "left"
      return { side: "right", bottom: parsed.bottom };
    }
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_SPOT;
}
function saveSpot(spot: Spot) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spot));
  } catch {
    /* storage unavailable — the spot still applies this session */
  }
}
/** Keeps the bottom distance on screen. Previous: also clamped the free `right` distance. */
function clampSpot(spot: Spot, height: number): Spot {
  return { side: spot.side, bottom: Math.min(Math.max(EDGE, spot.bottom), Math.max(EDGE, height - SIZE - EDGE)) };
}
/** Pixel x of the pill's left edge for a side. */
function sideLeft(side: Side, width: number, w: number): number {
  return side === "right" ? Math.max(EDGE, width - SIDE_GAP - w) : Math.min(contentLeft(), Math.max(EDGE, width - SIDE_GAP - w));
}

type Drag = { pointerId: number; startX: number; startY: number; offsetX: number; offsetY: number; moved: boolean };

export function ProAssistantBubble({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  const pathname = usePathname();
  const [spot, setSpot] = useState<Spot>(DEFAULT_SPOT);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [lift, setLift] = useState(0);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // const labelRef = useRef<HTMLSpanElement>(null); — old separate dark label (replaced by the open pill)
  const [, setPillWidth] = useState(SIZE); // re-render when the pill width changes
  const widthRef = useRef(SIZE);
  const dragRef = useRef<Drag | null>(null);
  const suppressClickRef = useRef(false);
  const spotRef = useRef(spot);
  useEffect(() => {
    spotRef.current = spot;
  }, [spot]);

  // Restore the saved spot; track the window size.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      setSpot(clampSpot(readSpot(), window.innerHeight));
    });
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Track the pill's real width (text shows from 640px; round icon only on phones).
  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;
    const update = () => {
      const w = button.offsetWidth || SIZE;
      widthRef.current = w;
      setPillWidth((current) => (current === w ? current : w));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(button);
    return () => observer.disconnect();
  }, []);

  const placed = viewport.width ? clampSpot(spot, viewport.height) : spot;
  // Left-side x (content edge) — re-read on resize / route change (sidebar collapses, etc.).
  const [leftX, setLeftX] = useState(SIDE_GAP);

  /**
   * Smart collision: the smallest upward lift (0…280px) at which nothing interactive is under the
   * bubble. Reads what is on screen at 9 points of each candidate square (the bubble itself is
   * ignored), so it follows scrolling, route changes and content that appears later.
   */
  const measure = useCallback(() => {
    const button = buttonRef.current;
    if (!button || dragRef.current) return;
    setOverlayOpen(Boolean(document.querySelector(OVERLAY)));
    const width = window.innerWidth;
    const height = window.innerHeight;
    const w = widthRef.current;
    const base = clampSpot(spotRef.current, height);
    const left = sideLeft(base.side, width, w);
    if (base.side === "left") setLeftX((current) => (current === left ? current : left));
    // Previous: 3×3 points on the round bubble + 3 on the separate label. Now the whole pill.
    const xs = w > SIZE ? [0.05, 0.27, 0.5, 0.73, 0.95] : [0.12, 0.5, 0.88];
    const blocked = (top: number) => {
      const points = xs.flatMap((fx) => [0.12, 0.5, 0.88].map((fy) => [left + w * fx, top + SIZE * fy]));
      return points.some(([x, y]) => {
        if (y < 0 || y > height) return false;
        const under = document.elementsFromPoint(x, y).find((el) => !button.contains(el) && !el.closest(".pa-panel"));
        return Boolean(under?.closest(INTERACTIVE));
      });
    };
    const baseTop = height - base.bottom - SIZE;
    // Nothing clear within reach → stay where the Pro put it (lift 0).
    let next = 0;
    for (let up = 0; up <= MAX_LIFT && baseTop - up >= EDGE; up += LIFT_STEP) {
      if (!blocked(baseTop - up)) {
        next = up;
        break;
      }
    }
    setLift((current) => (current === next ? current : next));
  }, []);

  // Re-check (debounced) on scroll — any scroll container —, resize, DOM changes and route changes.
  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => requestAnimationFrame(measure), 120);
    };
    schedule();
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-state", "hidden", "aria-hidden"] });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [measure, pathname, spot]);

  /* ───────── drag (free position) ───────── */

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD) return;
    drag.moved = true;
    const x = Math.min(Math.max(EDGE, event.clientX - drag.offsetX), window.innerWidth - widthRef.current - EDGE);
    const y = Math.min(Math.max(EDGE, event.clientY - drag.offsetY), window.innerHeight - SIZE - EDGE);
    setDragPoint({ x, y });
  }
  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.moved || !dragPoint) {
      setDragPoint(null);
      return;
    }
    suppressClickRef.current = true;
    // Snap to the nearer side (never left in the centre); height stays where it was dropped.
    // Previous: kept the free x — `right: window.innerWidth - dragPoint.x - widthRef.current`.
    // const centre = dragPoint.x + widthRef.current / 2; — used by the left / right snap
    const next = clampSpot(
      // Right side only (client: "only in right side"). Previous: centre < window.innerWidth / 2 ? "left" : "right".
      { side: "right", bottom: window.innerHeight - dragPoint.y - SIZE },
      window.innerHeight,
    );
    if (next.side === "left") setLeftX(sideLeft("left", window.innerWidth, widthRef.current));
    setSpot(next);
    saveSpot(next);
    setLift(0);
    setDragPoint(null);
  }

  const dragging = dragPoint !== null;
  const style: CSSProperties = dragging
    ? { right: SIDE_GAP, top: dragPoint.y } // Previous: { left: dragPoint.x, top: dragPoint.y }
    : {
        ...(placed.side === "right" ? { right: SIDE_GAP } : { left: leftX }),
        bottom: placed.bottom,
        transform: lift ? `translateY(-${lift}px)` : undefined,
      };
  // Previous style: { right: placed.right, bottom: placed.bottom, transform: … }
  const hidden = open || overlayOpen;
  // const labelOnLeft = viewport.width ? placed.right < viewport.width / 2 : true; — old separate label

  return (
    <button
      ref={buttonRef}
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        dragRef.current = null;
        setDragPoint(null);
      }}
      onClick={() => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        onOpen();
      }}
      style={style}
      aria-label="Open Pro co-pilot"
      aria-haspopup="dialog"
      title="Pro co-pilot (Ctrl+J) — drag to move"
      className={cn(
        // Open pill by default (client: "this one" — icon + "Pro Co-pilot" + "Ask · navigate · estimate");
        // round icon only on phones. Previous: round 52px bubble + separate dark label —
        // "group fixed z-40 flex touch-none items-center justify-center rounded-full … ring-white/20 …".
        "group fixed z-40 flex h-13 touch-none items-center gap-2.5 rounded-full bg-linear-to-br from-primary via-primary to-primary/80 p-1.5 text-primary-foreground shadow-lg ring-1 shadow-primary/30 ring-white/15 select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:pr-5 print:hidden",
        dragging
          ? "scale-105 cursor-grabbing shadow-2xl"
          : "cursor-grab transition-[transform,opacity,box-shadow] duration-300 ease-out hover:shadow-xl active:scale-95",
        hidden && "pointer-events-none scale-75 opacity-0",
      )}
    >
      <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/20">
        <Wand2 className="size-4.5" aria-hidden />
        <span aria-hidden className="absolute -top-0.5 -left-0.5 size-3 rounded-full border-2 border-primary bg-emerald-400" />
      </span>
      <span aria-hidden className="hidden flex-col text-left leading-tight sm:flex">
        <span className="text-sm font-bold whitespace-nowrap">Pro Co-pilot</span>
        <span className="text-[11px] font-medium whitespace-nowrap text-primary-foreground/80">Ask · navigate · estimate</span>
      </span>
      {/* Previous (round bubble): 52px icon + green dot top-right + a separate always-shown dark
          label "Pro Co-pilot · Ctrl J" beside it (ref={labelRef}, side chosen by labelOnLeft). */}
    </button>
  );
}
