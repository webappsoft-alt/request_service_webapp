/**
 * Shared dismiss state for provider inbox badges / dashboard alerts.
 * Survives component remounts (sidebar stays mounted; dashboard remounts).
 * Cleared flags reset when a new matching realtime event arrives.
 */

export type PortalInboxClearKind = "leads" | "orders" | "estimates";

type ClearState = Record<PortalInboxClearKind, boolean>;

const cleared: ClearState = {
  leads: false,
  orders: false,
  estimates: false,
};

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function getPortalInboxCleared(kind: PortalInboxClearKind): boolean {
  return cleared[kind];
}

export function getPortalInboxClearState(): ClearState {
  return { ...cleared };
}

export function setPortalInboxCleared(kind: PortalInboxClearKind, value = true) {
  if (cleared[kind] === value) return;
  cleared[kind] = value;
  notify();
}

/** Re-show badge/banner when a new item of this kind arrives. */
export function reopenPortalInboxBadge(kind: PortalInboxClearKind) {
  setPortalInboxCleared(kind, false);
}

export function subscribePortalInboxClears(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
