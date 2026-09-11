"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Package } from "lucide-react";
import { cn } from "@/lib/utils";

type ImageGallerySliderProps = {
  images: string[];
  alt: string;
  className?: string;
  /** Compact mode for order cards (arrows only, no thumbs). */
  compact?: boolean;
  priority?: boolean;
  /** Auto-advance interval in ms. Set 0 to disable. Default 4500. */
  autoPlayMs?: number;
};

export function ImageGallerySlider({
  images,
  alt,
  className,
  compact = false,
  priority = false,
  autoPlayMs = 4500,
}: ImageGallerySliderProps) {
  const slides = images.filter((src) => Boolean(String(src || "").trim()));
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const showControls = slides.length > 1;

  useEffect(() => {
    setIndex(0);
  }, [slides.join("|")]);

  useEffect(() => {
    if (!showControls || paused || !autoPlayMs || autoPlayMs < 1000) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, autoPlayMs);
    return () => window.clearInterval(timer);
  }, [showControls, paused, autoPlayMs, slides.length]);

  if (!slides.length) {
    return (
      <div
        className={cn(
          "relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted text-muted-foreground",
          className,
        )}
      >
        <Package className="size-10 opacity-35" />
      </div>
    );
  }

  const go = (delta: number) => {
    setIndex((prev) => (prev + delta + slides.length) % slides.length);
  };

  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border bg-muted">
        {slides.map((src, i) => {
          const active = i === index;
          return (
            <div
              key={`${src}-${i}`}
              aria-hidden={!active}
              className={cn(
                "absolute inset-0 transition-[opacity,transform] duration-500 ease-out",
                active
                  ? "z-[1] translate-x-0 opacity-100"
                  : "z-0 translate-x-3 opacity-0",
              )}
            >
              <Image
                src={src}
                alt={active ? alt : ""}
                fill
                sizes={
                  compact
                    ? "(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
                    : "(min-width: 1024px) 55vw, 90vw"
                }
                className="object-cover"
                unoptimized={src.startsWith("http")}
                priority={priority && i === 0}
              />
            </div>
          );
        })}

        {showControls ? (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => go(-1)}
              className={cn(
                "absolute top-1/2 z-10 flex -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow-sm transition-colors hover:bg-black/75",
                compact ? "left-2 size-8" : "left-3 size-9",
              )}
            >
              <ChevronLeft className={compact ? "size-4" : "size-5"} />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={() => go(1)}
              className={cn(
                "absolute top-1/2 z-10 flex -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow-sm transition-colors hover:bg-black/75",
                compact ? "right-2 size-8" : "right-3 size-9",
              )}
            >
              <ChevronRight className={compact ? "size-4" : "size-5"} />
            </button>

            <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={`dot-${i}`}
                  type="button"
                  aria-label={`Go to image ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === index
                      ? "w-5 bg-white"
                      : "w-1.5 bg-white/55 hover:bg-white/80",
                  )}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {showControls && !compact ? (
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {slides.map((src, i) => {
            const active = i === index;
            return (
              <button
                key={`${src}-${i}`}
                type="button"
                aria-label={`Show image ${i + 1}`}
                aria-current={active ? "true" : undefined}
                onClick={() => setIndex(i)}
                className={cn(
                  "relative h-14 w-20 shrink-0 overflow-hidden rounded-md border-2 bg-muted transition-[border-color,opacity]",
                  active
                    ? "border-primary opacity-100"
                    : "border-transparent opacity-75 hover:opacity-100",
                )}
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized={src.startsWith("http")}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
