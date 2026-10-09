import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  inverse = false,
  compact = false,
  href = "/",
}: {
  className?: string;
  inverse?: boolean;
  compact?: boolean;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-label="Request Service home"
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
      {compact ? null : (
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
