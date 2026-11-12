import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Premium" badge for Premium Business Profiles — the same mark on customer cards, the public
 * profile and the Pro's own Business Profile.
 *
 * tone "solid" sits on photos; "soft" sits on white cards / headers.
 */
export function PremiumBadge({
  className,
  size = "sm",
  tone = "soft",
  label = "Premium",
}: {
  className?: string;
  size?: "xs" | "sm" | "md";
  tone?: "soft" | "solid";
  label?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-semibold whitespace-nowrap",
        size === "xs" && "px-2 py-0.5 text-[10px]",
        size === "sm" && "px-2.5 py-0.5 text-xs",
        size === "md" && "px-3 py-1 text-sm",
        tone === "solid"
          ? "bg-linear-to-r from-amber-400 to-amber-500 text-amber-950 shadow-sm ring-1 ring-amber-300/60"
          : "bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
        className,
      )}
      title="Premium Business Profile"
    >
      <Crown className={cn(size === "md" ? "size-4" : "size-3.5", "fill-current")} aria-hidden="true" />
      {label}
    </span>
  );
}
