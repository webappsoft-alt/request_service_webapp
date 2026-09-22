"use client";

import { useState } from "react";
import Image from "next/image";
import { Expand } from "lucide-react";
import { PhotoLightbox } from "@/components/marketplace/portfolio-lightbox";
import { cn } from "@/lib/utils";

export type ProjectGalleryPhoto = {
  src: string;
  alt: string;
  label?: string;
};

function tileClass(count: number, index: number) {
  if (count === 1) {
    return "min-h-[22rem] md:min-h-[32rem] lg:min-h-[36rem]";
  }
  if (count === 2) {
    return "min-h-[18rem] sm:min-h-[24rem] lg:min-h-[28rem]";
  }
  if (count === 3) {
    return index === 0
      ? "min-h-[18rem] sm:row-span-2 sm:min-h-[32rem] lg:min-h-[36rem]"
      : "min-h-[14rem] sm:min-h-0";
  }
  return index === 0
    ? "min-h-[18rem] md:col-span-2 md:row-span-2 md:min-h-[28rem] lg:min-h-[32rem]"
    : "min-h-[11rem] sm:min-h-[13rem]";
}

export function ProjectPortfolioGallery({
  photos,
  title,
}: {
  photos: ProjectGalleryPhoto[];
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const count = photos.length;

  if (!count) return null;

  const gridClass =
    count === 1
      ? "grid grid-cols-1"
      : count === 2
        ? "grid grid-cols-1 gap-2 sm:grid-cols-2"
        : count === 3
          ? "grid grid-cols-1 gap-2 sm:grid-cols-2 sm:grid-rows-2"
          : "grid grid-cols-2 gap-2 md:grid-cols-3";

  return (
    <>
      <div className={gridClass}>
        {photos.map((photo, photoIndex) => (
          <button
            key={`${photo.src}-${photoIndex}`}
            type="button"
            className={cn(
              "group relative block w-full overflow-hidden rounded-xl bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              tileClass(count, photoIndex),
            )}
            onClick={() => {
              setIndex(photoIndex);
              setOpen(true);
            }}
            aria-label={`Open ${photo.alt}`}
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes={
                photoIndex === 0
                  ? "(min-width: 1280px) 56rem, 92vw"
                  : "(min-width: 1280px) 22rem, 45vw"
              }
              className="object-cover! transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              style={{ objectFit: "cover" }}
              priority={photoIndex === 0}
            />
            {photo.label ? (
              <span className="absolute top-3 left-3 rounded-md bg-black/55 px-2 py-1 text-[11px] font-semibold tracking-wide text-white uppercase backdrop-blur-sm">
                {photo.label}
              </span>
            ) : null}
            <span className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-md bg-black/45 px-2 py-1 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <Expand className="size-3.5" />
              <span className="text-[11px] font-medium tabular-nums">
                {photoIndex + 1}/{count}
              </span>
            </span>
          </button>
        ))}
      </div>

      <PhotoLightbox
        photos={photos}
        title={title}
        open={open}
        onOpenChange={setOpen}
        index={index}
        onIndexChange={setIndex}
      />
    </>
  );
}
