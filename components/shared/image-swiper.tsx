"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function ImageSwiper({
  images,
  alt,
  sizes,
  className,
  aspectClassName = "aspect-[16/10]",
  index,
  onIndexChange,
  onImageClick,
}: {
  images: string[];
  alt: string;
  sizes: string;
  className?: string;
  aspectClassName?: string;
  index?: number;
  onIndexChange?: (index: number) => void;
  onImageClick?: (index: number) => void;
}) {
  const [internalIndex, setInternalIndex] = useState(0);
  const current = index ?? internalIndex;
  const count = images.length;
  const src = images[current] ?? images[0];

  function goTo(next: number) {
    const wrapped = (next + count) % count;
    onIndexChange?.(wrapped);
    if (index === undefined) setInternalIndex(wrapped);
  }

  if (!src) return null;

  return (
    <div className={cn("relative overflow-hidden", aspectClassName, className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className="object-cover"
      />
      {onImageClick ? (
        <button
          type="button"
          className="absolute inset-0 z-10"
          onClick={(event) => {
            event.stopPropagation();
            onImageClick(current);
          }}
          aria-label="Open photo"
        />
      ) : null}
      {count > 1 ? (
        <>
          <button
            type="button"
            className="absolute top-1/2 left-2 z-20 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md"
            onClick={(event) => {
              event.stopPropagation();
              goTo(current - 1);
            }}
            aria-label="Previous photo"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            className="absolute top-1/2 right-2 z-20 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md"
            onClick={(event) => {
              event.stopPropagation();
              goTo(current + 1);
            }}
            aria-label="Next photo"
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 gap-1">
            {images.map((image, imageIndex) => (
              <button
                key={`${image}-${imageIndex}`}
                type="button"
                className={cn(
                  "size-1.5 rounded-full",
                  imageIndex === current ? "bg-white" : "bg-white/45"
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  goTo(imageIndex);
                }}
                aria-label={`Show photo ${imageIndex + 1}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
