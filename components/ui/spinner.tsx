import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "size-4",
  md: "size-8",
  lg: "size-10",
} as const;

export function Spinner({
  className,
  size = "md",
  label = "Loading",
}: {
  className?: string;
  size?: keyof typeof sizeClasses;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("relative inline-flex shrink-0", sizeClasses[size], className)}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 animate-[spin_0.85s_linear_infinite] rounded-full border-2 border-primary/20 border-t-primary"
      />
      <span
        aria-hidden="true"
        className="absolute inset-[3px] animate-[spin_1.25s_linear_infinite_reverse] rounded-full border-2 border-transparent border-b-primary/55"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function CenteredSpinner({
  className,
  label = "Loading",
  size = "md",
}: {
  className?: string;
  label?: string;
  size?: keyof typeof sizeClasses;
}) {
  return (
    <div
      className={cn(
        "flex min-h-48 w-full items-center justify-center",
        className,
      )}
    >
      <Spinner size={size} label={label} />
    </div>
  );
}
