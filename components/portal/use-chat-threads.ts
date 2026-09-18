"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import {
  listProviderChatThreads,
  markProviderChatRead,
  sendProviderChatMessage,
} from "@/lib/api/chat-client";
import { mapChatThread } from "@/lib/api/crm-mappers";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
import { useAppSelector } from "@/store/hooks";
import { selectAuth, selectAuthUser } from "@/store/authSlice";
import { getAuthToken, getAuthUser } from "@/components/api/apiFuntions";
import {
  appendChatMessage,
  listChatThreads,
  markChatRead,
  subscribeChat,
  type ChatAttachment,
  type ChatRole,
  type ChatThread,
} from "@/lib/booking/chat-store";

const EMPTY: ChatThread[] = [];
const snapshots = new Map<string, { raw: string; value: ChatThread[] }>();

function snapshotFor(email: string) {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(`rs-chat-threads:${email}`) ?? "";
  const cached = snapshots.get(email);
  if (cached && cached.raw === raw) return cached.value;
  const value = listChatThreads(email);
  snapshots.set(email, { raw, value });
  return value;
}

/**
 * Safely merge incoming threads from API or snapshot with existing local threads.
 * Existing local messages (including real-time socket messages) are ALWAYS preserved,
 * preventing them from being wiped out by stale snapshots or partial API responses.
 */
