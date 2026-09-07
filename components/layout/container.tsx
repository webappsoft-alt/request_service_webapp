import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("container-site", className)} {...props} />;
}

export function Section({
  className,
  tone = "default",
  density = "default",
  ...props
}: ComponentProps<"section"> & {
  tone?: "default" | "muted" | "inverse";
  density?: "default" | "tight";
}) {
  return (
    <section
      className={cn(
        density === "tight" ? "section-space-tight" : "section-space",
        tone === "muted" && "bg-muted/60",
        tone === "inverse" && "bg-primary text-primary-foreground",
        className
      )}
      {...props}
    />
  );
}
