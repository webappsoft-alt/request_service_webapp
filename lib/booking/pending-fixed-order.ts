import type { BookingSlot } from "@/lib/types/order-booking";

const PENDING_FIXED_ORDER_KEY = "rs-pending-fixed-order";

export type PendingFixedOrderAddress = {
  /** Autocomplete display value */
  label: string;
  /** Street / line-1 (API key: address) */
  address: string;
  /** @deprecated Prefer `address` */
  street?: string;
  city: string;
  state: string;
  zip: string;
  unit: string;
  notes: string;
  lat: number | null;
  lng: number | null;
};

/** Temporary draft saved when an unauthenticated user must log in mid-checkout. */
export type PendingFixedOrder = {
  serviceId: string;
  serviceSlug: string;
  categorySlug?: string;
  returnPath: string;
  /** Order UI section — currently a single checkout dialog. */
  step: "checkout";
  date: string;
  selectedSlot: BookingSlot | null;
  address: PendingFixedOrderAddress;
  customerNotes: string;
  timezone?: string;
  savedAt: number;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeAddress(
  raw: Partial<PendingFixedOrderAddress> | null | undefined,
): PendingFixedOrderAddress {
  const line = String(raw?.address || raw?.street || "").trim();
  return {
    label: String(raw?.label || line || ""),
    address: line,
    street: line,
    city: String(raw?.city || ""),
    state: String(raw?.state || ""),
    zip: String(raw?.zip || ""),
    unit: String(raw?.unit || ""),
    notes: String(raw?.notes || ""),
    lat:
      raw?.lat != null && Number.isFinite(Number(raw.lat))
        ? Number(raw.lat)
        : null,
    lng:
      raw?.lng != null && Number.isFinite(Number(raw.lng))
        ? Number(raw.lng)
        : null,
  };
}

export function readPendingFixedOrder(): PendingFixedOrder | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_FIXED_ORDER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingFixedOrder;
    if (!parsed?.serviceId || !parsed?.serviceSlug || !parsed?.returnPath) {
      return null;
    }
    return {
      ...parsed,
      address: normalizeAddress(parsed.address),
    };
  } catch {
    return null;
  }
}

export function writePendingFixedOrder(draft: PendingFixedOrder) {
  if (!isBrowser()) return;
  window.sessionStorage.setItem(
    PENDING_FIXED_ORDER_KEY,
    JSON.stringify({
      ...draft,
      address: normalizeAddress(draft.address),
      savedAt: Date.now(),
    }),
  );
}

export function clearPendingFixedOrder() {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(PENDING_FIXED_ORDER_KEY);
}

export function pendingFixedOrderMatchesService(
  draft: PendingFixedOrder | null,
  serviceId: string,
  serviceSlug: string,
): boolean {
  if (!draft) return false;
  return draft.serviceId === serviceId || draft.serviceSlug === serviceSlug;
}
