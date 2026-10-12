"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "RS"
  );
}

/**
 * Provider logo, or a rounded brand-gradient initials badge when there is no logo or it
 * fails to load (no broken-image border).
 */
export function ProviderAvatar({ name, src, className }: { name: string; src: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote CDN avatars, tiny thumbnail
      <img
        src={src}
        alt=""
        draggable={false}
        onError={() => setFailed(true)}
        className={cn("size-9 shrink-0 rounded-full bg-muted object-cover ring-1 ring-border", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary/70 text-xs font-bold tracking-wide text-primary-foreground shadow-sm",
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
