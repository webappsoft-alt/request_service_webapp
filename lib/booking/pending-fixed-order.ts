import type { BookingSlot } from "@/lib/types/order-booking";

const PENDING_FIXED_ORDER_KEY = "rs-pending-fixed-order";

export type PendingFixedOrderAddress = {
  label: string;
  street: string;
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

export function readPendingFixedOrder(): PendingFixedOrder | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_FIXED_ORDER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingFixedOrder;
    if (!parsed?.serviceId || !parsed?.serviceSlug || !parsed?.returnPath) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePendingFixedOrder(draft: PendingFixedOrder) {
  if (!isBrowser()) return;
  window.sessionStorage.setItem(
    PENDING_FIXED_ORDER_KEY,
    JSON.stringify({ ...draft, savedAt: Date.now() }),
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
