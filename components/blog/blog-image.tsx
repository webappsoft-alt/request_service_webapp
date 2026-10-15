"use client";

import { useState } from "react";
import Image from "next/image";
import { Newspaper } from "lucide-react";
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
 * sources fall back to a soft branded placeholder instead of the browser's
 * broken-image icon and alt text.
 */
export function BlogImage({ src, alt, sizes, priority, className }: BlogImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const usable = src && src !== failedSrc ? src : null;

  if (!usable) {
    return (
      <div
        className="flex size-full items-center justify-center bg-linear-to-br from-primary/10 via-muted to-primary/5"
        role="img"
        aria-label={alt}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-background/70 text-primary/50 ring-1 ring-primary/10">
          <Newspaper className="size-5" strokeWidth={1.5} aria-hidden="true" />
        </span>
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
