import type { CustomerOrderListItem } from "@/lib/types/order-booking";
import { formatMoney } from "@/lib/format";

/** Format an ISO datetime for customer-facing order UI. */
export function formatOrderDateTime(value: string | undefined | null): string {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatOrderDate(value: string | undefined | null): string {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatOrderTime(value: string | undefined | null): string {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatOrderWindow(
  start: string | undefined | null,
  end?: string | undefined | null,
): string {
  if (!start) return "—";
  if (!end) return formatOrderDateTime(start);
  return `${formatOrderDateTime(start)} – ${formatOrderTime(end)}`;
}

export function formatOrderMoney(
  amount: number | undefined | null,
  currency = "USD",
): string {
  const value = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return formatMoney(value);
  }
}

export function formatOrderAddressLine(
  address:
    | {
        street?: string;
        unit?: string;
        city?: string;
        state?: string;
        zip?: string;
      }
    | null
    | undefined,
): string {
  if (!address) return "";
  const street = address.street?.trim() || "";
  const unit = address.unit?.trim() || "";
  const city = address.city?.trim() || "";
  const state = address.state?.trim() || "";
  const zip = address.zip?.trim() || "";

  // API sometimes embeds city/state/zip inside street — avoid repeating.
  if (street) {
    const streetLower = street.toLowerCase();
    const alreadyHasCity = city ? streetLower.includes(city.toLowerCase()) : false;
    const alreadyHasZip = zip ? street.includes(zip) : false;
    if (alreadyHasCity || alreadyHasZip) {
      return unit && !streetLower.includes(unit.toLowerCase())
        ? `${street}, ${unit}`
        : street;
    }
  }

  const line1 = [street, unit].filter(Boolean).join(", ");
  const line2 = [city, state].filter(Boolean).join(", ");
  const cityStateZip = [line2, zip].filter(Boolean).join(" ");
  return [line1, cityStateZip].filter(Boolean).join(" · ");
}

export function orderServiceTitle(order: CustomerOrderListItem): string {
  return order.service?.title?.trim() || "Service order";
}
