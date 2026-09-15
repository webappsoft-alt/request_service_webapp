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
        <ul className="grid gap-3 sm:grid-cols-3">
          {images.map((item, index) => (
            <li
              key={`${item.url}-${index}`}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => onReorderDrop(index)}
              className={cn(
                "group relative overflow-hidden rounded-lg border bg-card",
                item.isBanner ? "border-primary" : "border-input",
              )}
            >
              <div className="relative aspect-[4/3]">
                <Image src={item.url} alt="" fill unoptimized className="object-cover" sizes="220px" />
              </div>
              <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <GripVertical className="size-3.5" />
                  Drag
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={item.isBanner ? "default" : "outline"}
                    className="h-7 px-2 text-[11px]"
                    onClick={() => onChange(withBannerAt(images, item.url))}
                  >
                    {item.isBanner ? "Banner" : "Set banner"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-destructive"
                    onClick={() => {
                      const next = images.filter((_, current) => current !== index);
                      onChange(
                        next.length && !next.some((photo) => photo.isBanner)
                          ? withBannerAt(next, next[0].url)
                          : next,
                      );
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    <span className="sr-only">Remove</span>
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
