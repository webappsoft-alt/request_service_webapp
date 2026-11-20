"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { usePathname } from "next/navigation";
import { Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Full-height chat pages keep their message box at the bottom: the launcher sits above it there
 * (never on the Send button). Pixels from the bottom of the window.
 */
const CHAT_PAGE = /^\/pro\/dashboard\/(?:messages|team-chat)(?:\/|$)/;
const CHAT_PAGE_MIN_BOTTOM = 96;

// Same drag behaviour as the customer RS AI launcher (components/bot-ai/BotWidget.tsx):
// drag it anywhere, it snaps to the nearest side at the height it was dropped and remembers the spot.
const HEIGHT = 48;
const EDGE = 20;
const DRAG_THRESHOLD = 6;
const DOCK_KEY = "rs-pro-copilot-launcher-dock";

type Dock = { side: "left" | "right"; bottom: number };
type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
};

const DEFAULT_DOCK: Dock = { side: "right", bottom: EDGE };

function readDock(): Dock {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(DOCK_KEY) || "null",
    ) as Partial<Dock> | null;
    if (
      parsed &&
      (parsed.side === "left" || parsed.side === "right") &&
      Number.isFinite(parsed.bottom)
    ) {
      return { side: parsed.side, bottom: Number(parsed.bottom) };
    }
  } catch {
    // Storage blocked: default corner.
  }
  return DEFAULT_DOCK;
}

function writeDock(dock: Dock) {
  try {
    window.localStorage.setItem(DOCK_KEY, JSON.stringify(dock));
  } catch {
    // Non-fatal: the position just isn't remembered.
  }
}

function clampBottom(bottom: number, viewportHeight: number) {
  const max = Math.max(EDGE, viewportHeight - HEIGHT - EDGE);
  return Math.min(Math.max(EDGE, bottom), max);
}

/** Floating "Pro Co-pilot" pill. Click opens the panel; drag moves it (the drop never opens it). */
export function ProAssistantLauncher({
  open,
  onOpen,
}: {
  open: boolean;
  onOpen: () => void;
}) {
  const pathname = usePathname();
  const minBottom = CHAT_PAGE.test(pathname || "") ? CHAT_PAGE_MIN_BOTTOM : EDGE;
  const [dock, setDock] = useState<Dock>(DEFAULT_DOCK);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  // Viewport height is cached (read only in rAF / resize, never during render).
  const [viewportHeight, setViewportHeight] = useState(0);
  const dragRef = useRef<DragState | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const suppressClickRef = useRef(false);

  // Restore the saved spot and keep it on screen when the window resizes.
  useEffect(() => {
    const saved = readDock();
    const frame = requestAnimationFrame(() => {
      setViewportHeight(window.innerHeight);
      setDock(saved);
    });
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, []);

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
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved) {
      if (
        Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <
        DRAG_THRESHOLD
      )
        return;
      drag.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const width = buttonRef.current?.offsetWidth ?? HEIGHT;
    setDragPoint({
      x: Math.min(
        Math.max(0, event.clientX - drag.offsetX),
        window.innerWidth - width,
      ),
      y: Math.min(
        Math.max(0, event.clientY - drag.offsetY),
        window.innerHeight - HEIGHT,
      ),
    });
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag?.moved) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    // Snap to the nearest side, keeping the height where it was dropped.
    const x =
      event.clientX -
      drag.offsetX +
      (buttonRef.current?.offsetWidth ?? HEIGHT) / 2;
    const top = event.clientY - drag.offsetY;
    const next: Dock = {
      side: x < window.innerWidth / 2 ? "left" : "right",
      bottom: clampBottom(
        window.innerHeight - top - HEIGHT,
        window.innerHeight,
      ),
    };
    setDock(next);
    writeDock(next);
    setDragPoint(null);
    // The click that ends a drag must not open the co-pilot.
    suppressClickRef.current = true;
  }

  function onClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onOpen();
  }

  const dragging = dragPoint !== null;
  const left = dock.side === "left";
  const style: CSSProperties = dragging
    ? { left: dragPoint.x, top: dragPoint.y }
    : {
        [dock.side]: EDGE,
        // Previous: viewportHeight ? clampBottom(dock.bottom, viewportHeight) : EDGE
        bottom: Math.max(minBottom, viewportHeight ? clampBottom(dock.bottom, viewportHeight) : EDGE),
      };

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        dragRef.current = null;
        setDragPoint(null);
      }}
      style={style}
      aria-label="Open Pro co-pilot"
      aria-haspopup="dialog"
      title="Pro co-pilot (Ctrl+J) — drag to move"
      className={cn(
        // Compact when idle: a round icon button; the label slides out on hover / keyboard focus,
        // so it covers as little of the page (form buttons, pagination) as possible.
        // Previous: always the full pill — "… gap-2 … py-1 …" + left ? "flex-row-reverse pr-1 pl-4" : "flex-row pr-4 pl-1".
        "group fixed z-40 flex h-12 max-w-[calc(100vw-2.5rem)] touch-none items-center gap-0 rounded-full bg-linear-to-br from-primary via-primary to-primary/80 p-1 text-primary-foreground shadow-lg ring-1 shadow-primary/30 ring-white/15 select-none transition-[transform,box-shadow,opacity,padding,gap] duration-300 hover:-translate-y-0.5 hover:gap-2 hover:shadow-xl focus-visible:gap-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none print:hidden motion-reduce:hover:translate-y-0",
        left ? "flex-row-reverse hover:pl-4 focus-visible:pl-4" : "flex-row hover:pr-4 focus-visible:pr-4",
        dragging
          ? "scale-105 cursor-grabbing shadow-2xl"
          : "cursor-pointer active:scale-95",
        open && "pointer-events-none scale-90 opacity-0",
        // Phones: chat pages are composer + quick replies at the bottom — the launcher would sit on
        // the send button, so it's hidden there (still in the header button / other pages).
        CHAT_PAGE.test(pathname || "") && "max-sm:hidden",
      )}
    >
      <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/20">
        <Wand2 className="size-[18px]" aria-hidden />
        <span
          aria-hidden
          className={cn(
            "absolute -top-0.5 size-3 rounded-full border-2 border-primary bg-emerald-400",
            left ? "-right-0.5" : "-left-0.5",
          )}
        />
      </span>
      <span
        className={cn(
          // Hidden (zero width) until hover / focus; still read by screen readers via aria-label.
          "flex max-w-0 min-w-0 flex-col overflow-hidden leading-tight opacity-0 transition-[max-width,opacity] duration-300 group-hover:max-w-44 group-hover:opacity-100 group-focus-visible:max-w-44 group-focus-visible:opacity-100",
          left ? "text-right" : "text-left",
        )}
      >
        <span className="truncate text-sm font-bold whitespace-nowrap">
          Pro Co-pilot
        </span>
        <span className="hidden truncate text-[11px] font-medium whitespace-nowrap text-primary-foreground/80 sm:block">
          Ask · navigate · estimate
        </span>
      </span>
    </button>
  );
}

