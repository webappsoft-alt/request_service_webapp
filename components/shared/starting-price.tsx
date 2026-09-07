import { formatStartingPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export function StartingPrice({
  value,
  size = "default",
  layout = "inline",
}: {
  value: number;
  size?: "sm" | "default" | "lg";
  layout?: "inline" | "stack";
}) {
  return (
    <p
      className={cn(
        "flex gap-1.5 leading-5",
        layout === "stack" ? "flex-col gap-1" : "items-baseline"
      )}
    >
      <span className="text-xs leading-5 text-muted-foreground">Starting from</span>
      <span
        className={cn(
          "font-semibold tracking-tight",
          size === "sm" && "text-sm leading-5",
          size === "default" && "text-base leading-5",
          size === "lg" && "text-3xl leading-none"
        )}
      >
        {formatStartingPrice(value)}
      </span>
    </p>
  );
}
