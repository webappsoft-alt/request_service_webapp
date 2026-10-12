"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { BotModal } from "./BotModal";
import { useBot } from "./BotProvider";

const noopSubscribe = () => () => {};

const SIZE = 56;
const EDGE = 20;
const DRAG_THRESHOLD = 6;
const DOCK_KEY = "rs-bot-launcher-dock";

type Dock = { side: "left" | "right"; bottom: number };
type DragState = { pointerId: number; startX: number; startY: number; offsetX: number; offsetY: number; moved: boolean };

const DEFAULT_DOCK: Dock = { side: "right", bottom: EDGE };

function readDock(): Dock {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DOCK_KEY) || "null") as Partial<Dock> | null;
    if (parsed && (parsed.side === "left" || parsed.side === "right") && Number.isFinite(parsed.bottom)) {
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

function clampBottom(bottom: number) {
  const max = Math.max(EDGE, window.innerHeight - SIZE - EDGE);
  return Math.min(Math.max(EDGE, bottom), max);
}

/**
 * Floating launcher: a compact brand-gradient "RS" button that expands into an
 * "RS AI Assistant" pill on hover. Drag it along the screen edge if it covers content;
 * it snaps to the nearest side and remembers the spot. Also mounts the assistant modal.
 */
export function BotWidget() {
  const { open, openBot, hasUnread, messages } = useBot();
  const resumable = messages.some((message) => message.role === "user");
  // Portal to <body>: page wrappers animate with transform, which would trap `position: fixed`.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const [dock, setDock] = useState<Dock>(DEFAULT_DOCK);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [, setViewport] = useState(0);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  // Restore the saved spot and keep it on screen when the window resizes.
  useEffect(() => {
    if (!mounted) return;
    const saved = readDock();
    const frame = requestAnimationFrame(() => setDock(saved));
    const onResize = () => setViewport(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [mounted]);

  if (!mounted) return null;

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      // Grab point inside the round badge (the pill may be expanded under a mouse).
      offsetX: Math.min(SIZE / 2, event.clientX - rect.left),
      offsetY: event.clientY - rect.top,
      moved: false,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD) return;
      drag.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setDragPoint({
      x: Math.min(Math.max(0, event.clientX - drag.offsetX), window.innerWidth - SIZE),
      y: Math.min(Math.max(0, event.clientY - drag.offsetY), window.innerHeight - SIZE),
    });
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag?.moved) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    // Snap to the nearest side, keeping the height where it was dropped.
    const x = event.clientX - drag.offsetX + SIZE / 2;
    const top = event.clientY - drag.offsetY;
    const next: Dock = {
      side: x < window.innerWidth / 2 ? "left" : "right",
      bottom: clampBottom(window.innerHeight - top - SIZE),
    };
    setDock(next);
    writeDock(next);
    setDragPoint(null);
    // The click that ends a drag must not open the chat.
    suppressClickRef.current = true;
  }

  function onClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    openBot();
  }

  const dragging = dragPoint !== null;
  const left = dock.side === "left";
  const style: CSSProperties = dragging
    ? { left: dragPoint.x, top: dragPoint.y }
    : { [dock.side]: EDGE, bottom: clampBottom(dock.bottom) };

  return createPortal(
    <>
      <button
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
        aria-label={resumable ? "Resume RS AI Assistant chat" : "Open RS AI Assistant"}
        aria-haspopup="dialog"
        title="RS AI Assistant — drag to move"
        className={cn(
          "group fixed z-50 flex h-14 touch-none items-center rounded-full p-1 text-primary-foreground select-none print:hidden",
          left ? "flex-row" : "flex-row-reverse",
          "bg-linear-to-br from-primary via-primary to-primary/80 shadow-lg ring-1 shadow-primary/30 ring-white/15",
          "transition-[box-shadow,transform,opacity] duration-300 hover:shadow-xl hover:shadow-primary/35",
          "focus-visible:ring-4 focus-visible:ring-primary/35 focus-visible:outline-none",
          dragging ? "scale-105 cursor-grabbing shadow-2xl" : "cursor-pointer active:scale-95",
          open && "pointer-events-none scale-90 opacity-0",
        )}
      >
        <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-white/12 text-[15px] font-extrabold tracking-tight ring-1 ring-white/20">
          RS
          <span
            aria-hidden
            className={cn(
              "absolute -top-0.5 size-3 rounded-full border-2 border-primary",
              left ? "-right-0.5" : "-left-0.5",
              hasUnread ? "bg-rose-500" : "bg-emerald-400",
            )}
          />
        </span>
        {/* Hover: the circle springs open into a pill with the assistant's name. */}
        <span
          className={cn(
            "grid grid-cols-[0fr] opacity-0 transition-[grid-template-columns,opacity] duration-500 ease-[cubic-bezier(0.22,1.4,0.36,1)] motion-reduce:transition-none",
            !dragging && "group-hover:grid-cols-[1fr] group-hover:opacity-100 group-focus-visible:grid-cols-[1fr] group-focus-visible:opacity-100",
          )}
        >
          <span className="overflow-hidden">
            <span className={cn("block text-sm font-semibold whitespace-nowrap", left ? "pr-4 pl-2.5" : "pr-2.5 pl-4")}>
              RS AI Assistant
            </span>
          </span>
        </span>
      </button>

      <BotModal />
    </>,
    document.body,
  );
}