/** Window event that opens / closes the co-pilot (header button → ProAssistant). */
export const PRO_ASSISTANT_TOGGLE_EVENT = "rs-pro-assistant:toggle";

/**
 * Co-pilot button in the portal's top bar (next to notifications). Replaces the floating launcher:
 * nothing floats over the page, so it never covers form buttons, tables or pagination.
 */
export function ProAssistantHeaderButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(PRO_ASSISTANT_TOGGLE_EVENT))}
      aria-label="Open Pro co-pilot"
      aria-haspopup="dialog"
      title="Pro co-pilot (Ctrl+J)"
      className={cn(
        "group inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-linear-to-br from-primary via-primary to-primary/85 pr-1 pl-1 text-primary-foreground shadow-sm ring-1 shadow-primary/20 ring-white/10 transition hover:shadow-md hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:pr-3",
        className,
      )}
    >
      <span className="relative flex size-6 items-center justify-center rounded-full bg-white/15">
        <Wand2 className="size-3.5" aria-hidden />
        <span aria-hidden className="absolute -top-0.5 -right-0.5 size-2 rounded-full border border-primary bg-emerald-400" />
      </span>
      <span className="hidden text-xs font-semibold whitespace-nowrap sm:inline">Co-pilot</span>
      <kbd className="hidden rounded bg-white/15 px-1 py-px font-sans text-[10px] font-medium text-primary-foreground/85 xl:inline">
        Ctrl J
      </kbd>
    </button>
  );
}

/**
 * Slim vertical "Co-pilot" tab on the right edge of the screen, at mid height (client's choice).
 * It sits beside the page, not over its bottom, so form buttons, tables and pagination are never
 * covered; it hides while the panel is open. Ctrl/⌘ + J still toggles the co-pilot.
 */
export function ProAssistantEdgeTab({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open Pro co-pilot"
      aria-haspopup="dialog"
      title="Pro co-pilot (Ctrl+J)"
      className={cn(
        "group fixed top-1/2 right-0 z-30 flex -translate-y-1/2 flex-col items-center gap-2 rounded-l-xl bg-linear-to-b from-primary to-primary/85 px-1.5 py-3 text-primary-foreground shadow-lg ring-1 shadow-primary/25 ring-white/10 transition-[padding,opacity,transform] duration-300 hover:pr-2.5 hover:pl-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none print:hidden",
        open && "pointer-events-none translate-x-full opacity-0",
      )}
    >
      <span className="relative flex size-6 items-center justify-center rounded-full bg-white/15">
        <Wand2 className="size-3.5" aria-hidden />
        <span aria-hidden className="absolute -top-0.5 -left-0.5 size-2 rounded-full border border-primary bg-emerald-400" />
      </span>
      <span className="text-[11px] font-semibold tracking-wide [writing-mode:vertical-rl] rotate-180">Co-pilot</span>
    </button>
  );
}
