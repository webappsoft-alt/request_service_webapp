/**
 * Shared dismiss state for customer sidebar badges.
 * Survives remounts; reopened when a matching realtime event arrives.
 * Independent of header "Mark all read".
 */

export type CustomerInboxClearKind = "estimates" | "invoices" | "orders";

type ClearState = Record<CustomerInboxClearKind, boolean>;

const cleared: ClearState = {
  estimates: false,
  invoices: false,
  orders: false,
};

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function getCustomerInboxClearState(): ClearState {
  return { ...cleared };
}

export function setCustomerInboxCleared(kind: CustomerInboxClearKind, value = true) {
  if (cleared[kind] === value) return;
  cleared[kind] = value;
  notify();
}

export function reopenCustomerInboxBadge(kind: CustomerInboxClearKind) {
  setCustomerInboxCleared(kind, false);
}

export function subscribeCustomerInboxClears(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
