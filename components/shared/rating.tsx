import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Rating({
  value,
  count,
  size = "sm",
}: {
  value: number;
  count?: number;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Star
        className={cn(
          "fill-warning text-warning",
          size === "sm" ? "size-3.5" : "size-4"
        )}
        aria-hidden="true"
      />
      <span className={cn("font-medium", size === "sm" ? "text-sm" : "text-base")}>
        {value.toFixed(1)}
      </span>
      {typeof count === "number" ? (
        <span className="text-sm text-muted-foreground">
          ({count.toLocaleString("en-US")} reviews)
        </span>
      ) : null}
    </div>
  );
}
