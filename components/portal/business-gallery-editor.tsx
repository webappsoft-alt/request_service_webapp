"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { GripVertical, ImagePlus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { extractUploadedUrl, uploadFile } from "@/components/api/uploadFile";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  GALLERY_MAX,
  GALLERY_MIN,
  galleryBanner,
  reorderGallery,
  withBannerAt,
  type BusinessGalleryImage,
} from "@/lib/business-gallery";
import { cn } from "@/lib/utils";

export function BusinessGalleryEditor({
  images,
  onChange,
}: {
  images: BusinessGalleryImage[];
  onChange: (next: BusinessGalleryImage[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const banner = galleryBanner(images);
  const remaining = GALLERY_MAX - images.length;

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!list.length) {
      toast.error("Choose image files.");
      return;
    }
    const room = GALLERY_MAX - images.length;
    if (room <= 0) {
      toast.error(`You can add up to ${GALLERY_MAX} photos.`);
      return;
    }
    const toUpload = list.slice(0, room);
    setUploading(true);
    try {
      const uploaded: BusinessGalleryImage[] = [];
      for (const file of toUpload) {
        const response = await uploadFile(file);
        const url = extractUploadedUrl(response.data);
        if (!url) continue;
        uploaded.push({
          url,
          isBanner: false,
          sortOrder: images.length + uploaded.length,
        });
      }
      if (!uploaded.length) {
        toast.error("Could not upload those photos.");
        return;
      }
      const next = [...images, ...uploaded];
      onChange(next.length && !next.some((item) => item.isBanner) ? withBannerAt(next, next[0].url) : next);
      toast.success(
        uploaded.length === 1 ? "Photo added to your gallery." : `${uploaded.length} photos added.`,
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDropFiles(event: React.DragEvent) {
    event.preventDefault();
    if (event.dataTransfer.files?.length) void addFiles(event.dataTransfer.files);
  }

  function onReorderDrop(toIndex: number) {
    if (dragIndex == null) return;
    onChange(reorderGallery(images, dragIndex, toIndex));
    setDragIndex(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border bg-muted/30",
          banner ? "border-input" : "border-dashed border-black/20",
        )}
      >
        {banner ? (
          <div className="relative h-[min(22rem,50svh)] w-full">
            <Image
              src={banner.url}
              alt="Main banner"
              fill
              unoptimized
              className="object-cover"
              sizes="(min-width: 1024px) 48rem, 100vw"
            />
            <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white">
              <Star className="size-3 fill-current" />
              Main banner
            </span>
          </div>
        ) : (
          <div className="flex h-[min(22rem,50svh)] flex-col items-center justify-center gap-2 px-6 text-center">
            <ImagePlus className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No banner yet</p>
            <p className="text-xs text-muted-foreground">
              Upload photos, then mark one as the main banner customers see first.
            </p>
          </div>
        )}
      </div>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDropFiles}
        className="rounded-xl border border-dashed border-black/20 bg-card px-4 py-5 text-center"
      >
        <p className="text-sm font-medium">Drag photos here or browse</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add {GALLERY_MIN}–{GALLERY_MAX} photos. {images.length} of {GALLERY_MAX} used.
          {images.length < GALLERY_MIN
            ? ` Add at least ${GALLERY_MIN - images.length} more.`
            : ""}
        </p>
        <div className="mt-3 flex justify-center">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading || remaining <= 0}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Spinner size="sm" label="Uploading" /> : null}
            {uploading ? "Uploading…" : remaining <= 0 ? "Gallery full" : "Upload photos"}
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) void addFiles(event.target.files);
          }}
        />
      </div>

      {images.length ? (
        <ul className="flex flex-wrap gap-2.5">
          {images.map((item, index) => (
            <li
              key={`${item.url}-${index}`}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => onReorderDrop(index)}
              className={cn(
                "group relative size-[4.75rem] shrink-0 overflow-hidden rounded-md border bg-muted sm:size-[5.25rem]",
                item.isBanner
                  ? "border-primary ring-2 ring-primary/25"
                  : "border-input",
                dragIndex === index && "opacity-60",
              )}
            >
              <Image
                src={item.url}
                alt=""
                fill
                unoptimized
                className="object-cover"
                sizes="84px"
                draggable={false}
              />

              {item.isBanner ? (
                <span className="absolute top-1 left-1 z-10 inline-flex items-center gap-0.5 rounded bg-primary px-1 py-0.5 text-[9px] font-semibold tracking-wide text-primary-foreground uppercase">
                  <Star className="size-2.5 fill-current" />
                  Banner
                </span>
              ) : null}

              <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-0.5 bg-gradient-to-t from-black/75 via-black/45 to-transparent px-1 pt-4 pb-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <span
                  className="inline-flex cursor-grab items-center text-white/90 active:cursor-grabbing"
                  title="Drag to reorder"
                >
                  <GripVertical className="size-3.5" />
                  <span className="sr-only">Drag to reorder</span>
                </span>
                <div className="flex items-center gap-0.5">
                  {!item.isBanner ? (
                    <button
                      type="button"
                      title="Set as banner"
                      className="rounded px-1 py-0.5 text-[9px] font-semibold text-white hover:bg-white/20"
                      onClick={() => onChange(withBannerAt(images, item.url))}
                    >
                      Set
                    </button>
                  ) : null}
                  <button
                    type="button"
                    title="Remove photo"
                    className="rounded p-0.5 text-white hover:bg-red-500/80"
                    onClick={() => {
                      const next = images.filter(
                        (_, current) => current !== index,
                      );
                      onChange(
                        next.length && !next.some((photo) => photo.isBanner)
                          ? withBannerAt(next, next[0].url)
                          : next,
                      );
                    }}
                  >
                    <Trash2 className="size-3" />
                    <span className="sr-only">Remove</span>
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
