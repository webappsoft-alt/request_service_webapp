"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isProMarketingPath, proPaths } from "@/lib/pro-paths";
import { cn } from "@/lib/utils";

/**
 * Where the RS logo goes (client: smart logo routing). Pro side — Pro login / auth (/pro/*) and
 * Pro marketing (/for-pros/*) — goes to the Pro landing page; everything else to the customer home.
 */
export function logoHomeFor(pathname: string | null | undefined): string {
  const path = String(pathname || "");
  const onPro = path === "/pro" || path.startsWith("/pro/") || isProMarketingPath(path);
  return onPro ? proPaths.home : "/";
}

export function Logo({
  className,
  inverse = false,
  compact = false,
  href,
  tagline,
}: {
  className?: string;
  inverse?: boolean;
  compact?: boolean;
  /** Explicit target; when left out it follows the side you're on (see logoHomeFor). Previous default: "/". */
  href?: string;
  /** Short brand slogan shown under the name. */
  tagline?: string;
}) {
  const pathname = usePathname();
  return (
    <Link
      href={href ?? logoHomeFor(pathname)}
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-label={(href ?? logoHomeFor(pathname)) === "/" ? "Request Service home" : "Request Service for pros home"}
    >
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-md text-[13px] font-semibold tracking-tight",
          inverse
            ? "bg-primary-foreground text-primary dark:bg-sky-500/15 dark:text-sky-300 dark:ring-1 dark:ring-sky-400/30"
            : "bg-primary text-primary-foreground"
        )}
      >
        RS
      </span>
      {compact ? null : tagline ? (
        <span className="flex flex-col leading-tight">
          <span
            className={cn(
              "text-[15px] font-semibold tracking-tight",
              inverse ? "text-primary-foreground dark:text-white" : "text-foreground"
            )}
          >
            Request Service
          </span>
          <span
            className={cn(
              "mt-0.5 text-[11px] font-medium tracking-wide",
              inverse ? "text-primary-foreground/75" : "text-muted-foreground"
            )}
          >
            {tagline}
          </span>
        </span>
      ) : (
        <span
          className={cn(
            "text-[15px] font-semibold tracking-tight",
            inverse ? "text-primary-foreground dark:text-white" : "text-foreground"
          )}
        >
          Request Service
        </span>
      )}
    </Link>
  );
}
