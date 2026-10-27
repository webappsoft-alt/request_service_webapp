/**
 * Module-level sidebar badge counts from `provider:inbox-counts`.
 * Survives NavLinks remounts; updated only by socket / live bumps — not REST.
 */

export type PortalInboxCounts = {
  newLeads: number;
  unreadChats: number;
  pendingOrders: number;
  pendingEstimates: number;
  /** Unread customer / field updates per section (estimate signed, change order answered…). */
  estimateUpdates: number;
  jobUpdates: number;
  scheduleUpdates: number;
  orderUpdates: number;
};

const KEYS: Array<keyof PortalInboxCounts> = [
  "newLeads",
  "unreadChats",
  "pendingOrders",
  "pendingEstimates",
  "estimateUpdates",
  "jobUpdates",
  "scheduleUpdates",
  "orderUpdates",
];

const counts: PortalInboxCounts = {
  newLeads: 0,
  unreadChats: 0,
  pendingOrders: 0,
  pendingEstimates: 0,
  estimateUpdates: 0,
  jobUpdates: 0,
  scheduleUpdates: 0,
  orderUpdates: 0,
};

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function getPortalInboxCounts(): PortalInboxCounts {
  return { ...counts };
}

export function applyPortalInboxCounts(
  next: Partial<PortalInboxCounts> | null | undefined,
) {
  if (!next || typeof next !== "object") return;
  let changed = false;
  // Keys missing from `next` (older payloads) keep their value.
  for (const key of KEYS) {
    if (next[key] === undefined) continue;
    const value = Math.max(0, Number(next[key]) || 0);
    if (counts[key] !== value) {
      counts[key] = value;
      changed = true;
    }
  }
  if (changed) notify();
}

export function bumpPortalInboxCount(
  kind: keyof PortalInboxCounts,
  delta = 1,
) {
  const next = Math.max(0, (counts[kind] || 0) + delta);
  if (counts[kind] === next) return;
  counts[kind] = next;
  notify();
}

export function clearPortalInboxCount(kind: keyof PortalInboxCounts) {
  if (counts[kind] === 0) return;
  counts[kind] = 0;
  notify();
}

export function subscribePortalInboxCounts(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
