/**
 * Shared dismiss state for provider inbox badges / dashboard alerts.
 * Survives remounts and page refresh (localStorage).
 * Cleared flags reset when a new matching realtime event arrives.
 * Independent of header "Mark all read".
 * Server-side ACK (inbox-summary/ack) is the source of truth after refresh.
 */

export type PortalInboxClearKind = "leads" | "orders" | "estimates";

type ClearState = Record<PortalInboxClearKind, boolean>;

const STORAGE_KEY = "rs-portal-inbox-clears";

const defaults: ClearState = {
  leads: false,
  orders: false,
  estimates: false,
};

function readStorage(): ClearState {
  if (typeof window === "undefined") return { ...defaults };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<ClearState>;
    return {
      leads: Boolean(parsed.leads),
      orders: Boolean(parsed.orders),
      estimates: Boolean(parsed.estimates),
    };
  } catch {
    return { ...defaults };
  }
}

function writeStorage(state: ClearState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

const cleared: ClearState = readStorage();

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
  writeStorage(cleared);
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
