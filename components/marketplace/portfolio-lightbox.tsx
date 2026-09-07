"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function PortfolioGallery({
  photos,
  companyName,
}: {
  photos: { src: string; alt: string }[];
  companyName: string;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const scrollerRef = useRef<HTMLUListElement>(null);
  const count = photos.length;
  const current = photos[index];

  const scrollActiveThumb = useCallback((photoIndex: number) => {
    const scroller = scrollerRef.current;
    const item = scroller?.children[photoIndex] as HTMLElement | undefined;
    if (!scroller || !item) return;
    const styles = getComputedStyle(scroller);
    const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;
    const pageWidth = item.offsetWidth + gap;
    const visible = Math.max(1, Math.round((scroller.clientWidth + gap) / pageWidth));
    const page = Math.floor(photoIndex / visible);
    scroller.scrollTo({ left: page * visible * pageWidth, behavior: "smooth" });
  }, []);

  const goTo = useCallback(
    (next: number) => {
      if (!count) return;
      const resolved = (next + count) % count;
      setIndex(resolved);
      scrollActiveThumb(resolved);
    },
    [count, scrollActiveThumb]
  );

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") goTo(index - 1);
      if (event.key === "ArrowRight") goTo(index + 1);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index, open]);

  if (!count) return null;

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-black/15 bg-card">
        <div className="relative">
          <button
            type="button"
            className="group relative block h-[min(22rem,50svh)] w-full overflow-hidden bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:h-[min(28rem,48svh)] lg:h-[min(32rem,46svh)]"
            onClick={() => setOpen(true)}
          >
            {current ? (
              <Image
                src={current.src}
                alt={current.alt}
                fill
                sizes="(min-width: 1440px) 72rem, 80vw"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              />
            ) : null}
            <span
              className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-black/5"
              aria-hidden="true"
            />
            <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-left">
              <span className="min-w-0">
                <span className="mb-1 block text-[10px] font-semibold tracking-[0.16em] text-white/70 uppercase">
                  Featured work
                </span>
                <span className="block truncate text-base font-medium text-white">
                  {current?.alt}
                </span>
              </span>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white backdrop-blur-md">
                <Expand className="size-3.5" />
              </span>
            </span>
          </button>

          {count > 1 ? (
            <>
              <button
                type="button"
                className="absolute top-1/2 left-3 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg border border-white/35 bg-black/40 text-white backdrop-blur-sm hover:bg-black/55"
                onClick={() => goTo(index - 1)}
                aria-label="Previous photo"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                className="absolute top-1/2 right-3 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg border border-white/35 bg-black/40 text-white backdrop-blur-sm hover:bg-black/55"
                onClick={() => goTo(index + 1)}
                aria-label="Next photo"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          ) : null}
        </div>

        {count > 1 ? (
          <div className="p-2">
          <ul
            ref={scrollerRef}
            className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto overflow-y-hidden"
          >
            {photos.map((photo, photoIndex) => (
              <li
                key={`${photo.src}-${photoIndex}`}
                className="w-[calc((100%-1rem)/3)] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/4)] lg:w-[calc((100%-2rem)/5)]"
              >
                <button
                  type="button"
                  className={cn(
                    "relative block h-24 w-full overflow-hidden rounded-lg border bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:h-28",
                    photoIndex === index
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-foreground/15 hover:border-foreground/30",
                  )}
                  onClick={() => goTo(photoIndex)}
                  aria-label={`Show ${photo.alt}`}
                  aria-current={photoIndex === index}
                >
                  <Image
                    src={photo.src}
                    alt=""
                    fill
                    sizes="160px"
                    className="object-cover"
                  />
                </button>
              </li>
            ))}
          </ul>
          </div>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-0 left-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none bg-black p-0 text-white ring-0 sm:max-w-none"
        >
          <DialogTitle className="sr-only">{companyName} portfolio</DialogTitle>
          <DialogDescription className="sr-only">
            Full-size photos for {companyName}. Use the arrows to move through the gallery.
          </DialogDescription>

          <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-6">
            <p className="min-w-0 truncate text-sm text-white/75">
              {companyName}
              <span className="mx-2 text-white/35">·</span>
              {index + 1} of {count}
            </p>
            <button
              type="button"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-foreground shadow-md"
              onClick={() => setOpen(false)}
              aria-label="Close gallery"
            >
              <X className="size-4" />
            </button>
          </div>

          <div
            className="relative min-h-0 flex-1"
            onTouchStart={(event) => {
              touchX.current = event.changedTouches[0]?.clientX ?? null;
            }}
            onTouchEnd={(event) => {
              if (touchX.current == null) return;
              const dx = (event.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
              if (Math.abs(dx) > 40) goTo(index + (dx < 0 ? 1 : -1));
              touchX.current = null;
            }}
          >
            {current ? (
              <Image
                src={current.src}
                alt={current.alt}
                fill
                sizes="100vw"
                className="object-contain"
              />
            ) : null}

            {count > 1 ? (
              <>
                <button
                  type="button"
                  className="absolute top-1/2 left-3 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-md md:left-6"
                  onClick={() => goTo(index - 1)}
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  className="absolute top-1/2 right-3 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-md md:right-6"
                  onClick={() => goTo(index + 1)}
                  aria-label="Next photo"
                >
                  <ChevronRight className="size-5" />
                </button>
              </>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 px-4 pt-2 pb-4 md:px-6">
            <p className="truncate text-sm text-white/80">{current?.alt}</p>
            {count > 1 ? (
              <ul className="flex gap-2 overflow-x-auto pb-1">
                {photos.map((photo, photoIndex) => (
                  <li key={`thumb-${photo.src}-${photoIndex}`} className="shrink-0">
                    <button
                      type="button"
                      className={cn(
                        "relative block size-14 overflow-hidden rounded-lg border transition-opacity",
                        photoIndex === index
                          ? "border-white opacity-100"
                          : "border-white/20 opacity-55 hover:opacity-90"
                      )}
                      onClick={() => setIndex(photoIndex)}
                      aria-label={`Show photo ${photoIndex + 1}`}
                      aria-current={photoIndex === index}
                    >
                      <Image
                        src={photo.src}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
