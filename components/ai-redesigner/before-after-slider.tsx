"use client";

import { useCallback, useRef, useState } from "react";
import { ChevronsLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Before / After comparison: the "after" image sits on top and is clipped at the handle.
 * Drag, click, or use the arrow keys to move it.
 */
export function BeforeAfterSlider({
  before,
  after,
  alt,
  className,
}: {
  before: string;
  after: string;
  alt: string;
  className?: string;
}) {
  const [position, setPosition] = useState(50);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const moveTo = useCallback((clientX: number) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect?.width) return;
    setPosition(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  return (
    <div
      ref={frameRef}
      className={cn("relative touch-none overflow-hidden select-none", className)}
      onPointerDown={(event) => {
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        moveTo(event.clientX);
      }}
      onPointerMove={(event) => {
        if (dragging.current) moveTo(event.clientX);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- user photo from our storage, sized by the frame */}
      <img src={before} alt={`${alt} — before`} className="absolute inset-0 size-full object-cover" draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element -- AI result from our storage */}
      <img
        src={after}
        alt={`${alt} — after`}
        className="absolute inset-0 size-full object-cover"
        style={{ clipPath: `inset(0 0 0 ${position}%)` }}
        draggable={false}
      />

      <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold tracking-wider text-white uppercase backdrop-blur-sm">
        Before
      </span>
      <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold tracking-wider text-white uppercase backdrop-blur-sm">
        After
      </span>

      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" style={{ left: `${position}%` }}>
        <button
          type="button"
          role="slider"
          aria-label="Compare before and after"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(position)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") setPosition((value) => Math.max(0, value - 5));
            if (event.key === "ArrowRight") setPosition((value) => Math.min(100, value + 5));
          }}
          className="pointer-events-auto absolute top-1/2 left-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white text-foreground shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          <ChevronsLeftRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
