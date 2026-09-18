"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useCrmApiData } from "@/components/portal/use-crm-api-data";
import { CRM_API_EVENT } from "@/components/portal/crm-data-provider";
import {
  listProviderChatThreads,
  markProviderChatRead,
  sendProviderChatMessage,
} from "@/lib/api/chat-client";
import { mapChatThread } from "@/lib/api/crm-mappers";
import { usePortalWorkspace } from "@/components/portal/use-portal-workspace";
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

export function useChatThreads() {
  const { session, provider } = usePortalWorkspace();
  const crm = useCrmApiData();
  const email = session?.email || provider.email;
  const liveOnly = Boolean(session) || crm.enabled;

  const [apiThreads, setApiThreads] = useState<ChatThread[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const inFlightRef = useRef(false);

  const threads = useSyncExternalStore(
    subscribeChat,
    () => snapshotFor(email),
    () => EMPTY,
  );

  const fetchThreads = useCallback(async (silent = true) => {
    if (!crm.enabled) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const items = await listProviderChatThreads({ silent });
      setApiThreads(items);
    } catch (err) {
      console.error("Failed to load provider chats:", err);
    } finally {
      inFlightRef.current = false;
      setInitialLoading(false);
    }
  }, [crm.enabled]);

  useEffect(() => {
    if (!crm.enabled) {
      setInitialLoading(false);
      return;
    }

    void fetchThreads();
    void crm.ensureLoaded();

    let debounceTimer = 0;
    const onRefresh = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        void fetchThreads(true);
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
            if (current.messages.some((m) => m.id === message.id)) {
              return prev;
            }
            const updated: ChatThread = {
              ...current,
              messages: [...current.messages, message],
              updatedAt: message.at || new Date().toISOString(),
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
          setApiThreads((prev) => {
            const index = prev.findIndex((t) => t.id === mapped.id);
            if (index >= 0) {
              const next = [...prev];
              next[index] = mapped;
              return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
            }
            return [mapped, ...prev].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          });
          return;
        }
      }

      onRefresh();
    };

    window.addEventListener(CRM_API_EVENT, onRefresh);
    window.addEventListener("rs-realtime", handleRealtime);

    return () => {
      window.clearTimeout(debounceTimer);
      window.removeEventListener(CRM_API_EVENT, onRefresh);
      window.removeEventListener("rs-realtime", handleRealtime);
    };
  }, [crm, crm.enabled, fetchThreads]);

  useEffect(() => {
    if (crm.chats && crm.chats.length > 0) {
      setApiThreads(crm.chats);
      setInitialLoading(false);
    }
  }, [crm.chats]);

  const resolvedThreads = useMemo(() => {
    if (crm.enabled) {
      if (apiThreads.length > 0) return apiThreads;
      if (crm.chats.length > 0) return crm.chats;
      return EMPTY;
    }
    return liveOnly ? EMPTY : threads;
  }, [crm.enabled, crm.chats, apiThreads, liveOnly, threads]);

  const loading = useMemo(() => {
    if (resolvedThreads.length > 0) return false;
    if (crm.enabled) {
      return initialLoading || inFlightRef.current || !crm.ready;
    }
    return initialLoading;
  }, [resolvedThreads.length, crm.enabled, crm.ready, initialLoading]);

  const unread = useMemo(
    () => resolvedThreads.reduce((sum, item) => sum + item.unreadForProvider, 0),
    [resolvedThreads],
  );


  const send = useCallback(
    async (threadId: string, from: ChatRole, text: string, attachments?: ChatAttachment[]) => {
      if (crm.enabled) {
        if (from !== "provider") return;
        try {
          const updated = await sendProviderChatMessage(threadId, text, attachments);
          if (updated) {
            setApiThreads((prev) => {
              const idx = prev.findIndex((t) => t.id === threadId);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = updated;
                return next;
              }
              return [updated, ...prev];
            });
          }
          void crm.refresh({ silent: true });
        } catch (err) {
          console.error("Failed to send chat message:", err);
          throw err;
        }
        return;
      }
      return appendChatMessage({ providerEmail: email, threadId, from, text, attachments });
    },
    [crm, email],
  );

  const markRead = useCallback(
    (threadId: string) => {
      if (crm.enabled) {
        setApiThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, unreadForProvider: 0 } : t)),
        );
        void markProviderChatRead(threadId).catch(() => undefined);
        void crm.refresh({ silent: true });
        return;
      }
      markChatRead(email, threadId, "provider");
    },
    [crm, email],
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

