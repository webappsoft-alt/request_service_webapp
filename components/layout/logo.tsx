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
      aria-label="Request Services home"
    >
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-md text-[13px] font-semibold tracking-tight",
          inverse
            ? "bg-primary-foreground text-primary"
            : "bg-primary text-primary-foreground"
        )}
      >
        RS
      </span>
      {compact ? null : (
        <span
          className={cn(
            "text-[15px] font-semibold tracking-tight",
            inverse ? "text-primary-foreground" : "text-foreground"
          )}
        >
          Request Services
        </span>
      )}
    </Link>
  );
}
