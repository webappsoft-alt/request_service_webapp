"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** "Lauren Carter" → "LC", "Marcus" → "MA". */
export function avatarInitials(name: string | null | undefined): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "RS";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * User avatar used across the app: the uploaded profile picture when there is one (and it loads),
 * otherwise the person's initials on ONE solid brand colour — no random colours or gradients.
 * Size it with `className` (default 36px).
 */
export function UserAvatar({
  name,
  src,
  className,
}: {
  name: string | null | undefined;
  src?: string | null;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-uploaded avatars from any CDN, tiny thumbnail
      <img
        src={src as string}
        alt={name ? `${name}` : ""}
        draggable={false}
        onError={() => setFailedSrc(src ?? null)}
        className={cn("size-9 shrink-0 rounded-full bg-muted object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold tracking-wide text-primary-foreground select-none",
        className,
      )}
    >
      {avatarInitials(name)}
    </span>
  );
}
