"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { useBot } from "./BotProvider";

// The chat window (+ cards, history, address editor) renders nothing while closed,
// so its code loads on first open instead of with every page.
const BotModal = dynamic(() => import("./BotModal").then((mod) => mod.BotModal), { ssr: false });

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

function clampBottom(bottom: number, viewportHeight = window.innerHeight) {
  const max = Math.max(EDGE, viewportHeight - SIZE - EDGE);
  return Math.min(Math.max(EDGE, bottom), max);
}

/**
 * Floating launcher: an always-readable pill — "RS AI Assistant / Chat with us" next to the
 * round RS badge (green dot = online, red = unread reply). Drag it along the screen edge if it covers content;
 * it snaps to the nearest side and remembers the spot. Also mounts the assistant modal.
 */
export function BotWidget() {
  const { open, openBot, hasUnread, messages } = useBot();
  const resumable = messages.some((message) => message.role === "user");
  // Stays true after the first open so the close animation and dialog state survive.
  const [everOpened, setEverOpened] = useState(open);
  if (open && !everOpened) setEverOpened(true);
  // Portal to <body>: page wrappers animate with transform, which would trap `position: fixed`.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const [dock, setDock] = useState<Dock>(DEFAULT_DOCK);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  // Cached viewport height: reading window.innerHeight during render forces a synchronous
  // style + layout pass (a long task on mobile), so it is only read in rAF / resize.
  const [viewportHeight, setViewportHeight] = useState(0);
  const dragRef = useRef<DragState | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const suppressClickRef = useRef(false);

  // Restore the saved spot and keep it on screen when the window resizes.
  useEffect(() => {
    if (!mounted) return;
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
      offsetX: event.clientX - rect.left,
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
    // Clamp by the pill's real width so it can't be dragged off the right edge.
    const width = buttonRef.current?.offsetWidth ?? SIZE;
    setDragPoint({
      x: Math.min(Math.max(0, event.clientX - drag.offsetX), window.innerWidth - width),
      y: Math.min(Math.max(0, event.clientY - drag.offsetY), window.innerHeight - SIZE),
    });
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag?.moved) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    // Snap to the nearest side, keeping the height where it was dropped.
    const x = event.clientX - drag.offsetX + (buttonRef.current?.offsetWidth ?? SIZE) / 2;
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
    : { [dock.side]: EDGE, bottom: viewportHeight ? clampBottom(dock.bottom, viewportHeight) : EDGE };

  return createPortal(
    <>
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
        aria-label={resumable ? "Resume RS AI Assistant chat" : "Open RS AI Assistant"}
        aria-haspopup="dialog"
        title="RS AI Assistant — drag to move"
        className={cn(
          // z-40: above page content/footer, below dialogs, sheets and the assistant modal (z-50+).
          "group fixed z-40 flex h-14 max-w-[calc(100vw-2.5rem)] touch-none items-center gap-0.5 rounded-full p-1 text-primary-foreground select-none print:hidden",
          left ? "flex-row" : "flex-row-reverse",
          "bg-linear-to-br from-primary via-primary to-primary/80 shadow-lg ring-1 shadow-primary/30 ring-white/15",
          "transition-[box-shadow,transform,opacity] duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/35 motion-reduce:hover:translate-y-0",
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
        {/* Always visible so visitors can tell what the button is. */}
        <span className={cn("flex min-w-0 flex-col leading-tight", left ? "pr-4 pl-2 text-left" : "pr-2 pl-4 text-right")}>
          <span className="truncate text-sm font-bold whitespace-nowrap">RS AI Assistant</span>
          <span className="truncate text-[11px] font-medium whitespace-nowrap text-primary-foreground/80">
            {resumable ? "Continue your chat" : "Chat with us · Online"}
          </span>
        </span>
      </button>

      {everOpened ? <BotModal /> : null}
    </>,
    document.body,
  );
}
