"use client";

import { useEffect, useSyncExternalStore } from "react";
import { onSocketEvent } from "@/components/socket/socket-api";
import { listTechChats, type TechChatSide, type TechChatThread } from "@/lib/api/technician-chat-client";

/**
 * Live unread counts for technician ↔ provider chat, shared by every badge on
 * the page (sidebar, header, chat buttons). One fetch per side, then the
 * socket keeps it current (`techchat:unread` totals, per-thread `techchat:message`).
 */

type Store = {
  total: number;
  /** Unread per thread id, from the latest thread summaries we've seen. */
  byThread: Map<string, number>;
  /** Thread id per work record (`job:<id>`, `estimate:<id>`, `payment:<id|none>`). */
  byContext: Map<string, string>;
  listeners: Set<() => void>;
  loaded: boolean;
  version: number;
};

const stores: Record<TechChatSide, Store> = {
  technician: { total: 0, byThread: new Map(), byContext: new Map(), listeners: new Set(), loaded: false, version: 0 },
  provider: { total: 0, byThread: new Map(), byContext: new Map(), listeners: new Set(), loaded: false, version: 0 },
};

function notify(store: Store) {
  store.version += 1;
  store.listeners.forEach((fn) => fn());
}

export function setTechChatUnreadTotal(side: TechChatSide, total: number) {
  const store = stores[side];
  if (store.total === total) return;
  store.total = Math.max(0, total);
  notify(store);
}

/** Record a thread summary's unread count for this side. */
export function rememberTechChatThread(side: TechChatSide, thread: TechChatThread) {
  const store = stores[side];
  const count = side === "technician" ? thread.unreadForTechnician : thread.unreadForProvider;
  store.byContext.set(contextKey(thread.contextType, thread.contextId), thread.id);
  if (store.byThread.get(thread.id) === count) return;
  store.byThread.set(thread.id, count || 0);
  notify(store);
}

export function contextKey(type: string, id?: string | null) {
  return `${type}:${id || "none"}`;
}

let socketBound = false;
function bindSocket() {
  if (socketBound) return;
  socketBound = true;
  // Each portal only receives its own side's events, so both stores can listen.
  onSocketEvent("techchat:unread", (payload) => {
    const side: TechChatSide = isTechnicianPortal() ? "technician" : "provider";
    setTechChatUnreadTotal(side, Number(payload?.total) || 0);
  });
  onSocketEvent("techchat:message", (payload) => {
    if (!payload?.thread) return;
    rememberTechChatThread(isTechnicianPortal() ? "technician" : "provider", payload.thread);
  });
  onSocketEvent("techchat:read", (payload) => {
    const side: TechChatSide = isTechnicianPortal() ? "technician" : "provider";
    if (payload?.reader !== side) return;
    const store = stores[side];
    if (!store.byThread.get(payload.threadId)) return;
    store.byThread.set(payload.threadId, 0);
    notify(store);
  });
}

function isTechnicianPortal() {
  // Contractors use the same field-side chat engine as technicians.
  if (typeof window === "undefined") return false;
  const path = window.location.pathname;
  return path.startsWith("/technical") || path.startsWith("/contractor");
}

async function load(side: TechChatSide) {
  const store = stores[side];
  if (store.loaded) return;
  store.loaded = true;
  try {
    const { threads, unread } = await listTechChats(side, { limit: 100 });
    threads.forEach((thread) => rememberTechChatThread(side, thread));
    setTechChatUnreadTotal(side, unread);
  } catch {
    store.loaded = false;
  }
}

function subscribe(side: TechChatSide) {
  return (fn: () => void) => {
    stores[side].listeners.add(fn);
    return () => stores[side].listeners.delete(fn);
  };
}

const subscribers = { technician: subscribe("technician"), provider: subscribe("provider") };

/**
 * Total unread messages for this side, or for one thread (`threadId`), or for
 * the thread about one work record (`context`, e.g. contextKey("job", id)).
 */
export function useTechChatUnread(side: TechChatSide, threadId?: string | null, context?: string | null) {
  useEffect(() => {
    bindSocket();
    void load(side);
  }, [side]);
  return useSyncExternalStore(
    subscribers[side],
    () => {
      const store = stores[side];
      const id = threadId || (context ? store.byContext.get(context) : null);
      if (id) return store.byThread.get(id) || 0;
      return context ? 0 : store.total;
    },
    () => 0,
  );
}
