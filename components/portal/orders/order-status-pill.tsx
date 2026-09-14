import { cn } from "@/lib/utils";

export type ProviderOrderStatusKey =
  | "BOOKING_REQUESTED"
  | "CONFIRMED"
  | "IN_TRANSIT"
  | "ARRIVED"
  | "IN_PROGRESS"
  | "CHANGE_ORDER_PENDING"
  | "WORK_COMPLETED"
  | "SETTLED"
  | "CANCELLED"
  | "DISPUTED";

/** Safely formats any uppercase or underscore status into human-readable Title Case */
export function formatOrderStatus(status?: string | null): string {
  if (!status) return "—";
  const norm = status.trim().toUpperCase();
  const map: Record<string, string> = {
    BOOKING_REQUESTED: "Booking Requested",
    CONFIRMED: "Confirmed",
    IN_TRANSIT: "In Transit",
    ARRIVED: "Arrived",
    IN_PROGRESS: "In Progress",
    CHANGE_ORDER_PENDING: "Change Order Pending",
    WORK_COMPLETED: "Completed",
    SETTLED: "Settled",
    CANCELLED: "Cancelled",
    DISPUTED: "Disputed",
  };
  if (map[norm]) return map[norm];
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Safely formats payment status without underscores */
export function formatPaymentStatus(status?: string | null): string {
  if (!status) return "—";
  const norm = status.trim().toUpperCase();
  const map: Record<string, string> = {
    HOLD_AUTHORIZED: "Hold Authorized",
    AUTHORIZED: "Authorized",
    PENDING: "Pending",
    PAID: "Paid",
    CAPTURED: "Captured",
    REFUNDED: "Refunded",
    FAILED: "Failed",
  };
  if (map[norm]) return map[norm];
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getOrderStatusTone(status: string) {
  const norm = String(status || "").trim().toUpperCase();
  switch (norm) {
    case "BOOKING_REQUESTED":
    case "CONFIRMED":
    case "IN_PROGRESS":
      return "primary" as const;
    case "IN_TRANSIT":
    case "ARRIVED":
    case "CHANGE_ORDER_PENDING":
      return "warning" as const;
    case "WORK_COMPLETED":
    case "SETTLED":
      return "success" as const;
    case "CANCELLED":
    case "DISPUTED":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

export function getOrderStatusConfig(status?: string | null) {
  const norm = String(status || "").trim().toUpperCase();
  switch (norm) {
    case "BOOKING_REQUESTED":
      return {
        label: "Requested",
        fullLabel: "Booking Requested",
        pillClass: "bg-blue-50 text-blue-700 border-blue-200",
        dotClass: "bg-blue-500",
      };
    case "CONFIRMED":
      return {
        label: "Confirmed",
        fullLabel: "Confirmed",
        pillClass: "bg-sky-50 text-sky-700 border-sky-200",
        dotClass: "bg-sky-500",
      };
    case "IN_TRANSIT":
      return {
        label: "In Transit",
        fullLabel: "In Transit",
        pillClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
        dotClass: "bg-indigo-500",
      };
    case "ARRIVED":
      return {
        label: "Arrived",
        fullLabel: "Arrived",
        pillClass: "bg-amber-50 text-amber-800 border-amber-200",
        dotClass: "bg-amber-500",
      };
    case "IN_PROGRESS":
      return {
        label: "In Progress",
        fullLabel: "In Progress",
        pillClass: "bg-purple-50 text-purple-700 border-purple-200",
        dotClass: "bg-purple-500",
      };
    case "CHANGE_ORDER_PENDING":
      return {
        label: "Change Order",
        fullLabel: "Change Order Pending",
        pillClass: "bg-orange-50 text-orange-800 border-orange-200",
        dotClass: "bg-orange-500",
      };
    case "WORK_COMPLETED":
      return {
        label: "Completed",
        fullLabel: "Work Completed",
        pillClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dotClass: "bg-emerald-500",
      };
    case "SETTLED":
      return {
        label: "Settled",
        fullLabel: "Settled",
        pillClass: "bg-teal-50 text-teal-800 border-teal-200",
        dotClass: "bg-teal-600",
      };
    case "CANCELLED":
      return {
        label: "Cancelled",
        fullLabel: "Cancelled",
        pillClass: "bg-rose-50 text-rose-700 border-rose-200",
        dotClass: "bg-rose-500",
      };
    case "DISPUTED":
      return {
        label: "Disputed",
        fullLabel: "Disputed",
        pillClass: "bg-red-50 text-red-800 border-red-300",
        dotClass: "bg-red-600",
      };
    default:
      return {
        label: formatOrderStatus(status),
        fullLabel: formatOrderStatus(status),
        pillClass: "bg-slate-50 text-slate-700 border-slate-200",
        dotClass: "bg-slate-400",
      };
  }
}

/** Distinct, richly-colored pill badge with status dot indicator */
export function OrderStatusPill({
  status,
  full = false,
  className,
}: {
  status?: string | null;
  full?: boolean;
  className?: string;
}) {
  const config = getOrderStatusConfig(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide select-none shadow-xs",
        config.pillClass,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full shrink-0", config.dotClass)} />
      {full ? config.fullLabel : config.label}
    </span>
  );
}
