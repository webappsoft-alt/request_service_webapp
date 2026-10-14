"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

type BlogImageProps = {
  src?: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
};

/**
 * Blog cover / card image. Shows a soft shimmer while loading; missing or broken
 * sources fall back to a neutral gray placeholder instead of the browser's
 * broken-image icon and alt text.
 */
export function BlogImage({ src, alt, sizes, priority, className }: BlogImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const usable = src && src !== failedSrc ? src : null;

  if (!usable) {
    return (
      <div
        className="flex size-full items-center justify-center bg-neutral-200 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500"
        role="img"
        aria-label={alt}
      >
        <ImageOff className="size-8" strokeWidth={1.5} aria-hidden="true" />
      </div>
    );
  }

  // Shimmer sits underneath; the image paints over it once decoded. No load-state
  // toggle, so an image that finished loading before hydration is never left hidden.
  return (
    <>
      <div
        className="absolute inset-0 animate-pulse bg-neutral-200 dark:bg-neutral-800"
        aria-hidden="true"
      />
      <Image
        src={usable}
        alt={alt}
        fill
        priority={priority}
        unoptimized={usable.startsWith("http")}
        sizes={sizes}
        onError={() => setFailedSrc(usable)}
        className={cn("object-cover", className)}
      />
    </>
  );
}
