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

/** Booked / in-flight — not settled or cancelled. Blocks re-booking the same fixed service. */
const OPEN_ORDER_STATUSES = new Set([
  "BOOKING_REQUESTED",
  "CONFIRMED",
  "IN_TRANSIT",
  "ARRIVED",
  "IN_PROGRESS",
  "CHANGE_ORDER_PENDING",
  "WORK_COMPLETED",
  "DISPUTED",
]);

export function isOpenCustomerOrderStatus(
  status: OrderStatus | string | undefined,
): boolean {
  const key = String(status || "").trim().toUpperCase();
  return OPEN_ORDER_STATUSES.has(key);
}

/** Newest open order for a fixed service id, if any. */
export function findOpenOrderForService<
  T extends {
    id: string;
    status: OrderStatus | string;
    service?: { id?: string } | null;
    serviceId?: string;
    createdAt?: string;
    updatedAt?: string;
  },
>(orders: T[], serviceId: string): T | null {
  const target = String(serviceId || "").trim();
  if (!target) return null;
  const matches = orders.filter((order) => {
    if (!isOpenCustomerOrderStatus(order.status)) return false;
    const orderServiceId =
      String(order.service?.id || order.serviceId || "").trim();
    return orderServiceId === target;
  });
  if (!matches.length) return null;
  return [...matches].sort((a, b) => {
    const aAt = String(a.updatedAt || a.createdAt || "");
    const bAt = String(b.updatedAt || b.createdAt || "");
    return bAt.localeCompare(aAt);
  })[0];
}
