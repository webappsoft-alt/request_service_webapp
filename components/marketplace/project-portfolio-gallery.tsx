"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

function parsePhotoIndex(raw: string | null, count: number) {
  if (raw == null || !count) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.min(parsed, count - 1);
}

function ProjectPortfolioGalleryInner({
  photos,
  title,
}: {
  photos: ProjectGalleryPhoto[];
  title: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const count = photos.length;
  const queryPhoto = parsePhotoIndex(searchParams.get("photo"), count);

  const [open, setOpen] = useState(queryPhoto != null);
  const [index, setIndex] = useState(queryPhoto ?? 0);

  useEffect(() => {
    if (queryPhoto == null) return;
    setIndex(queryPhoto);
    setOpen(true);
  }, [queryPhoto]);

  const clearPhotoQuery = useCallback(() => {
    if (!searchParams.has("photo")) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("photo");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) clearPhotoQuery();
    },
    [clearPhotoQuery],
  );

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
              unoptimized={photo.src.startsWith("http")}
            />
            {photo.label ? (
              <span className="absolute top-3 left-3 rounded-md bg-black/55 px-2 py-1 text-[11px] font-semibold tracking-wide text-white uppercase backdrop-blur-sm">
                {photo.label}
              </span>
            ) : null}
            <span className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-md bg-black/45 px-2 py-1 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <Expand className="size-3.5" />
            </span>
          </button>
        ))}
      </div>

      <PhotoLightbox
        photos={photos}
        title={title}
        open={open}
        onOpenChange={handleOpenChange}
        index={index}
        onIndexChange={setIndex}
      />
    </>
  );
}

export function ProjectPortfolioGallery({
  photos,
  title,
}: {
  photos: ProjectGalleryPhoto[];
  title: string;
}) {
  return (
    <Suspense fallback={null}>
      <ProjectPortfolioGalleryInner photos={photos} title={title} />
    </Suspense>
  );
}