function mergeThreads(existing: ChatThread[], incoming: ChatThread[]): ChatThread[] {
  if (existing.length === 0) return incoming;
  const map = new Map(existing.map((t) => [t.id, t]));
  const result: ChatThread[] = [];

  for (const inc of incoming) {
    const prev = map.get(inc.id);
    if (!prev) {
      result.push(inc);
      continue;
    }
    map.delete(inc.id);
    const existingMsgIds = new Set(
      prev.messages.map((m) => m.id || (m as any)._id).filter(Boolean),
    );
    const newFromInc = (inc.messages || []).filter(
      (m) => !existingMsgIds.has(m.id || (m as any)._id),
    );
    result.push({
      ...inc,
      updatedAt:
        prev.updatedAt && prev.updatedAt > inc.updatedAt ? prev.updatedAt : inc.updatedAt,
      messages: [...prev.messages, ...newFromInc],
    });
  }

  for (const remaining of map.values()) {
    result.push(remaining);
  }

  return result.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export function useChatThreads(options?: { enabled?: boolean }) {
  const isEnabled = options?.enabled ?? true;
  const { session, provider } = usePortalWorkspace();
  const crm = useCrmApiData();
  const auth = useAppSelector(selectAuth);
  const user = useAppSelector(selectAuthUser);
  const token = auth.token || (typeof window !== "undefined" ? getAuthToken() : null);
  const activeUser = user ?? (typeof window !== "undefined" ? getAuthUser() : null);
  const roleStr = String(activeUser?.role || auth.role || "").toLowerCase();
  const isProvider = !roleStr || roleStr === "provider" || roleStr === "pro";
  const isLive = Boolean(token && isProvider) || crm.enabled;
  const email = session?.email || provider.email || activeUser?.email || "";
  const liveOnly = Boolean(session) || isLive;

  const [apiThreads, setApiThreads] = useState<ChatThread[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const inFlightRef = useRef(false);

  const threads = useSyncExternalStore(
    subscribeChat,
    () => snapshotFor(email),
    () => EMPTY,
  );

  const fetchThreads = useCallback(
    async (options?: { silent?: boolean; force?: boolean }) => {
      if (!isLive || !isEnabled) return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const items = await listProviderChatThreads({
          silent: options?.silent ?? true,
          force: options?.force ?? true,
        });
        setApiThreads((prev) => mergeThreads(prev, items));
      } catch (err) {
        console.error("Failed to load provider chats:", err);
      } finally {
        inFlightRef.current = false;
        setInitialLoading(false);
      }
    },
    [isLive, isEnabled],
  );

  useEffect(() => {
    if (!isLive || !isEnabled) {
      if (auth.hydrated) {
        setInitialLoading(false);
      }
      return;
    }

    void fetchThreads({ silent: true, force: true });

    let debounceTimer = 0;
    const onRefresh = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        void fetchThreads({ silent: true, force: true });
      }, 200);
    };

    const handleRealtime = (event: Event) => {
      const custom = event as CustomEvent<{ type?: string; payload?: any }>;
      const detail = custom?.detail;

      if (detail?.type === "CHAT_MESSAGE" && detail.payload?.threadId && detail.payload?.message) {
        const { threadId, message, thread } = detail.payload;
        setApiThreads((prev) => {
          const index = prev.findIndex((t) => t.id === threadId);
          if (index >= 0) {
            const current = prev[index];
            const msgId = message.id || message._id;
            if (msgId && current.messages.some((m) => (m.id || (m as any)._id) === msgId)) {
              return prev;
            }
            const normalizedMessage = {
              ...message,
              id: msgId || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              at: message.at || message.createdAt || new Date().toISOString(),
            };
            const updated: ChatThread = {
              ...current,
              messages: [...current.messages, normalizedMessage],
              updatedAt: normalizedMessage.at,
              unreadForProvider:
                message.from === "customer"
                  ? (current.unreadForProvider || 0) + 1
                  : current.unreadForProvider,
            };
            const next = [...prev];
            next.splice(index, 1);
            return [updated, ...next];
          }
          if (thread) {
            const mapped = mapChatThread(thread);
            if (mapped) return [mapped, ...prev];
          }
          onRefresh();
          return prev;
        });
        return;
      }

      if (detail?.type === "CHAT_THREAD_UPDATED" && detail.payload?.id) {
        const mapped = mapChatThread(detail.payload);
        if (mapped) {
          setApiThreads((prev) => mergeThreads(prev, [mapped]));
          return;
        }
      }

      if (detail?.type === "CHAT_READ_RECEIPT" && detail.payload?.threadId) {
        const { threadId, readBy, unreadForProvider, unreadForCustomer } = detail.payload as {
          threadId: string;
          readBy?: string;
          unreadForProvider?: number;
          unreadForCustomer?: number;
        };
        setApiThreads((prev) =>
          prev.map((t) => {
            if (t.id !== threadId) return t;
            return {
              ...t,
              // If customer read, clear unreadForCustomer; if provider read, clear unreadForProvider
              unreadForCustomer:
                readBy === "customer"
                  ? (unreadForCustomer ?? 0)
                  : t.unreadForCustomer,
              unreadForProvider:
                readBy === "provider"
                  ? (unreadForProvider ?? 0)
                  : t.unreadForProvider,
              messages: t.messages.map((m) =>
                m.from !== readBy ? { ...m, isRead: true, status: "read" as const } : m
              ),
            };
          }),
        );
        return;
      }

      if (detail?.type === "INBOX_SUMMARY_INVALIDATE") {
        // Do not call onRefresh() here — INBOX_SUMMARY_INVALIDATE is emitted by
        // the backend after every chat message send, which would trigger a full
        // fetchThreads() GET call on every sent/received message. Thread state is
        // already kept in sync by the CHAT_MESSAGE and CHAT_THREAD_UPDATED handlers.
        return;
      }
    };

    // NOTE: Do NOT listen on CRM_API_EVENT (rs-crm-api) here.
    // That event fires on every CRM mutation (orders, estimates, vendors, etc.)
    // which would trigger a full fetchThreads() call on every unrelated action.
    // Chat thread state is maintained purely via the rs-realtime socket event bus.
    window.addEventListener("rs-realtime", handleRealtime);

    return () => {
      window.clearTimeout(debounceTimer);
      window.removeEventListener("rs-realtime", handleRealtime);
    };
  }, [isLive, auth.hydrated, fetchThreads]);

  useEffect(() => {
    if (crm.chats && crm.chats.length > 0) {
      setApiThreads((prev) => mergeThreads(prev, crm.chats));
      setInitialLoading(false);
    }
  }, [crm.chats]);

  const resolvedThreads = useMemo(() => {
    if (isLive) {
      if (apiThreads.length > 0) return apiThreads;
      if (crm.chats && crm.chats.length > 0) return crm.chats;
      return EMPTY;
    }
    return liveOnly ? EMPTY : threads;
  }, [isLive, crm.chats, apiThreads, liveOnly, threads]);

  const loading = useMemo(() => {
    if (resolvedThreads.length > 0) return false;
    if (isLive) {
      return initialLoading || inFlightRef.current;
    }
    return initialLoading;
  }, [resolvedThreads.length, isLive, initialLoading]);

  const unread = useMemo(
    () => resolvedThreads.reduce((sum, item) => sum + item.unreadForProvider, 0),
    [resolvedThreads],
  );

  const send = useCallback(
    async (threadId: string, from: ChatRole, text: string, attachments?: ChatAttachment[]) => {
      if (isLive) {
        if (from !== "provider") return;
        try {
          const updated = await sendProviderChatMessage(threadId, text, attachments);
          if (updated) {
            setApiThreads((prev) => {
              const idx = prev.findIndex((t) => t.id === threadId);
              if (idx >= 0) {
                const next = [...prev];
                // Only update metadata (updatedAt, unread counts) — the
                // socket's CHAT_MESSAGE event already appended the new message.
                // Merging the full updated thread here would cause duplicate
                // messages because the socket fires after the API responds.
                next[idx] = {
                  ...next[idx],
                  updatedAt: updated.updatedAt || new Date().toISOString(),
                  unreadForCustomer: updated.unreadForCustomer ?? next[idx].unreadForCustomer,
                  unreadForProvider: updated.unreadForProvider ?? next[idx].unreadForProvider,
                };
                return next;
              }
              return [updated, ...prev];
            });
          }
          // Do NOT call crm.refresh() here — the CHAT_MESSAGE socket event
          // already handles appending the message in real-time without an API call.
        } catch (err) {
          console.error("Failed to send chat message:", err);
          throw err;
        }
        return;
      }
      return appendChatMessage({ providerEmail: email, threadId, from, text, attachments });
    },
    [isLive, email],
  );

  const markRead = useCallback(
    (threadId: string) => {
      if (isLive) {
        setApiThreads((prev) =>
          prev.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  unreadForProvider: 0,
                  messages: t.messages.map((m) =>
                    m.from !== "provider" ? { ...m, isRead: true, status: "read" as const } : m,
                  ),
                }
              : t,
          ),
        );
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("rs-realtime", {
              detail: {
                type: "CHAT_READ_RECEIPT",
                payload: { threadId, readBy: "provider", unreadForProvider: 0 },
              },
            }),
          );
        }
        void markProviderChatRead(threadId)
          .then(() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("rs-realtime", {
                  detail: { type: "INBOX_SUMMARY_INVALIDATE" },
                }),
              );
            }
          })
          .catch(() => undefined);
        return;
      }
      markChatRead(email, threadId, "provider");
    },
    [isLive, email],
  );

  return {
    email,
    threads: resolvedThreads,
    unread,
    send,
    markRead,
    loading,
    refresh: fetchThreads,
  };
}
