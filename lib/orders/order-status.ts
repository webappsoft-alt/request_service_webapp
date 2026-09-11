import type { OrderStatus, PaymentStatus } from "@/lib/types/order-booking";

export type OrderStatusBadgeTone =
  | "default"
  | "secondary"
  | "outline"
  | "destructive";

const STATUS_LABELS: Record<string, string> = {
  BOOKING_REQUESTED: "Booking requested",
  CONFIRMED: "Confirmed",
  IN_TRANSIT: "In transit",
  ARRIVED: "Arrived",
  IN_PROGRESS: "In progress",
  CHANGE_ORDER_PENDING: "Change order pending",
  WORK_COMPLETED: "Work completed",
  SETTLED: "Settled",
  CANCELLED: "Cancelled",
  DISPUTED: "Disputed",
};

const PAYMENT_LABELS: Record<string, string> = {
  HOLD_AUTHORIZED: "Hold authorized",
  PAID: "Paid",
  REFUNDED: "Refunded",
  FAILED: "Failed",
};

/** Human-readable order status for badges and detail headers. */
export function formatOrderStatus(status: OrderStatus | string | undefined): string {
  const key = String(status || "").trim().toUpperCase();
  if (!key) return "Unknown";
  return STATUS_LABELS[key] || key.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatPaymentStatus(
  status: PaymentStatus | string | undefined,
): string {
  const key = String(status || "").trim().toUpperCase();
  if (!key) return "—";
  return (
    PAYMENT_LABELS[key] ||
    key.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** Map order status → existing Badge variant (no new colors). */
export function orderStatusBadgeVariant(
  status: OrderStatus | string | undefined,
): OrderStatusBadgeTone {
  const key = String(status || "").trim().toUpperCase();
  switch (key) {
    case "SETTLED":
      return "default";
    case "CANCELLED":
    case "DISPUTED":
    case "FAILED":
      return "destructive";
    case "CONFIRMED":
    case "IN_TRANSIT":
    case "ARRIVED":
    case "IN_PROGRESS":
    case "CHANGE_ORDER_PENDING":
    case "WORK_COMPLETED":
      return "secondary";
    case "BOOKING_REQUESTED":
    default:
      return "outline";
  }
}
