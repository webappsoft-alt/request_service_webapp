/**
 * Module-level sidebar badge counts from `provider:inbox-counts`.
 * Survives NavLinks remounts; updated only by socket / live bumps — not REST.
 */

export type PortalInboxCounts = {
  newLeads: number;
  unreadChats: number;
  pendingOrders: number;
  pendingEstimates: number;
};

const counts: PortalInboxCounts = {
  newLeads: 0,
  unreadChats: 0,
  pendingOrders: 0,
  pendingEstimates: 0,
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
  const newLeads = Math.max(0, Number(next.newLeads) || 0);
  const unreadChats = Math.max(0, Number(next.unreadChats) || 0);
  const pendingOrders = Math.max(0, Number(next.pendingOrders) || 0);
  const pendingEstimates = Math.max(0, Number(next.pendingEstimates) || 0);
  if (
    counts.newLeads === newLeads &&
    counts.unreadChats === unreadChats &&
    counts.pendingOrders === pendingOrders &&
    counts.pendingEstimates === pendingEstimates
  ) {
    return;
  }
  counts.newLeads = newLeads;
  counts.unreadChats = unreadChats;
  counts.pendingOrders = pendingOrders;
  counts.pendingEstimates = pendingEstimates;
  notify();
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
