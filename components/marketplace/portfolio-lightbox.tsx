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

export type GalleryPhoto = { src: string; alt: string };

export function PhotoLightbox({
  photos,
  title,
  open,
  onOpenChange,
  index,
  onIndexChange,
}: {
  photos: GalleryPhoto[];
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  index: number;
  onIndexChange: (index: number) => void;
}) {
  const touchX = useRef<number | null>(null);
  const count = photos.length;
  const current = photos[index];

  const goTo = useCallback(
    (next: number) => {
      if (!count) return;
      onIndexChange((next + count) % count);
    },
    [count, onIndexChange],
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-0 left-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none bg-black p-0 text-white ring-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{title} gallery</DialogTitle>
        <DialogDescription className="sr-only">
          Full-size photos for {title}. Use the arrows to move through the gallery.
        </DialogDescription>

        <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-6">
          <p className="min-w-0 truncate text-sm text-white/75">
            {title}
            <span className="mx-2 text-white/35">·</span>
            {index + 1} of {count}
          </p>
          <button
            type="button"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-foreground shadow-md"
            onClick={() => onOpenChange(false)}
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
            const dx =
              (event.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
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
                        : "border-white/20 opacity-55 hover:opacity-90",
                    )}
                    onClick={() => onIndexChange(photoIndex)}
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
  );
}

export function PortfolioGallery({
  photos,
  companyName,
}: {
  photos: GalleryPhoto[];
  companyName: string;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLUListElement>(null);
  const count = photos.length;
  const banner = photos[index];

  const scrollActiveThumb = useCallback((photoIndex: number) => {
    const scroller = scrollerRef.current;
    const item = scroller?.children[photoIndex] as HTMLElement | undefined;
    if (!scroller || !item) return;
    item.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, []);

  if (!count) return null;

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-input bg-card">
        <div className="relative">
          <button
            type="button"
            className="group relative block h-[min(22rem,50svh)] w-full overflow-hidden bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:h-[min(28rem,48svh)] lg:h-[min(32rem,46svh)]"
            onClick={() => setOpen(true)}
          >
            {banner ? (
              <Image
                src={banner.src}
                alt={banner.alt}
                fill
                sizes="(min-width: 1440px) 72rem, 80vw"
                className="object-cover! transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                style={{ objectFit: "cover" }}
              />
            ) : null}
            <span className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg bg-black/45 px-2 py-1 text-white backdrop-blur-md">
              {count > 1 ? (
                <span className="text-[11px] font-medium tabular-nums">
                  {index + 1}/{count}
                </span>
              ) : null}
              <Expand className="size-3.5" />
            </span>
          </button>
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
                      "relative block h-28 w-full overflow-hidden rounded-lg bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none sm:h-32",
                      photoIndex === index
                        ? "ring-2 ring-inset ring-foreground"
                        : "ring-1 ring-inset ring-black/10 hover:ring-black/25",
                    )}
                    onClick={() => {
                      setIndex(photoIndex);
                      scrollActiveThumb(photoIndex);
                    }}
                    aria-label={`Show ${photo.alt} in the main photo`}
                    aria-current={photoIndex === index ? true : undefined}
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

      <PhotoLightbox
        photos={photos}
        title={companyName}
        open={open}
        onOpenChange={setOpen}
        index={index}
        onIndexChange={setIndex}
      />
    </>
  );
}
