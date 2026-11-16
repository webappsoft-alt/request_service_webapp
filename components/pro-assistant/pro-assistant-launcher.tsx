"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
        bottom: viewportHeight
          ? clampBottom(dock.bottom, viewportHeight)
          : EDGE,
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
        "group fixed z-40 flex h-12 max-w-[calc(100vw-2.5rem)] touch-none items-center gap-2 rounded-full bg-linear-to-br from-primary via-primary to-primary/80 py-1 text-primary-foreground shadow-lg ring-1 shadow-primary/30 ring-white/15 select-none transition-[transform,box-shadow,opacity] duration-300 hover:-translate-y-0.5 hover:shadow-xl print:hidden motion-reduce:hover:translate-y-0",
        left ? "flex-row-reverse pr-1 pl-4" : "flex-row pr-4 pl-1",
        dragging
          ? "scale-105 cursor-grabbing shadow-2xl"
          : "cursor-pointer active:scale-95",
        open && "pointer-events-none scale-90 opacity-0",
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
          "flex min-w-0 flex-col leading-tight",
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
