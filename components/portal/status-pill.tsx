import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StatusPill({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "primary";
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md border-transparent",
        !className && tone === "neutral" && "bg-muted text-foreground",
        !className && tone === "success" && "bg-emerald-50 text-emerald-800",
        !className && tone === "warning" && "bg-amber-50 text-amber-800",
        !className && tone === "danger" && "bg-red-50 text-red-800",
        !className && tone === "primary" && "bg-secondary text-primary",
        className,
      )}
    >
      {label}
    </Badge>
  );
}

export function requestTone(status: string) {
  switch (status) {
    case "new":
      return "primary" as const;
    case "accepted":
    case "converted_to_job":
      return "success" as const;
    case "declined":
    case "closed":
      return "danger" as const;
    case "estimate_sent":
    case "contacted":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

export function StatusDot({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "primary";
}) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span
        aria-hidden="true"
        className={cn(
          "size-2 shrink-0 rounded-full",
          tone === "success" && "bg-emerald-500",
          tone === "warning" && "bg-amber-400",
          tone === "danger" && "bg-red-500",
          tone === "primary" && "bg-[#003F7D]",
          tone === "neutral" && "bg-slate-400",
        )}
      />
      {label}
    </span>
  );
}

export function moneyTone(status: string) {
  switch (status) {
    case "paid":
    case "accepted":
    case "completed":
    case "succeeded":
      return "success" as const;
    case "overdue":
    case "rejected":
    case "cancelled":
    case "failed":
      return "danger" as const;
    case "sent":
    case "partially_paid":
    case "in_progress":
    case "scheduled":
    case "pending":
    case "processing":
    case "refunded":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}
